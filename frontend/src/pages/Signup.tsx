import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, friendlyError } from "../lib/api";
import { useToast } from "../components/Toast";
import { AuthShell, Field } from "../components/AuthShell";

export function Signup() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const from = (location.state as { from?: string } | null)?.from;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/signup", { username, password });
      showToast("Account created. Sign in to continue.");
      navigate("/signin", { state: { from } });
    } catch (err: any) {
      showToast(friendlyError(err), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="It takes a few seconds."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/signin" state={{ from }} className="font-bold text-marquee hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="Username" value={username} onChange={setUsername} autoComplete="username" minLength={3} hint="At least 3 characters." />
        <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" minLength={6} hint="At least 6 characters." />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-marquee py-3 font-bold text-pit transition hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
