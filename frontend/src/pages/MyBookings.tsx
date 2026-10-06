import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Booking, Movie, Theater } from "../lib/types";
import { formatDateLong, formatTime } from "../lib/format";
import { Navbar } from "../components/Navbar";
import { Poster } from "../components/Poster";

function TicketCard({ b, past }: { b: Booking; past: boolean }) {
  const movie = b.showtimeId?.movieId as Movie | undefined;
  const theater = b.showtimeId?.theaterId as Theater | undefined;
  const cancelled = b.status === "cancelled";

  return (
    <article className={`ticket overflow-visible flex ${past || cancelled ? "opacity-70" : ""}`}>
      <div className="flex min-w-0 flex-1 gap-4 p-4">
        <Poster src={movie?.poster} title={movie?.title ?? "Movie"} className="hidden h-24 w-16 shrink-0 rounded-md sm:block" />
        <div className="min-w-0">
          <h3 className="display truncate text-3xl">{movie?.title ?? "Movie"}</h3>
          <p className="mt-1 text-sm">{theater?.name}</p>
          {b.showtimeId && (
            <p className="text-sm opacity-70">
              {formatDateLong(b.showtimeId.dateTime)} at {formatTime(b.showtimeId.dateTime)}, {b.showtimeId.screenName}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {b.seats.map((s) => (
              <span key={s} className="rounded bg-[#2a0c19] px-1.5 py-0.5 text-xs font-bold text-paper">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="perf-v flex w-[7.5rem] shrink-0 flex-col items-center justify-center gap-1 p-3 text-center">
        <p className="text-xl font-extrabold">₹{b.totalAmount}</p>
        <p className="text-xs font-bold opacity-70">{cancelled ? "Cancelled" : past ? "Watched" : "Confirmed"}</p>
      </div>
    </article>
  );
}

export function MyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get("/bookings/mine")
      .then((res) => setBookings(res.data.bookings))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const isPast = (b: Booking) => !!b.showtimeId && new Date(b.showtimeId.dateTime).getTime() < now;
    return { upcoming: bookings.filter((b) => !isPast(b)), past: bookings.filter(isPast) };
  }, [bookings]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="display mb-8 text-6xl">My bookings</h1>

        {loading ? (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-pit" />
            ))}
          </div>
        ) : error ? (
          <p className="rounded-2xl border border-coral/40 bg-pit p-6 text-dust">We couldn't load your bookings. Refresh the page to try again.</p>
        ) : bookings.length === 0 ? (
          <div className="rounded-2xl bg-pit/70 p-10 text-center ring-1 ring-paper/10">
            <p className="display text-4xl">No tickets yet</p>
            <p className="mt-2 text-dust">Pick a movie and your tickets will show up here.</p>
            <Link to="/" className="mt-6 inline-block rounded-full bg-marquee px-6 py-2.5 font-bold text-pit">
              Browse movies
            </Link>
          </div>
        ) : (
          <div className="space-y-10">
            {upcoming.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-bold">Upcoming</h2>
                <div className="space-y-4">
                  {upcoming.map((b) => (
                    <TicketCard key={b._id} b={b} past={false} />
                  ))}
                </div>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-bold text-dust">Past</h2>
                <div className="space-y-4">
                  {past.map((b) => (
                    <TicketCard key={b._id} b={b} past />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
