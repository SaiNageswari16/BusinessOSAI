"""Purchase service entry point.

Run directly:
    python -m src.services.purchase.main
or via run_services.py, which imports `app` from this module.

The models import MUST come before build_service: that is what registers the
tables on this service's own metadata, which is what create_all reads during
the app's lifespan. Without it the database is created empty.
"""
from __future__ import annotations

from src.services.shared.registry import get_descriptor
from src.services.shared.service_factory import build_service
from src.services.event_bus.dedupe import install_service_ledger
from src.services.purchase import models  # noqa: F401 - registers tables first
from src.services.purchase.api import router as purchase_router
from src.services.purchase.outbox import OutboxRelay

TAGS = [
    {"name": "purchase",
     "description": "Vendors, purchase requests, POs, GRNs, vendor bills and payments"},
]

# build_service creates this service's own database and the FastAPI app. The
# module-level `db` is what api.py's event handlers use for their own sessions
# — they run outside any request, so they cannot borrow a request's session.
async def _on_startup(app) -> None:
    _relay._db = app.state.db
    install_service_ledger(app.state.db)
    await _relay.start()


async def _on_shutdown(app) -> None:
    await _relay.stop()


_relay = OutboxRelay(None)  # db handle bound below


app, db = build_service(
    "purchase", [purchase_router],
    on_startup=_on_startup,
    on_shutdown=_on_shutdown,
    tags=TAGS,
)
_relay._db = db


if __name__ == "__main__":
    import uvicorn

    descriptor = get_descriptor("purchase")
    uvicorn.run(app, host="0.0.0.0", port=descriptor.port, log_level="info")
