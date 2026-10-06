import { Link, useNavigate } from "react-router-dom";

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden="true">
        <path
          d="M2 0h22a2 2 0 0 1 2 2v3.2a2.8 2.8 0 0 0 0 5.6V18a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-7.2a2.8 2.8 0 0 0 0-5.6V2a2 2 0 0 1 2-2Z"
          fill="#ffb830"
        />
        <path d="M9 3v14" stroke="#34101f" strokeWidth="1.6" strokeDasharray="2 2.4" />
      </svg>
      <span className="display text-[28px] text-paper">CineBook</span>
    </span>
  );
}

export function Navbar() {
  const navigate = useNavigate();
  const username = localStorage.getItem("username");

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    navigate("/signin");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-paper/10 bg-pit/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link to="/" aria-label="CineBook home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-3 whitespace-nowrap text-sm sm:gap-5">
          {username ? (
            <>
              <Link to="/my-bookings" className="text-dust transition hover:text-paper">
                My bookings
              </Link>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full bg-velvet text-sm font-bold text-marquee"
                title={username}
                aria-label={`Signed in as ${username}`}
              >
                {username.charAt(0).toUpperCase()}
              </span>
              <button onClick={logout} className="text-dust transition hover:text-coral">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/signin" className="text-dust transition hover:text-paper">
                Sign in
              </Link>
              <Link to="/signup" className="rounded-full bg-marquee px-4 py-1.5 font-bold text-pit transition hover:brightness-110">
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
