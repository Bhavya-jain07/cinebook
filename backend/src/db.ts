import mongoose, { Schema, model } from "mongoose";
import { MONGO_URL } from "./config";

mongoose
  .connect(MONGO_URL)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });

// ---------- User ----------
const UserSchema = new Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
});
export const UserModel = model("User", UserSchema);

// ---------- Movie ----------
const MovieSchema = new Schema({
  title: { type: String, required: true },
  poster: { type: String }, // image URL
  genre: { type: String },
  language: { type: String },
  durationMins: { type: Number },
  description: { type: String },
});
export const MovieModel = model("Movie", MovieSchema);

// ---------- Theater ----------
const TheaterSchema = new Schema({
  name: { type: String, required: true },
  city: { type: String, required: true },
});
export const TheaterModel = model("Theater", TheaterSchema);

// ---------- Showtime ----------
// The seat map is a simple grid: `rows` rows x `seatsPerRow` seats each,
// row letters A, B, C... Rows listed in `premiumRowIndexes` (0-based) cost
// the premium price. Individually booked seats are appended to
// `bookedSeats` only once a booking is *confirmed* — temporary holds
// live in Redis, not here, so this document only ever reflects permanent
// state.
const ShowtimeSchema = new Schema({
  movieId: { type: mongoose.Types.ObjectId, ref: "Movie", required: true, index: true },
  theaterId: { type: mongoose.Types.ObjectId, ref: "Theater", required: true },
  screenName: { type: String, required: true },
  dateTime: { type: Date, required: true },
  rows: { type: Number, required: true, default: 8 },
  seatsPerRow: { type: Number, required: true, default: 10 },
  premiumRowIndexes: { type: [Number], default: [5, 6, 7] }, // back rows are premium by default
  regularPrice: { type: Number, required: true, default: 180 },
  premiumPrice: { type: Number, required: true, default: 320 },
  bookedSeats: { type: [String], default: [] }, // e.g. ["A1", "A2", "C5"]
  // Demo/testing knob: overrides the global concurrent-session cap for
  // this specific showtime, so the waiting room can be demoed on one
  // "popular" show without throttling every showtime globally.
  maxConcurrentOverride: { type: Number },
});
export const ShowtimeModel = model("Showtime", ShowtimeSchema);

// ---------- Booking ----------
const BookingSchema = new Schema(
  {
    userId: { type: mongoose.Types.ObjectId, ref: "User", required: true, index: true },
    showtimeId: { type: mongoose.Types.ObjectId, ref: "Showtime", required: true, index: true },
    seats: { type: [String], required: true },
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ["confirmed", "cancelled"], default: "confirmed" },
    // Prevents a double-click or a client retry from creating two
    // bookings for the same intended purchase.
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);
export const BookingModel = model("Booking", BookingSchema);
