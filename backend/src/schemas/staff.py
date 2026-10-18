"""Staff, roster, attendance, tips, feedback and complaint schemas."""
import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field

from src.models.staff import (
    AttendanceStatus,
    ComplaintStatus,
    EmployeeRoleType,
    FeedbackSource,
    FeedbackStatus,
    RosterStatus,
    ShiftType,
)


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Employees ───────────────────────────────────────────────────

class EmployeeCreate(BaseModel):
    outlet_id: uuid.UUID
    user_id: uuid.UUID | None = None
    full_name: str = Field(min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=200)
    designation: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)
    role_type: EmployeeRoleType = EmployeeRoleType.WAITER
    joined_date: date
    hourly_rate: float | None = Field(default=None, ge=0)
    emergency_contact: str | None = Field(default=None, max_length=100)
    address: str | None = None


class EmployeeUpdate(BaseModel):
    user_id: uuid.UUID | None = None
    full_name: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=200)
    designation: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)
    role_type: EmployeeRoleType | None = None
    joined_date: date | None = None
    hourly_rate: float | None = Field(default=None, ge=0)
    emergency_contact: str | None = Field(default=None, max_length=100)
    address: str | None = None
    is_active: bool | None = None


class EmployeeResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    user_id: uuid.UUID | None
    employee_code: str
    full_name: str
    phone: str | None
    email: str | None
    designation: str | None
    department: str | None
    role_type: str
    joined_date: date
    is_active: bool
    hourly_rate: float | None
    emergency_contact: str | None
    address: str | None
    created_at: datetime


# ─── Roster ──────────────────────────────────────────────────────

class RosterCreate(BaseModel):
    outlet_id: uuid.UUID
    employee_id: uuid.UUID
    shift_date: date
    start_time: time
    end_time: time
    shift_type: ShiftType = ShiftType.MORNING
    status: RosterStatus = RosterStatus.SCHEDULED


class RosterUpdate(BaseModel):
    shift_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    shift_type: ShiftType | None = None
    status: RosterStatus | None = None


class RosterResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    employee_id: uuid.UUID
    shift_date: date
    start_time: time
    end_time: time
    shift_type: str
    status: str


# ─── Attendance ──────────────────────────────────────────────────

class AttendanceCheckIn(BaseModel):
    outlet_id: uuid.UUID
    employee_id: uuid.UUID
    attendance_date: date


class AttendanceCheckOut(BaseModel):
    outlet_id: uuid.UUID
    employee_id: uuid.UUID
    attendance_date: date


class AttendanceUpdate(BaseModel):
    status: AttendanceStatus | None = None
    check_in: str | None = Field(default=None, max_length=50)
    check_out: str | None = Field(default=None, max_length=50)
    worked_hours: float | None = Field(default=None, ge=0)
    overtime_hours: float | None = Field(default=None, ge=0)
    notes: str | None = None


class AttendanceResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    employee_id: uuid.UUID
    attendance_date: date
    check_in: str | None
    check_out: str | None
    status: str
    worked_hours: float
    overtime_hours: float
    notes: str | None
    created_at: datetime


# ─── Tips ────────────────────────────────────────────────────────

class TipCreate(BaseModel):
    outlet_id: uuid.UUID
    bill_id: uuid.UUID | None = None
    employee_id: uuid.UUID | None = None
    amount: float = Field(gt=0)


class TipResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    bill_id: uuid.UUID | None
    employee_id: uuid.UUID | None
    amount: float
    distributed_at: str | None
    is_distributed: bool
    created_at: datetime


class TipPoolCreate(BaseModel):
    outlet_id: uuid.UUID
    pool_date: date
    total_amount: float = Field(gt=0)
    distribution: list[dict] = Field(default_factory=list)


class TipPoolResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    pool_date: date
    total_amount: float
    distribution: list
    status: str
    distributed_by: uuid.UUID | None
    created_at: datetime


class TipDistributeRequest(BaseModel):
    tip_id: uuid.UUID


# ─── Feedback ────────────────────────────────────────────────────

class FeedbackCreate(BaseModel):
    outlet_id: uuid.UUID
    order_id: uuid.UUID | None = None
    bill_id: uuid.UUID | None = None
    customer_id: uuid.UUID | None = None
    rating_overall: int | None = Field(default=None, ge=1, le=5)
    rating_food: int | None = Field(default=None, ge=1, le=5)
    rating_service: int | None = Field(default=None, ge=1, le=5)
    rating_ambience: int | None = Field(default=None, ge=1, le=5)
    comment: str | None = None
    source: FeedbackSource = FeedbackSource.POS


class FeedbackUpdate(BaseModel):
    rating_overall: int | None = Field(default=None, ge=1, le=5)
    rating_food: int | None = Field(default=None, ge=1, le=5)
    rating_service: int | None = Field(default=None, ge=1, le=5)
    rating_ambience: int | None = Field(default=None, ge=1, le=5)
    comment: str | None = None


class FeedbackStatusUpdate(BaseModel):
    status: FeedbackStatus


class FeedbackResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    order_id: uuid.UUID | None
    bill_id: uuid.UUID | None
    customer_id: uuid.UUID | None
    rating_overall: int | None
    rating_food: int | None
    rating_service: int | None
    rating_ambience: int | None
    comment: str | None
    status: str
    source: str
    created_at: datetime


class FeedbackSummary(BaseModel):
    count: int
    avg_overall: float | None
    avg_food: float | None
    avg_service: float | None
    avg_ambience: float | None
    outstanding: int


# ─── Complaints ──────────────────────────────────────────────────

class ComplaintCreate(BaseModel):
    outlet_id: uuid.UUID
    order_id: uuid.UUID | None = None
    customer_id: uuid.UUID | None = None
    category: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1)
    severity: str = Field(default="medium", pattern="^(low|medium|high)$")


class ComplaintStatusUpdate(BaseModel):
    status: ComplaintStatus
    resolution: str | None = None


class ComplaintResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    order_id: uuid.UUID | None
    customer_id: uuid.UUID | None
    raised_by: uuid.UUID | None
    category: str
    description: str
    severity: str
    status: str
    resolution: str | None
    resolved_by: uuid.UUID | None
    resolved_at: str | None
    created_at: datetime
