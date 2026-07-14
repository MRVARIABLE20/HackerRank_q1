import type { RagPipeline } from "./types";
import { edge } from "./shared";

const pipeline: RagPipeline = {
  strategy: {
    value: "hybrid", label: "Hybrid RAG", num: "03", icon: "🔀",
    color: "#f5c542",
    tagline: "BM25 + Vector fused with Reciprocal Rank Fusion",
    desc: "Runs BM25 and vector search in parallel, each retrieving 10 candidates. Fuses the ranked lists using Reciprocal Rank Fusion (score = 1/(60+rank+1)) to produce a single unified ranking.",
    plainEnglish: "Combines the 'feels related' search with the 'uses the same words' search and blends both rankings together — so you get the best pick from either approach, not just one.",
    when: "The recommended default for production. Captures both exact keyword matches and semantic similarity, outperforming either approach alone on most benchmarks.",
    pros: ["Best of both worlds", "RRF is parameter-free", "Robust to query variation", "State-of-the-art baseline"],
    cons: ["Higher latency than either search alone", "Two retrieval systems to maintain", "RRF can dilute strong single-signal results", "More complex to debug and tune"],
    notWhen: "Overkill for simple, well-structured corpora where vector search already performs well. Adds unnecessary complexity when query vocabulary is consistent.",
    tags: ["BM25", "Vector Search", "RRF Fusion", "Parallel Retrieval"],
    perf: { speed: 4, quality: 4, cost: 2, llmCalls: 1 },
    docs: {
      types: ["TXT", "CSV", "JSON"],
      content: ["Mixed policy & technical docs", "SLA agreements", "Architecture docs", "Any unstructured corpus"],
    },
    examples: [
      "What is Huckleberry Finn's journey about?",
      "Which cars have the best fuel efficiency in the dataset?",
      "What car models are listed in the Vega Cars data?",
    ],
    tech: {
      algorithm: "Reciprocal Rank Fusion — score = 1 / (60 + rank + 1) summed across lists, then normalised against the theoretical max so the confidence shown is a real 0–100%, not the tiny raw RRF value (~0.03 max)",
      complexity: "O(N·d + N·k) — both searches run in parallel",
      deps: ["text-embedding-3-small (OpenAI)", "rank_bm25", "In-memory vector store"],
    },
  },
  steps: [
    { label: "User query received",     detail: "Query enters the hybrid pipeline — two retrievers will run in parallel" },
    { label: "Dual retrieval",          detail: "BM25 (keyword) + Vector (semantic) both retrieve top-10 candidates simultaneously" },
    { label: "RRF fusion",              detail: "Reciprocal Rank Fusion: score = 1/(60+rank+1) merged across both lists" },
    { label: "Selecting unified top-K", detail: "K=6 documents with highest fused RRF scores selected" },
    { label: "LLM completion",          detail: "gpt-4o-mini answers from the unified fused top-K context" },
  ],
  flow: {
    nodes: [
      { id: "n0", label: "User Query",     ntype: "input",    stepIdx: 0, row: 0, col: 0 },
      { id: "n1", label: "Dual Retrieval", ntype: "decision", stepIdx: 1, row: 1, col: 0, detail: "Both paths in parallel" },
      { id: "n2", label: "BM25 Scoring",   ntype: "retrieval",stepIdx: 1, row: 2, col: -1, detail: "Keyword frequency" },
      { id: "n3", label: "Vector Search",  ntype: "retrieval",stepIdx: 1, row: 2, col:  1, detail: "Cosine similarity" },
      { id: "n4", label: "Top-10 BM25",    ntype: "retrieval",stepIdx: 1, row: 3, col: -1 },
      { id: "n5", label: "Top-10 Vector",  ntype: "retrieval",stepIdx: 1, row: 3, col:  1 },
      { id: "n6", label: "RRF Fusion",     ntype: "process",  stepIdx: 2, row: 4, col: 0, detail: "1/(60+rank+1)" },
      { id: "n7", label: "Top-K Unified",  ntype: "retrieval",stepIdx: 3, row: 5, col: 0, detail: "Best of both" },
      { id: "n8", label: "LLM Completion", ntype: "llm",      stepIdx: 4, row: 6, col: 0, detail: "gpt-4o-mini" },
      { id: "n9", label: "Cited Answer",   ntype: "output",   stepIdx: 4, row: 7, col: 0 },
    ],
    edges: [
      edge("e01","n0","n1"),
      edge("e12","n1","n2","BM25"), edge("e13","n1","n3","Vector"),
      edge("e24","n2","n4"), edge("e35","n3","n5"),
      edge("e46","n4","n6"), edge("e56","n5","n6"),
      edge("e67","n6","n7"), edge("e78","n7","n8"), edge("e89","n8","n9"),
    ],
  },
};

export default pipeline;
