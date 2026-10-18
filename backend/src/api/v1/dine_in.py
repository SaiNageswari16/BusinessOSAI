"""Dine-in / order-taking endpoints — running orders, tables, reservations."""
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission, resolve_outlet_id
from src.database.session import get_db
from src.models import (
    Order,
    OrderItem,
    Reservation,
    RestaurantTable,
    TableSession,
    TableSessionStatus,
    TableStatus,
    Waitlist,
    WaitlistStatus,
)
from src.schemas.orders import (
    FireRequest,
    FireResponse,
    KOTSummary,
    MergeOrderRequest,
    OrderCreate,
    OrderItemResponse,
    OrderItemUpdate,
    OrderResponse,
    OrderStatusUpdate,
    ReservationCreate,
    ReservationResponse,
    ReservationStatusUpdate,
    SeatReservationRequest,
    SeatWaitlistRequest,
    SplitOrderRequest,
    TransferTableRequest,
    WaitlistCreate,
    WaitlistResponse,
)
from src.services import order_service
from src.services.kot_service import _status_value, fire_kot
from src.services.number_series import allocate_number

router = APIRouter(prefix="/orders", tags=["Orders"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _get_order_for_ctx(
    db: AsyncSession, ctx: CurrentUserContext, order_id: uuid.UUID
) -> Order:
    order = (
        await db.execute(
            select(Order)
            .options(
                selectinload(Order.items).selectinload(OrderItem.addons),
                selectinload(Order.courses),
            )
            .where(Order.id == order_id, Order.tenant_id == ctx.tenant_id)
        )
    ).scalars().first()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    resolve_outlet_id(ctx, order.outlet_id)
    return order


# ─── Orders ──────────────────────────────────────────────────────

@router.get("", response_model=list[OrderResponse])
@router.get("/", response_model=list[OrderResponse])
async def list_orders(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:orders"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    table_id: uuid.UUID | None = None,
    active_only: bool = False,
    limit: int = 100,
    offset: int = 0,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = (
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.addons),
            selectinload(Order.courses),
        )
        .where(Order.tenant_id == ctx.tenant_id)
    )
    if outlet_id:
        stmt = stmt.where(Order.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    if table_id:
        stmt = stmt.where(Order.table_id == table_id)
    if active_only:
        stmt = stmt.where(
            Order.status.not_in(["settled", "cancelled"])
        )
    stmt = stmt.order_by(Order.created_at.desc()).limit(limit).offset(offset)
    return [
        OrderResponse.model_validate(o)
        for o in (await db.execute(stmt)).scalars().all()
    ]


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:orders"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id)
    try:
        order = await order_service.create_order(
            db, ctx.tenant_id, payload, waiter_id=ctx.user_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    # db.refresh() doesn't populate relationships, so re-fetch with items
    # eager-loaded — otherwise serializing OrderResponse.items raises
    # MissingGreenlet on the lazy load.
    order_id = order.id
    order = (
        await db.execute(
            select(Order)
            .options(selectinload(Order.items).selectinload(OrderItem.addons))
            .where(Order.id == order_id, Order.tenant_id == ctx.tenant_id)
        )
    ).scalar_one()
    return OrderResponse.model_validate(order)


# ─── Reservations ────────────────────────────────────────────────
# NOTE: static paths must be registered before "/{order_id}" below, or
# Starlette matches the dynamic route first and returns 422 on the path segment.

@router.get("/reservations", response_model=list[ReservationResponse])
async def list_reservations(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:orders"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    status_filter: str | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(Reservation).where(Reservation.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(Reservation.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(Reservation.status == status_filter)
    stmt = stmt.order_by(Reservation.reserved_from)
    return [
        ReservationResponse.model_validate(r)
        for r in (await db.execute(stmt)).scalars().all()
    ]


# ─── Waitlist ────────────────────────────────────────────────────

@router.get("/waitlist", response_model=list[WaitlistResponse])
async def list_waitlist(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:orders"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(Waitlist).where(
        Waitlist.tenant_id == ctx.tenant_id,
        Waitlist.status == WaitlistStatus.WAITING,
    )
    if outlet_id:
        stmt = stmt.where(Waitlist.outlet_id == outlet_id)
    stmt = stmt.order_by(Waitlist.requested_at)
    return [
        WaitlistResponse.model_validate(w)
        for w in (await db.execute(stmt)).scalars().all()
    ]


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:orders"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    order = await _get_order_for_ctx(db, ctx, order_id)
    return OrderResponse.model_validate(order)


@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: uuid.UUID,
    payload: dict,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:orders"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    order = await _get_order_for_ctx(db, ctx, order_id)
    if _status_value(order.status) in ("settled", "cancelled"):
        raise HTTPException(status_code=400, detail="This order is already closed")

    for field in ("covers", "waiter_id", "customer_id", "customer_name",
                  "customer_phone", "notes"):
        if field in payload and payload[field] is not None:
            setattr(order, field, payload[field])

    await db.commit()
    await db.refresh(order)
    return OrderResponse.model_validate(order)


@router.post("/{order_id}/items", response_model=OrderResponse)
async def add_order_items(
    order_id: uuid.UUID,
    items: list,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:orders"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Append a round of items — the waiter's 'add more' action."""
    order = await _get_order_for_ctx(db, ctx, order_id)
    if _status_value(order.status) in ("settled", "cancelled"):
        raise HTTPException(status_code=400, detail="This order is already closed")

    try:
        await order_service.add_items(db, ctx.tenant_id, order, items)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    await db.refresh(order)
    return OrderResponse.model_validate(order)


@router.put("/items/{item_id}", response_model=OrderItemResponse)
async def update_order_item(
    item_id: uuid.UUID,
    payload: OrderItemUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:orders"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = (
        await db.execute(
            select(OrderItem)
            .options(selectinload(OrderItem.addons))
            .where(OrderItem.id == item_id, OrderItem.tenant_id == ctx.tenant_id)
        )
    ).scalars().first()
    if item is None:
        raise HTTPException(status_code=404, detail="Order item not found")

    parent = await db.scalar(
        select(Order).where(Order.id == item.order_id)
    )
    if parent is not None:
        resolve_outlet_id(ctx, parent.outlet_id)

    try:
        updated = await order_service.update_item_qty(
            db, ctx.tenant_id, item.order_id, item_id,
            qty=payload.qty,
            notes=payload.notes,
            discount_pct=payload.discount_pct,
            course_number=payload.course_number,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    await db.refresh(updated)
    return OrderItemResponse.model_validate(updated)


@router.post("/{order_id}/fire", response_model=FireResponse)
async def fire_order(
    order_id: uuid.UUID,
    payload: FireRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("fire:kot"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Send unfired items to the kitchen, grouped into one KOT per station."""
    order = await _get_order_for_ctx(db, ctx, order_id)

    try:
        kots = await fire_kot(
            db, ctx.tenant_id, order.id,
            course_numbers=payload.course_numbers,
            order_item_ids=payload.order_item_ids,
            priority=payload.priority,
            notes=payload.notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not kots:
        return FireResponse(fired=0, kots=[])

    await db.commit()
    for kot in kots:
        await db.refresh(kot)

    return FireResponse(
        fired=sum(len(k.items or []) for k in kots),
        kots=[
            KOTSummary(
                id=k.id,
                kot_number=k.kot_number,
                station_id=k.station_id,
                status=_status_value(k.status),
                item_count=len(k.items or []),
                course_number=k.course_number or 1,
            )
            for k in kots
        ],
    )


@router.post("/{order_id}/place", response_model=OrderResponse)
async def place_order(
    order_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:orders"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    order = await _get_order_for_ctx(db, ctx, order_id)
    await order_service.place_order(db, ctx.tenant_id, order.id)
    await db.commit()
    await db.refresh(order)
    return OrderResponse.model_validate(order)


@router.put("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: uuid.UUID,
    payload: OrderStatusUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:orders"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    order = await _get_order_for_ctx(db, ctx, order_id)
    if _status_value(order.status) == "settled":
        raise HTTPException(status_code=400, detail="A settled order cannot change status")

    order.status = payload.status
    if payload.status.value in ("settled", "cancelled"):
        order.closed_at = order.closed_at or _now()
        await order_service.release_table(db, ctx.tenant_id, order)

    await db.commit()
    await db.refresh(order)
    return OrderResponse.model_validate(order)


@router.post("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(
    order_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:orders"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    reason: str | None = None,
):
    order = await _get_order_for_ctx(db, ctx, order_id)
    try:
        await order_service.cancel_order(db, ctx.tenant_id, order.id, reason=reason)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    await db.refresh(order)
    return OrderResponse.model_validate(order)


@router.post("/{order_id}/request-bill", response_model=OrderResponse)
async def request_bill(
    order_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:orders"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    order = await _get_order_for_ctx(db, ctx, order_id)
    await order_service.request_bill(db, ctx.tenant_id, order.id)
    await db.commit()
    await db.refresh(order)
    return OrderResponse.model_validate(order)


# ─── Table operations ────────────────────────────────────────────

@router.post("/{order_id}/transfer-table", response_model=OrderResponse)
async def transfer_table(
    order_id: uuid.UUID,
    payload: TransferTableRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("transfer:tables"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    order = await _get_order_for_ctx(db, ctx, order_id)
    try:
        await order_service.transfer_table(
            db, ctx.tenant_id, order.id, payload.target_table_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    await db.refresh(order)
    return OrderResponse.model_validate(order)


@router.post("/{order_id}/merge", response_model=OrderResponse)
async def merge_order(
    order_id: uuid.UUID,
    payload: MergeOrderRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:orders"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_order_for_ctx(db, ctx, order_id)
    try:
        target = await order_service.merge_order(
            db, ctx.tenant_id, order_id, payload.target_order_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    await db.refresh(target)
    return OrderResponse.model_validate(target)


@router.post("/{order_id}/split", response_model=OrderResponse)
async def split_order(
    order_id: uuid.UUID,
    payload: SplitOrderRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("split:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_order_for_ctx(db, ctx, order_id)
    try:
        target = await order_service.split_order(
            db, ctx.tenant_id, order_id,
            order_item_ids=payload.order_item_ids,
            target_order_id=payload.target_order_id,
            new_table_id=payload.new_table_id,
            covers=payload.covers,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    await db.refresh(target)
    return OrderResponse.model_validate(target)


@router.post("/tables/{table_id}/close-session")
async def close_table_session(
    table_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:tables"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Free a table without an order — the floor host's cleanup action."""
    from src.models import RestaurantTable
    table = await db.scalar(
        select(RestaurantTable).where(
            RestaurantTable.id == table_id,
            RestaurantTable.tenant_id == ctx.tenant_id,
        )
    )
    if table is None:
        raise HTTPException(status_code=404, detail="Table not found")
    resolve_outlet_id(ctx, table.outlet_id)

    sessions = (
        await db.execute(
            select(TableSession).where(
                TableSession.table_id == table_id,
                TableSession.status == TableSessionStatus.ACTIVE,
            )
        )
    ).scalars().all()
    for session in sessions:
        session.status = TableSessionStatus.CLOSED
        session.ended_at = _now()

    table.status = TableStatus.FREE
    await db.commit()
    return {"detail": "Table freed", "closed_sessions": len(sessions)}


# ─── Reservations ────────────────────────────────────────────────

@router.post("/reservations", response_model=ReservationResponse,
             status_code=status.HTTP_201_CREATED)
async def create_reservation(
    payload: ReservationCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:reservations"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id)

    # Refuse to double-book a specific table for an overlapping window
    if payload.table_id:
        clash = await _find_reservation_clash(db, ctx.tenant_id, payload)
        if clash:
            raise HTTPException(
                status_code=409,
                detail="That table already has a reservation overlapping this time",
            )

    reservation = Reservation(
        tenant_id=ctx.tenant_id,
        reservation_number=await allocate_number(db, ctx.tenant_id, "reservation", payload.outlet_id),
        status="confirmed",
        **payload.model_dump(),
    )
    db.add(reservation)
    await db.commit()
    await db.refresh(reservation)
    return ReservationResponse.model_validate(reservation)


async def _find_reservation_clash(
    db: AsyncSession, tenant_id: uuid.UUID, payload: ReservationCreate
) -> bool:
    existing = (
        await db.execute(
            select(Reservation).where(
                Reservation.tenant_id == tenant_id,
                Reservation.table_id == payload.table_id,
                Reservation.status.in_(["pending", "confirmed"]),
            )
        )
    ).scalars().all()

    for other in existing:
        if _windows_overlap(
            payload.reserved_from, payload.reserved_to,
            other.reserved_from, other.reserved_to,
        ):
            return True
    return False


def _windows_overlap(a_from: str, a_to: str | None, b_from: str, b_to: str | None) -> bool:
    if not a_from or not b_from:
        return False
    a_end = a_to or a_from
    b_end = b_to or b_from
    return a_from < b_end and b_from < a_end


@router.put("/reservations/{reservation_id}", response_model=ReservationResponse)
async def update_reservation(
    reservation_id: uuid.UUID,
    payload: ReservationCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:reservations"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    reservation = await db.scalar(
        select(Reservation).where(
            Reservation.id == reservation_id,
            Reservation.tenant_id == ctx.tenant_id,
        )
    )
    if reservation is None:
        raise HTTPException(status_code=404, detail="Reservation not found")
    resolve_outlet_id(ctx, reservation.outlet_id)

    for field, value in payload.model_dump(exclude={"outlet_id"}).items():
        setattr(reservation, field, value)

    await db.commit()
    await db.refresh(reservation)
    return ReservationResponse.model_validate(reservation)


@router.put("/reservations/{reservation_id}/status", response_model=ReservationResponse)
async def update_reservation_status(
    reservation_id: uuid.UUID,
    payload: ReservationStatusUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:reservations"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    reservation = await db.scalar(
        select(Reservation).where(
            Reservation.id == reservation_id,
            Reservation.tenant_id == ctx.tenant_id,
        )
    )
    if reservation is None:
        raise HTTPException(status_code=404, detail="Reservation not found")
    resolve_outlet_id(ctx, reservation.outlet_id)

    reservation.status = payload.status
    await db.commit()
    await db.refresh(reservation)
    return ReservationResponse.model_validate(reservation)


@router.post("/reservations/{reservation_id}/seat", response_model=OrderResponse)
async def seat_reservation(
    reservation_id: uuid.UUID,
    payload: SeatReservationRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:reservations"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Turn a reservation into a live dine-in order and occupy its table."""
    reservation = await db.scalar(
        select(Reservation).where(
            Reservation.id == reservation_id,
            Reservation.tenant_id == ctx.tenant_id,
        )
    )
    if reservation is None:
        raise HTTPException(status_code=404, detail="Reservation not found")
    resolve_outlet_id(ctx, reservation.outlet_id)

    if _status_value(reservation.status) == "seated":
        raise HTTPException(status_code=400, detail="This reservation is already seated")
    if _status_value(reservation.status) in ("cancelled", "no_show"):
        raise HTTPException(status_code=400, detail=f"This reservation is {reservation.status}")

    table_id = reservation.table_id
    if table_id is None:
        # Assign the smallest table that fits the party
        table_id = await _auto_assign_table(
            db, ctx.tenant_id, reservation.outlet_id, reservation.covers
        )
        if table_id is None:
            raise HTTPException(
                status_code=409, detail=f"No free table fits {reservation.covers} covers"
            )
        reservation.table_id = table_id

    order = await order_service.create_order(
        db, ctx.tenant_id, OrderCreate(
            outlet_id=reservation.outlet_id,
            order_type="dine_in",
            table_id=table_id,
            covers=reservation.covers,
            customer_id=reservation.customer_id,
            customer_name=reservation.customer_name,
            customer_phone=reservation.customer_phone,
            waiter_id=payload.waiter_id,
            items=[],
        ),
    )
    reservation.status = "seated"

    await db.commit()
    await db.refresh(order)
    return OrderResponse.model_validate(order)


async def _auto_assign_table(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID, covers: int
) -> uuid.UUID | None:
    from src.models import RestaurantTable
    tables = (
        await db.execute(
            select(RestaurantTable).where(
                RestaurantTable.tenant_id == tenant_id,
                RestaurantTable.outlet_id == outlet_id,
                RestaurantTable.status == TableStatus.FREE,
                RestaurantTable.is_active.is_(True),
            )
        )
    ).scalars().all()
    fitting = [t for t in tables if (t.seats or 0) >= covers]
    if not fitting:
        return None
    return min(fitting, key=lambda t: (t.seats or 0, t.sort_order or 0)).id


# ─── Waitlist ────────────────────────────────────────────────────

@router.post("/waitlist", response_model=WaitlistResponse,
             status_code=status.HTTP_201_CREATED)
async def add_to_waitlist(
    payload: WaitlistCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:waitlist"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id)

    entry = Waitlist(
        tenant_id=ctx.tenant_id,
        outlet_id=payload.outlet_id,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        covers=payload.covers,
        requested_at=_now(),
        quoted_wait_minutes=payload.quoted_wait_minutes,
        status=WaitlistStatus.WAITING,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return WaitlistResponse.model_validate(entry)


@router.post("/waitlist/{entry_id}/seat", response_model=OrderResponse)
async def seat_waitlist(
    entry_id: uuid.UUID,
    payload: SeatWaitlistRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:waitlist"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    entry = await db.scalar(
        select(Waitlist).where(Waitlist.id == entry_id, Waitlist.tenant_id == ctx.tenant_id)
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    resolve_outlet_id(ctx, entry.outlet_id)

    if _status_value(entry.status) != "waiting":
        raise HTTPException(status_code=400, detail=f"This entry is already {entry.status}")

    order = await order_service.create_order(
        db, ctx.tenant_id, OrderCreate(
            outlet_id=entry.outlet_id,
            order_type="dine_in",
            table_id=payload.table_id,
            covers=entry.covers,
            customer_name=entry.customer_name,
            customer_phone=entry.customer_phone,
            waiter_id=payload.waiter_id,
            items=[],
        ),
    )
    entry.status = WaitlistStatus.SEATED

    await db.commit()
    await db.refresh(order)
    return OrderResponse.model_validate(order)


@router.delete("/waitlist/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_waitlist(
    entry_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:waitlist"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    entry = await db.scalar(
        select(Waitlist).where(Waitlist.id == entry_id, Waitlist.tenant_id == ctx.tenant_id)
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    resolve_outlet_id(ctx, entry.outlet_id)
    entry.status = WaitlistStatus.CANCELLED
    await db.commit()
