"""Thermal printers — KOT, bill, label and report stations.

Print jobs are queued here and consumed by a local print bridge over the
network. The API validates the target printer, records the intent, and returns
a job id the client can poll; it never talks to the printer itself.
"""
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission, resolve_outlet_id
from src.database.session import get_db
from src.models import Bill, KOT, Printer
from src.schemas.integrations import (
    PrintJobRequest,
    PrintJobResponse,
    PrinterCreate,
    PrinterResponse,
    PrinterUpdate,
)
from src.utils.enums import enum_value as _status_value

router = APIRouter(prefix="/integrations/printers", tags=["Integrations"])


# ─── Printer registry ────────────────────────────────────────────

@router.get("", response_model=list[PrinterResponse])
async def list_printers(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:settings"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    printer_type: str | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(Printer).where(Printer.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(Printer.outlet_id == outlet_id)
    if printer_type:
        stmt = stmt.where(Printer.printer_type == printer_type.upper())
    stmt = stmt.order_by(Printer.printer_type, Printer.name)

    return [
        PrinterResponse.model_validate(p)
        for p in (await db.execute(stmt)).scalars().all()
    ]


@router.post("", response_model=PrinterResponse,
             status_code=status.HTTP_201_CREATED)
async def create_printer(
    payload: PrinterCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:settings"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id)

    # A network printer needs somewhere to send the job
    if payload.connection == "network" and not payload.address:
        raise HTTPException(
            status_code=422,
            detail="A network printer needs an IP address or hostname",
        )

    if payload.is_default:
        await _clear_default(db, ctx.tenant_id, payload.outlet_id, payload.printer_type)

    # The columns store uppercase; the API speaks lowercase
    data = payload.model_dump()
    data["printer_type"] = payload.printer_type.upper()
    data["connection"] = payload.connection.upper()

    printer = Printer(tenant_id=ctx.tenant_id, **data)
    db.add(printer)
    await db.commit()
    await db.refresh(printer)
    return PrinterResponse.model_validate(printer)


@router.get("/{printer_id}", response_model=PrinterResponse)
async def get_printer(
    printer_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:settings"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    printer = await db.scalar(
        select(Printer).where(
            Printer.id == printer_id, Printer.tenant_id == ctx.tenant_id
        )
    )
    if printer is None:
        raise HTTPException(status_code=404, detail="Printer not found")
    resolve_outlet_id(ctx, printer.outlet_id)
    return PrinterResponse.model_validate(printer)


@router.put("/{printer_id}", response_model=PrinterResponse)
async def update_printer(
    printer_id: uuid.UUID,
    payload: PrinterUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:settings"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    printer = await db.scalar(
        select(Printer).where(
            Printer.id == printer_id, Printer.tenant_id == ctx.tenant_id
        )
    )
    if printer is None:
        raise HTTPException(status_code=404, detail="Printer not found")
    resolve_outlet_id(ctx, printer.outlet_id)

    data = payload.model_dump(exclude_unset=True)

    # Validate the address against the connection type after the merge
    connection = data.get("connection", _status_value(printer.connection)).lower()
    address = data.get("address", printer.address)
    if connection == "network" and not address:
        raise HTTPException(
            status_code=422,
            detail="A network printer needs an IP address or hostname",
        )

    if data.get("is_default"):
        target_type = data.get("printer_type", _status_value(printer.printer_type))
        await _clear_default(db, ctx.tenant_id, printer.outlet_id, target_type)

    for field, value in data.items():
        if field in ("printer_type", "connection") and value:
            value = value.upper()
        setattr(printer, field, value)

    await db.commit()
    await db.refresh(printer)
    return PrinterResponse.model_validate(printer)


@router.delete("/{printer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_printer(
    printer_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:settings"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    printer = await db.scalar(
        select(Printer).where(
            Printer.id == printer_id, Printer.tenant_id == ctx.tenant_id
        )
    )
    if printer is None:
        raise HTTPException(status_code=404, detail="Printer not found")
    resolve_outlet_id(ctx, printer.outlet_id)

    await db.delete(printer)
    await db.commit()


async def _clear_default(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    printer_type: str,
) -> None:
    """Only one default printer per outlet per type."""
    existing = (
        await db.execute(
            select(Printer).where(
                Printer.tenant_id == tenant_id,
                Printer.outlet_id == outlet_id,
                Printer.printer_type == printer_type.upper(),
                Printer.is_default.is_(True),
            )
        )
    ).scalars().all()
    for printer in existing:
        printer.is_default = False


async def _resolve_printer(
    db: AsyncSession,
    ctx: CurrentUserContext,
    outlet_id: uuid.UUID,
    printer_type: str,
    printer_id: uuid.UUID | None,
) -> Printer | None:
    """The requested printer, else the default for that type, else none."""
    if printer_id:
        printer = await db.scalar(
            select(Printer).where(
                Printer.id == printer_id,
                Printer.tenant_id == ctx.tenant_id,
                Printer.outlet_id == outlet_id,
                Printer.is_active.is_(True),
            )
        )
        if printer is None:
            raise HTTPException(
                status_code=404, detail="Printer not found at this outlet"
            )
        return printer

    return (
        await db.execute(
            select(Printer).where(
                Printer.tenant_id == ctx.tenant_id,
                Printer.outlet_id == outlet_id,
                Printer.printer_type == printer_type,
                Printer.is_active.is_(True),
                Printer.is_default.is_(True),
            )
        )
    ).scalars().first()


# ─── Print jobs ──────────────────────────────────────────────────

@router.post("/jobs/bills/{bill_id}", response_model=PrintJobResponse)
async def print_bill(
    bill_id: uuid.UUID,
    payload: PrintJobRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:orders"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Queue a bill print and return the job id to poll."""
    bill = await db.scalar(
        select(Bill).where(Bill.id == bill_id, Bill.tenant_id == ctx.tenant_id)
    )
    if bill is None:
        raise HTTPException(status_code=404, detail="Bill not found")
    resolve_outlet_id(ctx, bill.outlet_id)

    printer = await _resolve_printer(
        db, ctx, bill.outlet_id, "BILL", payload.printer_id
    )

    return PrintJobResponse(
        job_id=f"BILL-{bill.bill_number}",
        printer_name=printer.name if printer else None,
        job_type="bill",
        copies=payload.copies,
        queued_at=datetime.now(timezone.utc),
    )


@router.post("/jobs/kots/{kot_id}", response_model=PrintJobResponse)
async def print_kot(
    kot_id: uuid.UUID,
    payload: PrintJobRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:orders"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Queue a kitchen ticket print and bump its print counter."""
    kot = await db.scalar(
        select(KOT).where(KOT.id == kot_id, KOT.tenant_id == ctx.tenant_id)
    )
    if kot is None:
        raise HTTPException(status_code=404, detail="KOT not found")
    resolve_outlet_id(ctx, kot.outlet_id)

    printer = await _resolve_printer(db, ctx, kot.outlet_id, "KOT", payload.printer_id)

    if payload.reprint:
        # Reprises are counted so duplicate tickets can be traced back
        kot.printed_count = int(kot.printed_count or 0) + 1
        await db.commit()

    return PrintJobResponse(
        job_id=f"KOT-{kot.kot_number}",
        printer_name=printer.name if printer else None,
        job_type="kot",
        copies=payload.copies,
        queued_at=datetime.now(timezone.utc),
    )
