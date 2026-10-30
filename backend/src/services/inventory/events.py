"""Inventory event consumers — stock movements triggered by other services.

This module currently consumes ``production.run.completed``: a completed
production run deducted its raw materials and added its finished goods, and
this is where that fact lands in the stock ledger. Both directions go
through ``record_movement`` — the same path the manual stock-in and the
bill-driven consumption paths use — so every change writes a ledger row AND
the ``stock.movement.created`` outbox row that commits with it.

House rules observed (mirror ``accounting/events.py``):
  * the handler owns its own session from the service's module-level ``db``
    (never a request session — it runs outside any request);
  * the structural idempotency guard (this run's movements already exist in
    the ledger) sits ON TOP of the durable ``consumed_events`` ledger in the
    consumer loop — the ledger dedupes across restarts, the guard dedupes in
    the one path where it does not;
  * item resolution happens INSIDE this database. The production payload
    carries item *names* because production cannot read inventory's tables;
    a name that resolves to no item is skipped with a log line, not raised —
    one tenant's missing item must not wedge the bus;
  * a handler that cannot post logs and re-raises — a dead consumer must not
    look alive.
"""
from __future__ import annotations

import logging
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.event_bus.bus import Event, bus
from src.services.inventory import service as svc
from src.services.inventory.models import InventoryItem, MovementType, StockMovement

logger = logging.getLogger("inventory.events")

# Movements this consumer writes are all stamped with this reference pair,
# which is what makes the structural idempotency guard a single query.
_REFERENCE_TYPE = "production_run"


def _handler_db() -> AsyncSession:
    """A session owned by an event handler, not by a request."""
    from src.services.inventory.main import db as _db

    return _db.session_factory()


def _coerce_uuid(value) -> uuid.UUID | None:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


async def _run_already_recorded(db: AsyncSession, tenant: uuid.UUID,
                                run_id: uuid.UUID) -> bool:
    """Has this run already posted its stock movements, in a previous run?

    Checked against the movement ledger (reference_type production_run,
    reference_id = the run id), not a flag on the event: a process that died
    between the stock commit and the outbox ack redelivers the same event,
    and the ledger is the only thing that survives that restart. All of a
    run's movements share the one reference id, so the guard covers raws and
    outputs with a single query.
    """
    found = await db.scalar(
        select(StockMovement.id).where(
            StockMovement.tenant_id == tenant,
            StockMovement.reference_type == _REFERENCE_TYPE,
            StockMovement.reference_id == str(run_id),
        ).limit(1)
    )
    return found is not None


async def _resolve_item(db: AsyncSession, tenant: uuid.UUID, outlet: uuid.UUID,
                        item_id: uuid.UUID | None, name: str | None
                        ) -> InventoryItem | None:
    """Resolve a payload line to an item in THIS database.

    The payload's ``item_id`` (when present) is the primary key; the name is
    what the consumers can always act on. An id that no longer exists (the
    item was deleted) falls back to the name, and an unresolved name is None —
    the caller skips the line rather than failing the whole event.
    """
    if item_id is not None:
        item = await svc.load_item(db, tenant, item_id)
        if item is not None:
            return item
    if not name:
        return None
    rows = list((await db.execute(
        select(InventoryItem).where(
            InventoryItem.tenant_id == tenant,
            func.lower(InventoryItem.name) == func.lower(name),
            InventoryItem.is_active.is_(True),
        )
    )).scalars().all())
    if not rows:
        return None
    # Prefer an outlet-scoped match, then an org-level item, then anything:
    # stock rows are per-outlet, so the outlet's own item is the one whose
    # store the movement should touch.
    for row in rows:
        if row.outlet_id == outlet:
            return row
    for row in rows:
        if row.outlet_id is None:
            return row
    return rows[0]


@bus.on("production.run.completed")
async def _on_production_run_completed(event: Event) -> None:
    """A completed production run: deduct the raws, add the finished goods.

    Raw deductions floor at zero like the bill-driven consumption path — a
    run that has actually completed is a fact, and refusing the whole posting
    because one line was already short would silently leave the finished
    goods unrecorded too. The gap is logged, not swallowed.

    Output stock-in is valued at the item's standard cost: a finished good
    has no purchase cost, its value is what its raws cost, and standard cost
    is the only valuation this consumer can reach without reading the raws'
    ledger again.
    """
    data = event.data or {}
    run_id = _coerce_uuid(data.get("run_id"))
    tenant = _coerce_uuid(event.tenant_id) or _coerce_uuid(data.get("tenant_id"))
    outlet = _coerce_uuid(event.outlet_id) or _coerce_uuid(data.get("outlet_id"))
    if run_id is None or tenant is None or outlet is None:
        logger.warning("production.run.completed missing run/tenant/outlet: %s", data)
        return

    db = _handler_db()
    try:
        if await _run_already_recorded(db, tenant, run_id):
            return

        # ── raw deductions: stock out ───────────────────────────────────
        for line in data.get("raw_deductions") or []:
            name = line.get("name")
            item = await _resolve_item(
                db, tenant, outlet,
                _coerce_uuid(line.get("item_id")), name,
            )
            if item is None:
                # Unknown raw material: the name does not resolve to an item
                # in this database. Skip the line, keep the rest — one missing
                # item must not block the finished good's stock-in.
                logger.warning(
                    "production run %s: raw item %r does not resolve for tenant %s; skipped",
                    run_id, name, tenant,
                )
                continue
            required = svc._q(line.get("qty"))
            if required <= 0:
                continue
            stock = await svc.stock_for(db, tenant, outlet, item.id,
                                        item.default_location_id)
            available = svc._q(float(stock.qty_on_hand) - float(stock.qty_reserved))
            to_take = min(required, available) if available > 0 else 0.0
            if to_take <= 0:
                logger.warning(
                    "production run %s: no %s available at outlet %s; raw deduction skipped",
                    run_id, item.name, outlet,
                )
                continue
            short = svc._q(required - to_take)
            await svc.record_movement(
                db, tenant, outlet, item, -to_take,
                MovementType.PRODUCTION,
                location_id=item.default_location_id,
                unit_cost=float(stock.avg_cost or item.standard_cost or 0),
                reference_type=_REFERENCE_TYPE,
                reference_id=str(run_id),
                notes=f"Production run {run_id} — raw deduction",
                check_negative=False,
            )
            if short > 0:
                logger.warning(
                    "production run %s: raw %s short by %s (required %s, available %s)",
                    run_id, item.name, short, required, available,
                )

        # ── output items: stock in at standard cost ─────────────────────
        for line in data.get("output_items") or []:
            name = line.get("name")
            item = await _resolve_item(
                db, tenant, outlet,
                _coerce_uuid(line.get("item_id")), name,
            )
            if item is None:
                logger.warning(
                    "production run %s: output item %r does not resolve for tenant %s; skipped",
                    run_id, name, tenant,
                )
                continue
            qty = svc._q(line.get("qty"))
            if qty <= 0:
                continue
            await svc.record_movement(
                db, tenant, outlet, item, qty,
                MovementType.PRODUCTION,
                location_id=item.default_location_id,
                unit_cost=float(item.standard_cost or 0),
                reference_type=_REFERENCE_TYPE,
                reference_id=str(run_id),
                notes=f"Production run {run_id} — finished good output",
                check_negative=False,
            )

        await db.commit()
        logger.info(
            "production.run.completed %s: movements posted at outlet %s",
            run_id, outlet,
        )
    except Exception:
        await db.rollback()
        logger.exception("inventory: production.run.completed handling failed for %s", run_id)
        raise
    finally:
        await db.close()
