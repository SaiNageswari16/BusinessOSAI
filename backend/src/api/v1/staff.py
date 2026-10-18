"""Staff endpoints — employees, roster, attendance, tips, feedback, complaints."""
import uuid
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission, resolve_outlet_id
from src.database.session import get_db
from src.models import (
    Attendance,
    AttendanceStatus,
    Bill,
    Complaint,
    Employee,
    EmployeeRoleType,
    Feedback,
    FeedbackStatus,
    ShiftRoster,
    Tip,
    TipPoolDistribution,
)
from src.schemas.staff import (
    AttendanceCheckIn,
    AttendanceCheckOut,
    AttendanceResponse,
    AttendanceUpdate,
    ComplaintCreate,
    ComplaintResponse,
    ComplaintStatusUpdate,
    EmployeeCreate,
    EmployeeResponse,
    EmployeeUpdate,
    FeedbackCreate,
    FeedbackResponse,
    FeedbackStatusUpdate,
    FeedbackSummary,
    FeedbackUpdate,
    RosterCreate,
    RosterResponse,
    RosterUpdate,
    TipCreate,
    TipPoolCreate,
    TipPoolResponse,
    TipResponse,
)
from src.services.kot_service import _status_value
from src.services.number_series import allocate_number

router = APIRouter(prefix="/staff", tags=["Staff"])

TWO_PLACES = Decimal("0.01")


def _d(value) -> Decimal:
    return Decimal("0") if value is None else Decimal(str(value))


def _money(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Employees ───────────────────────────────────────────────────

@router.get("/employees", response_model=list[EmployeeResponse])
async def list_employees(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    search: str | None = None,
    include_inactive: bool = False,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(Employee).where(Employee.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(Employee.outlet_id == outlet_id)
    if not include_inactive:
        stmt = stmt.where(Employee.is_active.is_(True))
    if search:
        stmt = stmt.where(
            Employee.full_name.ilike(f"%{search}%")
            | Employee.employee_code.ilike(f"%{search}%")
            | Employee.phone.ilike(f"%{search}%")
        )
    stmt = stmt.order_by(Employee.full_name)
    return [
        EmployeeResponse.model_validate(e)
        for e in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/employees", response_model=EmployeeResponse,
             status_code=status.HTTP_201_CREATED)
async def create_employee(
    payload: EmployeeCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id)

    employee = Employee(
        tenant_id=ctx.tenant_id,
        employee_code=await allocate_number(db, ctx.tenant_id, "employee", payload.outlet_id),
        **payload.model_dump(),
    )
    db.add(employee)
    await db.commit()
    await db.refresh(employee)
    return EmployeeResponse.model_validate(employee)


@router.get("/employees/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    employee = await db.scalar(
        select(Employee).where(
            Employee.id == employee_id, Employee.tenant_id == ctx.tenant_id
        )
    )
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    resolve_outlet_id(ctx, employee.outlet_id)
    return EmployeeResponse.model_validate(employee)


@router.put("/employees/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: uuid.UUID,
    payload: EmployeeUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    employee = await db.scalar(
        select(Employee).where(
            Employee.id == employee_id, Employee.tenant_id == ctx.tenant_id
        )
    )
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    resolve_outlet_id(ctx, employee.outlet_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(employee, field, value)
    await db.commit()
    await db.refresh(employee)
    return EmployeeResponse.model_validate(employee)


@router.get("/waiters", response_model=list[EmployeeResponse])
async def list_waiters(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
):
    """Serving staff for the waiter picker on the order screen."""
    resolve_outlet_id(ctx, outlet_id)
    stmt = (
        select(Employee)
        .where(
            Employee.tenant_id == ctx.tenant_id,
            Employee.outlet_id == outlet_id,
            Employee.is_active.is_(True),
            Employee.role_type.in_([EmployeeRoleType.WAITER, EmployeeRoleType.CAPTAIN]),
        )
        .order_by(Employee.full_name)
    )
    return [
        EmployeeResponse.model_validate(e)
        for e in (await db.execute(stmt)).scalars().all()
    ]


# ─── Roster ──────────────────────────────────────────────────────

@router.get("/roster", response_model=list[RosterResponse])
async def list_roster(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(ShiftRoster).where(ShiftRoster.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(ShiftRoster.outlet_id == outlet_id)
    if date_from:
        stmt = stmt.where(ShiftRoster.shift_date >= date_from)
    if date_to:
        stmt = stmt.where(ShiftRoster.shift_date <= date_to)
    stmt = stmt.order_by(ShiftRoster.shift_date, ShiftRoster.start_time)
    return [
        RosterResponse.model_validate(r)
        for r in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/roster", response_model=RosterResponse, status_code=status.HTTP_201_CREATED)
async def create_roster(
    payload: RosterCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id)

    employee = await db.scalar(
        select(Employee).where(
            Employee.id == payload.employee_id, Employee.tenant_id == ctx.tenant_id
        )
    )
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")

    # One shift per employee per day
    clash = await db.scalar(
        select(ShiftRoster.id).where(
            ShiftRoster.employee_id == payload.employee_id,
            ShiftRoster.shift_date == payload.shift_date,
        )
    )
    if clash:
        raise HTTPException(
            status_code=409,
            detail=f"{employee.full_name} is already rostered on {payload.shift_date}",
        )

    roster = ShiftRoster(
        tenant_id=ctx.tenant_id,
        outlet_id=payload.outlet_id,
        employee_id=payload.employee_id,
        shift_date=payload.shift_date,
        start_time=payload.start_time.strftime("%H:%M"),
        end_time=payload.end_time.strftime("%H:%M"),
        shift_type=payload.shift_type,
        status=payload.status,
    )
    db.add(roster)
    await db.commit()
    await db.refresh(roster)
    return RosterResponse.model_validate(roster)


@router.put("/roster/{roster_id}", response_model=RosterResponse)
async def update_roster(
    roster_id: uuid.UUID,
    payload: RosterUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    roster = await db.scalar(
        select(ShiftRoster).where(
            ShiftRoster.id == roster_id, ShiftRoster.tenant_id == ctx.tenant_id
        )
    )
    if roster is None:
        raise HTTPException(status_code=404, detail="Roster entry not found")
    resolve_outlet_id(ctx, roster.outlet_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        if field in ("start_time", "end_time") and value is not None:
            # The column stores "HH:MM"; the schema hands us a time object
            value = value.strftime("%H:%M")
        setattr(roster, field, value)
    await db.commit()
    await db.refresh(roster)
    return RosterResponse.model_validate(roster)


@router.delete("/roster/{roster_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_roster(
    roster_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    roster = await db.scalar(
        select(ShiftRoster).where(
            ShiftRoster.id == roster_id, ShiftRoster.tenant_id == ctx.tenant_id
        )
    )
    if roster is None:
        raise HTTPException(status_code=404, detail="Roster entry not found")
    resolve_outlet_id(ctx, roster.outlet_id)

    await db.delete(roster)
    await db.commit()


# ─── Attendance ──────────────────────────────────────────────────

@router.post("/attendance/check-in", response_model=AttendanceResponse,
             status_code=status.HTTP_201_CREATED)
async def check_in(
    payload: AttendanceCheckIn,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id)
    employee = await db.scalar(
        select(Employee).where(
            Employee.id == payload.employee_id, Employee.tenant_id == ctx.tenant_id
        )
    )
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")

    existing = await db.scalar(
        select(Attendance).where(
            Attendance.employee_id == payload.employee_id,
            Attendance.attendance_date == payload.attendance_date,
        )
    )
    if existing is not None:
        if existing.check_in:
            raise HTTPException(
                status_code=409,
                detail=f"{employee.full_name} already checked in today",
            )
        existing.check_in = datetime.now(timezone.utc).isoformat()
        await db.commit()
        await db.refresh(existing)
        return AttendanceResponse.model_validate(existing)

    attendance = Attendance(
        tenant_id=ctx.tenant_id,
        outlet_id=payload.outlet_id,
        employee_id=payload.employee_id,
        attendance_date=payload.attendance_date,
        check_in=datetime.now(timezone.utc).isoformat(),
        status=AttendanceStatus.PRESENT,
    )
    db.add(attendance)
    await db.commit()
    await db.refresh(attendance)
    return AttendanceResponse.model_validate(attendance)


@router.post("/attendance/check-out", response_model=AttendanceResponse)
async def check_out(
    payload: AttendanceCheckOut,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id)
    attendance = await db.scalar(
        select(Attendance).where(
            Attendance.employee_id == payload.employee_id,
            Attendance.attendance_date == payload.attendance_date,
        )
    )
    if attendance is None:
        raise HTTPException(status_code=404, detail="No check-in found for this date")
    resolve_outlet_id(ctx, attendance.outlet_id)

    if attendance.check_out:
        raise HTTPException(status_code=409, detail="Already checked out")

    attendance.check_out = datetime.now(timezone.utc).isoformat()

    if attendance.check_in:
        try:
            start = datetime.fromisoformat(attendance.check_in.replace("Z", "+00:00"))
            end = datetime.fromisoformat(attendance.check_out.replace("Z", "+00:00"))
            hours = (end - start).total_seconds() / 3600
            attendance.worked_hours = round(max(hours, 0), 2)
            # Anything past 9 hours is overtime
            if attendance.worked_hours > 9:
                attendance.overtime_hours = round(attendance.worked_hours - 9, 2)
        except (ValueError, TypeError):
            pass

    await db.commit()
    await db.refresh(attendance)
    return AttendanceResponse.model_validate(attendance)


@router.get("/attendance", response_model=list[AttendanceResponse])
async def list_attendance(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    employee_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(Attendance).where(Attendance.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(Attendance.outlet_id == outlet_id)
    if employee_id:
        stmt = stmt.where(Attendance.employee_id == employee_id)
    if date_from:
        stmt = stmt.where(Attendance.attendance_date >= date_from)
    if date_to:
        stmt = stmt.where(Attendance.attendance_date <= date_to)
    stmt = stmt.order_by(Attendance.attendance_date.desc())
    return [
        AttendanceResponse.model_validate(a)
        for a in (await db.execute(stmt)).scalars().all()
    ]


@router.put("/attendance/{attendance_id}", response_model=AttendanceResponse)
async def update_attendance(
    attendance_id: uuid.UUID,
    payload: AttendanceUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    attendance = await db.scalar(
        select(Attendance).where(
            Attendance.id == attendance_id, Attendance.tenant_id == ctx.tenant_id
        )
    )
    if attendance is None:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    resolve_outlet_id(ctx, attendance.outlet_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(attendance, field, value)
    await db.commit()
    await db.refresh(attendance)
    return AttendanceResponse.model_validate(attendance)


# ─── Tips ────────────────────────────────────────────────────────

@router.post("/tips", response_model=TipResponse, status_code=status.HTTP_201_CREATED)
async def create_tip(
    payload: TipCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Credit a tip collected on a bill to a staff member."""
    resolve_outlet_id(ctx, payload.outlet_id)
    if payload.employee_id:
        employee = await db.scalar(
            select(Employee).where(
                Employee.id == payload.employee_id, Employee.tenant_id == ctx.tenant_id
            )
        )
        if employee is None:
            raise HTTPException(status_code=404, detail="Employee not found")

    if payload.bill_id:
        bill = await db.scalar(
            select(Bill).where(Bill.id == payload.bill_id, Bill.tenant_id == ctx.tenant_id)
        )
        if bill is None:
            raise HTTPException(status_code=404, detail="Bill not found")

    tip = Tip(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(tip)
    await db.commit()
    await db.refresh(tip)
    return TipResponse.model_validate(tip)


@router.get("/tips", response_model=list[TipResponse])
async def list_tips(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    employee_id: uuid.UUID | None = None,
    is_distributed: bool | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(Tip).where(Tip.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(Tip.outlet_id == outlet_id)
    if employee_id:
        stmt = stmt.where(Tip.employee_id == employee_id)
    if is_distributed is not None:
        stmt = stmt.where(Tip.is_distributed.is_(is_distributed))
    stmt = stmt.order_by(Tip.created_at.desc())
    return [
        TipResponse.model_validate(t)
        for t in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/tips/pools", response_model=TipPoolResponse,
             status_code=status.HTTP_201_CREATED)
async def create_tip_pool(
    payload: TipPoolCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Record a day's tip pool split and stamp the contributing tips as paid out.

    `distribution` is a list of `{"employee_id": ..., "amount": ...}` entries.
    """
    resolve_outlet_id(ctx, payload.outlet_id)

    if not payload.distribution:
        raise HTTPException(status_code=422, detail="distribution cannot be empty")

    allocated = _money(sum(
        (_d(entry.get("amount", 0)) for entry in payload.distribution), Decimal("0")
    ))
    if allocated != _money(_d(payload.total_amount)):
        raise HTTPException(
            status_code=400,
            detail=f"Distribution of {allocated} does not match the pool total "
                   f"{_money(_d(payload.total_amount))}",
        )

    # Every entry must name a real employee at this outlet
    employee_ids = {entry.get("employee_id") for entry in payload.distribution}
    employees = {
        str(e.id): e
        for e in (
            await db.execute(
                select(Employee).where(
                    Employee.tenant_id == ctx.tenant_id,
                    Employee.outlet_id == payload.outlet_id,
                    Employee.id.in_(employee_ids),
                )
            )
        ).scalars().all()
    }
    unknown = employee_ids - set(employees.keys())
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown employees: {sorted(unknown)}")

    pool = TipPoolDistribution(
        tenant_id=ctx.tenant_id,
        outlet_id=payload.outlet_id,
        pool_date=payload.pool_date,
        total_amount=float(_money(_d(payload.total_amount))),
        distribution=[
            {
                "employee_id": str(entry["employee_id"]),
                "employee_name": employees[str(entry["employee_id"])].full_name,
                "amount": float(_money(_d(entry.get("amount", 0)))),
            }
            for entry in payload.distribution
        ],
        status="distributed",
        distributed_by=ctx.user_id,
    )
    db.add(pool)
    await db.flush()

    # Stamp the day's undistributed tips so they are not paid out twice
    now = _now_iso()
    tips = (
        await db.execute(
            select(Tip).where(
                Tip.tenant_id == ctx.tenant_id,
                Tip.outlet_id == payload.outlet_id,
                func.date(Tip.created_at) == payload.pool_date,
                Tip.is_distributed.is_(False),
            )
        )
    ).scalars().all()
    for tip in tips:
        tip.is_distributed = True
        tip.distributed_at = now

    await db.commit()
    await db.refresh(pool)
    return TipPoolResponse.model_validate(pool)


@router.get("/tips/pools", response_model=list[TipPoolResponse])
async def list_tip_pools(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(TipPoolDistribution).where(
        TipPoolDistribution.tenant_id == ctx.tenant_id
    )
    if outlet_id:
        stmt = stmt.where(TipPoolDistribution.outlet_id == outlet_id)
    stmt = stmt.order_by(TipPoolDistribution.pool_date.desc())
    return [
        TipPoolResponse.model_validate(p)
        for p in (await db.execute(stmt)).scalars().all()
    ]


# ─── Feedback & complaints ───────────────────────────────────────

@router.post("/feedback", response_model=FeedbackResponse,
             status_code=status.HTTP_201_CREATED)
async def create_feedback(
    payload: FeedbackCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Guest rating from the QR code or the POS survey."""
    if payload.order_id or payload.bill_id:
        from src.models import Order
        if payload.order_id:
            order = await db.scalar(
                select(Order).where(
                    Order.id == payload.order_id, Order.tenant_id == ctx.tenant_id
                )
            )
            if order is None:
                raise HTTPException(status_code=404, detail="Order not found")
            resolve_outlet_id(ctx, order.outlet_id)
        else:
            bill = await db.scalar(
                select(Bill).where(
                    Bill.id == payload.bill_id, Bill.tenant_id == ctx.tenant_id
                )
            )
            if bill is None:
                raise HTTPException(status_code=404, detail="Bill not found")
            resolve_outlet_id(ctx, bill.outlet_id)
    else:
        resolve_outlet_id(ctx, payload.outlet_id)

    feedback = Feedback(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)
    return FeedbackResponse.model_validate(feedback)


@router.get("/feedback", response_model=list[FeedbackResponse])
async def list_feedback(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    source: str | None = None,
    min_rating: int | None = None,
    limit: int = 100,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(Feedback).where(Feedback.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(Feedback.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(Feedback.status == status_filter)
    if source:
        stmt = stmt.where(Feedback.source == source)
    if min_rating is not None:
        stmt = stmt.where(Feedback.rating_overall >= min_rating)
    stmt = stmt.order_by(Feedback.created_at.desc()).limit(limit)
    return [
        FeedbackResponse.model_validate(f)
        for f in (await db.execute(stmt)).scalars().all()
    ]


@router.put("/feedback/{feedback_id}", response_model=FeedbackResponse)
async def update_feedback(
    feedback_id: uuid.UUID,
    payload: FeedbackUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    feedback = await db.scalar(
        select(Feedback).where(
            Feedback.id == feedback_id, Feedback.tenant_id == ctx.tenant_id
        )
    )
    if feedback is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    resolve_outlet_id(ctx, feedback.outlet_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(feedback, field, value)
    await db.commit()
    await db.refresh(feedback)
    return FeedbackResponse.model_validate(feedback)


@router.put("/feedback/{feedback_id}/status", response_model=FeedbackResponse)
async def update_feedback_status(
    feedback_id: uuid.UUID,
    payload: FeedbackStatusUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    feedback = await db.scalar(
        select(Feedback).where(
            Feedback.id == feedback_id, Feedback.tenant_id == ctx.tenant_id
        )
    )
    if feedback is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    resolve_outlet_id(ctx, feedback.outlet_id)

    feedback.status = payload.status
    await db.commit()
    await db.refresh(feedback)
    return FeedbackResponse.model_validate(feedback)


@router.get("/feedback/summary", response_model=FeedbackSummary)
async def feedback_summary(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
    date_from: date | None = None,
    date_to: date | None = None,
):
    """Averages per dimension plus how many reviews are still unanswered."""
    resolve_outlet_id(ctx, outlet_id)
    stmt = select(Feedback).where(
        Feedback.tenant_id == ctx.tenant_id, Feedback.outlet_id == outlet_id
    )
    if date_from:
        stmt = stmt.where(Feedback.created_at >= date_from.isoformat())
    if date_to:
        stmt = stmt.where(Feedback.created_at <= date_to.isoformat() + "T23:59:59")

    rows = (await db.execute(stmt)).scalars().all()

    def _avg(values) -> float | None:
        nums = [v for v in values if v is not None]
        return round(sum(nums) / len(nums), 2) if nums else None

    return FeedbackSummary(
        count=len(rows),
        avg_overall=_avg([r.rating_overall for r in rows]),
        avg_food=_avg([r.rating_food for r in rows]),
        avg_service=_avg([r.rating_service for r in rows]),
        avg_ambience=_avg([r.rating_ambience for r in rows]),
        outstanding=sum(1 for r in rows if _status_value(r.status) == "new"),
    )


@router.post("/complaints", response_model=ComplaintResponse,
             status_code=status.HTTP_201_CREATED)
async def create_complaint(
    payload: ComplaintCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id)
    complaint = Complaint(
        tenant_id=ctx.tenant_id,
        raised_by=ctx.user_id,
        **payload.model_dump(),
    )
    db.add(complaint)
    await db.commit()
    await db.refresh(complaint)
    return ComplaintResponse.model_validate(complaint)


@router.get("/complaints", response_model=list[ComplaintResponse])
async def list_complaints(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    status_filter: str | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(Complaint).where(Complaint.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(Complaint.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(Complaint.status == status_filter)
    stmt = stmt.order_by(Complaint.created_at.desc())
    return [
        ComplaintResponse.model_validate(c)
        for c in (await db.execute(stmt)).scalars().all()
    ]


@router.put("/complaints/{complaint_id}/status", response_model=ComplaintResponse)
async def update_complaint_status(
    complaint_id: uuid.UUID,
    payload: ComplaintStatusUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:staff"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    complaint = await db.scalar(
        select(Complaint).where(
            Complaint.id == complaint_id, Complaint.tenant_id == ctx.tenant_id
        )
    )
    if complaint is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    resolve_outlet_id(ctx, complaint.outlet_id)

    complaint.status = payload.status
    if payload.resolution:
        complaint.resolution = payload.resolution

    # Closing or resolving stamps who did it and when
    if _status_value(payload.status) in ("resolved", "closed"):
        complaint.resolved_by = ctx.user_id
        complaint.resolved_at = _now_iso()

    await db.commit()
    await db.refresh(complaint)
    return ComplaintResponse.model_validate(complaint)
