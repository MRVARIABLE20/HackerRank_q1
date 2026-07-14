import type { RagPipeline } from "./types";
import { edge } from "./shared";

const pipeline: RagPipeline = {
  strategy: {
    value: "rag_fusion", label: "RAG-Fusion", num: "08", icon: "🌀",
    color: "#6aa9ff",
    tagline: "Multi-query parallel sub-searches + RRF",
    desc: "Generates 3 alternative phrasings of the original query using an LLM call, then runs all 4 queries (original + 3 sub-queries) in parallel through the vector store. Fuses all ranked lists with RRF for maximum coverage.",
    plainEnglish: "Rephrases your question a few different ways behind the scenes, searches for all of them, then combines the best results — useful when there's more than one way to ask the same thing and a single phrasing might miss the answer.",
    when: "Ambiguous or multi-faceted queries where a single phrasing might miss relevant documents. Useful for research-style questions.",
    pros: ["Multi-perspective retrieval", "Handles ambiguity", "Parallel execution", "Broad coverage"],
    cons: ["4× more vector searches than Naive RAG", "LLM query expansion adds one extra call", "RRF can dilute highly specific results", "Higher cost on large vector stores"],
    notWhen: "Avoid for simple, unambiguous queries where one phrasing is sufficient. Overkill on small, well-structured knowledge bases with consistent vocabulary.",
    tags: ["Query Expansion", "Multi-query", "Parallel", "RRF"],
    perf: { speed: 3, quality: 5, cost: 3, llmCalls: 2 },
    docs: {
      types: ["TXT", "PDF", "MD"],
      content: ["Research papers & literature", "Multi-topic policy collections", "Broad knowledge bases", "Ambiguous or synonym-heavy corpora"],
    },
    examples: [
      "What is dense passage retrieval and how does it work?",
      "What is FastAPI used for?",
      "Who is Count Dracula?",
    ],
    tech: {
      algorithm: "Query expansion (LLM) → 4× parallel vector search → RRF fusion across all ranked lists, normalised to a real 0–100% confidence (the raw RRF score alone maxes out around 0.03)",
      complexity: "O(4 · N · d + LLM) — 4 parallel searches fused with RRF",
      deps: ["text-embedding-3-small (OpenAI)", "gpt-4o-mini query expander", "Vector store"],
    },
  },
  steps: [
    { label: "User query received",    detail: "Query enters RAG-Fusion — 3 alternative phrasings will be generated" },
    { label: "Generating sub-queries", detail: "LLM creates 3 alternative phrasings of the original query" },
    { label: "Parallel vector search", detail: "4 queries (original + 3 sub-queries) run simultaneously through vector store" },
    { label: "RRF fusion + top-K",     detail: "Reciprocal Rank Fusion across all 4 ranked lists; unified top-K selected" },
    { label: "LLM completion",         detail: "gpt-4o-mini answers from the multi-perspective fused context" },
  ],
  flow: {
    nodes: [
      { id: "n0", label: "User Query",      ntype: "input",    stepIdx: 0, row: 0, col: 0 },
      { id: "n1", label: "Generate Sub-Qs", ntype: "llm",      stepIdx: 1, row: 1, col: 0, detail: "3 alternatives" },
      { id: "n2", label: "Original Search", ntype: "retrieval",stepIdx: 2, row: 2, col: -1.5, detail: "Top-6" },
      { id: "n3", label: "Sub-Q 1 Search",  ntype: "retrieval",stepIdx: 2, row: 2, col: -0.5, detail: "Top-6" },
      { id: "n4", label: "Sub-Q 2 Search",  ntype: "retrieval",stepIdx: 2, row: 2, col:  0.5, detail: "Top-6" },
      { id: "n5", label: "Sub-Q 3 Search",  ntype: "retrieval",stepIdx: 2, row: 2, col:  1.5, detail: "Top-6" },
      { id: "n6", label: "RRF Fusion",      ntype: "process",  stepIdx: 3, row: 3, col: 0, detail: "1/(60+rank+1) × 4" },
      { id: "n7", label: "Top-K Unified",   ntype: "retrieval",stepIdx: 3, row: 4, col: 0 },
      { id: "n8", label: "LLM Completion",  ntype: "llm",      stepIdx: 4, row: 5, col: 0, detail: "gpt-4o-mini" },
      { id: "n9", label: "Cited Answer",    ntype: "output",   stepIdx: 4, row: 6, col: 0 },
    ],
    edges: [
      edge("e01","n0","n1"),
      edge("e12","n1","n2"), edge("e13","n1","n3"),
      edge("e14","n1","n4"), edge("e15","n1","n5"),
      edge("e26","n2","n6"), edge("e36","n3","n6"),
      edge("e46","n4","n6"), edge("e56","n5","n6"),
      edge("e67","n6","n7"), edge("e78","n7","n8"), edge("e89","n8","n9"),
    ],
  },
};

export default pipeline;
