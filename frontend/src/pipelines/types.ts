import { type Edge } from "@xyflow/react";

export type NType = "input"|"output"|"process"|"llm"|"retrieval"|"decision"|"external"|"loop";
export type NState = "pending"|"active"|"done";

export interface NS {
  id: string; label: string; ntype: NType; stepIdx: number;
  row: number; col?: number; detail?: string;
}

export type FlowSpec = { nodes: NS[]; edges: Edge[] };

export interface Step {
  label: string;
  detail: string;
}

export interface StrategyDef {
  value: string; label: string; num: string; icon: string;
  color: string; tagline: string; desc: string; when: string;
  pros: string[]; cons: string[]; notWhen: string;
  tags: string[];
  perf: { speed: number; quality: number; cost: number; llmCalls: number };
  docs: { types: string[]; content: string[] };
  tech: { algorithm: string; complexity: string; deps: string[] };
  /** One jargon-free sentence — the "explain it to my grandma" version of `desc`. */
  plainEnglish: string;
  /** Real questions a user can paste into Chat right now and get a grounded
   * answer from this strategy's actual seeded documents — not hypotheticals. */
  examples: string[];
}

export interface RagPipeline {
  strategy: StrategyDef;
  steps: Step[];
  flow: FlowSpec;
}
