import type { RagPipeline } from "./types";
import { edge } from "./shared";

const pipeline: RagPipeline = {
  strategy: {
    value: "agentic", label: "Agentic RAG", num: "10", icon: "🤖",
    color: "#a78bfa",
    tagline: "ReAct loop with live tool-calling",
    desc: "Full ReAct (Reason + Act) agent loop. The LLM thinks, selects a tool (kb_search, web_search, calculator), observes the result, then decides whether to act again or produce a final answer. Up to 8 iterations.",
    plainEnglish: "Acts like a research assistant with tools laid out on the desk — it can search the knowledge base, search the web, or do math, deciding step by step what it still needs before it's ready to answer you.",
    when: "Complex multi-step queries requiring tool use: arithmetic over retrieved data, cross-referencing KB with the web, or queries requiring multiple search iterations.",
    pros: ["Tool use", "Multi-step reasoning", "Web + KB hybrid", "Iterative refinement"],
    cons: ["Up to 8× more LLM calls — very expensive", "Non-deterministic across runs", "Hard to debug multi-step reasoning chains", "Latency can reach 10–30s on complex queries"],
    notWhen: "Avoid for simple factual queries, latency-sensitive applications, or fixed-budget use cases. Not suitable for batch processing at scale.",
    tags: ["ReAct", "Tool Use", "Agent Loop", "Iterative"],
    perf: { speed: 1, quality: 5, cost: 5, llmCalls: 8 },
    docs: {
      types: ["TXT", "PDF", "CSV", "JSON", "Live Web"],
      content: ["Multi-source knowledge bases", "Tabular data (needs calculation)", "Live web data via Tavily", "Any doc requiring cross-source reasoning"],
    },
    examples: [
      "What is the ReAct framework for reasoning and acting?",
      "What advice does Machiavelli give in The Prince?",
      "What is the average price of diamonds in the dataset?",
    ],
    tech: {
      algorithm: "ReAct loop — Think → Act (tool) → Observe → repeat, max 8 iterations",
      complexity: "O(I · T) — I iterations × T tool call cost; worst case 8 LLM calls",
      deps: ["gpt-4o-mini agent", "kb_search tool", "Tavily web_search", "Calculator tool"],
    },
  },
  steps: [
    { label: "User query received",    detail: "Query enters the ReAct agent loop — max 8 Think·Act·Observe iterations" },
    { label: "Initializing ReAct agent",detail: "Agent state initialised with tools: kb_search, web_search, calculator" },
    { label: "Thinking (LLM)",         detail: "LLM reasons about what information is needed and which tool to call" },
    { label: "Tool execution",         detail: "kb_search / web_search / calculator called; or FINAL_ANSWER triggered" },
    { label: "Observing & looping",    detail: "Tool result appended to history; agent decides to loop or finish" },
    { label: "Delivering final answer", detail: "gpt-4o-mini synthesises all tool observations into the final response" },
  ],
  flow: {
    nodes: [
      { id: "n0", label: "User Query",     ntype: "input",    stepIdx: 0, row: 0, col: 0 },
      { id: "n1", label: "Init ReAct",     ntype: "process",  stepIdx: 1, row: 1, col: 0, detail: "Think·Act·Observe" },
      { id: "n2", label: "Think (LLM)",    ntype: "llm",      stepIdx: 2, row: 2, col: 0, detail: "Reason next action" },
      { id: "n3", label: "kb_search",      ntype: "retrieval",stepIdx: 3, row: 3, col: -1, detail: "Top-2 KB docs" },
      { id: "n4", label: "web_search",     ntype: "external", stepIdx: 3, row: 3, col: 0, detail: "Tavily live" },
      { id: "n5", label: "calculator",     ntype: "process",  stepIdx: 3, row: 3, col: 1, detail: "Safe eval" },
      { id: "n6", label: "FINAL_ANSWER",   ntype: "output",   stepIdx: 3, row: 4, col: 0, detail: "Exit condition" },
      { id: "n7", label: "Observe & Loop", ntype: "loop",     stepIdx: 4, row: 5, col: 0, detail: "Max 8 iterations" },
      { id: "n8", label: "Final Answer",   ntype: "output",   stepIdx: 5, row: 6, col: 0 },
    ],
    edges: [
      edge("e01","n0","n1"), edge("e12","n1","n2"),
      edge("e23","n2","n3","kb_search"), edge("e24","n2","n4","web"),
      edge("e25","n2","n5","calc"),      edge("e26","n2","n6","FINAL"),
      edge("e37","n3","n7"), edge("e47","n4","n7"), edge("e57","n5","n7"),
      edge("e72","n7","n2","loop"),
      edge("e68","n6","n8"),
    ],
  },
};

export default pipeline;
