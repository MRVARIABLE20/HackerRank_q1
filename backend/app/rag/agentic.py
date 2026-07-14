"""10 — Agentic RAG: ReAct loop with live tool-calling (max 8 iterations)."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import List

from ..models import KBDocument
from .core import StrategyResult, _TOP_K, _select_relevant, _call_openrouter, _parse_json_from_llm
from ..config import get_settings

log = logging.getLogger(__name__)


def run(query: str, docs: List[KBDocument]) -> StrategyResult:
    cfg = get_settings()

    def kb_search(q: str) -> str:
        results = _select_relevant(q, docs, top_k=3)
        if not results:
            return "No relevant documents found."
        return "\n\n".join(f"[doc:{d.id}] {d.title}:\n{d.content[:400]}" for d, _ in results)

    def web_search(q: str) -> str:
        if not cfg.tavily_api_key:
            return "Web search unavailable (no TAVILY_API_KEY)."
        try:
            from tavily import TavilyClient
            r = TavilyClient(api_key=cfg.tavily_api_key).search(q, max_results=3)
            return "\n\n".join(x.get("content", "")[:300] for x in r.get("results", [])) or "No results."
        except Exception as e:
            return f"Web search error: {e}"

    def calculator(expr: str) -> str:
        try:
            clean = "".join(c for c in expr if c in "0123456789+-*/()., ")
            return str(round(eval(clean, {"__builtins__": {}}), 6))
        except Exception as e:
            return f"Calc error: {e}"

    TOOLS = {
        "kb_search": kb_search,
        "web_search": web_search,
        "calculator": calculator,
        "get_current_date": lambda _: datetime.utcnow().strftime("%Y-%m-%d"),
    }

    system = (
        "You are an enterprise ReAct agent. Use tools to answer the question.\n\n"
        "Tools: kb_search(query) | web_search(query) | calculator(expr) | get_current_date(any)\n\n"
        "Each turn output ONLY JSON:\n"
        '{"thought": "...", "action": "tool_name", "action_input": "..."}\n'
        "OR when done:\n"
        '{"thought": "...", "action": "FINAL_ANSWER", "action_input": "complete answer"}\n\n'
        "Rules: Use kb_search first. web_search for current data. Never guess numbers — use calculator."
    )

    history: list[dict] = []
    iter_log: list[dict] = []
    kb_doc_ids: set[int] = set()
    all_kb_picks: list[tuple[KBDocument, float]] = []

    for i in range(8):
        hist_text = "".join(
            f"Step {h['step']}: {h['action']}({h['input'][:80]})\nResult: {h['observation'][:250]}\n\n"
            for h in history
        )
        raw = _call_openrouter(
            f"Question: {query}\n\n{hist_text}Next action:",
            system=system,
            temperature=0.2,
        )
        p = _parse_json_from_llm(raw)
        action = p.get("action", "FINAL_ANSWER")
        action_input = str(p.get("action_input", ""))
        iter_log.append({"step": i + 1, "thought": str(p.get("thought", ""))[:100], "action": action, "input": action_input[:80]})

        if action == "FINAL_ANSWER":
            answer = action_input or raw
            break

        fn = TOOLS.get(action)
        observation = fn(action_input) if fn else f"Unknown tool: {action}"

        if action == "kb_search":
            for doc, score in _select_relevant(action_input, docs, top_k=2):
                if doc.id not in kb_doc_ids:
                    kb_doc_ids.add(doc.id)
                    all_kb_picks.append((doc, score))

        history.append({"step": i + 1, "action": action, "input": action_input, "observation": observation})
    else:
        summary = "\n".join(f"- {h['action']}: {h['observation'][:200]}" for h in history)
        answer = _call_openrouter(f"Summarize findings for: {query}\n\n{summary}")

    picks = sorted(all_kb_picks, key=lambda x: x[1], reverse=True)[:_TOP_K]
    return answer, picks, {
        "strategy": "agentic",
        "iterations": len(iter_log),
        "tools_used": list({h["action"] for h in history}),
        "iteration_log": iter_log,
    }
