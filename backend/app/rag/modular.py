"""14 — Modular RAG: LLM type classifier routes to the best sub-module.

Each module works best with its own specialised knowledge base:
  numerical  → 12 SQL RAG (CSV data tables)
  visual     → 13 Multimodal RAG (chart/image docs)
  relational → 06 Graph RAG (org relationship docs)
  current    → 05 Corrective RAG (web-search augmented; uses own docs)
  factual    → 03 Hybrid RAG / 14 Modular RAG docs

Callers that have a DB session should pass `extra_docs` so each module
receives its correct knowledge base.  When omitted, all modules fall back
to `docs` (Modular RAG's own docs) for backward compatibility.
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional

from ..models import KBDocument
from .core import StrategyResult, _call_openrouter, _parse_json_from_llm

# Phrases that indicate the routed sub-strategy came back with essentially "I
# don't know" — signals a fallback to Modular's own docs is worth trying,
# rather than trusting picks-non-empty alone (a sub-strategy can retrieve and
# cite documents that don't actually answer the question, e.g. SQL RAG citing
# unrelated reference docs when no matching table exists).
_NO_ANSWER_PATTERNS = re.compile(
    r"does not contain|no information|cannot provide|do not have (?:access|"
    r"information)|does not appear|not available in|don'?t have (?:access|"
    r"information)|unable to (?:find|answer)",
    re.IGNORECASE,
)


def run(
    query: str,
    docs: List[KBDocument],
    extra_docs: Optional[Dict[str, List[KBDocument]]] = None,
) -> StrategyResult:
    from .sql import run as sql_run
    from .multimodal import run as multimodal_run
    from .graph import run as graph_run
    from .corrective import run as corrective_run
    from .hybrid import run as hybrid_run

    raw = _call_openrouter(
        f"Classify query type.\n\nQuery: {query}\n\n"
        "numerical=numbers/aggregations/rankings\n"
        "visual=charts/diagrams/images/PDFs\n"
        "relational=relationships/ownership/dependencies\n"
        "current=latest/recent/current info\n"
        "factual=definitions/procedures/specific facts\n\n"
        'Reply with JSON: {"type": "factual", "reason": "one sentence"}',
        system="You are a query type classifier. Output only JSON.",
        temperature=0.1,
    )
    p = _parse_json_from_llm(raw)
    qtype = p.get("type", "factual")
    reason = p.get("reason", "")

    # Each module gets its own specialised docs when provided by the caller.
    # Falls back to `docs` (Modular RAG's own KB) when extra_docs is absent.
    _ed = extra_docs or {}
    routes: Dict[str, tuple] = {
        "numerical":  ("sql",        sql_run,        _ed.get("sql",        docs)),
        "visual":     ("multimodal", multimodal_run, _ed.get("multimodal", docs)),
        "relational": ("graph",      graph_run,      _ed.get("graph",      docs)),
        "current":    ("corrective", corrective_run, _ed.get("corrective", docs)),
    }
    route_name, route_fn, route_docs = routes.get(qtype, ("hybrid", hybrid_run, docs))
    answer, picks, meta = route_fn(query, route_docs)

    # Fallback: a document added directly to "14 Modular RAG" can be numeric/
    # visual/relational-*shaped* even though it lives outside the specialised
    # sub-category the classifier routed to (e.g. a JSON doc with headcount
    # numbers routes to SQL, which only searches "12 SQL RAG" and never sees
    # it). If the routed sub-strategy came back empty-handed or effectively
    # said "I don't know", retry against Modular's own KB before giving up.
    sub_strategy_uninformative = (
        not picks
        or (route_name == "sql" and meta.get("strategy") != "sql")  # sql.py silently bailed to naive
        or _NO_ANSWER_PATTERNS.search(answer)
    )
    if sub_strategy_uninformative and route_name != "hybrid" and docs:
        fb_answer, fb_picks, fb_meta = hybrid_run(query, docs)
        if fb_picks and not _NO_ANSWER_PATTERNS.search(fb_answer):
            answer, picks, meta = fb_answer, fb_picks, fb_meta
            reason = f"{reason} (no answer from '{route_name}' route — fell back to Modular's own KB)"
            route_name = f"{route_name}_fallback_hybrid"

    return answer, picks, {
        **meta,
        "strategy": "modular",
        "detected_type": qtype,
        "routed_to": route_name,
        "reason": reason,
    }
