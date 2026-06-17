"use client";

import { useState } from "react";
import { api } from "@/lib/client";

export default function AuthGate({
  onAuth,
}: {
  onAuth: (user: { id: string; email: string }) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === "register"
          ? await api.register(email, password)
          : await api.login(email, password);
      onAuth(res.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="panel auth-card">
        <div className="logo-big flicker">STEALTH</div>
        <div className="tagline">Autonomous Application Agent</div>

        <div className="tabs" style={{ marginBottom: "1.25rem" }}>
          <button
            className={`tab ${mode === "register" ? "active" : ""}`}
            onClick={() => setMode("register")}
            type="button"
          >
            Create Account
          </button>
          <button
            className={`tab ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
            type="button"
          >
            Sign In
          </button>
        </div>

        {error && <div className="alert">{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Operator Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Passphrase</label>
            <input
              id="password"
              type="password"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : 1}
            />
            {mode === "register" && (
              <span className="muted">Minimum 8 characters.</span>
            )}
          </div>
          <button className="btn" type="submit" disabled={busy}>
            {busy
              ? "Authenticating…"
              : mode === "register"
                ? "Initialize Operator"
                : "Access Console"}
          </button>
        </form>
      </div>
    </div>
  );
}
