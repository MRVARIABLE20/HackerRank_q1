import { useState } from "react";
import { login } from "./api";
import LightningBg from "./LightningBg";

type Props = {
  onLogin: (token: string, roles: string[], department: string, email: string) => void;
  onGoSignup: () => void;
};

export default function Login({ onLogin, onGoSignup }: Props) {
  const [email, setEmail]       = useState("analyst@corp.com");
  const [password, setPassword] = useState("demo1234");
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await login(email, password);
      onLogin(r.access_token, r.roles, r.department, email);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    } finally { setBusy(false); }
  };

  return (
    <div className="auth-shell">
      <LightningBg />
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-glow-bar" />

        <div className="auth-logo">
          <img src="/logo.png" alt="Enterprise RAG" className="auth-logo-bolt" />
          <div className="auth-logo-text">
            Enterprise RAG
            <strong>Intelligence Platform</strong>
          </div>
        </div>

        <h2>Welcome back</h2>
        <p className="auth-sub">Sign in to access the RBAC-secured enterprise knowledge base.</p>

        <div className="form-group">
          <label>Email address</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@corp.com"
            required
            autoFocus
          />
        </div>

        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        {err && <div className="error">⚠ {err}</div>}

        <button className="btn" type="submit" disabled={busy} style={{ width: "100%", marginTop: 4 }}>
          {busy ? "Signing in…" : "⚡ Sign in"}
        </button>

        <div className="auth-switch">
          No account?{" "}
          <button type="button" className="link-btn" onClick={onGoSignup}>
            Create one free
          </button>
        </div>

        <div className="auth-security-note">
          <span>🔒</span>
          <span>All sessions secured with JWT HS256 Bearer tokens. Passwords hashed with bcrypt. RBAC enforced server-side.</span>
        </div>
      </form>
    </div>
  );
}
