import express from "express";
import cors from "cors";
import http from "http";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import mongoose from "mongoose";
import { UserModel, MovieModel, TheaterModel, ShowtimeModel, BookingModel } from "./db";
import { JWT_SECRET, PORT, CLIENT_URL } from "./config";
import { userMiddleware } from "./middleware";
import { setupSocket } from "./socket";
import {
  tryHoldSeat,
  releaseSeatHold,
  getSeatHoldOwner,
  getHeldSeats,
  publishSeatEvent,
  requestSession,
  endSession,
  getQueueLength,
} from "./redis";

const app = express();
const httpServer = http.createServer(app);
setupSocket(httpServer);

app.set("trust proxy", 1);
app.use(express.json());
app.use(cors({ origin: CLIENT_URL }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in a few minutes." },
});

// Booking-related actions are cheap on the server but need tighter limits
// than a read — this stops someone from hammering the hold/release
// endpoints to grief other users' seat selection.
const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests — please slow down." },
});

// ---------- Seat map helper ----------

function generateSeatIds(rows: number, seatsPerRow: number): string[] {
  const ids: string[] = [];
  for (let r = 0; r < rows; r++) {
    const rowLetter = String.fromCharCode(65 + r); // A, B, C...
    for (let n = 1; n <= seatsPerRow; n++) ids.push(`${rowLetter}${n}`);
  }
  return ids;
}

// ---------- Auth ----------

const credentialsSchema = z.object({
  username: z.string().min(3).max(30),
  password: z.string().min(6),
});

app.post("/api/v1/signup", authLimiter, async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0].message });
    return;
  }
  try {
    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    await UserModel.create({ username: parsed.data.username, password: hashedPassword });
    res.status(201).json({ message: "Account created" });
  } catch (e: any) {
    if (e?.code === 11000) {
      res.status(409).json({ message: "Username already taken" });
      return;
    }
    console.error("Signup error:", e);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

app.post("/api/v1/signin", authLimiter, async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0].message });
    return;
  }
  const user = await UserModel.findOne({ username: parsed.data.username });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.password))) {
    res.status(403).json({ message: "Incorrect username or password" });
    return;
  }
  const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, username: user.username });
});

// ---------- Movies & showtimes (public) ----------

app.get("/api/v1/movies", async (_req, res) => {
  const movies = await MovieModel.find();
  res.json({ movies });
});

app.get("/api/v1/movies/:id/showtimes", async (req, res) => {
  const showtimes = await ShowtimeModel.find({ movieId: String(req.params.id) }).populate("theaterId");
  res.json({ showtimes });
});

app.get("/api/v1/showtimes/:id", async (req, res) => {
  const showtime = await ShowtimeModel.findById(String(req.params.id)).populate("movieId").populate("theaterId");
  if (!showtime) {
    res.status(404).json({ message: "Showtime not found" });
    return;
  }

  const allSeatIds = generateSeatIds(showtime.rows, showtime.seatsPerRow);
  const availableToCheck = allSeatIds.filter((s) => !showtime.bookedSeats.includes(s));
  const heldSeats = await getHeldSeats(String(showtime._id), availableToCheck);

  const seats = allSeatIds.map((id) => {
    const rowIndex = id.charCodeAt(0) - 65;
    const isPremium = showtime.premiumRowIndexes.includes(rowIndex);
    let status: "available" | "held" | "booked" = "available";
    if (showtime.bookedSeats.includes(id)) status = "booked";
    else if (heldSeats.includes(id)) status = "held";
    return { id, isPremium, status, price: isPremium ? showtime.premiumPrice : showtime.regularPrice };
  });

  res.json({ showtime, seats });
});

// ---------- Virtual waiting room ----------

app.post("/api/v1/showtimes/:id/session", userMiddleware, async (req, res) => {
  const showtime = await ShowtimeModel.findById(String(req.params.id));
  if (!showtime) {
    res.status(404).json({ message: "Showtime not found" });
    return;
  }
  const result = await requestSession(String(req.params.id), req.userId!, showtime.maxConcurrentOverride ?? undefined);
  if (result.status === "queued") {
    const queueLength = await getQueueLength(String(req.params.id));
    res.json({ status: "queued", position: result.position, queueLength });
    return;
  }
  res.json({ status: "active" });
});

app.delete("/api/v1/showtimes/:id/session", userMiddleware, async (req, res) => {
  await endSession(String(req.params.id), req.userId!);
  res.json({ message: "Session ended" });
});

// ---------- Seat holding ----------

const seatsSchema = z.object({
  seats: z.array(z.string()).min(1).max(10),
});

app.post("/api/v1/showtimes/:id/hold", userMiddleware, bookingLimiter, async (req, res) => {
  const parsed = seatsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0].message });
    return;
  }
  const showtimeId = String(req.params.id);
  const userId = req.userId!;
  const held: string[] = [];
  const failed: string[] = [];

  for (const seat of parsed.data.seats) {
    const success = await tryHoldSeat(showtimeId, seat, userId);
    if (success) {
      held.push(seat);
      await publishSeatEvent(showtimeId, { type: "seat_held", seat });
    } else {
      failed.push(seat);
    }
  }

  if (failed.length > 0) {
    // Roll back whatever we did manage to hold, so a partially-successful
    // request doesn't leave the user holding seats they didn't ask to keep.
    for (const seat of held) {
      await releaseSeatHold(showtimeId, seat, userId);
      await publishSeatEvent(showtimeId, { type: "seat_released", seat });
    }
    res.status(409).json({ message: `Already taken: ${failed.join(", ")}`, failed });
    return;
  }

  res.json({ message: "Seats held", seats: held, expiresInSeconds: 600 });
});

app.post("/api/v1/showtimes/:id/release", userMiddleware, bookingLimiter, async (req, res) => {
  const parsed = seatsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0].message });
    return;
  }
  const showtimeId = String(req.params.id);
  for (const seat of parsed.data.seats) {
    await releaseSeatHold(showtimeId, seat, req.userId!);
    await publishSeatEvent(showtimeId, { type: "seat_released", seat });
  }
  res.json({ message: "Released" });
});

// ---------- Booking confirmation ----------

const confirmSchema = z.object({
  showtimeId: z.string(),
  seats: z.array(z.string()).min(1).max(10),
  idempotencyKey: z.string().min(10),
});

app.post("/api/v1/bookings/confirm", userMiddleware, bookingLimiter, async (req, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0].message });
    return;
  }
  const { showtimeId, seats, idempotencyKey } = parsed.data;
  const userId = req.userId!;

  // Idempotency: if this exact request already went through (e.g. the
  // client retried after a network blip), return the original booking
  // instead of creating a second one.
  const existing = await BookingModel.findOne({ idempotencyKey });
  if (existing) {
    res.json({ message: "Booking confirmed", booking: existing });
    return;
  }

  const showtime = await ShowtimeModel.findById(showtimeId);
  if (!showtime) {
    res.status(404).json({ message: "Showtime not found" });
    return;
  }

  // Verify this user actually holds every seat they're trying to book —
  // without this check, anyone could "confirm" a seat they never locked.
  for (const seat of seats) {
    const owner = await getSeatHoldOwner(showtimeId, seat);
    if (owner !== userId) {
      res.status(409).json({ message: `Your hold on seat ${seat} has expired. Please reselect.` });
      return;
    }
  }

  const rowIndexOf = (seat: string) => seat.charCodeAt(0) - 65;
  const totalAmount = seats.reduce(
    (sum, seat) =>
      sum + (showtime.premiumRowIndexes.includes(rowIndexOf(seat)) ? showtime.premiumPrice : showtime.regularPrice),
    0
  );

  try {
    const booking = await BookingModel.create({
      userId,
      showtimeId,
      seats,
      totalAmount,
      status: "confirmed",
      idempotencyKey,
    });

    showtime.bookedSeats.push(...seats);
    await showtime.save();

    for (const seat of seats) {
      await releaseSeatHold(showtimeId, seat, userId);
    }
    await publishSeatEvent(showtimeId, { type: "seat_booked", seats });
    await endSession(showtimeId, userId);

    res.status(201).json({ message: "Booking confirmed", booking });
  } catch (e: any) {
    if (e?.code === 11000) {
      // Extremely rare race: two requests with the same idempotency key
      // both passed the findOne check above before either finished writing.
      const raceWinner = await BookingModel.findOne({ idempotencyKey });
      res.json({ message: "Booking confirmed", booking: raceWinner });
      return;
    }
    console.error("Booking error:", e);
    res.status(500).json({ message: "Something went wrong confirming your booking." });
  }
});

app.get("/api/v1/bookings/mine", userMiddleware, async (req, res) => {
  const bookings = await BookingModel.find({ userId: req.userId })
    .populate({ path: "showtimeId", populate: ["movieId", "theaterId"] })
    .sort({ createdAt: -1 });
  res.json({ bookings });
});

httpServer.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
