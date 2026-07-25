"""
config.py – All importer settings in one place.
Reads database credentials from ../.env (the main backend .env).
All tuneable constants live here; zero hardcoded values in other modules.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv

# ── Resolve paths ──────────────────────────────────────────────────────────────
IMPORTER_DIR = Path(__file__).resolve().parent
BACKEND_DIR  = IMPORTER_DIR.parent
ENV_FILE     = BACKEND_DIR / ".env"

load_dotenv(ENV_FILE)


# ── Database ───────────────────────────────────────────────────────────────────
def _build_db_url() -> str:
    """Construct a synchronous psycopg2 DSN from .env variables."""
    host     = os.getenv("POSTGRES_HOST",     "localhost")
    port     = os.getenv("POSTGRES_PORT",     "5432")
    user     = os.getenv("POSTGRES_USER",     "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "")
    db       = os.getenv("POSTGRES_DB",       "businessosai")
    return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{db}"


@dataclass
class ImporterConfig:
    # ── I/O ────────────────────────────────────────────────────────────────────
    input_file: Path = field(
        default_factory=lambda: Path(
            r"D:\en.openfoodfacts.org.products (1).csv"
            r"\en.openfoodfacts.org.products (1).csv"
        )
    )
    log_file:          Path = IMPORTER_DIR / "import.log"
    failed_rows_file:  Path = IMPORTER_DIR / "failed_rows.csv"

    # ── Database ───────────────────────────────────────────────────────────────
    database_url: str = field(default_factory=_build_db_url)

    # ── Performance ────────────────────────────────────────────────────────────
    chunk_size:    int = 10_000   # rows read from TSV per pandas chunk
    batch_size:    int = 2_000    # rows upserted per DB transaction
    max_workers:   int = 4        # parallel batch threads (set 1 to disable)
    pool_size:     int = 10       # SQLAlchemy connection pool
    max_overflow:  int = 20

    # ── Duplicate handling ─────────────────────────────────────────────────────
    # "upsert"  → insert new + update existing (default)
    # "insert"  → skip rows whose barcode already exists
    # "replace" → delete + re-insert (slow, keeps table clean)
    duplicate_mode: Literal["upsert", "insert", "skip"] = "upsert"

    # ── Data quality ───────────────────────────────────────────────────────────
    skip_missing_name:   bool = True   # drop rows with no product_name
    skip_missing_barcode: bool = False  # keep rows without barcode (nullable)
    max_name_length:     int  = 255
    max_brand_length:    int  = 150
    max_category_length: int  = 150
    max_string_length:   int  = 1024

    # ── Data source tag stored in every row ───────────────────────────────────
    data_source: str = "OPEN_FOOD_FACTS"


# Singleton used by all modules
config = ImporterConfig()
