import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, friendlyError } from "../lib/api";
import { useToast } from "../components/Toast";
import { AuthShell, Field } from "../components/AuthShell";

export function Signin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  // If the user was sent here from a protected page, return them there after signing in.
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/signin", { username, password });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("username", res.data.username);
      navigate(from, { replace: true });
    } catch (err: any) {
      showToast(friendlyError(err), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick your seats."
      footer={
        <>
          New to CineBook?{" "}
          <Link to="/signup" state={{ from }} className="font-bold text-marquee hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="Username" value={username} onChange={setUsername} autoComplete="username" />
        <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-marquee py-3 font-bold text-pit transition hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
