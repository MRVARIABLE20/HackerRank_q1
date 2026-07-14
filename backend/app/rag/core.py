"""Shared helpers used by every RAG strategy."""
from __future__ import annotations

import base64
import io
import math
import re
import json
import logging
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import List

import httpx
from fastapi import HTTPException

from ..config import get_settings
from ..models import KBDocument

log = logging.getLogger(__name__)

# seeding_data/ lives at the project root (core.py is backend/app/rag/core.py)
_SEED_DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "seeding_data"

_TOP_K = 6
_EMBED_MODEL = "openai/text-embedding-3-small"
_embed_cache: dict[int, list[float]] = {}
_MAX_DOC_CHARS = 12_000  # ~3 K tokens per doc; keeps total context well under model limits

# Vision-generated captions for image docs, keyed by doc.id. Populated lazily the
# first time an image is indexed/queried so images are retrievable by their VISUAL
# content, not just their title. Mirrors the in-memory _embed_cache lifecycle.
_image_caption_cache: dict[int, str] = {}

# Understanding (audio transcript + sampled-frame captions) for video docs, keyed
# by doc.id. Same lazy, in-memory lifecycle as the image caption cache.
_video_understanding_cache: dict[int, str] = {}
_whisper_model = None  # lazily loaded faster-whisper model (loaded only if a video has audio)

# Suggestion-chip cache, keyed by a strategy category's sorted doc IDs. Lives here
# (not in the kb_docs router) so any router that mutates KBDocument rows can
# invalidate it — stops edited/deleted docs from serving stale suggestions.
_suggestions_cache: dict[tuple, dict] = {}
_suggestions_inflight: set[tuple] = set()  # keys with a background GenAI refresh already running

_HEAVY_CONTENT_PREFIXES = ("data:image/", "data:video/")
_OVERVIEW_PREVIEW_CHARS = 300  # plenty for a text/CSV/JSON preview; never rendered anyway


def _truncate_for_overview(content: str) -> str:
    """Shrink one document's content for the "list every category" overview
    response — which only ever renders titles, never content, in the KB page's
    collapsed accordion view. Full content is fetched separately, one category
    at a time, only once that category is actually expanded.

    Handles every content type, not just video/image: a data-URI (image or
    video) keeps just its header (e.g. "data:video/mp4;base64,") so the
    frontend's type-sniffing still works without transferring what can be tens
    of MB; anything else (plain text, CSV, JSON, extracted PDF text) is cut to
    a short preview. This means a future large document of ANY kind — not only
    video/image — can never bloat the overview response.
    """
    if content.startswith(_HEAVY_CONTENT_PREFIXES):
        comma = content.find(",")
        return content[:comma + 1] if comma != -1 else content[:32]
    return content[:_OVERVIEW_PREVIEW_CHARS]

StrategyResult = tuple[str, List[tuple[KBDocument, float]], dict]


def _embed(texts: list[str]) -> list[list[float]]:
    cfg = get_settings()
    if not cfg.openrouter_api_key:
        raise HTTPException(500, "OPENROUTER_API_KEY not configured")
    try:
        r = httpx.post(
            f"{cfg.openrouter_base_url}/embeddings",
            headers={"Authorization": f"Bearer {cfg.openrouter_api_key}", "Content-Type": "application/json"},
            json={"model": _EMBED_MODEL, "input": texts},
            timeout=30.0,
        )
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Embedding request failed: {e}") from e
    if r.status_code >= 400:
        raise HTTPException(502, f"Embedding API error {r.status_code}")
    items = r.json()["data"]
    items.sort(key=lambda x: x["index"])
    return [item["embedding"] for item in items]


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    ma = math.sqrt(sum(x * x for x in a))
    mb = math.sqrt(sum(x * x for x in b))
    return dot / (ma * mb) if ma and mb else 0.0


def _doc_text(doc: KBDocument) -> str:
    """Text used to embed/keyword-index a doc for retrieval.

    For image docs the raw base64 is meaningless noise, so we substitute a
    vision-generated caption — making images retrievable by what they contain.
    """
    c = doc.content.strip()
    if c.startswith("data:image/"):
        caption = _image_caption(doc)
        return f"{doc.title}. {caption}" if caption else doc.title
    if c.startswith("__VIDEO__:") or c.startswith("data:video/"):
        understanding = _video_understanding(doc)
        return f"{doc.title}. {understanding}" if understanding else doc.title
    return f"{doc.title}. {c[:512].replace(chr(10), ' ')}"


def _select_relevant(
    query: str, docs: List[KBDocument], top_k: int = _TOP_K
) -> List[tuple[KBDocument, float]]:
    if not docs:
        return []
    query_vec = _embed([query])[0]
    uncached = [d for d in docs if d.id not in _embed_cache]
    if uncached:
        texts = [_doc_text(d) for d in uncached]
        for i in range(0, len(texts), 100):
            for doc, vec in zip(uncached[i:i+100], _embed(texts[i:i+100])):
                _embed_cache[doc.id] = vec
    scored = [(d, _cosine(query_vec, _embed_cache[d.id])) for d in docs if d.id in _embed_cache]
    scored.sort(key=lambda t: t[1], reverse=True)
    return scored[:top_k]


def _build_prompt(query: str, picks: List[tuple[KBDocument, float]], max_doc_chars: int = _MAX_DOC_CHARS) -> str:
    if not picks:
        return (
            "You are the RAG Atlas assistant. No relevant documents found. "
            "Tell the user honestly.\n\nQuestion: " + query
        )
    ctx = "\n\n---\n\n".join(
        f"[doc:{d.id}] (category: {d.category}) {d.title}\n{d.content.strip()[:max_doc_chars]}"
        for d, _ in picks
    )
    return (
        "You are the RAG Atlas assistant. Answer using ONLY the CONTEXT below. "
        "Cite with [doc:<id>] markers.\n\n"
        f"CONTEXT:\n{ctx}\n\nQUESTION: {query}\n\n"
        "Answer concisely with [doc:<id>] citations."
    )


def _call_openrouter(
    prompt: str,
    system: str = "You are a precise RAG Atlas assistant.",
    temperature: float = 0.2,
    images: list[str] | None = None,
) -> str:
    """Call the chat model. If `images` (data-URI base64 strings) are supplied,
    they are attached to the user message so a vision-capable model can see them."""
    cfg = get_settings()
    if not cfg.openrouter_api_key:
        raise HTTPException(500, "OPENROUTER_API_KEY not configured")

    if images:
        user_content: object = [{"type": "text", "text": prompt}] + [
            {"type": "image_url", "image_url": {"url": img}} for img in images
        ]
    else:
        user_content = prompt

    try:
        r = httpx.post(
            f"{cfg.openrouter_base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {cfg.openrouter_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:5173",
                "X-Title": "RAG Atlas",
            },
            json={
                "model": cfg.openrouter_model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_content},
                ],
                "temperature": temperature,
            },
            timeout=90.0,
        )
    except httpx.HTTPError as e:
        raise HTTPException(502, f"OpenRouter request failed: {e}") from e
    if r.status_code >= 400:
        raise HTTPException(502, f"OpenRouter error {r.status_code}: {r.text[:300]}")
    return r.json()["choices"][0]["message"]["content"].strip()


def _image_caption(doc: KBDocument) -> str:
    """Return a dense, searchable vision caption for an image doc (cached per doc.id).

    Runs the image through the vision model once to describe objects, any visible
    text, chart/diagram data, colours and layout — so the image can be embedded and
    retrieved by its actual visual content. Returns "" on any failure (callers then
    fall back to the title), so retrieval never breaks because of a captioning error.
    """
    if doc.id in _image_caption_cache:
        return _image_caption_cache[doc.id]

    data_uri = doc.content.strip()
    if not data_uri.startswith("data:image/"):
        return ""
    try:
        caption = _call_openrouter(
            "Describe this image for a search index. In 2-4 sentences cover: what it "
            "depicts, any visible text or labels verbatim, and — if it is a chart, "
            "diagram, or table — the data, axes, and trends shown. Be concrete and factual.",
            system="You write dense, factual image captions for a retrieval system.",
            images=[data_uri],
        )
        caption = caption.strip()
        _image_caption_cache[doc.id] = caption
        log.info("Captioned image doc id=%d (%d chars)", doc.id, len(caption))
        return caption
    except Exception:
        log.warning("Image captioning failed for doc id=%d; falling back to title", doc.id, exc_info=True)
        return ""


@contextmanager
def _video_source_path(content: str):
    """Yield a filesystem Path for a video doc's content, however it's stored.

    - "__VIDEO__:<folder>/<file>" (legacy/seeded videos) → path on disk, as-is.
    - "data:video/...;base64,..." (uploaded videos, DB-only) → decoded to a
      temp file for the duration of the `with` block, then deleted.
    Yields None if the content can't be resolved to a playable file.
    """
    c = content.strip()
    if c.startswith("__VIDEO__:"):
        rel = c[len("__VIDEO__:"):].split("\n")[0].strip()
        p = _SEED_DATA_DIR / rel
        yield p if p.exists() else None
        return

    if c.startswith("data:video/"):
        try:
            header, b64 = c.split(",", 1)
            ext = ".mp4"
            if "webm" in header:
                ext = ".webm"
            elif "ogg" in header or "ogv" in header:
                ext = ".ogv"
            elif "quicktime" in header:
                ext = ".mov"
            raw = base64.b64decode(b64)
        except Exception:
            yield None
            return
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(raw)
            tmp_path = Path(tmp.name)
        try:
            yield tmp_path
        finally:
            tmp_path.unlink(missing_ok=True)
        return

    yield None


def _video_transcript(path: Path) -> str:
    """Transcribe a video's audio with faster-whisper. Returns "" if the video has
    no audio track or transcription fails (the model is loaded lazily, only once)."""
    try:
        import av
        with av.open(str(path)) as container:
            if not container.streams.audio:
                return ""  # silent/visual-only video — nothing to transcribe
    except Exception:
        return ""
    try:
        global _whisper_model
        if _whisper_model is None:
            from faster_whisper import WhisperModel
            log.info("Loading faster-whisper 'base' model (first use)…")
            _whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
        segments, _info = _whisper_model.transcribe(str(path), beam_size=1)
        return " ".join(s.text.strip() for s in segments).strip()
    except Exception:
        log.warning("Whisper transcription failed for %s", path, exc_info=True)
        return ""


def _sample_video_frames(path: Path, n: int = 3) -> list[str]:
    """Sample n frames spread across the video, returned as JPEG data-URI strings."""
    try:
        import av
        frames: list[str] = []
        with av.open(str(path)) as container:
            vstream = container.streams.video[0]
            duration = float(vstream.duration * vstream.time_base) if vstream.duration else 0.0
            targets = [duration * (i + 1) / (n + 1) for i in range(n)] if duration else [0.0]
            ti = 0
            for frame in container.decode(video=0):
                if ti >= len(targets):
                    break
                if frame.time is None:
                    continue
                if frame.time >= targets[ti]:
                    img = frame.to_image()
                    img.thumbnail((768, 768))
                    buf = io.BytesIO()
                    img.save(buf, format="JPEG", quality=70)
                    b64 = base64.b64encode(buf.getvalue()).decode()
                    frames.append(f"data:image/jpeg;base64,{b64}")
                    ti += 1
        return frames
    except Exception:
        log.warning("Frame sampling failed for %s", path, exc_info=True)
        return []


def _video_understanding(doc: KBDocument) -> str:
    """Build a searchable text understanding of a video (cached per doc.id).

    Combines an audio transcript (via Whisper, when the video has sound) with a
    vision description of sampled frames — so videos are retrievable and answerable
    by their actual content, whether they carry speech, visuals, or both.
    Returns "" on total failure so callers fall back to the title.
    """
    if doc.id in _video_understanding_cache:
        return _video_understanding_cache[doc.id]

    with _video_source_path(doc.content) as path:
        if path is None:
            log.warning("Video source could not be resolved for doc id=%d", doc.id)
            return ""

        parts: list[str] = []
        transcript = _video_transcript(path)
        if transcript:
            parts.append(f"Audio transcript: {transcript}")

        frames = _sample_video_frames(path)
        if frames:
            try:
                visual = _call_openrouter(
                    "These are still frames sampled in order from a video. Describe what the "
                    "video shows and transcribe any on-screen text verbatim. 2-4 sentences, factual.",
                    system="You describe video content from sampled frames for a retrieval system.",
                    images=frames,
                ).strip()
                if visual:
                    parts.append(f"Visual content: {visual}")
            except Exception:
                log.warning("Video frame captioning failed for doc id=%d", doc.id, exc_info=True)

    result = "\n".join(parts)
    _video_understanding_cache[doc.id] = result
    if result:
        log.info("Understood video doc id=%d (%d chars)", doc.id, len(result))
    return result


def _parse_json_from_llm(text: str) -> dict:
    text = re.sub(r"```(?:json)?\s*", "", text).replace("```", "").strip()
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return {}
    try:
        return json.loads(m.group())
    except json.JSONDecodeError:
        return {}


def _looks_tabular(content: str) -> bool:
    """Detect CSV/TSV-style content — NOT just "first line has 2+ commas",
    which false-triggers on any ordinary prose paragraph with no line breaks
    (a sentence with two commas looks identical to a 3-column CSV header by
    that measure alone). Requires the header-like first line to have short,
    non-sentence fields, AND a second line with a similar field count — real
    structural evidence of rows/columns, not just punctuation.
    """
    lines = content.split("\n")
    first_line = lines[0] if lines else ""
    sep = "\t" if first_line.count("\t") >= first_line.count(",") else ","
    if first_line.count(sep) < 2:
        return False
    header_fields = [f.strip() for f in first_line.split(sep)]
    if not all(0 < len(f) < 40 and not f.endswith((".", "!", "?")) for f in header_fields):
        return False
    if len(lines) < 2 or not lines[1].strip():
        return False
    second_fields = lines[1].split(sep)
    return abs(len(header_fields) - len(second_fields)) <= 1


def _single_doc_questions(title: str, content: str, seed: int) -> tuple[str, str]:
    """Return (starter, followup) rule-based questions for one document.

    Several phrasings per content-type, chosen by `seed`, so a category full of
    similar documents (e.g. several novels) doesn't repeat the exact same
    sentence for every entry. Shared by the KB suggestion-chip generator and
    the per-answer "explore further" follow-ups in the chat endpoint.

    Follow-ups carry 6 variants (vs 3 starters): the chat endpoint walks these
    as a user drills into one document, and returns fewer chips rather than
    repeat once they're exhausted — more variants = more turns before that.
    Each list is indexed by its own length so `seed` sweeps every phrasing.
    """
    t = title.strip()
    c = (content or "").strip()
    i = seed

    if c.startswith("__PDF__:"):
        starters = [
            f'What are the main findings and methodology described in "{t}"?',
            f'What problem does "{t}" set out to solve, and how does it approach it?',
            f'What does "{t}" conclude, and what evidence supports it?',
        ]
        followups = [
            f'What specific evidence or examples does "{t}" use to support its claims?',
            f'What limitations or open questions does "{t}" acknowledge?',
            f'How does "{t}" position itself against related or prior work?',
            f'What are the key definitions or concepts introduced in "{t}"?',
            f'What future work or next steps does "{t}" suggest?',
            f'Which results in "{t}" are most surprising or significant?',
        ]
    elif c.startswith("__VIDEO__:") or c.startswith("data:video/"):
        starters = [
            f'What key topics and insights are covered in the "{t}" video?',
            f'What is the "{t}" video demonstrating, step by step?',
            f'Who is the intended audience for "{t}", and what will they learn?',
        ]
        followups = [
            f'What are the most important takeaways from "{t}"?',
            f'What specific examples or demos appear in "{t}"?',
            f'What should a viewer do after watching "{t}"?',
            f'What is the central message or argument of "{t}"?',
            f'What background knowledge helps in understanding "{t}"?',
            f'How could the ideas in "{t}" be applied in practice?',
        ]
    elif c.startswith("data:image"):
        starters = [
            f'What does the image "{t}" show or represent visually?',
            f'What is the subject or focal point of "{t}"?',
            f'What details stand out in "{t}" at first glance?',
        ]
        followups = [
            f'What patterns or anomalies are visible in "{t}"?',
            f'How would you describe the composition or layout of "{t}"?',
            f'What context or background does "{t}" suggest?',
            f'What colours or visual style define "{t}"?',
            f'What story or message does "{t}" convey?',
            f'What might be happening just outside the frame of "{t}"?',
        ]
    else:
        if _looks_tabular(c):
            starters = [
                f"What are the key statistics and patterns in the {t} dataset?",
                f"What is the size and structure of the {t} dataset?",
                f"Which columns or fields matter most in the {t} dataset?",
            ]
            followups = [
                f"What trends or outliers stand out in the {t} dataset?",
                f"How do values in {t} compare across categories or groups?",
                f"What would a summary statistic (mean, max, count) reveal about {t}?",
                f"Which records in {t} have the highest or lowest values?",
                f"Are there correlations between fields in the {t} dataset?",
                f"How is the data in {t} distributed across its categories?",
            ]
        elif c.startswith("{") or c.startswith("["):
            starters = [
                f"What key insights can you extract from the {t} dataset?",
                f"What is the structure (fields/keys) of the {t} data?",
                f"What does a typical entry in {t} look like?",
            ]
            followups = [
                f"What is the most interesting or unusual entry in the {t} data?",
                f"Are there any missing or inconsistent values in {t}?",
                f"How many entries does {t} contain, and what do they represent?",
                f"Which fields in {t} vary the most between entries?",
                f"What relationships connect the entries in {t}?",
                f"How would you summarise the {t} data in one sentence?",
            ]
        elif len(c) > 4000:
            starters = [
                f'What are the central themes and key arguments in "{t}"?',
                f'Who are the main characters or subjects in "{t}", and what happens to them?',
                f'What is the overall narrative or argument arc of "{t}"?',
            ]
            followups = [
                f'What specific examples does "{t}" use to illustrate its main ideas?',
                f'How does "{t}" resolve its central conflict or question?',
                f'What is a memorable or pivotal moment in "{t}"?',
                f'What tone or style characterises "{t}"?',
                f'What motivations drive the key figures in "{t}"?',
                f'What broader questions does "{t}" leave the reader with?',
            ]
        else:
            starters = [
                f'What key information and guidelines does "{t}" cover?',
                f'What problem does "{t}" help someone solve?',
                f'Who should read "{t}", and why?',
            ]
            followups = [
                f'What are the most actionable takeaways from "{t}"?',
                f'What steps or requirements does "{t}" spell out?',
                f'What would someone get wrong without reading "{t}"?',
                f'What prerequisites or context does "{t}" assume?',
                f'What edge cases or exceptions does "{t}" mention?',
                f'How does "{t}" recommend getting started?',
            ]

    return starters[i % len(starters)], followups[i % len(followups)]


def _mentions_doc(text: str, title: str) -> bool:
    """Loose check for whether `text` references this document's title —
    handles the LLM paraphrasing or partially quoting a title."""
    text_l = text.lower()
    if title.strip().lower() in text_l:
        return True
    words = [w for w in re.findall(r"[a-z0-9]+", title.lower()) if len(w) > 2]
    if not words:
        return False
    hits = sum(1 for w in words if w in text_l)
    return hits / len(words) >= 0.6


def _rrf(
    rankings: list[list[tuple[KBDocument, float]]], k: int = 60, top_n: int = _TOP_K
) -> List[tuple[KBDocument, float]]:
    scores: dict[int, float] = {}
    docs_map: dict[int, KBDocument] = {}
    for ranking in rankings:
        for rank, (doc, _) in enumerate(ranking):
            scores[doc.id] = scores.get(doc.id, 0.0) + 1.0 / (k + rank + 1)
            docs_map[doc.id] = doc
    merged = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_n]
    # Raw RRF scores are tiny (max ≈ num_rankings/(k+1) ≈ 0.03), which is
    # misleading when surfaced as a confidence %. Normalise against the
    # theoretical maximum so a doc ranked #1 across every retriever → 1.0.
    max_score = len(rankings) / (k + 1) if rankings else 1.0
    return [(docs_map[did], min(s / max_score, 1.0)) for did, s in merged]
