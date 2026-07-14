"""05 — Corrective RAG: grade KB quality → web fallback if needed."""
from __future__ import annotations

import logging
from typing import List

from ..models import KBDocument
from .core import StrategyResult, _MAX_DOC_CHARS, _select_relevant, _call_openrouter, _parse_json_from_llm
from ..config import get_settings

log = logging.getLogger(__name__)


def run(query: str, docs: List[KBDocument]) -> StrategyResult:
    picks = _select_relevant(query, docs)
    if not picks:
        return _call_openrouter(query), [], {"strategy": "corrective", "grade": "NO_DOCS", "web_search_used": False}

    raw = _call_openrouter(
        f"Grade this document for the query.\nQuery: {query}\nDocument: {picks[0][0].content[:600]}\n\n"
        'Reply with JSON: {"grade": "CORRECT"|"AMBIGUOUS"|"INCORRECT", "reason": "one sentence"}\n'
        "CORRECT=clearly answers query. AMBIGUOUS=partial/possibly outdated. INCORRECT=not relevant.",
        system="You are a document grader. Output only JSON.",
        temperature=0.1,
    )
    p = _parse_json_from_llm(raw)
    grade = p.get("grade", "AMBIGUOUS").upper()
    if grade not in ("CORRECT", "AMBIGUOUS", "INCORRECT"):
        grade = "AMBIGUOUS"
    reason = p.get("reason", "")

    web_used = False
    web_text = ""

    if grade in ("AMBIGUOUS", "INCORRECT"):
        cfg = get_settings()
        if cfg.tavily_api_key:
            try:
                from tavily import TavilyClient
                results = TavilyClient(api_key=cfg.tavily_api_key).search(query, max_results=3)
                snippets = [r.get("content", "")[:400] for r in results.get("results", [])]
                web_text = "\n\n".join(snippets)
                web_used = bool(web_text)
            except Exception as e:
                log.warning("Tavily search failed: %s", e)

    if web_used and grade == "INCORRECT":
        ctx = f"[WEB SEARCH RESULTS]\n{web_text}"
        note = "[KB outdated — answered from web search]"
    elif web_used:
        kb_ctx = "\n\n".join(f"[doc:{d.id}] {d.title}: {d.content[:400]}" for d, _ in picks[:3])
        ctx = f"{kb_ctx}\n\n[WEB RESULTS]\n{web_text}"
        note = "[Supplemented with web search]"
    else:
        ctx = "\n\n".join(f"[doc:{d.id}] {d.title}\n{d.content.strip()[:_MAX_DOC_CHARS]}" for d, _ in picks)
        note = ""

    answer = _call_openrouter(
        f"You are the RAG Atlas assistant.{' ' + note if note else ''}\n\n"
        f"CONTEXT:\n{ctx}\n\nQUESTION: {query}\n\nAnswer with [doc:<id>] citations."
    )
    return answer, picks, {"strategy": "corrective", "grade": grade, "web_search_used": web_used, "reason": reason}
