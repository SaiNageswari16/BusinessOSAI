"""
main.py – CLI entry point for the Open Food Facts importer.

Examples
--------
# Default run (reads config from config.py / .env):
    python main.py

# Custom file:
    python main.py --file "D:\\data\\en.openfoodfacts.org.products (1).csv\\en.openfoodfacts.org.products (1).csv"

# Faster / slower chunking:
    python main.py --chunk 5000 --batch 1000

# Skip duplicates instead of updating:
    python main.py --dup insert

# Dry-run mode (validate only, no DB writes):
    python main.py --dry-run
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Make sure we can import sibling modules when called from any directory
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import ImporterConfig
from importer import run_import
from logger import get_logger, setup_logging

log = get_logger("main")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Open Food Facts → IOTRONCS Retail Master Catalog Importer",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument(
        "--file", "-f",
        type=Path,
        default=None,
        help="Path to the .csv / .tsv OFF file",
    )
    p.add_argument(
        "--chunk", "-c",
        type=int,
        default=None,
        help="Rows to read per pandas chunk (memory vs speed trade-off)",
    )
    p.add_argument(
        "--batch", "-b",
        type=int,
        default=None,
        help="Rows per DB transaction batch",
    )
    p.add_argument(
        "--workers", "-w",
        type=int,
        default=None,
        help="Parallel DB insert threads",
    )
    p.add_argument(
        "--dup",
        choices=["upsert", "insert", "skip"],
        default=None,
        help="Duplicate barcode strategy",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and map rows but skip all DB writes",
    )
    p.add_argument(
        "--db",
        type=str,
        default=None,
        help="Override database URL (e.g. postgresql+psycopg2://user:pw@host/db)",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()

    # Build config, applying any CLI overrides
    cfg = ImporterConfig()

    if args.file:
        cfg.input_file = args.file
    if args.chunk:
        cfg.chunk_size = args.chunk
    if args.batch:
        cfg.batch_size = args.batch
    if args.workers:
        cfg.max_workers = args.workers
    if args.dup:
        cfg.duplicate_mode = args.dup
    if args.db:
        cfg.database_url = args.db

    # Dry-run: override batch inserter so nothing hits the DB
    if args.dry_run:
        log.warning("DRY RUN MODE – no rows will be written to the database.")
        import importer as _imp
        _original = _imp._insert_worker

        def _noop(session_factory, batch, duplicate_mode):
            return len(batch), 0, 0

        _imp._insert_worker = _noop  # type: ignore[attr-defined]

    try:
        run_import(cfg)
    except KeyboardInterrupt:
        log.warning("Import interrupted by user.")
        sys.exit(130)


if __name__ == "__main__":
    main()
