import { useMemo, useState } from "react";
import {
  ReactFlow, Background, Controls, MarkerType,
  Handle, Position,
  type Node, type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FLOWS } from "./pipelines";
import type { NType, NState } from "./pipelines";

interface RagNodeData extends Record<string, unknown> {
  label: string; detail?: string; ntype: NType; state: NState;
}

// ── Style palette ───────────────────────────────────────────────
const PALETTE: Record<NType, { clr: string; bg: string; icon: string; badge: string }> = {
  input:     { clr:"#6aa9ff", bg:"rgba(106,169,255,.15)", icon:"▶", badge:"INPUT"   },
  output:    { clr:"#4ade80", bg:"rgba(74,222,128,.15)",  icon:"■", badge:"OUTPUT"  },
  process:   { clr:"#c0b488", bg:"rgba(192,180,136,.08)", icon:"⚙", badge:"PROCESS" },
  llm:       { clr:"#f5c542", bg:"rgba(245,197,66,.15)",  icon:"⚡", badge:"LLM"     },
  retrieval: { clr:"#a78bfa", bg:"rgba(167,139,250,.15)", icon:"◈", badge:"KB"      },
  decision:  { clr:"#fb923c", bg:"rgba(251,146,60,.15)",  icon:"◆", badge:"DECIDE"  },
  external:  { clr:"#f87171", bg:"rgba(248,113,113,.15)", icon:"⊕", badge:"WEB"     },
  loop:      { clr:"#34d399", bg:"rgba(52,211,153,.15)",  icon:"↻", badge:"LOOP"    },
};

// ── Plain-language explanation of each node category (for newcomers) ──
const TYPE_INFO: Record<NType, { name: string; text: string }> = {
  input:     { name: "Input Stage",     text: "The entry point of the pipeline — the raw question the user typed. Nothing has been processed yet; every stage that follows works to answer this." },
  output:    { name: "Output Stage",    text: "The final result handed back to the user — a grounded answer with citations pointing to the exact source documents the model relied on." },
  process:   { name: "Processing Step", text: "A deterministic data-shaping step that uses no AI. It transforms or prepares data — tokenising text, building the prompt, merging or de-duplicating result lists." },
  llm:       { name: "LLM Call",        text: "A call to the language model (gpt-4o-mini). This is where the heavy thinking happens: generating text, grading documents, or rewriting the query. LLM calls cost money and add latency." },
  retrieval: { name: "Retrieval Step",  text: "A search across the knowledge base to pull back the most relevant documents. This is the 'R' in RAG — fetching real evidence so the model can ground its answer in facts instead of guessing." },
  decision:  { name: "Decision Branch", text: "A fork in the road. The pipeline checks a condition — often by asking the LLM — and picks which path to take next, such as whether retrieval is needed or whether a document is good enough to trust." },
  external:  { name: "Web Search",      text: "A call out to the live internet. Used when the knowledge base alone cannot answer; it brings in fresh, up-to-date information from the open web." },
  loop:      { name: "Iteration Loop",  text: "A repeating cycle. The pipeline runs this stage over and over — reasoning, acting, then observing the result — until it has gathered enough to answer or hits its iteration limit." },
};

// ── Custom node component ───────────────────────────────────────
function RagNode({ data }: { data: RagNodeData }) {
  const p   = PALETTE[data.ntype];
  const done = data.state === "done";
  const act  = data.state === "active";
  const clr  = act ? p.clr : done ? "#4ade80" : "#4a3b10";
  const bg   = act ? p.bg  : done ? "rgba(74,222,128,.07)" : "rgba(255,255,255,.025)";
  const glow = act
    ? `0 0 0 1.5px ${p.clr}88, 0 0 18px ${p.clr}33, 0 2px 12px rgba(0,0,0,.4)`
    : done ? "0 0 0 1px rgba(74,222,128,.35)" : "none";

  return (
    <div style={{
      background: bg, border: `1px solid ${clr}`,
      borderRadius: 10, padding: "7px 12px",
      width: 192, boxShadow: glow,
      transition: "all .4s ease", position: "relative", overflow: "hidden",
      cursor: "help",
    }}>
      {act && (
        <div style={{
          position:"absolute", inset:0, pointerEvents:"none",
          background:"linear-gradient(105deg,transparent 30%,rgba(255,255,255,.05) 50%,transparent 70%)",
          animation:"rf-sweep 2s ease infinite",
        }}/>
      )}
      <Handle type="target" position={Position.Top}
        style={{ background: clr, border:"none", width:7, height:7, top:-4 }} />
      <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom: data.detail ? 2 : 0 }}>
        <span style={{
          fontSize:9, fontWeight:800, letterSpacing:".06em",
          padding:"1px 6px", borderRadius:4, flexShrink:0,
          background: act ? p.clr+"33" : done ? "rgba(74,222,128,.15)" : "rgba(255,255,255,.06)",
          color: act ? p.clr : done ? "#4ade80" : "#6a5520",
        }}>
          {done ? "✓" : p.icon} {done ? "DONE" : p.badge}
        </span>
        <span style={{
          fontSize:12, fontWeight:700, lineHeight:1.25,
          color: act ? p.clr : done ? "#4ade80" : "#c0a855",
          transition:"color .3s",
        }}>
          {data.label}
        </span>
      </div>
      {data.detail && (
        <div style={{ fontSize:10, color: act ? p.clr+"bb" : "#6a5520", lineHeight:1.3, paddingLeft:2 }}>
          {data.detail}
        </div>
      )}
      <Handle type="source" position={Position.Bottom}
        style={{ background: clr, border:"none", width:7, height:7, bottom:-4 }} />
    </div>
  );
}

const NODE_TYPES = { ragStep: RagNode };

// ── Layout constants ─────────────────────────────────────────────
const CX  = 220;   // base x for col 0
const CG  = 270;   // column gap (center-to-center) — wider for 4-col flows
const RH  = 100;   // row height — 100px gives ~44px gap even for tall nodes

// ── Main component ───────────────────────────────────────────────
export default function RagFlowCard({
  strategyValue, activeStep,
}: {
  strategyValue: string; activeStep: number;
}) {
  const spec = FLOWS[strategyValue] ?? FLOWS.naive;
  const [hover, setHover] = useState<RagNodeData | null>(null);

  const { nodes, edges } = useMemo(() => {
    const nodes: Node<RagNodeData>[] = spec.nodes.map(s => ({
      id:   s.id,
      type: "ragStep",
      position: {
        x: CX + (s.col ?? 0) * CG,
        y: s.row * RH,
      },
      data: {
        label:   s.label,
        detail:  s.detail,
        ntype:   s.ntype,
        state:   s.stepIdx < activeStep  ? "done"
               : s.stepIdx === activeStep ? "active"
               : "pending",
      },
    }));

    const edges: Edge[] = spec.edges.map(e => {
      const src = spec.nodes.find(n => n.id === e.source);
      const lit = src != null && src.stepIdx <= activeStep;
      return {
        ...e,
        animated: lit,
        style:    { ...(e.style as object), stroke: lit ? "#f5c542cc" : "#f5c54230", strokeWidth: lit ? 2 : 1.5 },
        markerEnd:{ type: MarkerType.ArrowClosed, color: lit ? "#f5c542" : "#f5c54240", width:12, height:12 },
      };
    });

    return { nodes, edges };
  }, [spec, activeStep]);

  return (
    <div className="rfc-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        minZoom={0.2}
        maxZoom={2.5}
        fitViewOptions={{ padding: 0.18, maxZoom: 0.76 }}
        onInit={rf => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              rf.fitView({ padding: 0.18, maxZoom: 0.76 })
            )
          );
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodeMouseEnter={(_, n) => setHover(n.data as RagNodeData)}
        onNodeMouseLeave={() => setHover(null)}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        preventScrolling={true}
        proOptions={{ hideAttribution: true }}
        style={{ background: "transparent" }}
      >
        <Background color="#2a1a00" gap={24} size={1} style={{ opacity: 0.35 }} />
        <Controls
          showInteractive={false}
          position="bottom-right"
          style={{ bottom: 12, right: 12 }}
        />
      </ReactFlow>

      {/* Hover info card — appears when a step box is hovered */}
      {hover && (() => {
        const p  = PALETTE[hover.ntype];
        const ti = TYPE_INFO[hover.ntype];
        return (
          <div className="rfc-node-tip">
            <div className="rfc-tip-badge" style={{ background: p.clr + "22", color: p.clr, border: `1px solid ${p.clr}55` }}>
              {p.icon} {p.badge}
            </div>
            <div className="rfc-tip-title">{hover.label}</div>
            {hover.detail && <div className="rfc-tip-detail">{hover.detail}</div>}
            <div className="rfc-tip-divider" />
            <div className="rfc-tip-about-label" style={{ color: p.clr }}>{ti.name}</div>
            <div className="rfc-tip-about">{ti.text}</div>
          </div>
        );
      })()}
    </div>
  );
}
