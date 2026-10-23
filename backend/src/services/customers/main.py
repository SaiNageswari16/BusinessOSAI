"""Customers service entry point.

Run directly:
    python -m src.services.customers.main
or via run_services.py, which imports `app` from this module.

The models import MUST come before build_service: that is what registers the
tables on this service's own metadata, which is what create_all reads during
the app's lifespan. Without it the database is created empty.
"""
from __future__ import annotations

from src.services.shared.registry import get_descriptor
from src.services.shared.service_factory import build_service
from src.services.event_bus.dedupe import install_service_ledger
from src.services.customers import models  # noqa: F401 - registers tables first
from src.services.customers.api import router as customers_router

TAGS = [
    {"name": "customers", "description": "Customer profiles and CRM tags"},
    {"name": "preferences", "description": "Dining preferences and allergies"},
    {"name": "visits", "description": "Visit history"},
    {"name": "feedback", "description": "Guest ratings and feedback"},
]

# build_service creates this service's own database and the FastAPI app. The
# module-level `db` is what api.py's event handlers use for their own sessions
# — they run outside any request, so they cannot borrow a request's session.
async def _on_startup(app) -> None:
    install_service_ledger(app.state.db)


app, db = build_service(
    "customers", [customers_router],
    on_startup=_on_startup,
    tags=TAGS,
)


if __name__ == "__main__":
    import uvicorn

    descriptor = get_descriptor("customers")
    uvicorn.run(app, host="0.0.0.0", port=descriptor.port, log_level="info")
