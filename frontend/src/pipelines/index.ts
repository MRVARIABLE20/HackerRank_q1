import type { StrategyDef, Step, FlowSpec } from "./types";

import naive      from "./01_naive";
import bm25       from "./02_bm25";
import hybrid     from "./03_hybrid";
import self_rag   from "./04_self_rag";
import corrective from "./05_corrective";
import graph      from "./06_graph";
import speculative from "./07_speculative";
import rag_fusion  from "./08_rag_fusion";
import adaptive   from "./09_adaptive";
import agentic    from "./10_agentic";
import multihop   from "./11_multihop";
import sql        from "./12_sql";
import multimodal from "./13_multimodal";
import modular    from "./14_modular";

export type { NType, NState, NS, FlowSpec, Step, StrategyDef, RagPipeline } from "./types";

const ALL = [
  naive, bm25, hybrid, self_rag, corrective, graph, speculative,
  rag_fusion, adaptive, agentic, multihop, sql, multimodal, modular,
];

export const STRATEGIES: StrategyDef[] = ALL.map(p => p.strategy);

export const STEPS: Record<string, Step[]> = Object.fromEntries(
  ALL.map(p => [p.strategy.value, p.steps])
);

export const FLOWS: Record<string, FlowSpec> = Object.fromEntries(
  ALL.map(p => [p.strategy.value, p.flow])
);
