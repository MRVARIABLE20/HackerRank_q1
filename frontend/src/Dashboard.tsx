import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAuditLog, getMyHistory, clearAuditLog, countKBDocs } from "./api";
import type { AuditEntry } from "./api";
import { ROUTES } from "./routes";
import LightningBg from "./LightningBg";



function tokenExpiry(token: string) {
  try {
    const p = JSON.parse(atob(token.split(".")[1]));
    const diff = Math.floor((p.exp * 1000 - Date.now()) / 60000);
    if (diff <= 0) return { label: "Expired", pct: 0 };
    const total = 60;
    return { label: diff < 60 ? `${diff}m left` : `${Math.floor(diff/60)}h ${diff%60}m left`, pct: Math.min(100, Math.round(diff / total * 100)) };
  } catch { return { label: "Unknown", pct: 50 }; }
}

function initials(email: string, full_name?: string) {
  if (full_name?.trim()) return full_name.trim().split(/\s+/).map((w: string)=>w[0].toUpperCase()).slice(0,2).join("");
  return email.slice(0,2).toUpperCase();
}

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.max(1, Math.ceil(to / 30));
    const id = setInterval(() => {
      start = Math.min(start + step, to);
      setVal(start);
      if (start >= to) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [to]);
  return <>{val}{suffix}</>;
}

function Ring({ pct, color, size = 64 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={6}/>
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dasharray .6s ease" }}
      />
    </svg>
  );
}

type Props = {
  token: string; email: string; roles: string[];
  department: string; full_name?: string;
  onLogout: () => void;
};

type Tab = "overview" | "audit" | "history";

export default function Dashboard({ token, email, roles, full_name, onLogout }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const [audit, setAudit]           = useState<AuditEntry[]>([]);
  const [auditErr, setAuditErr]     = useState<string | null>(null);
  const [clearing, setClearing]     = useState(false);
  const [myHistory, setMyHistory]   = useState<AuditEntry[]>([]);
  const [historyErr, setHistoryErr] = useState<string | null>(null);
  const [kbCount, setKbCount]       = useState(0);
  const [expiry, setExpiry]         = useState(tokenExpiry(token));

  const isAdmin = roles.includes("admin");

  // The active tab is derived from the URL so refresh/back/bookmark all work.
  const tab: Tab =
    location.pathname === ROUTES.audit ? "audit"
    : location.pathname === ROUTES.history ? "history"
    : "overview";

  // Convenience navigators used by the sidebar and quick-action cards
  const onGoChat = () => navigate(ROUTES.chat);
  const onGoKB = () => navigate(ROUTES.kb);
  const onGoPipelines = () => navigate(ROUTES.pipelines);
  const goTab = (t: Tab) =>
    navigate(t === "audit" ? ROUTES.audit : t === "history" ? ROUTES.history : ROUTES.overview);

  useEffect(() => {
    const id = setInterval(() => setExpiry(tokenExpiry(token)), 20_000);
    return () => clearInterval(id);
  }, [token]);

  useEffect(() => {
    if (!isAdmin) return;
    getAuditLog(token, 20).then(setAudit).catch((e: Error) => setAuditErr(e.message));
  }, [token, isAdmin]);

  useEffect(() => {
    getMyHistory(token, 50).then(setMyHistory).catch((e: Error) => setHistoryErr(e.message));
  }, [token]);

  useEffect(() => {
    countKBDocs(token).then(setKbCount).catch(() => {});
  }, [token]);

  const avgConf = audit.length ? audit.reduce((s,a)=>s+a.confidence,0)/audit.length : 0;

  async function handleClearAudit() {
    if (!confirm("Delete all audit log entries? This cannot be undone.")) return;
    setClearing(true);
    setAuditErr(null);
    try {
      await clearAuditLog(token);
      setAudit([]);
    } catch (e: unknown) {
      setAuditErr(e instanceof Error ? e.message : "Failed to clear");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="db2-root">
      <LightningBg />

      {/* ── Sidebar ── */}
      <aside className="db2-sidebar">
        <div className="db2-logo">
          <img src="/logo.png" alt="RAG Atlas" className="db2-logo-bolt" />
          <span>RAG<br/><span style={{color:"var(--accent)"}}>Atlas</span></span>
        </div>

        <nav className="db2-nav">
          {([
            { id:"overview",  icon:"⊞",  label:"Overview"    },
            ...(isAdmin ? [{ id:"audit",   icon:"📋", label:"Audit Log"  }] : []),
            ...(!isAdmin ? [{ id:"history", icon:"🕘", label:"My History" }] : []),
          ] as {id:Tab,icon:string,label:string}[]).map(n => (
            <button
              key={n.id}
              className={`db2-nav-item${tab === n.id ? " active" : ""}`}
              onClick={() => goTab(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
              {tab === n.id && <span className="nav-pip" />}
            </button>
          ))}
          <div className="db2-nav-divider"/>
          {onGoKB && isAdmin && (
            <button className="db2-nav-item" onClick={onGoKB}>
              <span className="nav-icon">📚</span>
              <span>Knowledge Base</span>
            </button>
          )}
          {onGoPipelines && (
            <button className="db2-nav-item" onClick={onGoPipelines}>
              <span className="nav-icon">🔬</span>
              <span>RAG Pipelines</span>
            </button>
          )}
          <button className="db2-nav-item lightning-btn" onClick={onGoChat}>
            <span className="nav-icon">💬</span>
            <span>Open Chat</span>
          </button>
        </nav>

        <div className="db2-sidebar-footer">
          <div className="db2-user-chip">
            <div className="db2-avatar">{initials(email, full_name)}</div>
            <div className="db2-user-info">
              <div className="db2-user-name">{full_name || email.split("@")[0]}</div>
              <div className="db2-user-email">{email}</div>
            </div>
          </div>
          <button className="btn ghost db2-logout" onClick={onLogout}>⏻ Sign out</button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="db2-main">
        <header className="db2-topbar">
          <div>
            <h1 className="db2-page-title">
              {tab === "overview" && "Dashboard"}
              {tab === "audit"    && "Audit Log"}
              {tab === "history"  && "My History"}
            </h1>
            <p className="db2-page-sub">Welcome back, <span className="electric-name">{full_name || email.split("@")[0]}</span></p>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <button className="btn" onClick={onGoChat}>Chat →</button>
          </div>
        </header>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="db2-content">
            <div className="db2-kpi-grid">
              <div className="db2-kpi electric-card">
                <div className="db2-kpi-icon" style={{background:"rgba(251,191,36,.12)",color:"var(--warn)"}}>⏱</div>
                <div>
                  <div className="db2-kpi-label">Token Expiry</div>
                  <div className="db2-kpi-val" style={{color: expiry.pct < 20 ? "var(--bad)" : "var(--good)", fontSize:13}}>{expiry.label}</div>
                </div>
                <Ring pct={expiry.pct} color={expiry.pct < 20 ? "var(--bad)" : expiry.pct < 50 ? "var(--warn)" : "var(--good)"} />
              </div>
              <div className="db2-kpi electric-card">
                <div className="db2-kpi-icon" style={{background:"rgba(74,222,128,.12)",color:"var(--good)"}}>📄</div>
                <div>
                  <div className="db2-kpi-label">KB Documents</div>
                  <div className="db2-kpi-val" style={{color:"var(--good)"}}><Counter to={kbCount} /></div>
                </div>
                <Ring pct={kbCount > 0 ? Math.min(100, Math.round((kbCount / 50) * 100)) : 0} color="var(--good)" />
              </div>
              <div className="db2-kpi electric-card">
                <div className="db2-kpi-icon" style={{background:"rgba(106,169,255,.12)",color:"var(--accent)"}}>🤖</div>
                <div>
                  <div className="db2-kpi-label">Embed Model</div>
                  <div className="db2-kpi-val" style={{fontSize:11,color:"var(--accent)"}}>text-embedding-3-small</div>
                </div>
                <Ring pct={100} color="var(--accent)" />
              </div>
              {isAdmin && audit.length > 0 && (
                <div className="db2-kpi electric-card">
                  <div className="db2-kpi-icon" style={{background:"rgba(251,146,60,.12)",color:"var(--warn)"}}>📊</div>
                  <div>
                    <div className="db2-kpi-label">Avg Confidence</div>
                    <div className="db2-kpi-val" style={{color: avgConf >= 0.5 ? "var(--good)" : "var(--warn)"}}>
                      {(avgConf * 100).toFixed(0)}%
                    </div>
                  </div>
                  <Ring pct={Math.round(avgConf * 100)} color={avgConf >= 0.5 ? "var(--good)" : "var(--warn)"} />
                </div>
              )}
            </div>

            <div className="db2-section-hd">Quick Actions</div>
            <div className="db2-action-row">
              <div className="db2-action electric-card glow-hover" onClick={onGoChat} role="button">
                <div className="db2-action-emoji">⚡</div>
                <div className="db2-action-title">Chat</div>
                <div className="db2-action-desc">Ask questions with RBAC-grounded cited answers.</div>
                <span className="db2-action-arrow">→</span>
              </div>
              {onGoKB && isAdmin && (
                <div className="db2-action electric-card glow-hover" onClick={onGoKB} role="button">
                  <div className="db2-action-emoji">📚</div>
                  <div className="db2-action-title">Knowledge Base</div>
                  <div className="db2-action-desc">Manage the documents the chatbot answers from.</div>
                  <span className="db2-action-arrow">→</span>
                </div>
              )}
              {onGoPipelines && (
                <div className="db2-action electric-card glow-hover" onClick={onGoPipelines} role="button">
                  <div className="db2-action-emoji">🔬</div>
                  <div className="db2-action-title">RAG Pipelines</div>
                  <div className="db2-action-desc">14 animated RAG strategies with step-by-step explanations.</div>
                  <span className="db2-action-arrow">→</span>
                </div>
              )}
              {isAdmin && (
                <div className="db2-action electric-card glow-hover" onClick={() => goTab("audit")} role="button">
                  <div className="db2-action-emoji">📋</div>
                  <div className="db2-action-title">Audit Log</div>
                  <div className="db2-action-desc">Review all queries, access decisions and confidence scores.</div>
                  <span className="db2-action-arrow">→</span>
                </div>
              )}
            </div>

            <div className="db2-section-hd">Your Roles</div>
            <div className="db2-roles-strip electric-card">
              {roles.map(r => <span key={r} className="badge role db2-role-chip">{r}</span>)}
              <span style={{marginLeft:"auto",fontSize:11,color:"var(--muted)"}}>JWT payload · HS256</span>
            </div>

            {isAdmin && audit.length > 0 && (
              <>
                <div className="db2-section-hd" style={{display:"flex",alignItems:"center",gap:10}}>
                  Recent Activity
                  <button className="link-btn" style={{fontSize:11}} onClick={()=>goTab("audit")}>View all →</button>
                </div>
                <div className="db2-activity electric-card">
                  {audit.slice(0,5).map(a => (
                    <div key={a.trace_id} className="db2-activity-row">
                      <span className="db2-activity-time">{new Date(a.ts).toLocaleTimeString()}</span>
                      <span className="db2-activity-user">{a.user_email.split("@")[0]}</span>
                      <span className="db2-activity-q">{a.query}</span>
                      <span className={`db2-activity-conf ${a.confidence>0.7?"good":a.confidence>0.4?"warn":"bad"}`}>
                        {(a.confidence*100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* AUDIT */}
        {tab === "audit" && isAdmin && (
          <div className="db2-content">
            {auditErr && <div className="error" style={{marginBottom:16}}>{auditErr}</div>}

            <div className="db2-audit-stats">
              <div className="db2-audit-stat">
                <div className="db2-audit-stat-icon" style={{background:"rgba(106,169,255,.12)",color:"var(--accent)"}}>📊</div>
                <div>
                  <div className="db2-audit-stat-label">Total Queries</div>
                  <div className="db2-audit-stat-val" style={{color:"var(--accent)"}}><Counter to={audit.length}/></div>
                </div>
              </div>
              <div className="db2-audit-stat">
                <div className="db2-audit-stat-icon" style={{background: avgConf>0.7?"rgba(74,222,128,.12)":avgConf>0.4?"rgba(251,146,60,.12)":"rgba(248,113,113,.12)", color: avgConf>0.7?"var(--good)":avgConf>0.4?"var(--warn)":"var(--bad)"}}>✦</div>
                <div style={{flex:1}}>
                  <div className="db2-audit-stat-label">Avg Confidence</div>
                  <div className="db2-audit-stat-val" style={{color:avgConf>0.7?"var(--good)":avgConf>0.4?"var(--warn)":"var(--bad)"}}>
                    {audit.length > 0 ? `${(avgConf*100).toFixed(0)}%` : "—"}
                  </div>
                </div>
                {audit.length > 0 && <Ring pct={avgConf*100} color={avgConf>0.7?"var(--good)":avgConf>0.4?"var(--warn)":"var(--bad)"} size={52}/>}
              </div>
            </div>

            <div className="db2-audit-bar">
              <span className="db2-audit-bar-title">All Queries</span>
              {audit.length > 0 && <span className="db2-audit-bar-count">{audit.length}</span>}
              <div className="db2-audit-bar-line" />
              <button
                className="db2-clear-btn"
                onClick={handleClearAudit}
                disabled={clearing || audit.length === 0}
              >
                {clearing ? "Deleting…" : "Delete History"}
              </button>
            </div>

            <div className="db2-audit-wrap">
              <div className="db2-audit-head">
                <span>Time</span><span>User</span><span>Query</span><span>Conf.</span>
              </div>
              {audit.map(a => (
                <div key={a.trace_id} className="db2-audit-row">
                  <span className="db2-audit-time">{new Date(a.ts).toLocaleString()}</span>
                  <span className="db2-audit-user">{a.user_email}</span>
                  <span className="db2-audit-q">{a.query}</span>
                  <span style={{fontWeight:700,color:a.confidence>0.7?"var(--good)":a.confidence>0.4?"var(--warn)":"var(--bad)"}}>
                    {(a.confidence*100).toFixed(0)}%
                  </span>
                </div>
              ))}
              {audit.length === 0 && !auditErr && (
                <div className="db2-audit-empty">
                  <div className="db2-audit-empty-icon">📋</div>
                  No audit entries yet
                </div>
              )}
            </div>
          </div>
        )}

        {/* MY HISTORY (non-admin users) */}
        {tab === "history" && !isAdmin && (
          <div className="db2-content">
            {historyErr && <div className="error" style={{marginBottom:16}}>{historyErr}</div>}

            <div className="db2-audit-stats">
              <div className="db2-audit-stat">
                <div className="db2-audit-stat-icon" style={{background:"rgba(106,169,255,.12)",color:"var(--accent)"}}>💬</div>
                <div>
                  <div className="db2-audit-stat-label">My Queries</div>
                  <div className="db2-audit-stat-val" style={{color:"var(--accent)"}}><Counter to={myHistory.length}/></div>
                </div>
              </div>
              <div className="db2-audit-stat">
                {(() => {
                  const myAvg = myHistory.length ? myHistory.reduce((s,a)=>s+a.confidence,0)/myHistory.length : 0;
                  return (
                    <>
                      <div className="db2-audit-stat-icon" style={{background:myAvg>0.7?"rgba(74,222,128,.12)":myAvg>0.4?"rgba(251,146,60,.12)":"rgba(248,113,113,.12)",color:myAvg>0.7?"var(--good)":myAvg>0.4?"var(--warn)":"var(--bad)"}}>✦</div>
                      <div style={{flex:1}}>
                        <div className="db2-audit-stat-label">Avg Confidence</div>
                        <div className="db2-audit-stat-val" style={{color:myAvg>0.7?"var(--good)":myAvg>0.4?"var(--warn)":"var(--bad)"}}>
                          {myHistory.length > 0 ? `${(myAvg*100).toFixed(0)}%` : "—"}
                        </div>
                      </div>
                      {myHistory.length > 0 && <Ring pct={myAvg*100} color={myAvg>0.7?"var(--good)":myAvg>0.4?"var(--warn)":"var(--bad)"} size={52}/>}
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="db2-audit-bar">
              <span className="db2-audit-bar-title">My Queries</span>
              {myHistory.length > 0 && <span className="db2-audit-bar-count">{myHistory.length}</span>}
              <div className="db2-audit-bar-line" />
            </div>

            <div className="db2-audit-wrap">
              <div className="db2-audit-head" style={{gridTemplateColumns:"148px 1fr 76px"}}>
                <span>Time</span><span>Query</span><span>Conf.</span>
              </div>
              {myHistory.map(a => (
                <div key={a.trace_id} className="db2-audit-row" style={{gridTemplateColumns:"148px 1fr 76px"}}>
                  <span className="db2-audit-time">{new Date(a.ts).toLocaleString()}</span>
                  <span className="db2-audit-q">{a.query}</span>
                  <span style={{fontWeight:700,color:a.confidence>0.7?"var(--good)":a.confidence>0.4?"var(--warn)":"var(--bad)"}}>
                    {(a.confidence*100).toFixed(0)}%
                  </span>
                </div>
              ))}
              {myHistory.length === 0 && !historyErr && (
                <div className="db2-audit-empty">
                  <div className="db2-audit-empty-icon">💬</div>
                  No queries yet — head to Chat to get started
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
