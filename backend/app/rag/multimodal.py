"""13 — Multimodal RAG: visual pool filter + vision-aware LLM prompting."""
from __future__ import annotations

from typing import List

from ..models import KBDocument
from .core import (
    StrategyResult, _MAX_DOC_CHARS, _select_relevant, _call_openrouter,
    _image_caption, _video_understanding,
)

_PDF_PREFIX   = "__PDF__:"
_VIDEO_PREFIX = "__VIDEO__:"


def _llm_text(doc: KBDocument) -> str:
    """Return a human-readable text snippet for LLM context.

    base64 images, video refs, and PDF file-ref prefixes are replaced with
    descriptive labels so the LLM receives meaningful text instead of binary data.
    """
    c = doc.content.strip()

    if c.startswith("data:image/"):
        mime_end = c.index(";") if ";" in c else 20
        mime = c[5:mime_end]
        caption = _image_caption(doc)
        if caption:
            return f"[Image ({mime}) — title: {doc.title}]\nVisual content: {caption}"
        return f"[Embedded image ({mime}) — title: {doc.title}]"

    if c.startswith(_VIDEO_PREFIX) or c.startswith("data:video/"):
        label = c[len(_VIDEO_PREFIX):].split("\n")[0].strip().rsplit("/", 1)[-1] if c.startswith(_VIDEO_PREFIX) else doc.title
        understanding = _video_understanding(doc)
        if understanding:
            return (
                f"[Video: {label} — title: {doc.title}]\n{understanding}\n"
                f"(The full video is available to watch in the Knowledge Base.)"
            )
        return (
            f"[Video: {label} — title: {doc.title}]\n"
            f"This video could not be processed. Based on its title '{doc.title}', "
            f"describe what it likely covers and tell the user they can watch it in the Knowledge Base."
        )

    if c.startswith(_PDF_PREFIX):
        # Strip the file-ref prefix line; keep the extracted text body
        nl = c.find("\n")
        text = c[nl + 1:].strip() if nl != -1 else ""
        return text[:_MAX_DOC_CHARS] if text else f"[PDF document — title: {doc.title}]"

    return c[:_MAX_DOC_CHARS]


def run(query: str, docs: List[KBDocument]) -> StrategyResult:
    visual_docs = [d for d in docs if "13" in d.category or "multimodal" in d.category.lower()]
    search_pool = visual_docs if visual_docs else docs
    picks = _select_relevant(query, search_pool)
    if not picks:
        picks = _select_relevant(query, docs)

    ctx = "\n\n---\n\n".join(
        f"[doc:{d.id}] (category: {d.category}) {d.title}\n{_llm_text(d)}"
        for d, _ in picks
    )

    # Collect base64 images from the picked docs so the vision model can see them.
    # Cap at 3 to keep the request payload reasonable.
    images: List[str] = [
        d.content.strip()
        for d, _ in picks
        if d.content.strip().startswith("data:image/")
    ][:3]

    answer = _call_openrouter(
        "You are the RAG Atlas assistant with access to visual and multimedia documents.\n"
        "Context may include images, PDFs, and video references.\n"
        "For images: any images attached to this message ARE the documents referenced in the "
        "context — analyse them directly and describe exactly what you see.\n"
        "For videos: the CONTEXT includes an audio transcript and/or a description of sampled "
        "frames for each video — treat that as real, grounded knowledge of the video's content "
        "and answer from it directly. Mention that the full video can be watched in the Knowledge "
        "Base. Only say you can't access a video if no transcript or frame description is present "
        "for it in the CONTEXT.\n\n"
        f"CONTEXT:\n{ctx}\n\nQUESTION: {query}\n\nAnswer with [doc:<id>] citations.",
        images=images or None,
    )
    return answer, picks, {
        "strategy": "multimodal",
        "visual_docs_in_kb": len(visual_docs),
        "images_analyzed": len(images),
        "searched_pool": "multimodal_category" if visual_docs else "all_docs",
    }
