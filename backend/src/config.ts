import dotenv from "dotenv";
dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}. Did you copy .env.example to .env?`);
  }
  return value;
}

export const MONGO_URL = required("MONGO_URL", "mongodb://localhost:27017/ticket-booking");
export const JWT_SECRET = required("JWT_SECRET", "dev-only-secret-change-me");
export const REDIS_URL = required("REDIS_URL");
export const PORT = Number(process.env.PORT ?? 3002);
export const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:5173";
export const MAX_CONCURRENT_PER_SHOWTIME = Number(process.env.MAX_CONCURRENT_PER_SHOWTIME ?? 3);

// How long a held seat stays reserved before it's automatically released
// back to "available" if the booking isn't confirmed in time.
export const HOLD_TTL_SECONDS = 10 * 60; // 10 minutes

// How long an "active session" slot (for the waiting-room system) lasts
// before it's assumed abandoned and freed up for the next person in queue.
export const SESSION_TTL_SECONDS = 15 * 60; // 15 minutes
