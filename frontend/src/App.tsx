import { useState } from "react";
import Login from "./Login";
import Signup from "./Signup";
import Dashboard from "./Dashboard";
import Chat from "./Chat";
import KBPage from "./KBPage";

type Page = "login" | "signup" | "dashboard" | "chat" | "kb";

type Session = {
  token: string;
  roles: string[];
  department: string;
  email: string;
  full_name: string;
};

const KEY = "erag.session";

export default function App() {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  });
  const [page, setPage] = useState<Page>(session ? "dashboard" : "login");

  const saveSession = (token: string, roles: string[], department: string, email: string, full_name = "") => {
    const s: Session = { token, roles, department, email, full_name };
    localStorage.setItem(KEY, JSON.stringify(s));
    setSession(s);
    setPage("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem(KEY);
    setSession(null);
    setPage("login");
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
        onLogout={handleLogout}
        onBack={() => setPage("dashboard")}
      />
    );

  if (page === "kb")
    return (
      <KBPage
        token={session.token}
        email={session.email}
        isAdmin={session.roles.includes("admin")}
        onBack={() => setPage("dashboard")}
        onGoChat={() => setPage("chat")}
        onLogout={handleLogout}
      />
    );

  return (
    <Dashboard
      token={session.token}
      email={session.email}
      roles={session.roles}
      department={session.department}
      full_name={session.full_name}
      onGoChat={() => setPage("chat")}
      onGoKB={() => setPage("kb")}
      onLogout={handleLogout}
    />
  );
}
