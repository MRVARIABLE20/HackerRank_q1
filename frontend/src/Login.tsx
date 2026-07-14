import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { login } from "./api";
import LightningBg from "./LightningBg";

type Props = {
  onLogin: (token: string, roles: string[], department: string, email: string, full_name: string) => void;
  onGoSignup: () => void;
};

function LoginErrorModal({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  return createPortal(
    <motion.div
      className="warn-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onDismiss}
    >
      <motion.div
        className="warn-modal warn-modal--bad"
        initial={{ scale: 0.88, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.88, y: 16, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 26 }}
        onClick={e => e.stopPropagation()}
      >
        <span className="warn-modal-icon">🚫</span>
        <div className="warn-modal-title">Sign-in failed</div>
        <div className="warn-modal-body">{msg}</div>
        <button className="warn-modal-dismiss" onClick={onDismiss}>Try again</button>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export default function Login({ onLogin, onGoSignup }: Props) {
  const [email, setEmail]       = useState("admin@gmail.com");
  const [password, setPassword] = useState("admin123");
  const [showPw, setShowPw]     = useState(false);
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await login(email, password);
      onLogin(r.access_token, r.roles, r.department, email, r.full_name ?? "");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    } finally { setBusy(false); }
  };

  return (
    <div className="auth-shell">
      <AnimatePresence>
        {err && <LoginErrorModal msg={err} onDismiss={() => setErr(null)} />}
      </AnimatePresence>
      <LightningBg />
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-glow-bar" />

        <div className="auth-logo">
          <img src="/logo.png" alt="RAG Atlas" className="auth-logo-bolt" />
          <div className="auth-logo-text">
            RAG
            <strong>Atlas</strong>
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
          <div className="pw-wrap">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              className="pw-eye"
              onClick={() => setShowPw(v => !v)}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? "🙈" : "👁"}
            </button>
          </div>
        </div>

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
