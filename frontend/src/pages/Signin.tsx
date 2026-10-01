import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, friendlyError } from "../lib/api";
import { useToast } from "../components/Toast";

export function Signin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/signin", { username, password });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("username", res.data.username);
      navigate("/");
    } catch (err: any) {
      showToast(friendlyError(err), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-cinema-surface border border-cinema-border rounded-xl p-8">
        <h1 className="font-display text-3xl text-cinema-red mb-1">CINEBOOK</h1>
        <p className="text-sm text-cinema-muted mb-6">Sign in to book your tickets.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-cinema-muted">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full bg-cinema-surfaceLight border border-cinema-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-cinema-red"
              required
            />
          </div>
          <div>
            <label className="text-sm text-cinema-muted">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full bg-cinema-surfaceLight border border-cinema-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-cinema-red"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cinema-red text-white font-semibold text-sm py-2.5 rounded-lg hover:bg-cinema-redDark disabled:opacity-50 transition"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-sm text-cinema-muted mt-6 text-center">
          Don't have an account?{" "}
          <Link to="/signup" className="text-cinema-red font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
