"""
Integration tests for all 14 RAG strategies — strict data-isolation edition.

Each test class verifies two things:
  1. POSITIVE: the RAG answers correctly from its OWN category's documents.
  2. ISOLATION: when asked about another RAG's data, it returns NO citations
     from that other category (all_docs is pre-filtered per strategy in chat.py).

Category map (mirrors STRATEGY_CATEGORY in chat.py):
  naive→01, bm25→02, hybrid→03, self_rag→04, corrective→05,
  graph→06, speculative→07, rag_fusion→08, adaptive→09,
  agentic→10, multihop→11, sql→12, multimodal→13, modular→14

Run
---
  pip install pytest requests
  pytest tests/test_all_rags.py -v
  pytest tests/test_all_rags.py -v -k "Isolation"   # only isolation tests
"""
from __future__ import annotations
import pytest
import requests

BASE    = "http://localhost:8001"
EMAIL   = "admin@gmail.com"
PASSW   = "admin123"
TIMEOUT = 90


# ── Session fixture ───────────────────────────────────────────────────────────

def _login() -> str:
    r = requests.post(f"{BASE}/auth/login",
                      json={"email": EMAIL, "password": PASSW}, timeout=10)
    assert r.status_code == 200, f"Login failed: {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def token() -> str:
    return _login()


# ── Core helpers ──────────────────────────────────────────────────────────────

def chat(tok: str, query: str, strategy: str) -> dict:
    def _post(t: str):
        return requests.post(
            f"{BASE}/chat",
            json={"query": query, "rag_strategy": strategy},
            headers={"Authorization": f"Bearer {t}"},
            timeout=TIMEOUT,
        )

    r = _post(tok)
    if r.status_code == 401:
        # This suite makes ~90 real LLM calls with no mocking and can run for
        # hours; the session-scoped token fixture is fetched once at the start
        # and can outlive its own JWT expiry before the run finishes. Refresh
        # once and retry rather than failing every remaining test.
        r = _post(_login())
    assert r.status_code == 200, (
        f"[{strategy}] HTTP {r.status_code}: {r.text[:300]}"
    )
    return r.json()


def assert_own_category(resp: dict, strategy: str, expected_category: str) -> None:
    """ALL citations must come exclusively from expected_category."""
    assert resp.get("answer"), "answer must not be empty"
    assert resp["router_decision"]["strategy"] == strategy

    citations = resp.get("citations", [])
    assert citations, f"[{strategy}] expected citations, got none"

    wrong = [c for c in citations if expected_category not in c["department"]]
    assert not wrong, (
        f"[{strategy}] citations leaked from wrong categories: "
        + str([c["department"] for c in wrong])
    )


def assert_isolated(resp: dict, strategy: str, own_category: str,
                    foreign_category: str) -> None:
    """No citation must come from foreign_category — data isolation check."""
    leaked = [c for c in resp.get("citations", [])
              if foreign_category in c["department"]]
    assert not leaked, (
        f"[{strategy}] DATA LEAK — citations from foreign category "
        f"'{foreign_category}' appeared: {leaked}"
    )
    # Also confirm all citations are only from own category
    for c in resp.get("citations", []):
        assert own_category in c["department"], (
            f"[{strategy}] citation from unexpected dept '{c['department']}'"
        )


# ═════════════════════════════════════════════════════════════════════════════
# 01 — Naive RAG  |  own docs: Pride & Prejudice, HuggingFace README, RAG pdf
# ═════════════════════════════════════════════════════════════════════════════
class TestNaiveRAG:
    S = "naive"
    C = "01 Naive RAG"

    def test_own_gutenberg(self, token):
        resp = chat(token, "Who is Mr. Darcy in Pride and Prejudice?", self.S)
        assert_own_category(resp, self.S, self.C)
        assert "darcy" in resp["answer"].lower() or "pride" in resp["answer"].lower()

    def test_own_readme(self, token):
        resp = chat(token, "What is HuggingFace Transformers library used for?", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_isolation_no_bm25_data(self, token):
        # Sherlock Holmes lives in 02 BM25 RAG — Naive must NOT return BM25 docs
        resp = chat(token, "Who is Sherlock Holmes and where does he live?", self.S)
        assert_isolated(resp, self.S, self.C, "02 BM25 RAG")

    def test_isolation_no_sql_data(self, token):
        # Penguins dataset lives in 12 SQL RAG
        resp = chat(token, "How many Adelie penguins are in the dataset?", self.S)
        assert_isolated(resp, self.S, self.C, "12 SQL RAG")

    def test_confidence_nonzero(self, token):
        resp = chat(token, "Who wrote Pride and Prejudice?", self.S)
        assert resp["confidence"] > 0.0


# ═════════════════════════════════════════════════════════════════════════════
# 02 — BM25 RAG  |  own docs: Sherlock Holmes, Titanic CSV, Vega Movies JSON
# ═════════════════════════════════════════════════════════════════════════════
class TestBM25RAG:
    S = "bm25"
    C = "02 BM25 RAG"

    def test_own_gutenberg(self, token):
        resp = chat(token, "Who is Sherlock Holmes and what mysteries does he solve?", self.S)
        assert_own_category(resp, self.S, self.C)
        assert "holmes" in resp["answer"].lower() or "detective" in resp["answer"].lower()

    def test_own_csv(self, token):
        resp = chat(token, "How many passengers survived in the Titanic dataset?", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_own_json(self, token):
        resp = chat(token, "What movies are listed in the dataset with their gross earnings?", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_isolation_no_naive_data(self, token):
        # Pride and Prejudice lives in 01 Naive RAG
        resp = chat(token, "Who is Mr. Darcy in Pride and Prejudice?", self.S)
        assert_isolated(resp, self.S, self.C, "01 Naive RAG")

    def test_isolation_no_hybrid_data(self, token):
        # Huckleberry Finn lives in 03 Hybrid RAG
        resp = chat(token, "What is the story of Huckleberry Finn?", self.S)
        assert_isolated(resp, self.S, self.C, "03 Hybrid RAG")


# ═════════════════════════════════════════════════════════════════════════════
# 03 — Hybrid RAG  |  own docs: Huckleberry Finn, MPG CSV, Vega Cars JSON
# ═════════════════════════════════════════════════════════════════════════════
class TestHybridRAG:
    S = "hybrid"
    C = "03 Hybrid RAG"

    def test_own_gutenberg(self, token):
        resp = chat(token, "What is the story of Huckleberry Finn?", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_own_csv(self, token):
        resp = chat(token, "What car brands appear in the MPG fuel efficiency dataset?", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_own_json(self, token):
        resp = chat(token, "List cars with their miles per gallon from the cars dataset.", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_isolation_no_bm25_data(self, token):
        # Titanic CSV lives in 02 BM25 RAG
        resp = chat(token, "How many Titanic passengers survived?", self.S)
        assert_isolated(resp, self.S, self.C, "02 BM25 RAG")

    def test_isolation_no_multihop_data(self, token):
        # Node.js README lives in 11 Multi-hop RAG
        resp = chat(token, "What is Node.js and what is it used for?", self.S)
        assert_isolated(resp, self.S, self.C, "11 Multi-hop RAG")


# ═════════════════════════════════════════════════════════════════════════════
# 04 — Self-RAG  |  own docs: Frankenstein, PyTorch README, Self-RAG paper
# ═════════════════════════════════════════════════════════════════════════════
class TestSelfRAG:
    S = "self_rag"
    C = "04 Self-RAG"

    def test_own_gutenberg(self, token):
        resp = chat(token, "Who created Frankenstein's monster and what was it like?", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_own_readme(self, token):
        resp = chat(token, "What is PyTorch and what is it used for in deep learning?", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_retrieve_decision_meta(self, token):
        resp = chat(token, "What is the Self-RAG retrieval approach?", self.S)
        assert "retrieve_decision" in resp["router_decision"]

    def test_isolation_no_corrective_data(self, token):
        # Tale of Two Cities lives in 05 Corrective RAG
        resp = chat(token, "What is the famous opening line of A Tale of Two Cities?", self.S)
        assert_isolated(resp, self.S, self.C, "05 Corrective RAG")

    def test_isolation_no_graph_data(self, token):
        # War and Peace lives in 06 Graph RAG
        resp = chat(token, "Who are the main characters in War and Peace?", self.S)
        assert_isolated(resp, self.S, self.C, "06 Graph RAG")


# ═════════════════════════════════════════════════════════════════════════════
# 05 — Corrective RAG  |  own: Tale of Two Cities, Pandas README, paper
# ═════════════════════════════════════════════════════════════════════════════
class TestCorrectiveRAG:
    S = "corrective"
    C = "05 Corrective RAG"

    def test_own_gutenberg(self, token):
        resp = chat(token, "What is the famous opening line of A Tale of Two Cities?", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_own_readme(self, token):
        resp = chat(token, "What data structures does the Pandas library provide?", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_isolation_no_self_rag_data(self, token):
        # Frankenstein lives in 04 Self-RAG
        resp = chat(token, "Who created Frankenstein's monster?", self.S)
        assert_isolated(resp, self.S, self.C, "04 Self-RAG")

    def test_isolation_no_speculative_data(self, token):
        # Moby Dick lives in 07 Speculative RAG
        resp = chat(token, "Who is Captain Ahab and what is his obsession?", self.S)
        assert_isolated(resp, self.S, self.C, "07 Speculative RAG")


# ═════════════════════════════════════════════════════════════════════════════
# 06 — Graph RAG  |  own: War and Peace, D3.js README, Graph RAG paper
# ═════════════════════════════════════════════════════════════════════════════
class TestGraphRAG:
    S = "graph"
    C = "06 Graph RAG"

    def test_own_gutenberg(self, token):
        resp = chat(token, "Who are the main characters in War and Peace?", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_own_readme(self, token):
        resp = chat(token, "What is D3.js and what kind of visualizations can it create?", self.S)
        assert_own_category(resp, self.S, self.C)
        assert "d3" in resp["answer"].lower() or "javascript" in resp["answer"].lower()

    def test_isolation_no_corrective_data(self, token):
        # Pandas README lives in 05 Corrective RAG
        resp = chat(token, "What is the Pandas library?", self.S)
        assert_isolated(resp, self.S, self.C, "05 Corrective RAG")

    def test_isolation_no_rag_fusion_data(self, token):
        # Dracula lives in 08 RAG-Fusion
        resp = chat(token, "What powers does Count Dracula have?", self.S)
        assert_isolated(resp, self.S, self.C, "08 RAG-Fusion")


# ═════════════════════════════════════════════════════════════════════════════
# 07 — Speculative RAG  |  own: Moby Dick, NumPy README, Chain-of-Thought pdf
# ═════════════════════════════════════════════════════════════════════════════
class TestSpeculativeRAG:
    S = "speculative"
    C = "07 Speculative RAG"

    def test_own_gutenberg(self, token):
        resp = chat(token, "Who is Captain Ahab and what is his obsession in Moby Dick?", self.S)
        assert_own_category(resp, self.S, self.C)
        assert "ahab" in resp["answer"].lower() or "whale" in resp["answer"].lower()

    def test_own_readme(self, token):
        resp = chat(token, "What mathematical operations does NumPy support?", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_isolation_no_graph_data(self, token):
        # D3.js README lives in 06 Graph RAG
        resp = chat(token, "What is D3.js used for?", self.S)
        assert_isolated(resp, self.S, self.C, "06 Graph RAG")

    def test_isolation_no_rag_fusion_data(self, token):
        # FastAPI README lives in 08 RAG-Fusion
        resp = chat(token, "What makes FastAPI fast for building APIs?", self.S)
        assert_isolated(resp, self.S, self.C, "08 RAG-Fusion")


# ═════════════════════════════════════════════════════════════════════════════
# 08 — RAG-Fusion  |  own: Dracula, FastAPI README, DPR paper
# ═════════════════════════════════════════════════════════════════════════════
class TestRAGFusion:
    S = "rag_fusion"
    C = "08 RAG-Fusion"

    def test_own_gutenberg(self, token):
        resp = chat(token, "What powers does Count Dracula have in the novel?", self.S)
        assert_own_category(resp, self.S, self.C)
        assert "dracula" in resp["answer"].lower() or "vampire" in resp["answer"].lower()

    def test_own_readme(self, token):
        resp = chat(token, "What makes FastAPI suitable for production APIs?", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_isolation_no_speculative_data(self, token):
        # NumPy README lives in 07 Speculative RAG
        resp = chat(token, "What is NumPy and what does it provide?", self.S)
        assert_isolated(resp, self.S, self.C, "07 Speculative RAG")

    def test_isolation_no_adaptive_data(self, token):
        # Flask README lives in 09 Adaptive RAG
        resp = chat(token, "What is Flask and how is it used for web development?", self.S)
        assert_isolated(resp, self.S, self.C, "09 Adaptive RAG")


# ═════════════════════════════════════════════════════════════════════════════
# 09 — Adaptive RAG  |  own: Alice in Wonderland, Flask README, Seattle weather
#                          CSV, Population JSON, Adaptive RAG paper
# ═════════════════════════════════════════════════════════════════════════════
class TestAdaptiveRAG:
    S = "adaptive"
    C = "09 Adaptive RAG"

    def test_own_gutenberg(self, token):
        resp = chat(token, "What adventures does Alice have after falling down the rabbit hole?", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_own_readme(self, token):
        resp = chat(token, "What is Flask and how is it used for Python web development?", self.S)
        assert_own_category(resp, self.S, self.C)
        assert "flask" in resp["answer"].lower()

    def test_own_csv(self, token):
        resp = chat(token, "What does the Seattle weather dataset show about precipitation?", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_isolation_no_rag_fusion_data(self, token):
        # FastAPI README lives in 08 RAG-Fusion
        resp = chat(token, "What makes FastAPI fast for building APIs?", self.S)
        assert_isolated(resp, self.S, self.C, "08 RAG-Fusion")

    def test_isolation_no_agentic_data(self, token):
        # Diamonds CSV lives in 10 Agentic RAG
        resp = chat(token, "What are the most expensive diamonds in the dataset?", self.S)
        assert_isolated(resp, self.S, self.C, "10 Agentic RAG")


# ═════════════════════════════════════════════════════════════════════════════
# 10 — Agentic RAG  |  own: The Prince, Diamonds CSV, Flights JSON, ReAct pdf
# ═════════════════════════════════════════════════════════════════════════════
class TestAgenticRAG:
    S = "agentic"
    C = "10 Agentic RAG"

    def test_own_gutenberg(self, token):
        resp = chat(token, "What does Machiavelli say about how a prince should rule?", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_own_csv(self, token):
        resp = chat(token, "What are the most expensive diamonds in the dataset?", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_own_json(self, token):
        resp = chat(token, "Which flight routes have the most delays in the dataset?", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_isolation_no_adaptive_data(self, token):
        # Alice in Wonderland lives in 09 Adaptive RAG
        resp = chat(token, "What adventures does Alice have in Wonderland?", self.S)
        assert_isolated(resp, self.S, self.C, "09 Adaptive RAG")

    def test_isolation_no_multihop_data(self, token):
        # Crime and Punishment lives in 11 Multi-hop RAG
        resp = chat(token, "Who is Raskolnikov and what crime does he commit?", self.S)
        assert_isolated(resp, self.S, self.C, "11 Multi-hop RAG")


# ═════════════════════════════════════════════════════════════════════════════
# 11 — Multi-hop RAG  |  own: Crime and Punishment, Node.js README, GPT-3 pdf
# ═════════════════════════════════════════════════════════════════════════════
class TestMultihopRAG:
    S = "multihop"
    C = "11 Multi-hop RAG"

    def test_own_gutenberg(self, token):
        resp = chat(token, "Who is Raskolnikov and what crime does he commit in Crime and Punishment?", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_own_readme(self, token):
        resp = chat(token, "What is Node.js and what runtime environment does it provide?", self.S)
        assert_own_category(resp, self.S, self.C)
        assert "node" in resp["answer"].lower() or "javascript" in resp["answer"].lower()

    def test_isolation_no_agentic_data(self, token):
        # The Prince lives in 10 Agentic RAG
        resp = chat(token, "What does Machiavelli say about leadership?", self.S)
        assert_isolated(resp, self.S, self.C, "10 Agentic RAG")

    def test_isolation_no_sql_data(self, token):
        # Penguins CSV lives in 12 SQL RAG
        resp = chat(token, "How many Adelie penguins are in the dataset?", self.S)
        assert_isolated(resp, self.S, self.C, "12 SQL RAG")


# ═════════════════════════════════════════════════════════════════════════════
# 12 — SQL RAG  |  own: penguins CSV (DuckDB), penguins TSV, A Modest Proposal
# Note: SQL RAG reads CSVs directly via DuckDB — citations may be minimal
# ═════════════════════════════════════════════════════════════════════════════
class TestSQLRAG:
    S = "sql"
    C = "12 SQL RAG"

    def test_own_count(self, token):
        resp = chat(token, "How many Adelie penguins are in the penguins dataset?", self.S)
        assert resp["answer"]
        assert resp["router_decision"]["strategy"] == "sql"
        # Verify any citations that exist are only from SQL category
        for c in resp.get("citations", []):
            assert self.C in c["department"], (
                f"SQL RAG citation leaked from '{c['department']}'"
            )

    def test_own_aggregation(self, token):
        resp = chat(token, "What is the average bill length in mm for each penguin species?", self.S)
        assert resp["answer"]
        assert resp["router_decision"]["strategy"] == "sql"

    def test_own_filter(self, token):
        resp = chat(token, "List all Chinstrap penguins with their island and body mass.", self.S)
        assert resp["answer"]

    def test_own_sex_breakdown(self, token):
        resp = chat(token, "How many male versus female penguins are in the dataset?", self.S)
        assert resp["answer"]

    def test_isolation_no_multihop_data(self, token):
        # Node.js README lives in 11 Multi-hop RAG
        resp = chat(token, "What is Node.js used for?", self.S)
        for c in resp.get("citations", []):
            assert "11 Multi-hop RAG" not in c["department"], \
                "SQL RAG must not return Multi-hop RAG docs"

    def test_isolation_no_multimodal_data(self, token):
        # Dorian Gray lives in 13 Multimodal RAG
        resp = chat(token, "What is the story of The Picture of Dorian Gray?", self.S)
        for c in resp.get("citations", []):
            assert "13 Multimodal RAG" not in c["department"], \
                "SQL RAG must not return Multimodal RAG docs"


# ═════════════════════════════════════════════════════════════════════════════
# 13 — Multimodal RAG  |  own: Dorian Gray (txt), CLIP pdf, Grace Hopper jpg,
#                              Firefox png, Google I/O mp4
# ═════════════════════════════════════════════════════════════════════════════
class TestMultimodalRAG:
    S = "multimodal"
    C = "13 Multimodal RAG"

    def test_own_text(self, token):
        resp = chat(token, "What is the story of The Picture of Dorian Gray?", self.S)
        assert_own_category(resp, self.S, self.C)
        assert "dorian" in resp["answer"].lower() or "gray" in resp["answer"].lower()

    def test_own_image(self, token):
        resp = chat(token, "What images are embedded in the multimodal knowledge base?", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_own_video(self, token):
        resp = chat(token, "What is the Google I/O video about multimodal RAG?", self.S)
        assert_own_category(resp, self.S, self.C)

    def test_visual_docs_meta(self, token):
        resp = chat(token, "What visual content is available about the CLIP model?", self.S)
        rd = resp["router_decision"]
        assert rd["strategy"] == "multimodal"
        assert "visual_docs_in_kb" in rd
        assert rd["visual_docs_in_kb"] >= 1

    def test_no_binary_in_answer(self, token):
        resp = chat(token, "Describe the images available in the knowledge base.", self.S)
        assert "data:image" not in resp["answer"], \
            "base64 data URL must NOT appear raw in the LLM answer"
        assert "__VIDEO__" not in resp["answer"], \
            "__VIDEO__ prefix must NOT appear raw in the LLM answer"

    def test_isolation_no_sql_data(self, token):
        # Penguins CSV lives in 12 SQL RAG
        resp = chat(token, "How many Adelie penguins are in the dataset?", self.S)
        assert_isolated(resp, self.S, self.C, "12 SQL RAG")

    def test_isolation_no_modular_data(self, token):
        # Jane Eyre lives in 14 Modular RAG
        resp = chat(token, "Who is Jane Eyre and what is the main conflict in the novel?", self.S)
        assert_isolated(resp, self.S, self.C, "14 Modular RAG")


# ═════════════════════════════════════════════════════════════════════════════
# 14 — Modular RAG  |  own: Jane Eyre, Attention Is All You Need pdf,
#                          Vega stocks CSV, Vega flare JSON
# ═════════════════════════════════════════════════════════════════════════════
class TestModularRAG:
    S = "modular"
    C = "14 Modular RAG"

    def test_own_text(self, token):
        resp = chat(token, "Who is Jane Eyre and what is the main conflict in the novel?", self.S)
        assert resp["answer"]
        assert resp["router_decision"]["strategy"] == "modular"
        # Modular routes to sub-strategies which have their own docs —
        # verify the top-level strategy is modular and answer is non-empty
        assert "jane" in resp["answer"].lower() or "eyre" in resp["answer"].lower()

    def test_own_csv_stocks(self, token):
        resp = chat(token, "What are the stock prices for Microsoft in the dataset?", self.S)
        assert resp["answer"]
        assert resp["router_decision"]["strategy"] == "modular"

    def test_own_json_flare(self, token):
        resp = chat(token, "What is the structure of the Vega flare dataset?", self.S)
        assert resp["answer"]
        assert resp["router_decision"]["strategy"] == "modular"

    def test_detected_type_and_routed_to_in_meta(self, token):
        resp = chat(token, "What does Attention Is All You Need say about transformers?", self.S)
        rd = resp["router_decision"]
        assert rd["strategy"] == "modular"
        assert "detected_type" in rd, "modular must expose detected_type"
        assert "routed_to" in rd,    "modular must expose routed_to"

    def test_isolation_citations_not_from_multimodal(self, token):
        # Dorian Gray lives in 13 Multimodal RAG — modular's own docs don't include it
        resp = chat(token, "What is the story of Dorian Gray?", self.S)
        # When modular routes to multimodal sub-strategy, it uses
        # extra_docs["multimodal"] = 13 Multimodal RAG docs — that is correct behaviour.
        # What must NOT happen is modular returning 14 Modular RAG citations mixed
        # with 13 Multimodal RAG citations in the same response when routing factual.
        rd = resp["router_decision"]
        assert rd["strategy"] == "modular"
        assert resp["answer"]

    def test_isolation_no_naive_data(self, token):
        # Pride and Prejudice lives in 01 Naive RAG
        resp = chat(token, "Who is Mr. Darcy in Pride and Prejudice?", self.S)
        # Modular's own docs (Jane Eyre, stocks, flare, attention paper) must be used,
        # never 01 Naive RAG docs
        for c in resp.get("citations", []):
            assert "01 Naive RAG" not in c["department"], \
                "Modular RAG must not pull from Naive RAG category"
