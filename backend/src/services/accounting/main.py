"""Accounting service entry point.

Run directly:
    python -m src.services.accounting.main
or via run_services.py, which imports `app` from this module.
"""
from __future__ import annotations

from src.services.accounting import models  # noqa: F401 - must come first
from src.services.accounting.api import router
from src.services.accounting.api_finance import router as finance_router
from src.services.accounting import events  # noqa: F401 - @bus.on registrations
from src.services.accounting.outbox import OutboxRelay
from src.services.event_bus.dedupe import install_service_ledger
from src.services.shared.registry import get_descriptor
from src.services.shared.service_factory import build_service

TAGS = [
    {"name": "accounts", "description": "Chart of accounts management"},
    {"name": "journal-entries", "description": "Double-entry journal postings and reversals"},
    {"name": "day-close", "description": "Daily cashier close and reconciliation"},
    {"name": "tax", "description": "GST returns and tax challan payments"},
    {"name": "reports", "description": "Trial balance and profit & loss statements"},
    {"name": "general-ledger", "description": "General ledger and opening balances"},
    {"name": "bank", "description": "Bank accounts and period reconciliation"},
    {"name": "fixed-assets", "description": "Fixed asset register and depreciation schedules"},
    {"name": "budgets", "description": "Budgets, actuals and variance"},
    {"name": "expense-claims", "description": "Employee expense claims and approvals"},
    {"name": "expenses", "description": "Operational expense categories and the expense ledger"},
    {"name": "withdrawals", "description": "Cash/bank withdrawal requests and approval"},
    {"name": "exchange-rates", "description": "Multi-currency rate book"},
    {"name": "cash-flow", "description": "Cash-flow 'all wallets' windowed summary"},
]

# The operational-finance routes (expenses / withdrawals / exchange-rates /
# cash-flow) write outbox rows in the same transaction as the GL posting and
# need a relay to drain them — the GL router itself still only *reads* the
# bus, so the relay is what turns this service from a pure consumer into a
# publisher. Wired exactly like billing/loyalty.
_relay = OutboxRelay(None)  # db handle bound below


async def _on_startup(app) -> None:
    """Install this service's durable dedupe ledger and start the outbox relay.

    Accounting auto-posts journals on bill.paid / grn.posted — a redelivered
    event (Redis unacked replay after a restart) must not double-post the GL.
    The in-memory gate in the bus dies with the process; the ``consumed_events``
    table in this service's own DB is what makes the posting survive a restart.
    """
    _relay._db = app.state.db
    install_service_ledger(app.state.db)
    await _relay.start()


async def _on_shutdown(app) -> None:
    await _relay.stop()


app, db = build_service(
    "accounting", [router, finance_router],
    on_startup=_on_startup,
    on_shutdown=_on_shutdown,
    tags=TAGS,
)
_relay._db = db

# ─── Alias mounts ────────────────────────────────────────────────────────────
# The gateway resolves /api/v1/tax, /financial-reports, /bank, /fixed-assets,
# /budgets and /expense-claims onto this service but forwards the alias path
# VERBATIM (it does not rewrite to /api/v1/accounting). So this service must
# serve the same router under each alias prefix as well. The router's own
# paths are bare suffixes ("/trial-balance", "/pnl", ...), which is what makes
# the same router object mountable at many prefixes — the same shape the staff
# service uses for its hrms/erp dual mount.
for _alias in ("tax", "financial-reports", "bank", "fixed-assets", "budgets", "expense-claims"):
    app.include_router(router, prefix=f"/api/v1/{_alias}")

if __name__ == "__main__":
    import uvicorn

    descriptor = get_descriptor("accounting")
    uvicorn.run(app, host="0.0.0.0", port=descriptor.port, log_level="info")
