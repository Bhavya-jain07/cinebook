import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Movie, Showtime, Theater } from "../lib/types";
import { dayKey, dayLabel, formatDuration, formatTime } from "../lib/format";
import { Navbar } from "../components/Navbar";
import { Poster } from "../components/Poster";

export function MovieDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeDay, setActiveDay] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.get("/movies"), api.get(`/movies/${id}/showtimes`)])
      .then(([moviesRes, showtimesRes]) => {
        const found = moviesRes.data.movies.find((m: Movie) => m._id === id);
        setMovie(found ?? null);
        setShowtimes(showtimesRes.data.showtimes);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const days = useMemo(() => {
    const sorted = [...showtimes].sort((a, b) => +new Date(a.dateTime) - +new Date(b.dateTime));
    const seen = new Map<string, string>();
    for (const st of sorted) if (!seen.has(dayKey(st.dateTime))) seen.set(dayKey(st.dateTime), st.dateTime);
    return Array.from(seen.entries()).map(([key, iso]) => ({ key, label: dayLabel(iso) }));
  }, [showtimes]);

  const currentDay = activeDay ?? days[0]?.key ?? null;

  const groupedByTheater = useMemo(() => {
    const groups = new Map<string, { theater: Theater; shows: Showtime[] }>();
    for (const st of showtimes) {
      if (currentDay && dayKey(st.dateTime) !== currentDay) continue;
      const theater = st.theaterId as Theater;
      if (!groups.has(theater._id)) groups.set(theater._id, { theater, shows: [] });
      groups.get(theater._id)!.shows.push(st);
    }
    for (const g of groups.values()) g.shows.sort((a, b) => +new Date(a.dateTime) - +new Date(b.dateTime));
    return Array.from(groups.values());
  }, [showtimes, currentDay]);

  function selectShowtime(showtimeId: string) {
    const target = `/showtimes/${showtimeId}`;
    if (!localStorage.getItem("token")) {
      navigate("/signin", { state: { from: target } });
      return;
    }
    navigate(target);
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="flex flex-col gap-8 sm:flex-row">
            <div className="aspect-[2/3] w-48 animate-pulse rounded-2xl bg-pit sm:w-60" />
            <div className="flex-1 space-y-4">
              <div className="h-14 w-2/3 animate-pulse rounded bg-pit" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-pit" />
              <div className="h-20 w-full max-w-xl animate-pulse rounded bg-pit" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="mx-auto max-w-md px-5 py-24 text-center">
          <h1 className="display text-5xl">{error ? "Couldn't load this movie" : "Movie not found"}</h1>
          <p className="mt-3 text-dust">{error ? "Check your connection and try again." : "It may have finished its run."}</p>
          <button onClick={() => navigate("/")} className="mt-6 rounded-full bg-marquee px-6 py-2.5 font-bold text-pit">
            Back to all movies
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <header className="relative overflow-hidden">
        {movie.poster && (
          <img src={movie.poster} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-2xl" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-curtain/40 via-curtain/70 to-curtain" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 sm:flex-row sm:py-16">
          <Poster
            src={movie.poster}
            title={movie.title}
            className="aspect-[2/3] w-44 shrink-0 self-start rounded-2xl shadow-2xl ring-1 ring-paper/20 sm:w-60"
          />
          <div className="max-w-2xl animate-rise">
            <h1 className="display text-6xl sm:text-7xl">{movie.title}</h1>
            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              {[movie.genre, movie.language, formatDuration(movie.durationMins)].filter(Boolean).map((t) => (
                <span key={t} className="rounded-full border border-paper/25 px-3 py-1">
                  {t}
                </span>
              ))}
            </div>
            <p className="mt-5 leading-relaxed text-paper/80">{movie.description}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20">
        <h2 className="display mb-5 text-4xl">Showtimes</h2>

        {days.length === 0 ? (
          <p className="rounded-2xl border border-paper/10 bg-pit p-6 text-dust">No showtimes are scheduled for this movie yet.</p>
        ) : (
          <>
            <div role="tablist" aria-label="Choose a day" className="mb-6 flex gap-2 overflow-x-auto pb-1">
              {days.map((d) => (
                <button
                  key={d.key}
                  role="tab"
                  aria-selected={currentDay === d.key}
                  onClick={() => setActiveDay(d.key)}
                  className={`shrink-0 rounded-full px-5 py-2 text-sm font-bold transition ${
                    currentDay === d.key ? "bg-marquee text-pit" : "border border-paper/20 text-dust hover:text-paper"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <div className="space-y-5">
              {groupedByTheater.map(({ theater, shows }) => {
                const fromPrice = Math.min(...shows.map((s) => s.regularPrice));
                return (
                  <section key={theater._id} className="rounded-2xl bg-pit/70 p-5 ring-1 ring-paper/10">
                    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-bold">{theater.name}</h3>
                        <p className="text-sm text-dust">{theater.city}</p>
                      </div>
                      <p className="text-sm text-dust">From ₹{fromPrice}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {shows.map((st) => (
                        <button
                          key={st._id}
                          onClick={() => selectShowtime(st._id)}
                          className="min-w-[104px] rounded-xl border border-glow/40 px-4 py-2.5 text-left transition hover:border-marquee hover:bg-velvet"
                        >
                          <span className="block font-bold">{formatTime(st.dateTime)}</span>
                          <span className="block text-xs text-dust">{st.screenName}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
