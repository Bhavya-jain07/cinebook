import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Movie } from "../lib/types";
import { Navbar } from "../components/Navbar";

export function Home() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/movies")
      .then((res) => setMovies(res.data.movies))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-5xl mx-auto px-5 py-10">
        <h1 className="font-display text-4xl tracking-wide mb-1">NOW SHOWING</h1>
        <p className="text-cinema-muted text-sm mb-8">Pick a movie to see showtimes near you.</p>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-cinema-surface rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {movies.map((movie) => (
              <Link
                key={movie._id}
                to={`/movies/${movie._id}`}
                className="group block rounded-lg overflow-hidden border border-cinema-border hover:border-cinema-red transition"
              >
                <div className="aspect-[2/3] bg-cinema-surfaceLight overflow-hidden">
                  {movie.poster && (
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                </div>
                <div className="p-3 bg-cinema-surface">
                  <h3 className="text-sm font-semibold truncate">{movie.title}</h3>
                  <p className="text-xs text-cinema-muted mt-0.5">
                    {movie.genre} {movie.language ? `· ${movie.language}` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
