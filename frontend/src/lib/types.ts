export interface Movie {
  _id: string;
  title: string;
  poster?: string;
  genre?: string;
  language?: string;
  durationMins?: number;
  description?: string;
}

export interface Theater {
  _id: string;
  name: string;
  city: string;
}

export interface Showtime {
  _id: string;
  movieId: string | Movie;
  theaterId: string | Theater;
  screenName: string;
  dateTime: string;
  rows: number;
  seatsPerRow: number;
  premiumRowIndexes: number[];
  regularPrice: number;
  premiumPrice: number;
  bookedSeats: string[];
}

export type SeatStatus = "available" | "held" | "booked" | "selected";

export interface Seat {
  id: string;
  isPremium: boolean;
  status: SeatStatus;
  price: number;
}

export interface Booking {
  _id: string;
  userId: string;
  showtimeId: Showtime;
  seats: string[];
  totalAmount: number;
  status: "confirmed" | "cancelled";
  createdAt: string;
}

export type SeatEvent =
  | { type: "seat_held"; seat: string }
  | { type: "seat_released"; seat: string }
  | { type: "seat_booked"; seats: string[] };
