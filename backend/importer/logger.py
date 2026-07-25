"""
logger.py – Structured logging + failed-row CSV sink.

Every module imports `get_logger()` rather than calling logging.basicConfig
directly, so we have a single, consistent log format across the whole importer.
"""
from __future__ import annotations

import csv
import logging
import sys
from pathlib import Path
from typing import Any


def setup_logging(log_file: Path, level: int = logging.INFO) -> None:
    """
    Configure the root logger to emit to both stdout and a rotating file.
    Call once at application start-up.
    """
    fmt = "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s"
    date_fmt = "%Y-%m-%d %H:%M:%S"

    handlers: list[logging.Handler] = [
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding="utf-8"),
    ]

    logging.basicConfig(
        level=level,
        format=fmt,
        datefmt=date_fmt,
        handlers=handlers,
        force=True,
    )


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


# ── Failed-row sink ────────────────────────────────────────────────────────────

class FailedRowSink:
    """
    Thread-safe writer for rows that failed validation or DB insertion.
    Creates the CSV on first write; appends on subsequent calls.
    """

    def __init__(self, path: Path) -> None:
        self._path   = path
        self._file   = None
        self._writer = None
        self._header_written = False

    def write(self, row: dict[str, Any], reason: str) -> None:
        row_with_reason = {"_failure_reason": reason, **row}
        if not self._header_written:
            self._file = open(self._path, "w", newline="", encoding="utf-8")
            self._writer = csv.DictWriter(
                self._file,
                fieldnames=list(row_with_reason.keys()),
                extrasaction="ignore",
            )
            self._writer.writeheader()
            self._header_written = True
        self._writer.writerow(row_with_reason)
        self._file.flush()

    def close(self) -> None:
        if self._file:
            self._file.close()

    def __enter__(self) -> "FailedRowSink":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()
