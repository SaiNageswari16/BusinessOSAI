"""Billing service entry point.

Run directly:
    python -m src.services.billing.main
or via run_services.py, which imports `app` from this module.
"""
from __future__ import annotations

from src.services.shared.registry import get_descriptor
from src.services.shared.service_factory import build_service
from src.services.billing.api import router as billing_router
from src.services.billing.api_invoices import router as invoices_router
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


# The invoices router serves the AR invoice / receipt / print-template /
# payment-gateway surface. The canonical mount is via build_service
# (/api/v1/billing/...). The gateway forwards the alias segments VERBATIM
# (forward_service = the alias, see gateway/app.py:356), so each alias family
# must resolve to exactly the path the frontend calls:
#
#   /api/v1/invoices/customer-summary/{ref}  ← internal "/invoices/..."  → mount at /api/v1
#   /api/v1/invoices/reminders|print-templates ← internal bare paths    → mount at /api/v1/invoices
#   /api/v1/payments/gateways|razorpay|pinelabs ← internal bare paths  → mount at /api/v1/payments
#
# Same shape as accounting's alias mounts; build_service already provides the
# canonical /api/v1/billing mount for every path in this router.
app, db = build_service(
    "billing",
    [billing_router, invoices_router],
    on_startup=_on_startup,
    on_shutdown=_on_shutdown,
    tags=TAGS,
)
_relay._db = db

# Alias mounts — the gateway forwards the alias segment VERBATIM
# (forward_service = the alias; see gateway/app.py), so each alias family must
# resolve to exactly the path the frontend calls:
#
#   /api/v1/invoices/customer-summary/{ref}   ← internal "/invoices/..."   → /api/v1 mount
#   /api/v1/invoices/reminders|print-templates ← internal bare paths       → /api/v1/invoices mount
#   /api/v1/payments/gateways|razorpay|pinelabs ← internal bare paths     → /api/v1/payments mount
#   /api/v1/sales-returns/...                 ← internal "/sales-returns"  → /api/v1 mount
#
# Registration order matters: FastAPI matches routes in the order they were
# added, and "/api/v1" + internal "/invoices/{id}" would swallow
# "/api/v1/invoices/print-templates" if the catch-all came first. Most
# specific mounts first. The canonical /api/v1/billing mount is what
# build_service already provided.
app.include_router(invoices_router, prefix="/api/v1/invoices")
app.include_router(invoices_router, prefix="/api/v1/payments")
app.include_router(invoices_router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn

    descriptor = get_descriptor("billing")
    uvicorn.run(app, host="0.0.0.0", port=descriptor.port, log_level="info")
