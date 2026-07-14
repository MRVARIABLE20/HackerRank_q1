"""12 — SQL RAG: LLM-generated SELECT queries executed via DuckDB in-memory."""
from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import List

from ..models import KBDocument
from .core import StrategyResult, _call_openrouter, _looks_tabular

log = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_SQL_DATA_DIR = _PROJECT_ROOT / "seeding_data" / "12_sql_rag"


def _kb_doc_csv_path(doc_id: int) -> Path:
    # "kbdoc_" prefix avoids any collision with descriptively-named seed CSVs
    # (e.g. seaborn_penguins.csv), which live in the same folder.
    return _SQL_DATA_DIR / f"kbdoc_{doc_id}.csv"


def sync_kb_doc_to_disk(doc_id: int, category: str, content: str) -> None:
    """Mirror a '12 SQL RAG' KB document's CSV/TSV content to disk.

    The SQL engine below only loads tables from seeding_data/12_sql_rag/*.csv —
    it has no visibility into the kb_documents DB table. Without this, tabular
    data added via the KB page would be retrieved by title/text (naive vector
    search) but never actually queryable with real SQL, silently degrading
    correctness on aggregation questions. Call on create and on update.
    """
    path = _kb_doc_csv_path(doc_id)
    if category != "12 SQL RAG" or not _looks_tabular(content):
        path.unlink(missing_ok=True)  # no longer SQL/tabular — drop any stale mirror
        return
    _SQL_DATA_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def remove_kb_doc_from_disk(doc_id: int) -> None:
    """Delete a doc's on-disk CSV mirror, if one exists. Call on delete."""
    _kb_doc_csv_path(doc_id).unlink(missing_ok=True)


def run(query: str, docs: List[KBDocument]) -> StrategyResult:
    from .naive import run as naive_run
    import duckdb

    csv_files = list(_SQL_DATA_DIR.glob("*.csv")) if _SQL_DATA_DIR.exists() else []
    if not csv_files:
        log.warning("No CSV files found in %s — falling back to naive", _SQL_DATA_DIR)
        return naive_run(query, docs)

    conn = duckdb.connect()
    tables: list[dict] = []
    for csv_path in csv_files:
        table_name = re.sub(r"[^a-z0-9_]", "_", csv_path.stem.lower())
        try:
            conn.execute(f"CREATE TABLE {table_name} AS SELECT * FROM read_csv_auto('{csv_path.as_posix()}')")
            cols = [row[0] for row in conn.execute(f"DESCRIBE {table_name}").fetchall()]
            rows = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
            tables.append({"name": table_name, "columns": cols, "rows": rows})
        except Exception as e:
            log.warning("Failed to load %s: %s", csv_path.name, e)

    if not tables:
        return naive_run(query, docs)

    schema_lines = []
    for t in tables:
        col_str = ", ".join(t["columns"])
        try:
            sample = conn.execute(f"SELECT * FROM {t['name']} LIMIT 2").fetchall()
            sample_str = " | ".join(str(r) for r in sample)
            schema_lines.append(
                f"TABLE {t['name']} ({t['rows']} rows): {col_str}\n  SAMPLE ROWS: {sample_str}"
            )
        except Exception:
            schema_lines.append(f"TABLE {t['name']} ({t['rows']} rows): {col_str}")
    schema = "\n".join(schema_lines)

    sql_raw = _call_openrouter(
        f"Generate a SQL SELECT query to answer:\n\nQuestion: {query}\n\nTables:\n{schema}\n\n"
        "Rules: Only SELECT. Use aliases. ROUND percentages. LIMIT top-N queries. "
        "Use ILIKE or LIKE for string filters so partial names match (e.g. region ILIKE '%North%'). "
        "Use COALESCE(SUM(col), 0) to avoid NULL results. "
        "Reply with ONLY the SQL query.",
        system="You are a SQL generator. Output only the SQL query, nothing else.",
        temperature=0.1,
    )
    sql_q = re.sub(r"```(?:sql)?\s*", "", sql_raw).replace("```", "").strip()

    norm = sql_q.upper()
    if not norm.startswith("SELECT"):
        return naive_run(query, docs)
    for blocked in ("DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "CREATE", "EXEC"):
        if blocked in norm:
            return naive_run(query, docs)

    try:
        df = conn.execute(sql_q).df()
        df = df.fillna(0)
        result_str = df.to_string(index=False, max_rows=20)
        row_count = len(df)
    except Exception as e:
        log.warning("SQL execution failed (%s): %s", e, sql_q)
        return naive_run(query, docs)

    answer = _call_openrouter(
        f"Question: {query}\n\nSQL result ({row_count} rows):\n{result_str}\n\n"
        "Write a clear, concise natural language answer using exact numbers. Don't mention SQL."
    )
    # Return KB docs as reference citations; confidence reflects whether rows were returned
    ref_score = 0.85 if row_count > 0 else 0.1
    ref_picks = [(d, ref_score) for d in docs[:2]] if docs else []
    return answer, ref_picks, {
        "strategy": "sql",
        "sql_query": sql_q,
        "rows_returned": row_count,
        "tables_available": [t["name"] for t in tables],
        "result_preview": result_str[:300],
    }
