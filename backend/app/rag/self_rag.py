"""04 — Self-RAG: retrieve → reflect → score → filter."""
from __future__ import annotations

from typing import List

from ..models import KBDocument
from .core import StrategyResult, _doc_text, _select_relevant, _build_prompt, _call_openrouter, _parse_json_from_llm


def _retrieve_decision(query: str) -> tuple[str, str]:
    raw = _call_openrouter(
        "Decide if this query needs document retrieval.\n\n"
        f"Query: {query}\n\n"
        "Reply with JSON only:\n"
        '{"decision": "RETRIEVE" or "NO_RETRIEVE", "reason": "one sentence"}\n\n'
        "Default to RETRIEVE. Use RETRIEVE for: facts, explanations, comparisons, technical topics, research, ML/AI, policies, procedures, names, numbers, and any question a knowledge base could answer.\n"
        "NO_RETRIEVE ONLY for: pure arithmetic (e.g. '2+2') or unit conversions requiring zero factual lookup.",
        system="You are a Self-RAG retrieval controller. Output only JSON.",
        temperature=0.1,
    )
    parsed = _parse_json_from_llm(raw)
    decision = str(parsed.get("decision", "RETRIEVE")).upper()
    if decision not in ("RETRIEVE", "NO_RETRIEVE"):
        decision = "RETRIEVE"
    return decision, parsed.get("reason", "")


def _score_doc(query: str, doc_text: str) -> dict:
    raw = _call_openrouter(
        f"Score this document for the query.\n\nQuery: {query}\n\nDocument:\n{doc_text[:1200]}\n\n"
        "Reply with JSON only:\n"
        '{"isrel": "relevant" or "irrelevant", "issup": "supported" or "not_stated" or "contradicted", "isuse": 1-5}',
        system="You are a Self-RAG document evaluator. Output only JSON.",
        temperature=0.1,
    )
    p = _parse_json_from_llm(raw)
    isrel = p.get("isrel", "relevant") if p.get("isrel") in ("relevant", "irrelevant") else "relevant"
    issup = p.get("issup", "not_stated") if p.get("issup") in ("supported", "not_stated", "contradicted") else "not_stated"
    isuse = max(1, min(5, int(p.get("isuse", 3))))
    return {"isrel": isrel, "issup": issup, "isuse": isuse}


def run(query: str, docs: List[KBDocument]) -> StrategyResult:
    decision, reason = _retrieve_decision(query)
    meta: dict = {"strategy": "self_rag", "retrieve_decision": decision, "retrieve_reason": reason}

    if decision == "NO_RETRIEVE":
        answer = _call_openrouter(f"Answer from general knowledge:\n\n{query}", temperature=0.3)
        meta.update({"docs_scored": 0, "docs_passed": 0, "doc_scores": []})
        return answer, [], meta

    candidates = _select_relevant(query, docs)
    scored_entries: list[tuple[KBDocument, float, dict]] = []
    doc_score_log: list[dict] = []

    for doc, cos in candidates[:3]:
        ref = _score_doc(query, _doc_text(doc))
        scored_entries.append((doc, cos, ref))
        doc_score_log.append({"doc_id": doc.id, "title": doc.title[:60], "cos_score": round(cos, 3), **ref})

    passed = [t for t in scored_entries if t[2]["isrel"] == "relevant" and t[2]["issup"] != "contradicted"]
    passed.sort(key=lambda x: x[2]["isuse"], reverse=True)
    final = passed if passed else scored_entries
    picks = [(d, s) for d, s, _ in final]

    answer = _call_openrouter(_build_prompt(query, picks))
    meta.update({"docs_scored": len(scored_entries), "docs_passed": len(passed), "doc_scores": doc_score_log})
    return answer, picks, meta
