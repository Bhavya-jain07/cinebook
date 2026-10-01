import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Movie, Showtime, Theater } from "../lib/types";
import { Navbar } from "../components/Navbar";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MovieDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.get("/movies"), api.get(`/movies/${id}/showtimes`)]).then(([moviesRes, showtimesRes]) => {
      const found = moviesRes.data.movies.find((m: Movie) => m._id === id);
      setMovie(found ?? null);
      setShowtimes(showtimesRes.data.showtimes);
      setLoading(false);
    });
  }, [id]);

  const groupedByTheater = useMemo(() => {
    const groups = new Map<string, { theater: Theater; shows: Showtime[] }>();
    for (const st of showtimes) {
      const theater = st.theaterId as Theater;
      const key = theater._id;
      if (!groups.has(key)) groups.set(key, { theater, shows: [] });
      groups.get(key)!.shows.push(st);
    }
    return Array.from(groups.values());
  }, [showtimes]);

  function selectShowtime(showtimeId: string) {
    if (!localStorage.getItem("token")) {
      navigate("/signin");
      return;
    }
    navigate(`/showtimes/${showtimeId}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-5xl mx-auto px-5 py-10 text-cinema-muted text-sm">Loading…</div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-5xl mx-auto px-5 py-10 text-cinema-muted text-sm">Movie not found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-5xl mx-auto px-5 py-10">
        <div className="flex flex-col sm:flex-row gap-6 mb-10">
          <img
            src={movie.poster}
            alt={movie.title}
            className="w-40 sm:w-52 rounded-lg border border-cinema-border shrink-0 self-start"
          />
          <div>
            <h1 className="font-display text-3xl sm:text-4xl tracking-wide mb-2">{movie.title}</h1>
            <p className="text-sm text-cinema-muted mb-3">
              {movie.genre} · {movie.language} · {movie.durationMins} min
            </p>
            <p className="text-sm text-cinema-text/80 leading-relaxed max-w-xl">{movie.description}</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-4">Showtimes</h2>
        <div className="space-y-6">
          {groupedByTheater.map(({ theater, shows }) => (
            <div key={theater._id} className="border border-cinema-border rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-1">{theater.name}</h3>
              <p className="text-xs text-cinema-muted mb-3">{theater.city}</p>
              <div className="flex flex-wrap gap-2">
                {shows.map((st) => (
                  <button
                    key={st._id}
                    onClick={() => selectShowtime(st._id)}
                    className="text-sm border border-cinema-border rounded-lg px-3.5 py-2 hover:border-cinema-red hover:text-cinema-red transition"
                  >
                    {formatTime(st.dateTime)}
                    <span className="block text-[11px] text-cinema-muted">{st.screenName}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
