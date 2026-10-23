"""Loyalty service entry point.

Run directly:
    python -m src.services.loyalty.main
or via run_services.py, which imports `app` from this module.
"""
from __future__ import annotations

from src.services.shared.registry import get_descriptor
from src.services.shared.service_factory import build_service
from src.services.event_bus.dedupe import install_service_ledger
from src.services.loyalty.api import router as loyalty_router

TAGS = [
    {"name": "loyalty", "description": "Programs and customer point accounts"},
    {"name": "wallet", "description": "Customer prepaid wallets"},
]

# build_service creates this service's own database and the FastAPI app. The
# module-level `db` is what api.py's event handlers use for their own sessions
# — they run outside any request, so they cannot borrow a request's session.
async def _on_startup(app) -> None:
    install_service_ledger(app.state.db)


app, db = build_service(
    "loyalty", [loyalty_router],
    on_startup=_on_startup,
    tags=TAGS,
)


if __name__ == "__main__":
    import uvicorn

    descriptor = get_descriptor("loyalty")
    uvicorn.run(app, host="0.0.0.0", port=descriptor.port, log_level="info")
