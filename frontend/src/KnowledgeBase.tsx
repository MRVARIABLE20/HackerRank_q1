import { useEffect, useState } from "react";
import { kbCreateDoc, kbDeleteDoc, kbListDocs, type KBDoc } from "./api";
import LightningBg from "./LightningBg";

type Props = {
  token: string;
  email: string;
  onBack: () => void;
  onGoChat: () => void;
  onLogout: () => void;
};

type CatConfig = {
  id: string; icon: string; label: string;
  formatTag: string; formatColor: string;
  titlePlaceholder: string; contentPlaceholder: string; hint: string;
  validate: (c: string) => string | null;
};

const CATEGORIES: CatConfig[] = [
  {
    id: "pdfs", icon: "📄", label: "PDFs & internal documents",
    formatTag: "PROSE", formatColor: "fmt-prose",
    titlePlaceholder: "e.g. Remote Work Policy — 2026",
    contentPlaceholder: "Paste the full text of the document.\n\nExample:\n  REMOTE WORK POLICY\n  1. ELIGIBILITY\n     All full-time employees…",
    hint: "Paste plain text from a PDF, Word doc, or internal wiki page.",
    validate: (c) => c.trim().length < 40 ? "Paste the full document text (min 40 characters)." : null,
  },
  {
    id: "sql_csv", icon: "🗄️", label: "SQL/CSV databases",
    formatTag: "TABLE", formatColor: "fmt-table",
    titlePlaceholder: "e.g. Sales Q1 2026 — Regional Breakdown",
    contentPlaceholder: "Region,Revenue,Deals,YoY\nAPAC,1910000,28,+22%\nEMEA,1530000,31,+9%",
    hint: "Paste CSV rows or a table summary with header + data rows.",
    validate: (c) => c.trim().split("\n").filter(Boolean).length < 2
      ? "Add at least a header row and one data row (min 2 lines)." : null,
  },
  {
    id: "json_logs", icon: "🔍", label: "JSON logs & audit trails",
    formatTag: "JSON", formatColor: "fmt-json",
    titlePlaceholder: "e.g. API Audit Log — April 2026",
    contentPlaceholder: '{\n  "period": "April 2026",\n  "total_requests": 1284302,\n  "anomalies": 0\n}',
    hint: "Paste a valid JSON object { … } or array [ … ].",
    validate: (c) => {
      const t = c.trim();
      if (!t.startsWith("{") && !t.startsWith("[")) return "Must be a JSON object { … } or array [ … ].";
      try { JSON.parse(t); return null; } catch (e) { return `Invalid JSON: ${(e as Error).message}`; }
    },
  },
  {
    id: "technical", icon: "🔧", label: "Technical reports",
    formatTag: "TECHNICAL", formatColor: "fmt-tech",
    titlePlaceholder: "e.g. System Architecture — v2.1",
    contentPlaceholder: "SYSTEM NAME — OVERVIEW\n\nSTACK\n  - Backend: …\n\nARCHITECTURE\n  …",
    hint: "Paste architecture docs, API references, design specs, or runbooks.",
    validate: (c) => c.trim().length < 80 ? "Paste the full technical report (min 80 characters)." : null,
  },
  {
    id: "compliance", icon: "✅", label: "Compliance records",
    formatTag: "COMPLIANCE", formatColor: "fmt-compliance",
    titlePlaceholder: "e.g. GDPR Data Retention Policy — 2026",
    contentPlaceholder: "POLICY TITLE (Reviewed: Month Year)\n\nSCOPE\n  …\n\nDATA RETENTION\n  Personal data retained for…",
    hint: "Paste compliance policies, audit reports, GDPR records, or regulatory docs.",
    validate: (c) => c.trim().length < 80 ? "Paste the full policy text (min 80 characters)." : null,
  },
  {
    id: "operational", icon: "📊", label: "Operational datasets",
    formatTag: "OPS", formatColor: "fmt-ops",
    titlePlaceholder: "e.g. Infrastructure Health — May 2026",
    contentPlaceholder: "METRIC          | VALUE   | SLO     | STATUS\nAvailability    | 99.97%  | 99.9%   | ✅\np95 Latency     | 204ms   | <250ms  | ✅",
    hint: "Paste operational metrics, SLO reports, cost dashboards, or on-call runbooks.",
    validate: (c) => c.trim().length < 30 ? "Add meaningful operational data (min 30 characters)." : null,
  },
];

const catById = (id: string) => CATEGORIES.find((c) => c.id === id)!;
type AddState = { title: string; content: string };
const EMPTY: AddState = { title: "", content: "" };

export default function KnowledgeBase({ token, email, onBack, onGoChat, onLogout }: Props) {
  const [docs, setDocs] = useState<KBDoc[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<AddState>(EMPTY);
  const [addErr, setAddErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = async () => {
    try { setDocs(await kbListDocs(token)); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  useEffect(() => { reload().catch(() => {}); }, []); // eslint-disable-line

  const docsFor = (cat: string) => docs.filter((d) => d.category === cat);
  const myDocs  = (cat: string) => docsFor(cat).filter((d) => d.created_by === email);
  const otherDocs = (cat: string) => docsFor(cat).filter((d) => d.created_by !== email);

  const openCat = (id: string) => {
    if (active === id) { setActive(null); setAdding(false); return; }
    setActive(id); setAdding(false); setAddForm(EMPTY); setAddErr(null); setErr(null);
  };

  const saveAdd = async (cat: string) => {
    if (!addForm.title.trim() || !addForm.content.trim()) return;
    const cfg = catById(cat);
    const fmtErr = cfg.validate(addForm.content);
    if (fmtErr) { setAddErr(fmtErr); return; }
    setAddErr(null); setBusy(true); setErr(null);
    try {
      await kbCreateDoc(token, cat, addForm.title.trim(), addForm.content.trim());
      setAdding(false); setAddForm(EMPTY);
      await reload();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    if (!confirm("Remove this entry?")) return;
    setBusy(true); setErr(null);
    try { await kbDeleteDoc(token, id); await reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="ap-page">
      <LightningBg />

      <div className="db2-topbar">
        <div className="db2-logo">
          <img src="/logo.png" alt="Enterprise RAG" className="db2-logo-bolt" />
          <div>
            <span style={{ fontWeight: 800 }}>Enterprise RAG</span>
            <span style={{ display: "block", fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>Knowledge Base</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="badge">{email}</span>
          <button className="btn ghost" onClick={onBack}>← Dashboard</button>
          <button className="btn ghost" onClick={onGoChat}>Chat</button>
          <button className="btn ghost" onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div className="admin-wrap">
        <div className="db2-section-hd" style={{ marginBottom: 6 }}>Knowledge Base</div>
        <p className="auth-sub" style={{ marginTop: 0, marginBottom: 20 }}>
          Browse all entries the chatbot answers from. You can add new entries and delete your own contributions.
        </p>

        {err && <div className="error" style={{ marginBottom: 14 }}>⚠ {err}</div>}

        <div className="ap-cat-list">
          {CATEGORIES.map((cat) => {
            const total   = docsFor(cat.id).length;
            const mine    = myDocs(cat.id);
            const others  = otherDocs(cat.id);
            const isOpen  = active === cat.id;
            return (
              <div key={cat.id} className={`ap-cat-block electric-card ${isOpen ? "ap-open" : ""}`}>

                <div className="ap-cat-hd" onClick={() => openCat(cat.id)} role="button">
                  <span className="ap-cat-icon">{cat.icon}</span>
                  <span className="ap-cat-label">{cat.label}</span>
                  <span className={`ap-fmt-badge ${cat.formatColor}`}>{cat.formatTag}</span>
                  <span className="ap-cat-count">{total} {total === 1 ? "entry" : "entries"}</span>
                  <span className="ap-cat-chevron">{isOpen ? "▲" : "▼"}</span>
                </div>

                {isOpen && (
                  <div className="ap-cat-body">

                    {/* Format hint */}
                    <div className="ap-fmt-hint">
                      <span className={`ap-fmt-badge ${cat.formatColor}`}>{cat.formatTag}</span>
                      <span>{cat.hint}</span>
                    </div>

                    {total === 0 && !adding && (
                      <p className="auth-sub" style={{ margin: "8px 0 12px" }}>No entries yet.</p>
                    )}

                    {/* Other people's entries — read-only */}
                    {others.map((d) => (
                      <div key={d.id} className="ap-entry">
                        <div className="ap-entry-header">
                          <div className="ap-entry-title">{d.title}</div>
                          <span className={`ap-fmt-badge ${cat.formatColor}`}>{cat.formatTag}</span>
                        </div>
                        <div className="ap-entry-content">{d.content}</div>
                        <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
                          Added by {d.created_by}
                        </div>
                      </div>
                    ))}

                    {/* User's own entries — can delete */}
                    {mine.map((d) => (
                      <div key={d.id} className="ap-entry ap-entry-mine">
                        <div className="ap-entry-header">
                          <div className="ap-entry-title">{d.title}</div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span className={`ap-fmt-badge ${cat.formatColor}`}>{cat.formatTag}</span>
                            <span className="ap-mine-badge">yours</span>
                          </div>
                        </div>
                        <div className="ap-entry-content">{d.content}</div>
                        <div className="admin-doc-row" style={{ marginTop: 10 }}>
                          <button className="btn ghost small danger" disabled={busy} onClick={() => remove(d.id)}>
                            Delete
                          </button>
                        </div>
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
                          <button className="btn ghost" disabled={busy} onClick={() => { setAdding(false); setAddForm(EMPTY); setAddErr(null); }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="ap-add-btn"
                        onClick={() => { setAdding(true); setAddForm(EMPTY); setAddErr(null); }}
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
