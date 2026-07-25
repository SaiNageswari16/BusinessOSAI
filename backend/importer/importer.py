"""
importer.py – Core orchestration engine.

Reads the TSV in pandas chunks → maps → validates → bulk-upserts to Postgres.

Architecture
============
1.  A main thread streams the file in `chunk_size` rows.
2.  Each chunk is mapped + validated synchronously (CPU-bound, very fast).
3.  Validated batches are handed to a ThreadPoolExecutor for DB insertion.
4.  Progress is printed to stdout every batch.
5.  Failed rows are written to failed_rows.csv.

Memory profile
==============
Only one chunk (~10 k rows × ~1 KB ≈ 10 MB) is in memory at a time.
The thread pool may hold up to `max_workers` batches simultaneously.
Peak RAM is typically < 200 MB regardless of file size.
"""
from __future__ import annotations

import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from config import ImporterConfig, config as default_cfg
from database import (
    build_engine,
    make_session_factory,
    retry_batch,
    insert_batch_raw,
)
from logger import FailedRowSink, get_logger, setup_logging
from mapper import REQUIRED_SOURCE_COLS, map_chunk
from utils import ProgressTracker, count_rows_fast, human_duration
from validator import validate_and_clean

log = get_logger("importer")


# ── Pandas read options ────────────────────────────────────────────────────────

READ_OPTIONS: dict[str, Any] = {
    "sep":              "\t",
    "encoding":         "utf-8",
    "on_bad_lines":     "skip",       # skip malformed TSV rows silently
    "engine":           "c",          # C engine: fastest, supports all options
    "dtype":            str,          # read everything as string; we cast later
}



# ── Worker: insert one batch via raw psycopg2 connection ─────────────────────

def _insert_worker(
    batch: list[dict[str, Any]],
    duplicate_mode: str,
) -> tuple[int, int, int, int]:
    """Run in a thread pool. Opens its own psycopg2 connection, inserts, closes."""
    # Deduplicate batch on barcode to prevent ON CONFLICT DO UPDATE from affecting row twice
    seen = {}
    deduped = []
    skipped = 0
    for row in batch:
        barcode = row.get("barcode")
        if barcode:
            if barcode in seen:
                skipped += 1
            seen[barcode] = row
        else:
            deduped.append(row)
    deduped.extend(seen.values())

    try:
        ins, upd = retry_batch(deduped, duplicate_mode)
        return ins, upd, skipped, 0
    except Exception as exc:
        log.error("Batch insert failed permanently: %s", exc)
        return 0, 0, 0, len(batch)


# ── Main import loop ──────────────────────────────────────────────────────────

def run_import(cfg: ImporterConfig = default_cfg) -> None:
    # ── Setup ─────────────────────────────────────────────────────────────────
    setup_logging(cfg.log_file)
    log.info("=" * 70)
    log.info("Open Food Facts Importer — STARTING")
    log.info("Input file  : %s", cfg.input_file)
    log.info("DB          : %s", cfg.database_url.split("@")[-1])
    log.info("Chunk size  : %d", cfg.chunk_size)
    log.info("Batch size  : %d", cfg.batch_size)
    log.info("Workers     : %d", cfg.max_workers)
    log.info("Dup. mode   : %s", cfg.duplicate_mode)
    log.info("=" * 70)

    input_path = Path(cfg.input_file)
    if not input_path.exists():
        log.critical("Input file not found: %s", input_path)
        sys.exit(1)

    # ── Count rows for ETA ────────────────────────────────────────────────────
    log.info("Counting rows in file (this may take 30–60 s for a 12 GB file) …")
    total_rows = count_rows_fast(str(input_path))
    log.info("Estimated total data rows: %s", f"{total_rows:,}")

    # ── DB engine ─────────────────────────────────────────────────────────────
    engine = build_engine(cfg)   # also sets the raw psycopg2 DSN used by workers

    # ── Progress + failed-row sink ────────────────────────────────────────────
    tracker = ProgressTracker(total_rows=total_rows)
    tracker.start()

    with FailedRowSink(cfg.failed_rows_file) as sink:
        # ── Accumulator for the current DB batch ──────────────────────────────
        pending_batch: list[dict[str, Any]] = []
        futures = []

        with ThreadPoolExecutor(max_workers=cfg.max_workers) as pool:
            # ── Stream the TSV ────────────────────────────────────────────────
            reader = pd.read_csv(
                input_path,
                chunksize=cfg.chunk_size,
                usecols=lambda c: c in REQUIRED_SOURCE_COLS,
                **READ_OPTIONS,
            )

            chunk_idx = 0
            for df_chunk in reader:
                chunk_idx += 1
                raw_rows = map_chunk(df_chunk)
                chunk_processed = len(raw_rows)
                chunk_failed    = 0

                # ── Validate each row ─────────────────────────────────────────
                for raw in raw_rows:
                    try:
                        cleaned = validate_and_clean(raw, cfg)
                        pending_batch.append(cleaned)
                    except ValueError as exc:
                        chunk_failed += 1
                        sink.write(raw, str(exc))

                # ── Flush to DB when batch is full ────────────────────────────
                while len(pending_batch) >= cfg.batch_size:
                    batch_to_send = pending_batch[: cfg.batch_size]
                    pending_batch = pending_batch[cfg.batch_size :]

                    fut = pool.submit(
                        _insert_worker,
                        batch_to_send,
                        cfg.duplicate_mode,
                    )
                    futures.append((fut, len(batch_to_send)))

                # ── Collect completed futures (non-blocking poll) ─────────────
                still_running = []
                for fut, batch_len in futures:
                    if fut.done():
                        ins, upd, skip, fail = fut.result()
                        tracker.add(
                            inserted=ins,
                            updated=upd,
                            skipped=skip,
                            failed=fail,
                        )
                    else:
                        still_running.append((fut, batch_len))
                futures = still_running

                # ── Update progress ────────────────────────────────────────────
                tracker.add(
                    processed=chunk_processed,
                    failed=chunk_failed,
                    skipped=0,
                )
                log.info(tracker.summary())

            # ── Flush remaining partial batch ─────────────────────────────────
            if pending_batch:
                fut = pool.submit(
                    _insert_worker,
                    pending_batch,
                    cfg.duplicate_mode,
                )
                futures.append((fut, len(pending_batch)))

            # ── Wait for all outstanding inserts ──────────────────────────────
            for fut, _ in futures:
                ins, upd, skip, fail = fut.result()
                tracker.add(inserted=ins, updated=upd, skipped=skip, failed=fail)

    # ── Final summary ─────────────────────────────────────────────────────────
    elapsed = tracker.elapsed
    log.info("=" * 70)
    log.info("Import COMPLETE")
    log.info("  Elapsed      : %s", human_duration(elapsed))
    log.info("  Rows read    : %s", f"{tracker.processed:,}")
    log.info("  Inserted     : %s", f"{tracker.inserted:,}")
    log.info("  Updated      : %s", f"{tracker.updated:,}")
    log.info("  Skipped      : %s", f"{tracker.skipped:,}")
    log.info("  Failed       : %s", f"{tracker.failed:,}")
    log.info("  Avg speed    : %s rows/s", f"{tracker.processed / max(1, elapsed):,.0f}")
    log.info("  Log file     : %s", cfg.log_file)
    log.info("  Failed rows  : %s", cfg.failed_rows_file)
    log.info("=" * 70)
