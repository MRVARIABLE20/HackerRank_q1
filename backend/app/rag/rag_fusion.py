"""08 — RAG-Fusion: multi-query parallel sub-searches + Reciprocal Rank Fusion."""
from __future__ import annotations

from typing import List

from ..models import KBDocument
from .core import StrategyResult, _select_relevant, _build_prompt, _call_openrouter, _parse_json_from_llm, _rrf


def run(query: str, docs: List[KBDocument]) -> StrategyResult:
    raw = _call_openrouter(
        f"Generate 3 different search queries to help answer this question.\n"
        f"Question: {query}\n\n"
        'Reply with JSON only: {"queries": ["q1", "q2", "q3"]}',
        system="You are a query generator. Output only JSON.",
        temperature=0.5,
    )
    sub_queries = _parse_json_from_llm(raw).get("queries", [])
    sub_queries = [query] + [q for q in sub_queries[:3] if q and q != query]

    all_rankings = [_select_relevant(q, docs, top_k=6) for q in sub_queries]
    picks = _rrf(all_rankings)
    answer = _call_openrouter(_build_prompt(query, picks))
    return answer, picks, {
        "strategy": "rag_fusion",
        "sub_queries": sub_queries,
        "total_candidates": sum(len(r) for r in all_rankings),
    }
