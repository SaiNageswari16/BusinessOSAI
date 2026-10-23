"""Staff service models — employees, rosters, attendance, tips.

Owns ``restaurantos_staff``. Cross-service columns carry NO foreign key:

  * ``outlet_id`` — organization service
  * ``user_id``   — auth service (an employee is also a login)
  * ``bill_id``   — billing service
  * ``shift_id``  — billing service (register shifts)

``user_id`` is the bridge to auth: the same person is a user (login + roles)
and an employee (contract + wage data). Keeping the employee record here means
HR data never reaches the auth database.

Real FKs exist only within this file.
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.services.shared.service_db import service_base

# This service's own base, not the shared ServiceBase. See service_db.
ServiceBase = service_base("staff")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class EmployeeRoleType(str, enum.Enum):
    MANAGER = "manager"
    CASHIER = "cashier"
    WAITER = "waiter"
    CAPTAIN = "captain"
    CHEF = "chef"
    KITCHEN_STAFF = "kitchen_staff"


class EmploymentType(str, enum.Enum):
    PERMANENT = "permanent"
    CONTRACT = "contract"
    TEMPORARY = "temporary"
    INTERNSHIP = "internship"


class EmployeeStatus(str, enum.Enum):
    PROBATION = "probation"
    ACTIVE = "active"
    ON_LEAVE = "on_leave"
    RESIGNED = "resigned"
    TERMINATED = "terminated"


class ShiftType(str, enum.Enum):
    MORNING = "morning"
    EVENING = "evening"
    NIGHT = "night"


class RosterStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    ABSENT = "absent"
    SWAPPED = "swapped"


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    HALF_DAY = "half_day"
    LEAVE = "leave"
    HOLIDAY = "holiday"


class TipDistributionStatus(str, enum.Enum):
    PROPOSED = "proposed"
    APPROVED = "approved"
    PAID = "paid"


def status_value(value: object) -> str:
    """Plain string for a status field, however it was obtained.

    Status columns are ``String``, not ``Enum``: a value just assigned in
    Python is the enum member, but the same field loaded back from Postgres is
    a plain ``str``. Only ``.value`` is member-specific, so calling it on a
    loaded row raises AttributeError.
    """
    return value.value if isinstance(value, enum.Enum) else str(value)


class TimestampMixin:
    """Timestamps set application-side, not by the DB.

    Python callables for both: a *server* default makes SQLAlchemy re-SELECT the
    row to learn the value, and that lazy read lands outside the request's async
    context, failing as MissingGreenlet during Pydantic serialisation.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )


class Employee(ServiceBase, TimestampMixin):
    __tablename__ = "employees"
    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_code", name="uq_staff_emp_code"),
        UniqueConstraint("tenant_id", "user_id", name="uq_staff_emp_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    # Bridge to the auth service: the login behind this employee.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    employee_code: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    role_type: Mapped[EmployeeRoleType] = mapped_column(
        String(30), default=EmployeeRoleType.WAITER, index=True
    )
    employment_type: Mapped[EmploymentType] = mapped_column(
        String(30), default=EmploymentType.PERMANENT
    )
    status: Mapped[EmployeeStatus] = mapped_column(
        String(20), default=EmployeeStatus.ACTIVE, index=True
    )
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    date_of_joining: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_of_termination: Mapped[date | None] = mapped_column(Date, nullable=True)
    base_salary: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    bank_account: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gstin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class ShiftRoster(ServiceBase, TimestampMixin):
    """A scheduled shift for one employee.

    ``shift_id`` points at a billing register shift and is nullable: an employee
    can be rostered for a duty that has no register drawer, and a register shift
    can be opened before anyone is scheduled. The roster is the plan, the
    attendance row is what actually happened.
    """

    __tablename__ = "shift_rosters"
    __table_args__ = (
        Index("ix_staff_rosters_shift_day", "shift_date", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    shift_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    shift_type: Mapped[ShiftType] = mapped_column(
        String(20), default=ShiftType.MORNING
    )
    start_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    end_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    status: Mapped[RosterStatus] = mapped_column(
        String(20), default=RosterStatus.SCHEDULED, index=True
    )
    shift_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    employee: Mapped["Employee"] = relationship(
        primaryjoin="ShiftRoster.employee_id == Employee.id",
        foreign_keys="ShiftRoster.employee_id",
    )


class Attendance(ServiceBase, TimestampMixin):
    """One clock-in/out pair per employee per day.

    The authoritative record of presence. ``status`` is what payroll reads;
    the clock times are what justifies it. A late mark is derived from the
    roster start time, which is why both must be stored.
    """

    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "employee_id", "attendance_date",
            name="uq_staff_attendance_day",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    clock_in: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    clock_out: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[AttendanceStatus] = mapped_column(
        String(20), default=AttendanceStatus.PRESENT, index=True
    )
    late_minutes: Mapped[int] = mapped_column(Integer, default=0)
    work_minutes: Mapped[int] = mapped_column(Integer, default=0)
    shift_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    employee: Mapped["Employee"] = relationship(
        primaryjoin="Attendance.employee_id == Employee.id",
        foreign_keys="Attendance.employee_id",
    )


class TipEntry(ServiceBase, TimestampMixin):
    """Tip recorded on a settled bill.

    Collected here as it is billed so the pool can be built per outlet and per
    period without asking billing to re-emit history. ``collected`` is the
    amount actually handed over; ``attributed_to`` is the server on duty, and
    can be null where a tip is anonymous or left at the desk.
    """

    __tablename__ = "tips"
    __table_args__ = (
        Index("ix_staff_tips_outlet_time", "outlet_id", "collected_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    bill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    employee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    shift_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    is_pool_eligible: Mapped[bool] = mapped_column(Boolean, default=True)
    collected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class TipPoolDistribution(ServiceBase, TimestampMixin):
    """A proposed split of a tip pool across the employees on duty.

    Proposed before paid: a split of shared money should be visible and
    challengeable before it leaves the till. Each share is a fraction of the
    pool so the shares can be re-summed and checked against the pot.
    """

    __tablename__ = "tip_pool_distributions"
    __table_args__ = (
        UniqueConstraint(
            "pool_amount_key", name="uq_staff_tip_pool_key"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # e.g. "pool:<outlet>:2026-10-14" — one proposal per outlet per day.
    pool_amount_key: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    status: Mapped[TipDistributionStatus] = mapped_column(
        String(20), default=TipDistributionStatus.PROPOSED, index=True
    )
    total_pool: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    shares: Mapped[list["TipPoolShare"]] = relationship(
        back_populates="distribution",
        primaryjoin="TipPoolDistribution.id == TipPoolShare.distribution_id",
        foreign_keys="TipPoolShare.distribution_id",
        cascade="all, delete-orphan",
    )


class TipPoolShare(ServiceBase, TimestampMixin):
    __tablename__ = "tip_pool_shares"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    distribution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tip_pool_distributions.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    # Fraction of the pool this share represents, e.g. 0.25 for a quarter.
    fraction: Mapped[float] = mapped_column(Numeric(6, 4), default=0)
    reason: Mapped[str | None] = mapped_column(String(300), nullable=True)

    distribution: Mapped["TipPoolDistribution"] = relationship(
        back_populates="shares",
        primaryjoin="TipPoolShare.distribution_id == TipPoolDistribution.id",
        foreign_keys="TipPoolShare.distribution_id",
    )
    employee: Mapped["Employee"] = relationship(
        primaryjoin="TipPoolShare.employee_id == Employee.id",
        foreign_keys="TipPoolShare.employee_id",
    )


class ConsumedEvent(ServiceBase, TimestampMixin):
    """Durable idempotency ledger — one row per event this service consumed.

    Written by the bus's consumer loop via the installed dedupe ledger
    (``src.services.event_bus.dedupe``), so a redelivered event whose
    event_id is already here is skipped even after a process restart. The
    in-memory dedupe gate in ``EventBus`` alone is not restart-safe; this
    table closes that gap.

    ``event_id`` is the primary key — a redelivery with the same event_id
    is a no-op insert (``ON CONFLICT DO NOTHING``), which is exactly the
    check-then-mark primitive the dedupe helper needs.
    """

    __tablename__ = "consumed_events"

    event_id: Mapped[str] = mapped_column(
        String(64), primary_key=True
    )
    type: Mapped[str] = mapped_column(
        String(120), nullable=False, default="", index=True
    )
    consumed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
