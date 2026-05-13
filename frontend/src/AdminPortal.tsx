import { useEffect, useState } from "react";
import { createDoc, deleteDoc, listDocs, updateDoc, type KBDoc } from "./api";
import LightningBg from "./LightningBg";

type Props = {
  token: string;
  email: string;
  onBack: () => void;
  onGoChat: () => void;
  onLogout: () => void;
};

type CatConfig = {
  id: string;
  icon: string;
  label: string;
  formatTag: string;       // badge shown on entries
  formatColor: string;     // badge colour class
  titlePlaceholder: string;
  contentPlaceholder: string;
  hint: string;            // shown above the textarea in the add form
  validate: (content: string) => string | null; // null = ok, string = error
};

const CATEGORIES: CatConfig[] = [
  {
    id: "pdfs",
    icon: "📄",
    label: "PDFs & internal documents",
    formatTag: "PROSE",
    formatColor: "fmt-prose",
    titlePlaceholder: "e.g. Remote Work Policy — 2026",
    contentPlaceholder:
      "Paste the full text of the document.\n\nExample:\n  REMOTE WORK POLICY\n  1. ELIGIBILITY\n     All full-time employees…\n  2. ENTITLEMENTS\n     Annual Leave: 25 days…",
    hint: "Paste plain text copied from a PDF, Word doc, or internal wiki page. Structured sections (headings + paragraphs) work best.",
    validate: (c) =>
      c.trim().length < 40
        ? "Content is too short — paste the full document text (min 40 characters)."
        : null,
  },
  {
    id: "sql_csv",
    icon: "🗄️",
    label: "SQL/CSV databases",
    formatTag: "TABLE",
    formatColor: "fmt-table",
    titlePlaceholder: "e.g. Sales Q1 2026 — Regional Breakdown",
    contentPlaceholder:
      "Paste CSV data or a table summary.\n\nExample:\n  Region,Revenue,Deals,YoY\n  APAC,1910000,28,+22%\n  EMEA,1530000,31,+9%\n  Americas,1020000,20,+5%",
    hint: "Paste CSV rows, a SQL query result table, or a structured summary with headers and values. Use commas or pipe-separated columns.",
    validate: (c) => {
      const lines = c.trim().split("\n").filter(Boolean);
      if (lines.length < 2)
        return "Add at least a header row and one data row (minimum 2 lines).";
      return null;
    },
  },
  {
    id: "json_logs",
    icon: "🔍",
    label: "JSON logs & audit trails",
    formatTag: "JSON",
    formatColor: "fmt-json",
    titlePlaceholder: "e.g. API Audit Log — April 2026",
    contentPlaceholder:
      '{\n  "period": "April 2026",\n  "total_requests": 1284302,\n  "failed_logins": 3868,\n  "blocked_ips": ["45.33.102.7"],\n  "anomalies": 0\n}',
    hint: "Paste a valid JSON object or array. The chatbot will be able to answer questions about the fields and values.",
    validate: (c) => {
      const trimmed = c.trim();
      if (!trimmed.startsWith("{") && !trimmed.startsWith("["))
        return "Content must be a JSON object { … } or array [ … ].";
      try {
        JSON.parse(trimmed);
        return null;
      } catch (e) {
        return `Invalid JSON: ${(e as Error).message}`;
      }
    },
  },
  {
    id: "technical",
    icon: "🔧",
    label: "Technical reports",
    formatTag: "TECHNICAL",
    formatColor: "fmt-tech",
    titlePlaceholder: "e.g. RAG Pipeline Architecture — v2.1",
    contentPlaceholder:
      "SYSTEM NAME — OVERVIEW\n\nSTACK\n  - Backend: …\n  - Frontend: …\n\nARCHITECTURE\n  …\n\nPERFORMANCE TARGETS\n  p95 latency < 250ms …",
    hint: "Paste technical documentation: architecture overviews, API references, design specs, or infrastructure runbooks. Use ALL-CAPS section headers for best results.",
    validate: (c) =>
      c.trim().length < 80
        ? "Technical reports should be detailed — paste the full report text (min 80 characters)."
        : null,
  },
  {
    id: "compliance",
    icon: "✅",
    label: "Compliance records",
    formatTag: "COMPLIANCE",
    formatColor: "fmt-compliance",
    titlePlaceholder: "e.g. GDPR Data Retention Policy — 2026",
    contentPlaceholder:
      "POLICY TITLE (Reviewed: Month Year)\n\nSCOPE\n  …\n\nDATA RETENTION\n  Personal data retained for…\n\nDATA SUBJECT RIGHTS\n  Right of access: …\n\nCONTACT\n  dpo@company.com",
    hint: "Paste compliance policies, ISO/SOC audit reports, GDPR records, or regulatory documentation. Include review dates and contact details where available.",
    validate: (c) =>
      c.trim().length < 80
        ? "Compliance records must be detailed — paste the full policy text (min 80 characters)."
        : null,
  },
  {
    id: "operational",
    icon: "📊",
    label: "Operational datasets",
    formatTag: "OPS",
    formatColor: "fmt-ops",
    titlePlaceholder: "e.g. Infrastructure Health Report — May 2026",
    contentPlaceholder:
      "METRIC          | VALUE      | SLO     | STATUS\n----------------|------------|---------|--------\nAvailability    | 99.97%     | 99.9%   | ✅\np95 Latency     | 204ms      | <250ms  | ✅\nError Rate      | 0.039%     | <0.10%  | ✅\nMonthly Cost    | $14,780    | <$20K   | ✅",
    hint: "Paste operational metrics, SLO reports, on-call runbooks, or cost dashboards. Formatted tables (pipe-separated) or plain key: value pairs both work well.",
    validate: (c) =>
      c.trim().length < 30
        ? "Add meaningful operational data (min 30 characters)."
        : null,
  },
];

const catById = (id: string) => CATEGORIES.find((c) => c.id === id)!;

type AddState = { title: string; content: string };
const EMPTY_ADD: AddState = { title: "", content: "" };

export default function AdminPortal({ token, email, onBack, onGoChat, onLogout }: Props) {
  const [docs, setDocs] = useState<KBDoc[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<AddState>(EMPTY_ADD);
  const [addErr, setAddErr] = useState<string | null>(null);  // format validation error
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<AddState>(EMPTY_ADD);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = async () => {
    try {
      setDocs(await listDocs(token));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => { reload().catch(() => {}); }, []); // eslint-disable-line

  const docsFor = (cat: string) => docs.filter((d) => d.category === cat);

  const openCat = (id: string) => {
    if (active === id) { setActive(null); setAdding(false); setEditId(null); return; }
    setActive(id);
    setAdding(false);
    setAddForm(EMPTY_ADD);
    setAddErr(null);
    setEditId(null);
    setEditErr(null);
    setErr(null);
  };

  const saveAdd = async (cat: string) => {
    if (!addForm.title.trim() || !addForm.content.trim()) return;
    // Format validation
    const cfg = catById(cat);
    const fmtErr = cfg.validate(addForm.content);
    if (fmtErr) { setAddErr(fmtErr); return; }
    setAddErr(null);
    setBusy(true); setErr(null);
    try {
      await createDoc(token, cat, addForm.title.trim(), addForm.content.trim());
      setAdding(false); setAddForm(EMPTY_ADD);
      await reload();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const saveEdit = async (id: number, cat: string) => {
    if (!editForm.title.trim() || !editForm.content.trim()) return;
    // Format validation on edit too
    const cfg = catById(cat);
    const fmtErr = cfg.validate(editForm.content);
    if (fmtErr) { setEditErr(fmtErr); return; }
    setEditErr(null);
    setBusy(true); setErr(null);
    try {
      await updateDoc(token, id, { title: editForm.title.trim(), content: editForm.content.trim() });
      setEditId(null);
      await reload();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    if (!confirm("Remove this entry? The chatbot will no longer use it.")) return;
    setBusy(true); setErr(null);
    try { await deleteDoc(token, id); await reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const startEdit = (d: KBDoc) => {
    setEditId(d.id);
    setEditForm({ title: d.title, content: d.content });
    setEditErr(null);
    setAdding(false);
  };

  return (
    <div className="ap-page">
      <LightningBg />

      {/* Top bar */}
      <div className="db2-topbar">
        <div className="db2-logo">
          <img src="/logo.png" alt="Enterprise RAG" className="db2-logo-bolt" />
          <div>
            <span style={{ fontWeight: 800 }}>Enterprise RAG</span>
            <span style={{ display: "block", fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>
              Admin Portal
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="badge">{email}</span>
          <span className="badge role">admin</span>
          <button className="btn ghost" onClick={onBack}>← Dashboard</button>
          <button className="btn ghost" onClick={onGoChat}>Chat</button>
          <button className="btn ghost" onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div className="admin-wrap">
        <div className="db2-section-hd" style={{ marginBottom: 6 }}>Knowledge Base</div>
        <p className="auth-sub" style={{ marginTop: 0, marginBottom: 20 }}>
          Select a data source to view or add entries. The chatbot answers only from what you add here.
        </p>

        {err && <div className="error" style={{ marginBottom: 14 }}>⚠ {err}</div>}

        <div className="ap-cat-list">
          {CATEGORIES.map((cat) => {
            const catDocs = docsFor(cat.id);
            const isOpen = active === cat.id;
            return (
              <div key={cat.id} className={`ap-cat-block electric-card ${isOpen ? "ap-open" : ""}`}>

                {/* Category header */}
                <div className="ap-cat-hd" onClick={() => openCat(cat.id)} role="button">
                  <span className="ap-cat-icon">{cat.icon}</span>
                  <span className="ap-cat-label">{cat.label}</span>
                  <span className={`ap-fmt-badge ${cat.formatColor}`}>{cat.formatTag}</span>
                  <span className="ap-cat-count">{catDocs.length} {catDocs.length === 1 ? "entry" : "entries"}</span>
                  <span className="ap-cat-chevron">{isOpen ? "▲" : "▼"}</span>
                </div>

                {isOpen && (
                  <div className="ap-cat-body">

                    {/* Format hint banner */}
                    <div className="ap-fmt-hint">
                      <span className={`ap-fmt-badge ${cat.formatColor}`}>{cat.formatTag}</span>
                      <span>{cat.hint}</span>
                    </div>

                    {catDocs.length === 0 && !adding && (
                      <p className="auth-sub" style={{ margin: "8px 0 12px" }}>
                        No entries yet — add the first one below.
                      </p>
                    )}

                    {catDocs.map((d) => (
                      <div key={d.id} className={`ap-entry ${editId === d.id ? "ap-entry-editing" : ""}`}>
                        {editId === d.id ? (
                          <>
                            <div className="form-group" style={{ marginBottom: 8 }}>
                              <label>Title</label>
                              <input
                                value={editForm.title}
                                onChange={(e) => { setEditForm({ ...editForm, title: e.target.value }); setEditErr(null); }}
                                placeholder={cat.titlePlaceholder}
                                autoFocus
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 4 }}>
                              <label>Content <span className={`ap-fmt-badge ${cat.formatColor}`} style={{ marginLeft: 6 }}>{cat.formatTag}</span></label>
                              <textarea
                                value={editForm.content}
                                onChange={(e) => { setEditForm({ ...editForm, content: e.target.value }); setEditErr(null); }}
                                rows={8}
                                placeholder={cat.contentPlaceholder}
                                className={editErr ? "textarea-error" : ""}
                              />
                            </div>
                            {editErr && <div className="ap-validation-err">⚠ {editErr}</div>}
                            <div className="admin-actions" style={{ marginTop: 10 }}>
                              <button className="btn small" disabled={busy} onClick={() => saveEdit(d.id, cat.id)}>
                                {busy ? "Saving…" : "💾 Save"}
                              </button>
                              <button className="btn ghost small" disabled={busy} onClick={() => { setEditId(null); setEditErr(null); }}>
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="ap-entry-header">
                              <div className="ap-entry-title">{d.title}</div>
                              <span className={`ap-fmt-badge ${cat.formatColor}`}>{cat.formatTag}</span>
                            </div>
                            <div className="ap-entry-content">{d.content}</div>
                            <div className="admin-doc-row" style={{ marginTop: 10 }}>
                              <button className="btn ghost small" onClick={() => startEdit(d)}>Edit</button>
                              <button className="btn ghost small danger" onClick={() => remove(d.id)}>Delete</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}

                    {/* Add form */}
                    {adding ? (
                      <div className="ap-add-form electric-card" style={{ marginTop: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                          <span className="db2-section-hd" style={{ margin: 0 }}>New {cat.label} entry</span>
                          <span className={`ap-fmt-badge ${cat.formatColor}`}>{cat.formatTag}</span>
                        </div>
                        <div className="form-group" style={{ marginBottom: 8 }}>
                          <label>Title</label>
                          <input
                            value={addForm.title}
                            onChange={(e) => { setAddForm({ ...addForm, title: e.target.value }); setAddErr(null); }}
                            placeholder={cat.titlePlaceholder}
                            autoFocus
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 4 }}>
                          <label>Content</label>
                          <textarea
                            value={addForm.content}
                            onChange={(e) => { setAddForm({ ...addForm, content: e.target.value }); setAddErr(null); }}
                            rows={10}
                            placeholder={cat.contentPlaceholder}
                            className={addErr ? "textarea-error" : ""}
                          />
                        </div>
                        {addErr && <div className="ap-validation-err">⚠ {addErr}</div>}
                        <div className="admin-actions" style={{ marginTop: 12 }}>
                          <button
                            className="btn"
                            disabled={busy || !addForm.title.trim() || !addForm.content.trim()}
                            onClick={() => saveAdd(cat.id)}
                          >
                            {busy ? "Saving…" : "⚡ Add entry"}
                          </button>
                          <button className="btn ghost" disabled={busy} onClick={() => { setAdding(false); setAddForm(EMPTY_ADD); setAddErr(null); }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="ap-add-btn"
                        onClick={() => { setAdding(true); setEditId(null); setAddForm(EMPTY_ADD); setAddErr(null); }}
                      >
                        + Add {cat.formatTag} entry
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
