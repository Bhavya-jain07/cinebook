import { ReactNode } from "react";
import { Link } from "react-router-dom";

/** Shared layout for sign in / sign up: poster-style panel on desktop, form on the right. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="folds relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <Link to="/" className="display text-3xl text-paper">
          CineBook
        </Link>
        <div>
          <p className="display text-[96px] text-marquee">
            Pick your seat.
            <br />
            Watch it fill up.
          </p>
          <p className="mt-6 max-w-sm text-dust">
            Seats update live for everyone looking at the same showtime, and nobody can take the one you're holding.
          </p>
        </div>
        <p className="text-xs text-dust/70">Demo project. Payment is simulated.</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="display mb-8 block text-3xl text-paper lg:hidden">
            CineBook
          </Link>
          <h1 className="display text-5xl">{title}</h1>
          <p className="mb-8 mt-3 text-dust">{subtitle}</p>
          {children}
          <p className="mt-8 text-sm text-dust">{footer}</p>
        </div>
      </main>
    </div>
  );
}

export function Field({
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  minLength,
  hint,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  minLength?: number;
  hint?: string;
}) {
  const id = `field-${label.toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        minLength={minLength}
        required
        className="w-full rounded-xl border border-paper/15 bg-pit px-4 py-3 text-paper outline-none transition placeholder:text-dust/50 focus:border-marquee focus-visible:outline-none"
      />
      {hint && <p className="mt-1.5 text-xs text-dust">{hint}</p>}
    </div>
  );
}
