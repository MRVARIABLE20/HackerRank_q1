import type { RagPipeline } from "./types";
import { edge } from "./shared";

const pipeline: RagPipeline = {
  strategy: {
    value: "self_rag", label: "Self-RAG", num: "04", icon: "🪞",
    color: "#34d399",
    tagline: "Retrieve → Reflect → Score → Filter",
    desc: "Adds an LLM-driven reflection layer. The model first decides whether retrieval is needed, then scores each retrieved document on three axes: relevance (isrel), support (issup), and utility (isuse). Only documents passing all three filters are used.",
    plainEnglish: "Before answering, it double-checks its own sources: 'Is this document actually relevant? Does it actually support what I'm about to say?' — like a careful researcher who verifies a source before citing it, instead of citing the first thing found.",
    when: "High-stakes answers requiring document quality assurance. Reduces hallucination by ensuring the LLM only answers from documents it has verified.",
    pros: ["Reduces hallucination", "Adaptive retrieval", "Per-doc quality filtering", "Self-aware"],
    cons: ["3× more LLM calls than Naive RAG", "Reflection adds significant latency", "Strict filtering may discard valid context", "Reflection scores noisy on ambiguous docs"],
    notWhen: "Avoid for real-time or latency-sensitive applications. Not worth the overhead for factual queries on a high-quality, well-curated knowledge base.",
    tags: ["Reflection", "isrel", "issup", "isuse", "Adaptive"],
    perf: { speed: 2, quality: 5, cost: 3, llmCalls: 3 },
    docs: {
      types: ["TXT", "PDF", "MD"],
      content: ["Compliance & legal documents", "Medical or financial records", "High-stakes policy docs", "Audit reports"],
    },
    examples: [
      "What is Self-RAG and how does it use reflection tokens?",
      "What does Victor Frankenstein create in the novel?",
      "What is PyTorch used for?",
    ],
    tech: {
      algorithm: "Three-axis reflection scoring: isrel · issup · isuse (1–5 scale)",
      complexity: "O(N·d + K·LLM) — K scored docs after retrieval",
      deps: ["text-embedding-3-small (OpenAI)", "gpt-4o-mini scorer", "Vector store"],
    },
  },
  steps: [
    { label: "User query received",      detail: "Query enters Self-RAG — model will decide whether retrieval is needed" },
    { label: "Retrieve decision",        detail: "LLM call 1: RETRIEVE or NO_RETRIEVE — adaptive retrieval gate" },
    { label: "Vector search",            detail: "Cosine search (if RETRIEVE) — top-6 docs fetched; else Direct LLM path" },
    { label: "Scoring & filtering docs", detail: "Each doc scored: isrel (relevant) · issup (supported) · isuse (utility 1–5)" },
    { label: "LLM completion",           detail: "gpt-4o-mini answers using only the verified, high-quality docs" },
  ],
  flow: {
    nodes: [
      { id: "n0", label: "User Query",        ntype: "input",    stepIdx: 0, row: 0, col: 0 },
      { id: "n1", label: "Retrieve Decision", ntype: "decision", stepIdx: 1, row: 1, col: 0, detail: "LLM call 1" },
      { id: "n2", label: "Direct LLM",        ntype: "llm",      stepIdx: 2, row: 2, col: -1, detail: "No retrieval" },
      { id: "n3", label: "Vector Search",     ntype: "retrieval",stepIdx: 2, row: 2, col:  1, detail: "Cosine top-6" },
      { id: "n4", label: "Score Each Doc",    ntype: "decision", stepIdx: 3, row: 3, col:  1, detail: "isrel·issup·isuse" },
      { id: "n5", label: "Filter Docs",       ntype: "process",  stepIdx: 3, row: 4, col:  1, detail: "Keep relevant only" },
      { id: "n6", label: "LLM Answer",        ntype: "llm",      stepIdx: 4, row: 5, col:  1, detail: "From filtered docs" },
      { id: "n7", label: "Cited Answer",      ntype: "output",   stepIdx: 4, row: 6, col: 0 },
    ],
    edges: [
      edge("e01","n0","n1"),
      edge("e12","n1","n2","NO_RETR"), edge("e13","n1","n3","RETRIEVE"),
      edge("e34","n3","n4"), edge("e45","n4","n5"), edge("e56","n5","n6"),
      edge("e27","n2","n7"), edge("e67","n6","n7"),
    ],
  },
};

export default pipeline;
