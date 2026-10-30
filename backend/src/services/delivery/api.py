"""Delivery service endpoints.

Who may call what:
  * ``/delivery-boys``, ``/delivery-zones``, ``/deliveries`` read — ``view:delivery``
  * create / patch / status moves — ``manage:delivery``

Events:
  subscribes order.placed (open an unassigned delivery for delivery-type orders),
             order.cancelled (cancel the order's open delivery)
  publishes  delivery.created, delivery.assigned, delivery.delivered,
             delivery.cancelled

The dispatch flow is event-driven: pos places a delivery order, this service
reacts with an unassigned ``Delivery`` on the board; a dispatcher assigns a
boy here (or the board does it), and status moves drive the KOT-adjacent
state the pos and reports services listen for.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status as http_status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.delivery import service as svc
from src.services.delivery.models import (
    Delivery,
    DeliveryBoy,
    DeliveryStatus,
    DeliveryStatusLog,
    DeliveryZone,
    OutboxMessage,
    status_value,
)
from src.services.delivery.schemas import (
    DeliveryBoyCreate,
    DeliveryBoyResponse,
    DeliveryBoyUpdate,
    DeliveryCreate,
    DeliveryLiveItem,
    DeliveryResponse,
    DeliveryStatusUpdate,
    DeliveryZoneCreate,
    DeliveryZoneResponse,
    DeliveryZoneUpdate,
)
from src.services.event_bus.bus import Event, bus
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


def _ev(topic, tenant_id=None, outlet_id=None, data=None):
    return Event(type=topic, tenant_id=tenant_id, outlet_id=outlet_id,
                 data=data or {}, source_service="delivery")


async def _refresh_relations(db: AsyncSession, delivery: Delivery) -> None:
    """Force the boy/zone relationships to re-issue their SELECTs.

    A plain re-fetch is not enough: the session runs with
    expire_on_commit=False, so an attribute already loaded (even as None,
    before the boy was attached in this same request) survives the second
    select — selectinload only fills *expired* attributes. Without this the
    assign/create responses show a boy_id with boy_name still null.
    """
    await db.refresh(delivery, attribute_names=["boy", "zone"])


def _outbox(db: AsyncSession, event: Event) -> None:
    """Write the event to the outbox inside the current transaction.

    The outbox row is added to the same session that owns the domain change,
    so both commit or roll back together. The relay background task picks up
    pending rows and pushes them to the event bus.
    """
    db.add(OutboxMessage(
        event_id=event.event_id,
        type=event.type,
        tenant_id=event.tenant_id,
        outlet_id=event.outlet_id,
        data=event.data,
        source_service=event.source_service,
        status="pending",
    ))


def _today_start() -> datetime:
    """The start of today's local date, UTC — the live board's window.

    A delivery opened today is a live delivery; the board only shows today's
    open work. Comparing the (tz-aware) ``created_at`` against this avoids any
    dialect-specific date() cast.
    """
    today = date.today()
    return datetime(today.year, today.month, today.day, tzinfo=timezone.utc)


def _check_outlet(identity: CurrentIdentity, outlet_id: uuid.UUID | None) -> None:
    """Outlet-scoped routes must only act on an outlet the identity may reach."""
    if outlet_id is not None and not identity.can_access_outlet(outlet_id):
        raise HTTPException(
            status_code=403, detail=f"Not authorised for outlet {outlet_id}"
        )


def _to_response(delivery: Delivery) -> DeliveryResponse:
    """A delivery joined to its boy/zone — the board wants one flat object."""
    base = DeliveryResponse.model_validate(delivery)
    base.status = status_value(delivery.status)
    base.boy_name = delivery.boy.name if delivery.boy else None
    base.zone_name = delivery.zone.name if delivery.zone else None
    return base


# ─── Delivery boys ───────────────────────────────────────────────────────────

@router.get("/delivery-boys", response_model=list[DeliveryBoyResponse],
            tags=["delivery"])
async def list_delivery_boys(identity: CurrentIdentity, db: DbDep,
                            outlet_id: uuid.UUID | None = None,
                            active: bool | None = None,
                            q: str | None = Query(default=None, max_length=100)):
    identity.require("view:delivery")
    _check_outlet(identity, outlet_id)
    stmt = select(DeliveryBoy).where(DeliveryBoy.tenant_id == identity.tenant_id)
    if outlet_id is not None:
        stmt = stmt.where(DeliveryBoy.outlet_id == outlet_id)
    if active is not None:
        stmt = stmt.where(DeliveryBoy.active.is_(active))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(
            DeliveryBoy.name.ilike(like),
            DeliveryBoy.phone.ilike(like),
            DeliveryBoy.email.ilike(like),
        ))
    stmt = stmt.order_by(DeliveryBoy.name.asc())
    return list((await db.execute(stmt)).scalars().all())


@router.post("/delivery-boys", response_model=DeliveryBoyResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["delivery"])
async def create_delivery_boy(payload: DeliveryBoyCreate,
                              identity: CurrentIdentity, db: DbDep):
    identity.require("manage:delivery")
    _check_outlet(identity, payload.outlet_id)
    boy = DeliveryBoy(tenant_id=identity.tenant_id, **payload.model_dump())
    db.add(boy)
    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(status_code=409,
                             detail="A boy with this phone already exists for that outlet")
    return boy


@router.patch("/delivery-boys/{boy_id}", response_model=DeliveryBoyResponse,
              tags=["delivery"])
async def update_delivery_boy(boy_id: uuid.UUID, payload: DeliveryBoyUpdate,
                              identity: CurrentIdentity, db: DbDep):
    identity.require("manage:delivery")
    boy = await svc.load_boy(db, identity.tenant_id, boy_id)
    if boy is None:
        raise HTTPException(status_code=404, detail="Delivery boy not found")
    _check_outlet(identity, boy.outlet_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(boy, field, value)
    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(status_code=409,
                            detail="A boy with this phone already exists for that outlet")
    return boy


# ─── Delivery zones ──────────────────────────────────────────────────────────

@router.get("/delivery-zones", response_model=list[DeliveryZoneResponse],
            tags=["delivery"])
async def list_delivery_zones(identity: CurrentIdentity, db: DbDep,
                              outlet_id: uuid.UUID | None = None):
    identity.require("view:delivery")
    _check_outlet(identity, outlet_id)
    stmt = select(DeliveryZone).where(DeliveryZone.tenant_id == identity.tenant_id)
    if outlet_id is not None:
        stmt = stmt.where(DeliveryZone.outlet_id == outlet_id)
    stmt = stmt.order_by(DeliveryZone.name.asc())
    return list((await db.execute(stmt)).scalars().all())


@router.post("/delivery-zones", response_model=DeliveryZoneResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["delivery"])
async def create_delivery_zone(payload: DeliveryZoneCreate,
                               identity: CurrentIdentity, db: DbDep):
    identity.require("manage:delivery")
    _check_outlet(identity, payload.outlet_id)
    zone = DeliveryZone(tenant_id=identity.tenant_id, **payload.model_dump())
    db.add(zone)
    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(status_code=409,
                            detail="A zone with this name already exists for that outlet")
    return zone


@router.patch("/delivery-zones/{zone_id}", response_model=DeliveryZoneResponse,
              tags=["delivery"])
async def update_delivery_zone(zone_id: uuid.UUID, payload: DeliveryZoneUpdate,
                               identity: CurrentIdentity, db: DbDep):
    identity.require("manage:delivery")
    zone = await svc.load_zone(db, identity.tenant_id, zone_id)
    if zone is None:
        raise HTTPException(status_code=404, detail="Delivery zone not found")
    _check_outlet(identity, zone.outlet_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(zone, field, value)
    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(status_code=409,
                            detail="A zone with this name already exists for that outlet")
    return zone


# ─── Deliveries ──────────────────────────────────────────────────────────────

@router.get("/deliveries", response_model=list[DeliveryResponse], tags=["delivery"],
            summary="List deliveries (optionally the live board with live=1)")
async def list_deliveries(identity: CurrentIdentity, db: DbDep,
                          outlet_id: uuid.UUID | None = None,
                          status: str | None = None,
                          order_id: uuid.UUID | None = None,
                          live: bool = Query(default=False),
                          limit: int = Query(default=100, le=500)):
    """List deliveries, or — with ``live=1`` — the open board for today.

    ``live`` returns open deliveries (assigned/delivering) created today,
    newest-assigned first: that is what the dispatch screen polls.
    """
    identity.require("view:delivery")
    _check_outlet(identity, outlet_id)
    stmt = select(Delivery).options(
        selectinload(Delivery.boy), selectinload(Delivery.zone)
    ).where(Delivery.tenant_id == identity.tenant_id)
    if outlet_id is not None:
        stmt = stmt.where(Delivery.outlet_id == outlet_id)
    if live:
        today_start = _today_start()
        stmt = stmt.where(
            Delivery.status.in_([
                status_value(DeliveryStatus.ASSIGNED),
                status_value(DeliveryStatus.DELIVERING),
            ]),
            Delivery.created_at >= today_start,
        ).order_by(Delivery.assigned_at.desc().nulls_last())
    else:
        if status is not None:
            stmt = stmt.where(Delivery.status == status)
        if order_id is not None:
            stmt = stmt.where(Delivery.order_id == order_id)
        stmt = stmt.order_by(Delivery.created_at.desc())
    stmt = stmt.limit(limit)
    rows = list((await db.execute(stmt)).scalars().all())
    return [_to_response(d) for d in rows]


# Registered BEFORE /deliveries/{delivery_id}: "live" is a literal segment and
# a parametrised route matched first would swallow it as a bad UUID.
@router.get("/deliveries/live", response_model=list[DeliveryLiveItem],
            tags=["delivery"],
            summary="Open deliveries of today, each with its boy — the dispatch board")
async def live_board(identity: CurrentIdentity, db: DbDep,
                     outlet_id: uuid.UUID | None = None):
    """The dispatch screen's data: open deliveries joined to their boys."""
    identity.require("view:delivery")
    _check_outlet(identity, outlet_id)
    today_start = _today_start()
    stmt = (
        select(Delivery)
        .options(selectinload(Delivery.boy), selectinload(Delivery.zone))
        .where(
            Delivery.tenant_id == identity.tenant_id,
            Delivery.status.in_([
                status_value(DeliveryStatus.ASSIGNED),
                status_value(DeliveryStatus.DELIVERING),
            ]),
            Delivery.created_at >= today_start,
        )
        .order_by(Delivery.assigned_at.desc().nulls_last())
    )
    if outlet_id is not None:
        stmt = stmt.where(Delivery.outlet_id == outlet_id)
    rows = list((await db.execute(stmt)).scalars().all())
    return [
        DeliveryLiveItem(
            delivery=_to_response(d),
            boy=DeliveryBoyResponse.model_validate(d.boy) if d.boy else None,
        )
        for d in rows
    ]


@router.get("/deliveries/{delivery_id}", response_model=DeliveryResponse,
            tags=["delivery"])
async def get_delivery(delivery_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:delivery")
    delivery = await svc.load_delivery(db, identity.tenant_id, delivery_id)
    if delivery is None:
        raise HTTPException(status_code=404, detail="Delivery not found")
    _check_outlet(identity, delivery.outlet_id)
    return _to_response(delivery)


@router.get("/deliveries/{delivery_id}/logs",
            response_model=list[dict], tags=["delivery"],
            summary="Append-only state trail for one delivery")
async def delivery_logs(delivery_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:delivery")
    delivery = await svc.load_delivery(db, identity.tenant_id, delivery_id)
    if delivery is None:
        raise HTTPException(status_code=404, detail="Delivery not found")
    _check_outlet(identity, delivery.outlet_id)
    rows = list((await db.execute(
        select(DeliveryStatusLog)
        .where(DeliveryStatusLog.delivery_id == delivery_id)
        .order_by(DeliveryStatusLog.at.asc())
    )).scalars().all())
    return [
        {"id": r.id, "delivery_id": r.delivery_id, "from_status": r.from_status,
         "to_status": r.to_status, "at": r.at, "note": r.note}
        for r in rows
    ]


@router.post("/deliveries", response_model=DeliveryResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["delivery"],
             summary="Open a dispatch for an order — assign a boy or leave it pending")
async def create_delivery(payload: DeliveryCreate, identity: CurrentIdentity, db: DbDep):
    """Create the delivery for an order.

    With a boy attached the delivery is ASSIGNED immediately and the outbox
    records ``delivery.assigned``; without one it sits pending on the board
    (ASSIGNED, no boy) and the outbox records ``delivery.created``. The unique
    (tenant, order) index is the guard: a duplicate returns the existing row.
    """
    identity.require("manage:delivery")
    _check_outlet(identity, payload.outlet_id)

    existing = await svc.find_delivery_for_order(db, identity.tenant_id, payload.order_id)
    if existing is not None:
        raise HTTPException(status_code=409,
                            detail="A delivery already exists for this order")

    try:
        delivery = await svc.create_delivery(
            db, identity.tenant_id, payload.order_id,
            outlet_id=payload.outlet_id, zone_id=payload.zone_id,
            boy_id=payload.boy_id, notes=payload.notes,
        )
    except svc.DeliveryError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    boy = await svc.load_boy(db, identity.tenant_id, payload.boy_id) if payload.boy_id else None

    if boy is not None:
        event = _ev(
            "delivery.assigned", identity.tenant_id, outlet_id=delivery.outlet_id,
            data={
                "delivery_id": str(delivery.id),
                "order_id": str(delivery.order_id),
                "boy_id": str(boy.id),
                "boy_name": boy.name,
            },
        )
    else:
        event = _ev(
            "delivery.created", identity.tenant_id, outlet_id=delivery.outlet_id,
            data={
                "delivery_id": str(delivery.id),
                "order_id": str(delivery.order_id),
                "outlet_id": str(delivery.outlet_id) if delivery.outlet_id else None,
                "zone_id": str(payload.zone_id) if payload.zone_id else None,
                "status": "assigned",
            },
        )
    _outbox(db, event)
    await db.commit()
    await bus.publish(event, local=True)
    # Re-fetch with boy/zone eager-loaded so the response serialises without a
    # lazy load (a fresh row's relationships are not in the session yet).
    fresh = await svc.load_delivery(db, identity.tenant_id, delivery.id)
    await _refresh_relations(db, fresh)
    return _to_response(fresh)


@router.post("/deliveries/{delivery_id}/assign", response_model=DeliveryResponse,
             tags=["delivery"], summary="Attach a boy to a pending delivery")
async def assign_delivery(delivery_id: uuid.UUID, payload: DeliveryCreate,
                          identity: CurrentIdentity, db: DbDep):
    """Assign a boy to an open delivery. Only meaningful while it is still open."""
    identity.require("manage:delivery")
    delivery = await svc.load_delivery(db, identity.tenant_id, delivery_id)
    if delivery is None:
        raise HTTPException(status_code=404, detail="Delivery not found")
    _check_outlet(identity, delivery.outlet_id)
    if payload.boy_id is None:
        raise HTTPException(status_code=400, detail="boy_id is required to assign")
    try:
        boy = await svc.load_boy(db, identity.tenant_id, payload.boy_id)
        if boy is None:
            raise HTTPException(status_code=404, detail="Delivery boy not found")
        await svc.attach_boy(db, delivery, boy, note=payload.notes)
    except svc.DeliveryError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    # The frontend dispatch dialog sends the zone alongside the boy; drop it
    # into the row when provided (validate it is our tenant's zone first).
    if payload.zone_id is not None:
        zone = await svc.load_zone(db, identity.tenant_id, payload.zone_id)
        if zone is None:
            raise HTTPException(status_code=404, detail="Delivery zone not found")
        delivery.zone_id = zone.id
        await db.flush()

    event = _ev(
        "delivery.assigned", identity.tenant_id, outlet_id=delivery.outlet_id,
        data={
            "delivery_id": str(delivery.id),
            "order_id": str(delivery.order_id),
            "boy_id": str(boy.id),
            "boy_name": boy.name,
        },
    )
    _outbox(db, event)
    await db.commit()
    await bus.publish(event, local=True)
    # Re-fetch so the boy/zone reflect what we just attached; with
    # expire_on_commit=False the re-fetch alone leaves the stale (None)
    # relationship in the identity map, so force it to re-issue its SELECT.
    fresh = await svc.load_delivery(db, identity.tenant_id, delivery_id)
    await _refresh_relations(db, fresh)
    return _to_response(fresh)


@router.patch("/deliveries/{delivery_id}/status", response_model=DeliveryResponse,
              tags=["delivery"],
              summary="Advance a delivery: delivering, delivered, or cancelled")
async def update_delivery_status(delivery_id: uuid.UUID, payload: DeliveryStatusUpdate,
                                identity: CurrentIdentity, db: DbDep):
    """Move a delivery through the dispatch state machine.

    ASSIGNED -> DELIVERING -> DELIVERED, with any open state -> CANCELLED.
    The outbox records the move that matters to other services: a delivery
    finishing emits ``delivery.delivered``; a delivery closing early emits
    ``delivery.cancelled``.
    """
    identity.require("manage:delivery")
    delivery = await svc.load_delivery(db, identity.tenant_id, delivery_id)
    if delivery is None:
        raise HTTPException(status_code=404, detail="Delivery not found")
    _check_outlet(identity, delivery.outlet_id)

    try:
        await svc.transition(db, identity.tenant_id, delivery,
                             payload.to_status, note=payload.note)
    except svc.DeliveryError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    to = status_value(payload.to_status)
    if to == status_value(DeliveryStatus.DELIVERED):
        event = _ev(
            "delivery.delivered", identity.tenant_id, outlet_id=delivery.outlet_id,
            data={
                "delivery_id": str(delivery.id),
                "order_id": str(delivery.order_id),
                "delivered_at": delivery.delivered_at.isoformat(),
            },
        )
    elif to == status_value(DeliveryStatus.CANCELLED):
        event = _ev(
            "delivery.cancelled", identity.tenant_id, outlet_id=delivery.outlet_id,
            data={
                "delivery_id": str(delivery.id),
                "order_id": str(delivery.order_id),
                "reason": delivery.cancel_reason,
            },
        )
    else:
        # DELIVERING is a board-internal move — no outbox event.
        event = None
    if event is not None:
        _outbox(db, event)
        await db.commit()
        await bus.publish(event, local=True)
    return _to_response(delivery)
