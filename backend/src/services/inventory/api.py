"""Inventory service endpoints.

Who may call what:
  * read — ``view:inventory``
  * write — ``manage:inventory``
  * approve adjustments — ``manage:inventory``

Events:
  subscribes bill.paid (recipe BOM deduction — the dish is gone, stock must shrink)
             order.cancelled, order.placed, kot.item.status.changed, grn.posted
  publishes  stock.movement.created, stock.low, stock.out,
             adjustment.approved, wastage.recorded

The ``bill.paid`` consumer is the important link: inventory reacts to money
moving, because that is when a dish leaves the building for good. Deducting at
order placement would shrink stock for orders that were later cancelled.
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status as http_status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.event_bus.bus import Event, bus
from src.services.inventory import service as svc
from src.services.inventory.models import (
    InventoryItem,
    InventoryStock,
    MovementType,
    StockAdjustment,
    WastageLog,
)
from src.services.inventory.schemas import (
    AdjustmentApprove,
    AdjustmentRequest,
    AdjustmentResponse,
    CategoryCreate,
    CategoryResponse,
    DeductionResult,
    InventoryItemCreate,
    InventoryItemResponse,
    InventoryItemUpdate,
    ItemWithStockResponse,
    MovementResponse,
    OpeningStockIn,
    QuickAdjustmentCreate,
    RecipeLineSnapshot,
    StockResponse,
    StorageLocationCreate,
    StorageLocationResponse,
    WastageIn,
    WastageResponse,
)
from src.services.shared.identity import CurrentIdentity

router = APIRouter()


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


def _handler_db() -> AsyncSession:
    """A session owned by an event handler, not by a request."""
    from src.services.inventory.main import db as _db

    return _db.session_factory()


def _ev(topic, tenant_id=None, outlet_id=None, data=None):
    return Event(type=topic, tenant_id=tenant_id, outlet_id=outlet_id,
                 data=data or {}, source_service="inventory")


def _outbox(db: AsyncSession, event: Event) -> None:
    """Persist the event to the outbox table in the current transaction.

    The outbox row commits atomically with the inventory movement, so a
    committed stock change is never lost even if the bus publish subsequently
    fails or the process crashes. The relay drains pending rows on its next
    poll.
    """
    from src.services.inventory.models import OutboxMessage
    db.add(OutboxMessage(
        event_id=event.event_id,
        type=event.type,
        tenant_id=event.tenant_id,
        outlet_id=event.outlet_id,
        data=event.data,
        source_service="inventory",
        status="pending",
    ))


def _coerce_uuid(value) -> uuid.UUID | None:
    """Parse a UUID from event data without raising on bad input."""
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

    The bus serialises tenant_id as a STRING (see ``Event.to_json``).
    Dispatched within one process a consumer receives the original UUID, but
    across processes it round-trips through Redis and ``Event.from_json``
    yields a bare str. Comparing a str against a UUID column returns zero rows
    rather than raising — the event is acked and silently dropped. Tolerate the
    string; everything downstream expects a UUID.
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


# ─── Consumers ────────────────────────────────────────────────────────────────

@bus.on("bill.paid")
async def _on_bill_paid(event: Event) -> None:
    """Consume the ingredients of a paid dish.

    Idempotent on ``bill_id``: the bus delivers at-least-once, so a redelivered
    event must not deduct the same dish twice. The check is against the stock
    movement ledger, which stamps every deduction with its bill id — a
    redelivered bill.paid finds its own movements and returns early.

    Do not call ``bus.mark_seen`` here; the consumer loop already gates by
    event_id, and a handler-side call would suppress events it never marked.
    """
    data = event.data or {}
    tenant = _tenant(event)
    if tenant is None or not data.get("bill_id"):
        return
    bill_id = _coerce_uuid(data.get("bill_id"))
    outlet = _coerce_uuid(data.get("outlet_id"))
    if bill_id is None or outlet is None:
        return

    # The payload carries the dishes sold. Each has a menu_item_id and a qty;
    # inventory needs recipes, which it fetches from the menu service over
    # HTTP — recipes are not in this database and must not be foreign-keyed.
    lines: list[RecipeLineSnapshot] = []
    for sold in data.get("lines") or []:
        menu_item_id = _coerce_uuid(sold.get("menu_item_id"))
        qty = int(sold.get("qty") or 1)
        recipe = await _recipe_for(menu_item_id) if menu_item_id else None
        if not recipe:
            continue
        for rline in recipe:
            ingredient = _coerce_uuid(rline.get("inventory_item_id"))
            if ingredient is None:
                continue
            lines.append(RecipeLineSnapshot(
                inventory_item_id=ingredient,
                qty_per_portion=float(rline.get("qty_per_portion") or 0),
            ))

    if not lines:
        return

    db = _handler_db()
    try:
        results = await svc.deduct_recipe(
            db, tenant, outlet, lines,
            reference_type="bill", reference_id=str(bill_id),
        )
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    finally:
        await db.close()

    for result in results:
        if result.shortage:
            stock_out = _ev(
                "stock.out", tenant, outlet,
                data={
                    "bill_id": str(bill_id),
                    "inventory_item_id": str(result.inventory_item_id),
                    "required": result.required,
                    "deducted": result.deducted,
                    "short": result.short,
                },
            )
            # Consumer emits a downstream alert; durable-ify it the same way.
            # The handler's session is already closed here, so use a fresh one
            # to write the outbox row.
            handler_db = _handler_db()
            try:
                _outbox(handler_db, stock_out)
                await handler_db.commit()
            except Exception:
                await handler_db.rollback()
                raise
            finally:
                await handler_db.close()
            await bus.publish(stock_out, local=True)


@bus.on("order.cancelled")
async def _on_order_cancelled(event: Event) -> None:
    """No action: inventory only deducts on bill.paid.

    Registered so the subscription is documented in one place. Because
    deduction is keyed to payment rather than order creation, a cancelled order
    can never leave stock missing — this handler is therefore intentionally
    empty and needs no idempotency logic.
    """


async def _recipe_for(menu_item_id: uuid.UUID) -> list[dict] | None:
    """Fetch a menu item's recipe lines from the menu service over HTTP.

    Cross-service reads go through the gateway, never through a foreign key or
    a direct database handle. Failures return None, which means "cannot deduct"
    rather than "did not deduct" — the difference matters because a silent
    failure would leave stock unshrunk for a sold dish with no signal anywhere.
    """
    try:
        import httpx
        from src.services.shared.registry import base_url, get_descriptor

        descriptor = get_descriptor("menu")
        if descriptor is None:
            return None
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{base_url(descriptor)}/recipes/{menu_item_id}/lines")
        if resp.status_code != 200:
            return None
        return resp.json().get("lines") or None
    except Exception:
        return None


# ─── Items ───────────────────────────────────────────────────────────────────


@router.get("/items/cost-lookup", tags=["inventory"],
            summary="Bulk lookup of standard cost and available stock by item id")
async def cost_lookup(
    identity: CurrentIdentity, db: DbDep,
    ids: str = Query(..., description="Comma-separated inventory item ids"),
):
    """Fetch ``standard_cost`` and available stock for a batch of item ids.

    The menu service's recipe search uses this to match a chef's words
    against ingredient *names* — recipe lines carry bare inventory UUIDs (no
    foreign key, because the split forbids cross-service FKs), so the names
    have to come from here. One HTTP call replaces N individual item reads.

    The join is read-only and one-shot; nothing here creates a dependency
    from the menu service's write paths to inventory.

    Unknown ids come back with ``found: false`` so the caller can report
    "unknown ingredient" per line rather than failing the whole request.
    """
    identity.require("view:inventory")
    id_list = [s.strip() for s in ids.split(",") if s.strip()]
    if not id_list:
        return {"items": []}

    try:
        parsed_ids: list[uuid.UUID] = [uuid.UUID(i) for i in id_list]
    except ValueError:
        parsed_ids = []

    found: dict[str, dict] = {}
    if parsed_ids:
        from src.services.inventory.models import InventoryItem, InventoryStock
        rows = (await db.execute(
            select(InventoryItem).where(
                InventoryItem.id.in_(parsed_ids),
                InventoryItem.tenant_id == identity.tenant_id,
            )
        )).scalars().all()
        # One pass over the stock table to total availability per item.
        stock_rows = (await db.execute(
            select(InventoryStock).where(
                InventoryStock.inventory_item_id.in_(parsed_ids),
                InventoryStock.tenant_id == identity.tenant_id,
            )
        )).scalars().all()
        stock_by_item: dict[uuid.UUID, float] = {}
        for st in stock_rows:
            stock_by_item[st.inventory_item_id] = (
                stock_by_item.get(st.inventory_item_id, 0.0)
                + float(st.qty_on_hand) - float(st.qty_reserved)
            )
        for it in rows:
            found[str(it.id)] = {
                "id": str(it.id),
                "name": it.name,
                "code": it.code,
                "standard_cost": float(it.standard_cost or 0.0),
                "total_available": round(stock_by_item.get(it.id, 0.0), 4),
                "reorder_level": float(it.reorder_level or 0.0),
                "found": True,
            }

    items = []
    for i in id_list:
        if i in found:
            items.append(found[i])
        else:
            items.append({"id": i, "found": False, "name": None, "code": None,
                          "standard_cost": None, "total_available": 0.0,
                          "reorder_level": 0.0})
    return {"items": items}


@router.get("/items", response_model=list[ItemWithStockResponse], tags=["inventory"])
async def list_items(identity: CurrentIdentity, db: DbDep,
                     outlet_id: uuid.UUID | None = None,
                     search: str | None = Query(default=None, max_length=100),
                     limit: int = Query(default=0, le=500,
                                        description="Max rows; 0 = no limit.")):
    identity.require("view:inventory")
    pairs = await svc.items_with_stock(db, identity.tenant_id, outlet_id)
    out = []
    for item, stocks in pairs:
        if search and search.lower() not in (item.name or "").lower() \
                and search.lower() not in (item.code or "").lower():
            continue
        out.append(ItemWithStockResponse(
            id=item.id,
            outlet_id=item.outlet_id,
            name=item.name,
            code=item.code,
            item_type=item.item_type,
            standard_cost=float(item.standard_cost),
            reorder_level=float(item.reorder_level),
            is_active=item.is_active,
            stocks=[StockResponse.model_validate(s) for s in stocks],
            total_on_hand=svc._q(sum(float(s.qty_on_hand) for s in stocks)),
            total_available=svc._q(sum(
                float(s.qty_on_hand) - float(s.qty_reserved) for s in stocks
            )),
        ))
    if limit > 0:
        out = out[:limit]
    return out


@router.get("/items/low", response_model=list[InventoryItemResponse], tags=["inventory"])
async def list_low_stock(identity: CurrentIdentity, db: DbDep,
                         outlet_id: uuid.UUID | None = None):
    """Items at or below reorder level — the reorder board."""
    identity.require("view:inventory")
    items = await svc.low_stock(db, identity.tenant_id, outlet_id)
    return [InventoryItemResponse.model_validate(i) for i in items]


@router.post("/items", response_model=InventoryItemResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["inventory"])
async def create_item(payload: InventoryItemCreate,
                      identity: CurrentIdentity, db: DbDep):
    identity.require("manage:inventory")
    item = InventoryItem(tenant_id=identity.tenant_id, **payload.model_dump())
    db.add(item)
    await db.flush()
    return item


@router.patch("/items/{item_id}", response_model=InventoryItemResponse,
              tags=["inventory"])
async def update_item(item_id: uuid.UUID, payload: InventoryItemUpdate,
                      identity: CurrentIdentity, db: DbDep):
    identity.require("manage:inventory")
    item = await svc.load_item(db, identity.tenant_id, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await db.flush()
    return item


@router.post("/items/{item_id}/opening-stock",
             response_model=MovementResponse, tags=["inventory"],
             status_code=http_status.HTTP_201_CREATED,
             summary="Set opening stock for an item")
async def set_opening_stock(item_id: uuid.UUID, payload: OpeningStockIn,
                            identity: CurrentIdentity, db: DbDep,
                            outlet_id: uuid.UUID):
    identity.require("manage:inventory")
    item = await svc.load_item(db, identity.tenant_id, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    movement = await svc.record_movement(
        db, identity.tenant_id, outlet_id, item, payload.qty,
        MovementType.OPENING,
        location_id=payload.location_id,
        unit_cost=payload.unit_cost,
        reference_type="opening",
        created_by=identity.user_id,
        check_negative=False,
    )
    return movement


# ─── Locations ───────────────────────────────────────────────────────────────

@router.get("/locations", response_model=list[StorageLocationResponse],
            tags=["inventory"])
async def list_locations(identity: CurrentIdentity, db: DbDep,
                         outlet_id: uuid.UUID | None = None):
    identity.require("view:inventory")
    from src.services.inventory.models import StorageLocation
    stmt = select(StorageLocation).where(
        StorageLocation.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(StorageLocation.outlet_id == outlet_id)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/locations", response_model=StorageLocationResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["inventory"])
async def create_location(payload: StorageLocationCreate,
                          identity: CurrentIdentity, db: DbDep):
    identity.require("manage:inventory")
    from src.services.inventory.models import StorageLocation
    location = StorageLocation(tenant_id=identity.tenant_id,
                               **payload.model_dump())
    db.add(location)
    await db.flush()
    return location


# ─── Categories ──────────────────────────────────────────────────────────────

@router.post("/categories", response_model=CategoryResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["inventory"])
async def create_category(payload: CategoryCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:inventory")
    from src.services.inventory.models import InventoryCategory
    cat = InventoryCategory(
        tenant_id=identity.tenant_id,
        outlet_id=payload.outlet_id,
        name=payload.name,
    )
    db.add(cat)
    await db.flush()
    return cat


@router.get("/categories", response_model=list[CategoryResponse], tags=["inventory"])
async def list_categories(identity: CurrentIdentity, db: DbDep, outlet_id: uuid.UUID | None = None):
    identity.require("view:inventory")
    from src.services.inventory.models import InventoryCategory
    stmt = select(InventoryCategory).where(InventoryCategory.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(InventoryCategory.outlet_id == outlet_id)
    return list((await db.execute(stmt)).scalars().all())


# ─── Movements ───────────────────────────────────────────────────────────────

@router.get("/movements", response_model=list[MovementResponse], tags=["inventory"])
async def list_movements(identity: CurrentIdentity, db: DbDep,
                         item_id: uuid.UUID | None = None,
                         movement_type: str | None = None,
                         limit: int = Query(default=200, le=1000)):
    identity.require("view:inventory")
    stmt = select(StockMovement).where(
        StockMovement.tenant_id == identity.tenant_id)
    if item_id:
        stmt = stmt.where(StockMovement.inventory_item_id == item_id)
    if movement_type:
        stmt = stmt.where(StockMovement.movement_type == movement_type)
    stmt = stmt.order_by(StockMovement.created_at.desc()).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


@router.get("/value", response_model=dict, tags=["inventory"])
async def total_stock_value(identity: CurrentIdentity, db: DbDep):
    identity.require("view:inventory")
    value = await svc.stock_value(db, identity.tenant_id)
    return {"stock_value": value}


# ─── Wastage ────────────────────────────────────────────────────────────────

@router.post("/items/{item_id}/wastage", response_model=WastageResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["inventory"])
async def record_wastage(item_id: uuid.UUID, payload: WastageIn,
                         identity: CurrentIdentity, db: DbDep,
                         outlet_id: uuid.UUID):
    """Log shrinkage. Writes a movement AND a log in one transaction."""
    identity.require("manage:inventory")
    item = await svc.load_item(db, identity.tenant_id, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    try:
        log = await svc.record_wastage(
            db, identity.tenant_id, outlet_id, item, payload.qty,
            payload.reason, batch_id=payload.batch_id, notes=payload.notes,
            created_by=identity.user_id,
        )
    except svc.InventoryError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    event = _ev(
        "wastage.recorded", identity.tenant_id, outlet_id,
        data={
            "wastage_id": str(log.id),
            "inventory_item_id": str(item.id),
            "qty": float(log.qty),
            "reason": svc.status_value(log.reason),
            "loss_amount": float(log.loss_amount),
        },
    )
    _outbox(db, event)
    await db.commit()
    await bus.publish(event, local=True)
    return log


@router.get("/wastage", response_model=list[WastageResponse], tags=["inventory"])
async def list_wastage(identity: CurrentIdentity, db: DbDep,
                       outlet_id: uuid.UUID | None = None,
                       limit: int = Query(default=100, le=500)):
    identity.require("view:inventory")
    stmt = select(WastageLog).where(
        WastageLog.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(WastageLog.outlet_id == outlet_id)
    stmt = stmt.order_by(WastageLog.created_at.desc()).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


# ─── Adjustments ─────────────────────────────────────────────────────────────

@router.post("/items/{item_id}/adjustments", response_model=AdjustmentResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["inventory"],
             summary="Request a recount adjustment for approval")
async def request_adjustment(item_id: uuid.UUID, payload: AdjustmentRequest,
                             identity: CurrentIdentity, db: DbDep,
                             outlet_id: uuid.UUID):
    identity.require("manage:inventory")
    item = await svc.load_item(db, identity.tenant_id, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    adjustment = await svc.request_adjustment(
        db, identity.tenant_id, outlet_id, item, payload.counted_qty,
        location_id=payload.location_id, reason=payload.reason,
        requested_by=identity.user_id,
    )
    return adjustment


@router.post("/adjustments", response_model=AdjustmentResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["inventory"],
             summary="Create and record a stock count adjustment")
async def create_adjustment(payload: QuickAdjustmentCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:inventory")
    item = await svc.load_item(db, identity.tenant_id, payload.item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    counted = payload.counted_qty if payload.counted_qty is not None else (payload.qty_counted or 0.0)
    adj = await svc.request_adjustment(
        db, identity.tenant_id, payload.outlet_id, item,
        counted, location_id=payload.location_id, reason=payload.reason,
        requested_by=identity.user_id,
    )
    return adj


@router.get("/adjustments", response_model=list[AdjustmentResponse],
            tags=["inventory"])
async def list_adjustments(identity: CurrentIdentity, db: DbDep,
                           status_filter: str | None = None,
                           limit: int = Query(default=100, le=500)):
    identity.require("view:inventory")
    stmt = select(StockAdjustment).where(
        StockAdjustment.tenant_id == identity.tenant_id)
    if status_filter:
        stmt = stmt.where(StockAdjustment.status == status_filter)
    stmt = stmt.order_by(StockAdjustment.created_at.desc()).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/adjustments/{adjustment_id}/decide",
             response_model=AdjustmentResponse, tags=["inventory"],
             summary="Approve or reject a pending adjustment")
async def decide_adjustment(adjustment_id: uuid.UUID, payload: AdjustmentApprove,
                            identity: CurrentIdentity, db: DbDep):
    """Only approval moves stock. Rejection leaves quantities untouched."""
    identity.require("manage:inventory")
    adjustment = await db.scalar(
        select(StockAdjustment).where(
            StockAdjustment.id == adjustment_id,
            StockAdjustment.tenant_id == identity.tenant_id,
        )
    )
    if adjustment is None:
        raise HTTPException(status_code=404, detail="Adjustment not found")
    item = await svc.load_item(db, identity.tenant_id, adjustment.inventory_item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    try:
        adjustment, movement = await svc.decide_adjustment(
            db, identity.tenant_id, adjustment.outlet_id, item, adjustment,
            payload.approve, approved_by=identity.user_id, reason=payload.reason,
        )
    except svc.InventoryError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    if payload.approve:
        event = _ev(
            "adjustment.approved", identity.tenant_id, adjustment.outlet_id,
            data={
                "adjustment_id": str(adjustment.id),
                "inventory_item_id": str(item.id),
                "qty_delta": float(adjustment.qty_delta),
                "movement_id": str(movement.id) if movement else None,
            },
        )
        _outbox(db, event)
    await db.commit()
    if payload.approve:
        await bus.publish(event, local=True)
    return adjustment


# ─── Deduction ───────────────────────────────────────────────────────────────

@router.post("/deduct-recipe", response_model=list[DeductionResult],
             tags=["inventory"],
             summary="Consume ingredients for a quantity of a dish")
async def deduct_manual(lines: list[RecipeLineSnapshot],
                        identity: CurrentIdentity, db: DbDep,
                        outlet_id: uuid.UUID,
                        qty: int = Query(default=1, ge=1),
                        reference_type: str = "manual",
                        reference_id: str | None = None):
    """Manual deduction, for testing and for the walk-in POS flow."""
    identity.require("manage:inventory")
    results = await svc.deduct_recipe(
        db, identity.tenant_id, outlet_id, lines, qty,
        reference_type=reference_type, reference_id=reference_id,
        created_by=identity.user_id,
    )
    return results
