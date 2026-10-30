"""Kitchen service endpoints.

Who may call what:
  * ``/stations`` — ``prepare:kot``
  * ``/kots`` read — ``prepare:kot``
  * status transitions — ``prepare:kot``; cancellation — ``cancel:kot``

Events:
  subscribes order.placed / order.cancelled / order.status.changed
  publishes  kot.fired, kot.acknowledged, kot.ready, kot.cancelled,
             kot.item.status.changed

This is the other half of the first real data-flow link in the system: pos
publishes order.placed and this service turns it into tickets. Both ends exist
and neither calls the other.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status as http_status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.event_bus.bus import Event, bus
from src.services.kitchen import service as svc
from src.services.kitchen.models import (
    KOT,
    KOTItem,
    KOTItemStatus,
    KOTStatus,
    KitchenStation,
    KDSDevice,
    status_value,
)
from src.services.kitchen.schemas import (
    DeviceCreate,
    DeviceResponse,
    KOTBumpRequest,
    KOTCancelRequest,
    KOTCreate,
    KOTItemStatusRequest,
    KOTListResponseModel,
    KOTPrintPreview,
    KOTRefireRequest,
    KOTResponse,
    KOTStatusUpdate,
    PrintLogResponse,
    PrintLogUpdate,
    PrintQueueResponse,
    PrintRequest,
    StationCreate,
    StationMetricsResponse,
    StationResponse,
    StationUpdate,
    StatusLogResponse,
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


def _ev(topic, tenant_id=None, outlet_id=None, data=None):
    """Build an event stamped with this service's name."""
    return Event(type=topic, tenant_id=tenant_id, outlet_id=outlet_id,
                 data=data or {}, source_service="kitchen")


def _outbox(db: AsyncSession, event: Event) -> None:
    """Persist the event to the outbox table in the current transaction.

    The outbox row commits atomically with the domain change, so a committed
    KOT state change is never lost even if the bus publish subsequently fails
    or the process crashes. The relay drains pending rows on its next poll.
    """
    from src.services.kitchen.models import OutboxMessage
    db.add(OutboxMessage(
        event_id=event.event_id,
        type=event.type,
        tenant_id=event.tenant_id,
        outlet_id=event.outlet_id,
        data=event.data,
        source_service="kitchen",
        status="pending",
    ))


def _coerce_uuid(value) -> uuid.UUID | None:
    """Parse a UUID from event data without raising on bad input.

    Event payloads are JSON, so UUIDs arrive as strings; a malformed one
    must degrade to a skipped event, not a handler exception.
    """
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


def _stamp() -> datetime:
    return datetime.now(timezone.utc)


def _tenant(event: Event) -> uuid.UUID | None:
    """Tenant id from an event, always as a UUID.

    The bus serialises tenant_id as a STRING (see ``Event.to_json``). Dispatched
    within one process a consumer receives the original UUID, but across
    processes it round-trips through Redis and ``Event.from_json`` yields a bare
    str. Comparing a str against a UUID column yields zero rows rather than an
    error — the event is consumed, acked, and silently dropped — and assigning
    it to a UUID column raises "invalid input syntax for type uuid" on insert.

    So this must be tolerated, not assumed. Everything downstream expects a
    UUID, and a malformed value degrades to skipping the event rather than a
    statement error.
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


async def _handler_db() -> AsyncSession:
    """A session owned by an event handler, not by a request.

    An event may arrive at any point while the app is up, not only during a
    request, so a request-scoped session is unavailable here. The handler owns
    the session and rolls back on its own failure.
    """
    from src.services.kitchen.main import db as _db

    return _db.session_factory()


# ─── Consumers ────────────────────────────────────────────────────────────────

@bus.on("order.placed")
async def _on_order_placed(event: Event) -> None:
    """Turn a placed order into KOT tickets.

    Do not call ``bus.mark_seen`` here: ``EventBus._dispatch_local`` does not
    dedupe, and ``publish()`` already claimed this process's own events, so a
    handler-side call would be the only guard left and would skip events the
    bus never marked — silently killing the consumer.

    Idempotency lives in ``create_kots_from_order_event`` instead, keyed on
    (order, station, course). The bus dedupes only within one process, so a
    duplicate delivered after a restart is invisible to it; the kitchen must
    not print the same dish twice.
    """
    data = event.data or {}
    tenant = _tenant(event)
    if tenant is None or not data.get("order_id"):
        return
    db = await _handler_db()
    try:
        kots = await svc.create_kots_from_order_event(
            db,
            tenant,
            order_id=data["order_id"],
            order_number=data.get("order_number"),
            outlet_id=data.get("outlet_id") or event.outlet_id,
            table_id=data.get("table_id"),
            order_type=data.get("order_type"),
            covers=int(data.get("covers") or 1),
            lines=data.get("lines") or [],
        )
        # Write all kot.fired events to the outbox in the same transaction as
        # the KOT creation, then commit. The relay delivers them to the bus;
        # a crash between the KOT commit and the bus publish is no longer
        # silent. Build each event once so the outbox row and the bus publish
        # carry the identical payload.
        fire_events = []
        for kot in kots:
            fire_events.append(_ev(
                "kot.fired", event.tenant_id, outlet_id=kot.outlet_id,
                data={
                    "kot_id": str(kot.id),
                    "kot_number": kot.kot_number,
                    "order_id": str(kot.order_id),
                    "station_id": str(kot.station_id),
                    "status": status_value(kot.status),
                    "priority": status_value(kot.priority),
                    "course_number": kot.course_number,
                    "fired_at": _stamp().isoformat(),
                },
            ))
            _outbox(db, fire_events[-1])
        await db.commit()
        for fire_event in fire_events:
            await bus.publish(fire_event, local=True)
    except Exception:
        await db.rollback()
        raise
    finally:
        await db.close()


@bus.on("order.cancelled")
async def _on_order_cancelled(event: Event) -> None:
    """Stop cooking food nobody is paying for."""
    data = event.data or {}
    tenant = _tenant(event)
    if tenant is None or not data.get("order_id"):
        return
    db = await _handler_db()
    try:
        cancelled = await svc.cancel_kots_for_order(
            db, tenant, data["order_id"], data.get("reason")
        )
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    finally:
        await db.close()


@bus.on("order.status.changed")
async def _on_order_status_changed(event: Event) -> None:
    """Close tickets whose order has been served at the POS.

    The POS is the source of truth for whether food left. If the pass misses a
    served tap, this reconciles the ticket so the kitchen board does not keep
    showing work that is already done.
    """
    data = event.data or {}
    tenant = _tenant(event)
    if tenant is None or not data.get("order_id"):
        return
    to = str(data.get("to") or "")
    if to not in ("served", "settled", "cancelled"):
        return
    order = _coerce_uuid(data["order_id"])
    if order is None:
        return
    db = await _handler_db()
    try:
        if to == "cancelled":
            await svc.cancel_kots_for_order(
                db, tenant, data["order_id"], "order status changed"
            )
        else:
            kots = (
                await db.execute(
                    select(KOT).where(
                        KOT.tenant_id == tenant,
                        KOT.order_id == order,
                        KOT.status.not_in([KOTStatus.SERVED, KOTStatus.CANCELLED]),
                    )
                )
            ).scalars().all()
            for kot in kots:
                await svc.update_kot_status(
                    db, tenant, kot, KOTStatus.SERVED,
                    reason="order marked served at POS",
                )
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    finally:
        await db.close()


# ─── Stations ────────────────────────────────────────────────────────────────

@router.post("/stations", response_model=StationResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["kitchen"])
async def create_station(payload: StationCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("prepare:kot")
    await _resolve_outlet(identity, payload.outlet_id)
    station = KitchenStation(tenant_id=identity.tenant_id, **payload.model_dump())
    db.add(station)
    await db.flush()
    count = await svc.open_ticket_count(db, identity.tenant_id, station.id)
    resp = StationResponse.model_validate(station)
    return resp.model_copy(update={"open_ticket_count": count})


@router.get("/stations", response_model=list[StationResponse], tags=["kitchen"])
async def list_stations(identity: CurrentIdentity, db: DbDep,
                        outlet_id: uuid.UUID | None = None):
    identity.require("prepare:kot")
    stmt = select(KitchenStation).where(KitchenStation.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(KitchenStation.outlet_id == outlet_id)
    stations = list((await db.execute(stmt)).scalars().all())

    # One grouped query for all load counts. Counting per station while
    # iterating would be an N+1, which hurts on a floor view that refreshes.
    counts = await svc.station_load_map(
        db, identity.tenant_id, [s.id for s in stations]
    )
    return [
        StationResponse.model_validate(s).model_copy(
            update={"open_ticket_count": counts.get(s.id, 0)}
        )
        for s in stations
    ]


@router.patch("/stations/{station_id}", response_model=StationResponse, tags=["kitchen"])
async def update_station(station_id: uuid.UUID, payload: StationUpdate,
                         identity: CurrentIdentity, db: DbDep):
    identity.require("prepare:kot")
    station = await svc.load_station(db, identity.tenant_id, station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="Station not found")
    if not identity.can_access_outlet(station.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(station, field, value)
    await db.flush()
    count = await svc.open_ticket_count(db, identity.tenant_id, station.id)
    resp = StationResponse.model_validate(station)
    return resp.model_copy(update={"open_ticket_count": count})


@router.get("/stations/{station_id}/metrics", response_model=StationMetricsResponse,
            tags=["kitchen"],
            summary="Observed prep-time performance over a rolling window")
async def station_metrics(
    station_id: uuid.UUID,
    identity: CurrentIdentity,
    db: DbDep,
    window_hours: int = Query(default=24, ge=1, le=24 * 14),
):
    """Live answer to 'how is this station actually running' — replaces the
    static ``avg_prep_minutes`` set at creation time. Excludes tickets still
    open or cancelled; only fired->ready completions in the window count."""
    identity.require("prepare:kot")
    station = await svc.load_station(db, identity.tenant_id, station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="Station not found")
    if not identity.can_access_outlet(station.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    return await svc.station_metrics(
        db, identity.tenant_id, station_id, window_hours=window_hours
    )


# ─── KDS devices ─────────────────────────────────────────────────────────────

@router.post("/kds-devices", response_model=DeviceResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["kds"])
async def create_device(payload: DeviceCreate, identity: CurrentIdentity, db: DbDep):
    """Register a display screen and return its one-time token.

    The token is returned exactly once, at creation. It is printed on the
    screen, not stored anywhere else in the kitchen service — a device that
    loses its token must be re-registered rather than recovered.
    """
    identity.require("prepare:kot")
    await _resolve_outlet(identity, payload.outlet_id)
    token = uuid.uuid4().hex + uuid.uuid4().hex
    device = KDSDevice(
        tenant_id=identity.tenant_id,
        outlet_id=payload.outlet_id,
        station_id=payload.station_id,
        name=payload.name,
        device_type=payload.device_type,
        device_token=token,
        last_seen_at=_stamp(),
    )
    db.add(device)
    await db.flush()
    return device


@router.post("/kds-devices/{device_id}/heartbeat", response_model=DeviceResponse,
             tags=["kds"],
             summary="Liveness ping — updates last_seen_at without a full poll")
async def device_heartbeat(
    device_id: uuid.UUID,
    identity: CurrentIdentity,
    db: DbDep,
):
    """A screen that only polls /kots/poll on an interval is one thing; a
    screen that wants to say "I am alive" between polls without dragging
    the ticket payload with it is another. This is the cheap one — it stamps
    ``last_seen_at`` and nothing else, so a board can heartbeat every few
    seconds on the cheap and only pay for the ticket fetch when it needs to
    redraw.

    The device must belong to this tenant — unlike the token-authenticated
    poll, this one is user-authenticated, and a user must not be able to
    heartbeat another tenant's screen into looking alive.
    """
    identity.require("prepare:kot")
    device = await db.scalar(
        select(KDSDevice).where(
            KDSDevice.id == device_id,
            KDSDevice.tenant_id == identity.tenant_id,
        )
    )
    if device is None:
        raise HTTPException(status_code=404, detail="KDS device not found")
    if not identity.can_access_outlet(device.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    device.last_seen_at = _stamp()
    await db.flush()
    return device


@router.get("/kds-devices", response_model=list[DeviceResponse], tags=["kds"])
async def list_devices(identity: CurrentIdentity, db: DbDep,
                       outlet_id: uuid.UUID | None = None):
    identity.require("prepare:kot")
    stmt = select(KDSDevice).where(KDSDevice.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(KDSDevice.outlet_id == outlet_id)
    stmt = stmt.order_by(KDSDevice.created_at.desc())
    return list((await db.execute(stmt)).scalars().all())


# ─── KOT tickets ─────────────────────────────────────────────────────────────

@router.get("/kots/poll", response_model=KOTListResponseModel, tags=["kds"],
            summary="KDS screen board poll, authenticated by device token")
async def kds_poll(
    request: Request,
    db: DbDep,
    station_id: uuid.UUID,
    outlet_id: uuid.UUID | None = None,
    include_closed: bool = False,
    limit: int = Query(default=100, le=500),
):
    """The pass screen's polling endpoint.

    A KDS screen is not a user account: it has no email, no JWT, no role
    grant. It authenticates with the one-time token minted when it was
    registered, scoped to exactly one station. A screen that polls an
    endpoint it is not registered for — or with a wrong/decommissioned
    token — gets a clean 401, and the screen can say "offline" rather than
    "stuck."

    The tenant scope is derived from the device row itself, not passed in:
    the token *is* the authorization. This is the same trust model the
    shared identity layer already uses for service-to-service
    ``X-Identity-*`` headers — here applied to a machine, not a person.
    """
    token = request.headers.get("X-KDS-Token", "").strip()
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Missing KDS device token",
            headers={"WWW-Authenticate": "X-KDS-Token"},
        )

    # Device lookup needs a tenant_id to stay in-scope. The token is unique
    # globally (see the model's constraint), but the DB partition key is
    # (tenant, token) — so this first pass looks the device up by token
    # alone via a helper that does not require a tenant.
    device = await svc.resolve_device_global(db, token)
    if device is None:
        raise HTTPException(
            status_code=401,
            detail="Unknown or decommissioned KDS device",
            headers={"WWW-Authenticate": "X-KDS-Token"},
        )

    if not device.station_id or device.station_id != station_id:
        raise HTTPException(
            status_code=403,
            detail="Device is not registered for this station",
        )

    stmt = select(KOT).where(
        KOT.tenant_id == device.tenant_id,
        KOT.station_id == station_id,
    )
    if not include_closed:
        stmt = stmt.where(KOT.status.not_in([KOTStatus.SERVED, KOTStatus.CANCELLED]))
    stmt = stmt.order_by(KOT.priority, KOT.fired_at).limit(limit)
    tickets = list((await db.execute(stmt)).scalars().all())
    return KOTListResponseModel(tickets=tickets, total=len(tickets))


@router.get("/kots", response_model=KOTListResponseModel, tags=["kds"],
            summary="Board view: open tickets for one station (JWT)")
async def list_kots(identity: CurrentIdentity, db: DbDep,
                    station_id: uuid.UUID | None = None,
                    outlet_id: uuid.UUID | None = None,
                    order_number: str | None = Query(
                        default=None,
                        description="Filter to tickets fired for this order number. "
                                    "Case-insensitive prefix match, so a cashier typing "
                                    "the order's printed number finds every station's KOT "
                                    "for that one sale.",
                    ),
                    include_closed: bool = False,
                    limit: int = Query(default=100, le=500)):
    """The pass screen polls this. It is a flat column SELECT by design —
    no nested items — because the board refreshes every couple of seconds and
    per-ticket line detail here would be an N+1 on every poll.

    ``station_id`` is now optional: the KDS-by-number screen (a cashier
    looking up every KOT for order #1234 across all stations) leaves it
    out. When it is set, the query is scoped to that station, which is the
    by-station board's poll."""
    identity.require("prepare:kot")
    if outlet_id:
        await _resolve_outlet(identity, outlet_id)

    stmt = select(KOT).where(
        KOT.tenant_id == identity.tenant_id,
    )
    if station_id is not None:
        stmt = stmt.where(KOT.station_id == station_id)
    if outlet_id is not None:
        stmt = stmt.where(KOT.outlet_id == outlet_id)
    if order_number:
        # ILIKE prefix match: a cashier types the order number exactly as it
        # appears on the bill, and the search must find it. A contains
        # wildcard in the middle of the string is wasted work and returns
        # unrelated tickets, so it is a prefix match, not a substring one.
        stmt = stmt.where(KOT.order_number.ilike(f"{order_number.strip()}%"))
    if not include_closed:
        stmt = stmt.where(KOT.status.not_in([KOTStatus.SERVED, KOTStatus.CANCELLED]))
    stmt = stmt.order_by(KOT.priority, KOT.fired_at).limit(limit)
    tickets = list((await db.execute(stmt)).scalars().all())
    return KOTListResponseModel(tickets=tickets, total=len(tickets))


@router.get("/kots/by-number", response_model=KOTListResponseModel, tags=["kds"],
            summary="Look up KOTs by the order number a cashier has on the bill")
async def kots_by_number(
    identity: CurrentIdentity,
    db: DbDep,
    n: str = Query(..., alias="n", description="The order number to search for"),
    outlet_id: uuid.UUID | None = None,
    include_closed: bool = False,
    limit: int = Query(default=100, le=500),
):
    """KDS-by-number: every station's KOT for one order, no station required.

    The by-station board polls ``/kots`` with its own ``station_id``; this
    endpoint is the cashier's tool for "which tickets does order #1234 have
    open at each station," so it intentionally omits ``station_id`` and only
    filters on the order number.
    """
    identity.require("prepare:kot")
    if outlet_id:
        await _resolve_outlet(identity, outlet_id)
    stmt = select(KOT).where(
        KOT.tenant_id == identity.tenant_id,
        KOT.order_number.ilike(f"{n.strip()}%"),
    )
    if outlet_id is not None:
        stmt = stmt.where(KOT.outlet_id == outlet_id)
    if not include_closed:
        stmt = stmt.where(KOT.status.not_in([KOTStatus.SERVED, KOTStatus.CANCELLED]))
    stmt = stmt.order_by(KOT.priority, KOT.fired_at).limit(limit)
    tickets = list((await db.execute(stmt)).scalars().all())
    return KOTListResponseModel(tickets=tickets, total=len(tickets))


@router.post("/kots", response_model=KOTResponse, status_code=http_status.HTTP_201_CREATED, tags=["kds"])
async def create_kot(payload: KOTCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("prepare:kot")
    await _resolve_outlet(identity, payload.outlet_id)
    station = await svc.load_station(db, identity.tenant_id, payload.station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="Station not found")
    kot_num = await svc.allocate_kot_number(db, identity.tenant_id, station.id)
    order_id = payload.order_id or uuid.uuid4()
    kot = KOT(
        tenant_id=identity.tenant_id,
        outlet_id=payload.outlet_id,
        order_id=order_id,
        order_number=payload.order_number or f"ORD-{kot_num}",
        table_id=payload.table_id,
        table_name=payload.table_name,
        station_id=payload.station_id,
        kot_number=kot_num,
        status=KOTStatus.PENDING,
        priority=payload.priority,
        course_number=payload.course_number,
        covers=payload.covers,
        order_type=payload.order_type,
        fired_at=_stamp(),
        notes=payload.notes,
    )
    db.add(kot)
    await db.flush()
    for idx, itm in enumerate(payload.items):
        k_item = KOTItem(
            tenant_id=identity.tenant_id,
            kot_id=kot.id,
            menu_item_id=itm.menu_item_id,
            name=itm.name,
            variant_name=itm.variant_name,
            qty=itm.qty,
            position=idx,
            status=KOTItemStatus.PENDING,
            course_number=itm.course_number,
            notes=itm.notes,
            modifiers=itm.modifiers,
        )
        db.add(k_item)
    await db.flush()
    reloaded = await svc.load_kot(db, identity.tenant_id, kot.id)
    await _emit_kot_event(reloaded, KOTStatus.PENDING, db=db)
    return reloaded


@router.post("/kots/{kot_id}/ready", response_model=KOTResponse, tags=["kds"])
async def kot_ready(kot_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    return await update_kot_status(kot_id, KOTStatusUpdate(to_status=KOTStatus.READY), identity, db)


@router.post("/kots/{kot_id}/served", response_model=KOTResponse, tags=["kds"])
async def kot_served(kot_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    return await update_kot_status(kot_id, KOTStatusUpdate(to_status=KOTStatus.SERVED), identity, db)


@router.post("/kots/{kot_id}/acknowledged", response_model=KOTResponse, tags=["kds"])
async def kot_acknowledged(kot_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    return await update_kot_status(kot_id, KOTStatusUpdate(to_status=KOTStatus.ACKNOWLEDGED), identity, db)


@router.get("/kots/{kot_id}", response_model=KOTResponse, tags=["kds"])
async def get_kot(kot_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("prepare:kot")
    kot = await svc.load_kot(db, identity.tenant_id, kot_id)
    if kot is None:
        raise HTTPException(status_code=404, detail="KOT not found")
    if not identity.can_access_outlet(kot.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    return kot


@router.patch("/kots/{kot_id}", response_model=KOTResponse, tags=["kds"],
              summary="Advance a ticket: acknowledged, preparing, ready, served")
async def update_kot_status(kot_id: uuid.UUID, payload: KOTStatusUpdate,
                            identity: CurrentIdentity, db: DbDep):
    identity.require("prepare:kot")
    kot = await svc.load_kot(db, identity.tenant_id, kot_id)
    if kot is None:
        raise HTTPException(status_code=404, detail="KOT not found")
    if not identity.can_access_outlet(kot.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    try:
        await svc.update_kot_status(
            db, identity.tenant_id, kot, payload.to_status,
            changed_by=identity.user_id, reason=payload.reason,
        )
    except svc.KitchenError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    await _emit_kot_event(kot, payload.to_status, db=db)
    return kot


@router.post("/kots/{kot_id}/cancel", response_model=KOTResponse, tags=["kds"])
async def cancel_kot(kot_id: uuid.UUID, body: KOTCancelRequest,
                     identity: CurrentIdentity, db: DbDep):
    identity.require("cancel:kot")
    kot = await svc.load_kot(db, identity.tenant_id, kot_id)
    if kot is None:
        raise HTTPException(status_code=404, detail="KOT not found")
    if not identity.can_access_outlet(kot.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    try:
        await svc.update_kot_status(
            db, identity.tenant_id, kot, KOTStatus.CANCELLED,
            changed_by=identity.user_id, reason=body.reason,
        )
    except svc.KitchenError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    # One publish, not two: _emit_kot_event covers the "cancelled" state, so
    # publishing here as well would deliver kot.cancelled twice. Consumers are
    # supposed to be idempotent, but that is insurance, not something to test.
    await _emit_kot_event(kot, KOTStatus.CANCELLED, db=db)
    return kot


@router.post("/kots/{kot_id}/bump", response_model=KOTResponse, tags=["kds"],
             summary="Raise a ticket's urgency and/or move it to another station")
async def bump_kot(
    kot_id: uuid.UUID,
    payload: KOTBumpRequest,
    identity: CurrentIdentity,
    db: DbDep,
):
    """The pass screen's 'rush this' / 'send to the other station' control.

    Priority changes and station transfers are both audited in the status
    log — a kitchen manager wants the "why" after a customer complaint, and
    a bare status change gives none.
    """
    identity.require("prepare:kot")
    kot = await svc.load_kot(db, identity.tenant_id, kot_id)
    if kot is None:
        raise HTTPException(status_code=404, detail="KOT not found")
    if not identity.can_access_outlet(kot.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    try:
        await svc.bump_kot(
            db, identity.tenant_id, kot,
            priority=payload.priority,
            station_id=payload.station_id,
            changed_by=identity.user_id,
            reason=payload.reason,
        )
    except svc.KitchenError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return kot


@router.post("/kots/{kot_id}/refire", response_model=KOTResponse, tags=["kds"],
             summary="Re-open a cancelled ticket for a second pass through the kitchen")
async def refire_kot(
    kot_id: uuid.UUID,
    payload: KOTRefireRequest,
    identity: CurrentIdentity,
    db: DbDep,
):
    """The 'guest's dish came back' case.

    A ticket that was cancelled — food dropped on the way to the table, a
    course fired too early — comes back as a re-fire, not a new order line.
    Only cancelled tickets can be re-fired, and the reason is mandatory: a
    silent re-fire of an already-served dish would read as a double order at
    the pass.
    """
    identity.require("prepare:kot")
    kot = await svc.load_kot(db, identity.tenant_id, kot_id)
    if kot is None:
        raise HTTPException(status_code=404, detail="KOT not found")
    if not identity.can_access_outlet(kot.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    try:
        await svc.refire_kot(
            db, identity.tenant_id, kot,
            changed_by=identity.user_id,
            reason=payload.reason,
        )
    except svc.KitchenError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    await _emit_kot_event(kot, KOTStatus.PENDING, db=db)
    return kot


@router.get("/kots/{kot_id}/history", response_model=list[StatusLogResponse],
            tags=["kds"],
            summary="Full append-only state log for one ticket")
async def kot_history(
    kot_id: uuid.UUID, identity: CurrentIdentity, db: DbDep
):
    identity.require("prepare:kot")
    kot = await svc.load_kot(db, identity.tenant_id, kot_id)
    if kot is None:
        raise HTTPException(status_code=404, detail="KOT not found")
    if not identity.can_access_outlet(kot.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    return await svc.kot_history(db, identity.tenant_id, kot)


@router.patch("/kots/{kot_id}/items/{item_id}", response_model=KOTResponse, tags=["kds"],
              summary="Advance one component on a ticket")
async def update_kot_item(kot_id: uuid.UUID, item_id: uuid.UUID,
                          payload: KOTItemStatusRequest,
                          identity: CurrentIdentity, db: DbDep):
    identity.require("prepare:kot")
    kot = await svc.load_kot(db, identity.tenant_id, kot_id)
    if kot is None:
        raise HTTPException(status_code=404, detail="KOT not found")
    if not identity.can_access_outlet(kot.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    try:
        await svc.update_kot_item_status(db, identity.tenant_id, kot, item_id, payload.to_status)
    except svc.KitchenError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    event = _ev(
        "kot.item.status.changed", identity.tenant_id, outlet_id=kot.outlet_id,
        data={"kot_id": str(kot.id), "item_id": str(item_id),
              "order_id": str(kot.order_id),
              "to_status": status_value(payload.to_status)},
    )
    _outbox(db, event)
    await bus.publish(event, local=True)
    return kot


# ─── Kitchen print requests ─────────────────────────────────────────────────
#
# The kitchen records the request and emits the ``kot.print.requested`` outbox
# event. It does NOT call the printers service directly — the printers service
# consumes that event (and polls ``/print/queue``) and acks back through
# ``PATCH /print-log/{id}``. Keeping the call one-way is the house rule:
# kitchen never writes into printers' database, and never awaits its response.

@router.post("/kots/{kot_id}/print", response_model=PrintLogResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["kitchen"],
             summary="Request a print of one ticket")
async def print_kot(
    kot_id: uuid.UUID,
    payload: PrintRequest,
    identity: CurrentIdentity,
    db: DbDep,
):
    """Send one ticket to the printer destination for its station.

    The ticket's ``printed_count`` is bumped in the same transaction as the
    log row, so a crash between the two is not possible. The outbox event is
    written before the commit, the way every durable event in this service
    is, so a committed print request can never be lost.
    """
    identity.require("prepare:kot")
    kot = await svc.load_kot(db, identity.tenant_id, kot_id)
    if kot is None:
        raise HTTPException(status_code=404, detail="KOT not found")
    if not identity.can_access_outlet(kot.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")

    log = await svc.create_print_log(
        db, identity.tenant_id, kot.outlet_id,
        kot_id=kot.id,
        station_id=kot.station_id,
        printer_ref=payload.printer_ref,
    )
    kot.printed_count = (kot.printed_count or 0) + 1
    await db.flush()

    event = _ev(
        "kot.print.requested", identity.tenant_id, outlet_id=kot.outlet_id,
        data={
            "kot_id": str(kot.id),
            "kot_number": kot.kot_number,
            "station_id": str(kot.station_id),
            "printer_ref": str(payload.printer_ref) if payload.printer_ref else None,
            "requested_at": _stamp().isoformat(),
        },
    )
    _outbox(db, event)
    await db.commit()
    await bus.publish(event, local=True)
    return log


@router.post("/stations/{station_id}/print", response_model=PrintLogResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["kitchen"],
             summary="Request a print of every open ticket at one station")
async def print_station(
    station_id: uuid.UUID,
    payload: PrintRequest,
    identity: CurrentIdentity,
    db: DbDep,
):
    """A station-wide reprint — "print everything still open at this station."

    The log row carries no ``kot_id`` because the request is for the whole
    station, not one ticket. The outbox event's ``kot_id`` is therefore
    ``None``; the printers service is expected to look the station's open
    tickets up on its own if it needs the ticket list, or to re-print the
    station's last known state. The kitchen does not enumerate tickets here
    and keep the list in the event — that would go stale the moment a ticket
    is served between the request and the print.
    """
    identity.require("prepare:kot")
    station = await svc.load_station(db, identity.tenant_id, station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="Station not found")
    if not identity.can_access_outlet(station.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")

    log = await svc.create_print_log(
        db, identity.tenant_id, station.outlet_id,
        kot_id=None,
        station_id=station.id,
        printer_ref=payload.printer_ref,
    )
    await db.flush()

    event = _ev(
        "kot.print.requested", identity.tenant_id, outlet_id=station.outlet_id,
        data={
            "kot_id": None,
            "kot_number": None,
            "station_id": str(station.id),
            "printer_ref": str(payload.printer_ref) if payload.printer_ref else None,
            "requested_at": _stamp().isoformat(),
        },
    )
    _outbox(db, event)
    await db.commit()
    await bus.publish(event, local=True)
    return log


@router.get("/print/queue", response_model=PrintQueueResponse,
            tags=["kitchen"],
            summary="Open print requests for a station, oldest first")
async def print_queue(
    identity: CurrentIdentity,
    db: DbDep,
    station_id: uuid.UUID,
    include_acked: bool = False,
    limit: int = Query(default=100, le=500),
):
    """The printers service's work queue. Read-only here — the ack path is
    ``PATCH /print-log/{id}``, so a printer that fails a job marks it FAILED
    and the next poll no longer shows it as pending."""
    identity.require("prepare:kot")
    station = await svc.load_station(db, identity.tenant_id, station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="Station not found")
    if not identity.can_access_outlet(station.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    rows = await svc.print_queue(
        db, identity.tenant_id, station_id,
        include_acked=include_acked, limit=limit,
    )
    return PrintQueueResponse(
        station_id=station_id,
        rows=[PrintLogResponse.model_validate(r) for r in rows],
        total=len(rows),
    )


@router.patch("/print-log/{log_id}", response_model=PrintLogResponse,
              tags=["kitchen"],
              summary="The printers service's ack of a print request")
async def ack_print_log(
    log_id: uuid.UUID,
    payload: PrintLogUpdate,
    identity: CurrentIdentity,
    db: DbDep,
):
    """Flip a PENDING print request to SENT or FAILED.

    The printers service is the only caller, and the gate is on the status:
    a row already settled by an earlier ack returns 409, not a silent no-op,
    so a double-delivery of the print event does not look like success.
    """
    identity.require("prepare:kot")
    log = await svc.load_print_log(db, identity.tenant_id, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Print log not found")
    if not identity.can_access_outlet(log.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    try:
        await svc.ack_print_log(
            db, identity.tenant_id, log,
            status=payload.status, ack_reason=payload.ack_reason,
        )
    except svc.KitchenError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return log


@router.get("/kots/{kot_id}/print-preview", response_model=KOTPrintPreview,
            tags=["kitchen"],
            summary="Structured receipt/thermal render of one ticket. No HTML.")
async def kot_print_preview(
    kot_id: uuid.UUID,
    identity: CurrentIdentity,
    db: DbDep,
):
    """The single source of truth for "what goes on the paper."

    The frontend's receipt preview and the printers service's render path both
    read this — it is a plain dict shape, not HTML, so a thermal printer's
    layout engine does not need to know about the KOT ORM row.
    """
    identity.require("prepare:kot")
    kot = await svc.load_kot(db, identity.tenant_id, kot_id)
    if kot is None:
        raise HTTPException(status_code=404, detail="KOT not found")
    if not identity.can_access_outlet(kot.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")

    station = await svc.load_station(db, identity.tenant_id, kot.station_id)
    items = [
        {
            "name": it.name,
            "variant_name": it.variant_name,
            "qty": it.qty,
            "notes": it.notes,
            "modifiers": list(it.modifiers or []),
            "course_number": it.course_number,
        }
        for it in (kot.items or [])
    ]
    return KOTPrintPreview(
        kot_id=kot.id,
        kot_number=kot.kot_number,
        order_number=kot.order_number,
        order_type=kot.order_type,
        table_name=kot.table_name,
        station_id=kot.station_id,
        station_name=station.name if station else None,
        status=status_value(kot.status),
        priority=status_value(kot.priority),
        course_number=kot.course_number,
        covers=kot.covers,
        notes=kot.notes,
        fired_at=kot.fired_at,
        ready_at=kot.ready_at,
        served_at=kot.served_at,
        items=items,
    )


async def _emit_kot_event(kot: KOT, to: KOTStatus, *, from_status: str | None = None,
                          db: AsyncSession | None = None) -> None:
    """Publish the topic matching the new state, if any.

    Acknowledged and preparing are internal to the pass; the rest are what
    other services need. Publishing acknowledged too would spam billing, which
    has no interest in it.

    When ``db`` is supplied the event is also written to the outbox in the
    same transaction as the state change, making the delivery durable.
    """
    topic = {
        KOTStatus.ACKNOWLEDGED: "kot.acknowledged",
        KOTStatus.READY: "kot.ready",
        KOTStatus.SERVED: "kot.served",
        KOTStatus.CANCELLED: "kot.cancelled",
    }.get(to)
    if not topic:
        return
    event = _ev(
        topic, kot.tenant_id, outlet_id=kot.outlet_id,
        data={"kot_id": str(kot.id), "kot_number": kot.kot_number,
              "order_id": str(kot.order_id), "station_id": str(kot.station_id),
              "status": status_value(to), "from_status": from_status},
    )
    if db is not None:
        _outbox(db, event)
    await bus.publish(event, local=True)


async def _resolve_outlet(identity: CurrentIdentity, outlet_id: uuid.UUID) -> None:
    """Validate this identity may act at this outlet.

    Stations belong to the organization service's outlets, which the kitchen
    cannot look up — it trusts the ID and enforces the tenant's outlet scope
    from the token. A wrong scope returns 403, not a silent cross-outlet write.
    """
    if not identity.can_access_outlet(outlet_id):
        raise HTTPException(
            status_code=403,
            detail=f"Not authorised for outlet {outlet_id}",
        )
