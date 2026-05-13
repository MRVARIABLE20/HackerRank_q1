import { useEffect, useRef, useState } from "react";
import {
  createDoc, deleteDoc, listDocs, updateDoc,
  kbCreateDoc, kbDeleteDoc, kbListDocs,
  type KBDoc,
} from "./api";
import LightningBg from "./LightningBg";

type Props = {
  token: string;
  email: string;
  isAdmin: boolean;
  onBack: () => void;
  onGoChat: () => void;
  onLogout: () => void;
};

// ── Format-specific input types ──────────────────────────────────

type TableState = { cols: string[]; rows: string[][] };
type KVPair     = { k: string; v: string };
type InputMode  = "file_text" | "table" | "kv_json";

type CatConfig = {
  id: string; icon: string; label: string;
  formatTag: string; formatColor: string;
  inputMode: InputMode;
  titlePlaceholder: string;
  template?: string;
  initialTable?: TableState;
  initialPairs?: KVPair[];
  hint: string;
  validate: (content: string) => string | null;
};

const CATEGORIES: CatConfig[] = [
  {
    id: "pdfs", icon: "📄", label: "PDFs & Internal Documents",
    formatTag: "PROSE", formatColor: "fmt-prose", inputMode: "file_text",
    titlePlaceholder: "e.g. Remote Work Policy — 2026",
    hint: "Upload a .txt file or paste plain document text. Structured headings and paragraphs work best.",
    validate: (c) => c.trim().length < 40 ? "Content too short — paste the full document text (min 40 chars)." : null,
  },
  {
    id: "sql_csv", icon: "🗄️", label: "SQL / CSV Databases",
    formatTag: "TABLE", formatColor: "fmt-table", inputMode: "table",
    titlePlaceholder: "e.g. Sales Q1 2026 — Regional Breakdown",
    initialTable: {
      cols: ["Region", "Revenue", "Deals", "YoY"],
      rows: [["APAC", "1,910,000", "28", "+22%"], ["EMEA", "1,530,000", "31", "+9%"]],
    },
    hint: "Fill in the table — edit column headers, add rows. Saved as CSV that the chatbot can query.",
    validate: (c) => c.trim().split("\n").filter(Boolean).length < 2 ? "Add at least one data row." : null,
  },
  {
    id: "json_logs", icon: "🔍", label: "JSON Logs & Audit Trails",
    formatTag: "JSON", formatColor: "fmt-json", inputMode: "kv_json",
    titlePlaceholder: "e.g. API Audit Log — April 2026",
    initialPairs: [
      { k: "period", v: "April 2026" },
      { k: "total_requests", v: "1284302" },
      { k: "anomalies", v: "0" },
    ],
    hint: "Add key-value fields. Numbers and booleans are typed automatically. Saved as a JSON object.",
    validate: (c) => { try { JSON.parse(c); return null; } catch (e) { return `Invalid JSON: ${(e as Error).message}`; } },
  },
  {
    id: "technical", icon: "🔧", label: "Technical Reports",
    formatTag: "TECHNICAL", formatColor: "fmt-tech", inputMode: "file_text",
    titlePlaceholder: "e.g. RAG Pipeline Architecture — v2.1",
    template:
      "SYSTEM NAME — OVERVIEW\n\nSTACK\n  - Backend: \n  - Frontend: \n  - Database: \n\nARCHITECTURE\n  \n\nPERFORMANCE TARGETS\n  p95 Latency: \n  Availability SLO: \n  Error Budget: ",
    hint: "Fill in each section — replace the placeholder text with your system's details.",
    validate: (c) => c.trim().length < 80 ? "Fill in the template sections (min 80 chars)." : null,
  },
  {
    id: "compliance", icon: "✅", label: "Compliance Records",
    formatTag: "COMPLIANCE", formatColor: "fmt-compliance", inputMode: "file_text",
    titlePlaceholder: "e.g. GDPR Data Retention Policy — 2026",
    template:
      "POLICY TITLE (Reviewed: Month Year)\n\nSCOPE\n  This policy applies to: \n\nDATA RETENTION\n  Personal data retained for: \n\nDATA SUBJECT RIGHTS\n  Right of access: \n  Right to erasure: \n  Right to portability: \n\nCOMPLIANCE CONTACT\n  dpo@company.com",
    hint: "Replace each line in the template with your organisation's actual policy details.",
    validate: (c) => c.trim().length < 80 ? "Fill in all template sections (min 80 chars)." : null,
  },
  {
    id: "operational", icon: "📊", label: "Operational Datasets",
    formatTag: "OPS", formatColor: "fmt-ops", inputMode: "table",
    titlePlaceholder: "e.g. Infrastructure Health — May 2026",
    initialTable: {
      cols: ["Metric", "Value", "SLO", "Status"],
      rows: [
        ["Availability",  "99.97%", "99.9%",   "✅"],
        ["p95 Latency",   "204ms",  "<250ms",  "✅"],
        ["Error Rate",    "0.039%", "<0.10%",  "✅"],
        ["Monthly Cost",  "$14,780","<$20K",   "✅"],
      ],
    },
    hint: "Fill in the metrics table — add or remove rows for each operational metric.",
    validate: (c) => c.trim().length < 30 ? "Add meaningful operational data." : null,
  },
];

const catById = (id: string) => CATEGORIES.find((c) => c.id === id)!;

// ── Table Builder ────────────────────────────────────────────────

function deepCloneTable(t: TableState): TableState {
  return { cols: [...t.cols], rows: t.rows.map((r) => [...r]) };
}

function TableBuilder({ state, onChange }: { state: TableState; onChange: (s: TableState) => void }) {
  const addCol = () =>
    onChange({ cols: [...state.cols, `Col ${state.cols.length + 1}`], rows: state.rows.map((r) => [...r, ""]) });
  const removeCol = (ci: number) =>
    onChange({ cols: state.cols.filter((_, i) => i !== ci), rows: state.rows.map((r) => r.filter((_, i) => i !== ci)) });
  const addRow = () =>
    onChange({ ...state, rows: [...state.rows, state.cols.map(() => "")] });
  const removeRow = (ri: number) =>
    onChange({ ...state, rows: state.rows.filter((_, i) => i !== ri) });
  const setCol = (ci: number, v: string) =>
    onChange({ ...state, cols: state.cols.map((c, i) => (i === ci ? v : c)) });
  const setCell = (ri: number, ci: number, v: string) =>
    onChange({
      ...state,
      rows: state.rows.map((r, i) => i === ri ? r.map((c, j) => (j === ci ? v : c)) : r),
    });

  return (
    <div className="tb-wrap">
      <div className="tb-scroll">
        <table className="tb-table">
          <thead>
            <tr>
              {state.cols.map((col, ci) => (
                <th key={ci}>
                  <div className="tb-th-inner">
                    <input
                      className="tb-col-input"
                      value={col}
                      placeholder={`Column ${ci + 1}`}
                      onChange={(e) => setCol(ci, e.target.value)}
                    />
                    {state.cols.length > 1 && (
                      <button className="tb-rm-btn" onClick={() => removeCol(ci)} title="Remove column">×</button>
                    )}
                  </div>
                </th>
              ))}
              <th className="tb-add-col-th">
                <button className="btn ghost small" onClick={addCol}>+ Col</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {state.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>
                    <input
                      className="tb-cell-input"
                      value={cell}
                      onChange={(e) => setCell(ri, ci, e.target.value)}
                    />
                  </td>
                ))}
                <td className="tb-rm-row-td">
                  <button className="tb-rm-btn" onClick={() => removeRow(ri)} title="Remove row">−</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn ghost small" style={{ marginTop: 8 }} onClick={addRow}>+ Add Row</button>
    </div>
  );
}

function tableToCSV(s: TableState): string {
  return [s.cols, ...s.rows]
    .map((row) => row.map((c) => (c.includes(",") ? `"${c}"` : c)).join(","))
    .join("\n");
}

function parseCSV(text: string): TableState | null {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 1) return null;
  const split = (line: string) =>
    line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const [header, ...rows] = lines;
  return { cols: split(header), rows: rows.map(split) };
}

function TableBuilderWithUpload({
  state, onChange,
}: {
  state: TableState; onChange: (s: TableState) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV((ev.target?.result as string) ?? "");
      if (parsed) { onChange(parsed); setFileName(file.name); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div>
      <div className="file-upload-zone compact" onClick={() => fileRef.current?.click()} style={{ marginBottom: 10 }}>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleCSV} />
        <span>📂 {fileName ? `Loaded: ${fileName}` : "Upload a .csv file to auto-fill the table"}</span>
      </div>
      <TableBuilder state={state} onChange={onChange} />
    </div>
  );
}

// ── KV Builder ───────────────────────────────────────────────────

function KVBuilder({ pairs, onChange }: { pairs: KVPair[]; onChange: (p: KVPair[]) => void }) {
  const add    = () => onChange([...pairs, { k: "", v: "" }]);
  const remove = (i: number) => onChange(pairs.filter((_, j) => j !== i));
  const set    = (i: number, field: "k" | "v", val: string) =>
    onChange(pairs.map((p, j) => (j === i ? { ...p, [field]: val } : p)));

  return (
    <div className="kv-builder">
      <div className="kv-header-row">
        <span className="kv-col-label">Key</span>
        <span className="kv-col-label">Value</span>
      </div>
      {pairs.map((p, i) => (
        <div key={i} className="kv-row">
          <input className="kv-key" value={p.k} placeholder="field_name" onChange={(e) => set(i, "k", e.target.value)} />
          <span className="kv-colon">:</span>
          <input className="kv-val" value={p.v} placeholder="value" onChange={(e) => set(i, "v", e.target.value)} />
          <button className="tb-rm-btn" onClick={() => remove(i)} title="Remove">×</button>
        </div>
      ))}
      <button className="btn ghost small" style={{ marginTop: 8 }} onClick={add}>+ Add field</button>
    </div>
  );
}

function kvToJSON(pairs: KVPair[]): string {
  const obj: Record<string, unknown> = {};
  for (const p of pairs) {
    if (!p.k.trim()) continue;
    const v = p.v.trim();
    if      (v === "true")              obj[p.k.trim()] = true;
    else if (v === "false")             obj[p.k.trim()] = false;
    else if (/^-?\d+(\.\d+)?$/.test(v)) obj[p.k.trim()] = Number(v);
    else                                obj[p.k.trim()] = v;
  }
  return JSON.stringify(obj, null, 2);
}

function jsonToPairs(text: string): KVPair[] | null {
  try {
    const obj = JSON.parse(text);
    if (typeof obj !== "object" || Array.isArray(obj) || obj === null) return null;
    return Object.entries(obj).map(([k, v]) => ({
      k,
      v: typeof v === "object" ? JSON.stringify(v) : String(v),
    }));
  } catch {
    return null;
  }
}

function KVBuilderWithUpload({
  pairs, onChange,
}: {
  pairs: KVPair[]; onChange: (p: KVPair[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = jsonToPairs((ev.target?.result as string) ?? "");
      if (parsed) { onChange(parsed); setFileName(file.name); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div>
      <div className="file-upload-zone compact" onClick={() => fileRef.current?.click()} style={{ marginBottom: 10 }}>
        <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleJSON} />
        <span>📂 {fileName ? `Loaded: ${fileName}` : "Upload a .json file to auto-fill the fields"}</span>
      </div>
      <KVBuilder pairs={pairs} onChange={onChange} />
    </div>
  );
}

// ── File + Text Input ────────────────────────────────────────────

function FileTextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fileRef  = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { onChange((ev.target?.result as string) ?? ""); setFileName(file.name); };
    reader.readAsText(file);
  };

  return (
    <div className="file-text-input">
      <div className="file-upload-zone" onClick={() => fileRef.current?.click()}>
        <input ref={fileRef} type="file" accept=".txt,.md" style={{ display: "none" }} onChange={handleFile} />
        <span>📄 {fileName ? `Loaded: ${fileName}` : "Click to upload a .txt or .md file"}</span>
      </div>
      <div className="file-or-divider">— or paste text below —</div>
      <textarea
        value={value}
        onChange={(e) => { onChange(e.target.value); setFileName(null); }}
        rows={8}
        placeholder={"Paste the full document text here.\n\nExample:\n  REMOTE WORK POLICY\n  1. ELIGIBILITY\n     All full-time employees who have completed their 90-day probation…"}
      />
    </div>
  );
}

// ── Form state helpers ───────────────────────────────────────────

type AddForm = {
  title: string;
  content: string;
  table: TableState;
  pairs: KVPair[];
};

function initForm(cat: CatConfig): AddForm {
  return {
    title:   "",
    content: cat.template ?? "",
    table:   cat.initialTable ? deepCloneTable(cat.initialTable) : { cols: ["Column 1", "Column 2"], rows: [["", ""]] },
    pairs:   cat.initialPairs ? cat.initialPairs.map((p) => ({ ...p })) : [{ k: "", v: "" }],
  };
}

function buildContent(cat: CatConfig, form: AddForm): string {
  if (cat.inputMode === "table")   return tableToCSV(form.table);
  if (cat.inputMode === "kv_json") return kvToJSON(form.pairs);
  return form.content;
}

// ── Main Component ───────────────────────────────────────────────

export default function KBPage({ token, email, isAdmin, onBack, onGoChat, onLogout }: Props) {
  const [docs, setDocs]       = useState<KBDoc[]>([]);
  const [active, setActive]   = useState<string | null>(null);
  const [adding, setAdding]   = useState(false);
  const [addForm, setAddForm] = useState<AddForm | null>(null);
  const [addErr, setAddErr]   = useState<string | null>(null);
  const [editId, setEditId]   = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; content: string }>({ title: "", content: "" });
  const [editErr, setEditErr] = useState<string | null>(null);
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  const reload = async () => {
    try {
      setDocs(isAdmin ? await listDocs(token) : await kbListDocs(token));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => { reload().catch(() => {}); }, []); // eslint-disable-line

  const docsFor = (cat: string) => docs.filter((d) => d.category === cat);

  const openCat = (id: string) => {
    if (active === id) { setActive(null); setAdding(false); setEditId(null); return; }
    const cat = catById(id);
    setActive(id); setAdding(false); setAddForm(initForm(cat));
    setAddErr(null); setEditId(null); setEditErr(null); setErr(null);
  };

  const startAdd = (id: string) => {
    setAdding(true); setEditId(null); setAddErr(null);
    setAddForm(initForm(catById(id)));
  };

  const cancelAdd = () => { setAdding(false); setAddErr(null); };

  const saveAdd = async (catId: string) => {
    if (!addForm || !addForm.title.trim()) return;
    const cat = catById(catId);
    const content = buildContent(cat, addForm);
    const fmtErr = cat.validate(content);
    if (fmtErr) { setAddErr(fmtErr); return; }
    setAddErr(null); setBusy(true); setErr(null);
    try {
      if (isAdmin) await createDoc(token, catId, addForm.title.trim(), content);
      else         await kbCreateDoc(token, catId, addForm.title.trim(), content);
      setAdding(false); setAddForm(null);
      await reload();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const startEdit = (d: KBDoc) => {
    setEditId(d.id);
    setEditForm({ title: d.title, content: d.content });
    setEditErr(null); setAdding(false);
  };

  const saveEdit = async (id: number, catId: string) => {
    if (!editForm.title.trim() || !editForm.content.trim()) return;
    const fmtErr = catById(catId).validate(editForm.content);
    if (fmtErr) { setEditErr(fmtErr); return; }
    setEditErr(null); setBusy(true); setErr(null);
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
    try {
      if (isAdmin) await deleteDoc(token, id);
      else         await kbDeleteDoc(token, id);
      await reload();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
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
            <span style={{ display: "block", fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>
              {isAdmin ? "Admin Portal" : "Knowledge Base"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="badge">{email}</span>
          {isAdmin && <span className="badge role">admin</span>}
          <button className="btn ghost" onClick={onBack}>← Dashboard</button>
          <button className="btn ghost" onClick={onGoChat}>Chat</button>
          <button className="btn ghost" onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div className="admin-wrap">
        <div className="db2-section-hd" style={{ marginBottom: 6 }}>Knowledge Base</div>
        <p className="auth-sub" style={{ marginTop: 0, marginBottom: 20 }}>
          {isAdmin
            ? "Manage the documents the chatbot answers from. You can add, edit, and delete any entry."
            : "Browse all entries the chatbot uses. You can add new entries and delete your own contributions."}
        </p>

        {err && <div className="error" style={{ marginBottom: 14 }}>⚠ {err}</div>}

        <div className="ap-cat-list">
          {CATEGORIES.map((cat) => {
            const catDocs = docsFor(cat.id);
            const isOpen  = active === cat.id;
            return (
              <div key={cat.id} className={`ap-cat-block electric-card ${isOpen ? "ap-open" : ""}`}>

                <div className="ap-cat-hd" onClick={() => openCat(cat.id)} role="button">
                  <span className="ap-cat-icon">{cat.icon}</span>
                  <span className="ap-cat-label">{cat.label}</span>
                  <span className={`ap-fmt-badge ${cat.formatColor}`}>{cat.formatTag}</span>
                  <span className="ap-cat-count">{catDocs.length} {catDocs.length === 1 ? "entry" : "entries"}</span>
                  <span className="ap-cat-chevron">{isOpen ? "▲" : "▼"}</span>
                </div>

                {isOpen && (
                  <div className="ap-cat-body">

                    <div className="ap-fmt-hint">
                      <span className={`ap-fmt-badge ${cat.formatColor}`}>{cat.formatTag}</span>
                      <span>{cat.hint}</span>
                    </div>

                    {catDocs.length === 0 && !adding && (
                      <p className="auth-sub" style={{ margin: "8px 0 12px" }}>No entries yet — add the first one below.</p>
                    )}

                    {catDocs.map((d) => {
                      const canEdit   = isAdmin;
                      const canDelete = isAdmin || d.created_by === email;
                      const isMine    = d.created_by === email;
                      return (
                        <div
                          key={d.id}
                          className={`ap-entry ${editId === d.id ? "ap-entry-editing" : ""} ${!isAdmin && isMine ? "ap-entry-mine" : ""}`}
                        >
                          {editId === d.id ? (
                            <>
                              <div className="form-group" style={{ marginBottom: 8 }}>
                                <label>Title</label>
                                <input
                                  value={editForm.title}
                                  onChange={(e) => { setEditForm({ ...editForm, title: e.target.value }); setEditErr(null); }}
                                  autoFocus
                                />
                              </div>
                              <div className="form-group" style={{ marginBottom: 4 }}>
                                <label>
                                  Content
                                  <span className={`ap-fmt-badge ${cat.formatColor}`} style={{ marginLeft: 6 }}>{cat.formatTag}</span>
                                </label>
                                <textarea
                                  value={editForm.content}
                                  onChange={(e) => { setEditForm({ ...editForm, content: e.target.value }); setEditErr(null); }}
                                  rows={8}
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
                                <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                                  <span className={`ap-fmt-badge ${cat.formatColor}`}>{cat.formatTag}</span>
                                  {!isAdmin && isMine && <span className="ap-mine-badge">yours</span>}
                                </div>
                              </div>
                              <div className="ap-entry-content">{d.content}</div>
                              {!isAdmin && (
                                <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
                                  Added by {d.created_by}
                                </div>
                              )}
                              {(canEdit || canDelete) && (
                                <div className="admin-doc-row" style={{ marginTop: 10 }}>
                                  {canEdit   && <button className="btn ghost small" onClick={() => startEdit(d)}>Edit</button>}
                                  {canDelete && <button className="btn ghost small danger" disabled={busy} onClick={() => remove(d.id)}>Delete</button>}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}

                    {/* ── Add Form ── */}
                    {adding && addForm ? (
                      <div className="ap-add-form electric-card" style={{ marginTop: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                          <span className="db2-section-hd" style={{ margin: 0 }}>New {cat.label} entry</span>
                          <span className={`ap-fmt-badge ${cat.formatColor}`}>{cat.formatTag}</span>
                        </div>

                        <div className="form-group" style={{ marginBottom: 12 }}>
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

                          {cat.inputMode === "table" && (
                            <TableBuilderWithUpload
                              state={addForm.table}
                              onChange={(t) => { setAddForm({ ...addForm, table: t }); setAddErr(null); }}
                            />
                          )}
                          {cat.inputMode === "kv_json" && (
                            <KVBuilderWithUpload
                              pairs={addForm.pairs}
                              onChange={(p) => { setAddForm({ ...addForm, pairs: p }); setAddErr(null); }}
                            />
                          )}
                          {cat.inputMode === "file_text" && (
                            <FileTextInput
                              value={addForm.content}
                              onChange={(v) => { setAddForm({ ...addForm, content: v }); setAddErr(null); }}
                            />
                          )}
                        </div>

                        {addErr && <div className="ap-validation-err">⚠ {addErr}</div>}

                        <div className="admin-actions" style={{ marginTop: 12 }}>
                          <button
                            className="btn"
                            disabled={busy || !addForm.title.trim()}
                            onClick={() => saveAdd(cat.id)}
                          >
                            {busy ? "Saving…" : "⚡ Add entry"}
                          </button>
                          <button className="btn ghost" disabled={busy} onClick={cancelAdd}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      !editId && (
                        <button className="ap-add-btn" onClick={() => startAdd(cat.id)}>
                          + Add {cat.formatTag} entry
                        </button>
                      )
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
