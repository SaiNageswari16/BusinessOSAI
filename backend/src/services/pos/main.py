"""POS service entry point.

Run directly:
    python -m src.services.pos.main
or via run_services.py, which imports `app` from this module.
"""
from __future__ import annotations

from src.services.shared.registry import get_descriptor
from src.services.shared.service_factory import build_service
from src.services.pos.api import router as pos_router

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
app, db = build_service("pos", [pos_router], tags=TAGS)


if __name__ == "__main__":
    import uvicorn

    descriptor = get_descriptor("pos")
    uvicorn.run(app, host="0.0.0.0", port=descriptor.port, log_level="info")
