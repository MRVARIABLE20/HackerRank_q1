import type { RagPipeline } from "./types";
import { edge } from "./shared";

const pipeline: RagPipeline = {
  strategy: {
    value: "multimodal", label: "Multimodal RAG", num: "13", icon: "🖼️",
    color: "#f87171",
    tagline: "Visual + text document retrieval",
    desc: "Filters the knowledge base for visually-tagged or PDF documents, then performs cosine similarity search within that pool. Images are captioned by a vision model and genuinely retrievable by what's IN the picture, not just their filename. Videos are transcribed (faster-whisper, when they have audio) and representative frames are sampled and captioned — both are indexed the same way, so silent screen-recordings are searchable too.",
    plainEnglish: "Actually looks at your images and listens to your videos, instead of just guessing from the filename — real vision and hearing, not just reading text.",
    when: "Corpora containing charts, diagrams, infographics, scanned PDFs, images, or video. Questions about visual or audio content that pure text retrieval would miss.",
    pros: ["Genuine vision analysis, not filename guessing", "Video transcription + frame captioning", "Uploaded images/videos usable immediately", "Falls back to full KB if visual pool is empty"],
    cons: ["Vision/transcription calls cost more on first use per doc (cached after)", "PDF parsing quality varies by document", "Uploaded videos capped at 25 MB (stored as base64 in the DB)", "Less precise on pure text queries than text-only RAG"],
    notWhen: "Avoid for purely text-based corpora with no visual or audio content. Not cost-effective when all KB documents are already in plain text form.",
    tags: ["Vision", "PDF", "Multimodal", "Image Retrieval", "Video Transcription"],
    perf: { speed: 3, quality: 4, cost: 2, llmCalls: 1 },
    docs: {
      types: ["PDF", "TXT", "PNG", "JPG", "MP4"],
      content: ["Charts & performance graphs", "Architecture diagrams", "Scanned documents & reports", "Research papers with figures", "Product demo & explainer videos"],
    },
    examples: [
      "What does the Grace Hopper image show?",
      "What key topics does the Google IO multimodal video cover?",
      "What is the moral corruption theme in The Picture of Dorian Gray?",
    ],
    tech: {
      algorithm: "Visual pool filter → cosine similarity (on vision captions/transcripts) within pool → vision-aware LLM prompting",
      complexity: "O(V · d) within visual pool of V docs; falls back to full KB if pool is empty",
      deps: ["text-embedding-3-small (OpenAI)", "gpt-4o-mini vision model", "faster-whisper (audio)", "PDF/image parser"],
    },
  },
  steps: [
    { label: "User query received",    detail: "Query enters Multimodal RAG — visual document pool will be built" },
    { label: "Filtering visual docs",  detail: "KB filtered for category '13_multimodal_rag' or visual/pdf-tagged docs" },
    { label: "Checking visual pool",   detail: "Visual Found? → YES uses restricted pool · NO falls back to full KB" },
    { label: "Retrieving from pool",   detail: "Cosine similarity search within the visual pool (or full KB fallback)" },
    { label: "Building visual context",detail: "Charts, diagrams, and PDF extracts assembled into the LLM context" },
    { label: "LLM completion",         detail: "gpt-4o-mini answers with vision-aware, image-rich context prompt" },
  ],
  flow: {
    nodes: [
      { id: "n0", label: "User Query",        ntype: "input",    stepIdx: 0, row: 0, col: 0 },
      { id: "n1", label: "Filter Visual",     ntype: "process",  stepIdx: 1, row: 1, col: 0, detail: "Category '13' docs" },
      { id: "n2", label: "Visual Found?",     ntype: "decision", stepIdx: 2, row: 2, col: 0 },
      { id: "n3", label: "Visual Pool Only",  ntype: "retrieval",stepIdx: 3, row: 3, col: -1, detail: "Restricted search" },
      { id: "n4", label: "Full KB Search",    ntype: "retrieval",stepIdx: 3, row: 3, col:  1, detail: "Fallback" },
      { id: "n5", label: "Build Context",     ntype: "process",  stepIdx: 4, row: 4, col: 0, detail: "Charts, diagrams" },
      { id: "n6", label: "LLM Answer",        ntype: "llm",      stepIdx: 5, row: 5, col: 0, detail: "Visual-context prompt" },
      { id: "n7", label: "Cited Answer",      ntype: "output",   stepIdx: 5, row: 6, col: 0 },
    ],
    edges: [
      edge("e01","n0","n1"), edge("e12","n1","n2"),
      edge("e23","n2","n3","YES"), edge("e24","n2","n4","NO"),
      edge("e35","n3","n5"), edge("e45","n4","n5"),
      edge("e56","n5","n6"), edge("e67","n6","n7"),
    ],
  },
};

export default pipeline;
