"""Reports service entry point.

Run directly:
    python -m src.services.reports.main
or via run_services.py, which imports `app` from this module.
"""
from __future__ import annotations

from src.services.reports import models  # noqa: F401 - must come first
from src.services.reports.api import router
from src.services.reports import events  # noqa: F401 - @bus.on registrations (side effect)
from src.services.event_bus.dedupe import install_service_ledger
from src.services.shared.registry import get_descriptor
from src.services.shared.service_factory import build_service

TAGS = [
    {"name": "dashboard", "description": "High-level daily summary metrics"},
    {"name": "sales", "description": "Aggregated sales reports across dates"},
    {"name": "hourly", "description": "Hourly sales distribution and peak hour analytics"},
    {"name": "items", "description": "Menu item sales velocity and margins"},
    {"name": "stock", "description": "Valued current stock from stock movements"},
    {"name": "gst", "description": "CGST/SGST/IGST split from settled bills"},
    {"name": "purchase", "description": "GRN and vendor-bill purchase totals"},
    {"name": "pnl", "description": "Revenue vs. cost of goods sold"},
    {"name": "reports", "description": "Saved report definitions and runs"},
]


async def _on_startup(app) -> None:
    """Install this service's durable dedupe ledger.

    Reports projects events into additive counters — a redelivered
    ``bill.paid`` would double-count the day's sales. The in-memory gate in
    the bus dies with the process; the ledger in this service's own
    ``consumed_events`` table is what makes the projection survive a
    restart.
    """
    install_service_ledger(app.state.db)


app, db = build_service("reports", [router], on_startup=_on_startup, tags=TAGS)

if __name__ == "__main__":
    import uvicorn

    descriptor = get_descriptor("reports")
    uvicorn.run(app, host="0.0.0.0", port=descriptor.port, log_level="info")
