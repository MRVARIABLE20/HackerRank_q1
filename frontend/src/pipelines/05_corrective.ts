import type { RagPipeline } from "./types";
import { edge } from "./shared";

const pipeline: RagPipeline = {
  strategy: {
    value: "corrective", label: "Corrective RAG", num: "05", icon: "✅",
    color: "#fb923c",
    tagline: "Grade KB quality → web fallback if needed",
    desc: "After retrieving from the KB, grades the top document as CORRECT, AMBIGUOUS, or INCORRECT. If the grade is not CORRECT, it triggers a live Tavily web search and merges KB + web context before answering.",
    plainEnglish: "It grades its own knowledge base first — if the answer looks weak, incomplete, or out of date, it goes and checks the live internet before responding, instead of confidently giving you a stale answer.",
    when: "Knowledge bases with stale or incomplete data. Any domain where web currency matters (recent events, updated regulations).",
    pros: ["Self-correcting", "Live web fallback", "Freshness guarantee", "Graceful degradation"],
    cons: ["Requires Tavily API key and internet access", "Web results can introduce noise or bias", "Grading LLM call adds latency", "Unpredictable cost if fallback fires frequently"],
    notWhen: "Avoid in air-gapped or offline environments. Not needed when the KB is well-maintained and current — the web fallback adds unnecessary cost.",
    tags: ["Grading", "Web Search", "Tavily", "Corrective"],
    perf: { speed: 3, quality: 5, cost: 3, llmCalls: 2 },
    docs: {
      types: ["TXT", "PDF", "MD", "Live Web"],
      content: ["Regulation & compliance docs", "Time-sensitive news or advisories", "Stale KB documents", "Merged KB + web context"],
    },
    examples: [
      "What is Corrective RAG and how does it grade retrieved documents?",
      "What is the significance of Sydney Carton in A Tale of Two Cities?",
      "What is the current price of Bitcoin today?",
    ],
    tech: {
      algorithm: "Grade → Route → Merge: CORRECT / AMBIGUOUS / INCORRECT decision tree",
      complexity: "O(N·d + LLM) for KB path; O(N·d + LLM + Web) for fallback path",
      deps: ["Tavily Search API (live web)", "gpt-4o-mini grader", "text-embedding-3-small"],
    },
  },
  steps: [
    { label: "User query received", detail: "Query enters Corrective RAG — KB quality will be graded" },
    { label: "Vector search",       detail: "Cosine similarity retrieval — top-K documents from the KB" },
    { label: "Grading top doc",     detail: "LLM grades the top document: CORRECT / AMBIGUOUS / INCORRECT" },
    { label: "LLM completion",      detail: "CORRECT → KB only; AMBIGUOUS/INCORRECT → Tavily web fallback merged with KB" },
  ],
  flow: {
    nodes: [
      { id: "n0", label: "User Query",        ntype: "input",    stepIdx: 0, row: 0, col: 0 },
      { id: "n1", label: "Vector Search",     ntype: "retrieval",stepIdx: 1, row: 1, col: 0, detail: "Top-K from KB" },
      { id: "n2", label: "Grade Top Doc",     ntype: "decision", stepIdx: 2, row: 2, col: 0, detail: "CORRECT/AMBIGUOUS" },
      { id: "n3", label: "LLM Answer",        ntype: "llm",      stepIdx: 3, row: 3, col: -1, detail: "From KB docs" },
      { id: "n4", label: "Tavily Web Search", ntype: "external", stepIdx: 3, row: 3, col:  1, detail: "Live results" },
      { id: "n5", label: "Combine KB + Web",  ntype: "process",  stepIdx: 3, row: 4, col:  1 },
      { id: "n6", label: "LLM Answer",        ntype: "llm",      stepIdx: 3, row: 5, col:  1 },
      { id: "n7", label: "Cited Answer",      ntype: "output",   stepIdx: 3, row: 6, col: 0 },
    ],
    edges: [
      edge("e01","n0","n1"), edge("e12","n1","n2"),
      edge("e23","n2","n3","CORRECT"), edge("e24","n2","n4","AMBIGUOUS"),
      edge("e45","n4","n5"), edge("e56","n5","n6"),
      edge("e37","n3","n7"), edge("e67","n6","n7"),
    ],
  },
};

export default pipeline;
