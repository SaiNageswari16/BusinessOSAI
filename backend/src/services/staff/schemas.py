"""Staff service schemas."""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.services.staff.models import (
    AttendanceStatus,
    EmployeeRoleType,
    EmployeeStatus,
    EmploymentType,
    RosterStatus,
    ShiftType,
    TipDistributionStatus,
)


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Employees ──────────────────────────────────────────────────────────────

class EmployeeCreate(BaseModel):
    name: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    employee_code: str = Field(min_length=1, max_length=30)
    role_type: EmployeeRoleType | None = None
    role: EmployeeRoleType | None = None
    employment_type: EmploymentType = EmploymentType.PERMANENT
    status: EmployeeStatus = EmployeeStatus.ACTIVE
    user_id: uuid.UUID | None = None
    outlet_id: uuid.UUID | None = None
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=200)
    date_of_joining: date | None = None
    base_salary: float = Field(ge=0, default=0)
    hourly_rate: float | None = None
    bank_account: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def _coerce_fields(self) -> "EmployeeCreate":
        if not self.name and (self.first_name or self.last_name):
            self.name = f"{self.first_name or ''} {self.last_name or ''}".strip()
        if not self.name:
            self.name = self.employee_code
        if self.role_type is None and self.role is not None:
            self.role_type = self.role
        elif self.role_type is None:
            self.role_type = EmployeeRoleType.WAITER
        if self.base_salary == 0 and self.hourly_rate:
            self.base_salary = self.hourly_rate
        return self


class AttendanceClockInRequest(BaseModel):
    employee_id: uuid.UUID
    outlet_id: uuid.UUID | None = None
    shift_id: uuid.UUID | None = None
    notes: str | None = None


class EmployeeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    role_type: EmployeeRoleType | None = None
    status: EmployeeStatus | None = None
    base_salary: float | None = Field(default=None, ge=0)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=200)
    bank_account: str | None = Field(default=None, max_length=100)
    date_of_termination: date | None = None


class EmployeeResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    user_id: uuid.UUID | None
    employee_code: str
    name: str
    role_type: EmployeeRoleType
    employment_type: EmploymentType
    status: EmployeeStatus
    phone: str | None
    email: str | None
    date_of_joining: date | None
    date_of_termination: date | None
    base_salary: float
    created_at: datetime


# ─── Roster ─────────────────────────────────────────────────────────────────

class RosterCreate(BaseModel):
    employee_id: uuid.UUID
    shift_date: date
    shift_type: ShiftType = ShiftType.MORNING
    start_time: str | None = Field(default=None, max_length=10)
    end_time: str | None = Field(default=None, max_length=10)
    outlet_id: uuid.UUID | None = None
    notes: str | None = None


class RosterResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    employee_id: uuid.UUID
    shift_date: date
    shift_type: ShiftType
    start_time: str | None
    end_time: str | None
    status: RosterStatus
    shift_id: uuid.UUID | None
    notes: str | None
    created_at: datetime


class RosterDecision(BaseModel):
    """Mark a rostered shift as completed, absent, or swapped."""

    status: RosterStatus
    notes: str | None = None


# ─── Attendance ─────────────────────────────────────────────────────────────

class ClockIn(BaseModel):
    """Clock in. Late is judged against the roster's start time, if any."""

    status: AttendanceStatus = AttendanceStatus.PRESENT
    shift_id: uuid.UUID | None = None
    notes: str | None = None


class ClockOut(BaseModel):
    """Clock out. Work minutes are computed from the clock-in record."""

    status: AttendanceStatus | None = None
    notes: str | None = None


class AttendanceResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    employee_id: uuid.UUID
    attendance_date: date
    clock_in: datetime | None
    clock_out: datetime | None
    status: AttendanceStatus
    late_minutes: int
    work_minutes: int
    shift_id: uuid.UUID | None
    notes: str | None
    created_at: datetime


# ─── Tips ───────────────────────────────────────────────────────────────────

class TipRecord(BaseModel):
    """Record a tip collected on a settled bill."""

    outlet_id: uuid.UUID
    amount: float = Field(gt=0)
    employee_id: uuid.UUID | None = None
    bill_id: uuid.UUID | None = None
    shift_id: uuid.UUID | None = None
    is_pool_eligible: bool = True
    notes: str | None = None


class TipResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID
    bill_id: uuid.UUID | None
    employee_id: uuid.UUID | None
    shift_id: uuid.UUID | None
    amount: float
    is_pool_eligible: bool
    collected_at: datetime
    notes: str | None
    created_at: datetime


class PoolShareIn(BaseModel):
    employee_id: uuid.UUID
    fraction: float = Field(gt=0, le=1)
    reason: str | None = Field(default=None, max_length=300)


class PoolProposal(BaseModel):
    """Propose how a tip pool is split.

    Shares are fractions of the pot, so they can be re-summed and checked: a
    proposal that exceeds 1.0 does not distribute the pool, it invents money.
    """

    outlet_id: uuid.UUID
    total_pool: float = Field(gt=0)
    shares: list[PoolShareIn] = Field(min_length=1)
    period_start: date | None = None
    period_end: date | None = None
    notes: str | None = None


class PoolDecision(BaseModel):
    approve: bool
    notes: str | None = None


class TipPoolShareResponse(OrmModel):
    id: uuid.UUID
    distribution_id: uuid.UUID
    employee_id: uuid.UUID
    amount: float
    fraction: float
    reason: str | None


class TipPoolResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID
    pool_amount_key: str
    status: TipDistributionStatus
    total_pool: float
    period_start: date | None
    period_end: date | None
    approved_by: uuid.UUID | None
    paid_at: datetime | None
    notes: str | None
    created_at: datetime
    shares: list[TipPoolShareResponse] = Field(default_factory=list)
    distributed_total: float = 0.0
