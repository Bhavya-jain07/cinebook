import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Movie } from "../lib/types";
import { formatDuration } from "../lib/format";
import { Navbar } from "../components/Navbar";
import { Poster } from "../components/Poster";

export function Home() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [slow, setSlow] = useState(false);
  const [genre, setGenre] = useState("All");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(false);
    // Free-tier hosting can take a while to wake up; tell people instead of showing a blank page.
    const slowTimer = setTimeout(() => setSlow(true), 4000);
    api
      .get("/movies")
      .then((res) => setMovies(res.data.movies))
      .catch(() => setError(true))
      .finally(() => {
        clearTimeout(slowTimer);
        setSlow(false);
        setLoading(false);
      });
    return () => clearTimeout(slowTimer);
  }, [attempt]);

  const genres = useMemo(() => ["All", ...Array.from(new Set(movies.map((m) => m.genre).filter(Boolean) as string[]))], [movies]);
  const visible = genre === "All" ? movies : movies.filter((m) => m.genre === genre);
  const featured = movies[0];

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Featured movie */}
      <section className="folds">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 md:grid-cols-[1.3fr_1fr] md:py-16">
          {featured ? (
            <>
              <div className="animate-rise">
                <h1 className="display text-6xl sm:text-8xl">{featured.title}</h1>
                <div className="mt-5 flex flex-wrap gap-2 text-sm">
                  {[featured.genre, featured.language, formatDuration(featured.durationMins)].filter(Boolean).map((t) => (
                    <span key={t} className="rounded-full border border-paper/25 px-3 py-1 text-paper/90">
                      {t}
                    </span>
                  ))}
                </div>
                <p className="mt-5 max-w-lg leading-relaxed text-dust">{featured.description}</p>
                <Link
                  to={`/movies/${featured._id}`}
                  className="mt-8 inline-block rounded-full bg-marquee px-7 py-3 font-bold text-pit transition hover:brightness-110"
                >
                  Book tickets
                </Link>
              </div>
              <Link to={`/movies/${featured._id}`} className="mx-auto w-56 sm:w-64 md:w-full md:max-w-xs md:justify-self-end" aria-label={`Book ${featured.title}`}>
                <Poster
                  src={featured.poster}
                  title={featured.title}
                  className="aspect-[2/3] w-full rotate-2 rounded-2xl shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)] ring-1 ring-paper/20"
                />
              </Link>
            </>
          ) : (
            <div className="md:col-span-2">
              <h1 className="display text-6xl sm:text-8xl">Now showing</h1>
              <p className="mt-4 text-dust">{error ? "" : "Finding what's on tonight…"}</p>
            </div>
          )}
        </div>
      </section>

      {/* All movies */}
      <main className="mx-auto max-w-6xl px-5 py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 className="display text-4xl">Now showing</h2>
          {genres.length > 2 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by genre">
              {genres.map((g) => (
                <button
                  key={g}
                  onClick={() => setGenre(g)}
                  aria-pressed={genre === g}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                    genre === g ? "bg-paper text-pit" : "border border-paper/20 text-dust hover:text-paper"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>

        {error ? (
          <div className="rounded-2xl border border-coral/40 bg-pit p-8 text-center">
            <p className="font-semibold">We couldn't load the movies.</p>
            <p className="mt-1 text-sm text-dust">The server may be offline or still starting up.</p>
            <button onClick={() => setAttempt((a) => a + 1)} className="mt-5 rounded-full bg-marquee px-6 py-2 text-sm font-bold text-pit">
              Try again
            </button>
          </div>
        ) : loading ? (
          <>
            {slow && <p className="mb-5 text-sm text-glow">Waking up the server. The first load can take up to a minute.</p>}
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i}>
                  <div className="aspect-[2/3] animate-pulse rounded-xl bg-pit" />
                  <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-pit" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 md:grid-cols-4">
            {visible.map((movie) => (
              <Link key={movie._id} to={`/movies/${movie._id}`} className="group block">
                <div className="overflow-hidden rounded-xl bg-pit ring-1 ring-paper/10 transition group-hover:ring-marquee">
                  <Poster
                    src={movie.poster}
                    title={movie.title}
                    className="aspect-[2/3] w-full transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                </div>
                <h3 className="mt-3 font-bold leading-snug">{movie.title}</h3>
                <p className="mt-0.5 text-sm text-dust">{[movie.genre, formatDuration(movie.durationMins)].filter(Boolean).join(", ")}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
