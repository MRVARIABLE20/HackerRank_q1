import { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import Login from "./Login";
import Signup from "./Signup";
import Dashboard from "./Dashboard";
import Chat from "./Chat";
import KBPage from "./KBPage";
import PipelinesPage from "./PipelinesPage";
import { getTokenExpiry, isTokenExpired } from "./api";
import { ROUTES } from "./routes";

type Session = {
  token: string;
  roles: string[];
  department: string;
  email: string;
  full_name: string;
};

const KEY = "erag.session";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [session, setSession] = useState<Session | null>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Session;
      if (isTokenExpired(s.token)) {
        localStorage.removeItem(KEY);
        return null;
      }
      return s;
    } catch {
      return null;
    }
  });
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearExpiryTimer = () => {
    if (expiryTimerRef.current !== null) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  };

  const handleLogout = (expired = false) => {
    clearExpiryTimer();
    localStorage.removeItem(KEY);
    setSession(null);
    navigate(ROUTES.login, { replace: true });
    if (expired) {
      setTimeout(() => alert("Your session has expired. Please sign in again."), 50);
    }
  };

  const scheduleExpiryLogout = (token: string) => {
    clearExpiryTimer();
    const exp = getTokenExpiry(token);
    if (exp === null) return;
    const delay = exp - Date.now();
    if (delay <= 0) return;
    expiryTimerRef.current = setTimeout(() => handleLogout(true), delay);
  };

  // Listen for 401 responses dispatched by apiFetch in api.ts
  useEffect(() => {
    const onExpired = () => handleLogout(true);
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []); // eslint-disable-line

  // Schedule expiry timer for a session restored from localStorage
  useEffect(() => {
    if (session) scheduleExpiryLogout(session.token);
    return clearExpiryTimer;
  }, []); // eslint-disable-line

  const saveSession = (
    token: string, roles: string[], department: string, email: string, full_name = "",
  ) => {
    const s: Session = { token, roles, department, email, full_name };
    localStorage.setItem(KEY, JSON.stringify(s));
    setSession(s);
    scheduleExpiryLogout(token);
    navigate(ROUTES.overview, { replace: true });
  };

  // ── Unauthenticated: only the auth routes are reachable ───────────────────
  if (!session) {
    return (
      <Routes>
        <Route
          path={ROUTES.login}
          element={
            <Login
              onLogin={(token, roles, department, email, full_name) =>
                saveSession(token, roles, department, email, full_name)
              }
              onGoSignup={() => navigate(ROUTES.signup)}
            />
          }
        />
        <Route
          path={ROUTES.signup}
          element={
            <Signup
              onSignup={(token, roles, department, email, full_name) =>
                saveSession(token, roles, department, email, full_name)
              }
              onGoLogin={() => navigate(ROUTES.login)}
            />
          }
        />
        {/* Any other URL redirects to login, preserving the intent to land somewhere */}
        <Route path="*" element={<Navigate to={ROUTES.login} replace state={{ from: location.pathname }} />} />
      </Routes>
    );
  }

  // ── Authenticated ─────────────────────────────────────────────────────────
  const isAdmin = session.roles.includes("admin");

  return (
    <Routes>
      {/* Dashboard shell (persistent sidebar) — overview + role-specific log page */}
      <Route path={ROUTES.overview} element={<Dashboard {...session} onLogout={() => handleLogout()} />} />
      <Route
        path={ROUTES.audit}
        element={isAdmin
          ? <Dashboard {...session} onLogout={() => handleLogout()} />
          : <Navigate to={ROUTES.overview} replace />}
      />
      <Route
        path={ROUTES.history}
        element={!isAdmin
          ? <Dashboard {...session} onLogout={() => handleLogout()} />
          : <Navigate to={ROUTES.overview} replace />}
      />

      {/* Knowledge Base — full-page */}
      <Route
        path={ROUTES.kb}
        element={
          <KBPage
            token={session.token}
            email={session.email}
            isAdmin={isAdmin}
            onBack={() => navigate(ROUTES.overview)}
            onGoChat={() => navigate(ROUTES.chat)}
            onLogout={() => handleLogout()}
          />
        }
      />

      {/* RAG Pipelines — full-page */}
      <Route
        path={ROUTES.pipelines}
        element={
          <PipelinesPage
            onBack={() => navigate(ROUTES.overview)}
            onGoChat={() => navigate(ROUTES.chat)}
          />
        }
      />

      {/* Chat — full-page */}
      <Route
        path={ROUTES.chat}
        element={
          <Chat
            token={session.token}
            email={session.email}
            roles={session.roles}
            department={session.department}
            onLogout={() => handleLogout()}
            onBack={() => navigate(ROUTES.overview)}
          />
        }
      />

      {/* Logged in but hitting an auth/unknown URL → send to overview */}
      <Route path={ROUTES.login} element={<Navigate to={ROUTES.overview} replace />} />
      <Route path={ROUTES.signup} element={<Navigate to={ROUTES.overview} replace />} />
      <Route path="*" element={<Navigate to={ROUTES.overview} replace />} />
    </Routes>
  );
}
