"""Reports service entry point.

Run directly:
    python -m src.services.reports.main
or via run_services.py, which imports `app` from this module.
"""
from __future__ import annotations

from src.services.reports import models  # noqa: F401 - must come first
from src.services.reports.api import router
from src.services.shared.registry import get_descriptor
from src.services.shared.service_factory import build_service

TAGS = [
    {"name": "dashboard", "description": "High-level daily summary metrics"},
    {"name": "sales", "description": "Aggregated sales reports across dates"},
    {"name": "hourly", "description": "Hourly sales distribution and peak hour analytics"},
    {"name": "items", "description": "Menu item sales velocity and margins"},
]

app, db = build_service("reports", [router], tags=TAGS)

if __name__ == "__main__":
    import uvicorn

    descriptor = get_descriptor("reports")
    uvicorn.run(app, host="0.0.0.0", port=descriptor.port, log_level="info")
