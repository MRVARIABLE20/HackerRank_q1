import { useEffect, useState } from "react";
import { getAuditLog } from "./api";
import type { AuditEntry } from "./api";
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
  onGoChat: () => void; onGoKB?: () => void; onLogout: () => void;
};

type Tab = "overview" | "security" | "audit";

export default function Dashboard({ token, email, roles, department, full_name, onGoChat, onGoKB, onLogout }: Props) {
  const [audit, setAudit]       = useState<AuditEntry[]>([]);
  const [auditErr, setAuditErr] = useState<string | null>(null);
  const [tab, setTab]           = useState<Tab>("overview");
  const [expiry, setExpiry]     = useState(tokenExpiry(token));
  const [copied, setCopied]     = useState(false);

  const isAdmin   = roles.includes("admin") || roles.includes("auditor");

  useEffect(() => {
    const id = setInterval(() => setExpiry(tokenExpiry(token)), 20_000);
    return () => clearInterval(id);
  }, [token]);

  useEffect(() => {
    if (!isAdmin) return;
    getAuditLog(token, 20).then(setAudit).catch((e: Error) => setAuditErr(e.message));
  }, [token, isAdmin]);

  const copyToken = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const avgConf    = audit.length ? audit.reduce((s,a)=>s+a.confidence,0)/audit.length : 0;

  return (
    <div className="db2-root">
      <LightningBg />

      {/* ── Sidebar ── */}
      <aside className="db2-sidebar">
        <div className="db2-logo">
          <img src="/logo.png" alt="Enterprise RAG" className="db2-logo-bolt" />
          <span>Enterprise<br/><span style={{color:"var(--accent)"}}>RAG</span></span>
        </div>

        <nav className="db2-nav">
          {([
            { id:"overview", icon:"⊞", label:"Overview" },
            { id:"security", icon:"🛡", label:"Security" },
            ...(isAdmin ? [{ id:"audit", icon:"📋", label:"Audit Log" }] : []),
          ] as {id:Tab,icon:string,label:string}[]).map(n => (
            <button
              key={n.id}
              className={`db2-nav-item${tab === n.id ? " active" : ""}`}
              onClick={() => setTab(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
              {tab === n.id && <span className="nav-pip" />}
            </button>
          ))}
          <div className="db2-nav-divider"/>
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
              {tab === "security" && "Security & Token"}
              {tab === "audit"    && "Audit Log"}
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
                  <div className="db2-kpi-val" style={{color:"var(--good)"}}><Counter to={audit.length > 0 ? 13 : 13} /></div>
                </div>
                <Ring pct={87} color="var(--good)" />
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
                <div className="db2-action-title">Intelligence Chat</div>
                <div className="db2-action-desc">Ask questions with RBAC-grounded cited answers.</div>
                <span className="db2-action-arrow">→</span>
              </div>
              {onGoKB && (
                <div className="db2-action electric-card glow-hover" onClick={onGoKB} role="button">
                  <div className="db2-action-emoji">📚</div>
                  <div className="db2-action-title">Knowledge Base</div>
                  <div className="db2-action-desc">{isAdmin ? "Manage the documents the chatbot answers from." : "Browse, add, and manage your KB contributions."}</div>
                  <span className="db2-action-arrow">→</span>
                </div>
              )}
              <div className="db2-action electric-card">
                <div className="db2-action-emoji">🧠</div>
                <div className="db2-action-title">Semantic Search</div>
                <div className="db2-action-desc">Documents ranked by cosine similarity using OpenAI embeddings.</div>
              </div>
              {isAdmin && (
                <div className="db2-action electric-card glow-hover" onClick={() => setTab("audit")} role="button">
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
                  <button className="link-btn" style={{fontSize:11}} onClick={()=>setTab("audit")}>View all →</button>
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

        {/* SECURITY */}
        {tab === "security" && (
          <div className="db2-content">
            <div className="db2-kpi-grid" style={{gridTemplateColumns:"repeat(3,1fr)"}}>
              <div className="db2-kpi electric-card">
                <div className="db2-kpi-icon" style={{background:"rgba(106,169,255,.12)",color:"var(--accent)"}}>🔒</div>
                <div><div className="db2-kpi-label">Auth scheme</div><div className="db2-kpi-val">JWT HS256</div></div>
              </div>
              <div className="db2-kpi electric-card">
                <div className="db2-kpi-icon" style={{background:"rgba(74,222,128,.12)",color:"var(--good)"}}>🔑</div>
                <div><div className="db2-kpi-label">Password hash</div><div className="db2-kpi-val">bcrypt</div></div>
              </div>
              <div className="db2-kpi electric-card">
                <div className="db2-kpi-icon" style={{background:"rgba(251,191,36,.12)",color:"var(--warn)"}}>⏳</div>
                <div><div className="db2-kpi-label">Token TTL</div><div className="db2-kpi-val">{expiry.label}</div></div>
                <Ring pct={expiry.pct} color={expiry.pct<20?"var(--bad)":expiry.pct<50?"var(--warn)":"var(--good)"} size={56}/>
              </div>
            </div>

            <div className="db2-section-hd">Bearer Token</div>
            <div className="db2-token-card electric-card">
              <div className="db2-token-header">
                <span style={{color:"var(--muted)",fontSize:12}}>Authorization: Bearer</span>
                <button className="btn ghost" style={{fontSize:11,padding:"4px 10px"}} onClick={copyToken}>
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <code className="db2-token-code">{token}</code>
              <div className="db2-token-parts">
                {(["Header","Payload","Signature"] as const).map((part,i) => (
                  <span key={part} className={`db2-token-part tp-${i}`}>{part}</span>
                ))}
              </div>
            </div>

            <div className="db2-section-hd">Profile</div>
            <div className="db2-profile electric-card">
              <div className="db2-avatar-lg">{initials(email, full_name)}</div>
              <div className="db2-profile-body">
                <div className="db2-profile-name">{full_name || "—"}</div>
                <div className="db2-profile-email">{email}</div>
                <div className="db2-profile-row">
                  <span className="db2-pill">Dept: <strong style={{textTransform:"capitalize"}}>{department}</strong></span>
                  {roles.map(r=><span key={r} className="badge role db2-pill">{r}</span>)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AUDIT */}
        {tab === "audit" && isAdmin && (
          <div className="db2-content">
            {auditErr && <div className="error" style={{marginBottom:16}}>{auditErr}</div>}
            {audit.length > 0 && (
              <div className="db2-kpi-grid" style={{gridTemplateColumns:"repeat(2,1fr)"}}>
                <div className="db2-kpi electric-card">
                  <div className="db2-kpi-icon" style={{background:"rgba(106,169,255,.12)",color:"var(--accent)"}}>📊</div>
                  <div><div className="db2-kpi-label">Total queries</div><div className="db2-kpi-val"><Counter to={audit.length}/></div></div>
                </div>
                <div className="db2-kpi electric-card">
                  <div className="db2-kpi-icon" style={{background:"rgba(74,222,128,.12)",color:"var(--good)"}}>✅</div>
                  <div>
                    <div className="db2-kpi-label">Avg confidence</div>
                    <div className="db2-kpi-val" style={{color:avgConf>0.7?"var(--good)":avgConf>0.4?"var(--warn)":"var(--bad)"}}>{(avgConf*100).toFixed(0)}%</div>
                  </div>
                  <Ring pct={avgConf*100} color={avgConf>0.7?"var(--good)":avgConf>0.4?"var(--warn)":"var(--bad)"} size={56}/>
                </div>
              </div>
            )}

            <div className="db2-section-hd">All Queries</div>
            <div className="electric-card" style={{borderRadius:10,overflow:"hidden"}}>
              <div className="db2-audit-head">
                <span>Time</span><span>User</span><span>Query</span><span>Conf.</span>
              </div>
              {audit.map(a => (
                <div key={a.trace_id} className="db2-audit-row">
                  <span>{new Date(a.ts).toLocaleString()}</span>
                  <span>{a.user_email}</span>
                  <span className="db2-audit-q">{a.query}</span>
                  <span style={{color:a.confidence>0.7?"var(--good)":a.confidence>0.4?"var(--warn)":"var(--bad)"}}>{(a.confidence*100).toFixed(0)}%</span>
                </div>
              ))}
              {audit.length === 0 && !auditErr && (
                <div style={{padding:"28px",textAlign:"center",color:"var(--muted)"}}>No audit entries yet</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
