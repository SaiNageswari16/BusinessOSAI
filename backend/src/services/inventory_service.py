"""Inventory service — stock ledger, consumption, wastage, adjustments.

All quantity changes go through `_apply_movement`, which is the only writer of
InventoryStock. Every movement appends a StockMovement row so the ledger is
append-only and auditable.

Sign are explicit: PURCHASE / TRANSFER_IN / PRODUCTION / OPENING raise stock,
CONSUMPTION / WASTAGE / TRANSFER_OUT / ADJUSTMENT lower it.
"""
import uuid
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models import (
    AdjustmentStatus,
    InventoryItem,
    InventoryStock,
    MovementType,
    StockAdjustment,
    StockAdjustmentLine,
    StockMovement,
    TransferStatus,
    InterOutletTransfer,
    InterOutletTransferLine,
    WastageLog,
)
from src.schemas.inventory import (
    StockAdjustLine,
    StockAdjustmentCreate,
    StockAdjustRequest,
    StockMovementCreate,
    TransferCreate,
    TransferLineIn,
    WastageCreate,
)
from src.services.number_series import allocate_number

FOUR_PLACES = Decimal("0.0001")


def _d(value) -> Decimal:
    return Decimal("0") if value is None else Decimal(str(value))


def _q(value: Decimal) -> Decimal:
    return value.quantize(FOUR_PLACES)


def _status_str(value) -> str:
    return value.value if hasattr(value, "value") else str(value or "")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _get_stock_row(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    inventory_item_id: uuid.UUID,
    location_id: uuid.UUID | None,
) -> InventoryStock:
    """Fetch the stock row for an item/location, creating it on first touch."""
    stmt = select(InventoryStock).where(
        InventoryStock.tenant_id == tenant_id,
        InventoryStock.outlet_id == outlet_id,
        InventoryStock.inventory_item_id == inventory_item_id,
        InventoryStock.location_id == location_id
        if location_id is not None
        else InventoryStock.location_id.is_(None),
    )
    stock = (await db.execute(stmt)).scalars().first()

    if stock is None:
        stock = InventoryStock(
            tenant_id=tenant_id,
            outlet_id=outlet_id,
            inventory_item_id=inventory_item_id,
            location_id=location_id,
            qty_on_hand=0,
            qty_reserved=0,
            qty_available=0,
            avg_cost=0,
            last_cost=0,
        )
        db.add(stock)
        await db.flush()

    return stock


def _recompute_available(stock: InventoryStock) -> None:
    stock.qty_available = _q(_d(stock.qty_on_hand) - _d(stock.qty_reserved))


async def _apply_movement(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    inventory_item_id: uuid.UUID,
    location_id: uuid.UUID | None,
    movement_type: MovementType,
    qty: Decimal,
    unit_cost: Decimal = Decimal("0"),
    reference_type: str | None = None,
    reference_id: str | None = None,
    batch_id: uuid.UUID | None = None,
    notes: str | None = None,
    created_by: uuid.UUID | None = None,
) -> StockMovement:
    """The single writer of InventoryStock. Signed movements, append-only ledger."""
    item = await db.scalar(
        select(InventoryItem).where(
            InventoryItem.id == inventory_item_id,
            InventoryItem.tenant_id == tenant_id,
        )
    )
    if item is None:
        raise ValueError("Inventory item not found")

    signed_qty = _d(qty)
    if movement_type in (
        MovementType.CONSUMPTION,
        MovementType.WASTAGE,
        MovementType.TRANSFER_OUT,
        MovementType.ADJUSTMENT,
    ):
        signed_qty = -abs(signed_qty)
    else:
        signed_qty = abs(signed_qty)

    stock = await _get_stock_row(
        db, tenant_id, outlet_id, inventory_item_id, location_id
    )

    # Negative stock is only allowed when the item explicitly permits it
    projected = _d(stock.qty_on_hand) + signed_qty
    if projected < 0 and not item.allow_negative_stock:
        raise ValueError(
            f"{item.name}: not enough stock on hand "
            f"({stock.qty_on_hand}, short by {abs(projected)})"
        )

    # Weighted-average cost on inward movements
    if signed_qty > 0:
        cost = _d(unit_cost)
        existing_value = _d(stock.qty_on_hand) * _d(stock.avg_cost)
        new_value = existing_value + signed_qty * cost
        new_qty = _d(stock.qty_on_hand) + signed_qty
        stock.avg_cost = float(new_value / new_qty) if new_qty > 0 else float(cost)
        stock.last_cost = float(cost)

    stock.qty_on_hand = float(_q(projected))
    _recompute_available(stock)

    movement = StockMovement(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        inventory_item_id=inventory_item_id,
        location_id=location_id,
        movement_type=movement_type,
        qty=float(_q(signed_qty)),
        uom_id=item.uom_id,
        unit_cost=float(_d(unit_cost)),
        reference_type=reference_type,
        reference_id=reference_id,
        batch_id=batch_id,
        notes=notes,
        created_by=created_by,
    )
    db.add(movement)
    return movement


# ─── Items & stock ───────────────────────────────────────────────

async def list_stock(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID
) -> list[InventoryStock]:
    stmt = (
        select(InventoryStock)
        .join(InventoryItem, InventoryStock.inventory_item_id == InventoryItem.id)
        .options(
            selectinload(InventoryStock.item).selectinload(InventoryItem.uom),
        )
        .where(InventoryStock.tenant_id == tenant_id, InventoryStock.outlet_id == outlet_id)
    )
    return list((await db.execute(stmt)).scalars().all())


async def low_stock_items(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID
) -> list[tuple[InventoryItem, Decimal]]:
    """Items at or below their reorder level — the purchase-request feed."""
    stmt = (
        select(InventoryItem)
        .options(selectinload(InventoryItem.stocks), selectinload(InventoryItem.uom))
        .where(
            InventoryItem.tenant_id == tenant_id,
            InventoryItem.is_active.is_(True),
            InventoryItem.track_stock.is_(True),
        )
    )
    items = (await db.execute(stmt)).scalars().all()

    result: list[tuple[InventoryItem, Decimal]] = []
    for item in items:
        if item.outlet_id and item.outlet_id != outlet_id:
            continue
        on_hand = sum((_d(s.qty_on_hand) for s in item.stocks or []), Decimal("0"))
        if _d(item.reorder_level) > 0 and on_hand <= _d(item.reorder_level):
            result.append((item, on_hand))

    return result


async def adjust_stock(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    payload: StockAdjustmentCreate,
    *,
    user_id: uuid.UUID | None = None,
) -> StockAdjustment:
    """Physical count / cycle count. Approved adjustments move the stock."""
    if not payload.lines:
        raise ValueError("A stock adjustment needs at least one line")

    adjustment = StockAdjustment(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        adjustment_number=await allocate_number(db, tenant_id, "stock_adjustment", outlet_id),
        reason=payload.reason,
        status=AdjustmentStatus.DRAFT,
        created_by=user_id,
    )
    db.add(adjustment)
    await db.flush()

    total_variance_qty = Decimal("0")
    total_variance_value = Decimal("0")

    for line in payload.lines:
        stock = await _get_stock_row(
            db, tenant_id, outlet_id, line.inventory_item_id, line.location_id
        )
        system_qty = _d(stock.qty_on_hand)
        counted = _d(line.counted_qty)
        variance = _q(counted - system_qty)

        db.add(StockAdjustmentLine(
            tenant_id=tenant_id,
            adjustment_id=adjustment.id,
            inventory_item_id=line.inventory_item_id,
            location_id=line.location_id,
            system_qty=float(system_qty),
            counted_qty=float(counted),
            variance_qty=float(variance),
            unit_cost=float(_d(stock.avg_cost)),
        ))

        total_variance_qty += variance
        total_variance_value += variance * _d(stock.avg_cost)

    adjustment.variance_qty = float(_q(total_variance_qty))
    adjustment.variance_value = float(
        total_variance_value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    )
    await db.flush()
    return adjustment


async def approve_adjustment(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    adjustment_id: uuid.UUID,
    *,
    approved_by: uuid.UUID | None = None,
) -> StockAdjustment:
    """Post an approved count to the stock ledger."""
    adjustment = (
        await db.execute(
            select(StockAdjustment)
            .options(selectinload(StockAdjustment.lines))
            .where(
                StockAdjustment.id == adjustment_id,
                StockAdjustment.tenant_id == tenant_id,
            )
        )
    ).scalars().first()
    if adjustment is None:
        raise ValueError("Stock adjustment not found")
    if adjustment.status != AdjustmentStatus.DRAFT:
        raise ValueError(f"This adjustment is already {adjustment.status}")

    for line in adjustment.lines or []:
        if _d(line.variance_qty) == 0:
            continue
        await _apply_movement(
            db,
            tenant_id=tenant_id,
            outlet_id=outlet_id,
            inventory_item_id=line.inventory_item_id,
            location_id=line.location_id,
            movement_type=MovementType.ADJUSTMENT,
            qty=_d(line.variance_qty),
            unit_cost=_d(line.unit_cost),
            reference_type="stock_adjustment",
            reference_id=adjustment.adjustment_number,
            notes=adjustment.reason,
            created_by=approved_by,
        )

    adjustment.status = AdjustmentStatus.APPROVED
    adjustment.approved_by = approved_by
    adjustment.approved_at = _now_iso()
    await db.flush()
    return adjustment


async def log_wastage(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    payload: WastageCreate,
    *,
    user_id: uuid.UUID | None = None,
) -> WastageLog:
    """Record spoilage/overprep and deduct it from stock."""
    if not payload.inventory_item_id and not payload.menu_item_id:
        raise ValueError("Wastage must reference an inventory item or a menu item")

    item = None
    if payload.inventory_item_id:
        item = await db.scalar(
            select(InventoryItem).where(
                InventoryItem.id == payload.inventory_item_id,
                InventoryItem.tenant_id == tenant_id,
            )
        )

    # The caller may supply a cost, otherwise derive it from the item's standard cost
    if payload.cost is not None:
        cost = _d(payload.cost)
    else:
        cost = _d(item.standard_cost) * _d(payload.qty) if item else Decimal("0")

    wastage = WastageLog(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        wastage_number=await allocate_number(db, tenant_id, "wastage", outlet_id),
        inventory_item_id=payload.inventory_item_id,
        menu_item_id=payload.menu_item_id,
        qty=float(_d(payload.qty)),
        uom_id=payload.uom_id,
        reason=payload.reason,
        cost=float(cost.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        notes=payload.notes,
        logged_by=user_id,
    )
    db.add(wastage)
    await db.flush()

    if payload.inventory_item_id and item is not None:
        location_id = item.default_location_id
        unit_cost = (
            _d(payload.cost) / _d(payload.qty)
            if payload.cost is not None
            else _d(item.standard_cost)
        )
        await _apply_movement(
            db,
            tenant_id=tenant_id,
            outlet_id=outlet_id,
            inventory_item_id=payload.inventory_item_id,
            location_id=location_id,
            movement_type=MovementType.WASTAGE,
            qty=_d(payload.qty),
            unit_cost=unit_cost,
            reference_type="wastage",
            reference_id=wastage.wastage_number,
            notes=payload.notes or _status_str(payload.reason),
            created_by=user_id,
        )

    await db.flush()
    return wastage


async def create_transfer(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    payload: TransferCreate,
    *,
    user_id: uuid.UUID | None = None,
) -> InterOutletTransfer:
    """Kitchen-to-kitchen transfer: move stock out on dispatch."""
    if payload.from_outlet_id == payload.to_outlet_id:
        raise ValueError("Source and destination outlets must differ")
    if not payload.lines:
        raise ValueError("A transfer needs at least one line")

    transfer = InterOutletTransfer(
        tenant_id=tenant_id,
        from_outlet_id=payload.from_outlet_id,
        to_outlet_id=payload.to_outlet_id,
        transfer_number=await allocate_number(db, tenant_id, "transfer", payload.from_outlet_id),
        status=TransferStatus.DRAFT,
        notes=payload.notes,
    )
    db.add(transfer)
    await db.flush()

    for line in payload.lines:
        db.add(InterOutletTransferLine(
            tenant_id=tenant_id,
            transfer_id=transfer.id,
            inventory_item_id=line.inventory_item_id,
            qty=float(_d(line.qty)),
            uom_id=line.uom_id,
        ))

    await db.flush()
    return transfer


async def dispatch_transfer(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    transfer_id: uuid.UUID,
    *,
    user_id: uuid.UUID | None = None,
) -> InterOutletTransfer:
    """Deduct stock from the source outlet and mark the transfer in transit."""
    transfer = (
        await db.execute(
            select(InterOutletTransfer)
            .options(selectinload(InterOutletTransfer.lines))
            .where(
                InterOutletTransfer.id == transfer_id,
                InterOutletTransfer.tenant_id == tenant_id,
            )
        )
    ).scalars().first()
    if transfer is None:
        raise ValueError("Transfer not found")
    if transfer.status != TransferStatus.DRAFT:
        raise ValueError(f"This transfer is already {transfer.status}")

    for line in transfer.lines or []:
        await _apply_movement(
            db,
            tenant_id=tenant_id,
            outlet_id=transfer.from_outlet_id,
            inventory_item_id=line.inventory_item_id,
            location_id=None,
            movement_type=MovementType.TRANSFER_OUT,
            qty=_d(line.qty),
            reference_type="transfer",
            reference_id=transfer.transfer_number,
            notes=f"Transfer to {transfer.to_outlet_id}",
            created_by=user_id,
        )
        line.sent_qty = float(_d(line.qty))

    transfer.status = TransferStatus.IN_TRANSIT
    transfer.dispatched_at = _now_iso()
    await db.flush()
    return transfer


async def receive_transfer(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    transfer_id: uuid.UUID,
    *,
    user_id: uuid.UUID | None = None,
) -> InterOutletTransfer:
    """Add the received quantities to the destination outlet's stock."""
    transfer = (
        await db.execute(
            select(InterOutletTransfer)
            .options(selectinload(InterOutletTransfer.lines))
            .where(
                InterOutletTransfer.id == transfer_id,
                InterOutletTransfer.tenant_id == tenant_id,
            )
        )
    ).scalars().first()
    if transfer is None:
        raise ValueError("Transfer not found")
    if transfer.status != TransferStatus.IN_TRANSIT:
        raise ValueError(f"This transfer is {transfer.status}, not in transit")

    for line in transfer.lines or []:
        received = _d(line.received_qty) if line.received_qty else _d(line.qty)
        line.variance_qty = float(_q(_d(line.sent_qty) - received))

        item = await db.scalar(
            select(InventoryItem).where(InventoryItem.id == line.inventory_item_id)
        )
        await _apply_movement(
            db,
            tenant_id=tenant_id,
            outlet_id=transfer.to_outlet_id,
            inventory_item_id=line.inventory_item_id,
            location_id=None,
            movement_type=MovementType.TRANSFER_IN,
            qty=received,
            unit_cost=_d(item.standard_cost) if item else Decimal("0"),
            reference_type="transfer",
            reference_id=transfer.transfer_number,
            notes=f"Transfer from {transfer.from_outlet_id}",
            created_by=user_id,
        )

    transfer.status = TransferStatus.RECEIVED
    transfer.received_at = _now_iso()
    transfer.received_by = user_id
    await db.flush()
    return transfer


async def consume_recipe(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    order_item_id: uuid.UUID,
    menu_item_id: uuid.UUID,
    qty: Decimal,
    *,
    user_id: uuid.UUID | None = None,
) -> list[StockMovement]:
    """Deduct a menu item's recipe ingredients — called when an item is served."""
    from src.models import RecipeLine, MenuItem

    menu_item = await db.scalar(
        select(MenuItem)
        .options(selectinload(MenuItem.recipe_lines))
        .where(MenuItem.id == menu_item_id, MenuItem.tenant_id == tenant_id)
    )
    if menu_item is None or not menu_item.recipe_lines:
        return []

    movements: list[StockMovement] = []
    for line in menu_item.recipe_lines:
        if not line.inventory_item_id:
            continue
        # Recipe qty is per 1 unit; scale by the ordered quantity
        qty_to_consume = _d(line.qty) * _d(qty)
        movements.append(await _apply_movement(
            db,
            tenant_id=tenant_id,
            outlet_id=outlet_id,
            inventory_item_id=line.inventory_item_id,
            location_id=line.location_id,
            movement_type=MovementType.CONSUMPTION,
            qty=qty_to_consume,
            reference_type="order_item",
            reference_id=str(order_item_id),
            notes=f"Auto-consumed for {menu_item.name}",
            created_by=user_id,
        ))

    return movements


async def record_opening_stock(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    lines: list[StockAdjustLine],
    *,
    user_id: uuid.UUID | None = None,
) -> None:
    """Set the starting on-hand for each item at go-live or season start."""
    for line in lines:
        await _apply_movement(
            db,
            tenant_id=tenant_id,
            outlet_id=outlet_id,
            inventory_item_id=line.inventory_item_id,
            location_id=line.location_id,
            movement_type=MovementType.OPENING,
            qty=_d(line.counted_qty),
            reference_type="opening_stock",
            notes="Opening balance",
            created_by=user_id,
        )
