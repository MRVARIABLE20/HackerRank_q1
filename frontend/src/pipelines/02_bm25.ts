import type { RagPipeline } from "./types";
import { edge } from "./shared";

const pipeline: RagPipeline = {
  strategy: {
    value: "bm25", label: "BM25 RAG", num: "02", icon: "🔍",
    color: "#a78bfa",
    tagline: "Keyword frequency scoring (Okapi BM25)",
    desc: "Uses the Okapi BM25 algorithm — a probabilistic ranking function that scores documents by term frequency and inverse document frequency. No embeddings required.",
    plainEnglish: "Like using Ctrl+F across your whole knowledge base — it finds documents that use the same words as your question, not documents that merely mean the same thing.",
    when: "Excellent for keyword-heavy or technical queries where exact term matching is critical. Outperforms vector search when vocabulary is domain-specific.",
    pros: ["No GPU required", "Handles rare terms well", "Explainable scores", "Fast on small corpora"],
    cons: ["No semantic understanding — 'car' ≠ 'automobile'", "Fails on paraphrase or synonym queries", "No contextual ranking", "Breaks on non-English without custom tokenisation"],
    notWhen: "Avoid when queries are conversational or use synonyms freely, when documents use domain jargon inconsistently, or when semantic meaning matters more than exact term overlap.",
    tags: ["BM25", "TF-IDF", "Keyword Matching"],
    perf: { speed: 5, quality: 2, cost: 1, llmCalls: 1 },
    docs: {
      types: ["TXT", "CSV", "JSON"],
      content: ["Technical specifications", "API references", "Audit logs", "Keyword-dense compliance docs"],
    },
    examples: [
      "Who is Sherlock Holmes and what cases does he solve?",
      "What was the survival rate for first-class passengers on the Titanic?",
      "What movies are in the Vega Movies dataset?",
    ],
    tech: {
      algorithm: "Okapi BM25 — TF × IDF with length normalisation (k1=1.5, b=0.75)",
      complexity: "O(N · k) per query — N docs, k unique query terms",
      deps: ["rank_bm25 Python library", "No embedding model required"],
    },
  },
  steps: [
    { label: "User query received",   detail: "Query enters the BM25 pipeline — no embeddings required" },
    { label: "Tokenizing query",      detail: "Lowercase split into individual terms for BM25 scoring" },
    { label: "BM25 scoring",          detail: "TF × IDF with length normalisation (k1=1.5, b=0.75)" },
    { label: "Ranking & normalizing", detail: "Raw BM25 scores mapped to [0, 1] range" },
    { label: "Selecting top-K docs",  detail: "K=6 highest BM25-scored documents selected" },
    { label: "LLM completion",        detail: "gpt-4o-mini generates cited answer from keyword-matched docs" },
  ],
  flow: {
    nodes: [
      { id: "n0", label: "User Query",     ntype: "input",    stepIdx: 0, row: 0 },
      { id: "n1", label: "Tokenize Query", ntype: "process",  stepIdx: 1, row: 1, detail: "Lowercase split" },
      { id: "n2", label: "BM25 Scoring",   ntype: "retrieval",stepIdx: 2, row: 2, detail: "TF × IDF across KB" },
      { id: "n3", label: "Rank & Normalise",ntype:"process",  stepIdx: 3, row: 3, detail: "Scores → [0,1]" },
      { id: "n4", label: "Top-K Docs",     ntype: "retrieval",stepIdx: 4, row: 4, detail: "K=6 highest" },
      { id: "n5", label: "LLM Completion", ntype: "llm",      stepIdx: 5, row: 5, detail: "gpt-4o-mini" },
      { id: "n6", label: "Cited Answer",   ntype: "output",   stepIdx: 5, row: 6 },
    ],
    edges: [
      edge("e01","n0","n1"), edge("e12","n1","n2"), edge("e23","n2","n3"),
      edge("e34","n3","n4"), edge("e45","n4","n5"), edge("e56","n5","n6"),
    ],
  },
};

export default pipeline;
