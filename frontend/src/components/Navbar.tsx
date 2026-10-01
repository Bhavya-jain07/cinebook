import { Link, useNavigate } from "react-router-dom";

export function Navbar() {
  const navigate = useNavigate();
  const username = localStorage.getItem("username");

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    navigate("/signin");
  }

  return (
    <header className="border-b border-cinema-border bg-cinema-surface/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
        <Link to="/" className="font-display text-2xl tracking-wide text-cinema-red">
          CINE<span className="text-cinema-text">BOOK</span>
        </Link>
        <div className="flex items-center gap-5 text-sm">
          {username ? (
            <>
              <Link to="/my-bookings" className="text-cinema-muted hover:text-cinema-text transition">
                My Bookings
              </Link>
              <span className="text-cinema-muted hidden sm:inline">hi, {username}</span>
              <button onClick={logout} className="text-cinema-muted hover:text-cinema-red transition">
                Logout
              </button>
            </>
          ) : (
            <Link to="/signin" className="text-cinema-text font-medium hover:text-cinema-red transition">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
