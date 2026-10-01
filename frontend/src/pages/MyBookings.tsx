import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Booking, Movie, Theater } from "../lib/types";
import { Navbar } from "../components/Navbar";

export function MyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/bookings/mine")
      .then((res) => setBookings(res.data.bookings))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="font-display text-3xl tracking-wide mb-6">MY BOOKINGS</h1>

        {loading ? (
          <p className="text-sm text-cinema-muted">Loading…</p>
        ) : bookings.length === 0 ? (
          <p className="text-sm text-cinema-muted">No bookings yet — go find something to watch!</p>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => {
              const movie = b.showtimeId?.movieId as Movie | undefined;
              const theater = b.showtimeId?.theaterId as Theater | undefined;
              return (
                <div key={b._id} className="border border-cinema-border rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">{movie?.title ?? "Movie"}</h3>
                    <p className="text-xs text-cinema-muted mt-0.5">
                      {theater?.name} · {b.showtimeId && new Date(b.showtimeId.dateTime).toLocaleString()}
                    </p>
                    <p className="text-xs text-cinema-muted mt-0.5">Seats: {b.seats.join(", ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">₹{b.totalAmount}</p>
                    <span
                      className={`text-[10px] uppercase font-semibold ${
                        b.status === "confirmed" ? "text-cinema-red" : "text-cinema-muted"
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
