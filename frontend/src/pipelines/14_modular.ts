import type { RagPipeline } from "./types";
import { edge } from "./shared";

const pipeline: RagPipeline = {
  strategy: {
    value: "modular", label: "Modular RAG", num: "14", icon: "🧩",
    color: "#f5c542",
    tagline: "Detects query type and routes to best module",
    desc: "Classifies the query type using an LLM call (numerical, visual, relational, current, or factual) and routes to the matching module: SQL for numerical, Multimodal for visual, Graph for relational, Corrective for current/time-sensitive, Hybrid for general factual. If the routed module comes back with no real answer, it automatically retries against Modular's own knowledge base before giving up — so a document living in Modular's own category is never unreachable just because a query happened to sound numerical or visual.",
    plainEnglish: "Figures out what KIND of question you're asking, then hands it off to whichever specialist strategy — SQL, vision, graph, live web, plain search — is best suited to actually answer it.",
    when: "Mixed-content knowledge bases. A single endpoint that intelligently selects the retrieval module best suited to each query type.",
    pros: ["Type-aware routing", "Single endpoint", "Modular design", "Auto-fallback to its own KB if routing misses"],
    cons: ["Classifier can misroute the query", "Depends on all sub-modules being healthy", "Highest system complexity of all 14 strategies", "Debugging requires knowledge of multiple modules"],
    notWhen: "Avoid for homogeneous knowledge bases (all text, all SQL, etc.). The routing overhead is wasted if only one module would ever be selected.",
    tags: ["Routing", "Modular", "Multi-modal", "Type Detection"],
    perf: { speed: 3, quality: 5, cost: 3, llmCalls: 2 },
    docs: {
      types: ["TXT", "PDF", "CSV", "JSON"],
      content: ["Mixed corpora (text + tables + visuals)", "Enterprise knowledge bases", "Any document type — module selected automatically"],
    },
    examples: [
      "What is the attention mechanism in the Transformer?",
      "What is Jane Eyre's relationship with Mr. Rochester?",
      "What was the stock price trend in the Vega Stocks data?",
    ],
    tech: {
      algorithm: "LLM type classifier → module dispatch: numerical→SQL · visual→Multimodal · relational→Graph · current→Corrective · factual→Hybrid, with fallback to Modular's own KB on a dead-end route",
      complexity: "O(LLM + module cost) — one classifier call plus the routed module's own complexity",
      deps: ["gpt-4o-mini classifier", "SQL module (DuckDB)", "Multimodal module (vision)", "Graph module", "Corrective module", "Hybrid module"],
    },
  },
  steps: [
    { label: "User query received",   detail: "Query enters Modular RAG — type classifier will select the best module" },
    { label: "Classifying query type",detail: "LLM classifies: numerical → SQL · visual → Multimodal · relational → Graph · semantic → Hybrid" },
    { label: "Routing to module",     detail: "Full pipeline of the matched module (SQL / Multimodal / Graph / Hybrid) dispatched" },
    { label: "LLM completion",        detail: "gpt-4o-mini delivers the module-appropriate answer with route info" },
  ],
  flow: {
    nodes: [
      { id: "n0", label: "User Query",          ntype: "input",   stepIdx: 0, row: 0, col: 0 },
      { id: "n1", label: "Type Classifier",     ntype: "llm",     stepIdx: 1, row: 1, col: 0, detail: "numerical/visual/..." },
      { id: "n2", label: "SQL RAG",             ntype: "process", stepIdx: 2, row: 2, col: -1.5, detail: "numerical" },
      { id: "n3", label: "Multimodal",          ntype: "process", stepIdx: 2, row: 2, col: -0.5, detail: "visual" },
      { id: "n4", label: "Graph RAG",           ntype: "process", stepIdx: 2, row: 2, col:  0.5, detail: "relational" },
      { id: "n5", label: "Hybrid / Corrective", ntype: "process", stepIdx: 2, row: 2, col:  1.5, detail: "factual" },
      { id: "n6", label: "Execute Module",      ntype: "loop",    stepIdx: 3, row: 3, col: 0, detail: "Full pipeline" },
      { id: "n7", label: "Answer + Route",      ntype: "output",  stepIdx: 3, row: 4, col: 0 },
    ],
    edges: [
      edge("e01","n0","n1"),
      edge("e12","n1","n2","numerical"), edge("e13","n1","n3","visual"),
      edge("e14","n1","n4","relational"), edge("e15","n1","n5","factual"),
      edge("e26","n2","n6"), edge("e36","n3","n6"),
      edge("e46","n4","n6"), edge("e56","n5","n6"),
      edge("e67","n6","n7"),
    ],
  },
};

export default pipeline;
