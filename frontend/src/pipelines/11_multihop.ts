import type { RagPipeline } from "./types";
import { edge } from "./shared";

const pipeline: RagPipeline = {
  strategy: {
    value: "multihop", label: "Multi-hop RAG", num: "11", icon: "🪜",
    color: "#fb923c",
    tagline: "Chain retrieval hops across document boundaries",
    desc: "Performs iterative retrieval. After each hop it asks: is the context sufficient? If not, it generates a follow-up query from the retrieved titles and performs another hop. All results from all hops are merged and deduplicated.",
    plainEnglish: "For questions that need more than one fact chained together — it searches, checks whether it now has enough to answer, and if not, searches again using what it just learned, instead of giving up after one lookup.",
    when: "Questions that span multiple documents (e.g., 'Who owns the team responsible for the service that had the SLA breach?'). Answers require chaining facts.",
    pros: ["Deep KB traversal", "Automatic follow-up", "No hop limit (configurable)", "Chain-of-thought"],
    cons: ["Multiple retrieval + LLM calls per query", "Hop chain can go off-track on noisy doc titles", "Deduplication may drop valid similar docs", "No hard hop limit — potential runaway cost"],
    notWhen: "Avoid for queries answerable from a single document. Adds overhead when the KB is flat and documents do not reference or depend on each other.",
    tags: ["Multi-hop", "Iterative Retrieval", "Sufficiency Check", "Chaining"],
    perf: { speed: 2, quality: 5, cost: 3, llmCalls: 3 },
    docs: {
      types: ["TXT", "PDF", "MD"],
      content: ["Interconnected org & ownership docs", "Service dependency documentation", "Chained incident reports", "Knowledge bases with cross-references"],
    },
    examples: [
      "How does GPT-3 perform few-shot learning across tasks?",
      "What crime does Raskolnikov commit and why?",
      "What is Node.js used for?",
    ],
    tech: {
      algorithm: "Iterative retrieval with LLM sufficiency gate — follow-up query generated from retrieved titles",
      complexity: "O(H · N · d + H · LLM) — H hops, each triggering a new search",
      deps: ["text-embedding-3-small (OpenAI)", "gpt-4o-mini sufficiency judge", "Vector store"],
    },
  },
  steps: [
    { label: "User query received",     detail: "Query enters Multi-hop RAG — iterative retrieval hops will be chained" },
    { label: "Hop 1 — vector search",   detail: "Initial cosine similarity retrieval on the original query" },
    { label: "Sufficiency check",       detail: "LLM gate: is the retrieved context enough to answer fully?" },
    { label: "Follow-up query → hop N", detail: "LLM generates next search query from retrieved titles; Hop N runs" },
    { label: "Merging all hop results", detail: "Deduplicated union of all hops, ranked by retrieval score" },
    { label: "LLM completion",          detail: "gpt-4o-mini synthesises the full chained multi-hop context" },
  ],
  flow: {
    nodes: [
      { id: "n0", label: "User Query",      ntype: "input",    stepIdx: 0, row: 0, col: 0 },
      { id: "n1", label: "Hop 1: Search",   ntype: "retrieval",stepIdx: 1, row: 1, col: 0, detail: "Original query" },
      { id: "n2", label: "Sufficient?",     ntype: "decision", stepIdx: 2, row: 2, col: 0, detail: "LLM check" },
      { id: "n3", label: "Proceed",         ntype: "process",  stepIdx: 3, row: 3, col: -1, detail: "Enough context" },
      { id: "n4", label: "Follow-up Query", ntype: "llm",      stepIdx: 3, row: 3, col:  1, detail: "LLM next question" },
      { id: "n5", label: "Hop N: Search",   ntype: "retrieval",stepIdx: 3, row: 4, col:  1, detail: "Max 3 hops" },
      { id: "n6", label: "Merge Results",   ntype: "process",  stepIdx: 4, row: 5, col: 0, detail: "Deduplicated" },
      { id: "n7", label: "Synthesise",      ntype: "llm",      stepIdx: 5, row: 6, col: 0, detail: "All hop context" },
      { id: "n8", label: "Cited Answer",    ntype: "output",   stepIdx: 5, row: 7, col: 0 },
    ],
    edges: [
      edge("e01","n0","n1"), edge("e12","n1","n2"),
      edge("e23","n2","n3","YES"), edge("e24","n2","n4","NO"),
      edge("e45","n4","n5"), edge("e52","n5","n2","re-check"),
      edge("e36","n3","n6"), edge("e67","n6","n7"), edge("e78","n7","n8"),
    ],
  },
};

export default pipeline;
