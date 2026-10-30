"""Purchase event consumers — POs raised from other services.

This module consumes ``production.po.requested``: a production run's raw
requirements, to be turned into a purchase order the procurement team can
send to a vendor. The production service has no vendor decision to make —
the PO's vendor is settled here.

House rules observed (mirror ``accounting/events.py``):
  * the handler owns its own session from the service's module-level ``db``
    (never a request session — it runs outside any request);
  * the structural idempotency guard (a PO for this production run already
    exists under its deterministic number) sits ON TOP of the durable
    ``consumed_events`` ledger in the consumer loop;
  * the PO carries ``source=production`` in its notes and references the
    run id — the link back to what the order was for;
  * ``po.created`` is written to the outbox in the same transaction as the
    PO itself, then published locally; the relay is what delivers it
    cross-service.
"""
from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.event_bus.bus import Event, bus
from src.services.purchase.models import (
    OutboxMessage,
    POStatus,
    PurchaseOrder,
    PurchaseOrderLine,
    Vendor,
    VendorType,
)
from src.services.purchase.service import _money, _now

logger = logging.getLogger("purchase.events")

# A deterministic PO number derived from the production run id. It is what
# makes the structural idempotency guard a single query: a redelivered
# event recomputes the same number and finds its own PO.
_PO_PREFIX = "PO-PROD-"
# 8 (prefix) + 36 (uuid) = 44, inside the po_number String(50) column.


def _handler_db() -> AsyncSession:
    """A session owned by an event handler, not by a request."""
    from src.services.purchase.main import db as _db

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


def _po_number_for(run_id: uuid.UUID) -> str:
    return _PO_PREFIX + str(run_id)


async def _po_already_exists(db: AsyncSession, tenant: uuid.UUID,
                             run_id: uuid.UUID) -> PurchaseOrder | None:
    """Structural guard: this production run already produced a PO here."""
    return await db.scalar(
        select(PurchaseOrder).where(
            PurchaseOrder.tenant_id == tenant,
            PurchaseOrder.po_number == _po_number_for(run_id),
        ).limit(1)
    )


async def _default_vendor(db: AsyncSession, tenant: uuid.UUID,
                          outlet_id: uuid.UUID | None) -> Vendor:
    """The vendor a production PO bills to when the event carries none.

    Preference order: an active vendor scoped to the same outlet, then an
    org-level active vendor, then any vendor at all. When the tenant has no
    vendor yet, a placeholder is created — the alternative (dropping the PO
    forever) would make every production run with raw requirements silently
    unreorderable, which is the exact gap this consumer exists to close. The
    placeholder is deterministic on (tenant, code), so the create path is
    idempotent.
    """
    # A placeholder from an earlier event that was later deactivated still
    # holds the deterministic code; reusing it is the only way the create
    # path stays idempotent against the (tenant, code) unique constraint.
    placeholder = await db.scalar(
        select(Vendor).where(
            Vendor.tenant_id == tenant,
            Vendor.code == "PROD-UNASSIGNED",
        )
    )
    if placeholder is not None:
        return placeholder

    rows = list((await db.execute(
        select(Vendor).where(
            Vendor.tenant_id == tenant,
            Vendor.is_active.is_(True),
        ).order_by(Vendor.created_at.asc())
    )).scalars().all())
    if outlet_id is not None:
        for row in rows:
            if row.outlet_id == outlet_id:
                return row
    for row in rows:
        if row.outlet_id is None:
            return row
    if rows:
        return rows[0]

    placeholder = Vendor(
        tenant_id=tenant,
        outlet_id=outlet_id,
        name="Unassigned Vendor (production)",
        code="PROD-UNASSIGNED",
        vendor_type=VendorType.INGREDIENT,
    )
    db.add(placeholder)
    await db.flush()
    return placeholder


@bus.on("production.po.requested")
async def _on_production_po_requested(event: Event) -> None:
    """A completed/started run needs its raw materials bought.

    Lines whose payload has no ``item_id`` are skipped: purchase does not own
    the inventory items, so it cannot resolve names to ids the way the
    inventory service can — a name-only line would become a PO line with no
    valid item, which the line's NOT NULL column correctly refuses. The
    production service therefore carries ``item_id`` whenever it knows it."""
    data = event.data or {}
    run_id = _coerce_uuid(data.get("run_id"))
    tenant = _coerce_uuid(event.tenant_id) or _coerce_uuid(data.get("tenant_id"))
    outlet = _coerce_uuid(event.outlet_id) or _coerce_uuid(data.get("outlet_id"))
    if run_id is None or tenant is None:
        return
    if outlet is None:
        logger.warning("production.po.requested %s has no outlet; PO requires one", run_id)
        return

    lines = []
    for line in data.get("lines") or []:
        item_id = _coerce_uuid(line.get("item_id"))
        try:
            qty = float(line.get("qty") or 0)
        except (TypeError, ValueError):
            continue
        if item_id is None or qty <= 0:
            continue
        lines.append((item_id, qty, line))
    if not lines:
        logger.info("production.po.requested %s: no usable lines; skipped", run_id)
        return

    db = _handler_db()
    try:
        if await _po_already_exists(db, tenant, run_id):
            return

        vendor = await _default_vendor(db, tenant, outlet)

        po = PurchaseOrder(
            tenant_id=tenant,
            outlet_id=outlet,
            vendor_id=vendor.id,
            po_number=_po_number_for(run_id),
            status=POStatus.DRAFT,
            order_date=_now().date(),
            notes=(
                "source=production; production run "
                f"{run_id}"
            ),
        )
        db.add(po)
        await db.flush()

        subtotal = 0.0
        for item_id, qty, line in lines:
            total = _money(qty * 0.0)  # unit price 0: settled when the PO is sent
            subtotal += total
            db.add(PurchaseOrderLine(
                tenant_id=tenant,
                purchase_order_id=po.id,
                inventory_item_id=item_id,
                ordered_qty=qty,
                received_qty=0.0,
                unit_price=0.0,
                line_total=total,
                notes=(
                    f"production {line.get('name') or item_id}"
                    + (f" ({line['uom']})" if line.get("uom") else "")
                ),
            ))
        po.subtotal = _money(subtotal)
        po.grand_total = _money(subtotal)
        await db.flush()

        # The outbox row commits WITH the PO: a committed PO that never emits
        # po.created would leave the rest of the system unaware a PO exists.
        event_out = Event(
            type="po.created",
            tenant_id=tenant,
            outlet_id=outlet,
            data={
                "po_id": str(po.id),
                "po_number": po.po_number,
                "vendor_id": str(vendor.id),
                "grand_total": float(po.grand_total),
                "source": "production",
                "production_run_id": str(run_id),
            },
            source_service="purchase",
        )
        db.add(OutboxMessage(
            event_id=event_out.event_id,
            type=event_out.type,
            tenant_id=tenant,
            outlet_id=outlet,
            data=event_out.data,
            source_service="purchase",
            status="pending",
        ))
        await db.commit()
        await bus.publish(event_out, local=True)
        logger.info(
            "production.po.requested %s -> PO %s (vendor %s)",
            run_id, po.po_number, vendor.name,
        )
    except Exception:
        await db.rollback()
        logger.exception("purchase: production.po.requested handling failed for %s", run_id)
        raise
    finally:
        await db.close()
