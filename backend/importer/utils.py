"""
utils.py – Progress reporting, ETA calculation, and miscellaneous helpers.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ProgressTracker:
    """
    Tracks import progress and computes a rolling ETA.

    Usage:
        tracker = ProgressTracker(total_rows=1_048_756)
        tracker.start()
        for chunk in chunks:
            tracker.add(processed=len(chunk), inserted=n, updated=m, failed=f)
            print(tracker.summary())
    """
    total_rows:  int
    start_time:  float = field(default_factory=time.monotonic)

    # Counters
    processed:  int = 0
    inserted:   int = 0
    updated:    int = 0
    skipped:    int = 0
    failed:     int = 0

    # Rolling window for rows/sec (last N batches)
    _window_times: list[float] = field(default_factory=list)
    _window_counts: list[int]  = field(default_factory=list)
    _WINDOW: int = 10  # keep last 10 batch measurements

    def start(self) -> None:
        self.start_time = time.monotonic()

    def add(
        self,
        processed: int = 0,
        inserted: int = 0,
        updated: int = 0,
        skipped: int = 0,
        failed: int = 0,
    ) -> None:
        self.processed += processed
        self.inserted  += inserted
        self.updated   += updated
        self.skipped   += skipped
        self.failed    += failed

        now = time.monotonic()
        self._window_times.append(now)
        self._window_counts.append(processed)
        if len(self._window_times) > self._WINDOW:
            self._window_times.pop(0)
            self._window_counts.pop(0)

    @property
    def elapsed(self) -> float:
        return time.monotonic() - self.start_time

    @property
    def rows_per_sec(self) -> float:
        if len(self._window_times) < 2:
            elapsed = self.elapsed or 1
            return self.processed / elapsed
        span = self._window_times[-1] - self._window_times[0]
        total = sum(self._window_counts)
        return total / span if span > 0 else 0

    @property
    def pct(self) -> float:
        if self.total_rows <= 0:
            return 0.0
        return min(100.0, self.processed / self.total_rows * 100)

    @property
    def eta_seconds(self) -> Optional[float]:
        rps = self.rows_per_sec
        if rps <= 0:
            return None
        remaining = max(0, self.total_rows - self.processed)
        return remaining / rps

    def summary(self) -> str:
        eta = self.eta_seconds
        eta_str = f"{eta/60:.1f} min" if eta and eta < 3600 else (
            f"{eta/3600:.1f} hr" if eta else "—"
        )
        return (
            f"[{self.pct:5.1f}%] "
            f"row {self.processed:>9,}/{self.total_rows:,}  "
            f"ins={self.inserted:,} upd={self.updated:,} "
            f"skip={self.skipped:,} fail={self.failed:,}  "
            f"{self.rows_per_sec:,.0f} rows/s  ETA {eta_str}"
        )


def count_rows_fast(path: str, encoding: str = "utf-8") -> int:
    """
    Count lines in a large file quickly using a buffered byte counter.
    ~1-2 seconds for 12 GB file.  Subtracts 1 for the header line.
    """
    count = 0
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):  # 1 MB chunks
            count += chunk.count(b"\n")
    return max(0, count - 1)  # subtract header


def human_duration(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    if h:
        return f"{h}h {m}m {s}s"
    if m:
        return f"{m}m {s}s"
    return f"{s}s"
