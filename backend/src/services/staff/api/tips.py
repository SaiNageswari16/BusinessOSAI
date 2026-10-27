"""Staff tip management and event subscribers."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status as http_status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.event_bus.bus import Event, bus
from src.services.staff import service as svc
from src.services.staff.models import (
    TipEntry,
    TipPoolDistribution,
)
from src.services.staff.schemas import (
    PoolDecision,
    PoolProposal,
    TipPoolResponse,
    TipPoolShareResponse,
    TipRecord,
    TipResponse,
)
from src.services.staff.util import coerce_uuid
from src.services.staff.deps import get_db, CurrentUserContext, require_permission

router = APIRouter(tags=["Staff Tips & Pools"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


def _handler_db() -> AsyncSession:
    """A session owned by an event handler, not by a request."""
    from src.services.staff.main import db as _db

    return _db.session_factory()


def _ev(topic, tenant_id=None, outlet_id=None, data=None):
    return Event(type=topic, tenant_id=tenant_id, outlet_id=outlet_id,
                 data=data or {}, source_service="staff")


def _tenant(event: Event) -> uuid.UUID | None:
    value = event.tenant_id
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


def _outbox(db: AsyncSession, event: Event) -> None:
    """Write the event to the outbox inside the current transaction.

    The outbox row is added to the same session that owns the domain change,
    so both commit or roll back together. The relay background task picks up
    pending rows and pushes them to the event bus.
    """
    from src.services.staff.models import OutboxMessage

    db.add(OutboxMessage(
        event_id=event.event_id,
        type=event.type,
        tenant_id=event.tenant_id,
        outlet_id=event.outlet_id,
        data=event.data,
        source_service=event.source_service,
        status="pending",
    ))


# ─── Event Consumer ──────────────────────────────────────────────────────────

@bus.on("bill.paid")
async def _on_bill_paid(event: Event) -> None:
    """Collect a tip recorded on a settled bill."""
    data = event.data or {}
    tenant = _tenant(event)
    if tenant is None or not data.get("bill_id"):
        return
    bill_id = coerce_uuid(data.get("bill_id"))
    outlet = coerce_uuid(data.get("outlet_id"))
    if bill_id is None or outlet is None:
        return

    amount = float(data.get("tip_amount") or 0)
    if amount <= 0:
        return

    db = _handler_db()
    try:
        existing = await db.scalar(
            select(TipEntry).where(
                TipEntry.tenant_id == tenant, TipEntry.bill_id == bill_id
            )
        )
        if existing is not None:
            return
        tip = await svc.record_tip(
            db, tenant, outlet, amount,
            employee_id=coerce_uuid(data.get("server_id")),
            bill_id=bill_id,
            shift_id=coerce_uuid(data.get("shift_id")),
            is_pool_eligible=bool(data.get("tip_pool_eligible", True)),
            notes=f"bill {data.get('bill_number') or bill_id}",
        )
        event = _ev(
            "tip.recorded", tenant, outlet,
            data={
                "tip_id": str(tip.id), "bill_id": str(bill_id),
                "amount": float(tip.amount),
                "employee_id": str(tip.employee_id) if tip.employee_id else None,
            },
        )
        _outbox(db, event)
        await db.commit()
        await bus.publish(event, local=True)
    except Exception:
        await db.rollback()
        raise
    finally:
        await db.close()


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/tips", response_model=TipResponse,
             status_code=http_status.HTTP_201_CREATED)
async def record_tip(
    payload: TipRecord,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:staff"))],
    db: DbDep,
):
    tip = await svc.record_tip(
        db, ctx.tenant_id, payload.outlet_id, payload.amount,
        employee_id=payload.employee_id, bill_id=payload.bill_id,
        shift_id=payload.shift_id,
        is_pool_eligible=payload.is_pool_eligible, notes=payload.notes,
    )
    event = _ev(
        "tip.recorded", ctx.tenant_id, payload.outlet_id,
        data={
            "tip_id": str(tip.id), "amount": float(tip.amount),
            "employee_id": str(tip.employee_id) if tip.employee_id else None,
        },
    )
    _outbox(db, event)
    await db.commit()
    await bus.publish(event, local=True)
    return tip


@router.get("/tips", response_model=list[TipResponse])
async def list_tips(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:staff"))],
    db: DbDep,
    outlet_id: uuid.UUID | None = None,
    limit: int = Query(default=200, le=1000),
):
    stmt = select(TipEntry).where(TipEntry.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(TipEntry.outlet_id == outlet_id)
    stmt = stmt.order_by(TipEntry.collected_at.desc()).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


def _pool_response(pool: TipPoolDistribution) -> TipPoolResponse:
    shares = pool.shares or []
    return TipPoolResponse(
        id=pool.id,
        outlet_id=pool.outlet_id,
        pool_amount_key=pool.pool_amount_key,
        status=pool.status,
        total_pool=float(pool.total_pool),
        period_start=pool.period_start,
        period_end=pool.period_end,
        approved_by=pool.approved_by,
        paid_at=pool.paid_at,
        notes=pool.notes,
        created_at=pool.created_at,
        shares=[TipPoolShareResponse(
            id=s.id, distribution_id=s.distribution_id,
            employee_id=s.employee_id, amount=float(s.amount),
            fraction=float(s.fraction), reason=s.reason,
        ) for s in shares],
        distributed_total=round(sum(float(s.amount) for s in shares), 2),
    )


@router.get("/tip-pools", response_model=list[TipPoolResponse])
async def list_pools(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:staff"))],
    db: DbDep,
    outlet_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    limit: int = Query(default=100, le=500),
):
    stmt = (select(TipPoolDistribution)
            .options(selectinload(TipPoolDistribution.shares))
            .where(TipPoolDistribution.tenant_id == ctx.tenant_id))
    if outlet_id:
        stmt = stmt.where(TipPoolDistribution.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(TipPoolDistribution.status == status_filter)
    stmt = stmt.order_by(TipPoolDistribution.created_at.desc()).limit(limit)
    return [_pool_response(pool) for pool in (await db.execute(stmt)).scalars().all()]


@router.post("/tip-pools", response_model=TipPoolResponse,
             status_code=http_status.HTTP_201_CREATED)
async def propose_pool(
    payload: PoolProposal,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:staff"))],
    db: DbDep,
):
    try:
        pool = await svc.propose_pool(
            db, ctx.tenant_id, payload.outlet_id, payload.total_pool,
            payload.shares,
            period_start=payload.period_start, period_end=payload.period_end,
            notes=payload.notes,
        )
    except svc.StaffError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    loaded = await svc.load_pool(db, ctx.tenant_id, pool.id)
    return _pool_response(loaded)


@router.get("/tip-pools/{pool_id}", response_model=TipPoolResponse)
async def get_pool(
    pool_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:staff"))],
    db: DbDep,
):
    pool = await svc.load_pool(db, ctx.tenant_id, pool_id)
    if pool is None:
        raise HTTPException(status_code=404, detail="Tip pool not found")
    return _pool_response(pool)


@router.post("/tip-pools/{pool_id}/decide", response_model=TipPoolResponse)
async def decide_pool(
    pool_id: uuid.UUID,
    payload: PoolDecision,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:staff"))],
    db: DbDep,
):
    pool = await svc.load_pool(db, ctx.tenant_id, pool_id)
    if pool is None:
        raise HTTPException(status_code=404, detail="Tip pool not found")
    try:
        await svc.decide_pool(
            db, ctx.tenant_id, pool, payload.approve,
            approved_by=ctx.user_id, notes=payload.notes,
        )
    except svc.StaffError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return _pool_response(pool)


@router.post("/tip-pools/{pool_id}/pay", response_model=TipPoolResponse)
async def pay_pool(
    pool_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:staff"))],
    db: DbDep,
):
    pool = await svc.load_pool(db, ctx.tenant_id, pool_id)
    if pool is None:
        raise HTTPException(status_code=404, detail="Tip pool not found")
    try:
        await svc.pay_pool(db, ctx.tenant_id, pool)
    except svc.StaffError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return _pool_response(pool)
