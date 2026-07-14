import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { chat, fetchSuggestions, type ChatResponse, type Citation, type RouterDecision, type SelfRagDocScore, type SuggestionsResponse } from "./api";
import RagFlowCard from "./RagFlowCard";

type Msg  = { who: "user" | "bot"; text: string; data?: ChatResponse };
type Props = {
  token: string; email: string; roles: string[]; department: string;
  onLogout: () => void; onBack?: () => void;
};

// ── RAG strategy list ─────────────────────────────────────────
const RAG_STRATEGIES = [
  { value: "naive",       label: "Naive RAG",       num: "01", icon: "⚡", desc: "Vector cosine similarity search" },
  { value: "bm25",        label: "BM25 RAG",        num: "02", icon: "🔍", desc: "Keyword frequency scoring (Okapi)" },
  { value: "hybrid",      label: "Hybrid RAG",      num: "03", icon: "🔀", desc: "BM25 + Vector fused with RRF" },
  { value: "self_rag",    label: "Self-RAG",        num: "04", icon: "🪞", desc: "Reflect, score & filter docs" },
  { value: "corrective",  label: "Corrective RAG",  num: "05", icon: "✅", desc: "Grade KB quality + web fallback" },
  { value: "graph",       label: "Graph RAG",       num: "06", icon: "🕸️", desc: "Entity-relationship traversal" },
  { value: "speculative", label: "Speculative RAG", num: "07", icon: "💭", desc: "Draft fast, verify with full context" },
  { value: "rag_fusion",  label: "RAG-Fusion",      num: "08", icon: "🌀", desc: "Multi-query parallel sub-searches" },
  { value: "adaptive",    label: "Adaptive RAG",    num: "09", icon: "🎯", desc: "Auto-routes by query complexity" },
  { value: "agentic",     label: "Agentic RAG",     num: "10", icon: "🤖", desc: "ReAct loop with live tool-calling" },
  { value: "multihop",    label: "Multi-hop RAG",   num: "11", icon: "🪜", desc: "Chain reasoning across doc hops" },
  { value: "sql",         label: "SQL RAG",         num: "12", icon: "🗄️", desc: "DuckDB structured data queries" },
  { value: "multimodal",  label: "Multimodal RAG",  num: "13", icon: "🖼️", desc: "Visual + text document retrieval" },
  { value: "modular",     label: "Modular RAG",     num: "14", icon: "🧩", desc: "Detects query type, routes module" },
];

// ── Per-strategy processing steps ─────────────────────────────
const PROC_STEPS: Record<string, { label: string; detail: string }[]> = {
  naive: [
    { label: "Embedding query",          detail: "text-embedding-3-small via OpenRouter" },
    { label: "Cosine similarity search", detail: "Scanning KB vector store" },
    { label: "Ranking top-K docs",       detail: "K=6 sorted by score" },
    { label: "Building context prompt",  detail: "Injecting [doc:id] citation markers" },
    { label: "LLM completion",           detail: "gpt-4o-mini · generating answer" },
  ],
  bm25: [
    { label: "Tokenizing query",       detail: "Lowercase split into terms" },
    { label: "BM25Okapi scoring",      detail: "Term freq × Inverse doc freq" },
    { label: "Ranking & normalizing",  detail: "Scores mapped to [0, 1]" },
    { label: "Selecting top-K docs",   detail: "K=6 highest BM25 scores" },
    { label: "LLM completion",         detail: "gpt-4o-mini · generating answer" },
  ],
  hybrid: [
    { label: "BM25 keyword retrieval",  detail: "Top-10 candidates" },
    { label: "Vector cosine retrieval", detail: "Top-10 candidates" },
    { label: "RRF fusion",             detail: "1/(60 + rank + 1) merge" },
    { label: "Selecting unified top-K", detail: "Best of both methods" },
    { label: "LLM completion",          detail: "gpt-4o-mini · generating answer" },
  ],
  self_rag: [
    { label: "Retrieve decision",      detail: "LLM call 1: RETRIEVE or NO_RETRIEVE?" },
    { label: "Vector search",          detail: "Embedding + cosine top-6" },
    { label: "Scoring each doc",       detail: "isrel · issup · isuse (LLM call 2)" },
    { label: "Filtering docs",         detail: "Keep relevant & non-contradicted" },
    { label: "LLM completion",         detail: "gpt-4o-mini · generating answer" },
  ],
  corrective: [
    { label: "Vector search",          detail: "Retrieving top-K from KB" },
    { label: "Grading top document",   detail: "LLM: CORRECT / AMBIGUOUS / INCORRECT" },
    { label: "Web search (if needed)", detail: "Tavily live results" },
    { label: "Combining sources",      detail: "KB + web context merge" },
    { label: "LLM completion",         detail: "gpt-4o-mini · generating answer" },
  ],
  graph: [
    { label: "Extracting entities",     detail: "LLM: 2–3 key entities + relationship" },
    { label: "Hop 1 — entity search",   detail: "Vector search per entity" },
    { label: "Identifying next entity", detail: "LLM: follow-on entity from titles" },
    { label: "Hop 2 — follow-on search", detail: "Weighted score × 0.85" },
    { label: "LLM completion",          detail: "gpt-4o-mini · generating answer" },
  ],
  speculative: [
    { label: "Vector search",          detail: "Retrieving top-K docs" },
    { label: "Drafting answer",        detail: "LLM call 1: fast path, first doc only" },
    { label: "Verifying draft",        detail: "LLM call 2: vs full context" },
    { label: "Applying verdict",       detail: "CONFIRMED / CORRECTED / REJECTED" },
    { label: "LLM completion",         detail: "gpt-4o-mini · final answer" },
  ],
  rag_fusion: [
    { label: "Generating sub-queries",  detail: "LLM: 3 alternative phrasings" },
    { label: "Parallel vector search",  detail: "4 queries simultaneously" },
    { label: "RRF fusion",             detail: "Reciprocal Rank Fusion across all 4" },
    { label: "Selecting unified top-K", detail: "Best docs across all perspectives" },
    { label: "LLM completion",          detail: "gpt-4o-mini · generating answer" },
  ],
  adaptive: [
    { label: "Classifying complexity",  detail: "LLM: assigning class 0–4" },
    { label: "Routing strategy",        detail: "Direct / Naive / Hybrid / Multihop" },
    { label: "Executing pipeline",      detail: "Running selected strategy" },
    { label: "LLM completion",          detail: "gpt-4o-mini · generating answer" },
  ],
  agentic: [
    { label: "Initializing ReAct agent", detail: "Think · Act · Observe protocol" },
    { label: "Thinking",                 detail: "LLM reasoning about next action" },
    { label: "Tool execution",           detail: "kb_search / web_search / calculator" },
    { label: "Observing & looping",      detail: "Appending to history, max 8 iterations" },
    { label: "Synthesizing final answer", detail: "gpt-4o-mini · all context" },
  ],
  multihop: [
    { label: "Hop 1 — vector search",    detail: "Original query" },
    { label: "Sufficiency check",        detail: "LLM: is context enough?" },
    { label: "Follow-up query (if needed)", detail: "LLM generates next search" },
    { label: "Merging all hop results",  detail: "Deduplicated, highest scores" },
    { label: "LLM completion",           detail: "gpt-4o-mini · synthesizing answer" },
  ],
  sql: [
    { label: "Discovering CSV tables",  detail: "Globbing seeding_data/12_sql_rag/" },
    { label: "Building schema context", detail: "DESCRIBE: columns + row count" },
    { label: "Generating SQL query",    detail: "LLM: SELECT statement from schema" },
    { label: "Safety check",           detail: "Blocking DROP/DELETE/INSERT..." },
    { label: "Executing via DuckDB",    detail: "In-memory SQL engine" },
    { label: "LLM completion",          detail: "gpt-4o-mini · SQL → natural language" },
  ],
  multimodal: [
    { label: "Filtering visual docs",   detail: "Category '13' / multimodal tags" },
    { label: "Selecting search pool",   detail: "Visual only or full KB fallback" },
    { label: "Retrieval search",        detail: "Cosine similarity on pool" },
    { label: "Building visual context", detail: "Charts, diagrams, PDF extracts" },
    { label: "LLM completion",          detail: "gpt-4o-mini · visual-context prompt" },
  ],
  modular: [
    { label: "Classifying query type",    detail: "LLM: numerical/visual/relational/..." },
    { label: "Routing to module",         detail: "SQL / Multimodal / Graph / Hybrid" },
    { label: "Executing selected module", detail: "Full pipeline of routed strategy" },
    { label: "LLM completion",            detail: "gpt-4o-mini · generating answer" },
  ],
};


// ── Suggestion chips component ─────────────────────────────────
// `suggestions` is always passed from outside — start chips come from the
// backend (/kb/docs/suggestions), follow-up chips from the last answer's
// own `followup_questions` (contextual to what was just discussed).
function SuggestionChips({
  suggestions, type, onSelect, disabled, loading = false,
}: {
  suggestions: string[]; type: "start" | "followup";
  onSelect: (text: string) => void;
  disabled?: boolean; loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="suggestion-chips">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="suggestion-chip suggestion-chip--skeleton" />
        ))}
      </div>
    );
  }

  const chips = type === "start" ? suggestions : suggestions.slice(0, 3);

  if (chips.length === 0) return null;

  return (
    <div className={`suggestion-chips${type === "followup" ? " suggestion-chips--followup" : ""}`}>
      {type === "followup" && (
        <div className="suggestion-chips-label">Explore further</div>
      )}
      {chips.map((chip) => (
        <button
          key={chip}
          className="suggestion-chip"
          onClick={() => !disabled && onSelect(chip)}
          disabled={disabled}
          type="button"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

// ── Spectate panel (fixed overlay, rendered via portal) ───────
function SpectatePanel({
  strategyValue, activeStep, onEnter, onLeave,
}: {
  strategyValue: string; activeStep: number;
  onEnter: () => void; onLeave: () => void;
}) {
  const strategy = RAG_STRATEGIES.find(s => s.value === strategyValue) ?? RAG_STRATEGIES[0];
  const steps    = PROC_STEPS[strategyValue] ?? PROC_STEPS.naive;
  const curLabel = steps[Math.min(activeStep, steps.length - 1)]?.label ?? "";

  return createPortal(
    <motion.div
      className="spectate-panel"
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 60 }}
      transition={{ duration: 0.22, ease: [0.22, 0.68, 0, 1.1] }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* Panel header */}
      <div className="spectate-hd">
        <span className="spectate-eye">◈</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="spectate-pretitle">SPECTATING RAG FLOW</div>
          <div className="spectate-title">{strategy.label}</div>
          <motion.div
            key={activeStep}
            className="spectate-step"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {curLabel}
          </motion.div>
        </div>
        <span className="spectate-live">● LIVE</span>
      </div>

      {/* Full React Flow diagram */}
      <div className="spectate-flow-wrap">
        <RagFlowCard strategyValue={strategyValue} activeStep={activeStep} />
      </div>
    </motion.div>,
    document.body,
  );
}

// ── Compact processing card with hover-to-spectate ─────────────
function ProcessingCard({ strategyValue, activeStep }: {
  strategyValue: string; activeStep: number;
}) {
  const strategy  = RAG_STRATEGIES.find(s => s.value === strategyValue) ?? RAG_STRATEGIES[0];
  const steps     = PROC_STEPS[strategyValue] ?? PROC_STEPS.naive;
  const pct       = Math.round(((activeStep + 1) / steps.length) * 100);
  const [spec, setSpec] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => { if (timer.current) clearTimeout(timer.current); setSpec(true); };
  const hide = () => { timer.current = setTimeout(() => setSpec(false), 160); };

  return (
    <>
      <div
        className={`proc-card${spec ? " proc-card--spectating" : ""}`}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {/* Header */}
        <div className="proc-head">
          <span className="proc-icon">{strategy.icon}</span>
          <div className="proc-title-block">
            <span className="proc-title">{strategy.label}</span>
            <span className="proc-num">{strategy.num}</span>
          </div>
          <div style={{ flex: 1 }} />
          <span className="proc-pct">{pct}%</span>
          <div className="proc-running">
            <motion.div
              className="proc-spinner-ring"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
            />
            <span>Processing</span>
          </div>
        </div>

        {/* Step label + spectate hint */}
        <div className="proc-step-footer">
          <motion.span
            key={activeStep}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {steps[Math.min(activeStep, steps.length - 1)]?.label}
          </motion.span>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span className="proc-step-count">
              {Math.min(activeStep + 1, steps.length)}&thinsp;/&thinsp;{steps.length}
            </span>
            <span className="proc-spectate-hint">◈ hover to spectate</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="proc-bar-track">
          <motion.div
            className="proc-bar-fill"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />
        </div>
      </div>

      <AnimatePresence>
        {spec && (
          <SpectatePanel
            strategyValue={strategyValue}
            activeStep={activeStep}
            onEnter={show}
            onLeave={hide}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Strategy dropdown ─────────────────────────────────────────
function StrategyDropdown({ value, onChange, disabled }: {
  value: string; onChange: (v: string) => void; disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = RAG_STRATEGIES.find(s => s.value === value) ?? RAG_STRATEGIES[0];

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="rag-dropdown" ref={ref}>
      <button
        className={`rag-dd-trigger${open ? " open" : ""}`}
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        type="button"
      >
        <span className="rag-dd-icon">{selected.icon}</span>
        <span className="rag-dd-badge">{selected.num}</span>
        <span className="rag-dd-name">{selected.label}</span>
        <span className={`rag-dd-chevron${open ? " open" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="rag-dd-panel">
          <div className="rag-dd-header">Select RAG Strategy</div>
          <div className="rag-dd-list">
            {RAG_STRATEGIES.map(s => (
              <button
                key={s.value}
                className={`rag-dd-item${s.value === value ? " selected" : ""}`}
                onClick={() => { onChange(s.value); setOpen(false); }}
                title={s.desc}
                type="button"
              >
                <span className="rag-dd-item-icon">{s.icon}</span>
                <span className="rag-dd-item-badge">{s.num}</span>
                <span className="rag-dd-item-body">
                  <span className="rag-dd-item-name">{s.label}</span>
                  <span className="rag-dd-item-desc">{s.desc}</span>
                </span>
                {s.value === value && <span className="rag-dd-check">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Answer renderer ───────────────────────────────────────────
function renderAnswer(text: string, citations: Citation[]) {
  const map: Record<string, Citation> = {};
  for (const c of citations) map[c.page != null ? `${c.doc_id}:${c.page}` : c.doc_id] = c;
  const clean = text.replace(/["""]/g, "");
  return clean.split(/(\[[^\][]+])/g).map((p, i) => {
    const m = p.match(/^\[([^\]]+)\]$/);
    if (m) {
      const c = map[m[1].trim()] ?? map[m[1].trim().split(":")[0]] ?? null;
      return <span key={i} className="cite" title={c ? c.snippet : "(no match)"}>{p}</span>;
    }
    return <span key={i}>{p}</span>;
  });
}

function cc(c: number) { return c >= 0.75 ? "high" : c >= 0.5 ? "mid" : "low"; }
function Tag({ label, cls }: { label: string; cls?: string }) {
  return <span className={`tag ${cls ?? ""}`}>{label}</span>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="why-row">
      <span className="why-label">{label}</span>
      <span className="why-value">{children}</span>
    </div>
  );
}

// ── Strategy panel (side) ─────────────────────────────────────
function StrategyPanel({ rd }: { rd: RouterDecision }) {
  const s = rd.strategy;
  if (s === "self_rag") return (
    <>
      <h3>Self-RAG Reflection</h3>
      <div className="why-panel">
        <Row label="Retrieve?"><Tag label={rd.retrieve_decision ?? "—"} cls={rd.retrieve_decision === "NO_RETRIEVE" ? "low" : "high"} /></Row>
        {rd.retrieve_reason && <Row label="Reason"><span style={{fontSize:11}}>{rd.retrieve_reason}</span></Row>}
        <Row label="Docs scored">{rd.docs_scored ?? 0}</Row>
        <Row label="Docs passed">{rd.docs_passed ?? 0}</Row>
      </div>
      {rd.doc_scores && rd.doc_scores.length > 0 && (
        <>{<h3>Document Scores</h3>}
          {(rd.doc_scores as SelfRagDocScore[]).map((ds, i) => (
            <div className="cite-card" key={i}>
              <div className="meta"><b>doc:{ds.doc_id}</b><Tag label={ds.isrel} cls={ds.isrel === "relevant" ? "high" : "low"} /><Tag label={ds.issup} cls={ds.issup === "supported" ? "high" : ds.issup === "contradicted" ? "low" : "mid"} /><Tag label={`isuse ${ds.isuse}/5`} /><span>cos {ds.cos_score.toFixed(3)}</span></div>
              <div className="content" style={{fontSize:11}}>{ds.title}</div>
            </div>
          ))}
        </>
      )}
    </>
  );
  if (s === "corrective") return (
    <><h3>Corrective RAG</h3>
    <div className="why-panel">
      <Row label="KB grade"><Tag label={rd.grade ?? "—"} cls={rd.grade === "CORRECT" ? "high" : rd.grade === "INCORRECT" ? "low" : "mid"} /></Row>
      <Row label="Web search"><Tag label={rd.web_search_used ? "Used" : "Skipped"} cls={rd.web_search_used ? "high" : "mid"} /></Row>
      {rd.reason && <Row label="Reason"><span style={{fontSize:11}}>{rd.reason as string}</span></Row>}
    </div></>
  );
  if (s === "speculative") return (
    <><h3>Speculative RAG</h3>
    <div className="why-panel">
      <Row label="Verdict"><Tag label={rd.verdict ?? "—"} cls={rd.verdict === "CONFIRMED" ? "high" : rd.verdict === "REJECTED" ? "low" : "mid"} /></Row>
      {rd.draft_preview && <Row label="Draft preview"><span style={{fontSize:11}}>{rd.draft_preview}</span></Row>}
    </div></>
  );
  if (s === "rag_fusion") return (
    <><h3>RAG-Fusion Sub-queries</h3>
    <div className="why-panel">
      {(rd.sub_queries ?? []).map((q, i) => (
        <Row key={i} label={i === 0 ? "Original" : `Sub-query ${i}`}><span style={{fontSize:11}}>{q}</span></Row>
      ))}
      <Row label="Total candidates">{rd.total_candidates ?? 0}</Row>
    </div></>
  );
  if (s === "adaptive") return (
    <><h3>Adaptive Routing</h3>
    <div className="why-panel">
      <Row label="Complexity class"><Tag label={`Class ${rd.class}`} cls={["high","high","mid","mid","low"][rd.class ?? 2]} /></Row>
      <Row label="Routed to"><Tag label={rd.routed_to ?? "—"} /></Row>
      {rd.reason && <Row label="Reason"><span style={{fontSize:11}}>{rd.reason}</span></Row>}
    </div></>
  );
  if (s === "agentic") return (
    <><h3>Agentic ReAct Loop</h3>
    <div className="why-panel">
      <Row label="Iterations">{rd.iterations ?? 0}</Row>
      <Row label="Tools used">{(rd.tools_used ?? []).map((t,i) => <Tag key={i} label={t} />)}</Row>
    </div>
    {(rd.iteration_log ?? []).map((it, i) => (
      <div className="cite-card" key={i}>
        <div className="meta"><b>Step {it.step}</b><Tag label={it.action} cls={it.action === "FINAL_ANSWER" ? "high" : "mid"} /></div>
        {it.thought && <div className="content" style={{fontSize:11}}>💭 {it.thought}</div>}
        {it.input && <div className="content" style={{fontSize:11}}>→ {it.input}</div>}
      </div>
    ))}</>
  );
  if (s === "multihop") return (
    <><h3>Multi-hop Hops</h3>
    <div className="why-panel"><Row label="Total hops">{rd.hops ?? 0}</Row></div>
    {(rd.hop_log ?? []).map((h, i) => (
      <div className="cite-card" key={i}>
        <div className="meta"><b>Hop {h.hop}</b><Tag label={`${h.docs_found} docs`} /></div>
        <div className="content" style={{fontSize:11}}>{h.query}</div>
      </div>
    ))}</>
  );
  if (s === "graph") return (
    <><h3>Graph RAG</h3>
    <div className="why-panel">
      <Row label="Entities">{(rd.entities ?? []).map((e,i) => <Tag key={i} label={e} />)}</Row>
      {rd.relationship && <Row label="Relationship"><span style={{fontSize:11}}>{rd.relationship}</span></Row>}
      <Row label="Hops">{rd.hops ?? 0}</Row>
    </div></>
  );
  if (s === "sql") return (
    <><h3>SQL RAG</h3>
    <div className="why-panel">
      <Row label="Rows returned">{rd.rows_returned ?? 0}</Row>
      <Row label="Tables">{(rd.tables_available ?? []).map((t,i) => <Tag key={i} label={t} />)}</Row>
    </div>
    {rd.sql_query && <div className="why-panel" style={{marginTop:6}}><div style={{fontSize:11,fontFamily:"monospace",whiteSpace:"pre-wrap",wordBreak:"break-all"}}>{rd.sql_query}</div></div>}
    {rd.result_preview && <div className="why-panel" style={{marginTop:6}}><div style={{fontSize:10,fontFamily:"monospace",whiteSpace:"pre",overflowX:"auto"}}>{rd.result_preview}</div></div>}
    </>
  );
  if (s === "modular") return (
    <><h3>Modular Routing</h3>
    <div className="why-panel">
      <Row label="Query type"><Tag label={rd.detected_type ?? "—"} cls="mid" /></Row>
      <Row label="Routed to"><Tag label={rd.routed_to ?? "—"} /></Row>
      {rd.reason && <Row label="Reason"><span style={{fontSize:11}}>{rd.reason}</span></Row>}
    </div></>
  );
  return null;
}

// ── Warning popup modal ───────────────────────────────────────
function WarningModal({ msg, strategyValue, onDismiss }: {
  msg: string; strategyValue: string; onDismiss: () => void;
}) {
  const strat = RAG_STRATEGIES.find(s => s.value === strategyValue);
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
        className="warn-modal"
        initial={{ scale: 0.88, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.88, y: 16, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 26 }}
        onClick={e => e.stopPropagation()}
      >
        <span className="warn-modal-icon">⚠</span>
        <div className="warn-modal-title">Relevance Warning</div>
        <div className="warn-modal-body">{msg}</div>
        {strat && (
          <div className="warn-modal-hint">
            <strong>{strat.icon} {strat.label}</strong> — {strat.desc}
          </div>
        )}
        <button className="warn-modal-dismiss" onClick={onDismiss}>
          Got it
        </button>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

// Reads the one-shot handoff written by the Pipelines page — either a "Try
// Asking" chip (strategy + a pre-filled question) or the "Open Chat" button
// (strategy only, empty question) — so Chat lands on the strategy the user was
// viewing instead of always defaulting to Naive, without threading new props/routes.
function readPipelineHandoff(): { strategy?: string; question?: string } {
  try {
    const raw = sessionStorage.getItem("pip_try_question");
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

// ── Main chat ─────────────────────────────────────────────────
export default function Chat({ token, email, roles, department, onLogout, onBack }: Props) {
  const [input, setInput]         = useState(() => readPipelineHandoff().question ?? "");
  const [busy, setBusy]           = useState(false);
  const [msgs, setMsgs]           = useState<Msg[]>([]);
  const [last, setLast]           = useState<ChatResponse | null>(null);
  const [ragStrategy, setRagStrategy] = useState(() => readPipelineHandoff().strategy ?? "naive");
  const [procStep, setProcStep]   = useState(-1);   // -1 = hidden
  const [warningPopup, setWarningPopup] = useState<{ msg: string; strategy: string } | null>(null);
  const [docSuggestions, setDocSuggestions]     = useState<SuggestionsResponse>({ start: [], followup: [] });
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const endRef      = useRef<HTMLDivElement>(null);
  const msgsBoxRef  = useRef<HTMLDivElement>(null);

  // Consume the Pipelines-page handoff exactly once so a page refresh doesn't
  // keep re-filling the same question/strategy.
  useEffect(() => { sessionStorage.removeItem("pip_try_question"); }, []);

  // Fetch document-specific suggestions whenever the RAG strategy changes or after a reseed
  useEffect(() => {
    let cancelled = false;
    setSuggestionsLoading(true);
    fetchSuggestions(token, ragStrategy)
      .then(s  => { if (!cancelled) setDocSuggestions(s); })
      .catch(() => { if (!cancelled) setDocSuggestions({ start: [], followup: [] }); })
      .finally(() => { if (!cancelled) setSuggestionsLoading(false); });
    return () => { cancelled = true; };
  }, [token, ragStrategy]);

  // Scroll helper — rAF so DOM is painted, timeout so framer-motion's
  // AnimatePresence has finished mounting the ProcessingCard
  const scrollToBottom = (smooth = false) => {
    const go = () => {
      const box = msgsBoxRef.current;
      if (!box) return;
      if (smooth) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
      else         box.scrollTop = box.scrollHeight;
    };
    requestAnimationFrame(go);
    setTimeout(go, 120);
  };

  // New bot/user message → smooth scroll
  useEffect(() => { scrollToBottom(true); }, [msgs]);

  // Processing card appears or advances → instant scroll
  useEffect(() => {
    if (procStep >= 0) scrollToBottom(false);
  }, [procStep]);

  // Advance processing step while busy
  useEffect(() => {
    if (!busy || procStep < 0) return;
    const steps = PROC_STEPS[ragStrategy] ?? PROC_STEPS.naive;
    // Don't auto-advance past the second-to-last step (leave last for "done" reveal)
    if (procStep >= steps.length - 2) return;
    const id = setTimeout(() => setProcStep(s => s + 1), 950);
    return () => clearTimeout(id);
  }, [busy, procStep, ragStrategy]);

  const send = async (overrideText?: string) => {
    const q = (overrideText ?? input).trim();
    if (!q || busy) return;
    // Every question already asked this session — sent to the server so it never
    // offers a follow-up chip the user has already used (last ~50 kept small).
    const askedQuestions = msgs.filter(m => m.who === "user").map(m => m.text).slice(-50);
    setInput("");
    setMsgs(m => [...m, { who: "user", text: q }]);
    setBusy(true);
    setProcStep(0);

    try {
      const r = await chat(token, q, ragStrategy, askedQuestions);
      // Jump to last step to show "all done"
      const steps = PROC_STEPS[ragStrategy] ?? PROC_STEPS.naive;
      setProcStep(steps.length - 1);
      await new Promise(res => setTimeout(res, 600));
      setProcStep(-1);
      setMsgs(m => [...m, { who: "bot", text: r.answer, data: r }]);
      setLast(r);
      if (r.warning) setWarningPopup({ msg: r.warning, strategy: ragStrategy });
    } catch (e) {
      setProcStep(-1);
      setMsgs(m => [...m, { who: "bot", text: `Error: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setBusy(false);
    }
  };

  // Switching RAG strategy starts a fresh conversation: each strategy has its
  // own knowledge base, suggestions, and follow-ups, so carrying messages over
  // would mix answers grounded in different document sets.
  const handleStrategyChange = (next: string) => {
    if (next === ragStrategy) return;
    setRagStrategy(next);
    setMsgs([]);
    setLast(null);
    setInput("");
    setProcStep(-1);
    setWarningPopup(null);
  };

  const rd = last?.router_decision as RouterDecision | undefined;
  const currentStrat = RAG_STRATEGIES.find(s => s.value === ragStrategy) ?? RAG_STRATEGIES[0];

  return (
    <>
    <AnimatePresence>
      {warningPopup && (
        <WarningModal
          msg={warningPopup.msg}
          strategyValue={warningPopup.strategy}
          onDismiss={() => setWarningPopup(null)}
        />
      )}
    </AnimatePresence>
    <div className="app">
      <div className="header">
        <h1>RAG Atlas</h1>
        <div className="badges">
          <span className="badge">{email}</span>
          <span className="badge role">{roles.join(", ")}</span>
          <span className="badge">dept: {department}</span>
          {onBack && <button className="btn ghost" onClick={onBack}>← Dashboard</button>}
          <button className="btn ghost" onClick={onLogout}>Sign out</button>
        </div>
      </div>

      <div className="main">
        <div className="chat">
          <div className="messages" ref={msgsBoxRef}>
            {msgs.length === 0 && (
              <div className="empty-state">
                <div className="es-icon-wrap">{currentStrat.icon}</div>
                <span className="es-num">Strategy {currentStrat.num} · {RAG_STRATEGIES.length} total</span>
                <h2 className="es-title">{currentStrat.label}</h2>
                <p className="es-desc">{currentStrat.desc}</p>
                <div className="es-divider" />
                <span className="es-label">Try asking</span>
                {suggestionsLoading ? (
                  <SuggestionChips suggestions={[]} type="start" onSelect={send} disabled={busy} loading />
                ) : docSuggestions.start.length > 0 ? (
                  <SuggestionChips suggestions={docSuggestions.start} type="start" onSelect={send} disabled={busy} />
                ) : (
                  <div className="es-no-docs">
                    <span className="es-no-docs-icon">📄</span>
                    <p className="es-no-docs-msg">
                      No documents in <strong>{currentStrat.label}</strong> yet.<br />
                      Add documents via <strong>Knowledge Base</strong> — questions will appear here automatically.
                    </p>
                  </div>
                )}
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} className={`msg ${m.who}`}>
                {m.who === "bot" && m.data ? renderAnswer(m.text, m.data.citations) : m.text}
                {m.who === "bot" && m.data && (
                  <span className={`confidence ${cc(m.data.confidence)}`}>
                    confidence {(m.data.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            ))}

            {/* Three-dot typing indicator while the bot composes its reply */}
            {busy && (
              <div className="msg bot msg-typing" aria-label="Assistant is typing">
                <span className="typing-dots"><span /><span /><span /></span>
              </div>
            )}

            {/* Follow-up suggestion chips — contextual to the last answer's own
                cited documents, not a static per-strategy list — only visible
                when idle after a bot reply */}
            {!busy && msgs.length > 0 && msgs[msgs.length - 1].who === "bot" && (
              <SuggestionChips
                suggestions={msgs[msgs.length - 1].data?.followup_questions ?? []}
                type="followup"
                onSelect={send}
                disabled={busy}
              />
            )}

            <div ref={endRef} />
          </div>

          {/* Processing card — always above composer, never inside scroll */}
          {procStep >= 0 && (
            <div className="proc-tray">
              <ProcessingCard
                strategyValue={ragStrategy}
                activeStep={procStep}
              />
            </div>
          )}

          <div className="composer">
            <StrategyDropdown value={ragStrategy} onChange={handleStrategyChange} disabled={busy} />
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Ask a question..."
              disabled={busy}
            />
            <button className="btn" onClick={() => send()} disabled={busy}>Send</button>
          </div>
        </div>

        <div className="side">
          <h3>Why this answer?</h3>
          {!last && <div style={{fontSize:12,color:"var(--muted)"}}>Send a query to see the trace.</div>}
          {last && rd && (
            <>
              <div className="why-panel">
                <Row label="Strategy">{rd.strategy}</Row>
                <Row label="Embed model">{rd.model ?? "text-embedding-3-small"}</Row>
                <Row label="Docs retrieved">{last.citations.length}</Row>
                <Row label="Confidence">
                  <span className={`why-conf ${cc(last.confidence)}`}>
                    {(last.confidence * 100).toFixed(0)}%
                    <span className="why-conf-bar"><span style={{width:`${(last.confidence*100).toFixed(0)}%`}}/></span>
                  </span>
                </Row>
                {rd.scores && rd.scores.length > 0 && (
                  <Row label="Scores">
                    <span className="why-score-chips">
                      {(rd.scores as number[]).map((s,i) => (
                        <span key={i} className={`score-chip ${s>=0.5?"hi":s>=0.35?"mid":"lo"}`}>{(s*100).toFixed(0)}%</span>
                      ))}
                    </span>
                  </Row>
                )}
                <Row label="Trace ID"><span className="mono">{last.trace_id}</span></Row>
              </div>
              <StrategyPanel rd={rd} />
              <h3>Citations ({last.citations.length})</h3>
              {last.citations.map((c, i) => (
                <div className="cite-card" key={i}>
                  <div className="meta">
                    <span><b>{c.doc_id}</b>{c.page != null ? `:p${c.page}` : ""}</span>
                    <Tag label={c.classification} cls={c.classification} />
                    <Tag label={c.department} />
                    <span>score {c.score.toFixed(3)}</span>
                  </div>
                  <div className="content">{c.snippet}…</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
