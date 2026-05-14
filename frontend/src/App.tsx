import { useEffect, useRef, useState } from "react";
import Login from "./Login";
import Signup from "./Signup";
import Dashboard from "./Dashboard";
import Chat from "./Chat";
import KBPage from "./KBPage";
import { getTokenExpiry, isTokenExpired } from "./api";

type Page = "login" | "signup" | "dashboard" | "chat" | "kb";

type Session = {
  token: string;
  roles: string[];
  department: string;
  email: string;
  full_name: string;
};

const KEY = "erag.session";

// Pages that should push a browser history entry so the native back button works
const HISTORY_PAGES: Page[] = ["dashboard", "chat", "kb"];

function pushPage(page: Page) {
  window.history.pushState({ page }, "");
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Session;
      // Discard session immediately if token is already expired
      if (isTokenExpired(s.token)) {
        localStorage.removeItem(KEY);
        return null;
      }
      return s;
    } catch {
      return null;
    }
  });
  const [page, setPage] = useState<Page>(session ? "dashboard" : "login");
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Navigate to a new page and push a history entry so the browser back button works
  const navigate = (p: Page) => {
    setPage(p);
    if (HISTORY_PAGES.includes(p)) pushPage(p);
  };

  const clearExpiryTimer = () => {
    if (expiryTimerRef.current !== null) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  };

  const scheduleExpiryLogout = (token: string) => {
    clearExpiryTimer();
    const exp = getTokenExpiry(token);
    if (exp === null) return;
    const delay = exp - Date.now();
    if (delay <= 0) return;
    expiryTimerRef.current = setTimeout(() => {
      handleLogout(true);
    }, delay);
  };

  // Listen for 401 responses dispatched by apiFetch in api.ts
  useEffect(() => {
    const onExpired = () => handleLogout(true);
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []); // eslint-disable-line

  // Handle browser back/forward button
  useEffect(() => {
    // Seed an initial history entry so there is something to pop back to
    if (session) pushPage("dashboard");

    const onPopState = (e: PopStateEvent) => {
      const p = (e.state as { page?: Page } | null)?.page;
      if (!p || !session) {
        // No known state (user navigated before login, or no session) — stay put
        return;
      }
      setPage(p);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []); // eslint-disable-line

  // Schedule timer for the session restored from localStorage
  useEffect(() => {
    if (session) scheduleExpiryLogout(session.token);
    return clearExpiryTimer;
  }, []); // eslint-disable-line

  const saveSession = (token: string, roles: string[], department: string, email: string, full_name = "") => {
    const s: Session = { token, roles, department, email, full_name };
    localStorage.setItem(KEY, JSON.stringify(s));
    setSession(s);
    navigate("dashboard");
    scheduleExpiryLogout(token);
  };

  const handleLogout = (expired = false) => {
    clearExpiryTimer();
    localStorage.removeItem(KEY);
    setSession(null);
    setPage("login");
    if (expired) {
      // Brief delay so the login page is mounted before the alert fires
      setTimeout(() => alert("Your session has expired. Please sign in again."), 50);
    }
  };

  if (!session) {
    if (page === "signup")
      return (
        <Signup
          onSignup={(token, roles, department, email, full_name) =>
            saveSession(token, roles, department, email, full_name)
          }
          onGoLogin={() => setPage("login")}
        />
      );
    return (
      <Login
        onLogin={(token, roles, department, email) =>
          saveSession(token, roles, department, email)
        }
        onGoSignup={() => setPage("signup")}
      />
    );
  }

  if (page === "chat")
    return (
      <Chat
        token={session.token}
        email={session.email}
        roles={session.roles}
        department={session.department}
        onLogout={() => handleLogout()}
        onBack={() => navigate("dashboard")}
      />
    );

  if (page === "kb")
    return (
      <KBPage
        token={session.token}
        email={session.email}
        isAdmin={session.roles.includes("admin")}
        onBack={() => navigate("dashboard")}
        onGoChat={() => navigate("chat")}
        onLogout={() => handleLogout()}
      />
    );

  // page === "dashboard" (or any other fallback)
  return (
    <Dashboard
      token={session.token}
      email={session.email}
      roles={session.roles}
      department={session.department}
      full_name={session.full_name}
      onGoChat={() => navigate("chat")}
      onGoKB={() => navigate("kb")}
      onLogout={() => handleLogout()}
    />
  );
}
