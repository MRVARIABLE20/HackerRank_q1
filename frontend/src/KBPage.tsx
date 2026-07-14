import { useEffect, useRef, useState } from "react";
import {
  createDoc, deleteDoc, listDocs, updateDoc,
  kbCreateDoc, kbDeleteDoc, kbListDocs, uploadVideoDoc,
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
  accept?: string; // for file_text inputMode only
  validate: (content: string) => string | null;
};

// Sentinel set here (before CATEGORIES) so textLen can reference it.
// Duplicate const below (inside FileTextInput area) is removed.
const VIDEO_PENDING = "__VIDEO_PENDING__";

// Video extensions — only Multimodal RAG accepts video uploads.
// Videos go to /uploads/video and are saved into seeding_data/13_multimodal_rag/.
const VIDEO_ACCEPT = ".mp4,.webm,.mov";

// Validator that skips the length check when a video is pending (no text to measure)
const textLen = (min: number) =>
  (c: string) => c === VIDEO_PENDING || c.trim().length >= min ? null : `Content too short (min ${min} chars).`;

const CATEGORIES: CatConfig[] = [
  {
    id: "01 Naive RAG", icon: "⚡", label: "01 — Naive RAG",
    formatTag: "PROSE", formatColor: "fmt-prose", inputMode: "file_text",
    accept: ".txt,.pdf,.md",
    titlePlaceholder: "e.g. Constitution of India, BNS Legal Document",
    hint: "Plain-text documents for vector cosine similarity search. PDFs, legal texts, policies, and long-form articles.",
    validate: textLen(40),
  },
  {
    id: "02 BM25 RAG", icon: "🔍", label: "02 — BM25 RAG",
    formatTag: "TABLE", formatColor: "fmt-table", inputMode: "file_text",
    accept: ".txt,.csv,.json",
    titlePlaceholder: "e.g. IMDB Movies Dataset, CISA Cybersecurity Records",
    hint: "Structured tabular datasets for keyword-frequency (BM25 Okapi) search. Upload a CSV, JSON dataset, or keyword-dense text file.",
    validate: textLen(10),
  },
  {
    id: "03 Hybrid RAG", icon: "🔀", label: "03 — Hybrid RAG",
    formatTag: "MIXED", formatColor: "fmt-json", inputMode: "file_text",
    accept: ".txt,.csv,.json",
    titlePlaceholder: "e.g. Incident Reports 2026, IT Support Tickets",
    hint: "Incident logs, support tickets, security alerts — mixed-format operational content for BM25 + vector fusion.",
    validate: textLen(40),
  },
  {
    id: "04 Self-RAG", icon: "🪞", label: "04 — Self-RAG",
    formatTag: "RESEARCH", formatColor: "fmt-tech", inputMode: "file_text",
    accept: ".txt,.pdf,.md",
    titlePlaceholder: "e.g. AI/ML Research Notes, Technical Deep Dives",
    hint: "Research papers and technical knowledge articles. Self-RAG scores each retrieved doc for relevance before answering.",
    validate: textLen(40),
  },
  {
    id: "05 Corrective RAG", icon: "✅", label: "05 — Corrective RAG",
    formatTag: "VERIFY", formatColor: "fmt-compliance", inputMode: "file_text",
    accept: ".txt,.pdf,.md",
    titlePlaceholder: "e.g. Company Policies, Authoritative Compliance Docs",
    hint: "Authoritative source-of-truth documents. Corrective RAG grades KB quality and falls back to web search if needed.",
    validate: textLen(40),
  },
  {
    id: "06 Graph RAG", icon: "🕸️", label: "06 — Graph RAG",
    formatTag: "ENTITY", formatColor: "fmt-ops", inputMode: "file_text",
    accept: ".txt,.md,.pdf",
    titlePlaceholder: "e.g. Organisation Charts, Entity-Relationship Docs",
    hint: "Entity-rich documents with named relationships. Graph RAG extracts entities and traverses connections across hops.",
    validate: textLen(40),
  },
  {
    id: "07 Speculative RAG", icon: "💭", label: "07 — Speculative RAG",
    formatTag: "DRAFT", formatColor: "fmt-prose", inputMode: "file_text",
    accept: ".txt,.pdf,.md",
    titlePlaceholder: "e.g. Strategy Memos, Decision Documents",
    hint: "Documents for fast-draft verification. Speculative RAG writes a draft answer then verifies it against full context.",
    validate: textLen(40),
  },
  {
    id: "08 RAG-Fusion", icon: "🌀", label: "08 — RAG-Fusion",
    formatTag: "FUSION", formatColor: "fmt-table", inputMode: "file_text",
    accept: ".txt,.pdf,.md",
    titlePlaceholder: "e.g. Multi-perspective Analysis Reports",
    hint: "Diverse documents covering multiple angles on a topic. RAG-Fusion generates parallel sub-queries for richer retrieval.",
    validate: textLen(40),
  },
  {
    id: "09 Adaptive RAG", icon: "🎯", label: "09 — Adaptive RAG",
    formatTag: "CORPUS", formatColor: "fmt-tech", inputMode: "file_text",
    accept: ".txt,.pdf,.csv,.md,.json",
    titlePlaceholder: "e.g. Diverse Knowledge Corpus, General FAQ Docs",
    hint: "General-purpose knowledge corpus. Adaptive RAG classifies query complexity and routes to the right sub-strategy.",
    validate: textLen(40),
  },
  {
    id: "10 Agentic RAG", icon: "🤖", label: "10 — Agentic RAG",
    formatTag: "AGENT", formatColor: "fmt-json", inputMode: "file_text",
    accept: ".txt,.pdf,.csv,.json",
    titlePlaceholder: "e.g. Engineering Runbooks, SLA Agreements, FAQs",
    hint: "Runbooks, SLA docs, and tool-accessible knowledge. Agentic RAG runs a multi-step ReAct loop to compose an answer.",
    validate: textLen(40),
  },
  {
    id: "11 Multi-hop RAG", icon: "🪜", label: "11 — Multi-hop RAG",
    formatTag: "CHAIN", formatColor: "fmt-compliance", inputMode: "file_text",
    accept: ".txt,.pdf,.md",
    titlePlaceholder: "e.g. Cross-referenced Reports, Linked Knowledge Docs",
    hint: "Documents that reference each other. Multi-hop RAG chains retrieval across hops to build a complete answer.",
    validate: textLen(40),
  },
  {
    id: "12 SQL RAG", icon: "🗄️", label: "12 — SQL RAG",
    formatTag: "SQL", formatColor: "fmt-table", inputMode: "table",
    accept: ".csv,.tsv,.txt",
    titlePlaceholder: "e.g. Sales Data Q1, Customer Records",
    initialTable: {
      cols: ["ID", "Name", "Category", "Value", "Date"],
      rows: [["1", "", "", "", ""]],
    },
    hint: "Structured CSV data loaded into DuckDB. SQL RAG generates and runs SQL queries against your table. Upload a CSV or build the table manually.",
    validate: (c) => c.trim().split("\n").filter(Boolean).length < 2 ? "Add at least one data row." : null,
  },
  {
    id: "13 Multimodal RAG", icon: "🖼️", label: "13 — Multimodal RAG",
    formatTag: "VISUAL", formatColor: "fmt-ops", inputMode: "file_text",
    accept: `.pdf,.txt,.png,.jpg,${VIDEO_ACCEPT}`,
    titlePlaceholder: "e.g. Chart PDFs, Diagram Descriptions, Demo Videos",
    hint: "PDFs, images, and videos with visual content. Multimodal RAG retrieves and describes visual context in answers.",
    validate: textLen(40),
  },
  {
    id: "14 Modular RAG", icon: "🧩", label: "14 — Modular RAG",
    formatTag: "MODULE", formatColor: "fmt-tech", inputMode: "file_text",
    accept: ".txt,.pdf,.csv,.json",
    titlePlaceholder: "e.g. Mixed-format Documents, Any Knowledge Content",
    hint: "Any-format documents. Modular RAG classifies query type (numerical, visual, relational…) and routes accordingly.",
    validate: textLen(40),
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

// ── Format-aware content renderer ────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8001";
const PDF_REF_PREFIX   = "__PDF__:";
const VIDEO_REF_PREFIX = "__VIDEO__:";   // all videos (seeded + uploaded) served from /seed-files/

function ContentView({ content, cat }: { content: string; cat: CatConfig }) {
  // ── Video (uploaded): data:video/...;base64,... — fully stored in the DB ──
  if (content.startsWith("data:video/")) {
    return (
      <video controls width="100%" src={content}
        style={{ marginTop: 8, borderRadius: 6, maxHeight: 380, display: "block",
                 border: "1px solid var(--border)", background: "#000" }} />
    );
  }

  // ── Video (legacy/seeded): __VIDEO__:folder/file.mp4 — served via /seed-files/ ──
  if (content.startsWith(VIDEO_REF_PREFIX)) {
    const filePath = content.slice(VIDEO_REF_PREFIX.length).split("\n")[0].trim();
    const src  = `${API_BASE}/seed-files/${filePath}`;
    const ext  = filePath.split(".").pop()?.toLowerCase() ?? "mp4";
    const mime = ext === "webm" ? "video/webm" : ext === "ogv" ? "video/ogg" : "video/mp4";
    return (
      <video controls width="100%" crossOrigin="anonymous"
        style={{ marginTop: 8, borderRadius: 6, maxHeight: 380, display: "block",
                 border: "1px solid var(--border)", background: "#000" }}>
        <source src={src} type={mime} />
      </video>
    );
  }

  // ── PDF: file-ref prefix → embedded viewer + text excerpt ──────
  if (content.startsWith(PDF_REF_PREFIX)) {
    const nlIdx   = content.indexOf("\n");
    const filePath = content.slice(PDF_REF_PREFIX.length, nlIdx).trim();
    const excerpt  = content.slice(nlIdx + 2, nlIdx + 402); // ~400 chars preview
    const src      = `${API_BASE}/seed-files/${filePath}`;
    return (
      <div>
        <iframe
          src={src}
          width="100%"
          height="420"
          style={{ border: "1px solid var(--border)", borderRadius: 6,
                   marginTop: 8, display: "block" }}
          title={filePath}
        />
        {excerpt && (
          <div className="ap-entry-content" style={{ marginTop: 6 }}>
            {excerpt}{content.length > nlIdx + 402 ? "…" : ""}
          </div>
        )}
      </div>
    );
  }

  // ── Image: base64 data URL ──────────────────────────────────────
  if (content.startsWith("data:image/")) {
    return (
      <img
        src={content}
        alt={cat.label}
        style={{ maxWidth: "100%", maxHeight: 320, objectFit: "contain",
                 borderRadius: 6, marginTop: 6, display: "block" }}
      />
    );
  }

  // ── CSV / TSV: table preview ────────────────────────────────────
  const firstLine = content.split("\n")[0] ?? "";
  const looksLikeCSV = (cat.inputMode === "table" ||
    (content.includes("\n") && firstLine.includes(",") && !content.trim().startsWith("{")));
  if (looksLikeCSV) {
    const table = parseCSV(content);
    if (table && table.cols.length > 1) {
      return (
        <div className="ap-csv-preview">
          <table className="ap-csv-table">
            <thead><tr>{table.cols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
            <tbody>
              {table.rows.slice(0, 6).map((row, ri) => (
                <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
          {table.rows.length > 6 && (
            <div className="ap-csv-more">+{table.rows.length - 6} more rows</div>
          )}
        </div>
      );
    }
  }

  // ── JSON: pretty-printed block ──────────────────────────────────
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let jsonPreview: string | null = null;
    try {
      const pretty = JSON.stringify(JSON.parse(trimmed), null, 2);
      jsonPreview = pretty.length > 800 ? pretty.slice(0, 800) + "\n…" : pretty;
    } catch { /* not valid JSON — fall through */ }
    if (jsonPreview !== null) {
      return <pre className="ap-json-pre">{jsonPreview}</pre>;
    }
  }

  // ── Plain text (TXT / MD) ───────────────────────────────────────
  const preview = content.length > 600 ? content.slice(0, 600) + "…" : content;
  return <div className="ap-entry-content">{preview}</div>;
}

// ── File + Text Input ────────────────────────────────────────────

// Extensions that must be read as binary (data URL) rather than text
const BINARY_EXTS = new Set([".png", ".jpg", ".jpeg", ".pdf"]);
// Video extensions — kept as File objects, not read into memory
const VIDEO_EXTS  = new Set([".mp4", ".webm", ".ogv", ".ogg", ".mov"]);

// VIDEO_PENDING is defined above before CATEGORIES — used here too

function FileTextInput({
  value, onChange, accept = ".txt,.md", onVideoFile,
}: {
  value: string;
  onChange: (v: string) => void;
  accept?: string;
  onVideoFile?: (f: File | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName]   = useState<string | null>(null);
  const [videoObjUrl, setVideoObjUrl] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();

    if (VIDEO_EXTS.has(ext)) {
      // Don't read into memory — keep File reference for FormData upload
      if (videoObjUrl) URL.revokeObjectURL(videoObjUrl);
      const objUrl = URL.createObjectURL(file);
      setVideoObjUrl(objUrl);
      setFileName(file.name);
      onChange(VIDEO_PENDING);
      onVideoFile?.(file);
      e.target.value = "";
      return;
    }

    // Clean up any previous video selection
    if (videoObjUrl) { URL.revokeObjectURL(videoObjUrl); setVideoObjUrl(null); onVideoFile?.(null); }

    const reader = new FileReader();
    reader.onload = (ev) => { onChange((ev.target?.result as string) ?? ""); setFileName(file.name); };
    if (BINARY_EXTS.has(ext)) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
    e.target.value = "";
  };

  const acceptLabel = accept.replace(/,/g, ", ");
  const isVideo  = value === VIDEO_PENDING;
  const isImage  = value.startsWith("data:image/");
  const isPDF    = value.startsWith("data:application/pdf");
  const isBinary = isVideo || isImage || isPDF;

  return (
    <div className="file-text-input">
      <div className="file-upload-zone" onClick={() => fileRef.current?.click()}>
        <input ref={fileRef} type="file" accept={accept} style={{ display: "none" }} onChange={handleFile} />
        <span>📄 {fileName ? `Loaded: ${fileName}` : `Click to upload a ${acceptLabel} file`}</span>
      </div>
      {isVideo && videoObjUrl && (
        <video controls width="100%"
          style={{ marginTop: 10, borderRadius: 6, border: "1px solid var(--border)", maxHeight: 300 }}>
          <source src={videoObjUrl} />
        </video>
      )}
      {isImage && (
        <div style={{ marginTop: 10 }}>
          <img src={value} alt="Preview" style={{ maxWidth: "100%", maxHeight: 260,
            objectFit: "contain", borderRadius: 6, border: "1px solid var(--border)", display: "block" }} />
        </div>
      )}
      {isPDF && (
        <iframe src={value} width="100%" height="340"
          style={{ marginTop: 10, border: "1px solid var(--border)", borderRadius: 6 }} title="PDF preview" />
      )}
      {!isBinary && (
        <>
          <div className="file-or-divider">— or paste text below —</div>
          <textarea
            value={value}
            onChange={(e) => { onChange(e.target.value); setFileName(null); }}
            rows={8}
            placeholder={"Paste the full document text here.\n\nExample:\n  REMOTE WORK POLICY\n  1. ELIGIBILITY\n     All full-time employees who have completed their 90-day probation…"}
          />
        </>
      )}
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
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
  // True only for the very first load — avoids showing "0 docs" on every
  // category before the real counts have arrived from the server.
  const [loading, setLoading] = useState(true);
  // Category currently being hydrated with full content (see loadCategoryFull).
  const [hydratingCat, setHydratingCat] = useState<string | null>(null);

  // The "list every category" call the overview needs (for counts + title
  // chips) truncates video/image content server-side to keep it fast — a
  // single video can otherwise balloon that response to tens of MB. Opening
  // a category's accordion fetches FULL content for just that one category
  // and merges it in, so only the section actually being viewed pays for it.
  const loadCategoryFull = async (categoryId: string) => {
    setHydratingCat(categoryId);
    try {
      const full = isAdmin ? await listDocs(token, categoryId) : await kbListDocs(token, categoryId);
      setDocs(prev => [...prev.filter(d => d.category !== categoryId), ...full]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setHydratingCat(null);
    }
  };

  const reload = async () => {
    try {
      setDocs(isAdmin ? await listDocs(token) : await kbListDocs(token));
      // Re-hydrate the currently open category — the fetch above just reset
      // it back to truncated content, but the user may still be looking at it.
      if (active) await loadCategoryFull(active);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload().catch(() => {}); }, []); // eslint-disable-line

  const docsFor = (cat: string) => docs.filter((d) => d.category === cat);

  const openCat = (id: string) => {
    if (active === id) { setActive(null); setAdding(false); setEditId(null); return; }
    const cat = catById(id);
    setActive(id); setAdding(false); setAddForm(initForm(cat));
    setAddErr(null); setEditId(null); setEditErr(null); setErr(null);
    loadCategoryFull(id);
  };

  const startAdd = (id: string) => {
    setAdding(true); setEditId(null); setAddErr(null);
    setAddForm(initForm(catById(id)));
  };

  const cancelAdd = () => { setAdding(false); setAddErr(null); setPendingVideoFile(null); };

  const saveAdd = async (catId: string) => {
    if (!addForm || !addForm.title.trim()) return;
    const cat = catById(catId);
    const content = buildContent(cat, addForm);

    // Video upload: multipart POST, no JSON body
    if (content === VIDEO_PENDING && pendingVideoFile) {
      setAddErr(null); setBusy(true); setErr(null);
      try {
        await uploadVideoDoc(token, catId, addForm.title.trim(), pendingVideoFile);
        setAdding(false); setAddForm(null); setPendingVideoFile(null);
        await reload();
      } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
      finally { setBusy(false); }
      return;
    }

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
          <img src="/logo.png" alt="RAG Atlas" className="db2-logo-bolt" />
          <div>
            <span style={{ fontWeight: 800 }}>RAG Atlas</span>
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

                <div className="ap-cat-hd" onClick={() => !loading && openCat(cat.id)} role="button">
                  <span className="ap-cat-icon">{cat.icon}</span>
                  <span className="ap-cat-label">{cat.label}</span>
                  <span className={`ap-fmt-badge ${cat.formatColor}`}>{cat.formatTag}</span>
                  {loading ? (
                    <span className="ap-cat-count ap-cat-count--skeleton" />
                  ) : (
                    <span className="ap-cat-count">{catDocs.length} {catDocs.length === 1 ? "doc" : "docs"}</span>
                  )}
                  <span className="ap-cat-chevron">{isOpen ? "▲" : "▼"}</span>
                </div>

                {/* Doc-title preview shown in collapsed state */}
                {loading ? (
                  <div className="ap-cat-doc-list">
                    <span className="ap-doc-chip ap-doc-chip--skeleton" />
                    <span className="ap-doc-chip ap-doc-chip--skeleton" />
                  </div>
                ) : (
                  !isOpen && catDocs.length > 0 && (
                    <div className="ap-cat-doc-list">
                      {catDocs.map(d => (
                        <span key={d.id} className={`ap-doc-chip ${cat.formatColor}`}>{d.title}</span>
                      ))}
                    </div>
                  )
                )}

                {isOpen && (
                  <div className="ap-cat-body">

                    <div className="ap-fmt-hint">
                      <span className={`ap-fmt-badge ${cat.formatColor}`}>{cat.formatTag}</span>
                      <span>{cat.hint}</span>
                      {cat.accept && (
                        <span className="ap-accept-chips">
                          {cat.accept.split(",").map(ext => (
                            <span key={ext} className="ap-accept-ext">{ext.replace(".", "").toUpperCase()}</span>
                          ))}
                        </span>
                      )}
                    </div>

                    {hydratingCat === cat.id ? (
                      // Full content (untruncated video/image included) is being
                      // fetched for this category — show a placeholder rather
                      // than the still-truncated entries from the overview call.
                      <div className="ap-entry ap-entry--skeleton" />
                    ) : (
                      <>
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
                              <ContentView content={d.content} cat={cat} />
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
                      </>
                    )}

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
                              accept={cat.accept}
                              onVideoFile={(f) => setPendingVideoFile(f)}
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
