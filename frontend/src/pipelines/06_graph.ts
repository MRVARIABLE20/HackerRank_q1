import type { RagPipeline } from "./types";
import { edge } from "./shared";

const pipeline: RagPipeline = {
  strategy: {
    value: "graph", label: "Graph RAG", num: "06", icon: "🕸️",
    color: "#f87171",
    tagline: "Entity-relationship traversal across the KB",
    desc: "Extracts 2–3 key entities from the query using an LLM call. Performs a vector search per entity, then identifies a follow-on entity from retrieved titles and performs a second weighted search (score × 0.85). Simulates traversal without a dedicated graph DB.",
    plainEnglish: "Follows a trail of related names and topics across documents — like clicking through Wikipedia links from one article to a related one to piece together a fuller picture, instead of reading just one page.",
    when: "Questions that require connecting information across multiple documents (who owns what, which service depends on which team, etc.).",
    pros: ["Multi-entity reasoning", "No graph DB needed", "Cross-document synthesis", "Relation-aware"],
    cons: ["Entity extraction inaccurate on short/vague queries", "Score decay (×0.85) may under-weight hop-2 docs", "Fails on queries with no clear named entities", "Simulated traversal — no real graph DB"],
    notWhen: "Avoid for simple factual queries answerable from a single document. Not effective on flat corpora with no entity relationships (e.g., pure policy text).",
    tags: ["Entity Extraction", "Multi-hop", "Graph Traversal", "Relations"],
    perf: { speed: 3, quality: 4, cost: 3, llmCalls: 2 },
    docs: {
      types: ["TXT", "MD", "PDF"],
      content: ["Org charts & ownership docs", "Service dependency maps", "Incident reports (multi-entity)", "Relationship-heavy knowledge bases"],
    },
    examples: [
      "How does Graph RAG use entity relationships to answer questions?",
      "What is D3.js used for?",
      "What are the main themes in War and Peace?",
    ],
    tech: {
      algorithm: "Entity-hop traversal — Hop 2 score weighted at parent score × 0.85",
      complexity: "O(E · N · d) — E entities extracted, N docs per hop",
      deps: ["text-embedding-3-small (OpenAI)", "gpt-4o-mini entity extractor", "Vector store"],
    },
  },
  steps: [
    { label: "User query received",      detail: "Query enters Graph RAG — entities will be extracted for traversal" },
    { label: "Extracting entities",      detail: "LLM extracts 2–3 key named entities and their relationships" },
    { label: "Hop 1 — entity search",    detail: "Parallel vector search per entity; Merge Results deduplicated" },
    { label: "Identifying next entity",  detail: "LLM selects the follow-on entity from merged document titles" },
    { label: "Hop 2 — follow-on search", detail: "Second vector search weighted at parent score × 0.85; all docs ranked" },
    { label: "LLM completion",           detail: "gpt-4o-mini synthesises cross-document, relation-aware context" },
  ],
  flow: {
    nodes: [
      { id: "n0", label: "User Query",          ntype: "input",    stepIdx: 0, row: 0 },
      { id: "n1", label: "Extract Entities",    ntype: "llm",      stepIdx: 1, row: 1, detail: "2–3 entities" },
      { id: "n2", label: "Hop 1: Entity Search",ntype: "retrieval",stepIdx: 2, row: 2, detail: "Vector per entity" },
      { id: "n3", label: "Merge Results",       ntype: "process",  stepIdx: 2, row: 3 },
      { id: "n4", label: "Next Entity",         ntype: "llm",      stepIdx: 3, row: 4, detail: "From merged titles" },
      { id: "n5", label: "Hop 2: Search",       ntype: "retrieval",stepIdx: 4, row: 5, detail: "Score × 0.85" },
      { id: "n6", label: "Rank All Docs",       ntype: "process",  stepIdx: 4, row: 6 },
      { id: "n7", label: "LLM Answer",          ntype: "llm",      stepIdx: 5, row: 7, detail: "Trace relationships" },
      { id: "n8", label: "Cited Answer",        ntype: "output",   stepIdx: 5, row: 8 },
    ],
    edges: [
      edge("e01","n0","n1"), edge("e12","n1","n2"), edge("e23","n2","n3"),
      edge("e34","n3","n4"), edge("e45","n4","n5"), edge("e56","n5","n6"),
      edge("e67","n6","n7"), edge("e78","n7","n8"),
    ],
  },
};

export default pipeline;
