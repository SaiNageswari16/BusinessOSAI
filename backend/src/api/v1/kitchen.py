"""Kitchen Display (KDS) endpoints — stations, tickets, live status."""
import secrets
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission, resolve_outlet_id
from src.database.session import get_db
from src.models import (
    KDSDevice,
    KOT,
    KOTItem,
    KOTStatus,
    KitchenStation,
    Order,
    Printer,
    TableStatus,
)
from src.schemas.kitchen import (
    KDSDeviceRegister,
    KDSDeviceResponse,
    KDSHeartbeat,
    KitchenAnalytics,
    KitchenStationCreate,
    KitchenStationResponse,
    KitchenStationUpdate,
    KOTCancelRequest,
    KOTItemResponse,
    KOTItemStatusUpdate,
    KOTPriorityUpdate,
    KOTResponse,
    KOTStatusUpdate,
    StationPerformance,
)
from src.services.kot_service import (
    _status_value,
    can_transition,
    mark_kot_printed,
    set_kot_item_status,
    set_kot_status,
)
from src.services.number_series import allocate_number

router = APIRouter(prefix="/kitchen", tags=["Kitchen"])

LIVE_STATUSES = (
    KOTStatus.PENDING.value,
    KOTStatus.ACKNOWLEDGED.value,
    KOTStatus.PREPARING.value,
    KOTStatus.READY.value,
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Stations ────────────────────────────────────────────────────

@router.get("/stations", response_model=list[KitchenStationResponse])
async def list_stations(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:kot"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    include_inactive: bool = False,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(KitchenStation).where(KitchenStation.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(KitchenStation.outlet_id == outlet_id)
    if not include_inactive:
        stmt = stmt.where(KitchenStation.is_active.is_(True))
    stmt = stmt.order_by(KitchenStation.name)
    return [
        KitchenStationResponse.model_validate(s)
        for s in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/stations", response_model=KitchenStationResponse,
             status_code=status.HTTP_201_CREATED)
async def create_station(
    payload: KitchenStationCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:kitchen_stations"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id)

    if payload.printer_id:
        printer = await db.scalar(
            select(Printer.id).where(
                Printer.id == payload.printer_id, Printer.tenant_id == ctx.tenant_id
            )
        )
        if printer is None:
            raise HTTPException(status_code=400, detail="Printer not found")

    station = KitchenStation(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(station)
    await db.commit()
    await db.refresh(station)
    return KitchenStationResponse.model_validate(station)


@router.put("/stations/{station_id}", response_model=KitchenStationResponse)
async def update_station(
    station_id: uuid.UUID,
    payload: KitchenStationUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:kitchen_stations"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    station = await db.scalar(
        select(KitchenStation).where(
            KitchenStation.id == station_id, KitchenStation.tenant_id == ctx.tenant_id
        )
    )
    if station is None:
        raise HTTPException(status_code=404, detail="Station not found")
    resolve_outlet_id(ctx, station.outlet_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(station, field, value)
    await db.commit()
    await db.refresh(station)
    return KitchenStationResponse.model_validate(station)


@router.delete("/stations/{station_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_station(
    station_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:kitchen_stations"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    station = await db.scalar(
        select(KitchenStation).where(
            KitchenStation.id == station_id, KitchenStation.tenant_id == ctx.tenant_id
        )
    )
    if station is None:
        raise HTTPException(status_code=404, detail="Station not found")
    resolve_outlet_id(ctx, station.outlet_id)
    # Deactivate rather than delete — historical KOTs reference this station
    station.is_active = False
    await db.commit()


# ─── Tickets ─────────────────────────────────────────────────────

@router.get("/kots", response_model=list[KOTResponse])
async def list_kots(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:kot"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    station_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    live_only: bool = False,
    limit: int = 200,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = (
        select(KOT)
        .options(selectinload(KOT.items))
        .where(KOT.tenant_id == ctx.tenant_id)
    )
    if outlet_id:
        stmt = stmt.where(KOT.outlet_id == outlet_id)
    if station_id:
        stmt = stmt.where(KOT.station_id == station_id)
    if status_filter:
        stmt = stmt.where(KOT.status == status_filter)
    if live_only:
        stmt = stmt.where(KOT.status.in_(LIVE_STATUSES))
    stmt = stmt.order_by(KOT.fired_at.desc(), KOT.created_at.desc()).limit(limit)

    return [
        KOTResponse.model_validate(k)
        for k in (await db.execute(stmt)).unique().scalars().all()
    ]


@router.get("/kots/{kot_id}", response_model=KOTResponse)
async def get_kot(
    kot_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:kot"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    kot = await _get_kot_for_ctx(db, ctx, kot_id)
    return KOTResponse.model_validate(kot)


async def _get_kot_for_ctx(
    db: AsyncSession, ctx: CurrentUserContext, kot_id: uuid.UUID
) -> KOT:
    kot = (
        await db.execute(
            select(KOT)
            .options(selectinload(KOT.items).selectinload(KOTItem.order_item))
            .where(KOT.id == kot_id, KOT.tenant_id == ctx.tenant_id)
        )
    ).scalars().first()
    if kot is None:
        raise HTTPException(status_code=404, detail="KOT not found")
    resolve_outlet_id(ctx, kot.outlet_id)
    return kot


@router.post("/kots/{kot_id}/status", response_model=KOTResponse)
async def update_kot_status(
    kot_id: uuid.UUID,
    payload: KOTStatusUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("prepare:kot"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    kot = await _get_kot_for_ctx(db, ctx, kot_id)

    current = _status_value(kot.status)
    if not can_transition(current, payload.status):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot move this ticket from {current} to {payload.status}",
        )

    try:
        await set_kot_status(
            db, ctx.tenant_id, kot_id, payload.status,
            changed_by=ctx.user_id, reason=payload.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    kot = await _get_kot_for_ctx(db, ctx, kot_id)
    return KOTResponse.model_validate(kot)


@router.post("/kots/{kot_id}/acknowledge", response_model=KOTResponse)
async def acknowledge_kot(
    kot_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("prepare:kot"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """The chef has seen the ticket and it's on the queue."""
    kot = await _get_kot_for_ctx(db, ctx, kot_id)
    if _status_value(kot.status) != KOTStatus.PENDING.value:
        raise HTTPException(status_code=409, detail="This ticket is already acknowledged")

    await set_kot_status(db, ctx.tenant_id, kot_id, "acknowledged", changed_by=ctx.user_id)
    await db.commit()
    kot = await _get_kot_for_ctx(db, ctx, kot_id)
    return KOTResponse.model_validate(kot)


@router.post("/kots/{kot_id}/items/{item_id}/status", response_model=KOTResponse)
async def update_kot_item_status(
    kot_id: uuid.UUID,
    item_id: uuid.UUID,
    payload: KOTItemStatusUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("prepare:kot"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_kot_for_ctx(db, ctx, kot_id)

    try:
        await set_kot_item_status(
            db, ctx.tenant_id, item_id, payload.status,
            changed_by=ctx.user_id, reason=payload.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    kot = await _get_kot_for_ctx(db, ctx, kot_id)
    return KOTResponse.model_validate(kot)


@router.post("/kots/{kot_id}/cancel", response_model=KOTResponse)
async def cancel_kot(
    kot_id: uuid.UUID,
    payload: KOTCancelRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("cancel:kot"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    kot = await _get_kot_for_ctx(db, ctx, kot_id)
    if _status_value(kot.status) in ("served", "cancelled"):
        raise HTTPException(
            status_code=409, detail=f"This ticket is already {_status_value(kot.status)}"
        )

    try:
        await set_kot_status(
            db, ctx.tenant_id, kot_id, "cancelled",
            changed_by=ctx.user_id, reason=payload.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    kot = await _get_kot_for_ctx(db, ctx, kot_id)
    return KOTResponse.model_validate(kot)


@router.post("/kots/{kot_id}/priority", response_model=KOTResponse)
async def set_priority(
    kot_id: uuid.UUID,
    payload: KOTPriorityUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("prepare:kot"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    kot = await _get_kot_for_ctx(db, ctx, kot_id)
    if _status_value(kot.status) in ("served", "cancelled"):
        raise HTTPException(status_code=409, detail="This ticket is closed")

    kot.priority = payload.priority
    await db.commit()
    kot = await _get_kot_for_ctx(db, ctx, kot_id)
    return KOTResponse.model_validate(kot)


@router.post("/kots/{kot_id}/print", response_model=dict)
async def print_kot(
    kot_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("fire:kot"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    printer_id: uuid.UUID | None = None,
):
    """Queue the station printer, tracking reprints so duplicates are visible."""
    kot = await _get_kot_for_ctx(db, ctx, kot_id)

    station_printer_id = printer_id
    if station_printer_id is None and kot.station_id:
        station = await db.scalar(
            select(KitchenStation).where(KitchenStation.id == kot.station_id)
        )
        station_printer_id = station.printer_id if station else None

    if station_printer_id is None:
        raise HTTPException(
            status_code=409,
            detail="No printer assigned — set one on the station or pass printer_id",
        )

    await mark_kot_printed(db, kot)
    await db.commit()

    return {
        "kot_id": str(kot.id),
        "printer_id": str(station_printer_id),
        "reprint_number": kot.printed_count,
        "queued_at": _now(),
    }


# ─── KDS device registration & heartbeat ─────────────────────────

@router.post("/devices", response_model=KDSDeviceResponse,
             status_code=status.HTTP_201_CREATED)
async def register_device(
    payload: KDSDeviceRegister,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:kitchen_stations"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id)

    device = KDSDevice(
        tenant_id=ctx.tenant_id,
        outlet_id=payload.outlet_id,
        station_id=payload.station_id,
        name=payload.name,
        device_token=secrets.token_urlsafe(32),
        is_active=True,
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return KDSDeviceResponse.model_validate(device)


@router.post("/devices/{device_id}/heartbeat", response_model=KDSDeviceResponse)
async def device_heartbeat(
    device_id: uuid.UUID,
    payload: KDSHeartbeat,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:kitchen_stations"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    device = await db.scalar(
        select(KDSDevice).where(
            KDSDevice.id == device_id, KDSDevice.tenant_id == ctx.tenant_id
        )
    )
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    resolve_outlet_id(ctx, device.outlet_id)

    device.last_seen_at = _now()
    if payload.station_id is not None:
        device.station_id = payload.station_id
    await db.commit()
    await db.refresh(device)
    return KDSDeviceResponse.model_validate(device)


@router.get("/devices", response_model=list[KDSDeviceResponse])
async def list_devices(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:kot"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(KDSDevice).where(KDSDevice.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(KDSDevice.outlet_id == outlet_id)
    stmt = stmt.order_by(KDSDevice.name)
    return [
        KDSDeviceResponse.model_validate(d)
        for d in (await db.execute(stmt)).scalars().all()
    ]


# ─── Analytics ───────────────────────────────────────────────────

@router.get("/analytics", response_model=KitchenAnalytics)
async def kitchen_analytics(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:reports"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
):
    resolve_outlet_id(ctx, outlet_id)

    stations = (
        await db.execute(
            select(KitchenStation).where(
                KitchenStation.tenant_id == ctx.tenant_id,
                KitchenStation.outlet_id == outlet_id,
                KitchenStation.is_active.is_(True),
            ).order_by(KitchenStation.name)
        )
    ).scalars().all()

    today = datetime.now(timezone.utc).date().isoformat()

    live_stmt = (
        select(func.count())
        .select_from(KOT)
        .where(
            KOT.tenant_id == ctx.tenant_id,
            KOT.outlet_id == outlet_id,
            KOT.status.in_(LIVE_STATUSES),
        )
    )
    active_tickets = (await db.execute(live_stmt)).scalar_one()

    completed_stmt = (
        select(func.count())
        .select_from(KOT)
        .where(
            KOT.tenant_id == ctx.tenant_id,
            KOT.outlet_id == outlet_id,
            KOT.status == KOTStatus.SERVED.value,
            func.date(KOT.served_at) == today,
        )
    )
    completed_today = (await db.execute(completed_stmt)).scalar_one()

    cancelled_stmt = (
        select(func.count())
        .select_from(KOT)
        .where(
            KOT.tenant_id == ctx.tenant_id,
            KOT.outlet_id == outlet_id,
            KOT.status == KOTStatus.CANCELLED.value,
            func.date(KOT.created_at) == today,
        )
    )
    cancelled_today = (await db.execute(cancelled_stmt)).scalar_one()

    performances: list[StationPerformance] = []
    prep_samples: list[float] = []

    for station in stations:
        tickets = (
            await db.execute(
                select(KOT)
                .options(selectinload(KOT.items))
                .where(
                    KOT.tenant_id == ctx.tenant_id,
                    KOT.station_id == station.id,
                    KOT.status == KOTStatus.SERVED.value,
                    func.date(KOT.served_at) == today,
                )
            )
        ).scalars().all()

        durations = [
            _minutes_between(t.fired_at, t.served_at) for t in tickets
        ]
        durations = [d for d in durations if d is not None]
        prep_samples.extend(durations)

        avg = round(sum(durations) / len(durations), 1) if durations else None

        performances.append(StationPerformance(
            station_id=station.id,
            station_name=station.name,
            tickets_completed=len(tickets),
            avg_prep_minutes=avg,
            backlog=await _station_backlog(db, station.id),
        ))

    overall_avg = round(sum(prep_samples) / len(prep_samples), 1) if prep_samples else None

    return KitchenAnalytics(
        outlet_id=outlet_id,
        active_tickets=active_tickets,
        completed_today=completed_today,
        cancelled_today=cancelled_today,
        avg_prep_minutes=overall_avg,
        stations=performances,
    )


async def _station_backlog(db: AsyncSession, station_id: uuid.UUID) -> int:
    stmt = (
        select(func.count())
        .select_from(KOT)
        .where(KOT.station_id == station_id, KOT.status.in_(LIVE_STATUSES))
    )
    return (await db.execute(stmt)).scalar_one()


def _minutes_between(start: str | None, end: str | None) -> float | None:
    if not start or not end:
        return None
    try:
        from datetime import datetime as dt
        start_dt = dt.fromisoformat(start.replace("Z", "+00:00"))
        end_dt = dt.fromisoformat(end.replace("Z", "+00:00"))
        return (end_dt - start_dt).total_seconds() / 60
    except (ValueError, TypeError):
        return None
