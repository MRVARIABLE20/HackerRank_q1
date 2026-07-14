import { useState } from "react";
import { signup } from "./api";
import LightningBg from "./LightningBg";

type Props = {
  onSignup: (token: string, roles: string[], department: string, email: string, full_name: string) => void;
  onGoLogin: () => void;
};

export default function Signup({ onSignup, onGoLogin }: Props) {
  const [form, setForm] = useState({ email: "", password: "", confirm: "", full_name: "" });
  const [showPw, setShowPw]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState<string | null>(null);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setErr("Passwords do not match"); return; }
    if (form.password.length < 8)       { setErr("Password must be at least 8 characters"); return; }
    setBusy(true); setErr(null);
    try {
      const r = await signup(form.email, form.password, form.full_name, "general", "user");
      onSignup(r.access_token, r.roles, r.department, form.email, r.full_name);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    } finally { setBusy(false); }
  };

  return (
    <div className="auth-shell">
      <LightningBg />
      <form className="auth-card" onSubmit={submit} style={{ width: 540 }}>
        <div className="auth-glow-bar" />

        <div className="auth-logo">
          <img src="/logo.png" alt="RAG Atlas" className="auth-logo-bolt" />
          <div className="auth-logo-text">
            RAG
            <strong>Atlas</strong>
          </div>
        </div>

        <h2>Create account</h2>
        <p className="auth-sub">Join the secure enterprise intelligence platform. New accounts are provisioned as standard users — contact an administrator for elevated access.</p>

        <div className="form-row">
          <div className="form-group">
            <label>Full name</label>
            <input value={form.full_name} onChange={set("full_name")} placeholder="Jane Smith" required autoFocus />
          </div>
          <div className="form-group">
            <label>Email address</label>
            <input type="email" value={form.email} onChange={set("email")} placeholder="jane@corp.com" required />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Password</label>
            <div className="pw-wrap">
              <input type={showPw ? "text" : "password"} value={form.password} onChange={set("password")} placeholder="Min. 8 characters" required />
              <button type="button" className="pw-eye" onClick={() => setShowPw(v => !v)} aria-label={showPw ? "Hide password" : "Show password"}>
                {showPw ? "🙈" : "👁"}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Confirm password</label>
            <div className="pw-wrap">
              <input type={showConfirm ? "text" : "password"} value={form.confirm} onChange={set("confirm")} placeholder="Repeat password" required />
              <button type="button" className="pw-eye" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? "Hide password" : "Show password"}>
                {showConfirm ? "🙈" : "👁"}
              </button>
            </div>
          </div>
        </div>

        {err && <div className="error">⚠ {err}</div>}

        <button className="btn" type="submit" disabled={busy} style={{ width: "100%", marginTop: 4 }}>
          {busy ? "Creating account…" : "⚡ Create account"}
        </button>

        <div className="auth-switch">
          Already have an account?{" "}
          <button type="button" className="link-btn" onClick={onGoLogin}>Sign in</button>
        </div>

        <div className="auth-security-note">
          <span>🔒</span>
          <span>Passwords hashed with bcrypt · Sessions secured with JWT HS256 · RBAC enforced at query time, server-side.</span>
        </div>
      </form>
    </div>
  );
}
