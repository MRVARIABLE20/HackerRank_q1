"""01 — Naive RAG: dense vector cosine similarity search."""
from __future__ import annotations

from typing import List

from ..models import KBDocument
from .core import StrategyResult, _select_relevant, _build_prompt, _call_openrouter


def run(query: str, docs: List[KBDocument]) -> StrategyResult:
    picks = _select_relevant(query, docs)
    answer = _call_openrouter(_build_prompt(query, picks))
    return answer, picks, {"strategy": "naive"}
