"""Printers event consumers — the automatic print jobs.

Before this module the printers service *declared* its bus subscriptions in
the registry but had no handlers: a KOT firing or a bill settling never queued
a print, so the spooler sat idle. These consumers close that gap. They are
registered on the shared bus singleton at import time; ``main.py`` imports
this module for that side effect.

House rules observed (see accounting/events.py):
  * handlers get their own session from the service's module-level ``db``
    (never a request session — they run outside any request);
  * idempotency is structural (a guard on (tenant, source_type, source_ref,
    destination, outlet)) ON TOP of the durable ``consumed_events`` ledger
    gate in the consumer loop — the ledger dedupes across restarts, the guard
    dedupes the one path where it does not;
  * no cross-service reads: everything a job needs arrives in the event
    payload and is snapshotted into the job's ``payload`` JSONB;
  * a handler that cannot queue a job logs and moves on — one tenant's
    transient DB blip must not wedge the bus.

The three consumers:
  * ``kot.print.requested``  -> KDS job  (a KOT fired by the kitchen)
  * ``bill.paid``            -> RECEIPT job (a settled bill)
  * ``order.placed``         -> KDS job, dine-in/QSR/takeaway only
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.event_bus.bus import Event, bus
from src.services.printers.models import (
    Destination,
    JobSourceType,
    JobStatus,
    PrintJob,
    PrintLog,
)

logger = logging.getLogger("printers.events")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _handler_db() -> AsyncSession:
    """A session owned by an event handler, not by a request."""
    from src.services.printers.main import db as _db

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
    """The bus serialises tenant_id as a string across processes; accept both."""
    value = event.tenant_id
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


def _outlet(event: Event, data: dict) -> uuid.UUID | None:
    """Outlet from the event, falling back to the payload; both may be absent."""
    return _coerce_uuid(event.outlet_id) or _coerce_uuid(data.get("outlet_id"))


async def _job_exists(
    db: AsyncSession,
    tenant: uuid.UUID,
    source_type: JobSourceType,
    source_ref: str,
    destination: Destination,
    outlet: uuid.UUID | None,
) -> bool:
    """Structural idempotency: any existing job with this source key.

    A job is always in QUEUED-or-later state (there is no 'un-queued' state),
    so any row means the source document was already queued and a redelivered
    event must not queue it a second time.
    """
    stmt = select(PrintJob.id).where(
        PrintJob.tenant_id == tenant,
        PrintJob.source_type == source_type,
        PrintJob.source_ref == source_ref,
        PrintJob.destination == destination,
    )
    if outlet is not None:
        stmt = stmt.where(PrintJob.outlet_id == outlet)
    return await db.scalar(stmt.limit(1)) is not None


async def _queue(
    db: AsyncSession,
    tenant: uuid.UUID,
    outlet: uuid.UUID | None,
    source_type: JobSourceType,
    source_ref: str,
    destination: Destination,
    payload: dict,
    printer_id: uuid.UUID | None = None,
) -> PrintJob | None:
    """Create a QUEUED job + its audit row, or None when already queued."""
    if await _job_exists(db, tenant, source_type, source_ref, destination, outlet):
        return None
    job = PrintJob(
        tenant_id=tenant,
        outlet_id=outlet,
        printer_id=printer_id,
        source_type=source_type,
        source_ref=source_ref,
        destination=destination,
        status=JobStatus.QUEUED,
        requested_at=_now(),
        payload=payload,
    )
    db.add(job)
    await db.flush()
    db.add(PrintLog(
        print_job_id=job.id,
        at=_now(),
        from_status=None,
        to_status="QUEUED",
        note=f"queued {source_type.value} {source_ref}",
    ))
    return job


# ─── Consumers ────────────────────────────────────────────────────────────────


@bus.on("kot.print.requested")
async def _on_kot_print_requested(event: Event) -> None:
    """A KOT fired: queue a KDS print job.

    ``printer_ref`` (when present and a valid UUID) names the destination
    printer explicitly; otherwise it is left to None and the dispatcher
    resolves the outlet's KDS-default printer. The KOT payload is snapshotted
    into the job so the spooler never re-reads the kitchen service.
    """
    data = event.data or {}
    tenant = _coerce_uuid(event.tenant_id) or _coerce_uuid(data.get("tenant_id"))
    if tenant is None:
        return
    source_ref = str(data.get("kot_number") or data.get("kot_id") or "")
    if not source_ref:
        return
    outlet = _outlet(event, data)
    printer_ref = _coerce_uuid(data.get("printer_ref"))

    db = _handler_db()
    try:
        job = await _queue(
            db, tenant, outlet, JobSourceType.KOT, source_ref, Destination.KDS,
            payload={
                "kot_id": str(data.get("kot_id")) if data.get("kot_id") else None,
                "kot_number": data.get("kot_number"),
                "station_id": str(data.get("station_id")) if data.get("station_id") else None,
                "requested_at": data.get("requested_at"),
            },
            printer_id=printer_ref,
        )
        await db.commit()
        if job:
            logger.info("kot.print.requested %s -> job %s", source_ref, job.id)
    except Exception:
        await db.rollback()
        logger.exception("printers: kot.print.requested queue failed for %s", source_ref)
    finally:
        await db.close()


@bus.on("bill.paid")
async def _on_bill_paid(event: Event) -> None:
    """A bill settled: queue a RECEIPT print job.

    The bill's lines and totals ride in the payload (the billing event
    already carries them), so the receipt preview renders from this snapshot
    without touching the billing database.
    """
    data = event.data or {}
    tenant = _coerce_uuid(event.tenant_id) or _coerce_uuid(data.get("tenant_id"))
    if tenant is None:
        return
    source_ref = str(data.get("bill_number") or data.get("bill_id") or "")
    if not source_ref:
        return
    outlet = _outlet(event, data)

    db = _handler_db()
    try:
        job = await _queue(
            db, tenant, outlet, JobSourceType.BILL, source_ref, Destination.RECEIPT,
            payload={
                "bill_id": str(data.get("bill_id")) if data.get("bill_id") else None,
                "bill_number": data.get("bill_number"),
                "order_number": data.get("order_number"),
                "status": data.get("status"),
                "subtotal": data.get("subtotal"),
                "tax_total": data.get("tax_total"),
                "grand_total": data.get("grand_total"),
                "paid_amount": data.get("paid_amount"),
                "payment_method": data.get("payment_method"),
                "lines": data.get("lines") or [],
            },
        )
        await db.commit()
        if job:
            logger.info("bill.paid %s -> job %s", source_ref, job.id)
    except Exception:
        await db.rollback()
        logger.exception("printers: bill.paid queue failed for %s", source_ref)
    finally:
        await db.close()


@bus.on("order.placed")
async def _on_order_placed(event: Event) -> None:
    """An order placed: queue a KDS job for dine-in/QSR/takeaway only.

    Delivery-only orders have no kitchen KOT of their own in this build, so
    they are skipped: queueing a KDS job for them would fan out to a printer
    that will never see them cooked.
    """
    data = event.data or {}
    tenant = _coerce_uuid(event.tenant_id) or _coerce_uuid(data.get("tenant_id"))
    if tenant is None:
        return
    order_type = str(data.get("order_type") or "").lower()
    if order_type not in ("dine_in", "qsr", "takeaway"):
        return
    source_ref = str(data.get("order_number") or data.get("order_id") or "")
    if not source_ref:
        return
    outlet = _outlet(event, data)

    db = _handler_db()
    try:
        job = await _queue(
            db, tenant, outlet, JobSourceType.ORDER, source_ref, Destination.KDS,
            payload={
                "order_id": str(data.get("order_id")) if data.get("order_id") else None,
                "order_number": data.get("order_number"),
                "order_type": data.get("order_type"),
                "table_id": str(data.get("table_id")) if data.get("table_id") else None,
            },
        )
        await db.commit()
        if job:
            logger.info("order.placed %s -> job %s", source_ref, job.id)
    except Exception:
        await db.rollback()
        logger.exception("printers: order.placed queue failed for %s", source_ref)
    finally:
        await db.close()
