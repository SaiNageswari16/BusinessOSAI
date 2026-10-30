"""Printers service endpoints.

Who may call what:
  * ``/printers``, ``/devices``, ``/print-jobs``, ``/receipt-preview`` read — ``view:printers``
  * register / edit / delete printers, device pairing, test prints, retries — ``manage:printers``

Events:
  subscribes kot.print.requested, bill.paid, order.placed  (queue print jobs)
  publishes  printer.registered, printer.status.changed

Outlets are scoped on top of the tenant: any route whose payload or path
names an ``outlet_id`` checks ``identity.can_access_outlet`` — a manager
limited to one outlet must not be able to register a printer for another's.
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status as http_status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.event_bus.bus import Event, bus
from src.services.printers import service as svc
from src.services.printers.models import (
    JobSourceType,
    JobStatus,
    OutboxMessage,
    Printer,
    PrintJob,
)
from src.services.printers.schemas import (
    DeviceBind,
    DeviceCreate,
    DeviceResponse,
    JobRetryResponse,
    PrinterCreate,
    PrinterResponse,
    PrinterUpdate,
    PrintJobResponse,
)
from src.services.shared.identity import CurrentIdentity

router = APIRouter()

VIEW = "view:printers"
MANAGE = "manage:printers"


async def get_db(request: Request) -> AsyncSession:
    """One session per request, committed on success, rolled back on error."""
    session = request.app.state.db.session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


DbDep = Annotated[AsyncSession, Depends(get_db)]


def _ev(topic, tenant_id=None, outlet_id=None, data=None):
    return Event(type=topic, tenant_id=tenant_id, outlet_id=outlet_id,
                 data=data or {}, source_service="printers")


def _outbox(db: AsyncSession, event: Event) -> None:
    """Write the event to the outbox inside the current transaction."""
    db.add(OutboxMessage(
        event_id=event.event_id,
        type=event.type,
        tenant_id=event.tenant_id,
        outlet_id=event.outlet_id,
        data=event.data,
        source_service=event.source_service,
        status="pending",
    ))


def _check_outlet(identity: CurrentIdentity, outlet_id: uuid.UUID | None) -> None:
    """403 when the named outlet is outside this identity's reach."""
    if outlet_id is not None and not identity.can_access_outlet(outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")


# ─── Printers ────────────────────────────────────────────────────────────────

@router.get("/printers", response_model=list[PrinterResponse], tags=["printers"])
async def list_printers(identity: CurrentIdentity, db: DbDep,
                       outlet_id: uuid.UUID | None = None,
                       type: str | None = Query(default=None, description="printer type filter")):
    identity.require(VIEW)
    _check_outlet(identity, outlet_id)
    return await svc.list_printers(db, identity.tenant_id,
                                   outlet_id=outlet_id, printer_type=type)


@router.post("/printers", response_model=PrinterResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["printers"])
async def create_printer(payload: PrinterCreate, identity: CurrentIdentity, db: DbDep):
    identity.require(MANAGE)
    _check_outlet(identity, payload.outlet_id)
    data = payload.model_dump()
    try:
        printer = await svc.create_printer(db, identity.tenant_id, data)
    except svc.PrintersError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    event = _ev("printer.registered", identity.tenant_id, printer.outlet_id, data={
        "printer_id": str(printer.id),
        "outlet_id": str(printer.outlet_id) if printer.outlet_id else None,
        "name": printer.name,
        "type": printer.printer_type.value if hasattr(printer.printer_type, "value") else str(printer.printer_type),
    })
    _outbox(db, event)
    await db.commit()
    await bus.publish(event, local=True)
    return printer


@router.patch("/printers/{printer_id}", response_model=PrinterResponse,
              tags=["printers"])
async def update_printer(printer_id: uuid.UUID, payload: PrinterUpdate,
                         identity: CurrentIdentity, db: DbDep):
    identity.require(MANAGE)
    printer = await svc.load_printer(db, identity.tenant_id, printer_id)
    if printer is None:
        raise HTTPException(status_code=404, detail="Printer not found")
    _check_outlet(identity, printer.outlet_id)
    data = payload.model_dump(exclude_unset=True)
    if "outlet_id" in data:
        _check_outlet(identity, data["outlet_id"])
    await svc.update_printer(db, identity.tenant_id, printer, data)
    return printer


@router.delete("/printers/{printer_id}", tags=["printers"])
async def delete_printer(printer_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    """Soft delete: the printer is deactivated, its jobs and audit survive."""
    identity.require(MANAGE)
    printer = await svc.load_printer(db, identity.tenant_id, printer_id)
    if printer is None:
        raise HTTPException(status_code=404, detail="Printer not found")
    _check_outlet(identity, printer.outlet_id)
    printer = await svc.deactivate_printer(db, identity.tenant_id, printer)
    return {"id": str(printer.id), "active": printer.active}


@router.post("/printers/{printer_id}/test", response_model=PrintJobResponse,
             tags=["printers"])
async def test_print(printer_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    """Queue a TEST receipt against this printer; the dispatcher spools it."""
    identity.require(MANAGE)
    printer = await svc.load_printer(db, identity.tenant_id, printer_id)
    if printer is None:
        raise HTTPException(status_code=404, detail="Printer not found")
    _check_outlet(identity, printer.outlet_id)
    job = await svc.create_test_job(db, identity.tenant_id, printer)
    return job


@router.post("/printers/{printer_id}/heartbeat", response_model=PrinterResponse,
             tags=["printers"])
async def printer_heartbeat(printer_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    """Liveness ping: the printer (or its driver) reports in."""
    identity.require(MANAGE)
    printer = await svc.load_printer(db, identity.tenant_id, printer_id)
    if printer is None:
        raise HTTPException(status_code=404, detail="Printer not found")
    _check_outlet(identity, printer.outlet_id)
    printer = await svc.record_printer_heartbeat(db, identity.tenant_id, printer)
    event = _ev("printer.status.changed", identity.tenant_id, printer.outlet_id, data={
        "printer_id": str(printer.id),
        "health": printer.health.value if hasattr(printer.health, "value") else str(printer.health),
        "last_seen_at": printer.last_seen_at.isoformat() if printer.last_seen_at else None,
    })
    _outbox(db, event)
    await db.commit()
    await bus.publish(event, local=True)
    return printer


# ─── Devices ─────────────────────────────────────────────────────────────────

@router.get("/devices", response_model=list[DeviceResponse], tags=["printers"])
async def list_devices(identity: CurrentIdentity, db: DbDep,
                      outlet_id: uuid.UUID | None = None,
                      kind: str | None = None,
                      status: str | None = None):
    identity.require(VIEW)
    _check_outlet(identity, outlet_id)
    return await svc.list_devices(db, identity.tenant_id,
                                  outlet_id=outlet_id, kind=kind, status=status)


@router.post("/devices", response_model=DeviceResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["printers"])
async def register_device(payload: DeviceCreate, identity: CurrentIdentity, db: DbDep):
    identity.require(MANAGE)
    _check_outlet(identity, payload.outlet_id)
    data = payload.model_dump()
    try:
        device = await svc.create_device(db, identity.tenant_id, data)
    except svc.PrintersError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return device


@router.post("/devices/{code}/bind", response_model=DeviceResponse, tags=["printers"])
async def bind_device(code: str, payload: DeviceBind,
                      identity: CurrentIdentity, db: DbDep):
    """Pair the device code with a print destination (or unbind)."""
    identity.require(MANAGE)
    device = await svc.load_device_by_code(db, identity.tenant_id, code)
    if device is None:
        raise HTTPException(status_code=404, detail="Device code not found")
    _check_outlet(identity, device.outlet_id)
    printer = None
    if payload.printer_id is not None:
        printer = await svc.load_printer(db, identity.tenant_id, payload.printer_id)
        if printer is None:
            raise HTTPException(status_code=404, detail="Printer not found")
        _check_outlet(identity, printer.outlet_id)
    try:
        device = await svc.bind_device(db, identity.tenant_id, device, printer)
    except svc.PrintersError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return device


@router.post("/devices/{code}/revoke", response_model=DeviceResponse, tags=["printers"])
async def revoke_device(code: str, identity: CurrentIdentity, db: DbDep):
    identity.require(MANAGE)
    device = await svc.load_device_by_code(db, identity.tenant_id, code)
    if device is None:
        raise HTTPException(status_code=404, detail="Device code not found")
    _check_outlet(identity, device.outlet_id)
    device = await svc.revoke_device(db, identity.tenant_id, device)
    return device


@router.post("/devices/{code}/heartbeat", response_model=DeviceResponse, tags=["printers"])
async def device_heartbeat(code: str, identity: CurrentIdentity, db: DbDep):
    """A paired device keeps its last-seen stamp fresh."""
    identity.require(VIEW)
    device = await svc.load_device_by_code(db, identity.tenant_id, code)
    if device is None:
        raise HTTPException(status_code=404, detail="Device code not found")
    _check_outlet(identity, device.outlet_id)
    device = await svc.device_heartbeat(db, identity.tenant_id, device)
    return device


# ─── Print jobs ──────────────────────────────────────────────────────────────

@router.get("/print-jobs", response_model=list[PrintJobResponse], tags=["printers"])
async def list_jobs(identity: CurrentIdentity, db: DbDep,
                   printer_id: uuid.UUID | None = None,
                   status: str | None = None,
                   source_type: str | None = None,
                   limit: int = Query(default=100, le=500)):
    identity.require(VIEW)
    stmt = select(PrintJob).where(PrintJob.tenant_id == identity.tenant_id)
    if printer_id is not None:
        stmt = stmt.where(PrintJob.printer_id == printer_id)
    if status is not None:
        try:
            status_filter = JobStatus(status.upper())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
        stmt = stmt.where(PrintJob.status == status_filter)
    if source_type is not None:
        try:
            source_filter = JobSourceType(source_type.upper())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid source_type: {source_type}")
        stmt = stmt.where(PrintJob.source_type == source_filter)
    stmt = stmt.order_by(PrintJob.requested_at.desc()).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


@router.get("/print-jobs/{job_id}", response_model=PrintJobResponse, tags=["printers"])
async def get_job(job_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require(VIEW)
    job = await svc.load_job(db, identity.tenant_id, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Print job not found")
    _check_outlet(identity, job.outlet_id)
    return job


@router.post("/print-jobs/{job_id}/retry", response_model=JobRetryResponse,
             tags=["printers"])
async def retry_job(job_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    """Re-queue a failed job; past the retry budget it is expired."""
    identity.require(MANAGE)
    job = await svc.load_job(db, identity.tenant_id, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Print job not found")
    _check_outlet(identity, job.outlet_id)
    try:
        job = await svc.retry_job(db, identity.tenant_id, job)
    except svc.PrintersError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return JobRetryResponse(
        job_id=job.id,
        status=job.status,
        retry=job.retry,
    )


# ─── Receipt preview ─────────────────────────────────────────────────────────

@router.get("/receipt-preview", tags=["printers"])
async def receipt_preview(identity: CurrentIdentity, db: DbDep,
                          source_type: str = Query(description="KOT | BILL | ORDER | TEST"),
                          source_ref: str = Query(description="the document number to preview")):
    """Pure renderer contract for the frontend receipt / KOT preview screen.

    Renders from the job's own ``payload`` snapshot — the printers service
    never reads another service's database — and attaches the destination
    printer's paper width when one is resolvable, so the preview can lay
    out lines at the real width.
    """
    identity.require(VIEW)
    try:
        source_filter = JobSourceType(source_type.upper())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid source_type: {source_type}")
    job = await db.scalar(
        select(PrintJob)
        .where(
            PrintJob.tenant_id == identity.tenant_id,
            PrintJob.source_type == source_filter,
            PrintJob.source_ref == source_ref,
        )
        .order_by(PrintJob.requested_at.desc())
        .limit(1)
    )
    payload = (job.payload if job else None) or {}
    paper_width = 80
    printer: Printer | None = None
    if job is not None:
        if job.printer_id is not None:
            printer = await svc.load_printer(db, identity.tenant_id, job.printer_id)
        if printer is None:
            printer = await svc.default_printer_for(
                db, identity.tenant_id, job.outlet_id, job.destination
            )
        if printer is not None and printer.paper_width_mm:
            paper_width = printer.paper_width_mm

    lines = payload.get("lines") or []
    items = payload.get("items") or []
    return {
        "source_type": source_type.upper(),
        "source_ref": source_ref,
        "destination": str(job.destination) if job else None,
        "order_number": payload.get("order_number") or source_ref,
        "kot_number": payload.get("kot_number") or (
            source_ref if source_type.upper() == "KOT" else None
        ),
        "items": items,
        "notes": payload.get("notes"),
        "lines": lines,
        "totals": {
            "subtotal": payload.get("subtotal"),
            "tax_total": payload.get("tax_total"),
            "grand_total": payload.get("grand_total"),
            "paid_amount": payload.get("paid_amount"),
        } if source_type.upper() == "BILL" else {},
        "paper_width_mm": paper_width,
        "requested_at": job.requested_at.isoformat() if job else None,
        "sent_at": job.sent_at.isoformat() if (job and job.sent_at) else None,
    }
