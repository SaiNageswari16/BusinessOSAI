"""Billing service entry point.

Run directly:
    python -m src.services.billing.main
or via run_services.py, which imports `app` from this module.
"""
from __future__ import annotations

from src.services.shared.registry import get_descriptor
from src.services.shared.service_factory import build_service
from src.services.billing.api import router as billing_router
from src.services.billing.outbox import OutboxRelay
from src.services.event_bus.dedupe import install_service_ledger

TAGS = [
    {"name": "bills", "description": "Bill creation, settlement, refunds, voiding"},
    {"name": "tax", "description": "Tax code rates"},
    {"name": "discounts", "description": "Discount definitions"},
    {"name": "coupons", "description": "Coupon definitions"},
    {"name": "charges", "description": "Service charge and tip configuration"},
]

# build_service creates this service's own database and the FastAPI app. The
# module-level `db` is what api.py's event handlers use for their own sessions
# — they run outside any request, so they cannot borrow a request's session.
_relay = OutboxRelay(None)  # db handle bound below


async def _on_startup(app) -> None:
    _relay._db = app.state.db
    install_service_ledger(app.state.db)
    await _relay.start()


async def _on_shutdown(app) -> None:
    await _relay.stop()


app, db = build_service(
    "billing",
    [billing_router],
    on_startup=_on_startup,
    on_shutdown=_on_shutdown,
    tags=TAGS,
)
_relay._db = db


if __name__ == "__main__":
    import uvicorn

    descriptor = get_descriptor("billing")
    uvicorn.run(app, host="0.0.0.0", port=descriptor.port, log_level="info")
