from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Annotated, List

from datetime import datetime, date

from src.database.session import get_db
from src.models.inventory import InventoryBatch, InventorySerial, TraceabilityEvent
from src.schemas.warehouse import (
    InventoryBatchCreate, InventoryBatchUpdate, InventoryBatchResponse,
    InventorySerialCreate, InventorySerialUpdate, InventorySerialResponse,
    TraceabilityEventCreate, TraceabilityEventResponse,
)
from src.api.deps import CurrentUserContext, require_any_permission, require_permission
from uuid import UUID

router = APIRouter()


# ==========================================
# Inventory Batch
# ==========================================

@router.get("/batches", response_model=List[InventoryBatchResponse])
async def list_batches(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos", "view:inventory"))],
    db: AsyncSession = Depends(get_db),
    product_id: str | None = None,
    warehouse_id: str | None = None,
    status: str | None = None,
    search: str | None = None,
):
    q = select(InventoryBatch).where(InventoryBatch.tenant_id == ctx.tenant_id)
    if product_id:
        q = q.where(InventoryBatch.product_id == UUID(product_id))
    if warehouse_id:
        q = q.where(InventoryBatch.warehouse_id == UUID(warehouse_id))
    if status:
        q = q.where(InventoryBatch.status == status)
    if search:
        q = q.where(
            (InventoryBatch.batch_number.ilike(f"%{search}%"))
            | (InventoryBatch.product_name.ilike(f"%{search}%"))
        )
    q = q.order_by(InventoryBatch.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/batches", response_model=InventoryBatchResponse)
async def create_batch(
    batch_in: InventoryBatchCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: AsyncSession = Depends(get_db),
):
    batch = InventoryBatch(**batch_in.model_dump(), tenant_id=ctx.tenant_id)
    db.add(batch)
    await db.commit()
    await db.refresh(batch)

    # Auto-create an initial "received" traceability event
    if batch.warehouse_id:
        wh_result = await db.execute(
            select(InventoryBatch.warehouse_id).where(InventoryBatch.id == batch.id)
        )
        ev = TraceabilityEvent(
            event_type="received",
            batch_id=batch.id,
            destination_location=batch.warehouse_name,
            destination_warehouse_id=batch.warehouse_id,
            party_type="supplier",
            party_name=batch.supplier,
            reference_document=batch.batch_number,
            quantity=batch.quantity,
            actor_user_id=ctx.user.id if hasattr(ctx, "user") else None,
            tenant_id=ctx.tenant_id,
        )
        db.add(ev)
        await db.commit()

    return batch


@router.get("/batches/{batch_id}", response_model=InventoryBatchResponse)
async def get_batch(
    batch_id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos", "view:inventory"))],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InventoryBatch).where(
            InventoryBatch.id == UUID(batch_id),
            InventoryBatch.tenant_id == ctx.tenant_id,
        )
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.patch("/batches/{batch_id}", response_model=InventoryBatchResponse)
async def update_batch(
    batch_id: str,
    batch_in: InventoryBatchUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InventoryBatch).where(
            InventoryBatch.id == UUID(batch_id),
            InventoryBatch.tenant_id == ctx.tenant_id,
        )
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    for k, v in batch_in.model_dump(exclude_unset=True).items():
        setattr(batch, k, v)

    await db.commit()
    await db.refresh(batch)
    return batch


@router.delete("/batches/{batch_id}")
async def delete_batch(
    batch_id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InventoryBatch).where(
            InventoryBatch.id == UUID(batch_id),
            InventoryBatch.tenant_id == ctx.tenant_id,
        )
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    await db.delete(batch)
    await db.commit()
    return {"message": "Batch deleted"}


# ==========================================
# Inventory Serial
# ==========================================

@router.get("/serials", response_model=List[InventorySerialResponse])
async def list_serials(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos", "view:inventory"))],
    db: AsyncSession = Depends(get_db),
    batch_id: str | None = None,
    warehouse_id: str | None = None,
    status: str | None = None,
    search: str | None = None,
):
    q = select(InventorySerial).where(InventorySerial.tenant_id == ctx.tenant_id)
    if batch_id:
        q = q.where(InventorySerial.batch_id == UUID(batch_id))
    if warehouse_id:
        q = q.where(InventorySerial.warehouse_id == UUID(warehouse_id))
    if status:
        q = q.where(InventorySerial.status == status)
    if search:
        q = q.where(
            (InventorySerial.serial_number.ilike(f"%{search}%"))
            | (InventorySerial.product_name.ilike(f"%{search}%"))
        )
    q = q.order_by(InventorySerial.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/serials", response_model=InventorySerialResponse)
async def create_serial(
    serial_in: InventorySerialCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: AsyncSession = Depends(get_db),
):
    serial = InventorySerial(**serial_in.model_dump(), tenant_id=ctx.tenant_id)
    db.add(serial)
    await db.commit()
    await db.refresh(serial)

    if serial.batch_id:
        ev = TraceabilityEvent(
            event_type="received",
            serial_id=serial.id,
            batch_id=serial.batch_id,
            destination_location=serial.warehouse_name,
            destination_warehouse_id=serial.warehouse_id,
            quantity=1,
            actor_user_id=getattr(ctx, "user", None),
            tenant_id=ctx.tenant_id,
        )
        db.add(ev)
        await db.commit()

    return serial


@router.patch("/serials/{serial_id}", response_model=InventorySerialResponse)
async def update_serial(
    serial_id: str,
    serial_in: InventorySerialUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InventorySerial).where(
            InventorySerial.id == UUID(serial_id),
            InventorySerial.tenant_id == ctx.tenant_id,
        )
    )
    serial = result.scalar_one_or_none()
    if not serial:
        raise HTTPException(status_code=404, detail="Serial not found")
    for k, v in serial_in.model_dump(exclude_unset=True).items():
        setattr(serial, k, v)
    await db.commit()
    await db.refresh(serial)
    return serial


@router.delete("/serials/{serial_id}")
async def delete_serial(
    serial_id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InventorySerial).where(
            InventorySerial.id == UUID(serial_id),
            InventorySerial.tenant_id == ctx.tenant_id,
        )
    )
    serial = result.scalar_one_or_none()
    if not serial:
        raise HTTPException(status_code=404, detail="Serial not found")
    await db.delete(serial)
    await db.commit()
    return {"message": "Serial deleted"}


# ==========================================
# Traceability Events
# ==========================================

@router.get("/traceability/events", response_model=List[TraceabilityEventResponse])
async def list_events(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos", "view:inventory"))],
    db: AsyncSession = Depends(get_db),
    batch_id: str | None = None,
    serial_id: str | None = None,
    event_type: str | None = None,
    limit: int = 100,
):
    q = select(TraceabilityEvent).where(TraceabilityEvent.tenant_id == ctx.tenant_id)
    if batch_id:
        q = q.where(TraceabilityEvent.batch_id == UUID(batch_id))
    if serial_id:
        q = q.where(TraceabilityEvent.serial_id == UUID(serial_id))
    if event_type:
        q = q.where(TraceabilityEvent.event_type == event_type)
    q = q.order_by(TraceabilityEvent.event_at.desc()).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/traceability/events", response_model=TraceabilityEventResponse)
async def create_event(
    event_in: TraceabilityEventCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: AsyncSession = Depends(get_db),
):
    user = getattr(ctx, "user", None)
    ev = TraceabilityEvent(**event_in.model_dump(), actor_user_id=getattr(user, "id", None), tenant_id=ctx.tenant_id)
    db.add(ev)
    await db.commit()
    await db.refresh(ev)
    return ev


@router.get("/traceability/genealogy/{batch_id}")
async def get_batch_genealogy(
    batch_id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos", "view:inventory"))],
    db: AsyncSession = Depends(get_db),
):
    """Returns the full event chain for a batch — forward and backward traceability."""
    batch_uuid = UUID(batch_id)
    result = await db.execute(
        select(InventoryBatch).where(
            InventoryBatch.id == batch_uuid,
            InventoryBatch.tenant_id == ctx.tenant_id,
        )
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    ev_result = await db.execute(
        select(TraceabilityEvent)
        .where(TraceabilityEvent.batch_id == batch_uuid, TraceabilityEvent.tenant_id == ctx.tenant_id)
        .order_by(TraceabilityEvent.event_at.asc())
    )
    events = ev_result.scalars().all()

    ser_result = await db.execute(
        select(InventorySerial).where(
            InventorySerial.batch_id == batch_uuid,
            InventorySerial.tenant_id == ctx.tenant_id,
        )
    )
    serials = ser_result.scalars().all()

    return {
        "batch": {
            "id": str(batch.id),
            "batch_number": batch.batch_number,
            "product_name": batch.product_name,
            "quantity": batch.quantity,
            "remaining_quantity": batch.remaining_quantity,
            "manufacturing_date": str(batch.manufacturing_date) if batch.manufacturing_date else None,
            "expiry_date": str(batch.expiry_date) if batch.expiry_date else None,
            "status": batch.status,
        },
        "events": [
            {
                "id": str(e.id),
                "event_type": e.event_type,
                "source_location": e.source_location,
                "destination_location": e.destination_location,
                "party_type": e.party_type,
                "party_name": e.party_name,
                "reference_document": e.reference_document,
                "quantity": e.quantity,
                "notes": e.notes,
                "event_at": str(e.event_at),
            }
            for e in events
        ],
        "serial_count": len(serials),
        "serials": [
            {
                "id": str(s.id),
                "serial_number": s.serial_number,
                "status": s.status,
                "warehouse_name": s.warehouse_name,
            }
            for s in serials
        ],
    }
