"""11 — Multi-hop RAG: iterative retrieval chained across document boundaries."""
from __future__ import annotations

from typing import List

from ..models import KBDocument
from .core import StrategyResult, _TOP_K, _select_relevant, _call_openrouter, _parse_json_from_llm


def run(query: str, docs: List[KBDocument], max_hops: int = 3) -> StrategyResult:
    all_picks: dict[int, tuple[KBDocument, float]] = {}
    hop_log = []
    current_q = query

    for hop in range(max_hops):
        picks = _select_relevant(current_q, docs, top_k=3)
        if not picks:
            break
        for doc, score in picks:
            if doc.id not in all_picks or all_picks[doc.id][1] < score:
                all_picks[doc.id] = (doc, score)

        hop_ctx = "\n\n".join(f"[doc:{d.id}] {d.title}: {d.content[:400]}" for d, _ in picks)
        hop_log.append({"hop": hop + 1, "query": current_q, "docs_found": len(picks)})

        raw = _call_openrouter(
            f"Original question: {query}\n\nInfo gathered so far:\n{hop_ctx}\n\n"
            'Can you fully answer the original question? Reply with JSON: '
            '{"sufficient": true/false, "follow_up": "next search query if not sufficient"}',
            system="You are a multi-hop controller. Output only JSON.",
            temperature=0.1,
        )
        p = _parse_json_from_llm(raw)
        if p.get("sufficient", False):
            break
        follow_up = (p.get("follow_up") or "").strip()
        if not follow_up or follow_up == current_q:
            break
        current_q = follow_up

    final_picks = sorted(all_picks.values(), key=lambda x: x[1], reverse=True)[:_TOP_K]
    if not final_picks:
        return _call_openrouter(query), [], {"strategy": "multihop", "hops": 0, "hop_log": []}

    all_ctx = "\n\n".join(
        f"[doc:{d.id}] {d.title}: {d.content.strip()[:500]}" for d, _ in final_picks
    )
    answer = _call_openrouter(
        f"Answer the original question using all gathered context.\n\n"
        f"{all_ctx}\n\nORIGINAL QUESTION: {query}\n\n"
        "Synthesize a complete answer. Cite with [doc:<id>]."
    )
    return answer, final_picks, {"strategy": "multihop", "hops": len(hop_log), "hop_log": hop_log}
