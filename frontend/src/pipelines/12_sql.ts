import type { RagPipeline } from "./types";
import { edge } from "./shared";

const pipeline: RagPipeline = {
  strategy: {
    value: "sql", label: "SQL RAG", num: "12", icon: "🗄️",
    color: "#34d399",
    tagline: "DuckDB structured query over CSV tables",
    desc: "Discovers CSV/TSV tables in the knowledge base, builds a schema context (columns + row count), then uses an LLM to generate a safe SELECT statement. Executes the query via DuckDB in-memory and returns results formatted in natural language. Tabular documents added through the Knowledge Base page — not just the pre-seeded files — are automatically mirrored to disk, so newly added tables are queryable for real immediately, not just retrieved as text.",
    plainEnglish: "For questions about numbers and data tables — totals, averages, rankings — it writes and runs a real database query instead of just reading through text and guessing.",
    when: "Structured data questions: rankings, aggregations, filtering, or any query that maps cleanly to SQL. 'Who are the top 3 sales reps?' is SQL, not a semantic search problem.",
    pros: ["Precise structured answers", "In-memory execution", "SQL safety guard", "New KB uploads are queryable immediately"],
    cons: ["Only works with structured tabular data", "LLM-generated SQL can be incorrect", "Exact column name matching required", "Cannot handle unstructured text alongside tables"],
    notWhen: "Avoid for unstructured text queries, semantic or conceptual questions, or when the KB contains no CSV/tabular data. Does not fall back gracefully to text retrieval.",
    tags: ["SQL", "DuckDB", "CSV", "Structured Data"],
    perf: { speed: 4, quality: 5, cost: 2, llmCalls: 2 },
    docs: {
      types: ["CSV", "TSV", "TXT"],
      content: ["Sales & revenue tables", "Customer databases", "Audit log exports", "Any tabular / relational data"],
    },
    examples: [
      "What is the average body mass of penguins by species?",
      "How many penguins are there of each species?",
      "What does Jonathan Swift satirize in A Modest Proposal?",
    ],
    tech: {
      algorithm: "Schema discovery → LLM SQL generation → DuckDB in-memory execution → NL formatting",
      complexity: "O(LLM + SQL execution time) — schema introspection is O(T · C) for T tables, C columns",
      deps: ["DuckDB (in-process SQL engine)", "gpt-4o-mini SQL generator", "SQL safety validator"],
    },
  },
  steps: [
    { label: "User query received",     detail: "Query enters SQL RAG — CSV tables will be discovered and queried" },
    { label: "Discovering CSV tables",  detail: "Globbing seeding_data/12_sql_rag/ — finds all .csv files" },
    { label: "Building schema context", detail: "DESCRIBE each table: column names, types, and row count" },
    { label: "Generating SQL query",    detail: "LLM writes a safe SELECT statement from the schema context" },
    { label: "Safety check",           detail: "Blocking DROP / DELETE / INSERT / UPDATE — only SELECT allowed" },
    { label: "Executing via DuckDB",   detail: "In-memory DuckDB engine executes SQL; up to 20-row tabular result" },
    { label: "LLM completion",         detail: "gpt-4o-mini formats the structured result as a natural language answer" },
  ],
  flow: {
    nodes: [
      { id: "n0", label: "User Query",      ntype: "input",    stepIdx: 0, row: 0 },
      { id: "n1", label: "Discover CSVs",   ntype: "process",  stepIdx: 1, row: 1, detail: "seeding_data/12_sql_rag/" },
      { id: "n2", label: "Build Schema",    ntype: "process",  stepIdx: 2, row: 2, detail: "DESCRIBE each table" },
      { id: "n3", label: "Generate SQL",    ntype: "llm",      stepIdx: 3, row: 3, detail: "SELECT from schema" },
      { id: "n4", label: "Safety Check",    ntype: "decision", stepIdx: 4, row: 4, detail: "Block DROP/DELETE..." },
      { id: "n5", label: "Fallback: Naive", ntype: "loop",     stepIdx: 5, row: 5, col: -1, detail: "Unsafe SQL" },
      { id: "n6", label: "Execute DuckDB",  ntype: "process",  stepIdx: 5, row: 5, col:  1, detail: "read_csv_auto()" },
      { id: "n7", label: "Tabular Result",  ntype: "retrieval",stepIdx: 5, row: 6, col:  1, detail: "Max 20 rows" },
      { id: "n8", label: "LLM: SQL → NL",   ntype: "llm",      stepIdx: 6, row: 7, col: 0 },
      { id: "n9", label: "Answer + SQL",    ntype: "output",   stepIdx: 6, row: 8, col: 0 },
    ],
    edges: [
      edge("e01","n0","n1"), edge("e12","n1","n2"), edge("e23","n2","n3"),
      edge("e34","n3","n4"),
      edge("e45","n4","n5","BLOCKED"), edge("e46","n4","n6","SAFE"),
      edge("e67","n6","n7"), edge("e78","n7","n8"), edge("e89","n8","n9"),
    ],
  },
};

export default pipeline;
