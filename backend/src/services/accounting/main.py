"""Accounting service entry point.

Run directly:
    python -m src.services.accounting.main
or via run_services.py, which imports `app` from this module.
"""
from __future__ import annotations

from src.services.accounting import models  # noqa: F401 - must come first
from src.services.accounting.api import router
from src.services.shared.registry import get_descriptor
from src.services.shared.service_factory import build_service

TAGS = [
    {"name": "accounts", "description": "Chart of accounts management"},
    {"name": "journal-entries", "description": "Double-entry journal postings and reversals"},
    {"name": "day-close", "description": "Daily cashier close and reconciliation"},
    {"name": "tax", "description": "GST returns and tax challan payments"},
    {"name": "reports", "description": "Trial balance and profit & loss statements"},
]

app, db = build_service("accounting", [router], tags=TAGS)

if __name__ == "__main__":
    import uvicorn

    descriptor = get_descriptor("accounting")
    uvicorn.run(app, host="0.0.0.0", port=descriptor.port, log_level="info")
