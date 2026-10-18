"""Kitchen service entry point.

Run directly:
    python -m src.services.kitchen.main
or via run_services.py, which imports `app` from this module.
"""
from __future__ import annotations

from src.services.shared.registry import get_descriptor
from src.services.shared.service_factory import build_service
from src.services.kitchen.api import router as kitchen_router

TAGS = [
    {"name": "kitchen", "description": "Kitchen stations"},
    {"name": "kds", "description": "KDS devices and kitchen order tickets"},
]

# build_service creates this service's own database and the FastAPI app. The
# module-level `db` is what api.py's event handlers use for their own sessions
# — they run outside any request, so they cannot borrow a request's session.
app, db = build_service("kitchen", [kitchen_router], tags=TAGS)


if __name__ == "__main__":
    import uvicorn

    descriptor = get_descriptor("kitchen")
    uvicorn.run(app, host="0.0.0.0", port=descriptor.port, log_level="info")
