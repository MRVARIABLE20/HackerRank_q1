// API client — all requests include Authorization: Bearer <token>
export type Citation = {
  doc_id: string;
  source_uri: string;
  page: number | null;
  snippet: string;
  score: number;
  classification: string;
  department: string;
};

export type RouterDecision = {
  strategy: string;
  model?: string;
  k?: number;
  top_score?: number;
  scores?: number[];
};

export type ChatResponse = {
  answer: string;
  citations: Citation[];
  confidence: number;
  trace_id: string;
  router_decision: RouterDecision;
  verifier_verdict: Record<string, unknown>;
  denied_doc_count: number;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  roles: string[];
  department: string;
};

export type SignupResponse = LoginResponse & { full_name: string };

export type MeResponse = {
  email: string;
  roles: string[];
  department: string;
};

export type AuditEntry = {
  ts: string;
  user_email: string;
  user_roles: string[];
  query: string;
  retrieved_doc_ids: string[];
  denied_doc_count: number;
  confidence: number;
  trace_id: string;
};

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function login(email: string, password: string): Promise<LoginResponse> {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error((await r.text()) || "Login failed");
  return r.json();
}

export async function signup(
  email: string,
  password: string,
  full_name: string,
  department: string,
  role: string,
): Promise<SignupResponse> {
  const r = await fetch(`${API}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name, department, role }),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    throw new Error(body?.detail ?? "Signup failed");
  }
  return r.json();
}

export async function getMe(token: string): Promise<MeResponse> {
  const r = await fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("Token invalid or expired");
  return r.json();
}

export async function getAuditLog(token: string, limit = 20): Promise<AuditEntry[]> {
  const r = await fetch(`${API}/audit?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("Cannot fetch audit log");
  return r.json();
}

export async function chat(token: string, query: string): Promise<ChatResponse> {
  const r = await fetch(`${API}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error((await r.text()) || "Chat failed");
  return r.json();
}

// ---- Admin: KB document management ----

export type KBCategory = { id: string; label: string };
export type KBDoc = {
  id: number;
  category: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export async function getCategories(token: string): Promise<KBCategory[]> {
  const r = await fetch(`${API}/admin/docs/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("Cannot fetch categories");
  const j = await r.json();
  return j.categories;
}

export async function listDocs(token: string, category?: string): Promise<KBDoc[]> {
  const url = new URL(`${API}/admin/docs`);
  if (category) url.searchParams.set("category", category);
  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("Cannot fetch documents");
  return r.json();
}

export async function createDoc(
  token: string,
  category: string,
  title: string,
  content: string,
): Promise<KBDoc> {
  const r = await fetch(`${API}/admin/docs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ category, title, content }),
  });
  if (!r.ok) {
    const b = await r.json().catch(() => null);
    throw new Error(b?.detail ?? "Create failed");
  }
  return r.json();
}

export async function updateDoc(
  token: string,
  id: number,
  patch: { category?: string; title?: string; content?: string },
): Promise<KBDoc> {
  const r = await fetch(`${API}/admin/docs/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error("Update failed");
  return r.json();
}

export async function deleteDoc(token: string, id: number): Promise<void> {
  const r = await fetch(`${API}/admin/docs/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("Delete failed");
}

// ---- User KB: any authenticated user can list, add, delete-own ----

export async function kbListDocs(token: string, category?: string): Promise<KBDoc[]> {
  const url = new URL(`${API}/kb/docs`);
  if (category) url.searchParams.set("category", category);
  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("Cannot fetch documents");
  return r.json();
}

export async function kbCreateDoc(
  token: string,
  category: string,
  title: string,
  content: string,
): Promise<KBDoc> {
  const r = await fetch(`${API}/kb/docs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ category, title, content }),
  });
  if (!r.ok) {
    const b = await r.json().catch(() => null);
    throw new Error(b?.detail ?? "Create failed");
  }
  return r.json();
}

export async function kbDeleteDoc(token: string, id: number): Promise<void> {
  const r = await fetch(`${API}/kb/docs/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const b = await r.json().catch(() => null);
    throw new Error(b?.detail ?? "Delete failed");
  }
}
