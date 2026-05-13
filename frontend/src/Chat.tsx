import { useState } from "react";
import { chat, type ChatResponse, type Citation, type RouterDecision } from "./api";

type Msg = {
  who: "user" | "bot";
  text: string;
  data?: ChatResponse;
};

type Props = {
  token: string;
  email: string;
  roles: string[];
  department: string;
  onLogout: () => void;
  onBack?: () => void;
};

function renderAnswer(text: string, citations: Citation[]) {
  // Highlight [doc_id:page] citations with hover tooltip.
  const map: Record<string, Citation> = {};
  for (const c of citations) {
    const key = c.page != null ? `${c.doc_id}:${c.page}` : c.doc_id;
    map[key] = c;
  }
  const parts = text.split(/(\[[^\[\]]+\])/g);
  return parts.map((p, i) => {
    const m = p.match(/^\[([^\]]+)\]$/);
    if (m) {
      const key = m[1].trim();
      const c =
        map[key] ?? map[key.split(":")[0]] ?? null;
      return (
        <span key={i} className="cite" title={c ? c.snippet : "(no citation match)"}>
          {p}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function confidenceClass(c: number) {
  if (c >= 0.75) return "high";
  if (c >= 0.5) return "mid";
  return "low";
}

export default function Chat({ token, email, roles, department, onLogout, onBack }: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [last, setLast] = useState<ChatResponse | null>(null);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setMsgs((m) => [...m, { who: "user", text: q }]);
    setBusy(true);
    try {
      const r = await chat(token, q);
      setMsgs((m) => [...m, { who: "bot", text: r.answer, data: r }]);
      setLast(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMsgs((m) => [...m, { who: "bot", text: `Error: ${msg}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <div className="header">
        <h1>Enterprise RAG Intelligence</h1>
        <div className="badges">
          <span className="badge">{email}</span>
          <span className="badge role">{roles.join(", ")}</span>
          <span className="badge">dept: {department}</span>
          {onBack && (
            <button className="btn ghost" onClick={onBack}>
              ← Dashboard
            </button>
          )}
          <button className="btn ghost" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </div>

      <div className="main">
        <div className="chat">
          <div className="messages">
            {msgs.length === 0 && (
              <div className="msg bot">
                Ask me anything about the enterprise corpus. Try:
                {"\n"}• "What was Q3 revenue and what risks were flagged?"
                {"\n"}• "Summarize the leave policy."
                {"\n"}• "Show top vendors by spend in Q3."
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`msg ${m.who}`}>
                {m.who === "bot" && m.data
                  ? renderAnswer(m.text, m.data.citations)
                  : m.text}
                {m.who === "bot" && m.data && (
                  <span
                    className={`confidence ${confidenceClass(m.data.confidence)}`}
                    title="Verifier support ratio × top retrieval score"
                  >
                    confidence {(m.data.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            ))}
            {busy && <div className="msg bot">Thinking…</div>}
          </div>
          <div className="composer">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask a question..."
              disabled={busy}
            />
            <button className="btn" onClick={send} disabled={busy}>
              Send
            </button>
          </div>
        </div>

        <div className="side">
          <h3>Why this answer?</h3>
          {!last && <div style={{ fontSize: 12, color: "var(--muted)" }}>Send a query to see the trace.</div>}
          {last && (
            <>
              {/* ── Retrieval summary ── */}
              <div className="why-panel">
                <div className="why-row">
                  <span className="why-label">Retriever</span>
                  <span className="why-value">Semantic embeddings</span>
                </div>
                <div className="why-row">
                  <span className="why-label">Embed model</span>
                  <span className="why-value">{last.router_decision?.model ?? "text-embedding-3-small"}</span>
                </div>
                <div className="why-row">
                  <span className="why-label">Docs retrieved</span>
                  <span className="why-value">{last.citations.length} of {last.router_decision?.k ?? last.citations.length}</span>
                </div>
                <div className="why-row">
                  <span className="why-label">Confidence</span>
                  <span className={`why-conf ${confidenceClass(last.confidence)}`}>
                    {(last.confidence * 100).toFixed(0)}%
                    <span className="why-conf-bar">
                      <span style={{ width: `${(last.confidence * 100).toFixed(0)}%` }} />
                    </span>
                  </span>
                </div>
                {last.router_decision?.scores && (
                  <div className="why-row why-scores">
                    <span className="why-label">Similarity scores</span>
                    <span className="why-value why-score-chips">
                      {(last.router_decision as RouterDecision).scores!.map((s: number, i: number) => (
                        <span key={i} className={`score-chip ${s >= 0.5 ? "hi" : s >= 0.35 ? "mid" : "lo"}`}>
                          {(s * 100).toFixed(0)}%
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                <div className="why-row">
                  <span className="why-label">Trace ID</span>
                  <span className="why-value mono">{last.trace_id}</span>
                </div>
              </div>

              <h3>Citations ({last.citations.length})</h3>
              {last.citations.map((c, i) => (
                <div className="cite-card" key={i}>
                  <div className="meta">
                    <span>
                      <b>{c.doc_id}</b>
                      {c.page != null ? `:p${c.page}` : ""}
                    </span>
                    <span className={`tag ${c.classification}`}>{c.classification}</span>
                    <span className="tag">{c.department}</span>
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
  );
}
