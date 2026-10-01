import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, friendlyError } from "../lib/api";
import { useToast } from "../components/Toast";

export function Signup() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/signup", { username, password });
      showToast("Account created — sign in to continue");
      navigate("/signin");
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
        <p className="text-sm text-cinema-muted mb-6">Create an account to book tickets.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-cinema-muted">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full bg-cinema-surfaceLight border border-cinema-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-cinema-red"
              minLength={3}
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
              minLength={6}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cinema-red text-white font-semibold text-sm py-2.5 rounded-lg hover:bg-cinema-redDark disabled:opacity-50 transition"
          >
            {loading ? "Creating…" : "Sign up"}
          </button>
        </form>

        <p className="text-sm text-cinema-muted mt-6 text-center">
          Already have an account?{" "}
          <Link to="/signin" className="text-cinema-red font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
