"""Staff service endpoints.

Who may call what:
  * read — ``view:staff``
  * write — ``manage:staff``

Events:
  subscribes bill.paid   (a tip collected on a settled bill enters the pool)
  publishes  attendance.marked, tip.recorded

The ``bill.paid`` link matters: the tip travels on the bill event, so the pool
assembles itself as bills settle and the front of house never has to record it
separately. Splitting the pool is still a deliberate human step at period end.
"""
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
    Employee,
    ShiftRoster,
    Attendance,
    TipEntry,
    TipPoolDistribution,
    status_value,
)
from src.services.staff.schemas import (
    AttendanceClockInRequest,
    AttendanceResponse,
    ClockIn,
    ClockOut,
    EmployeeCreate,
    EmployeeResponse,
    EmployeeUpdate,
    PoolDecision,
    PoolProposal,
    RosterCreate,
    RosterDecision,
    RosterResponse,
    TipPoolResponse,
    TipPoolShareResponse,
    TipRecord,
    TipResponse,
)
from src.services.staff.util import coerce_uuid
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
    from src.services.staff.main import db as _db

    return _db.session_factory()


def _ev(topic, tenant_id=None, outlet_id=None, data=None):
    return Event(type=topic, tenant_id=tenant_id, outlet_id=outlet_id,
                 data=data or {}, source_service="staff")


def _tenant(event: Event) -> uuid.UUID | None:
    """Tenant id from an event, always as a UUID.

    The bus serialises tenant_id as a STRING (see ``Event.to_json``).
    Dispatched within one process a consumer receives the original UUID, but
    across processes it round-trips through Redis and ``Event.from_json``
    yields a bare str. Comparing a str against a UUID column returns zero rows
    rather than raising — the event is acked and silently dropped.
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
    """Collect a tip recorded on a settled bill.

    Most bills carry no tip, so a missing amount means nothing to record.
    Idempotent on bill_id: the bus delivers at least once, and a redelivered
    bill must not add the same tip to the pool twice.
    """
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
        await db.commit()
        await bus.publish(_ev(
            "tip.recorded", tenant, outlet,
            data={
                "tip_id": str(tip.id), "bill_id": str(bill_id),
                "amount": float(tip.amount),
                "employee_id": str(tip.employee_id) if tip.employee_id else None,
            },
        ))
    except Exception:
        await db.rollback()
        raise
    finally:
        await db.close()


# ─── Employees ───────────────────────────────────────────────────────────────

@router.get("/employees", response_model=list[EmployeeResponse], tags=["staff"])
async def list_employees(identity: CurrentIdentity, db: DbDep,
                         outlet_id: uuid.UUID | None = None,
                         active_only: bool = True,
                         limit: int = Query(default=200, le=1000)):
    identity.require("view:staff")
    stmt = select(Employee).where(Employee.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(Employee.outlet_id == outlet_id)
    if active_only:
        stmt = stmt.where(Employee.status.in_(["active", "probation", "on_leave"]))
    stmt = stmt.order_by(Employee.name).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/employees", response_model=EmployeeResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["staff"])
async def create_employee(payload: EmployeeCreate,
                          identity: CurrentIdentity, db: DbDep):
    identity.require("manage:staff")
    clash = await db.scalar(
        select(Employee).where(
            Employee.tenant_id == identity.tenant_id,
            Employee.employee_code == payload.employee_code,
        )
    )
    if clash is not None:
        raise HTTPException(
            status_code=409,
            detail="An employee with that employee code already exists",
        )
    data = payload.model_dump()
    for extra in ("first_name", "last_name", "role", "hourly_rate"):
        data.pop(extra, None)
    employee = Employee(tenant_id=identity.tenant_id, **data)
    db.add(employee)
    await db.flush()
    return employee


@router.get("/employees/{employee_id}", response_model=EmployeeResponse,
            tags=["staff"])
async def get_employee(employee_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:staff")
    employee = await svc.load_employee(db, identity.tenant_id, employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


@router.patch("/employees/{employee_id}", response_model=EmployeeResponse,
              tags=["staff"])
async def update_employee(employee_id: uuid.UUID, payload: EmployeeUpdate,
                          identity: CurrentIdentity, db: DbDep):
    identity.require("manage:staff")
    employee = await svc.load_employee(db, identity.tenant_id, employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(employee, field, value)
    await db.flush()
    return employee


# ─── Roster ──────────────────────────────────────────────────────────────────

@router.get("/roster", response_model=list[RosterResponse], tags=["staff"])
async def list_roster(identity: CurrentIdentity, db: DbDep,
                      employee_id: uuid.UUID | None = None,
                      date: str | None = None,
                      limit: int = Query(default=200, le=1000)):
    """The roster board — who is scheduled, optionally for one day.

    Date filtering is the shift-planning path: a duty manager opens the board
    for tomorrow, not the whole history.
    """
    identity.require("view:staff")
    from datetime import datetime as _dt
    stmt = select(ShiftRoster).where(ShiftRoster.tenant_id == identity.tenant_id)
    if employee_id:
        stmt = stmt.where(ShiftRoster.employee_id == employee_id)
    if date:
        stmt = stmt.where(
            ShiftRoster.shift_date == _dt.fromisoformat(date).date())
    stmt = stmt.order_by(ShiftRoster.shift_date).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/roster", response_model=RosterResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["staff"])
async def create_roster(payload: RosterCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:staff")
    employee = await svc.load_employee(db, identity.tenant_id, payload.employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    try:
        roster = await svc.create_roster(
            db, identity.tenant_id, employee.id, payload.shift_date,
            outlet_id=payload.outlet_id, shift_type=payload.shift_type.value,
            start_time=payload.start_time, end_time=payload.end_time,
            notes=payload.notes,
        )
    except svc.StaffError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return roster


@router.post("/roster/{roster_id}/decide", response_model=RosterResponse,
             tags=["staff"])
async def decide_roster(roster_id: uuid.UUID, payload: RosterDecision,
                        identity: CurrentIdentity, db: DbDep):
    """Complete or mark absent a rostered shift."""
    identity.require("manage:staff")
    roster = await svc.load_roster(db, identity.tenant_id, roster_id)
    if roster is None:
        raise HTTPException(status_code=404, detail="Roster entry not found")
    await svc.set_roster_status(db, identity.tenant_id, roster,
                                payload.status, notes=payload.notes)
    return roster


# ─── Attendance ──────────────────────────────────────────────────────────────

@router.post("/attendance/clock-in", response_model=AttendanceResponse, tags=["attendance"])
async def clock_in_by_payload(payload: AttendanceClockInRequest, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:staff")
    employee = await svc.load_employee(db, identity.tenant_id, payload.employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    attendance = await svc.clock_in(
        db, identity.tenant_id, employee,
        shift_id=payload.shift_id, notes=payload.notes,
    )
    await bus.publish(_ev(
        "attendance.marked", identity.tenant_id, employee.outlet_id,
        data={
            "attendance_id": str(attendance.id),
            "employee_id": str(employee.id),
            "status": status_value(attendance.status),
            "late_minutes": attendance.late_minutes,
        },
    ))
    return attendance


@router.post("/employees/{employee_id}/clock-in", response_model=AttendanceResponse,
             tags=["attendance"])
async def clock_in(employee_id: uuid.UUID, payload: ClockIn,
                   identity: CurrentIdentity, db: DbDep):
    """Clock in. Late minutes are judged against the roster, not a global time.

    A second clock-in the same day returns the existing record rather than
    creating a duplicate, so the day is never double-counted.
    """
    identity.require("manage:staff")
    employee = await svc.load_employee(db, identity.tenant_id, employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    attendance = await svc.clock_in(
        db, identity.tenant_id, employee,
        shift_id=payload.shift_id, notes=payload.notes,
    )
    await bus.publish(_ev(
        "attendance.marked", identity.tenant_id, employee.outlet_id,
        data={
            "attendance_id": str(attendance.id),
            "employee_id": str(employee.id),
            "status": status_value(attendance.status),
            "late_minutes": attendance.late_minutes,
        },
    ))
    return attendance


@router.post("/employees/{employee_id}/clock-out", response_model=AttendanceResponse,
             tags=["attendance"])
async def clock_out(employee_id: uuid.UUID, payload: ClockOut,
                    identity: CurrentIdentity, db: DbDep):
    """Clock out. Work minutes come from the clock-in record.

    Refuses to close a day that was never opened: without a clock-in there is no
    start point, so the hours could not be derived.
    """
    identity.require("manage:staff")
    employee = await svc.load_employee(db, identity.tenant_id, employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    try:
        attendance = await svc.clock_out(
            db, identity.tenant_id, employee,
            status=payload.status, notes=payload.notes,
        )
    except svc.StaffError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    if attendance is None:
        raise HTTPException(
            status_code=409, detail="No clock-in recorded for this employee today")
    return attendance


@router.get("/attendance", response_model=list[AttendanceResponse],
            tags=["attendance"])
async def list_attendance(identity: CurrentIdentity, db: DbDep,
                          employee_id: uuid.UUID | None = None,
                          date: str | None = None,
                          limit: int = Query(default=200, le=1000)):
    identity.require("view:staff")
    from datetime import datetime as _dt
    stmt = select(Attendance).where(Attendance.tenant_id == identity.tenant_id)
    if employee_id:
        stmt = stmt.where(Attendance.employee_id == employee_id)
    if date:
        stmt = stmt.where(Attendance.attendance_date == _dt.fromisoformat(date).date())
    stmt = stmt.order_by(Attendance.attendance_date.desc()).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


# ─── Tips ───────────────────────────────────────────────────────────────────

@router.post("/tips", response_model=TipResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["staff"])
async def record_tip(payload: TipRecord, identity: CurrentIdentity, db: DbDep):
    """Record a tip manually — for cash handed over without a POS line."""
    identity.require("manage:staff")
    tip = await svc.record_tip(
        db, identity.tenant_id, payload.outlet_id, payload.amount,
        employee_id=payload.employee_id, bill_id=payload.bill_id,
        shift_id=payload.shift_id,
        is_pool_eligible=payload.is_pool_eligible, notes=payload.notes,
    )
    await bus.publish(_ev(
        "tip.recorded", identity.tenant_id, payload.outlet_id,
        data={
            "tip_id": str(tip.id), "amount": float(tip.amount),
            "employee_id": str(tip.employee_id) if tip.employee_id else None,
        },
    ))
    return tip


@router.get("/tips", response_model=list[TipResponse], tags=["staff"])
async def list_tips(identity: CurrentIdentity, db: DbDep,
                    outlet_id: uuid.UUID | None = None,
                    limit: int = Query(default=200, le=1000)):
    identity.require("view:staff")
    stmt = select(TipEntry).where(TipEntry.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(TipEntry.outlet_id == outlet_id)
    stmt = stmt.order_by(TipEntry.collected_at.desc()).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


@router.get("/tip-pools", response_model=list[TipPoolResponse], tags=["staff"])
async def list_pools(identity: CurrentIdentity, db: DbDep,
                     outlet_id: uuid.UUID | None = None,
                     status_filter: str | None = None,
                     limit: int = Query(default=100, le=500)):
    """Tip pool proposals, for the manager to approve.

    Shares are loaded eagerly: a lazy load here would fire during serialisation
    and raise MissingGreenlet.
    """
    identity.require("view:staff")
    stmt = (select(TipPoolDistribution)
            .options(selectinload(TipPoolDistribution.shares))
            .where(TipPoolDistribution.tenant_id == identity.tenant_id))
    if outlet_id:
        stmt = stmt.where(TipPoolDistribution.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(TipPoolDistribution.status == status_filter)
    stmt = stmt.order_by(TipPoolDistribution.created_at.desc()).limit(limit)
    return [_pool_response(pool) for pool in (await db.execute(stmt)).scalars().all()]


def _pool_response(pool: TipPoolDistribution) -> TipPoolResponse:
    """Shape a pool and its shares into a response, summing the shares.

    ``distributed_total`` lets the UI verify the shares add up to the pot.
    """
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


@router.post("/tip-pools", response_model=TipPoolResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["staff"],
             summary="Propose a split of the day's tip pool")
async def propose_pool(payload: PoolProposal, identity: CurrentIdentity, db: DbDep):
    """Propose a tip pool split.

    Shares are fractions of the pot and must not exceed 1.0 — a proposal that
    does would distribute money that was never collected. Proposal is not
    payment; the pool still needs approval.
    """
    identity.require("manage:staff")
    try:
        pool = await svc.propose_pool(
            db, identity.tenant_id, payload.outlet_id, payload.total_pool,
            payload.shares,
            period_start=payload.period_start, period_end=payload.period_end,
            notes=payload.notes,
        )
    except svc.StaffError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    loaded = await svc.load_pool(db, identity.tenant_id, pool.id)
    return _pool_response(loaded)


@router.get("/tip-pools/{pool_id}", response_model=TipPoolResponse, tags=["staff"])
async def get_pool(pool_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:staff")
    pool = await svc.load_pool(db, identity.tenant_id, pool_id)
    if pool is None:
        raise HTTPException(status_code=404, detail="Tip pool not found")
    return _pool_response(pool)


@router.post("/tip-pools/{pool_id}/decide", response_model=TipPoolResponse,
             tags=["staff"], summary="Approve or reject a proposed pool split")
async def decide_pool(pool_id: uuid.UUID, payload: PoolDecision,
                      identity: CurrentIdentity, db: DbDep):
    """Approve a proposed split. Approval is the gate before payout."""
    identity.require("manage:staff")
    pool = await svc.load_pool(db, identity.tenant_id, pool_id)
    if pool is None:
        raise HTTPException(status_code=404, detail="Tip pool not found")
    try:
        await svc.decide_pool(
            db, identity.tenant_id, pool, payload.approve,
            approved_by=identity.user_id, notes=payload.notes,
        )
    except svc.StaffError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return _pool_response(pool)


@router.post("/tip-pools/{pool_id}/pay", response_model=TipPoolResponse,
             tags=["staff"], summary="Mark an approved pool as paid")
async def pay_pool(pool_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    """Pay out an approved pool. Only approved pools can be paid."""
    identity.require("manage:staff")
    pool = await svc.load_pool(db, identity.tenant_id, pool_id)
    if pool is None:
        raise HTTPException(status_code=404, detail="Tip pool not found")
    try:
        await svc.pay_pool(db, identity.tenant_id, pool)
    except svc.StaffError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return _pool_response(pool)
