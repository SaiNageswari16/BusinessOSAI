"""
database.py – High-performance synchronous bulk insert using psycopg2 executemany.

Strategy: bypass SQLAlchemy ORM entirely for the insert hot-path.
We use psycopg2's execute_values() which builds a single VALUES(...),(...),...
statement — the fastest possible way to bulk-insert into PostgreSQL.

ON CONFLICT DO UPDATE (upsert) is handled natively via the SQL string.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import psycopg2
import psycopg2.extras
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from config import ImporterConfig
from logger import get_logger

log = get_logger("database")

TABLE_NAME = "erp_master_catalog"

# Columns we write on every row (must match the VALUES template order exactly)
WRITE_COLUMNS = [
    "id", "tenant_id", "created_at", "updated_at",
    "barcode", "name", "brand", "category",
    "image_url", "short_description", "supplier", "specifications",
    "source", "cost_price", "mrp", "sale_price",
    "ai_search_done", "rag_status",
]

# SQL template used by execute_values — one %s placeholder per row
_UPSERT_SQL = f"""
INSERT INTO {TABLE_NAME}
    ({", ".join(WRITE_COLUMNS)})
VALUES %s
ON CONFLICT (barcode) WHERE barcode IS NOT NULL
DO UPDATE SET
    name             = EXCLUDED.name,
    brand            = EXCLUDED.brand,
    category         = EXCLUDED.category,
    image_url        = EXCLUDED.image_url,
    short_description= EXCLUDED.short_description,
    supplier         = EXCLUDED.supplier,
    specifications   = EXCLUDED.specifications,
    source           = EXCLUDED.source,
    updated_at       = EXCLUDED.updated_at
"""

_INSERT_ONLY_SQL = f"""
INSERT INTO {TABLE_NAME}
    ({", ".join(WRITE_COLUMNS)})
VALUES %s
ON CONFLICT (barcode) WHERE barcode IS NOT NULL
DO NOTHING
"""

# Module-level raw psycopg2 connection string (populated by build_engine)
_DSN: str = ""


def build_engine(cfg: ImporterConfig) -> Engine:
    """Create a SQLAlchemy engine (used for health-check/reflection only)."""
    global _DSN

    engine = create_engine(
        cfg.database_url,
        pool_pre_ping=True,
        pool_size=2,   # minimal; actual inserts use raw psycopg2
        echo=False,
    )

    # Store a raw psycopg2 DSN for the hot-path workers
    _DSN = cfg.database_url.replace("postgresql+psycopg2://", "postgresql://")

    # Verify table exists
    with engine.connect() as conn:
        count = conn.execute(text(f"SELECT COUNT(*) FROM {TABLE_NAME}")).scalar()
        log.info("Engine ready: %s", cfg.database_url.split("@")[-1])
        log.info("Table '%s' OK — current rows: %s", TABLE_NAME, f"{count:,}")

    return engine


def make_session_factory(engine: Engine) -> sessionmaker:
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)


# ── Row preparation ────────────────────────────────────────────────────────────

def _prepare_row(cleaned: dict[str, Any]) -> tuple:
    """
    Convert a cleaned dict → a tuple ordered exactly as WRITE_COLUMNS.
    psycopg2's execute_values requires tuples (or lists), not dicts.
    """
    now = datetime.now(timezone.utc)
    return (
        str(uuid.uuid4()),      # id
        None,                   # tenant_id
        now,                    # created_at
        now,                    # updated_at
        cleaned.get("barcode"),
        cleaned.get("name"),
        cleaned.get("brand"),
        cleaned.get("category"),
        cleaned.get("image_url"),
        cleaned.get("short_description"),
        cleaned.get("supplier"),
        cleaned.get("specifications"),
        cleaned.get("source", "OPEN_FOOD_FACTS"),
        cleaned.get("cost_price"),
        cleaned.get("mrp"),
        cleaned.get("sale_price"),
        False,                  # ai_search_done
        "pending",              # rag_status
    )


# ── Bulk upsert via psycopg2 execute_values ────────────────────────────────────

def insert_batch_raw(
    rows: list[dict[str, Any]],
    duplicate_mode: str,
) -> tuple[int, int]:
    """
    Open a fresh psycopg2 connection, execute execute_values(), commit, close.
    This is the fastest possible PostgreSQL bulk-insert path.
    Returns (rows_affected, 0).
    """
    if not rows:
        return 0, 0

    tuples = [_prepare_row(r) for r in rows]
    sql    = _UPSERT_SQL if duplicate_mode == "upsert" else _INSERT_ONLY_SQL

    conn = psycopg2.connect(_DSN)
    try:
        with conn.cursor() as cur:
            psycopg2.extras.execute_values(
                cur,
                sql,
                tuples,
                template=None,
                page_size=500,   # execute_values splits into pages internally
            )
        conn.commit()
        return len(tuples), 0
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── Retry wrapper ──────────────────────────────────────────────────────────────

def retry_batch(
    rows: list[dict[str, Any]],
    duplicate_mode: str,
    retries: int = 3,
    delay: float = 2.0,
) -> tuple[int, int]:
    """Try a batch up to `retries` times with exponential back-off."""
    import time
    last_exc: Exception | None = None

    for attempt in range(1, retries + 1):
        try:
            return insert_batch_raw(rows, duplicate_mode)
        except Exception as exc:
            last_exc = exc
            log.warning("Batch attempt %d/%d failed: %s", attempt, retries, exc)
            time.sleep(delay * attempt)

    raise RuntimeError(f"Batch failed after {retries} retries") from last_exc
