"""POS service endpoints.

Who may call what:
  * ``/orders``, ``/table-sessions`` — ``view:orders``
  * mutating order routes — ``manage:orders``

Events:
  publishes order.placed, order.status.changed, order.cancelled,
            table_session.opened, table_session.closed
  subscribes menu.item.updated / menu.item.deactivated
            (the first consumer pair in the system where both ends exist —
            menu has been publishing since it was built, and nothing until
            now was listening)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.event_bus.bus import Event, bus
from src.services.pos import service as svc
from src.services.pos.models import (
    Order,
    OrderItem,
    OrderItemStatus,
    OrderStatus,
    OrderType,
    Reservation,
    ReservationStatus,
    TableSession,
    TableSessionStatus,
    Waitlist,
    WaitlistStatus,
    status_value,
)
from src.services.pos.schemas import (
    OrderCreate,
    OrderCreateResponse,
    OrderDetailResponse,
    OrderHoldResponse,
    OrderListResponse,
    OrderLineCreate,
    OrderLineUpdate,
    OrderMergeRequest,
    OrderResumeRequest,
    OrderSplitRequest,
    OrderTipUpdate,
    OrderUpdate,
    ReservationCreate,
    ReservationResponse,
    ReservationUpdate,
    TableSessionCreate,
    TableSessionResponse,
    WaitlistCreate,
    WaitlistResponse,
    WaitlistSeatRequest,
    WaitlistUpdate,
)
from src.services.shared.identity import CurrentIdentity

router = APIRouter()


# ─── Consumers ────────────────────────────────────────────────────────────────
# Registered at import time, so this file is the single place to see what the
# POS listens to. It is the first consumer pair in the system where both ends
# already exist: menu has been publishing menu.item.* since it was built, and
# nothing was listening until now.

@bus.on("menu.item.updated", "menu.item.deactivated")
async def _on_menu_change(event: Event) -> None:
    """React to the menu changing while orders are in flight.

    Existing lines keep their snapshot — an order records what was sold, so a
    mid-service price change must not rewrite history. But a menu item the
    menu just deactivated must not keep selling, so that gets flagged on any
    live line for it.

    Do not call ``bus.mark_seen`` here: the consumer loop gates by event_id
    *before* dispatch, and ``publish()`` already claims this process's own
    events. A handler-side call would suppress events the bus never marked.
    """
    item_id = event.data.get("menu_item_id")
    tenant = _tenant(event)
    if not item_id or tenant is None:
        return
    if event.type == "menu.item.deactivated":
        await _flag_deactivated(tenant, item_id)


async def _flag_deactivated(tenant_id: uuid.UUID, item_id: str) -> None:
    """Attach a warning to any in-flight line for an item the menu killed.

    Uses its own session: an event may arrive at any point while the app is up,
    not only during a request, so a request-scoped session is unavailable here.
    Errors propagate — bus.py logs handler failures with a traceback, and
    swallowing them would make a silently-dead consumer look alive. The menu
    change has already committed, so a failed flag is only a missed warning.
    """
    menu_item_id = _coerce_uuid(item_id)
    if menu_item_id is None:
        return
    db = _handler_db()
    try:
        lines = (
            await db.execute(
                select(OrderItem).where(
                    OrderItem.tenant_id == tenant_id,
                    OrderItem.menu_item_id == menu_item_id,
                    OrderItem.status != OrderItemStatus.CANCELLED,
                )
            )
        ).scalars().all()
        marker = "[menu item deactivated]"
        for line in lines:
            if marker not in (line.notes or ""):
                line.notes = f"{line.notes or ''} {marker}".strip()
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    finally:
        await db.close()


def _handler_db() -> AsyncSession:
    """A session owned by an event handler, not by a request."""
    from src.services.pos.main import db as _db

    return _db.session_factory()


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
    """Build an event stamped with this service's name."""
    from src.services.event_bus.bus import Event

    return Event(type=topic, tenant_id=tenant_id, outlet_id=outlet_id,
                 data=data or {}, source_service="pos")


def _outbox(db: AsyncSession, event: Event) -> None:
    """Persist the event to the outbox table in the current transaction.

    The outbox row commits atomically with the domain change, so a committed
    order is never lost even if the bus publish subsequently fails or the
    process crashes. The relay drains pending rows on its next poll.
    """
    from src.services.pos.models import OutboxMessage
    db.add(OutboxMessage(
        event_id=event.event_id,
        type=event.type,
        tenant_id=event.tenant_id,
        outlet_id=event.outlet_id,
        data=event.data,
        source_service="pos",
        status="pending",
    ))


def _stamp() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _stamp().isoformat()


def _coerce_uuid(value) -> uuid.UUID | None:
    """Parse a UUID from event data without raising on bad input.

    Event payloads are JSON, so UUIDs arrive as strings; a malformed one must
    degrade to a skipped event, not a handler exception.
    """
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
    rather than raising — the event is acked and silently dropped — and
    assigning a str to a UUID column raises "invalid input syntax for type
    uuid" on insert. Tolerate the string; downstream expects a UUID.
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


# ─── Orders ──────────────────────────────────────────────────────────────────

@router.get("/orders", response_model=list[OrderListResponse], tags=["orders"])
async def list_orders(
    identity: CurrentIdentity,
    db: DbDep,
    outlet_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    table_id: uuid.UUID | None = None,
    active_only: bool = False,
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
):
    identity.require("view:orders")
    stmt = select(Order).where(Order.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(Order.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    if table_id:
        stmt = stmt.where(Order.table_id == table_id)
    if active_only:
        stmt = stmt.where(Order.status.not_in([OrderStatus.SETTLED, OrderStatus.CANCELLED]))
    stmt = stmt.order_by(Order.created_at.desc()).limit(limit).offset(offset)
    orders = list((await db.execute(stmt)).scalars().all())
    return [OrderListResponse.model_validate(o) for o in orders]


@router.get("/orders/count", response_model=dict, tags=["orders"])
async def count_orders(
    identity: CurrentIdentity,
    db: DbDep,
    outlet_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    active_only: bool = False,
):
    identity.require("view:orders")
    n = await svc.count_orders(db, identity.tenant_id, outlet_id=outlet_id,
                               status_filter=status_filter, active_only=active_only)
    return {"count": n}


@router.post("/orders", response_model=OrderCreateResponse,
             status_code=status.HTTP_201_CREATED, tags=["orders"],
             summary="Create an order and place it")
async def create_order(payload: OrderCreate, identity: CurrentIdentity, db: DbDep):
    """Create a draft, add lines, place it, and emit order.placed.

    Placement and publish are deliberately in one transaction with the DB
    write: if the publish silently dropped, the kitchen would never hear about
    an order that the POS happily showed as placed. The bus itself never raises
    (a broken bus must not fail a sale), so the only real failure here is the
    DB write — and rolling back on that is correct.
    """
    identity.require("manage:orders")
    await _resolve_outlet(identity, payload.outlet_id)

    order = Order(
        tenant_id=identity.tenant_id,
        outlet_id=payload.outlet_id,
        order_number=await svc.allocate_order_number(
            db, identity.tenant_id, payload.outlet_id
        ),
        order_type=payload.order_type,
        status=OrderStatus.DRAFT,
        table_id=payload.table_id,
        section_id=payload.section_id,
        covers=payload.covers,
        waiter_id=payload.waiter_id,
        shift_id=payload.shift_id,
        customer_id=payload.customer_id,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        aggregator_name=payload.aggregator_name,
        aggregator_order_id=payload.aggregator_order_id,
        notes=payload.notes,
        is_parcel=payload.is_parcel,
    )
    db.add(order)
    await db.flush()

    if payload.token_number is None and payload.order_type in (
        OrderType.QSR, OrderType.TAKEAWAY
    ):
        order.token_number = await svc.next_token_number(
            db, identity.tenant_id, payload.outlet_id
        )
    elif payload.token_number is not None:
        order.token_number = payload.token_number

    if payload.lines:
        await svc.add_lines(db, identity.tenant_id, order, payload.lines)
        reloaded = await svc.reload_order(db, order)
        await svc.place_order(db, identity.tenant_id, reloaded)
        order = reloaded
        event = _ev(
            "order.placed",
            identity.tenant_id,
            outlet_id=payload.outlet_id,
            data={
                "order_id": str(order.id),
                "order_number": order.order_number,
                "order_type": status_value(order.order_type),
                "outlet_id": str(order.outlet_id),
                "table_id": str(order.table_id) if order.table_id else None,
                "customer_id": str(order.customer_id) if order.customer_id else None,
                "covers": order.covers,
                "item_count": svc.item_count(order),
                "subtotal": float(order.subtotal),
                "grand_total": float(order.grand_total),
                "lines": svc.order_lines_payload(order),
            },
        )
        _outbox(db, event)
        await bus.publish(event, local=True)
    else:
        order = await svc.reload_order(db, order)

    await _open_table_session_if_any(db, identity.tenant_id, order)

    return OrderCreateResponse(
        id=order.id,
        order_number=order.order_number,
        status=order.status,
        subtotal=float(order.subtotal),
        grand_total=float(order.grand_total),
        item_count=svc.item_count(order),
        items=order.items,
    )


async def _resolve_outlet(identity: CurrentIdentity, outlet_id: uuid.UUID) -> None:
    """Validate this identity may act at this outlet.

    The POS cannot look the outlet up — outlets belong to the organization
    service — so it trusts the ID and enforces the tenant's outlet scope from
    the token. A wrong scope returns 403, not a silent cross-outlet write.
    """
    if not identity.can_access_outlet(outlet_id):
        raise HTTPException(
            status_code=403,
            detail=f"Not authorised for outlet {outlet_id}",
        )


async def _open_table_session_if_any(db: AsyncSession, tenant_id: uuid.UUID, order: Order) -> None:
    """A dine-in order on a table starts its occupancy record."""
    if order.order_type != OrderType.DINE_IN or not order.table_id:
        return
    existing = await db.scalar(
        select(TableSession.id).where(
            TableSession.tenant_id == tenant_id,
            TableSession.table_id == order.table_id,
            TableSession.status == TableSessionStatus.ACTIVE,
        )
    )
    if existing:
        return
    session = TableSession(
        tenant_id=tenant_id,
        outlet_id=order.outlet_id,
        table_id=order.table_id,
        order_id=order.id,
        status=TableSessionStatus.ACTIVE,
        covers=order.covers,
        waiter_id=order.waiter_id,
        started_at=_stamp(),
    )
    db.add(session)
    await db.flush()
    event = _ev(
        "table_session.opened", tenant_id, outlet_id=order.outlet_id,
        data={"session_id": str(session.id), "table_id": str(order.table_id),
              "order_id": str(order.id), "covers": order.covers},
    )
    _outbox(db, event)
    await bus.publish(event, local=True)


@router.get("/orders/{order_id}", response_model=OrderDetailResponse, tags=["orders"])
async def get_order(order_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:orders")
    order = await svc.load_order(db, identity.tenant_id, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if not identity.can_access_outlet(order.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    return order


@router.post("/orders/{order_id}/lines", response_model=OrderDetailResponse,
             status_code=status.HTTP_201_CREATED, tags=["orders"],
             summary="Add lines to an open order")
@router.post("/orders/{order_id}/items", response_model=OrderDetailResponse,
             status_code=status.HTTP_201_CREATED, tags=["orders"],
             summary="Add items to an open order")
async def add_lines(order_id: uuid.UUID, lines: list[OrderLineCreate] | OrderLineCreate,
                    identity: CurrentIdentity, db: DbDep):
    identity.require("manage:orders")
    items_to_add = lines if isinstance(lines, list) else [lines]
    order = await svc.load_order(db, identity.tenant_id, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if not identity.can_access_outlet(order.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    if status_value(order.status) not in (OrderStatus.DRAFT, OrderStatus.PLACED,
                                          OrderStatus.IN_KITCHEN):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot add lines to an order in status {status_value(order.status)}",
        )
    order = await svc.add_lines(db, identity.tenant_id, order, items_to_add)
    return order


@router.patch("/orders/{order_id}", response_model=OrderDetailResponse, tags=["orders"])
async def update_order(order_id: uuid.UUID, payload: OrderUpdate,
                       identity: CurrentIdentity, db: DbDep):
    identity.require("manage:orders")
    order = await svc.load_order(db, identity.tenant_id, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if not identity.can_access_outlet(order.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")

    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "status":
            continue
        setattr(order, field, value)

    await _emit_status_change(db, identity.tenant_id, order, payload.status)
    return order


@router.patch("/orders/{order_id}/items/{item_id}",
              response_model=OrderDetailResponse, tags=["orders"],
              summary="Adjust a line — quantity, discount, or status")
async def update_item(order_id: uuid.UUID, item_id: uuid.UUID, payload: OrderLineUpdate,
                      identity: CurrentIdentity, db: DbDep):
    identity.require("manage:orders")
    order = await svc.load_order(db, identity.tenant_id, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if not identity.can_access_outlet(order.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")

    item = None
    for candidate in order.items or []:
        if candidate.id == item_id:
            item = candidate
            break
    if item is None:
        raise HTTPException(status_code=404, detail="Order item not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "qty":
            item.qty = int(value)
        elif field == "unit_price":
            item.unit_price = value
        elif field == "discount_pct":
            item.discount_pct = value
            item.discount_amount = svc._money(
                svc._d(item.unit_price) * svc._d(item.qty) * svc._d(value) / 100
            )
        elif field == "notes":
            item.notes = value
        elif field == "status" and value is not None:
            item.status = value
    item.total = svc._money(
        svc._d(item.unit_price) * svc._d(item.qty)
        + sum(svc._d(a.price) * svc._d(a.qty) for a in (item.addons or []))
        - svc._d(item.discount_amount) + svc._d(item.tax_amount)
    )
    await svc._sync_position(db, identity.tenant_id, order)
    await svc.ensure_courses(db, identity.tenant_id, order)
    await svc.recalculate_order(db, order)
    return order


@router.post("/orders/{order_id}/hold", response_model=OrderHoldResponse,
             tags=["orders"],
             summary="Park a live order — the guest stepped out, the food was already fired")
async def hold_order(order_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    """A hold is a pause, not a cancel: the KOT already fired, the table is
    still occupied, and resuming must not re-fire the kitchen. Distinct from
    DRAFT because this order's food is already committed; distinct from
    CANCELLED because the guest is coming back."""
    identity.require("manage:orders")
    order = await svc.load_order(db, identity.tenant_id, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if not identity.can_access_outlet(order.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    try:
        await svc.hold_order(db, identity.tenant_id, order)
    except svc.PosError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return order


@router.post("/orders/{order_id}/resume", response_model=OrderDetailResponse,
             tags=["orders"],
             summary="Un-park a held order, optionally into a specific state")
async def resume_order(order_id: uuid.UUID, payload: OrderResumeRequest,
                       identity: CurrentIdentity, db: DbDep):
    identity.require("manage:orders")
    order = await svc.load_order(db, identity.tenant_id, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if not identity.can_access_outlet(order.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    try:
        await svc.resume_order(db, identity.tenant_id, order, to=payload.to_status)
    except svc.PosError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    await _emit_status_change(db, identity.tenant_id, order, payload.to_status)
    return order


@router.post("/orders/{order_id}/void", response_model=OrderDetailResponse,
             tags=["orders"],
             summary="Full void of a pre-bill order — every line cancelled")
async def void_order(order_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    """The POS attendant's 'guest never actually ordered this' case, pre-bill.
    Void is the clean version of cancel: it only works while nothing has been
    committed to the kitchen, so no stock was ever deducted and no KOT was
    ever fired — the order disappears without leaving a paper trail in the
    kitchen or the ledger."""
    identity.require("manage:orders")
    order = await svc.load_order(db, identity.tenant_id, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if not identity.can_access_outlet(order.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    try:
        await svc.void_order(db, identity.tenant_id, order)
    except svc.PosError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    event = _ev(
        "order.cancelled", identity.tenant_id, outlet_id=order.outlet_id,
        data={"order_id": str(order.id), "reason": "voided pre-bill",
              "grand_total": float(order.grand_total)},
    )
    _outbox(db, event)
    await bus.publish(event, local=True)
    return order


@router.post("/orders/{order_id}/split", response_model=list[OrderDetailResponse],
             tags=["orders"],
             summary="Split one order into N, each with a fresh order number")
async def split_order(order_id: uuid.UUID, payload: OrderSplitRequest,
                      identity: CurrentIdentity, db: DbDep):
    """A group of 4 splitting a check into 2 groups of 2 — the case this
    exists for, and the one that has no alternative: without it, each new
    check means re-ordering, which means the kitchen fires each dish again.
    """
    identity.require("manage:orders")
    order = await svc.load_order(db, identity.tenant_id, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if not identity.can_access_outlet(order.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    try:
        new_orders = await svc.split_order(db, identity.tenant_id, order, payload.buckets)
    except svc.PosError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Every new order is a real order in its own right: place it, fire the
    # kitchen for its share of the lines, and the bill service will settle
    # them independently.
    for new_order in new_orders:
        new_order = await svc.reload_order(db, new_order)
        if status_value(new_order.status) == OrderStatus.DRAFT.value:
            await svc.place_order(db, identity.tenant_id, new_order)
        event = _ev(
            "order.placed", identity.tenant_id, outlet_id=new_order.outlet_id,
            data={
                "order_id": str(new_order.id),
                "order_number": new_order.order_number,
                "order_type": status_value(new_order.order_type),
                "outlet_id": str(new_order.outlet_id),
                "table_id": str(new_order.table_id) if new_order.table_id else None,
                "covers": new_order.covers,
                "item_count": svc.item_count(new_order),
                "subtotal": float(new_order.subtotal),
                "grand_total": float(new_order.grand_total),
                "lines": svc.order_lines_payload(new_order),
            },
        )
        _outbox(db, event)
        await bus.publish(event, local=True)

    return [await svc.reload_order(db, o) for o in new_orders]


@router.post("/orders/{order_id}/merge", response_model=OrderDetailResponse,
             tags=["orders"],
             summary="Merge two open, same-table orders into one check")
async def merge_orders(order_id: uuid.UUID, payload: OrderMergeRequest,
                       identity: CurrentIdentity, db: DbDep):
    """The reverse of split: two checks that should have been one get
    reconciled before settlement. order_a (this route's param) survives;
    order_b is cancelled with a note, not deleted, so the merge stays
    auditable."""
    identity.require("manage:orders")
    order_a = await svc.load_order(db, identity.tenant_id, order_id)
    if order_a is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if not identity.can_access_outlet(order_a.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    order_b = await svc.load_order(db, identity.tenant_id, payload.order_b_id)
    if order_b is None:
        raise HTTPException(status_code=404, detail="Second order not found")
    try:
        merged = await svc.merge_orders(db, identity.tenant_id, order_a, order_b)
        merged = await svc.reload_order(db, merged)
        await svc.recalculate_order(db, merged)
    except svc.PosError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return merged


@router.post("/orders/{order_id}/tip", response_model=OrderDetailResponse,
             tags=["orders"],
             summary="Set the gratuity on a live order — additive to the check total")
async def set_order_tip(order_id: uuid.UUID, payload: OrderTipUpdate,
                       identity: CurrentIdentity, db: DbDep):
    """Tip is a separate, additive amount — not a line, not a discount —
    and it is the staff service's tip-pool feed. The bill shows it; the
    pool distributes it."""
    identity.require("manage:orders")
    order = await svc.load_order(db, identity.tenant_id, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if not identity.can_access_outlet(order.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    order.tip_total = svc._money(svc._d(payload.tip_total))
    await svc.recalculate_order(db, order)
    return order


@router.delete("/orders/{order_id}/items/{item_id}",
               response_model=OrderDetailResponse, tags=["orders"],
               summary="Remove a line from a pre-bill order")
async def delete_order_item(order_id: uuid.UUID, item_id: uuid.UUID,
                            identity: CurrentIdentity, db: DbDep):
    """Pre-bill line removal. The line is marked CANCELLED, not deleted,
    for the same reason cancel_order works that way: a bill still has to be
    explainable after the fact, and a hard delete would make that
    impossible."""
    identity.require("manage:orders")
    order = await svc.load_order(db, identity.tenant_id, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if not identity.can_access_outlet(order.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    if status_value(order.status) in (OrderStatus.SETTLED.value, OrderStatus.CANCELLED.value):
        raise HTTPException(status_code=409, detail="Lines can only be removed before billing")

    item = None
    for candidate in order.items or []:
        if candidate.id == item_id:
            item = candidate
            break
    if item is None:
        raise HTTPException(status_code=404, detail="Order item not found")
    item.status = OrderItemStatus.CANCELLED
    await svc._sync_position(db, identity.tenant_id, order)
    await svc.ensure_courses(db, identity.tenant_id, order)
    await svc.recalculate_order(db, order)
    return order


@router.post("/orders/{order_id}/cancel", response_model=OrderDetailResponse,
             tags=["orders"], summary="Cancel an order and notify consumers")
async def cancel_order(order_id: uuid.UUID, identity: CurrentIdentity, db: DbDep,
                       reason: str | None = Query(default=None, max_length=300)):
    identity.require("manage:orders")
    order = await svc.load_order(db, identity.tenant_id, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if not identity.can_access_outlet(order.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    try:
        await svc.cancel_order(db, identity.tenant_id, order, reason)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    event = _ev(
        "order.cancelled", identity.tenant_id, outlet_id=order.outlet_id,
        data={"order_id": str(order.id), "reason": reason,
              "grand_total": float(order.grand_total)},
    )
    _outbox(db, event)
    await bus.publish(event, local=True)
    return order


async def _emit_status_change(db: AsyncSession, tenant_id: uuid.UUID,
                              order: Order, to: OrderStatus | None) -> None:
    """Validate and emit a status transition, or do nothing."""
    if to is None or status_value(order.status) == to.value:
        return
    before = status_value(order.status)
    try:
        await svc.update_order_status(db, tenant_id, order, to)
    except svc.PosError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    event = _ev(
        "order.status.changed", tenant_id, outlet_id=order.outlet_id,
        data={"order_id": str(order.id),
              "order_number": order.order_number,
              "from": before,
              "to": status_value(order.status)},
    )
    _outbox(db, event)
    await bus.publish(event, local=True)


# ─── Table sessions ──────────────────────────────────────────────────────────

@router.post("/table-sessions", response_model=TableSessionResponse,
             status_code=status.HTTP_201_CREATED, tags=["tables"])
async def create_table_session(payload: TableSessionCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:orders")
    await _resolve_outlet(identity, payload.outlet_id)
    session = TableSession(
        tenant_id=identity.tenant_id,
        outlet_id=payload.outlet_id,
        table_id=payload.table_id,
        order_id=payload.order_id,
        status=TableSessionStatus.ACTIVE,
        covers=payload.covers,
        waiter_id=payload.waiter_id,
        started_at=_stamp(),
    )
    db.add(session)
    await db.flush()
    event = _ev(
        "table_session.opened", identity.tenant_id, outlet_id=payload.outlet_id,
        data={"session_id": str(session.id), "table_id": str(payload.table_id),
              "order_id": str(payload.order_id), "covers": payload.covers},
    )
    _outbox(db, event)
    await bus.publish(event, local=True)
    return session


@router.get("/table-sessions", response_model=list[TableSessionResponse], tags=["tables"])
async def list_table_sessions(identity: CurrentIdentity, db: DbDep,
                              outlet_id: uuid.UUID | None = None):
    identity.require("view:orders")
    stmt = select(TableSession).where(TableSession.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(TableSession.outlet_id == outlet_id)
    stmt = stmt.order_by(TableSession.created_at.desc())
    return list((await db.execute(stmt)).scalars().all())


@router.post("/table-sessions/{session_id}/close",
             response_model=TableSessionResponse, tags=["tables"])
async def close_table_session(session_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:orders")
    session = await db.scalar(
        select(TableSession).where(
            TableSession.id == session_id,
            TableSession.tenant_id == identity.tenant_id,
        )
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Table session not found")
    if not identity.can_access_outlet(session.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    if status_value(session.status) == TableSessionStatus.CLOSED:
        return session
    session.status = TableSessionStatus.CLOSED
    session.ended_at = _stamp()
    await db.flush()
    event = _ev(
        "table_session.closed", identity.tenant_id, outlet_id=session.outlet_id,
        data={"session_id": str(session.id), "table_id": str(session.table_id),
              "order_id": str(session.order_id) if session.order_id else None},
    )
    _outbox(db, event)
    await bus.publish(event, local=True)
    return session


# ─── Reservations ────────────────────────────────────────────────────────────

@router.post("/reservations", response_model=ReservationResponse,
             status_code=status.HTTP_201_CREATED, tags=["reservations"])
async def create_reservation(payload: ReservationCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:orders")
    await _resolve_outlet(identity, payload.outlet_id)
    if payload.reserved_to and payload.reserved_to <= payload.reserved_from:
        raise HTTPException(status_code=422, detail="reserved_to must be after reserved_from")
    if payload.table_id:
        conflict = await svc.find_reservation_conflict(
            db, identity.tenant_id, payload.outlet_id, payload.table_id,
            payload.reserved_from, payload.reserved_to,
        )
        if conflict is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Table {payload.table_id} already has booking "
                    f"{conflict.reservation_number or conflict.id} for an "
                    f"overlapping window"
                ),
            )
    reservation = Reservation(
        tenant_id=identity.tenant_id,
        **payload.model_dump(),
    )
    db.add(reservation)
    await db.flush()
    return reservation


@router.get("/reservations", response_model=list[ReservationResponse], tags=["reservations"])
async def list_reservations(identity: CurrentIdentity, db: DbDep,
                            outlet_id: uuid.UUID | None = None,
                            status_filter: str | None = None):
    identity.require("view:orders")
    stmt = select(Reservation).where(Reservation.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(Reservation.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(Reservation.status == status_filter)
    stmt = stmt.order_by(Reservation.reserved_from.asc())
    return list((await db.execute(stmt)).scalars().all())


@router.patch("/reservations/{reservation_id}", response_model=ReservationResponse,
              tags=["reservations"])
async def update_reservation(reservation_id: uuid.UUID, payload: ReservationUpdate,
                             identity: CurrentIdentity, db: DbDep):
    identity.require("manage:orders")
    reservation = await db.scalar(
        select(Reservation).where(
            Reservation.id == reservation_id,
            Reservation.tenant_id == identity.tenant_id,
        )
    )
    if reservation is None:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if not identity.can_access_outlet(reservation.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(reservation, field, value)
    await db.flush()
    return reservation


# ─── Waitlist ────────────────────────────────────────────────────────────────

@router.post("/waitlist", response_model=WaitlistResponse,
             status_code=status.HTTP_201_CREATED, tags=["waitlist"])
async def create_waitlist(payload: WaitlistCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:orders")
    await _resolve_outlet(identity, payload.outlet_id)
    entry = Waitlist(tenant_id=identity.tenant_id, **payload.model_dump())
    db.add(entry)
    await db.flush()
    return entry


@router.get("/waitlist", response_model=list[WaitlistResponse], tags=["waitlist"])
async def list_waitlist(identity: CurrentIdentity, db: DbDep,
                        outlet_id: uuid.UUID | None = None):
    identity.require("view:orders")
    stmt = select(Waitlist).where(Waitlist.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(Waitlist.outlet_id == outlet_id)
    stmt = stmt.where(Waitlist.status == WaitlistStatus.WAITING)
    stmt = stmt.order_by(Waitlist.requested_at.asc())
    return list((await db.execute(stmt)).scalars().all())


@router.patch("/waitlist/{entry_id}", response_model=WaitlistResponse, tags=["waitlist"])
async def update_waitlist(entry_id: uuid.UUID, payload: WaitlistUpdate,
                          identity: CurrentIdentity, db: DbDep):
    identity.require("manage:orders")
    entry = await db.scalar(
        select(Waitlist).where(
            Waitlist.id == entry_id,
            Waitlist.tenant_id == identity.tenant_id,
        )
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    if not identity.can_access_outlet(entry.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    await db.flush()
    return entry


@router.post("/waitlist/{entry_id}/seat", response_model=WaitlistResponse,
             tags=["waitlist"],
             summary="Seat a waiting party at a table — one atomic step")
async def seat_from_waitlist(entry_id: uuid.UUID, payload: WaitlistSeatRequest,
                             identity: CurrentIdentity, db: DbDep):
    """The host's 'your table is ready' moment, done as one transaction:
    close the waitlist entry AND open the table session together. Doing
    them as two separate calls is the exact failure mode this exists to
    prevent — a guest moved to a table with no order started, or a table
    marked occupied with no one in it."""
    identity.require("manage:orders")
    entry = await db.scalar(
        select(Waitlist).where(
            Waitlist.id == entry_id,
            Waitlist.tenant_id == identity.tenant_id,
        )
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    if not identity.can_access_outlet(entry.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    if status_value(entry.status) != WaitlistStatus.WAITING.value:
        raise HTTPException(status_code=409, detail="Entry is no longer waiting")

    entry.status = WaitlistStatus.SEATED
    entry.table_id = payload.table_id
    session = TableSession(
        tenant_id=identity.tenant_id,
        outlet_id=entry.outlet_id,
        table_id=payload.table_id,
        status=TableSessionStatus.ACTIVE,
        covers=entry.covers,
        started_at=_stamp(),
    )
    db.add(session)
    await db.flush()
    event = _ev(
        "table_session.opened", identity.tenant_id, outlet_id=entry.outlet_id,
        data={"session_id": str(session.id), "table_id": str(payload.table_id),
              "order_id": None, "covers": entry.covers},
    )
    _outbox(db, event)
    await bus.publish(event, local=True)
    return entry
