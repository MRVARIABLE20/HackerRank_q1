"""03 — Hybrid RAG: BM25 + vector search fused with Reciprocal Rank Fusion."""
from __future__ import annotations

from typing import List

from ..models import KBDocument
from .core import StrategyResult, _doc_text, _select_relevant, _build_prompt, _call_openrouter, _rrf


def run(query: str, docs: List[KBDocument]) -> StrategyResult:
    from rank_bm25 import BM25Okapi
    corpus = [_doc_text(d).lower().split() for d in docs]
    bm25 = BM25Okapi(corpus)
    bm25_scores = bm25.get_scores(query.lower().split()).tolist()
    bm25_ranked = sorted(zip(docs, bm25_scores), key=lambda x: x[1], reverse=True)[:10]
    vector_ranked = _select_relevant(query, docs, top_k=10)
    picks = _rrf([bm25_ranked, vector_ranked])
    answer = _call_openrouter(_build_prompt(query, picks))
    return answer, picks, {
        "strategy": "hybrid",
        "bm25_candidates": len(bm25_ranked),
        "vector_candidates": len(vector_ranked),
        "rrf_k": 60,
    }
