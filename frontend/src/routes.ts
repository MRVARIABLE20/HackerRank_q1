// Central route table — each app section is a real, bookmarkable URL.
// Kept in its own module so any component can import it without creating a
// circular dependency with App.tsx.
export const ROUTES = {
  login: "/login",
  signup: "/signup",
  overview: "/overview",
  audit: "/audit",       // admin only
  history: "/history",   // bot user only
  kb: "/knowledge-base",
  pipelines: "/pipelines",
  chat: "/chat",
} as const;
