import Redis from "ioredis";
import { REDIS_URL, HOLD_TTL_SECONDS, SESSION_TTL_SECONDS, MAX_CONCURRENT_PER_SHOWTIME } from "./config";

// ioredis over Upstash's TCP endpoint — a persistent connection, unlike
// Upstash's REST client, which is required for pub/sub to work.
export const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });

// A second connection dedicated to subscribing — a Redis connection that's
// in subscribe mode can't also run normal commands, so pub/sub needs its
// own client separate from the one used for locks/queues.
export const redisSub = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });

redis.on("error", (e) => console.error("Redis error:", e.message));
redisSub.on("error", (e) => console.error("Redis (sub) error:", e.message));

// ============================================================
// Seat locking — the classic "two people book the same seat" problem.
// ============================================================

function seatLockKey(showtimeId: string, seat: string) {
  return `lock:showtime:${showtimeId}:seat:${seat}`;
}

/**
 * Attempts to hold a seat for `userId`. Uses SET ... NX EX, which is
 * atomic — only one caller can ever win the lock for a given seat, which
 * is exactly what prevents a double-booking race condition. Returns
 * false if the seat is already held by someone else (or booked).
 */
export async function tryHoldSeat(showtimeId: string, seat: string, userId: string): Promise<boolean> {
  const result = await redis.set(seatLockKey(showtimeId, seat), userId, "EX", HOLD_TTL_SECONDS, "NX");
  return result === "OK";
}

export async function releaseSeatHold(showtimeId: string, seat: string, userId: string): Promise<void> {
  // Only release if this user actually holds it (avoid releasing someone
  // else's lock by accident) — a small Lua script keeps the check+delete atomic.
  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, 1, seatLockKey(showtimeId, seat), userId);
}

export async function getSeatHoldOwner(showtimeId: string, seat: string): Promise<string | null> {
  return redis.get(seatLockKey(showtimeId, seat));
}

export async function getHeldSeats(showtimeId: string, allSeatIds: string[]): Promise<string[]> {
  if (allSeatIds.length === 0) return [];
  const keys = allSeatIds.map((s) => seatLockKey(showtimeId, s));
  const values = await redis.mget(...keys);
  return allSeatIds.filter((_, i) => values[i] !== null);
}

// ============================================================
// Pub/Sub — live seat-map updates pushed to everyone viewing a showtime.
// ============================================================

function showtimeChannel(showtimeId: string) {
  return `showtime:${showtimeId}:events`;
}

export type SeatEvent =
  | { type: "seat_held"; seat: string }
  | { type: "seat_released"; seat: string }
  | { type: "seat_booked"; seats: string[] };

export async function publishSeatEvent(showtimeId: string, event: SeatEvent) {
  await redis.publish(showtimeChannel(showtimeId), JSON.stringify(event));
}

// ============================================================
// Virtual waiting room — caps how many people can be actively picking
// seats for one showtime at once; everyone else waits in a FIFO queue.
// ============================================================

function activeSetKey(showtimeId: string) {
  return `active:showtime:${showtimeId}`;
}
function queueKey(showtimeId: string) {
  return `queue:showtime:${showtimeId}`;
}

/**
 * Called when a user wants to start picking seats. If there's room under
 * the concurrency cap, they're let in immediately. Otherwise they're
 * placed at the back of the queue and told their position.
 */
export async function requestSession(
  showtimeId: string,
  userId: string,
  maxConcurrent = MAX_CONCURRENT_PER_SHOWTIME
): Promise<{ status: "active" } | { status: "queued"; position: number }> {
  const activeKey = activeSetKey(showtimeId);

  // Drop any active sessions whose TTL member expired — ZSET members don't
  // expire individually, so we sweep out entries older than the session TTL.
  const cutoff = Date.now() - SESSION_TTL_SECONDS * 1000;
  await redis.zremrangebyscore(activeKey, 0, cutoff);

  const activeCount = await redis.zcard(activeKey);

  const alreadyActive = await redis.zscore(activeKey, userId);
  if (alreadyActive !== null) {
    await redis.zadd(activeKey, Date.now(), userId); // refresh
    return { status: "active" };
  }

  if (activeCount < maxConcurrent) {
    await redis.zadd(activeKey, Date.now(), userId);
    await redis.zrem(queueKey(showtimeId), userId);
    return { status: "active" };
  }

  // Not enough room — join the queue (score = join time, so ZRANGE gives FIFO order).
  const existingScore = await redis.zscore(queueKey(showtimeId), userId);
  if (existingScore === null) {
    await redis.zadd(queueKey(showtimeId), Date.now(), userId);
  }
  const position = await redis.zrank(queueKey(showtimeId), userId);
  return { status: "queued", position: (position ?? 0) + 1 };
}

/** Call when a user finishes (books or leaves) to free their session slot. */
export async function endSession(showtimeId: string, userId: string) {
  await redis.zrem(activeSetKey(showtimeId), userId);
}

export async function getQueueLength(showtimeId: string): Promise<number> {
  return redis.zcard(queueKey(showtimeId));
}
