import { useState, useEffect, useRef, useCallback } from "react";
import RagFlowCard from "./RagFlowCard";
import { STRATEGIES, STEPS } from "./pipelines";

type Props = { onBack: () => void; onGoChat: () => void };

export default function PipelinesPage({ onBack, onGoChat }: Props) {
  const [selected, setSelected]     = useState("naive");
  const [step, setStep]             = useState(0);
  const [playing, setPlaying]       = useState(true);
  const [speed, setSpeed]           = useState(1400); // ms per step
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const strategy  = STRATEGIES.find(s => s.value === selected)!;
  const steps     = STEPS[selected] ?? STEPS.naive;
  const maxStep   = steps.length - 1;
  const infoStep  = Math.min(hoveredStep ?? step, steps.length - 1);

  const VISUAL_TYPES = new Set(["PNG","JPG","JPEG","SVG","GIF","WEBP"]);
  const isVisualType = (t: string) => VISUAL_TYPES.has(t.toUpperCase());
  const isMultimodal = strategy.docs.types.some(isVisualType) ||
    strategy.tags.some(t => /multimodal|vision|multi-modal/i.test(t));

  const advance = useCallback(() => {
    setStep(s => (s >= maxStep ? 0 : s + 1));
  }, [maxStep]);

  // Auto-play
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (playing) {
      intervalRef.current = setInterval(advance, speed);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, speed, advance]);

  // Reset step and hover on strategy change
  useEffect(() => { setStep(0); setHoveredStep(null); }, [selected]);

  const prev = () => setStep(s => Math.max(0, s - 1));
  const next = () => setStep(s => Math.min(maxStep, s + 1));

  // Hands the clicked example question off to Chat via sessionStorage (read
  // once on Chat's mount) so a newbie can go from "what does this mean?" to
  // a real, working answer in one click instead of retyping the question.
  const tryExample = (q: string) => {
    try {
      sessionStorage.setItem("pip_try_question", JSON.stringify({ strategy: strategy.value, question: q }));
    } catch { /* sessionStorage unavailable — chat just opens empty, non-fatal */ }
    onGoChat();
  };

  // Open Chat already focused on the strategy the user is viewing (no pre-filled
  // question) instead of always defaulting to Naive RAG.
  const openChatWithStrategy = () => {
    try {
      sessionStorage.setItem("pip_try_question", JSON.stringify({ strategy: strategy.value, question: "" }));
    } catch { /* sessionStorage unavailable — chat just opens on the default strategy, non-fatal */ }
    onGoChat();
  };

  return (
    <div className="pip-root">
      {/* ── Sidebar ─────────────────────────────── */}
      <aside className="pip-sidebar">
        <div className="pip-sidebar-hd">
          <button className="pip-back-btn" onClick={onBack}>← Dashboard</button>
          <div className="pip-sidebar-title">RAG Pipelines</div>
          <div className="pip-sidebar-sub">14 strategies · live animations</div>
        </div>

        <div className="pip-strategy-list">
          {STRATEGIES.map(s => (
            <button
              key={s.value}
              className={`pip-strat-btn${selected === s.value ? " active" : ""}`}
              onClick={() => setSelected(s.value)}
              style={selected === s.value ? { borderColor: s.color, boxShadow: `0 0 0 1px ${s.color}33` } : {}}
            >
              <span className="pip-strat-num" style={selected === s.value ? { color: s.color } : {}}>{s.num}</span>
              <span className="pip-strat-icon">{s.icon}</span>
              <span className="pip-strat-name">{s.label}</span>
              {selected === s.value && (
                <span className="pip-strat-dot" style={{ background: s.color }} />
              )}
            </button>
          ))}
        </div>

        <div className="pip-sidebar-footer">
          <button className="btn ghost" style={{ width:"100%" }} onClick={openChatWithStrategy}>
            Open Chat →
          </button>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────── */}
      <main className="pip-main">
        {/* Header */}
        <div className="pip-header">
          <div className="pip-header-top">
            <div className="pip-hd-left">
              <span className="pip-hd-num" style={{ color: strategy.color }}>{strategy.num}</span>
              <span className="pip-hd-icon">{strategy.icon}</span>
              <div>
                <div className="pip-hd-title">{strategy.label}</div>
                <div className="pip-hd-tagline">{strategy.tagline}</div>
              </div>
            </div>
            <div className="pip-hd-tags">
              {strategy.tags.map(t => (
                <span key={t} className="pip-tag">{t}</span>
              ))}
            </div>
          </div>
          <p className="pip-hd-plain">💡 {strategy.plainEnglish}</p>
        </div>

        {/* Flow + controls */}
        <div className="pip-flow-zone">
          <div className="pip-flow-wrap">
            <RagFlowCard key={selected} strategyValue={selected} activeStep={step} />
          </div>

          {/* Step controls */}
          <div className="pip-controls">
            {/* Row 1 — navigation */}
            <div className="pip-ctrl-row">
              <button className="pip-ctrl-btn" onClick={prev} disabled={step === 0}>‹ Prev</button>

              <div className="pip-step-indicator">
                {steps.map((s, i) => (
                  <div
                    key={i}
                    className="pip-dot-wrap"
                    onMouseEnter={() => setHoveredStep(i)}
                    onMouseLeave={() => setHoveredStep(null)}
                  >
                    <button
                      className={`pip-dot${i === step ? " active" : i < step ? " done" : ""}`}
                      style={i === step ? { background: strategy.color, boxShadow: `0 0 8px ${strategy.color}88` } : {}}
                      onClick={() => { setStep(i); setPlaying(false); }}
                    />
                    <div className="pip-dot-tooltip">
                      <div className="pip-dot-tooltip-num" style={{ color: strategy.color }}>
                        Step {i + 1} / {steps.length}
                      </div>
                      <div className="pip-dot-tooltip-label">{s.label}</div>
                      <div className="pip-dot-tooltip-detail">{s.detail}</div>
                      <div className="pip-dot-tooltip-arrow" />
                    </div>
                  </div>
                ))}
              </div>

              <button className="pip-ctrl-btn" onClick={next} disabled={step === maxStep}>Next ›</button>

              <div className="pip-ctrl-sep" />

              <button
                className={`pip-play-btn${playing ? " playing" : ""}`}
                onClick={() => setPlaying(p => !p)}
              >
                {playing ? "⏸ Pause" : "▶ Play"}
              </button>

              <select
                className="pip-speed-sel"
                value={speed}
                onChange={e => setSpeed(Number(e.target.value))}
              >
                <option value={700}>Fast</option>
                <option value={1400}>Normal</option>
                <option value={2500}>Slow</option>
              </select>
            </div>

            {/* Row 2 — step info (updates on dot hover) */}
            <div className="pip-ctrl-info-row">
              <span className="pip-ctrl-info-num" style={{ color: strategy.color }}>
                Step {infoStep + 1} / {steps.length}
              </span>
              <span className="pip-ctrl-info-label">{steps[infoStep].label}</span>
              <span className="pip-ctrl-info-sep">—</span>
              <span className="pip-ctrl-info-detail">{steps[infoStep].detail}</span>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div className="pip-detail">
          <div className="pip-detail-left">
            <div className="pip-detail-section">
              <div className="pip-detail-label">How it works</div>
              <p className="pip-detail-desc">{strategy.desc}</p>
            </div>
            <div className="pip-detail-section">
              <div className="pip-detail-label">When to use</div>
              <p className="pip-detail-desc">{strategy.when}</p>
            </div>

            <div className="pip-detail-section">
              <div className="pip-detail-label">Supported Inputs</div>
              <div className="pip-doc-types" style={{ marginBottom: 6 }}>
                {strategy.docs.types.map(t => (
                  <span
                    key={t}
                    className="pip-doc-badge"
                    style={{
                      borderColor: isVisualType(t) ? "#f87171" : `${strategy.color}66`,
                      color:       isVisualType(t) ? "#f87171" : strategy.color,
                    }}
                  >
                    {t}
                  </span>
                ))}
                {isMultimodal && (
                  <span className="pip-multimodal-badge">🖼 VISION-CAPABLE</span>
                )}
              </div>
              <ul className="pip-doc-content-list">
                {strategy.docs.content.map((c, i) => (
                  <li key={i} className="pip-doc-content-item">· {c}</li>
                ))}
              </ul>
            </div>

            <div className="pip-detail-section">
              <div className="pip-detail-label">Advantages</div>
              <div className="pip-pros">
                {strategy.pros.map(p => (
                  <span key={p} className="pip-pro">✓ {p}</span>
                ))}
              </div>
            </div>

            <div className="pip-detail-section">
              <div className="pip-detail-label pip-detail-label--bad">Disadvantages</div>
              <div className="pip-cons">
                {strategy.cons.map(c => (
                  <span key={c} className="pip-con">✗ {c}</span>
                ))}
              </div>
            </div>

            <div className="pip-detail-section">
              <div className="pip-detail-label pip-detail-label--warn">When NOT to use</div>
              <p className="pip-detail-desc pip-detail-desc--warn">{strategy.notWhen}</p>
            </div>
          </div>

          <div className="pip-detail-right">
            <div className="pip-detail-section">
              <div className="pip-detail-label">Try Asking</div>
              <div className="pip-example-list">
                {strategy.examples.map((ex, i) => (
                  <button key={i} className="pip-example-chip" onClick={() => tryExample(ex)}>
                    <span className="pip-example-chip-icon">💬</span>{ex}
                  </button>
                ))}
              </div>
            </div>

            <div className="pip-detail-section">
              <div className="pip-detail-label">Performance Profile</div>
              <div className="pip-perf-grid">
                {(["speed","quality","cost"] as const).map(metric => {
                  const val = strategy.perf[metric];
                  const labels: Record<string,string> = { speed:"Speed", quality:"Quality", cost:"Cost" };
                  const colors: Record<string,string> = { speed:"#6aa9ff", quality:"#4ade80", cost:"#fb923c" };
                  return (
                    <div key={metric} className="pip-perf-row">
                      <span className="pip-perf-label">{labels[metric]}</span>
                      <div className="pip-perf-bar-track">
                        {[1,2,3,4,5].map(n => (
                          <span
                            key={n}
                            className="pip-perf-pip"
                            style={{ background: n <= val ? colors[metric] : "rgba(255,255,255,.1)", boxShadow: n <= val ? `0 0 6px ${colors[metric]}88` : "none" }}
                          />
                        ))}
                      </div>
                      <span className="pip-perf-val">{val}/5</span>
                    </div>
                  );
                })}
                <div className="pip-perf-row" style={{ marginTop: 4 }}>
                  <span className="pip-perf-label">LLM Calls</span>
                  <div className="pip-perf-bar-track">
                    {Array.from({ length: strategy.perf.llmCalls }, (_, i) => (
                      <span key={i} className="pip-perf-pip" style={{ background: strategy.color, boxShadow: `0 0 6px ${strategy.color}88` }} />
                    ))}
                  </div>
                  <span className="pip-perf-val">{strategy.perf.llmCalls}×</span>
                </div>
              </div>
            </div>

            <div className="pip-detail-section" style={{ marginTop: 10 }}>
              <div className="pip-detail-label">Compatible Documents</div>
              <div className="pip-doc-types">
                {strategy.docs.types.map(t => (
                  <span key={t} className="pip-doc-badge" style={{ borderColor: `${strategy.color}66`, color: strategy.color }}>{t}</span>
                ))}
              </div>
              <ul className="pip-doc-content-list">
                {strategy.docs.content.map((c, i) => (
                  <li key={i} className="pip-doc-content-item">· {c}</li>
                ))}
              </ul>
            </div>

            <div className="pip-detail-section" style={{ marginTop: 10 }}>
              <div className="pip-detail-label">Technical Details</div>
              <div className="pip-tech-grid">
                <div className="pip-tech-row">
                  <span className="pip-tech-key">Algorithm</span>
                  <span className="pip-tech-val">{strategy.tech.algorithm}</span>
                </div>
                <div className="pip-tech-row">
                  <span className="pip-tech-key">Complexity</span>
                  <span className="pip-tech-val pip-tech-mono">{strategy.tech.complexity}</span>
                </div>
                <div className="pip-tech-row pip-tech-row--deps">
                  <span className="pip-tech-key">Dependencies</span>
                  <div className="pip-tech-deps">
                    {strategy.tech.deps.map(d => (
                      <span key={d} className="pip-tech-dep">{d}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
