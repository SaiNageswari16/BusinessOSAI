"""Staff service logic — roster, attendance, clocking, tip pools.

The three things this service is responsible for:

1. Attendance is one row per employee per day, keyed on (employee, date). The
   unique constraint is what stops a double clock-in creating two records for
   the same shift.
2. Late minutes are computed against the *roster*, not a global start time. A
   night-shift employee starting at 22:00 must not be flagged as late for
   missing a 09:00 threshold.
3. Tip pools are proposed, then approved, then paid. Pool money belongs to a
   group until someone signs off the split, so the split is stored before it
   is settled rather than computed at payout time and forgotten.
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.staff.models import (
    Attendance,
    AttendanceStatus,
    Employee,
    RosterStatus,
    ShiftRoster,
    TipDistributionStatus,
    TipEntry,
    TipPoolDistribution,
    TipPoolShare,
)

LATE_TOLERANCE_MINUTES = 15


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _member(value, enum_type):
    """Coerce a stored value to an enum member, however it was loaded.

    Status columns are ``String``, so a value loaded back from Postgres is a
    bare ``str`` and comparing it to an enum member would always fail.
    """
    return value if isinstance(value, enum_type) else enum_type(str(value))


class StaffError(Exception):
    """A rejected staff operation. The API maps this to 409 or 400."""


# ─── Employees ───────────────────────────────────────────────────────────────

async def load_employee(
    db: AsyncSession, tenant_id: uuid.UUID, employee_id: uuid.UUID
) -> Employee | None:
    return await db.scalar(
        select(Employee).where(
            Employee.id == employee_id, Employee.tenant_id == tenant_id
        )
    )


# ─── Roster ──────────────────────────────────────────────────────────────────

async def create_roster(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    employee_id: uuid.UUID,
    shift_date: date,
    *,
    outlet_id: uuid.UUID | None = None,
    shift_type: str = "morning",
    start_time: str | None = None,
    end_time: str | None = None,
    notes: str | None = None,
) -> ShiftRoster:
    """Schedule an employee for a day.

    Refuses to double-book: one roster per employee per day. Two shifts on the
    same day would make attendance ambiguous — the clock-in could not say which
    roster it belonged to, and late minutes would be judged against the wrong
    start time.
    """
    clash = await db.scalar(
        select(ShiftRoster).where(
            ShiftRoster.tenant_id == tenant_id,
            ShiftRoster.employee_id == employee_id,
            ShiftRoster.shift_date == shift_date,
            ShiftRoster.status == RosterStatus.SCHEDULED,
        )
    )
    if clash is not None:
        raise StaffError(
            "This employee is already rostered for that day"
        )

    roster = ShiftRoster(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        employee_id=employee_id,
        shift_date=shift_date,
        shift_type=shift_type,
        start_time=start_time,
        end_time=end_time,
        status=RosterStatus.SCHEDULED,
        notes=notes,
    )
    db.add(roster)
    await db.flush()
    return roster


async def load_roster(
    db: AsyncSession, tenant_id: uuid.UUID, roster_id: uuid.UUID
) -> ShiftRoster | None:
    return await db.scalar(
        select(ShiftRoster).where(
            ShiftRoster.id == roster_id, ShiftRoster.tenant_id == tenant_id
        )
    )


async def set_roster_status(
    db: AsyncSession, tenant_id: uuid.UUID, roster: ShiftRoster,
    status: RosterStatus, notes: str | None = None
) -> ShiftRoster:
    """Complete or cancel a rostered shift.

    Completed and absent both close the shift; either of them will let
    attendance settle without a pending roster hanging over the day.
    """
    roster.status = status
    if notes and roster.notes is None:
        roster.notes = notes
    await db.flush()
    return roster


# ─── Attendance ──────────────────────────────────────────────────────────────

async def clock_in(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    employee: Employee,
    *,
    shift_id: uuid.UUID | None = None,
    notes: str | None = None,
) -> Attendance:
    """Open today's attendance record and compute lateness against the roster.

    Lateness is measured from the rostered start time, not from midnight or a
    global threshold. An employee rostered for a night shift must not be marked
    late for missing a morning threshold, and a missing roster means no
    baseline, which means zero late minutes rather than an invented one.

    One record per employee per day: a second clock-in on the same day returns
    the existing row rather than creating a duplicate.
    """
    today = _now().date()
    existing = await db.scalar(
        select(Attendance).where(
            Attendance.tenant_id == tenant_id,
            Attendance.employee_id == employee.id,
            Attendance.attendance_date == today,
        )
    )
    if existing is not None:
        return existing

    # The roster is the authority on when this person was due. If there is no
    # roster for today there is no baseline, so lateness is undefined and
    # recorded as zero rather than guessed.
    roster = await db.scalar(
        select(ShiftRoster).where(
            ShiftRoster.tenant_id == tenant_id,
            ShiftRoster.employee_id == employee.id,
            ShiftRoster.shift_date == today,
            ShiftRoster.status == RosterStatus.SCHEDULED,
        )
    )
    late = 0
    if roster is not None and roster.start_time:
        try:
            start = datetime.combine(today, _parse_time(roster.start_time))
        except ValueError:
            start = None
        if start is not None:
            diff = int((_now() - start).total_seconds() // 60)
            late = max(0, diff - LATE_TOLERANCE_MINUTES)

    attendance = Attendance(
        tenant_id=tenant_id,
        outlet_id=employee.outlet_id,
        employee_id=employee.id,
        attendance_date=today,
        clock_in=_now(),
        status=AttendanceStatus.LATE if late > 0 else AttendanceStatus.PRESENT,
        late_minutes=late,
        shift_id=shift_id,
        notes=notes,
    )
    db.add(attendance)
    await db.flush()
    return attendance


async def clock_out(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    employee: Employee,
    *,
    status: AttendanceStatus | None = None,
    notes: str | None = None,
) -> Attendance | None:
    """Close today's attendance record and compute hours worked.

    Requires a clock-in first: closing with no clock-in has no start point, so
    work minutes could not be derived. Returning None lets the caller report
    that the day was never opened rather than inventing a zero-hour record.
    """
    today = _now().date()
    attendance = await db.scalar(
        select(Attendance).where(
            Attendance.tenant_id == tenant_id,
            Attendance.employee_id == employee.id,
            Attendance.attendance_date == today,
        )
    )
    if attendance is None:
        return None
    if attendance.clock_in is None:
        raise StaffError("Cannot clock out without a clock-in for today")

    attendance.clock_out = _now()
    attendance.work_minutes = int(
        (_now() - attendance.clock_in).total_seconds() // 60
    )
    if status is not None:
        attendance.status = status
    if notes and attendance.notes is None:
        attendance.notes = notes

    # A completed roster ends with the attendance it produced; that keeps the
    # two records from drifting apart once the shift is over.
    roster = await db.scalar(
        select(ShiftRoster).where(
            ShiftRoster.tenant_id == tenant_id,
            ShiftRoster.employee_id == employee.id,
            ShiftRoster.shift_date == today,
            ShiftRoster.status == RosterStatus.SCHEDULED,
        )
    )
    if roster is not None:
        roster.status = RosterStatus.COMPLETED
    await db.flush()
    return attendance


def _parse_time(value: str) -> time:
    """Parse ``HH:MM`` from a roster. Raises ValueError on a bad value."""
    hour, minute = value.split(":")
    return time(int(hour), int(minute))


async def attendance_for(
    db: AsyncSession, tenant_id: uuid.UUID, employee_id: uuid.UUID,
    on_date: date
) -> Attendance | None:
    return await db.scalar(
        select(Attendance).where(
            Attendance.tenant_id == tenant_id,
            Attendance.employee_id == employee_id,
            Attendance.attendance_date == on_date,
        )
    )


# ─── Tips ────────────────────────────────────────────────────────────────────

async def record_tip(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    amount: float,
    *,
    employee_id: uuid.UUID | None = None,
    bill_id: uuid.UUID | None = None,
    shift_id: uuid.UUID | None = None,
    is_pool_eligible: bool = True,
    notes: str | None = None,
) -> TipEntry:
    """Record a tip as collected on a bill.

    Pool-eligible tips enter a pool that is split at period end; non-eligible
    ones are attributed to the collector directly. The flag is captured at
    collection time because the eligibility rule may depend on the meal period,
    which is known then and lost later.
    """
    tip = TipEntry(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        employee_id=employee_id,
        bill_id=bill_id,
        shift_id=shift_id,
        amount=round(float(amount), 2),
        is_pool_eligible=is_pool_eligible,
        collected_at=_now(),
        notes=notes,
    )
    db.add(tip)
    await db.flush()
    return tip


async def pool_for(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID, on_date: date
) -> float:
    """Total pool-eligible tips collected for an outlet on a date.

    Summed here rather than read from a stored total so the pool always reflects
    what was actually collected, including tips recorded after a pool was
    already proposed.
    """
    from sqlalchemy import func as _func

    total = await db.scalar(
        select(_func.sum(TipEntry.amount)).where(
            TipEntry.tenant_id == tenant_id,
            TipEntry.outlet_id == outlet_id,
            TipEntry.is_pool_eligible.is_(True),
            TipEntry.collected_at >= datetime.combine(on_date, time(0, 0), tzinfo=timezone.utc),
            TipEntry.collected_at < datetime.combine(on_date + timedelta(days=1), time(0, 0), tzinfo=timezone.utc),
        )
    )
    return round(float(total or 0), 2)


async def propose_pool(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    total_pool: float,
    shares: list,
    *,
    period_start: date | None = None,
    period_end: date | None = None,
    notes: str | None = None,
) -> TipPoolDistribution:
    """Propose a split of a tip pool.

    Shares are fractions of the pool, and they must not exceed the pool:
    distributing more than was collected is not a rounding issue, it is
    paying out money that was never collected.

    Only PROPOSED pools can be replaced. Once approved the split is settled and
    a new proposal for the same day must be a deliberate action, not an
    overwrite.
    """
    total_fraction = sum(float(s.fraction) for s in shares)
    if total_fraction > 1.0 + 1e-6:
        raise StaffError(
            f"Shares total {round(total_fraction, 4)}, which exceeds the pool"
        )

    on_date = period_start or _now().date()
    key = f"pool:{outlet_id}:{on_date.isoformat()}"
    existing = await db.scalar(
        select(TipPoolDistribution).where(
            TipPoolDistribution.tenant_id == tenant_id,
            TipPoolDistribution.pool_amount_key == key,
        )
    )
    if existing is not None:
        existing_status = _member(existing.status, TipDistributionStatus)
        if existing_status != TipDistributionStatus.PROPOSED:
            raise StaffError(
                "A pool for this day has already been approved or paid"
            )
        for share in existing.shares:
            await db.delete(share)
        existing.total_pool = round(float(total_pool), 2)
        existing.period_start = period_start
        existing.period_end = period_end
        await db.flush()
        distribution = existing
    else:
        distribution = TipPoolDistribution(
            tenant_id=tenant_id,
            outlet_id=outlet_id,
            pool_amount_key=key,
            status=TipDistributionStatus.PROPOSED,
            total_pool=round(float(total_pool), 2),
            period_start=period_start,
            period_end=period_end,
            notes=notes,
        )
        db.add(distribution)
        await db.flush()

    for share in shares:
        db.add(TipPoolShare(
            tenant_id=tenant_id,
            distribution_id=distribution.id,
            employee_id=share.employee_id,
            fraction=round(float(share.fraction), 4),
            amount=round(float(total_pool) * float(share.fraction), 2),
            reason=share.reason,
        ))
    await db.flush()
    return distribution


async def load_pool(
    db: AsyncSession, tenant_id: uuid.UUID, pool_id: uuid.UUID
) -> TipPoolDistribution | None:
    """Load a pool with its shares, eager."""
    return (
        await db.execute(
            select(TipPoolDistribution)
            .options(selectinload(TipPoolDistribution.shares))
            .where(
                TipPoolDistribution.id == pool_id,
                TipPoolDistribution.tenant_id == tenant_id,
            )
        )
    ).scalars().first()


async def decide_pool(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    distribution: TipPoolDistribution,
    approve: bool,
    *,
    approved_by: uuid.UUID | None = None,
    notes: str | None = None,
) -> TipPoolDistribution:
    """Approve or reject a proposed pool split.

    Approval is the gate before money moves. A proposal anyone could edit until
    payout would let a share be changed after everyone had already accepted it.
    """
    current = _member(distribution.status, TipDistributionStatus)
    if current != TipDistributionStatus.PROPOSED:
        raise StaffError(f"Pool is already {current.value}")

    if not approve:
        distribution.status = TipDistributionStatus.PROPOSED
        if notes and distribution.notes is None:
            distribution.notes = notes
        await db.flush()
        return distribution

    distribution.status = TipDistributionStatus.APPROVED
    distribution.approved_by = approved_by
    if notes and distribution.notes is None:
        distribution.notes = notes
    await db.flush()
    return distribution


async def pay_pool(
    db: AsyncSession, tenant_id: uuid.UUID, distribution: TipPoolDistribution
) -> TipPoolDistribution:
    """Mark an approved pool as paid.

    Only APPROVED pools pay out, so there is no path from an unreviewed
    proposal to settled money.
    """
    current = _member(distribution.status, TipDistributionStatus)
    if current != TipDistributionStatus.APPROVED:
        raise StaffError(f"Pool is {current.value}, not approved for payout")
    distribution.status = TipDistributionStatus.PAID
    distribution.paid_at = _now()
    await db.flush()
    return distribution
