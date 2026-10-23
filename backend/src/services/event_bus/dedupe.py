"""Durable per-service idempotency ledger for the event bus.

The bus's in-memory ``_seen`` dict survives only for the life of one process.
After a restart it is empty, so a Redis redelivery of an event the process
already handled passes the in-memory gate and fires every local handler twice.
For stock deduction and journal posting that is a double-count in the ledger.

This module closes that gap without breaking the per-service split. Each
consumer service defines its own ``consumed_events`` table in its own database
(no cross-service reads, per the split rules) and installs it here at startup.
The bus's consumer loop consults the installed ledger as the *authoritative*
dedupe source; the in-memory dict stays as a cheap first layer that avoids a DB
round-trip for the common "already seen this second" case.

A service installs its ledger like this (in main.py, after build_service):

    from src.services.event_bus.dedupe import install_service_ledger
    install_service_ledger(db)

Then every redelivered event is recorded in that service's own
``consumed_events`` table, so a restart no longer re-processes it.
"""
from __future__ import annotations

import logging
from typing import Awaitable, Callable

from sqlalchemy import text

logger = logging.getLogger("event_bus.dedupe")

# One ledger per process. A service owns its own table; the bus consults it.
_ledger: "Callable[[str, str], Awaitable[bool]] | None" = None


def consumed_events_columns() -> dict:
    """Column spec a service's ``ConsumedEvent`` model must expose.

    Kept as a plain spec rather than a shared Base-mapped class on purpose:
    a shared Base would force every service to import every other's metadata,
    which is exactly the coupling the split forbids. Each service declares its
    own ``ConsumedEvent(ServiceBase)`` with ``__tablename__="consumed_events"``
    and these columns; the install path only reads ``event_id`` and writes a
    timestamp via raw SQL so it works no matter which base mapped it.
    """
    return {
        "event_id": "String(64), primary_key",
        "type": "String(120), index",
        "consumed_at": "DateTime(timezone=True), not null",
    }


def install_service_ledger(db) -> None:
    """Wire ``db`` (a ServiceDatabase) in as this process's durable ledger.

    Must run after ``build_service`` has created the schema — the
    ``consumed_events`` table is created by the service's own ``create_all``,
    so by the time the lifespan's on_startup hook fires it already exists.
    """
    global _ledger

    async def _check_and_mark(event_id: str, event_type: str = "") -> bool:
        """Returns True if the event is NEW (not yet consumed). Records it.

        ATOMIC check-then-insert in one transaction: the ``ON CONFLICT DO
        NOTHING`` guard makes this safe under concurrency — two concurrent
        consumers of the same service see exactly one True.

        ``created_at``/``updated_at`` are NOT NULL on the table and carry no
        DB-side default (they are set application-side via the ORM mixin),
        so we must supply them explicitly here. Without them the insert fails
        with a NOT NULL violation and the ledger silently disables itself.
        """
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        async with db.session_factory() as session:
            result = await session.execute(
                text(
                    "INSERT INTO consumed_events "
                    "   (event_id, type, consumed_at, created_at, updated_at) "
                    "VALUES (:eid, :t, :now, :now, :now) "
                    "ON CONFLICT (event_id) DO NOTHING"
                ),
                {"eid": event_id, "t": event_type, "now": now},
            )
            await session.commit()
            rowcount = result.rowcount
            # 1 means we were the one who inserted it → new. 0 means a row
            # already existed → already consumed.
            return (rowcount if rowcount is not None else 0) > 0

    _ledger = _check_and_mark
    logger.info("Durable idempotency ledger installed for this service's DB")


def is_ledger_installed() -> bool:
    return _ledger is not None


async def durable_seen(event_id: str, event_type: str = "") -> bool:
    """Authoritative check. Returns True if this event_id is NEW (not yet seen).

    Falls back to "new" when no ledger is installed — so a service that has
    not installed one still works, just without restart safety. This keeps the
    bus's contract unchanged for services that opt in later.
    """
    if _ledger is None:
        return True
    try:
        return await _ledger(event_id, event_type)
    except Exception as exc:
        # A ledger failure must not block delivery — log and fail-open so the
        # event is still processed at least once. The next redelivery
        # re-attempts; a permanently broken ledger would otherwise
        # black-hole the whole bus, which is worse than a rare double-fire.
        logger.warning("Idempotency ledger check failed, failing open: %s", exc)
        return True
