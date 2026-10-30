"""Reports event consumers — projections into the read models.

This module exists for side-effect: importing it registers the ``@bus.on``
handlers with the bus. The bus's consumer loop (started in this service's
lifespan with its own consumer group) delivers events to them; the durable
``consumed_events`` ledger installed in ``main.py`` is the layer-1 dedupe
gate, and the structural reference guard inside each projector is layer 2.

House rules observed (mirror ``accounting/events.py``):
  * the handler owns its own session from the service's module-level ``db``
    (never a request session — it runs outside any request);
  * the structural idempotency guard lives in the projector (keyed on the
    domain reference, not the event id) so a re-emitted fact with a fresh
    event_id cannot double-count;
  * a handler that cannot project logs and re-raises — a dead consumer must
    not look alive.
"""
from __future__ import annotations

import logging
import uuid

from src.services.event_bus.bus import Event, bus
from src.services.reports import service as svc

logger = logging.getLogger("reports.events")


def _handler_db():
    """A session owned by an event handler, not by a request."""
    from src.services.reports.main import db as _db

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


def _tenant(event: Event) -> uuid.UUID | None:
    """Tenant id from an event, always as a UUID.

    The bus serialises tenant_id as a string; a value that does not parse
    degrades to a skipped event, not a handler exception.
    """
    value = event.tenant_id
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


@bus.on("stock.movement.created")
async def _on_stock_movement_created(event: Event) -> None:
    """Fold a stock movement into the valued current-stock projection.

    The inventory service is the source of truth for stock; this is where
    the fact lands in reports. The movement id is the structural guard, so
    a re-emitted movement for the same ledger entry cannot move the running
    total twice.
    """
    data = event.data or {}
    tenant = _tenant(event) or _coerce_uuid(data.get("tenant_id"))
    outlet = _coerce_uuid(event.outlet_id) or _coerce_uuid(data.get("outlet_id"))
    item_id = _coerce_uuid(data.get("inventory_item_id"))
    movement_id = str(data.get("movement_id") or "")
    if tenant is None or outlet is None or item_id is None or not movement_id:
        return

    db = _handler_db()
    try:
        applied = await svc.project_stock_movement(
            db, tenant, outlet,
            item_id=item_id,
            item_name=data.get("inventory_item_name"),
            qty=data.get("qty") or 0,
            unit_cost=data.get("unit_cost") or 0,
            movement_id=movement_id,
        )
        await db.commit()
        if applied:
            logger.info(
                "stock.movement.created %s projected (tenant %s)", movement_id, tenant,
            )
    except Exception:
        await db.rollback()
        logger.exception("reports: stock.movement.created failed for %s", movement_id)
        raise
    finally:
        await db.close()


@bus.on("grn.posted")
async def _on_grn_posted(event: Event) -> None:
    """A passed GRN adds its received value to the day's purchase totals.

    The grn_id guard is what keeps a rejected-then-re-passed GRN from
    counting the day's purchases twice: the durable event ledger stops a
    redelivery of the SAME event, but a re-passed GRN is a fresh event with
    the same domain reference.
    """
    data = event.data or {}
    tenant = _tenant(event) or _coerce_uuid(data.get("tenant_id"))
    outlet = _coerce_uuid(event.outlet_id) or _coerce_uuid(data.get("outlet_id"))
    grn_id = str(data.get("grn_id") or "")
    if tenant is None or outlet is None or not grn_id:
        return

    db = _handler_db()
    try:
        applied = await svc.project_grn_posted(
            db, tenant, outlet,
            grn_id=grn_id,
            amount=data.get("amount") or 0,
        )
        await db.commit()
        if applied:
            logger.info("grn.posted %s projected into purchase totals", grn_id)
    except Exception:
        await db.rollback()
        logger.exception("reports: grn.posted failed for %s", grn_id)
        raise
    finally:
        await db.close()


@bus.on("vendor_bill.created")
async def _on_vendor_bill_created(event: Event) -> None:
    """A vendor bill adds its owed value to the day's purchase totals.

    Kept separate from the GRN side of the purchase report: goods received
    and money owed are different numbers and are not summed together.
    """
    data = event.data or {}
    tenant = _tenant(event) or _coerce_uuid(data.get("tenant_id"))
    outlet = _coerce_uuid(event.outlet_id) or _coerce_uuid(data.get("outlet_id"))
    bill_id = str(data.get("bill_id") or "")
    if tenant is None or outlet is None or not bill_id:
        return

    db = _handler_db()
    try:
        applied = await svc.project_vendor_bill(
            db, tenant, outlet,
            bill_id=bill_id,
            amount=data.get("grand_total") or 0,
        )
        await db.commit()
        if applied:
            logger.info("vendor_bill.created %s projected into purchase totals", bill_id)
    except Exception:
        await db.rollback()
        logger.exception("reports: vendor_bill.created failed for %s", bill_id)
        raise
    finally:
        await db.close()


# ─── Ops consumers (finance / delivery / production / marketing) ─────────────
# These land in the same daily_ops projection as one another; the per-fact
# EventReference guard in the service layer is what keeps each fact from
# double-counting, so the handlers stay uniform and thin.

@bus.on("expense.recorded")
async def _on_expense_recorded(event: Event) -> None:
    """An operational expense adds to the day's money-out figure."""
    data = event.data or {}
    tenant = _tenant(event) or _coerce_uuid(data.get("tenant_id"))
    outlet = _coerce_uuid(event.outlet_id) or _coerce_uuid(data.get("outlet_id"))
    expense_id = str(data.get("expense_id") or "")
    if tenant is None or outlet is None or not expense_id:
        return

    db = _handler_db()
    try:
        applied = await svc.project_expense_recorded(
            db, tenant, outlet,
            expense_id=expense_id,
            amount=data.get("amount") or 0,
        )
        await db.commit()
        if applied:
            logger.info("expense.recorded %s projected into ops totals", expense_id)
    except Exception:
        await db.rollback()
        logger.exception("reports: expense.recorded failed for %s", expense_id)
        raise
    finally:
        await db.close()


@bus.on("withdrawal.recorded")
async def _on_withdrawal_recorded(event: Event) -> None:
    """An approved owner withdrawal adds to the day's money-out figure."""
    data = event.data or {}
    tenant = _tenant(event) or _coerce_uuid(data.get("tenant_id"))
    outlet = _coerce_uuid(event.outlet_id) or _coerce_uuid(data.get("outlet_id"))
    withdrawal_id = str(data.get("withdrawal_id") or "")
    if tenant is None or outlet is None or not withdrawal_id:
        return

    db = _handler_db()
    try:
        applied = await svc.project_withdrawal_recorded(
            db, tenant, outlet,
            withdrawal_id=withdrawal_id,
            amount=data.get("amount") or 0,
        )
        await db.commit()
        if applied:
            logger.info("withdrawal.recorded %s projected into ops totals", withdrawal_id)
    except Exception:
        await db.rollback()
        logger.exception("reports: withdrawal.recorded failed for %s", withdrawal_id)
        raise
    finally:
        await db.close()


@bus.on("delivery.delivered")
async def _on_delivery_delivered(event: Event) -> None:
    """A finished delivery counts toward the day's dispatch total."""
    data = event.data or {}
    tenant = _tenant(event) or _coerce_uuid(data.get("tenant_id"))
    outlet = _coerce_uuid(event.outlet_id) or _coerce_uuid(data.get("outlet_id"))
    delivery_id = str(data.get("delivery_id") or "")
    if tenant is None or outlet is None or not delivery_id:
        return

    db = _handler_db()
    try:
        applied = await svc.project_delivery_delivered(
            db, tenant, outlet,
            delivery_id=delivery_id,
        )
        await db.commit()
        if applied:
            logger.info("delivery.delivered %s projected into ops totals", delivery_id)
    except Exception:
        await db.rollback()
        logger.exception("reports: delivery.delivered failed for %s", delivery_id)
        raise
    finally:
        await db.close()


@bus.on("production.run.completed")
async def _on_production_run_completed(event: Event) -> None:
    """A completed production run counts toward the day's batch total."""
    data = event.data or {}
    tenant = _tenant(event) or _coerce_uuid(data.get("tenant_id"))
    outlet = _coerce_uuid(event.outlet_id) or _coerce_uuid(data.get("outlet_id"))
    run_id = str(data.get("run_id") or "")
    if tenant is None or outlet is None or not run_id:
        return

    db = _handler_db()
    try:
        applied = await svc.project_production_run_completed(
            db, tenant, outlet,
            run_id=run_id,
        )
        await db.commit()
        if applied:
            logger.info("production.run.completed %s projected into ops totals", run_id)
    except Exception:
        await db.rollback()
        logger.exception("reports: production.run.completed failed for %s", run_id)
        raise
    finally:
        await db.close()


@bus.on("marketing.campaign.sent")
async def _on_marketing_campaign_sent(event: Event) -> None:
    """A campaign send adds to the day's outreach counts."""
    data = event.data or {}
    tenant = _tenant(event) or _coerce_uuid(data.get("tenant_id"))
    outlet = _coerce_uuid(event.outlet_id) or _coerce_uuid(data.get("outlet_id"))
    campaign_id = str(data.get("campaign_id") or "")
    if tenant is None or outlet is None or not campaign_id:
        return

    db = _handler_db()
    try:
        applied = await svc.project_marketing_campaign_sent(
            db, tenant, outlet,
            campaign_id=campaign_id,
            sent_count=data.get("sent_count") or 0,
        )
        await db.commit()
        if applied:
            logger.info("marketing.campaign.sent %s projected into ops totals", campaign_id)
    except Exception:
        await db.rollback()
        logger.exception("reports: marketing.campaign.sent failed for %s", campaign_id)
        raise
    finally:
        await db.close()
