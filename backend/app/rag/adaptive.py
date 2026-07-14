"""09 — Adaptive RAG: auto-routes by query complexity class (0–4)."""
from __future__ import annotations

from typing import List

from ..models import KBDocument
from .core import StrategyResult, _select_relevant, _build_prompt, _call_openrouter, _parse_json_from_llm


def run(query: str, docs: List[KBDocument]) -> StrategyResult:
    from .hybrid import run as hybrid_run
    from .multihop import run as multihop_run
    from .corrective import run as corrective_run

    raw = _call_openrouter(
        f"Classify query complexity (0–4).\n\nQuery: {query}\n\n"
        "0=general world knowledge (no retrieval)\n"
        "1=simple single-fact lookup\n"
        "2=multi-document synthesis\n"
        "3=multi-hop chain reasoning\n"
        "4=requires current/external data\n\n"
        'Reply with JSON only: {"class": 2, "reason": "one sentence"}',
        system="You are a query complexity classifier. Output only JSON.",
        temperature=0.1,
    )
    p = _parse_json_from_llm(raw)
    try:
        cls = max(0, min(4, int(p.get("class", 2))))
    except (ValueError, TypeError):
        cls = 2
    reason = p.get("reason", "")

    if cls == 0:
        answer = _call_openrouter(query, temperature=0.3)
        return answer, [], {"strategy": "adaptive", "class": 0, "routed_to": "direct_llm", "reason": reason}
    elif cls == 1:
        picks = _select_relevant(query, docs, top_k=3)
        answer = _call_openrouter(_build_prompt(query, picks))
        return answer, picks, {"strategy": "adaptive", "class": 1, "routed_to": "vector_top3", "reason": reason}
    elif cls == 2:
        answer, picks, meta = hybrid_run(query, docs)
        return answer, picks, {**meta, "strategy": "adaptive", "class": 2, "routed_to": "hybrid", "reason": reason}
    elif cls == 3:
        answer, picks, meta = multihop_run(query, docs)
        return answer, picks, {**meta, "strategy": "adaptive", "class": 3, "routed_to": "multihop", "reason": reason}
    else:
        answer, picks, meta = corrective_run(query, docs)
        return answer, picks, {**meta, "strategy": "adaptive", "class": 4, "routed_to": "corrective", "reason": reason}
