"""02 — BM25 RAG: keyword frequency scoring with Okapi BM25."""
from __future__ import annotations

from typing import List

from ..models import KBDocument
from .core import StrategyResult, _TOP_K, _doc_text, _build_prompt, _call_openrouter


def run(query: str, docs: List[KBDocument]) -> StrategyResult:
    from rank_bm25 import BM25Okapi
    if not docs:
        return _call_openrouter(query), [], {"strategy": "bm25"}
    corpus = [_doc_text(d).lower().split() for d in docs]
    bm25 = BM25Okapi(corpus)
    raw_scores = bm25.get_scores(query.lower().split()).tolist()
    scored = sorted(zip(docs, raw_scores), key=lambda x: x[1], reverse=True)
    max_s = scored[0][1] if scored and scored[0][1] > 0 else 1.0
    picks = [(d, s / max_s) for d, s in scored[:_TOP_K] if s > 0]
    if not picks:
        picks = [(scored[0][0], 0.01)]
    answer = _call_openrouter(_build_prompt(query, picks))
    return answer, picks, {"strategy": "bm25", "tokenized_query": query.lower().split()[:8]}
