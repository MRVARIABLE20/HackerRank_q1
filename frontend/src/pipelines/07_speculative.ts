import type { RagPipeline } from "./types";
import { edge } from "./shared";

const pipeline: RagPipeline = {
  strategy: {
    value: "speculative", label: "Speculative RAG", num: "07", icon: "💭",
    color: "#c0b488",
    tagline: "Draft fast · verify with full context",
    desc: "Two-phase generation. Phase 1: generate a fast draft answer using only the top document. Phase 2: verify the draft against the full K-document context. The verifier can CONFIRM (use draft), CORRECT (fix errors), or REJECT (regenerate).",
    plainEnglish: "Writes a quick first-draft answer, then double-checks it against everything else before finalizing — fast AND careful, like sketching an answer and then fact-checking it before you say it out loud.",
    when: "Scenarios where latency matters but accuracy cannot be sacrificed. The fast draft captures 80% of cases; the verifier catches mistakes.",
    pros: ["Latency-optimised", "Self-verification", "Draft reuse", "Quality control"],
    cons: ["Always 2 LLM calls even when draft is perfect", "REJECT verdict triggers full regeneration cost", "Draft quality depends on the top document only", "Verifier can introduce its own errors"],
    notWhen: "Avoid when single-pass answers are acceptable or latency is critical. Not suitable for very short/simple queries where speculation overhead outweighs the benefit.",
    tags: ["Speculation", "Verification", "Draft", "Two-phase"],
    perf: { speed: 4, quality: 4, cost: 3, llmCalls: 2 },
    docs: {
      types: ["TXT", "PDF", "MD"],
      content: ["Long-form reports & runbooks", "Technical documentation", "Policy documents", "Any doc where fast answers are expected"],
    },
    examples: [
      "What is chain-of-thought reasoning in language models?",
      "Who is Captain Ahab and what is he hunting?",
      "What is NumPy used for?",
    ],
    tech: {
      algorithm: "Two-phase: Draft (top-1 doc) → Verify (K-doc context) → CONFIRM / CORRECT / REJECT",
      complexity: "O(N·d + 2·LLM) — two LLM calls regardless of verdict",
      deps: ["text-embedding-3-small (OpenAI)", "gpt-4o-mini drafter", "gpt-4o-mini verifier"],
    },
  },
  steps: [
    { label: "User query received", detail: "Query enters Speculative RAG — fast draft then verify" },
    { label: "Vector search",       detail: "Top-K documents retrieved from the knowledge base" },
    { label: "Drafting answer",     detail: "LLM call 1: fast speculative draft using only the top document" },
    { label: "Verifying draft",     detail: "LLM call 2: verifier checks draft against full K-doc context" },
    { label: "LLM completion",      detail: "CONFIRMED → use draft · CORRECTED → fix errors · REJECTED → regenerate" },
  ],
  flow: {
    nodes: [
      { id: "n0", label: "User Query",     ntype: "input",    stepIdx: 0, row: 0, col: 0 },
      { id: "n1", label: "Vector Search",  ntype: "retrieval",stepIdx: 1, row: 1, col: 0, detail: "Top-K docs" },
      { id: "n2", label: "Draft Answer",   ntype: "llm",      stepIdx: 2, row: 2, col: 0, detail: "LLM call 1" },
      { id: "n3", label: "Verify Draft",   ntype: "decision", stepIdx: 3, row: 3, col: 0, detail: "LLM call 2" },
      { id: "n4", label: "Use Draft",      ntype: "process",  stepIdx: 4, row: 4, col: -1, detail: "CONFIRMED" },
      { id: "n5", label: "Replace Answer", ntype: "llm",      stepIdx: 4, row: 4, col:  1, detail: "CORRECTED" },
      { id: "n6", label: "Final Answer",   ntype: "output",   stepIdx: 4, row: 5, col: 0 },
    ],
    edges: [
      edge("e01","n0","n1"), edge("e12","n1","n2"), edge("e23","n2","n3"),
      edge("e34","n3","n4","CONFIRMED"), edge("e35","n3","n5","REJECTED"),
      edge("e46","n4","n6"), edge("e56","n5","n6"),
    ],
  },
};

export default pipeline;
