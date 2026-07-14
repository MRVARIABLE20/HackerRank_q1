import type { RagPipeline } from "./types";
import { edge } from "./shared";

const pipeline: RagPipeline = {
  strategy: {
    value: "naive", label: "Naive RAG", num: "01", icon: "⚡",
    color: "#6aa9ff",
    tagline: "Vector cosine similarity search",
    desc: "The foundational RAG pattern. Encodes the user query into a dense vector and retrieves the K nearest documents by cosine similarity, then injects them into the LLM context.",
    plainEnglish: "Imagine a librarian who finds the books that 'feel' most related to your question by meaning, then reads you the relevant bits — even if you didn't use the exact same words as the book.",
    when: "Best for well-structured corpora where semantic similarity reliably captures relevance. Ideal starting point and production baseline.",
    pros: ["Simplest implementation", "Low latency", "Predictable cost", "No external dependencies"],
    cons: ["Misses exact keyword matches", "Fails on domain-specific jargon", "No doc quality filtering", "Hallucinations from noisy context"],
    notWhen: "Avoid for keyword-critical searches (legal citations, model numbers), queries needing fresh web data, or high-stakes domains where hallucination risk is unacceptable.",
    tags: ["Vector Search", "Embeddings", "Cosine Similarity"],
    perf: { speed: 5, quality: 3, cost: 1, llmCalls: 1 },
    docs: {
      types: ["TXT", "PDF", "MD"],
      content: ["Policy documents", "Runbooks & guides", "General unstructured text", "Knowledge articles"],
    },
    examples: [
      "What is retrieval-augmented generation and how does it work?",
      "Who is Mr. Darcy in Pride and Prejudice?",
      "What is the Hugging Face Transformers library used for?",
    ],
    tech: {
      algorithm: "Approximate Nearest Neighbour (cosine similarity)",
      complexity: "O(N · d) per query — N docs, d dimensions",
      deps: ["text-embedding-3-small (OpenAI)", "In-memory vector store"],
    },
  },
  steps: [
    { label: "User query received",      detail: "Query enters the pipeline — ready for dense vector embedding" },
    { label: "Embedding query",          detail: "text-embedding-3-small — dense 1536-dim vector created" },
    { label: "Cosine similarity search", detail: "Scanning entire KB vector store — O(N) dot products" },
    { label: "Ranking top-K docs",       detail: "K=6 documents sorted by cosine score descending" },
    { label: "Building context prompt",  detail: "Injecting [doc:id] citation markers into the prompt" },
    { label: "LLM completion",           detail: "gpt-4o-mini generates grounded cited answer — pipeline complete" },
  ],
  flow: {
    nodes: [
      { id: "n0", label: "User Query",     ntype: "input",    stepIdx: 0, row: 0 },
      { id: "n1", label: "Embed Query",    ntype: "process",  stepIdx: 1, row: 1, detail: "text-embedding-3-small" },
      { id: "n2", label: "Cosine Search",  ntype: "retrieval",stepIdx: 2, row: 2, detail: "All KB vectors" },
      { id: "n3", label: "Top-K Docs",     ntype: "retrieval",stepIdx: 3, row: 3, detail: "K=6 by score" },
      { id: "n4", label: "Build Prompt",   ntype: "process",  stepIdx: 4, row: 4, detail: "Inject [doc:id] markers" },
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
