"""06 — Graph RAG: entity-relationship traversal across the KB."""
from __future__ import annotations

from typing import List

from ..models import KBDocument
from .core import StrategyResult, _TOP_K, _select_relevant, _call_openrouter, _parse_json_from_llm
from .hybrid import run as hybrid_run


def run(query: str, docs: List[KBDocument]) -> StrategyResult:
    raw = _call_openrouter(
        f"Extract 2-3 key entities from this query.\nQuery: {query}\n\n"
        'Reply with JSON only: {"entities": ["e1", "e2"], "relationship": "what connects them"}',
        system="You are an entity extractor. Output only JSON.",
        temperature=0.1,
    )
    p = _parse_json_from_llm(raw)
    entities = p.get("entities", [])
    relationship = p.get("relationship", "")

    if not entities:
        return hybrid_run(query, docs)

    # Hop 1: retrieve docs per entity
    merged: dict[int, tuple[KBDocument, float]] = {}
    for entity in entities[:3]:
        for doc, score in _select_relevant(entity, docs, top_k=3):
            if doc.id not in merged or merged[doc.id][1] < score:
                merged[doc.id] = (doc, score)

    # Hop 2: follow-up entity from hop-1 titles
    if merged:
        titles = " ".join(d.title for d, _ in merged.values())
        raw2 = _call_openrouter(
            f"Given entities [{', '.join(entities)}] and doc titles: {titles}\n"
            f"What related entity would further help answer: {query}?\n"
            'Reply with JSON: {"next_entity": "entity or empty"}',
            system="You are a graph traversal agent. Output only JSON.",
            temperature=0.1,
        )
        next_e = _parse_json_from_llm(raw2).get("next_entity", "").strip()
        if next_e and next_e not in entities:
            for doc, score in _select_relevant(next_e, docs, top_k=2):
                if doc.id not in merged:
                    merged[doc.id] = (doc, score * 0.85)

    picks = sorted(merged.values(), key=lambda x: x[1], reverse=True)[:_TOP_K]
    if not picks:
        return hybrid_run(query, docs)

    ctx = "\n\n".join(f"[doc:{d.id}] {d.title}: {d.content.strip()[:500]}" for d, _ in picks)
    answer = _call_openrouter(
        f"Answer by tracing relationships between: {', '.join(entities)}\n"
        f"Relationship context: {relationship}\n\n{ctx}\n\nQUESTION: {query}\n\n"
        "Trace through entity relationships. Cite with [doc:<id>]."
    )
    return answer, picks, {"strategy": "graph", "entities": entities, "relationship": relationship, "hops": 2}
