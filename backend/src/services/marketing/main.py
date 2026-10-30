"""Marketing service entry point.

Run directly:
    python -m src.services.marketing.main
or via run_services.py, which imports `app` from this module.
"""
from __future__ import annotations

from src.services.marketing import models  # noqa: F401 - registers tables on the marketing base
from src.services.marketing.api import router as marketing_router
from src.services.marketing import events  # noqa: F401 - @bus.on registrations
from src.services.marketing.outbox import OutboxRelay
from src.services.shared.registry import get_descriptor
from src.services.shared.service_factory import build_service
from src.services.event_bus.dedupe import install_service_ledger

TAGS = [
    {"name": "marketing", "description": "Campaigns, banner ads, and offer automation"},
    {"name": "reviews", "description": "Customer review surfacing and replies"},
]


# build_service creates this service's own database and the FastAPI app. The
# module-level `db` is what the event handlers in events.py use for their own
# sessions — they run outside any request, so they cannot borrow a request's
# session.
async def _on_startup(app) -> None:
    _relay._db = app.state.db
    install_service_ledger(app.state.db)
    await _relay.start()


async def _on_shutdown(app) -> None:
    await _relay.stop()


_relay = OutboxRelay(None)  # db handle bound below


app, db = build_service(
    "marketing", [marketing_router],
    on_startup=_on_startup,
    on_shutdown=_on_shutdown,
    tags=TAGS,
)
_relay._db = db


if __name__ == "__main__":
    import uvicorn

    descriptor = get_descriptor("marketing")
    uvicorn.run(app, host="0.0.0.0", port=descriptor.port, log_level="info")
