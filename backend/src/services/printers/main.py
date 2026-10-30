"""Printers service entry point.

Run directly:
    python -m src.services.printers.main
or via run_services.py, which imports `app` from this module.
"""
from __future__ import annotations

from src.services.printers import models  # noqa: F401  (registers tables on the printers base)
from src.services.printers.api import router as printers_router
from src.services.printers.events import _on_bill_paid, _on_kot_print_requested, _on_order_placed  # noqa: F401  (side-effect bus subscriptions)
from src.services.printers.outbox import OutboxRelay
from src.services.printers.service import Dispatcher
from src.services.event_bus.dedupe import install_service_ledger
from src.services.shared.registry import get_descriptor
from src.services.shared.service_factory import build_service

TAGS = [
    {"name": "printers", "description": "Printer registry, print jobs, and dispatch"},
    {"name": "devices", "description": "POS/KDS device pairing and liveness"},
]

# build_service creates this service's own database and the FastAPI app. The
# module-level `db` is what the event handlers in events.py use for their own
# sessions — they run outside any request, so they cannot borrow a request's
# session.
async def _on_startup(app) -> None:
    _relay._db = app.state.db
    install_service_ledger(app.state.db)
    await _relay.start()
    _dispatcher._db = app.state.db
    await _dispatcher.start()


async def _on_shutdown(app) -> None:
    await _dispatcher.stop()
    await _relay.stop()


_relay = OutboxRelay(None)  # db handle bound below
_dispatcher = Dispatcher(None)  # db handle bound below


app, db = build_service(
    "printers", [printers_router],
    on_startup=_on_startup,
    on_shutdown=_on_shutdown,
    tags=TAGS,
)
_relay._db = db
_dispatcher._db = db


if __name__ == "__main__":
    import uvicorn

    descriptor = get_descriptor("printers")
    uvicorn.run(app, host="0.0.0.0", port=descriptor.port, log_level="info")
