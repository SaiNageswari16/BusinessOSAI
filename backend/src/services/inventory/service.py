"""Inventory service logic — stock levels, movements, wastage, recipe deduction.

The two invariants this module exists to maintain:

1. ``InventoryStock.qty_on_hand`` is never changed except by a movement.
   Every mutation writes a ``StockMovement`` row first, so stock is always
   recomputable from the ledger.

2. Quantities use 4-decimal precision. A dish consumes hundredths of a gram,
   so rounding to 2 decimals (the money precision) would lose material stock
   over a day of service.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.inventory.models import (
    AdjustmentStatus,
    InventoryItem,
    InventoryStock,
    MovementType,
    StockAdjustment,
    StockMovement,
    StorageLocation,
    StorageLocationType,
    WastageLog,
    WastageReason,
    status_value,
)
from src.services.inventory.schemas import (
    DeductionResult,
    GlobalInventoryOverview,
    GlobalItemRollup,
    ModuleStockBreakdown,
    RecipeLineSnapshot,
    StockTransferResponse,
)

FOUR_PLACES = 4


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _q(value) -> float:
    """Quantize a quantity to 4 decimals.

    Quantities are not money, so they keep 4 places rather than 2. Without this
    every addition drifts by floating-point error and a day of service leaves a
    few hundredths of a gram unexplained in the ledger.
    """
    return round(float(value or 0), FOUR_PLACES)


def _uuid_or_none(value) -> uuid.UUID | None:
    """Parse a UUID out of event data, tolerating anything malformed.

    Event payloads are JSON, so every UUID arrives as a string. Assigning a
    string to a UUID column would raise "invalid input syntax for type uuid" on
    insert — the first event-driven deduction would then fail every time.
    """
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


class InventoryError(Exception):
    """A rejected inventory operation. The API maps this to 409 or 400."""


# ─── Stock lookup ────────────────────────────────────────────────────────────

async def stock_for(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    item_id: uuid.UUID,
    location_id: uuid.UUID | None = None,
) -> InventoryStock:
    """Fetch-or-create the stock row for an item at a location.

    Creates it rather than returning None: consumption needs a row to deduct
    from, and returning None would make every caller re-implement the same
    null check. Created at zero, so a first deduction is a genuine movement out
    of an empty store rather than a silent no-op.
    """
    stmt = select(InventoryStock).where(
        InventoryStock.tenant_id == tenant_id,
        InventoryStock.outlet_id == outlet_id,
        InventoryStock.inventory_item_id == item_id,
    )
    if location_id is None:
        stmt = stmt.where(InventoryStock.location_id.is_(None))
    else:
        stmt = stmt.where(InventoryStock.location_id == location_id)

    row = await db.scalar(stmt)
    if row is not None:
        return row

    row = InventoryStock(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        inventory_item_id=item_id,
        location_id=location_id,
        qty_on_hand=0,
        qty_reserved=0,
        qty_available=0,
    )
    db.add(row)
    await db.flush()
    return row


async def load_item(
    db: AsyncSession, tenant_id: uuid.UUID, item_id: uuid.UUID
) -> InventoryItem | None:
    return await db.scalar(
        select(InventoryItem).where(
            InventoryItem.id == item_id, InventoryItem.tenant_id == tenant_id
        )
    )


# ─── Movement ────────────────────────────────────────────────────────────────

async def record_movement(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    item: InventoryItem,
    signed_qty: float,
    movement_type: MovementType,
    *,
    location_id: uuid.UUID | None = None,
    unit_cost: float = 0,
    reference_type: str | None = None,
    reference_id: str | None = None,
    notes: str | None = None,
    created_by: uuid.UUID | None = None,
    check_negative: bool = True,
) -> StockMovement:
    """Apply a signed quantity change and write the ledger row.

    ``signed_qty`` is positive for stock in, negative for stock out. The stock
    row and the movement row commit or roll back together, so a movement without
    a matching stock change is impossible.

    Negative stock is refused unless the item opts in with
    ``allow_negative_stock``. Allowing a silent overdraft would turn a stockout
    into invisible phantom inventory, which is worse than a refused sale.
    """
    qty = _q(signed_qty)
    if qty == 0:
        raise InventoryError("Movement quantity cannot be zero")

    stock = await stock_for(db, tenant_id, outlet_id, item.id, location_id)
    new_on_hand = _q(float(stock.qty_on_hand) + qty)

    if check_negative and new_on_hand < 0 and not item.allow_negative_stock:
        raise InventoryError(
            f"Insufficient stock for {item.name}: "
            f"on hand {stock.qty_on_hand}, requested {qty}"
        )

    if qty > 0:
        # Weighted average cost on receipts, which is how a moving average
        # should behave. Receipts only — deductions consume at the existing
        # average without changing it.
        total_units = float(stock.qty_on_hand) + qty
        if total_units > 0:
            avg = (_q(float(stock.qty_on_hand) * float(stock.avg_cost))
                   + _q(qty * unit_cost)) / total_units
            stock.avg_cost = _q(avg)
        stock.last_cost = _q(unit_cost)

    stock.qty_on_hand = new_on_hand
    stock.qty_available = _q(new_on_hand - float(stock.qty_reserved))

    movement = StockMovement(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        inventory_item_id=item.id,
        location_id=location_id,
        movement_type=movement_type,
        qty=qty,
        unit_cost=_q(unit_cost),
        reference_type=reference_type,
        reference_id=reference_id,
        notes=notes,
        created_by=created_by,
    )
    db.add(movement)
    await db.flush()
    return movement


# ─── Recipe deduction ────────────────────────────────────────────────────────

async def deduct_recipe(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    lines: list[RecipeLineSnapshot],
    qty_per_line: int = 1,
    *,
    reference_type: str = "bill",
    reference_id: str | None = None,
    created_by: uuid.UUID | None = None,
) -> list[DeductionResult]:
    """Consume the ingredients of a sold dish.

    Called on ``bill.paid`` — that is the moment the dish is irrevocably gone.
    Deducting at ``order.placed`` would consume stock for orders that get
    cancelled; deducting here means only what was actually paid for shrinks the
    store.

    ``lines`` are ingredient requirements per portion, each with an explicit
    ``qty_per_portion``, so the caller (the caller has the recipe) controls the
    arithmetic. Total required = qty_per_portion * qty_per_line.

    Deductions do NOT fail the transaction on shortage: a sold dish must still
    be billed, and refusing to record a deduction because an item was low would
    block a completed sale on an inventory quibble. Instead the shortage is
    reported per line, stock is floored at zero, and the ``short`` field says
    how much is unaccounted for. The caller can publish ``stock.out`` from the
    results so purchase can raise a purchase request.
    """
    results: list[DeductionResult] = []
    for line in lines or []:
        item_id = line.inventory_item_id
        if item_id is None:
            continue
        item = await load_item(db, tenant_id, item_id)
        if item is None:
            # Unknown ingredient: record nothing, report the gap. Silently
            # dropping it would hide a recipe pointing at a deleted item.
            results.append(DeductionResult(
                inventory_item_id=item_id,
                required=0.0, deducted=0.0, short=0.0,
                shortage=True, movement_id=None,
            ))
            continue

        required = _q(line.qty_per_portion * (qty_per_line or 1))
        if required <= 0:
            continue

        stock = await stock_for(db, tenant_id, outlet_id, item.id,
                                item.default_location_id)
        available = _q(stock.qty_on_hand - stock.qty_reserved)
        to_take = min(required, available) if available > 0 else 0.0

        movement_id = None
        if to_take > 0:
            movement = await record_movement(
                db, tenant_id, outlet_id, item, -to_take,
                MovementType.CONSUMPTION,
                location_id=item.default_location_id,
                unit_cost=float(stock.avg_cost),
                reference_type=reference_type,
                reference_id=reference_id,
                created_by=created_by,
                check_negative=False,
            )
            movement_id = movement.id

        short = _q(required - to_take)
        results.append(DeductionResult(
            inventory_item_id=item_id,
            required=required,
            deducted=_q(to_take),
            short=short,
            shortage=short > 0,
            movement_id=movement_id,
        ))

    return results


# ─── Wastage ─────────────────────────────────────────────────────────────────

async def record_wastage(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    item: InventoryItem,
    qty: float,
    reason: WastageReason = WastageReason.OTHER,
    *,
    batch_id: uuid.UUID | None = None,
    notes: str | None = None,
    created_by: uuid.UUID | None = None,
) -> WastageLog:
    """Write a wastage movement AND a wastage log.

    Both rows are needed. The movement keeps the stock ledger complete; the log
    carries the reason and the money lost, which a movement cannot express.
    Valuing the loss at the item's average cost is what makes shrinkage
    visible as an amount rather than just a quantity.
    """
    movement = await record_movement(
        db, tenant_id, outlet_id, item, -qty, MovementType.WASTAGE,
        location_id=item.default_location_id,
        unit_cost=float(item.standard_cost),
        reference_type="wastage",
        notes=notes,
        created_by=created_by,
    )
    loss = _q(qty * float(item.standard_cost))
    log = WastageLog(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        inventory_item_id=item.id,
        qty=_q(qty),
        reason=reason,
        loss_amount=loss,
        batch_id=batch_id,
        notes=notes,
        created_by=created_by,
    )
    db.add(log)
    await db.flush()
    return log


# ─── Adjustments ─────────────────────────────────────────────────────────────

async def request_adjustment(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    item: InventoryItem,
    counted_qty: float,
    *,
    location_id: uuid.UUID | None = None,
    reason: str | None = None,
    requested_by: uuid.UUID | None = None,
) -> StockAdjustment:
    """Open a recount correction for approval.

    This deliberately does NOT touch stock. The recorded-vs-counted difference
    is proposed; approval is a separate step. Applying it on request would let
    anyone quietly move the books.
    """
    stock = await stock_for(db, tenant_id, outlet_id, item.id, location_id)
    adjustment = StockAdjustment(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        inventory_item_id=item.id,
        location_id=location_id,
        recorded_qty=_q(stock.qty_on_hand),
        counted_qty=_q(counted_qty),
        qty_delta=_q(counted_qty) - _q(stock.qty_on_hand),
        status=AdjustmentStatus.PENDING,
        reason=reason,
        requested_by=requested_by,
    )
    db.add(adjustment)
    await db.flush()
    return adjustment


async def decide_adjustment(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    item: InventoryItem,
    adjustment: StockAdjustment,
    approve: bool,
    *,
    approved_by: uuid.UUID | None = None,
    reason: str | None = None,
) -> tuple[StockAdjustment, StockMovement | None]:
    """Approve or reject a pending adjustment.

    Only an APPROVED adjustment moves stock, and it writes an ADJUSTMENT
    movement so the recount is attributable in the ledger. A rejected one leaves
    stock exactly as it was — the point of the gate.
    """
    if status_value(adjustment.status) != AdjustmentStatus.PENDING:
        raise InventoryError(
            f"Adjustment is already {status_value(adjustment.status)}"
        )

    if not approve:
        adjustment.status = AdjustmentStatus.REJECTED
        adjustment.approved_by = approved_by
        adjustment.approved_at = _now()
        await db.flush()
        return adjustment, None

    delta = _q(adjustment.qty_delta)
    adjustment.status = AdjustmentStatus.APPROVED
    adjustment.approved_by = approved_by
    adjustment.approved_at = _now()
    if reason:
        adjustment.reason = reason
    await db.flush()

    if delta == 0:
        return adjustment, None

    movement = await record_movement(
        db, tenant_id, outlet_id, item, delta, MovementType.ADJUSTMENT,
        location_id=adjustment.location_id,
        unit_cost=float(item.standard_cost),
        reference_type="adjustment",
        reference_id=str(adjustment.id),
        notes=reason,
        created_by=approved_by,
    )
    return adjustment, movement


# ─── Aggregates for reporting ────────────────────────────────────────────────

async def items_with_stock(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID | None = None
) -> list[tuple[InventoryItem, list[InventoryStock]]]:
    """Items with their stock rows, for the stockroom board.

    Loads stocks separately rather than via the relationship: a lazy load would
    fire during Pydantic serialisation and raise MissingGreenlet.
    """
    stmt = select(InventoryItem).where(InventoryItem.tenant_id == tenant_id)
    if outlet_id:
        stmt = stmt.where(InventoryItem.outlet_id == outlet_id)
    items = list((await db.execute(stmt)).scalars().all())
    if not items:
        return []

    stock_stmt = select(InventoryStock).where(
        InventoryStock.tenant_id == tenant_id,
        InventoryStock.inventory_item_id.in_([i.id for i in items]),
    )
    if outlet_id:
        stock_stmt = stock_stmt.where(InventoryStock.outlet_id == outlet_id)
    rows = list((await db.execute(stock_stmt)).scalars().all())
    by_item: dict[uuid.UUID, list[InventoryStock]] = {}
    for row in rows:
        by_item.setdefault(row.inventory_item_id, []).append(row)
    return [(item, by_item.get(item.id, [])) for item in items]


async def low_stock(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID | None = None
) -> list[InventoryItem]:
    """Items whose available quantity is at or below reorder level.

    Compared against availability, not on-hand, because stock that is reserved
    for an open order is not reorderable.
    """
    stmt = select(InventoryItem).where(
        InventoryItem.tenant_id == tenant_id,
        InventoryItem.is_active.is_(True),
        InventoryItem.track_stock.is_(True),
    )
    if outlet_id:
        stmt = stmt.where(InventoryItem.outlet_id == outlet_id)
    items = list((await db.execute(stmt)).scalars().all())
    if not items:
        return []

    stock_stmt = select(InventoryStock).where(
        InventoryStock.tenant_id == tenant_id,
        InventoryStock.inventory_item_id.in_([i.id for i in items]),
    )
    if outlet_id:
        stock_stmt = stock_stmt.where(InventoryStock.outlet_id == outlet_id)
    rows = list((await db.execute(stock_stmt)).scalars().all())
    available: dict[uuid.UUID, float] = {}
    for row in rows:
        available[row.inventory_item_id] = available.get(row.inventory_item_id, 0.0) \
            + _q(row.qty_on_hand - row.qty_reserved)

    return [i for i in items
            if available.get(i.id, 0.0) <= _q(i.reorder_level)]


async def stock_value(db: AsyncSession, tenant_id: uuid.UUID) -> float:
    """Total inventory value at average cost."""
    total = await db.scalar(
        select(func.sum(
            InventoryStock.qty_on_hand * InventoryStock.avg_cost
        )).where(InventoryStock.tenant_id == tenant_id)
    )
    return round(float(total or 0), 2)


# ─── Hub & Spoke Multi-Tier Topology (Global Central & Module Sub-Inventories) ─

async def bootstrap_tenant_locations(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID
) -> list[StorageLocation]:
    """Ensure standard Global Hub + Module Spoke locations exist for a tenant.

    Hierarchy:
      * Central Warehouse (module="central", is_central=True, parent_location_id=None)
        * Restaurant Kitchen Store (module="restaurant", is_central=False, parent=Central)
        * Bar & Beverage Store (module="bar", is_central=False, parent=Central)
    """
    stmt = select(StorageLocation).where(
        StorageLocation.tenant_id == tenant_id,
        StorageLocation.outlet_id == outlet_id,
    )
    existing = list((await db.execute(stmt)).scalars().all())

    central = next((loc for loc in existing if loc.is_central or loc.location_type == StorageLocationType.WAREHOUSE), None)
    if central is None:
        central = StorageLocation(
            tenant_id=tenant_id,
            outlet_id=outlet_id,
            name="Central Warehouse (Global Hub)",
            location_type=StorageLocationType.WAREHOUSE,
            module="central",
            is_central=True,
            parent_location_id=None,
        )
        db.add(central)
        await db.flush()
        existing.append(central)

    # Restaurant Kitchen Store
    rest_loc = next((loc for loc in existing if loc.module == "restaurant" and not loc.is_central), None)
    if rest_loc is None:
        rest_loc = StorageLocation(
            tenant_id=tenant_id,
            outlet_id=outlet_id,
            name="Restaurant Kitchen Store",
            location_type=StorageLocationType.KITCHEN_STORE,
            module="restaurant",
            is_central=False,
            parent_location_id=central.id,
        )
        db.add(rest_loc)
        await db.flush()
        existing.append(rest_loc)

    # Bar & Beverage Store
    bar_loc = next((loc for loc in existing if loc.module == "bar" and not loc.is_central), None)
    if bar_loc is None:
        bar_loc = StorageLocation(
            tenant_id=tenant_id,
            outlet_id=outlet_id,
            name="Bar & Beverage Store",
            location_type=StorageLocationType.BAR_STORE,
            module="bar",
            is_central=False,
            parent_location_id=central.id,
        )
        db.add(bar_loc)
        await db.flush()
        existing.append(bar_loc)

    return existing


async def transfer_stock(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    source_location_id: uuid.UUID,
    destination_location_id: uuid.UUID,
    item: InventoryItem,
    qty: float,
    *,
    notes: str | None = None,
    created_by: uuid.UUID | None = None,
) -> StockTransferResponse:
    """Transfer stock between Central Warehouse and Module Sub-Inventories.

    Writes an atomic pair of ledger entries:
      1. TRANSFER_OUT at source location
      2. TRANSFER_IN at destination location
    """
    if source_location_id == destination_location_id:
        raise InventoryError("Source and destination locations cannot be identical")

    transfer_qty = _q(qty)
    if transfer_qty <= 0:
        raise InventoryError("Transfer quantity must be greater than zero")

    # Fetch locations for names and validation
    src_loc = await db.scalar(
        select(StorageLocation).where(
            StorageLocation.id == source_location_id,
            StorageLocation.tenant_id == tenant_id,
        )
    )
    dst_loc = await db.scalar(
        select(StorageLocation).where(
            StorageLocation.id == destination_location_id,
            StorageLocation.tenant_id == tenant_id,
        )
    )
    if src_loc is None:
        raise InventoryError(f"Source storage location '{source_location_id}' not found")
    if dst_loc is None:
        raise InventoryError(f"Destination storage location '{destination_location_id}' not found")

    src_stock = await stock_for(db, tenant_id, outlet_id, item.id, source_location_id)
    if float(src_stock.qty_on_hand) < transfer_qty and not item.allow_negative_stock:
        raise InventoryError(
            f"Insufficient stock in '{src_loc.name}' for {item.name}: "
            f"on hand {src_stock.qty_on_hand}, requested transfer {transfer_qty}"
        )

    unit_cost = float(src_stock.avg_cost or item.standard_cost or 0)

    # 1. Deduct from source
    transfer_ref = f"TRF-{uuid.uuid4().hex[:8].upper()}"
    out_move = await record_movement(
        db, tenant_id, outlet_id, item, -transfer_qty, MovementType.TRANSFER_OUT,
        location_id=source_location_id,
        unit_cost=unit_cost,
        reference_type="internal_transfer",
        reference_id=transfer_ref,
        notes=f"Transfer to {dst_loc.name}: {notes or ''}".strip(),
        created_by=created_by,
        check_negative=True,
    )

    # 2. Add to destination
    in_move = await record_movement(
        db, tenant_id, outlet_id, item, transfer_qty, MovementType.TRANSFER_IN,
        location_id=destination_location_id,
        unit_cost=unit_cost,
        reference_type="internal_transfer",
        reference_id=transfer_ref,
        notes=f"Transfer from {src_loc.name}: {notes or ''}".strip(),
        created_by=created_by,
        check_negative=False,
    )

    return StockTransferResponse(
        item_id=item.id,
        item_name=item.name,
        source_location_id=source_location_id,
        source_location_name=src_loc.name,
        destination_location_id=destination_location_id,
        destination_location_name=dst_loc.name,
        qty=transfer_qty,
        source_movement_id=out_move.id,
        destination_movement_id=in_move.id,
        transferred_at=_now(),
    )


async def consume_module_stock(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    item: InventoryItem,
    qty: float,
    *,
    module: str = "restaurant",
    location_id: uuid.UUID | None = None,
    reference_type: str = "pos_sale",
    reference_id: str | None = None,
    notes: str | None = None,
    created_by: uuid.UUID | None = None,
) -> StockMovement:
    """Consume stock from a specific module's sub-inventory."""
    consume_qty = _q(qty)
    if consume_qty <= 0:
        raise InventoryError("Consumption quantity must be greater than zero")

    target_loc_id = location_id
    if target_loc_id is None:
        loc = await db.scalar(
            select(StorageLocation).where(
                StorageLocation.tenant_id == tenant_id,
                StorageLocation.outlet_id == outlet_id,
                StorageLocation.module == module,
                StorageLocation.is_active.is_(True),
            )
        )
        if loc is not None:
            target_loc_id = loc.id
        else:
            target_loc_id = item.default_location_id

    st = await stock_for(db, tenant_id, outlet_id, item.id, target_loc_id)
    unit_cost = float(st.avg_cost or item.standard_cost or 0)

    return await record_movement(
        db, tenant_id, outlet_id, item, -consume_qty, MovementType.CONSUMPTION,
        location_id=target_loc_id,
        unit_cost=unit_cost,
        reference_type=reference_type,
        reference_id=reference_id,
        notes=notes or f"Consumed by {module} module",
        created_by=created_by,
        check_negative=False,
    )


async def get_global_rollup(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID | None = None
) -> GlobalInventoryOverview:
    """Assemble an enterprise multi-tier inventory overview.

    Calculates:
      * Global total on-hand & available
      * Central warehouse inventory
      * Breakdown across each module's sub-inventory (Restaurant Kitchen, Bar, etc.)
      * Valuation by module and central warehouse
      * Critical/Low par statuses
    """
    # 1. Fetch all locations
    loc_stmt = select(StorageLocation).where(StorageLocation.tenant_id == tenant_id)
    if outlet_id:
        loc_stmt = loc_stmt.where(StorageLocation.outlet_id == outlet_id)
    locations = list((await db.execute(loc_stmt)).scalars().all())
    locations_by_id = {loc.id: loc for loc in locations}

    # 2. Fetch all items
    item_stmt = select(InventoryItem).where(InventoryItem.tenant_id == tenant_id)
    if outlet_id:
        item_stmt = item_stmt.where(InventoryItem.outlet_id == outlet_id)
    items = list((await db.execute(item_stmt)).scalars().all())

    # 3. Fetch all stocks
    stock_stmt = select(InventoryStock).where(InventoryStock.tenant_id == tenant_id)
    if outlet_id:
        stock_stmt = stock_stmt.where(InventoryStock.outlet_id == outlet_id)
    stocks = list((await db.execute(stock_stmt)).scalars().all())

    stocks_by_item: dict[uuid.UUID, list[InventoryStock]] = {}
    for st in stocks:
        stocks_by_item.setdefault(st.inventory_item_id, []).append(st)

    total_value = 0.0
    central_value = 0.0
    module_values: dict[str, float] = {}
    low_count = 0
    crit_count = 0

    item_rollups: list[GlobalItemRollup] = []

    for item in items:
        item_stocks = stocks_by_item.get(item.id, [])
        global_on_hand = _q(sum(float(s.qty_on_hand) for s in item_stocks))
        global_avail = _q(sum(float(s.qty_on_hand) - float(s.qty_reserved) for s in item_stocks))

        central_on_hand = 0.0
        module_breakdowns: list[ModuleStockBreakdown] = []

        for s in item_stocks:
            loc = locations_by_id.get(s.location_id) if s.location_id else None
            loc_name = loc.name if loc else "Unassigned / General"
            loc_module = loc.module if loc else "general"
            loc_type = loc.location_type.value if loc and hasattr(loc.location_type, "value") else (str(loc.location_type) if loc else "general")
            is_cent = bool(loc and (loc.is_central or loc_type == "warehouse"))

            on_hand = float(s.qty_on_hand)
            avail = float(s.qty_on_hand) - float(s.qty_reserved)
            cost = float(s.avg_cost or item.standard_cost or 0)
            val = round(on_hand * cost, 2)

            total_value += val
            if is_cent:
                central_on_hand += on_hand
                central_value += val
            else:
                module_values[loc_module] = module_values.get(loc_module, 0.0) + val

            if s.location_id:
                module_breakdowns.append(
                    ModuleStockBreakdown(
                        location_id=s.location_id,
                        location_name=loc_name,
                        module=loc_module,
                        location_type=loc_type,
                        is_central=is_cent,
                        qty_on_hand=_q(on_hand),
                        qty_available=_q(avail),
                    )
                )

        reorder = float(item.reorder_level or 0)
        status_label = "OK"
        if global_avail <= reorder * 0.5:
            status_label = "Critical"
            crit_count += 1
        elif global_avail <= reorder:
            status_label = "Low"
            low_count += 1

        item_rollups.append(
            GlobalItemRollup(
                id=item.id,
                outlet_id=item.outlet_id,
                name=item.name,
                code=item.code,
                sku=item.sku,
                item_type=item.item_type,
                standard_cost=float(item.standard_cost),
                reorder_level=reorder,
                is_active=item.is_active,
                total_global_on_hand=global_on_hand,
                total_global_available=global_avail,
                central_warehouse_on_hand=_q(central_on_hand),
                module_stocks=module_breakdowns,
                stock_status=status_label,
            )
        )

    return GlobalInventoryOverview(
        total_items=len(items),
        total_value=round(total_value, 2),
        central_warehouse_value=round(central_value, 2),
        module_values={k: round(v, 2) for k, v in module_values.items()},
        low_stock_count=low_count,
        critical_stock_count=crit_count,
        items=item_rollups,
    )

