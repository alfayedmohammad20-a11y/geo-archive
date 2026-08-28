import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LockKey, SignIn } from "@phosphor-icons/react";

function fmt(detail) {
  if (!detail) return "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  return String(detail);
}

export default function AdminLogin() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(email, password);
      nav("/admin");
    } catch (e) {
      setErr(fmt(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] grid lg:grid-cols-2">
      <div className="hidden lg:block relative bg-[#0A0A0A]">
        <div className="absolute inset-0 topo-bg opacity-20" />
        <div className="relative h-full flex flex-col justify-between p-12 text-white">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-[#FF3B30]">
            // Restricted Zone
          </div>
          <div>
            <h2 className="font-display text-5xl leading-none mb-4">
              Curator access.
            </h2>
            <p className="text-white/60 max-w-md">
              Only admins can upload, edit, or remove maps from the public
              archive. Public users browse freely.
            </p>
          </div>
          <div className="font-mono text-xs text-white/40">
            GEO/ARCHIVE · SECURE ENDPOINT · /api/auth/login
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <form
          onSubmit={submit}
          data-testid="login-form"
          className="w-full max-w-md"
        >
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-[#002FA7] mb-3 flex items-center gap-2">
            <LockKey size={14} weight="bold" /> Admin Sign-in
          </div>
          <h1 className="font-display text-4xl mb-8">Enter credentials</h1>

          <label className="block font-mono text-xs uppercase tracking-widest text-[#52525B] mb-2">
            Email
          </label>
          <input
            data-testid="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@geoarchive.io"
            className="w-full bg-white border-2 border-black/10 px-4 py-3 mb-6 focus:border-[#002FA7] outline-none"
          />

          <label className="block font-mono text-xs uppercase tracking-widest text-[#52525B] mb-2">
            Password
          </label>
          <input
            data-testid="login-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white border-2 border-black/10 px-4 py-3 mb-6 focus:border-[#002FA7] outline-none"
          />

          {err && (
            <div
              data-testid="login-error"
              className="mb-4 border border-[#FF3B30] bg-[#FF3B30]/5 text-[#FF3B30] px-4 py-3 text-sm font-mono"
            >
              {err}
            </div>
          )}

          <button
            data-testid="login-submit"
            type="submit"
            disabled={busy}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <SignIn size={18} weight="bold" />
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
