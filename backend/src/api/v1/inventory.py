"""Inventory endpoints — items, stock, wastage, adjustments, transfers, production."""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission, resolve_outlet_id
from src.database.session import get_db
from src.models import (
    InventoryCategory,
    InventoryItem,
    InventoryStock,
    InterOutletTransfer,
    InterOutletTransferLine,
    MovementType,
    ProductionBatch,
    RecipeLine,
    StorageLocation,
    StockAdjustment,
    StockMovement,
    TransferStatus,
    WastageLog,
    WastageReason,
)
from src.schemas.inventory import (
    ConsumptionReport,
    ConsumptionReportRow,
    InventoryCategoryCreate,
    InventoryCategoryResponse,
    InventoryCategoryUpdate,
    InventoryItemCreate,
    InventoryItemResponse,
    InventoryItemUpdate,
    InventoryStockResponse,
    LowStockItem,
    ProductionBatchCreate,
    ProductionBatchResponse,
    StockAdjustRequest,
    StockAdjustmentCreate,
    StockAdjustLine,
    StockAdjustmentCreate,
    StockAdjustmentLineResponse,
    StockAdjustmentResponse,
    StockMovementCreate,
    StockMovementResponse,
    StorageLocationCreate,
    StorageLocationResponse,
    StorageLocationUpdate,
    TransferCreate,
    TransferLineReceive,
    TransferReceiveRequest,
    TransferResponse,
    WastageCreate,
    WastageResponse,
)
from src.services import inventory_service
from src.services.kot_service import _status_value
from src.services.number_series import allocate_number

router = APIRouter(prefix="/inventory", tags=["Inventory"])


def _d(value) -> Decimal:
    return Decimal("0") if value is None else Decimal(str(value))


# ─── Categories ──────────────────────────────────────────────────

@router.get("/categories", response_model=list[InventoryCategoryResponse])
async def list_categories(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    include_inactive: bool = False,
):
    stmt = select(InventoryCategory).where(InventoryCategory.tenant_id == ctx.tenant_id)
    if not include_inactive:
        stmt = stmt.where(InventoryCategory.is_active.is_(True))
    stmt = stmt.order_by(InventoryCategory.name)
    return [
        InventoryCategoryResponse.model_validate(c)
        for c in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/categories", response_model=InventoryCategoryResponse,
             status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: InventoryCategoryCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id, required=False)
    category = InventoryCategory(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return InventoryCategoryResponse.model_validate(category)


@router.put("/categories/{category_id}", response_model=InventoryCategoryResponse)
async def update_category(
    category_id: uuid.UUID,
    payload: InventoryCategoryUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    category = await db.scalar(
        select(InventoryCategory).where(
            InventoryCategory.id == category_id, InventoryCategory.tenant_id == ctx.tenant_id
        )
    )
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    await db.commit()
    await db.refresh(category)
    return InventoryCategoryResponse.model_validate(category)


# ─── Storage locations ───────────────────────────────────────────

@router.get("/locations", response_model=list[StorageLocationResponse])
async def list_locations(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
):
    resolve_outlet_id(ctx, outlet_id)
    stmt = (
        select(StorageLocation)
        .where(
            StorageLocation.tenant_id == ctx.tenant_id,
            StorageLocation.outlet_id == outlet_id,
        )
        .order_by(StorageLocation.name)
    )
    return [
        StorageLocationResponse.model_validate(l)
        for l in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/locations", response_model=StorageLocationResponse,
             status_code=status.HTTP_201_CREATED)
async def create_location(
    payload: StorageLocationCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id)
    location = StorageLocation(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(location)
    await db.commit()
    await db.refresh(location)
    return StorageLocationResponse.model_validate(location)


@router.put("/locations/{location_id}", response_model=StorageLocationResponse)
async def update_location(
    location_id: uuid.UUID,
    payload: StorageLocationUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    location = await db.scalar(
        select(StorageLocation).where(
            StorageLocation.id == location_id, StorageLocation.tenant_id == ctx.tenant_id
        )
    )
    if location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    resolve_outlet_id(ctx, location.outlet_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(location, field, value)
    await db.commit()
    await db.refresh(location)
    return StorageLocationResponse.model_validate(location)


# ─── Items ───────────────────────────────────────────────────────

@router.get("/items", response_model=list[InventoryItemResponse])
async def list_items(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    search: str | None = None,
    include_inactive: bool = False,
    limit: int = 200,
    offset: int = 0,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(InventoryItem).where(InventoryItem.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(InventoryItem.outlet_id == outlet_id)
    if not include_inactive:
        stmt = stmt.where(InventoryItem.is_active.is_(True))
    if search:
        stmt = stmt.where(
            InventoryItem.name.ilike(f"%{search}%")
            | InventoryItem.code.ilike(f"%{search}%")
        )
    stmt = stmt.order_by(InventoryItem.name).limit(limit).offset(offset)
    return [
        InventoryItemResponse.model_validate(i)
        for i in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/items", response_model=InventoryItemResponse,
             status_code=status.HTTP_201_CREATED)
async def create_item(
    payload: InventoryItemCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id, required=False)

    item = InventoryItem(
        tenant_id=ctx.tenant_id,
        code=await allocate_number(db, ctx.tenant_id, "inventory_item", payload.outlet_id),
        **payload.model_dump(),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return InventoryItemResponse.model_validate(item)


@router.get("/items/{item_id}", response_model=InventoryItemResponse)
async def get_item(
    item_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = await db.scalar(
        select(InventoryItem).where(
            InventoryItem.id == item_id, InventoryItem.tenant_id == ctx.tenant_id
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    if item.outlet_id:
        resolve_outlet_id(ctx, item.outlet_id)
    return InventoryItemResponse.model_validate(item)


@router.put("/items/{item_id}", response_model=InventoryItemResponse)
async def update_item(
    item_id: uuid.UUID,
    payload: InventoryItemUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = await db.scalar(
        select(InventoryItem).where(
            InventoryItem.id == item_id, InventoryItem.tenant_id == ctx.tenant_id
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    if item.outlet_id:
        resolve_outlet_id(ctx, item.outlet_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return InventoryItemResponse.model_validate(item)


# ─── Stock ───────────────────────────────────────────────────────

@router.get("/stock", response_model=list[InventoryStockResponse])
async def list_stock(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
    low_stock_only: bool = False,
):
    resolve_outlet_id(ctx, outlet_id)
    stmt = (
        select(InventoryStock)
        .join(InventoryItem, InventoryStock.inventory_item_id == InventoryItem.id)
        .where(
            InventoryStock.tenant_id == ctx.tenant_id,
            InventoryStock.outlet_id == outlet_id,
        )
        .order_by(InventoryItem.name)
    )
    stocks = (await db.execute(stmt)).scalars().all()

    if low_stock_only:
        # Filter against each item's own reorder level
        items = {
            i.id: i
            for i in (
                await db.execute(
                    select(InventoryItem).where(InventoryItem.tenant_id == ctx.tenant_id)
                )
            ).scalars().all()
        }
        stocks = [
            s for s in stocks
            if (items.get(s.inventory_item_id).reorder_level or 0) >= _d(s.qty_on_hand)
            if items.get(s.inventory_item_id)
        ]

    return [InventoryStockResponse.model_validate(s) for s in stocks]


@router.get("/low-stock", response_model=list[LowStockItem])
async def low_stock(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
):
    """The purchase-request feed: everything at or below reorder level."""
    resolve_outlet_id(ctx, outlet_id)
    rows = await inventory_service.low_stock_items(db, ctx.tenant_id, outlet_id)

    return [
        LowStockItem(
            inventory_item_id=item.id,
            name=item.name,
            code=item.code,
            qty_available=float(on_hand),
            reorder_level=float(_d(item.reorder_level)),
            reorder_qty=float(_d(item.reorder_qty)),
            uom_id=item.uom_id,
        )
        for item, on_hand in rows
    ]


@router.post("/stock/adjust", response_model=StockAdjustmentResponse,
             status_code=status.HTTP_201_CREATED)
async def quick_adjust_stock(
    payload: StockAdjustRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
):
    """Single-item count correction, posted straight to the ledger."""
    resolve_outlet_id(ctx, outlet_id)

    request = StockAdjustmentCreate(
        outlet_id=outlet_id,
        reason=payload.reason,
        lines=[StockAdjustLine(
            inventory_item_id=payload.inventory_item_id,
            location_id=payload.location_id,
            counted_qty=payload.counted_qty,
            unit_cost=payload.unit_cost,
        )],
    )
    try:
        adjustment = await inventory_service.adjust_stock(
            db, ctx.tenant_id, outlet_id, request, user_id=ctx.user_id
        )
        await inventory_service.approve_adjustment(
            db, ctx.tenant_id, outlet_id, adjustment.id, approved_by=ctx.user_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    # db.refresh() doesn't populate relationships; re-fetch with lines loaded
    # so serializing StockAdjustmentResponse.lines doesn't lazy-load.
    adjustment_id = adjustment.id
    adjustment = (
        await db.execute(
            select(StockAdjustment)
            .options(selectinload(StockAdjustment.lines))
            .where(
                StockAdjustment.id == adjustment_id,
                StockAdjustment.tenant_id == ctx.tenant_id,
            )
        )
    ).scalar_one()
    return StockAdjustmentResponse.model_validate(adjustment)


@router.post("/stock/movements", response_model=StockMovementResponse,
             status_code=status.HTTP_201_CREATED)
async def create_movement(
    payload: StockMovementCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Manual ledger entry — opening stock or an unrecorded correction."""
    resolve_outlet_id(ctx, payload.outlet_id)
    try:
        movement = await inventory_service._apply_movement(
            db,
            tenant_id=ctx.tenant_id,
            outlet_id=payload.outlet_id,
            inventory_item_id=payload.inventory_item_id,
            location_id=payload.location_id,
            movement_type=payload.movement_type,
            qty=_d(payload.qty),
            unit_cost=_d(payload.unit_cost),
            reference_type=payload.reference_type,
            reference_id=payload.reference_id,
            notes=payload.notes,
            created_by=ctx.user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    await db.refresh(movement)
    return StockMovementResponse.model_validate(movement)


@router.get("/stock/movements", response_model=list[StockMovementResponse])
async def list_movements(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
    inventory_item_id: uuid.UUID | None = None,
    movement_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 200,
    offset: int = 0,
):
    resolve_outlet_id(ctx, outlet_id)
    stmt = select(StockMovement).where(
        StockMovement.tenant_id == ctx.tenant_id, StockMovement.outlet_id == outlet_id
    )
    if inventory_item_id:
        stmt = stmt.where(StockMovement.inventory_item_id == inventory_item_id)
    if movement_type:
        stmt = stmt.where(StockMovement.movement_type == movement_type)
    if date_from:
        stmt = stmt.where(StockMovement.created_at >= date_from)
    if date_to:
        stmt = stmt.where(StockMovement.created_at <= date_to + "T23:59:59")
    stmt = stmt.order_by(StockMovement.created_at.desc()).limit(limit).offset(offset)

    return [
        StockMovementResponse.model_validate(m)
        for m in (await db.execute(stmt)).scalars().all()
    ]


# ─── Wastage ─────────────────────────────────────────────────────

@router.post("/wastage", response_model=WastageResponse, status_code=status.HTTP_201_CREATED)
async def log_wastage(
    payload: WastageCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Record spoilage/overprep — stock is deducted immediately."""
    resolve_outlet_id(ctx, payload.outlet_id)
    try:
        wastage = await inventory_service.log_wastage(
            db, ctx.tenant_id, payload.outlet_id, payload, user_id=ctx.user_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    await db.refresh(wastage)
    return WastageResponse.model_validate(wastage)


@router.get("/wastage", response_model=list[WastageResponse])
async def list_wastage(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 200,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(WastageLog).where(WastageLog.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(WastageLog.outlet_id == outlet_id)
    if date_from:
        stmt = stmt.where(WastageLog.created_at >= date_from)
    if date_to:
        stmt = stmt.where(WastageLog.created_at <= date_to + "T23:59:59")
    stmt = stmt.order_by(WastageLog.created_at.desc()).limit(limit)
    return [
        WastageResponse.model_validate(w)
        for w in (await db.execute(stmt)).scalars().all()
    ]


# ─── Stock adjustments ───────────────────────────────────────────

@router.post("/adjustments", response_model=StockAdjustmentResponse,
             status_code=status.HTTP_201_CREATED)
async def create_adjustment(
    payload: StockAdjustmentCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Full cycle count — drafted here, posted on approval."""
    resolve_outlet_id(ctx, payload.outlet_id)
    try:
        adjustment = await inventory_service.adjust_stock(
            db, ctx.tenant_id, payload.outlet_id, payload, user_id=ctx.user_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    # db.refresh() doesn't populate relationships; re-fetch with lines loaded
    # so serializing StockAdjustmentResponse.lines doesn't lazy-load.
    adjustment_id = adjustment.id
    adjustment = (
        await db.execute(
            select(StockAdjustment)
            .options(selectinload(StockAdjustment.lines))
            .where(
                StockAdjustment.id == adjustment_id,
                StockAdjustment.tenant_id == ctx.tenant_id,
            )
        )
    ).scalar_one()
    return StockAdjustmentResponse.model_validate(adjustment)


@router.get("/adjustments", response_model=list[StockAdjustmentResponse])
async def list_adjustments(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    limit: int = 100,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = (
        select(StockAdjustment)
        .options(selectinload(StockAdjustment.lines))
        .where(StockAdjustment.tenant_id == ctx.tenant_id)
    )
    if outlet_id:
        stmt = stmt.where(StockAdjustment.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(StockAdjustment.status == status_filter)
    stmt = stmt.order_by(StockAdjustment.created_at.desc()).limit(limit)

    return [
        StockAdjustmentResponse.model_validate(a)
        for a in (await db.execute(stmt)).unique().scalars().all()
    ]


@router.post("/adjustments/{adjustment_id}/approve", response_model=StockAdjustmentResponse)
async def approve_adjustment(
    adjustment_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("adjust:stock"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Post the counted variances to the stock ledger."""
    adjustment = await db.scalar(
        select(StockAdjustment).where(
            StockAdjustment.id == adjustment_id,
            StockAdjustment.tenant_id == ctx.tenant_id,
        )
    )
    if adjustment is None:
        raise HTTPException(status_code=404, detail="Adjustment not found")
    resolve_outlet_id(ctx, adjustment.outlet_id)

    # An operator who did not raise the count must approve it
    if adjustment.created_by == ctx.user_id:
        raise HTTPException(
            status_code=403,
            detail="You cannot approve your own stock count — ask an operator",
        )

    try:
        adjustment = await inventory_service.approve_adjustment(
            db, ctx.tenant_id, adjustment.outlet_id, adjustment_id,
            approved_by=ctx.user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    # db.refresh() doesn't populate relationships; re-fetch with lines loaded
    # so serializing StockAdjustmentResponse.lines doesn't lazy-load.
    adjustment_id = adjustment.id
    adjustment = (
        await db.execute(
            select(StockAdjustment)
            .options(selectinload(StockAdjustment.lines))
            .where(
                StockAdjustment.id == adjustment_id,
                StockAdjustment.tenant_id == ctx.tenant_id,
            )
        )
    ).scalar_one()
    return StockAdjustmentResponse.model_validate(adjustment)


# ─── Transfers ───────────────────────────────────────────────────

@router.post("/transfers", response_model=TransferResponse,
             status_code=status.HTTP_201_CREATED)
async def create_transfer(
    payload: TransferCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.from_outlet_id)
    resolve_outlet_id(ctx, payload.to_outlet_id)

    try:
        transfer = await inventory_service.create_transfer(
            db, ctx.tenant_id, payload, user_id=ctx.user_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    # refresh() doesn't populate relationships — re-fetch with lines loaded
    transfer_id = transfer.id
    transfer = (
        await db.execute(
            select(InterOutletTransfer)
            .options(selectinload(InterOutletTransfer.lines))
            .where(
                InterOutletTransfer.id == transfer_id,
                InterOutletTransfer.tenant_id == ctx.tenant_id,
            )
        )
    ).scalar_one()
    return TransferResponse.model_validate(transfer)


@router.get("/transfers", response_model=list[TransferResponse])
async def list_transfers(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    limit: int = 100,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = (
        select(InterOutletTransfer)
        .options(selectinload(InterOutletTransfer.lines))
        .where(InterOutletTransfer.tenant_id == ctx.tenant_id)
    )
    if outlet_id:
        stmt = stmt.where(
            (InterOutletTransfer.from_outlet_id == outlet_id)
            | (InterOutletTransfer.to_outlet_id == outlet_id)
        )
    if status_filter:
        stmt = stmt.where(InterOutletTransfer.status == status_filter)
    stmt = stmt.order_by(InterOutletTransfer.created_at.desc()).limit(limit)

    return [
        TransferResponse.model_validate(t)
        for t in (await db.execute(stmt)).unique().scalars().all()
    ]


@router.post("/transfers/{transfer_id}/dispatch", response_model=TransferResponse)
async def dispatch_transfer(
    transfer_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Deduct stock from the source outlet and mark it in transit."""
    transfer = await db.scalar(
        select(InterOutletTransfer).where(
            InterOutletTransfer.id == transfer_id,
            InterOutletTransfer.tenant_id == ctx.tenant_id,
        )
    )
    if transfer is None:
        raise HTTPException(status_code=404, detail="Transfer not found")
    resolve_outlet_id(ctx, transfer.from_outlet_id)

    try:
        transfer = await inventory_service.dispatch_transfer(
            db, ctx.tenant_id, transfer_id, user_id=ctx.user_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    # refresh() doesn't populate relationships — re-fetch with lines loaded
    transfer_id = transfer.id
    transfer = (
        await db.execute(
            select(InterOutletTransfer)
            .options(selectinload(InterOutletTransfer.lines))
            .where(
                InterOutletTransfer.id == transfer_id,
                InterOutletTransfer.tenant_id == ctx.tenant_id,
            )
        )
    ).scalar_one()
    return TransferResponse.model_validate(transfer)


@router.post("/transfers/{transfer_id}/receive", response_model=TransferResponse)
async def receive_transfer(
    transfer_id: uuid.UUID,
    payload: TransferReceiveRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Receive at the destination — any shortfall is recorded as a variance."""
    transfer = await db.scalar(
        select(InterOutletTransfer).where(
            InterOutletTransfer.id == transfer_id,
            InterOutletTransfer.tenant_id == ctx.tenant_id,
        )
    )
    if transfer is None:
        raise HTTPException(status_code=404, detail="Transfer not found")
    resolve_outlet_id(ctx, transfer.to_outlet_id)

    for line in payload.lines:
        db_line = await db.scalar(
            select(InterOutletTransferLine).where(
                InterOutletTransferLine.id == line.line_id,
                InterOutletTransferLine.transfer_id == transfer.id,
            )
        )
        if db_line is None:
            raise HTTPException(
                status_code=404, detail=f"Transfer line {line.line_id} not found"
            )
        if _d(line.received_qty) > _d(db_line.qty):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot receive more than the {db_line.qty} sent",
            )
        db_line.received_qty = float(_d(line.received_qty))

    try:
        transfer = await inventory_service.receive_transfer(
            db, ctx.tenant_id, transfer_id, user_id=ctx.user_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    # refresh() doesn't populate relationships — re-fetch with lines loaded
    transfer_id = transfer.id
    transfer = (
        await db.execute(
            select(InterOutletTransfer)
            .options(selectinload(InterOutletTransfer.lines))
            .where(
                InterOutletTransfer.id == transfer_id,
                InterOutletTransfer.tenant_id == ctx.tenant_id,
            )
        )
    ).scalar_one()
    return TransferResponse.model_validate(transfer)


# ─── Production ──────────────────────────────────────────────────

@router.post("/production", response_model=ProductionBatchResponse,
             status_code=status.HTTP_201_CREATED)
async def create_production_batch(
    payload: ProductionBatchCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Batch prep (dough, gravy, marinade) — consumes ingredients, yields stock."""
    resolve_outlet_id(ctx, payload.outlet_id)

    from src.models import Recipe
    recipe = await db.scalar(
        select(Recipe)
        .options(selectinload(Recipe.lines))
        .where(
            Recipe.id == payload.recipe_id,
            Recipe.tenant_id == ctx.tenant_id,
        )
    ) if payload.recipe_id else None

    if payload.recipe_id and recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    batch = ProductionBatch(
        tenant_id=ctx.tenant_id,
        outlet_id=payload.outlet_id,
        recipe_id=payload.recipe_id,
        batch_number=await allocate_number(db, ctx.tenant_id, "production", payload.outlet_id),
        produced_qty=float(_d(payload.produced_qty)),
        uom_id=payload.uom_id,
        produced_at=datetime.now(timezone.utc).isoformat(),
        produced_by=ctx.user_id,
        expiry_at=payload.expiry_at,
        cost=float(_d(payload.cost)),
    )
    db.add(batch)
    await db.flush()

    # Consume the recipe's ingredients for this batch
    if recipe and recipe.lines:
        for line in recipe.lines:
            if not line.inventory_item_id:
                continue
            try:
                await inventory_service._apply_movement(
                    db,
                    tenant_id=ctx.tenant_id,
                    outlet_id=payload.outlet_id,
                    inventory_item_id=line.inventory_item_id,
                    location_id=None,
                    movement_type=MovementType.CONSUMPTION,
                    qty=_d(line.qty) * _d(payload.produced_qty),
                    reference_type="production",
                    reference_id=batch.batch_number,
                    notes=f"Batch prep for {recipe.name}",
                    created_by=ctx.user_id,
                )
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    await db.refresh(batch)
    return ProductionBatchResponse.model_validate(batch)


@router.get("/production", response_model=list[ProductionBatchResponse])
async def list_production_batches(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    limit: int = 100,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(ProductionBatch).where(ProductionBatch.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(ProductionBatch.outlet_id == outlet_id)
    stmt = stmt.order_by(ProductionBatch.created_at.desc()).limit(limit)
    return [
        ProductionBatchResponse.model_validate(b)
        for b in (await db.execute(stmt)).scalars().all()
    ]


# ─── Consumption report ──────────────────────────────────────────

@router.get("/consumption", response_model=ConsumptionReport)
async def consumption_report(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:reports"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
    date_from: date,
    date_to: date,
):
    """What the kitchen actually used over a window, valued at movement cost."""
    resolve_outlet_id(ctx, outlet_id)

    movements = (
        await db.execute(
            select(StockMovement).where(
                StockMovement.tenant_id == ctx.tenant_id,
                StockMovement.outlet_id == outlet_id,
                StockMovement.movement_type == MovementType.CONSUMPTION,
                func.date(StockMovement.created_at) >= date_from,
                func.date(StockMovement.created_at) <= date_to,
            )
        )
    ).scalars().all()

    items = {
        i.id: i
        for i in (
            await db.execute(
                select(InventoryItem).where(InventoryItem.tenant_id == ctx.tenant_id)
            )
        ).scalars().all()
    }

    totals: dict[uuid.UUID, tuple[Decimal, Decimal]] = {}
    for movement in movements:
        qty, cost = totals.get(movement.inventory_item_id, (Decimal("0"), Decimal("0")))
        qty += _d(movement.qty)
        cost += _d(movement.qty) * _d(movement.unit_cost)
        totals[movement.inventory_item_id] = (qty, cost)

    rows = [
        ConsumptionReportRow(
            inventory_item_id=item_id,
            item_name=items[item_id].name if item_id in items else "Unknown",
            total_consumed=float(qty),
            total_cost=float(cost.quantize(Decimal("0.01"))),
            uom_id=items[item_id].uom_id if item_id in items else None,
        )
        for item_id, (qty, cost) in totals.items()
    ]

    return ConsumptionReport(
        outlet_id=outlet_id,
        date_from=date_from,
        date_to=date_to,
        rows=rows,
        total_cost=float(sum((r.total_cost for r in rows), Decimal("0"))),
    )
