import type { RagPipeline } from "./types";
import { edge } from "./shared";

const pipeline: RagPipeline = {
  strategy: {
    value: "adaptive", label: "Adaptive RAG", num: "09", icon: "🎯",
    color: "#4ade80",
    tagline: "Auto-routes by query complexity class",
    desc: "Classifies incoming queries into 5 complexity classes (0–4) using an LLM call. Class 0 answers directly from the LLM. Classes 1–2 use Naive or Hybrid. Classes 3–4 trigger Multi-hop or Agentic pipelines.",
    plainEnglish: "Sizes up how hard your question is first, then picks the simplest tool that can actually answer it — cheap and fast for easy questions, brings out the more powerful (and more expensive) strategies only when the question actually needs them.",
    when: "High-volume production systems where different queries deserve different treatment. Minimises cost for simple queries while applying power to complex ones.",
    pros: ["Cost-proportional", "Auto-scaling", "Single endpoint", "5-tier routing"],
    cons: ["Classifier LLM call adds overhead to every query", "Misclassification routes to wrong strategy", "Harder to debug — different code paths per query", "Strategy switching produces inconsistent UX"],
    notWhen: "Avoid when all queries are similar in complexity. Adds unnecessary routing overhead if one strategy already handles the entire use case well.",
    tags: ["Routing", "Complexity", "Multi-strategy", "Adaptive"],
    perf: { speed: 4, quality: 4, cost: 2, llmCalls: 2 },
    docs: {
      types: ["TXT", "PDF", "CSV", "MD", "JSON"],
      content: ["Any document type — routing selects the right strategy", "Works across structured and unstructured data", "Scales from trivial FAQs to complex multi-hop queries"],
    },
    examples: [
      "What is the population trend over the years in the data?",
      "What is Flask used for?",
      "What strange things happen to Alice in Wonderland?",
    ],
    tech: {
      algorithm: "5-class complexity classifier (0=direct · 1=naive · 2=hybrid · 3=multihop · 4=agentic)",
      complexity: "O(LLM + strategy cost) — classifier overhead is one LLM call",
      deps: ["gpt-4o-mini classifier", "All downstream strategy dependencies"],
    },
  },
  steps: [
    { label: "User query received",   detail: "Query enters Adaptive RAG — complexity will be classified before routing" },
    { label: "Classifying complexity",detail: "LLM assigns class 0 (trivial) to 4 (very complex) using one call" },
    { label: "Routing to pipeline",   detail: "Class 0 → Direct LLM · 1 → Naive · 2 → Hybrid · 3–4 → Multihop/Agentic" },
    { label: "LLM completion",        detail: "gpt-4o-mini answers via the strategy selected for this query's complexity" },
  ],
  flow: {
    nodes: [
      { id: "n0", label: "User Query",          ntype: "input",    stepIdx: 0, row: 0, col: 0 },
      { id: "n1", label: "Classify Complexity", ntype: "decision", stepIdx: 1, row: 1, col: 0, detail: "LLM: class 0–4" },
      { id: "n2", label: "Direct LLM",          ntype: "llm",      stepIdx: 2, row: 2, col: -1.5, detail: "Class 0" },
      { id: "n3", label: "Naive Top-3",         ntype: "retrieval",stepIdx: 2, row: 2, col: -0.5, detail: "Class 1" },
      { id: "n4", label: "Hybrid RAG",          ntype: "loop",     stepIdx: 2, row: 2, col:  0.5, detail: "Class 2" },
      { id: "n5", label: "Multihop / Correct",  ntype: "loop",     stepIdx: 2, row: 2, col:  1.5, detail: "Class 3–4" },
      { id: "n6", label: "LLM Completion",      ntype: "llm",      stepIdx: 3, row: 3, col: 0 },
      { id: "n7", label: "Cited Answer",        ntype: "output",   stepIdx: 3, row: 4, col: 0 },
    ],
    edges: [
      edge("e01","n0","n1"),
      edge("e12","n1","n2","0"), edge("e13","n1","n3","1"),
      edge("e14","n1","n4","2"), edge("e15","n1","n5","3-4"),
      edge("e26","n2","n6"), edge("e36","n3","n6"),
      edge("e46","n4","n6"), edge("e56","n5","n6"),
      edge("e67","n6","n7"),
    ],
  },
};

export default pipeline;
