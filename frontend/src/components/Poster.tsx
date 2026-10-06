import { useState } from "react";

/** Poster image with a graceful fallback when the URL is missing or fails to load. */
export function Poster({ src, title, className = "" }: { src?: string; title: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-end bg-gradient-to-br from-velvet to-pit p-3 ${className}`}
        role="img"
        aria-label={`${title} poster`}
      >
        <span className="display text-2xl text-paper/80">{title}</span>
      </div>
    );
  }

  return <img src={src} alt={`${title} poster`} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
}
