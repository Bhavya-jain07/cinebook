# CineBook — Movie Ticket Booking System

A movie ticket booking app built around solving the concurrency and
scalability problems real booking systems face — not just CRUD. This is
the classic "design BookMyShow/Ticketmaster" system-design interview
question, actually built end to end.

- **Backend**: Node.js, Express, TypeScript, MongoDB, Redis (Upstash),
  Socket.io
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, socket.io-client

## The HLD concepts this demonstrates

### 1. Distributed seat locking (the core race condition)
Two people click the same seat at the same moment — only one should get
it. This is solved with Redis's atomic `SET ... NX EX` — the first
request to reach Redis wins the lock, the second gets a clean rejection,
with no possibility of both succeeding no matter how close in time they
are. See `backend/src/redis.ts` → `tryHoldSeat`.

### 2. TTL-based auto-release
A held seat isn't booked yet — it's reserved for 10 minutes while the
user "pays". If they abandon the flow, Redis expires the lock on its own
and the seat becomes available again automatically, with no cleanup job
needed.

### 3. Idempotent booking confirmation
If a network retry or a double-click sends the same "confirm booking"
request twice, the second one returns the *existing* booking instead of
creating a duplicate — enforced by a unique `idempotencyKey` at the
database level, with the check-then-insert race handled too (see the
`E11000` duplicate-key fallback in `POST /bookings/confirm`).

### 4. Real-time seat map via Pub/Sub
When someone holds or books a seat, every other browser currently looking
at that showtime sees it update live — no polling. A Redis `PUBLISH` on
one server instance is delivered to a `SUBSCRIBE`r on *any* instance,
which is what makes this correct even if the app is later scaled to
multiple backend processes (unlike, say, an in-memory `EventEmitter`,
which would only work within a single process).

### 5. Virtual waiting room
When too many people try to pick seats for one showtime at once, new
arrivals are placed in a FIFO queue (a Redis sorted set, scored by join
time) instead of hitting the seat-selection page directly — the same
pattern real ticketing sites use during high-demand on-sales. The cap is
intentionally low in the seed data (`maxConcurrentOverride: 2` on one
showtime) so it's trivial to demo with a couple of browser tabs.

## Project structure

```
ticket-booking/
  backend/
    src/          Express API, Mongo models, Redis helpers, Socket.io bridge
    scripts/seed.ts   Demo movies, theaters, showtimes
  frontend/        React + Vite app
```

## Setting up

### 1. MongoDB Atlas (free)
Same as any Mongo setup — free cluster, database user, allow
`0.0.0.0/0`, copy the connection string (give it a database name in the
URL, e.g. `.../ticket-booking?retryWrites=true...`).

### 2. Upstash Redis (free)
1. Go to [console.upstash.com](https://console.upstash.com), create a
   free Redis database.
2. **Important**: copy the connection string labeled for **ioredis / TCP**
   (starts with `rediss://`), not the REST URL+token pair. Pub/Sub (used
   for live seat updates) needs a persistent connection, which only the
   TCP endpoint provides.

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `MONGO_URL`, `JWT_SECRET` (any long random string), and
`REDIS_URL` from the steps above.

Seed demo data (movies, theaters, showtimes):

```bash
npm run seed
```

Then run it:

```bash
npm run dev
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens on `http://localhost:5173`. Copy `.env.example` to `.env` if your
backend isn't on `localhost:3002`.

### 5. Try it out

1. Sign up, browse to a movie, pick a showtime.
2. **Demo the waiting room**: the first showtime seeded is capped at 2
   concurrent sessions — open it in 3 different browser tabs (or one
   normal + two incognito windows so they're separate sessions) and the
   3rd one lands in the queue.
3. **Demo the race condition**: open the same showtime's seat map in two
   tabs, click the same seat in both at nearly the same time — one
   succeeds, the other gets "already taken" instantly, and both tabs'
   seat maps update live.

## Being upfront about scope

- **Payment is mocked** — "Confirm & Pay" just confirms the booking, no
  real payment gateway. The idempotency handling around it is real,
  though, and is exactly what you'd need before wiring up a real one.
- **Single Node process**: this runs as one backend instance, so the
  Pub/Sub layer isn't strictly *necessary* today — but it's what makes
  the design correct if it were scaled to multiple instances behind a
  load balancer, which is the realistic next step and the reason it's
  built this way from the start rather than using an in-memory event bus.
- **Seat map is a simple grid** (rows × columns, two price tiers) rather
  than modeling irregular real cinema layouts — the locking/queueing
  logic doesn't care about seat-map shape, so this was kept simple
  intentionally.

## Deploying (GitHub → Render + Vercel)

1. Push to GitHub.
2. **Backend on Render**: New Web Service → Root Directory `backend` →
   Build `npm install && npm run build` → Start `npm start`. Add env vars:
   `MONGO_URL`, `JWT_SECRET`, `REDIS_URL`, `CLIENT_URL` (set after step 4).
   Render's web services support WebSockets natively, so Socket.io works
   without extra config.
3. **Run `npm run seed` once** against your production databases (via a
   Render shell session, or locally pointed at the same `.env` values).
4. **Frontend on Vercel**: Root Directory `frontend` → env vars
   `VITE_API_URL` = Render URL + `/api/v1`, `VITE_SOCKET_URL` = Render URL
   (no `/api/v1` suffix — Socket.io connects to the bare server).
5. Back on Render, set `CLIENT_URL` to your Vercel URL for CORS.

Free Render services spin down after inactivity — the first request after
a while takes longer to wake up.
