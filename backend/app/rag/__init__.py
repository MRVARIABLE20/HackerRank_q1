"""RAG strategy registry — maps strategy names to run() callables."""
from __future__ import annotations

from typing import Callable, List
from ..models import KBDocument
from .core import StrategyResult

from . import (
    naive,
    bm25,
    hybrid,
    self_rag,
    corrective,
    graph,
    speculative,
    rag_fusion,
    adaptive,
    agentic,
    multihop,
    sql,
    multimodal,
    modular,
)

REGISTRY: dict[str, Callable[..., StrategyResult]] = {
    "naive":       naive.run,
    "bm25":        bm25.run,
    "hybrid":      hybrid.run,
    "self_rag":    self_rag.run,
    "corrective":  corrective.run,
    "graph":       graph.run,
    "speculative": speculative.run,
    "rag_fusion":  rag_fusion.run,
    "adaptive":    adaptive.run,
    "agentic":     agentic.run,
    "multihop":    multihop.run,
    "sql":         sql.run,
    "multimodal":  multimodal.run,
    "modular":     modular.run,
}

__all__ = ["REGISTRY", "StrategyResult"]
