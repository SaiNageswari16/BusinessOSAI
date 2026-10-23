"""POS service entry point.

Run directly:
    python -m src.services.pos.main
or via run_services.py, which imports `app` from this module.
"""
from __future__ import annotations

from src.services.shared.registry import get_descriptor
from src.services.shared.service_factory import build_service
from src.services.event_bus.dedupe import install_service_ledger
from src.services.pos.api import router as pos_router
from src.services.pos.outbox import OutboxRelay

TAGS = [
    {"name": "orders", "description": "Order creation, listing, status, cancellation"},
    {"name": "tables", "description": "Table occupancy sessions"},
    {"name": "reservations", "description": "Bookings"},
    {"name": "waitlist", "description": "Queue management"},
]

# build_service creates the database for this service and the FastAPI app, and
# the module-level `db` is what api.py's event handlers use for their own
# sessions — they run outside any request, so they cannot borrow a request's
# session.
_relay = OutboxRelay(None)  # db handle bound below


async def _on_startup_outbox(app) -> None:
    _relay._db = app.state.db
    install_service_ledger(app.state.db)
    await _relay.start()


async def _on_shutdown_outbox(app) -> None:
    await _relay.stop()


app, db = build_service(
    "pos", [pos_router],
    on_startup=_on_startup_outbox,
    on_shutdown=_on_shutdown_outbox,
    tags=TAGS,
)
_relay._db = db


if __name__ == "__main__":
    import uvicorn

    descriptor = get_descriptor("pos")
    uvicorn.run(app, host="0.0.0.0", port=descriptor.port, log_level="info")