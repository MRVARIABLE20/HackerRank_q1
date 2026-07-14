"""07 — Speculative RAG: draft fast, then verify with full context."""
from __future__ import annotations

from typing import List

from ..models import KBDocument
from .core import StrategyResult, _select_relevant, _call_openrouter, _parse_json_from_llm


def run(query: str, docs: List[KBDocument]) -> StrategyResult:
    picks = _select_relevant(query, docs)
    if not picks:
        return _call_openrouter(query), [], {"strategy": "speculative", "verdict": "NO_DOCS"}

    draft = _call_openrouter(
        f"Answer based ONLY on this excerpt:\n\n{picks[0][0].content[:1000]}\n\nQuestion: {query}",
        system="You are a fast draft engine. Be concise.",
        temperature=0.3,
    )

    full_ctx = "\n\n---\n\n".join(f"[doc:{d.id}] {d.title}\n{d.content[:600]}" for d, _ in picks)
    raw = _call_openrouter(
        f"Verify this draft answer against full context.\n\n"
        f"Query: {query}\nDraft: {draft}\n\nFull context:\n{full_ctx}\n\n"
        'Reply with JSON only:\n{"verdict": "CONFIRMED"|"CORRECTED"|"REJECTED", "answer": "final answer here"}',
        system="You are a verification engine. Output only JSON.",
        temperature=0.1,
    )
    p = _parse_json_from_llm(raw)
    verdict = p.get("verdict", "CONFIRMED")
    final = p.get("answer") or draft

    return final, picks, {"strategy": "speculative", "verdict": verdict, "draft_preview": draft[:200]}
