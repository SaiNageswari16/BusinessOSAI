"""Staff service models — Complete Enterprise HRMS Suite.

Owns ``restaurantos_staff``. Cross-service columns carry NO foreign key:
  * ``outlet_id`` / ``branch_id`` / ``company_id`` — organization service
  * ``user_id``                                    — auth service
  * ``bill_id``                                    — billing service
  * ``shift_id``                                   — billing service

Foreign keys exist ONLY within this service's own tables (e.g. employee -> department).
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.services.shared.service_db import service_base

ServiceBase = service_base("staff")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )


def status_value(value: object) -> str:
    return value.value if isinstance(value, enum.Enum) else str(value)


# ─── Enums ───────────────────────────────────────────────────────────────────

class EmployeeRoleType(str, enum.Enum):
    MANAGER = "manager"
    CASHIER = "cashier"
    WAITER = "waiter"
    CAPTAIN = "captain"
    CHEF = "chef"
    KITCHEN_STAFF = "kitchen_staff"
    OTHER = "other"


class EmploymentType(str, enum.Enum):
    PERMANENT = "permanent"
    CONTRACT = "contract"
    TEMPORARY = "temporary"
    INTERNSHIP = "internship"


class EmployeeStatus(str, enum.Enum):
    ACTIVE = "active"
    ON_LEAVE = "on_leave"
    PROBATION = "probation"
    RESIGNED = "resigned"
    TERMINATED = "terminated"
    INACTIVE = "inactive"


class ShiftType(str, enum.Enum):
    MORNING = "morning"
    EVENING = "evening"
    NIGHT = "night"
    SPLIT = "split"


class RosterStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    ABSENT = "absent"
    SWAPPED = "swapped"


# ─── Monolith-compatibility Company / Branch ─────────────────────────────────
# The HRMS API (imported from the monolith) references ``Company`` and
# ``Branch`` as real ORM models and as ``company_id`` / ``branch_id`` columns
# on several tables. In the microservice split the *tenant* is the company, so
# these are lightweight compat rows, auto-seeded per tenant by
# ``ensure_company_for_tenant`` in this module. They let the HRMS endpoints
# keep working without rewriting 15,000+ lines of generated API code.
class Company(ServiceBase, TimestampMixin):
    __tablename__ = "companies"
    __table_args__ = (UniqueConstraint("tenant_id", "slug", name="uq_staff_company_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(100), default="primary")
    name: Mapped[str] = mapped_column(String(200), default="")
    legal_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    company_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gst_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    registration_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str] = mapped_column(String(5), default="IN")
    state: Mapped[str | None] = mapped_column(String(50), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    website: Mapped[str | None] = mapped_column(String(200), nullable=True)
    default_currency_code: Mapped[str] = mapped_column(String(3), default="INR")
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata")
    language: Mapped[str] = mapped_column(String(10), default="en")
    financial_year_start_month: Mapped[int] = mapped_column(Integer, default=4)
    plan: Mapped[str | None] = mapped_column(String(50), nullable=True)
    logo_initials: Mapped[str | None] = mapped_column(String(10), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    established_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    terms_and_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="active")

    branches: Mapped[list["Branch"]] = relationship(back_populates="company", cascade="all, delete-orphan")


class Branch(ServiceBase, TimestampMixin):
    __tablename__ = "branches"
    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_staff_branch_code"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    code: Mapped[str] = mapped_column(String(50), default="HQ")
    name: Mapped[str] = mapped_column(String(200), default="Headquarters")
    manager_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(50), nullable=True)
    country: Mapped[str] = mapped_column(String(5), default="IN")
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    has_warehouse: Mapped[bool] = mapped_column(Boolean, default=False)
    working_hours: Mapped[str | None] = mapped_column(String(50), nullable=True)
    opening_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    geofence_radius_meters: Mapped[int | None] = mapped_column(Integer, nullable=True)
    enforce_geofence: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(30), default="active")

    company: Mapped["Company | None"] = relationship(back_populates="branches")


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    HALF_DAY = "half_day"
    LEAVE = "leave"
    HOLIDAY = "holiday"
    WEEKOFF = "weekoff"


class TipDistributionStatus(str, enum.Enum):
    PROPOSED = "proposed"
    APPROVED = "approved"
    PAID = "paid"


# ─── Organization Hierarchy (Staff Core) ────────────────────────────────────

class Department(ServiceBase, TimestampMixin):
    __tablename__ = "departments"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_staff_dept_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    head_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="active")

    parent: Mapped["Department | None"] = relationship(remote_side=[id], back_populates="sub_departments")
    sub_departments: Mapped[list["Department"]] = relationship(back_populates="parent")
    designations: Mapped[list["Designation"]] = relationship(back_populates="department")
    employees: Mapped[list["Employee"]] = relationship(back_populates="department")
    teams: Mapped[list["Team"]] = relationship(back_populates="department")


class Designation(ServiceBase, TimestampMixin):
    __tablename__ = "designations"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_staff_desig_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    level: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(30), default="active")

    department: Mapped["Department | None"] = relationship(back_populates="designations")
    employees: Mapped[list["Employee"]] = relationship(back_populates="designation")

class Team(ServiceBase, TimestampMixin):
    __tablename__ = "teams"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_staff_team_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    leader_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="active")

    department: Mapped["Department | None"] = relationship(back_populates="teams")
    members: Mapped[list["TeamMember"]] = relationship(back_populates="team", cascade="all, delete-orphan")


class TeamMember(ServiceBase, TimestampMixin):
    __tablename__ = "team_members"
    __table_args__ = (
        UniqueConstraint("team_id", "employee_id", name="uq_staff_team_emp"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    role_in_team: Mapped[str] = mapped_column(String(50), default="member")

    team: Mapped["Team"] = relationship(back_populates="members")
    employee: Mapped["Employee"] = relationship()


class WorkCalendar(ServiceBase, TimestampMixin):
    __tablename__ = "work_calendars"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    year: Mapped[int] = mapped_column(Integer, default=2026)
    standard_hours_per_day: Mapped[float] = mapped_column(Numeric(4, 2), default=8.0)
    weekly_off_days: Mapped[list] = mapped_column(JSONB, default=list)  # [0, 6] for Sun, Sat
    holidays: Mapped[list] = mapped_column(JSONB, default=list)  # [{"name": "Diwali", "date": "2026-11-08"}]
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(30), default="active")


# ─── Employee Master ────────────────────────────────────────────────────────

class Employee(ServiceBase, TimestampMixin):
    __tablename__ = "employees"
    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_code", name="uq_staff_emp_code"),
        Index("ix_staff_emp_tenant_status", "tenant_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    joining_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    branch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)

    employee_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)

    department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    designation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("designations.id", ondelete="SET NULL"), nullable=True)
    manager_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    work_calendar_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("work_calendars.id", ondelete="SET NULL"), nullable=True)

    role_type: Mapped[EmployeeRoleType] = mapped_column(String(30), default=EmployeeRoleType.WAITER)
    employment_type: Mapped[EmploymentType] = mapped_column(String(30), default=EmploymentType.PERMANENT)
    status: Mapped[EmployeeStatus] = mapped_column(String(30), default=EmployeeStatus.ACTIVE, index=True)

    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_of_joining: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    date_of_termination: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Compensation & Payroll fields
    base_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    hourly_rate: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    sales_points: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)

    # Banking & Statutory details
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bank_account: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ifsc_code: Mapped[str | None] = mapped_column(String(30), nullable=True)
    pan_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    aadhar_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    uan_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    pf_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    esi_number: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Attendance & Punching configuration
    punch_method: Mapped[str] = mapped_column(String(50), default="GPS")  # GPS|Biometric|Face|Web|Manual
    biometric_pin: Mapped[str | None] = mapped_column(String(50), nullable=True)
    nfc_card_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    face_photo: Mapped[str | None] = mapped_column(Text, nullable=True)
    face_photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    face_descriptor: Mapped[str | None] = mapped_column(Text, nullable=True)
    face_registered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Emergency Contact
    emergency_contact_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    emergency_contact_relation: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Metadata & Custom Attributes
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    custom_attributes: Mapped[dict] = mapped_column(JSONB, default=dict)

    department: Mapped["Department | None"] = relationship(back_populates="employees")
    designation: Mapped["Designation | None"] = relationship(back_populates="employees")
    manager: Mapped["Employee | None"] = relationship(remote_side=[id])
    documents: Mapped[list["EmployeeDocument"]] = relationship(back_populates="employee", cascade="all, delete-orphan")
    attendance_records: Mapped[list["AttendanceRecord"]] = relationship(back_populates="employee", cascade="all, delete-orphan")
    leave_requests: Mapped[list["LeaveRequest"]] = relationship(back_populates="employee", cascade="all, delete-orphan")
    leave_balances: Mapped[list["LeaveBalance"]] = relationship(back_populates="employee", cascade="all, delete-orphan")
    salary_structure: Mapped["SalaryStructure | None"] = relationship(back_populates="employee", uselist=False)
    payslips: Mapped[list["Payslip"]] = relationship(back_populates="employee")

    @hybrid_property
    def full_name(self) -> str:
        """Display name, usable in both Python and SQL.

        The microservice model stores the display name in the ``name`` column
        (with optional ``first_name``/``last_name`` parts). The monolith's HRMS
        API references ``full_name`` directly — including in SQL expressions
        like ``Employee.full_name.ilike(...)`` and ``order_by(full_name)`` —
        so this is a hybrid: as a Python attribute it composes the parts, and
        in SQL it resolves to the ``name`` column.
        """
        if self.name:
            return self.name
        return " ".join(p for p in (self.first_name, self.last_name) if p).strip()

    @full_name.expression  # type: ignore[attr-defined]
    def full_name(cls) -> Any:
        """SQL form: the display-name column. ``first/last`` compose only when
        the name parts are individually present; ``name`` is the source of
        truth, so filter/order on it directly."""
        return cls.name

    @full_name.setter
    def full_name(self, value: str | None) -> None:
        """The monolith API builds ``Employee(full_name=...)``; the column is
        ``name``, so a write to full_name lands on ``name``."""
        self.name = value


class EmployeeDocument(ServiceBase, TimestampMixin):
    __tablename__ = "employee_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    document_name: Mapped[str] = mapped_column(String(200), nullable=False)
    document_type: Mapped[str] = mapped_column(String(100), nullable=False)  # Contract|ID Proof|Resume|Compliance
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    upload_date: Mapped[date] = mapped_column(Date, default=date.today)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="Valid")  # Valid|Expired

    employee: Mapped["Employee"] = relationship(back_populates="documents")


# ─── Attendance & Real-Time Tracking ────────────────────────────────────────

class AttendanceRecord(ServiceBase, TimestampMixin):
    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_id", "date", name="uq_staff_att_emp_date"),
        Index("ix_staff_att_date", "tenant_id", "date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_geofence_verified: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    check_in: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    check_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    hours_worked: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    regular_hours: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    overtime_hours: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    overtime_rate: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    overtime_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    status: Mapped[str] = mapped_column(String(30), default="Present")  # Present|Absent|Late|Half Day|On Leave|Weekoff
    method: Mapped[str] = mapped_column(String(50), default="Manual")   # Biometric|GPS|Face|Web|Manual
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_weekoff: Mapped[bool] = mapped_column(Boolean, default=False)
    is_holiday: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    employee: Mapped["Employee"] = relationship(back_populates="attendance_records")


Attendance = AttendanceRecord


class AttendanceScheme(ServiceBase, TimestampMixin):
    __tablename__ = "attendance_schemes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    shift_start_time: Mapped[str] = mapped_column(String(10), default="09:00")
    shift_end_time: Mapped[str] = mapped_column(String(10), default="18:00")
    grace_period_minutes: Mapped[int] = mapped_column(Integer, default=15)
    half_day_hours: Mapped[float] = mapped_column(Numeric(4, 2), default=4.5)
    full_day_hours: Mapped[float] = mapped_column(Numeric(4, 2), default=8.0)
    break_duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    is_overtime_allowed: Mapped[bool] = mapped_column(Boolean, default=True)
    overtime_multiplier: Mapped[float] = mapped_column(Numeric(4, 2), default=1.5)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(30), default="active")

    # GPS / geofence punch configuration (monolith-compat; the API reads
    # these directly off the scheme row).
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    geofence_radius_meters: Mapped[int | None] = mapped_column(Integer, nullable=True)
    enforce_geofence: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    allowed_punch_methods: Mapped[list] = mapped_column(JSONB, default=list)
    working_days: Mapped[list] = mapped_column(JSONB, default=list)
    ip_whitelist: Mapped[str | None] = mapped_column(Text, nullable=True)
    overtime_min_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    @property
    def overtime_allowed(self) -> bool:
        """The monolith API reads ``overtime_allowed``; the column is
        ``is_overtime_allowed``. Keep both accessible."""
        return bool(self.is_overtime_allowed)


class EmployeeAttendanceScheme(ServiceBase, TimestampMixin):
    __tablename__ = "employee_attendance_schemes"
    __table_args__ = (
        UniqueConstraint("employee_id", "scheme_id", name="uq_staff_emp_scheme"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    scheme_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("attendance_schemes.id", ondelete="CASCADE"), nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, default=date.today)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)

    employee: Mapped["Employee"] = relationship()
    scheme: Mapped["AttendanceScheme"] = relationship()


class EmployeeLocationTrail(ServiceBase, TimestampMixin):
    __tablename__ = "employee_location_trails"
    __table_args__ = (
        Index("ix_staff_trail_emp_time", "employee_id", "recorded_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    attendance_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("attendance_records.id", ondelete="SET NULL"), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    speed: Mapped[float | None] = mapped_column(Float, nullable=True)
    heading: Mapped[float | None] = mapped_column(Float, nullable=True)
    altitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    activity_type: Mapped[str] = mapped_column(String(50), default="traveling")
    location_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    battery_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_mock: Mapped[bool] = mapped_column(Boolean, default=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)

    employee: Mapped["Employee"] = relationship()


class BiometricDevice(ServiceBase, TimestampMixin):
    __tablename__ = "biometric_devices"
    __table_args__ = (
        UniqueConstraint("tenant_id", "device_code", name="uq_staff_device_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    device_code: Mapped[str] = mapped_column(String(50), nullable=False)
    location: Mapped[str] = mapped_column(String(150), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    port: Mapped[int] = mapped_column(Integer, default=4370)
    enrolled_employees: Mapped[int] = mapped_column(Integer, default=0)
    last_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="Online")  # Online|Offline


class FaceRecognitionLog(ServiceBase, TimestampMixin):
    __tablename__ = "face_recognition_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    confidence: Mapped[float] = mapped_column(Numeric(5, 2), default=95.0)
    location: Mapped[str] = mapped_column(String(150), nullable=False)
    action: Mapped[str] = mapped_column(String(30), default="Check-In")  # Check-In|Check-Out
    status: Mapped[str] = mapped_column(String(30), default="Verified")  # Verified|Failed

    employee: Mapped["Employee | None"] = relationship()


class AttendanceCorrection(ServiceBase, TimestampMixin):
    __tablename__ = "attendance_corrections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    original_status: Mapped[str] = mapped_column(String(30), nullable=False)
    original_check_in: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    original_check_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    corrected_status: Mapped[str] = mapped_column(String(30), nullable=False)
    corrected_check_in: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    corrected_check_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Pending")  # Pending|Approved|Rejected
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    employee: Mapped["Employee"] = relationship()


# ─── Leave Management ───────────────────────────────────────────────────────

class LeavePolicy(ServiceBase, TimestampMixin):
    __tablename__ = "leave_policies"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_staff_leave_policy_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    leave_type: Mapped[str] = mapped_column(String(50), default="Casual")  # Casual|Sick|Earned|Maternity|Paternity
    entitled_days: Mapped[int] = mapped_column(Integer, default=12)
    carry_forward_days: Mapped[int] = mapped_column(Integer, default=0)
    applicable_to: Mapped[str] = mapped_column(String(50), default="All")  # All|Permanent|Probation
    is_encashable: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(30), default="active")


class LeaveRequest(ServiceBase, TimestampMixin):
    __tablename__ = "leave_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    leave_type: Mapped[str] = mapped_column(String(50), nullable=False)  # Casual|Sick|Earned|Maternity|Unpaid
    from_date: Mapped[date] = mapped_column(Date, nullable=False)
    to_date: Mapped[date] = mapped_column(Date, nullable=False)
    days: Mapped[float] = mapped_column(Numeric(4, 1), nullable=False, default=1.0)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Pending")  # Pending|Approved|Rejected|Cancelled
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    employee: Mapped["Employee"] = relationship(back_populates="leave_requests")


class LeaveBalance(ServiceBase, TimestampMixin):
    __tablename__ = "leave_balances"
    __table_args__ = (
        UniqueConstraint("employee_id", "leave_type", "year", name="uq_staff_emp_leave_yr"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    total_days: Mapped[float] = mapped_column(Numeric(6, 2), default=0.0)
    used_days: Mapped[float] = mapped_column(Numeric(6, 2), default=0.0)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    leave_type: Mapped[str] = mapped_column(String(50), nullable=False)
    year: Mapped[int] = mapped_column(Integer, default=2026)
    entitled: Mapped[float] = mapped_column(Numeric(5, 1), default=12.0)
    used: Mapped[float] = mapped_column(Numeric(5, 1), default=0.0)
    pending: Mapped[float] = mapped_column(Numeric(5, 1), default=0.0)
    balance: Mapped[float] = mapped_column(Numeric(5, 1), default=12.0)

    employee: Mapped["Employee"] = relationship(back_populates="leave_balances")


# ─── Compensation & Payroll ─────────────────────────────────────────────────

class PayGrade(ServiceBase, TimestampMixin):
    __tablename__ = "pay_grades"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_staff_pay_grade_name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    designation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    hra: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    other_allowances: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    pf_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    esi_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    tds_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    min_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    max_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="active")


class SalaryStructure(ServiceBase, TimestampMixin):
    __tablename__ = "salary_structures"
    __table_args__ = (
        UniqueConstraint("employee_id", name="uq_staff_emp_salary_struct"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    hra: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    other_allowances: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    pf_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    esi_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    tds_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    other_deductions: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    net_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)

    ctc_annual: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    basic_monthly: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    hra_monthly: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    da_monthly: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    conveyance_monthly: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    special_allowance_monthly: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    gross_monthly: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)

    # Statutory Deductions
    pf_employee_monthly: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    pf_employer_monthly: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    esi_employee_monthly: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    esi_employer_monthly: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    professional_tax_monthly: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    tds_monthly: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    total_deductions_monthly: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    net_monthly: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)

    effective_from: Mapped[date] = mapped_column(Date, default=date.today)
    components_breakdown: Mapped[dict] = mapped_column(JSONB, default=dict)

    employee: Mapped["Employee"] = relationship(back_populates="salary_structure")


class PayslipTemplate(ServiceBase, TimestampMixin):
    __tablename__ = "payslip_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    template_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    theme_config: Mapped[dict] = mapped_column(JSONB, default=dict)
    header_config: Mapped[dict] = mapped_column(JSONB, default=dict)
    fields_config: Mapped[dict] = mapped_column(JSONB, default=dict)
    notes_config: Mapped[dict] = mapped_column(JSONB, default=dict)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    layout_schema: Mapped[dict] = mapped_column(JSONB, default=dict)
    header_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    footer_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Payslip(ServiceBase, TimestampMixin):
    __tablename__ = "payslips"
    __table_args__ = (
        UniqueConstraint("employee_id", "month", "year", name="uq_staff_emp_payslip_m_y"),
        Index("ix_staff_payslip_m_y", "tenant_id", "month", "year"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    hra: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    other_allowances: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    other_deductions: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    gross_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    net_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    template_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    month: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 to 12
    year: Mapped[int] = mapped_column(Integer, nullable=False)   # e.g. 2026

    # Attendance metrics for calculation
    total_days_in_month: Mapped[int] = mapped_column(Integer, default=30)
    payable_days: Mapped[float] = mapped_column(Numeric(5, 1), default=30.0)
    loss_of_pay_days: Mapped[float] = mapped_column(Numeric(5, 1), default=0.0)
    overtime_hours: Mapped[float] = mapped_column(Numeric(6, 2), default=0.0)
    overtime_pay: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)

    # Earnings breakdown
    basic_earned: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    hra_earned: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    da_earned: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    special_allowance_earned: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    bonuses_earned: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    commissions_earned: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    gross_earnings: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)

    # Deductions breakdown
    pf_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    esi_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    professional_tax: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    tds_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    loan_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    advance_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    total_deductions: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)

    net_payable: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    payment_status: Mapped[str] = mapped_column(String(30), default="Draft")  # Draft|Processed|Paid
    paid_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    pdf_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    digital_signature: Mapped[str | None] = mapped_column(Text, nullable=True)

    employee: Mapped["Employee"] = relationship(back_populates="payslips")


class EmployeeLoan(ServiceBase, TimestampMixin):
    __tablename__ = "employee_loans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    loan_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    principal_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    tenure_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    monthly_emi: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    amount_repaid: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    remaining_balance: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    start_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    start_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_by: Mapped[str | None] = mapped_column(String(150), nullable=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    loan_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    interest_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    total_repayable: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    emi_monthly: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    installments_total: Mapped[int] = mapped_column(Integer, nullable=False)
    installments_paid: Mapped[int] = mapped_column(Integer, default=0)
    outstanding_balance: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Active")  # Active|Closed|Defaulted

    employee: Mapped["Employee"] = relationship()


class SalaryAdvance(ServiceBase, TimestampMixin):
    __tablename__ = "salary_advances"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    approved_by: Mapped[str | None] = mapped_column(String(150), nullable=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    recovery_month: Mapped[int] = mapped_column(Integer, nullable=False)
    recovery_year: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Approved")  # Pending|Approved|Recovered|Rejected

    employee: Mapped["Employee"] = relationship()


class EmployeeBonus(ServiceBase, TimestampMixin):
    __tablename__ = "employee_bonuses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    bonus_title: Mapped[str | None] = mapped_column(String(150), nullable=True)
    bonus_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    distribution_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    distribution_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    bonus_name: Mapped[str] = mapped_column(String(150), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    employee: Mapped["Employee"] = relationship()


class SalesCommission(ServiceBase, TimestampMixin):
    __tablename__ = "sales_commissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    period_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    period_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    achieved_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    commission_rate: Mapped[float] = mapped_column(Numeric(7, 4), default=0.0)
    commission_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    slab_tier: Mapped[int | None] = mapped_column(Integer, nullable=True)
    calculation_mode: Mapped[str | None] = mapped_column(String(50), nullable=True)
    slab_breakdown: Mapped[dict] = mapped_column(JSONB, default=dict)
    status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    sales_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    commission_rate_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    commission_earned: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    is_settled: Mapped[bool] = mapped_column(Boolean, default=False)

    employee: Mapped["Employee"] = relationship()


class CommissionSlabPlan(ServiceBase, TimestampMixin):
    __tablename__ = "commission_slab_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    calculation_mode: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    slabs: Mapped[list] = mapped_column(JSONB, default=list)
    milestone_bonus_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    milestone_bonus_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    plan_name: Mapped[str] = mapped_column(String(150), nullable=False)
    slabs_json: Mapped[list] = mapped_column(JSONB, default=list)  # [{"min": 0, "max": 100000, "rate": 2.0}]
    status: Mapped[str] = mapped_column(String(30), default="active")


# ─── Recruitment & ATS ──────────────────────────────────────────────────────

class JobOpening(ServiceBase, TimestampMixin):
    __tablename__ = "job_openings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    location: Mapped[str | None] = mapped_column(String(100), nullable=True)
    type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    experience: Mapped[str | None] = mapped_column(String(100), nullable=True)
    openings: Mapped[int] = mapped_column(Integer, default=1)
    applicants_count: Mapped[int] = mapped_column(Integer, default=0)
    posted_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    threshold_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    portals: Mapped[str | None] = mapped_column(String(200), nullable=True)
    criteria: Mapped[str | None] = mapped_column(Text, nullable=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    designation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("designations.id", ondelete="SET NULL"), nullable=True)
    positions_count: Mapped[int] = mapped_column(Integer, default=1)
    experience_required_years: Mapped[float] = mapped_column(Numeric(4, 1), default=0.0)
    min_salary: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    max_salary: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    job_description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Open")  # Open|Closed|On Hold

    department: Mapped["Department | None"] = relationship()
    designation: Mapped["Designation | None"] = relationship()
    applicants: Mapped[list["Applicant"]] = relationship(back_populates="job_opening")

    @property
    def description(self) -> str:
        """Read alias for the monolith's ``JobOpening.description``; the
        column is ``job_description``."""
        return self.job_description


class Applicant(ServiceBase, TimestampMixin):
    __tablename__ = "applicants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    applied_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expected_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    experience: Mapped[str | None] = mapped_column(String(100), nullable=True)
    job_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    match_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    proposed_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    resume_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    job_opening_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("job_openings.id", ondelete="SET NULL"), nullable=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    resume_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    stage: Mapped[str] = mapped_column(String(50), default="Applied")  # Applied|Screening|Interview|Offered|Hired|Rejected
    rating: Mapped[float] = mapped_column(Numeric(3, 1), default=0.0)
    current_ctc: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    expected_ctc: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    notice_period_days: Mapped[int] = mapped_column(Integer, default=30)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    job_opening: Mapped["JobOpening | None"] = relationship(back_populates="applicants")
    interviews: Mapped[list["Interview"]] = relationship(back_populates="applicant")


class Interview(ServiceBase, TimestampMixin):
    __tablename__ = "interviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    applicant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("applicants.id", ondelete="CASCADE"), nullable=False)
    # Monolith-compat display fields (the HRMS UI shows the candidate's
    # name + role on the interview card, not just an applicant id).
    candidate: Mapped[str | None] = mapped_column(String(200), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    interviewer_name: Mapped[str] = mapped_column(String(150), nullable=False)
    round_name: Mapped[str] = mapped_column(String(100), default="Technical Round 1")
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Monolith-compat schedule fields: the API stores date/time/duration/type
    # separately (the UI's interview dialog works in date + time strings,
    # not a single timestamp).
    date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    duration: Mapped[int] = mapped_column(Integer, default=30)
    type: Mapped[str | None] = mapped_column(String(30), nullable=True)  # In-Person|Video Call
    mode: Mapped[str | None] = mapped_column(String(30), nullable=True)
    meeting_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1 to 10
    status: Mapped[str] = mapped_column(String(30), default="Scheduled")  # Scheduled|Completed|Cancelled|No Show

    applicant: Mapped["Applicant"] = relationship(back_populates="interviews")


class OfferLetter(ServiceBase, TimestampMixin):
    __tablename__ = "offer_letters"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    candidate: Mapped[str | None] = mapped_column(String(200), nullable=True)
    candidate_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    role: Mapped[str | None] = mapped_column(String(150), nullable=True)
    ctc: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    offer_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    employee_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    email_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    custom_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    applicant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("applicants.id", ondelete="SET NULL"), nullable=True)
    candidate_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(200), nullable=False)
    designation: Mapped[str] = mapped_column(String(150), nullable=False)
    department: Mapped[str] = mapped_column(String(150), nullable=False)
    offered_ctc: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    joining_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Draft")  # Draft|Sent|Accepted|Declined
    pdf_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    signature_token: Mapped[str | None] = mapped_column(String(100), nullable=True)


class OnboardingRecord(ServiceBase, TimestampMixin):
    __tablename__ = "onboarding_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    # A record can track an applicant (pre-hire) or a hired employee; the
    # monolith recruitment flow builds it from an offer, so employee_id is
    # optional and applicant_id carries the pre-hire link.
    employee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    applicant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applicants.id", ondelete="SET NULL"), nullable=True
    )
    # Monolith display fields: the new-hire card shows the person + role +
    # start date + a task checklist with overall progress.
    new_hire: Mapped[str | None] = mapped_column(String(200), nullable=True)
    role: Mapped[str | None] = mapped_column(String(150), nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    tasks_json: Mapped[list] = mapped_column(JSONB, default=list)
    # Legacy step-tracking fields (kept, now optional — the task-checklist
    # flow above supersedes them).
    step_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="Pending")  # Pending|In Progress|Completed
    assigned_to: Mapped[str | None] = mapped_column(String(150), nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    employee: Mapped["Employee | None"] = relationship()


# ─── Performance & OKRs ─────────────────────────────────────────────────────

class PerformanceGoal(ServiceBase, TimestampMixin):
    __tablename__ = "performance_goals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    employee_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    weight: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    progress: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    weightage_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=20.0)
    target_value: Mapped[str | None] = mapped_column(String(100), nullable=True)
    current_value: Mapped[str | None] = mapped_column(String(100), nullable=True)
    progress_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="In Progress")  # In Progress|Completed|Overdue

    employee: Mapped["Employee"] = relationship()


class PerformanceKpi(ServiceBase, TimestampMixin):
    __tablename__ = "performance_kpis"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    # Legacy field set (kept so older responses keep working).
    kpi_name: Mapped[str] = mapped_column(String(150), nullable=False)
    target: Mapped[str] = mapped_column(String(100), nullable=False)
    achieved: Mapped[str] = mapped_column(String(100), default="0")
    rating: Mapped[float] = mapped_column(Numeric(3, 1), default=0.0)
    # The monolith/HRMS UI field set: metric text + numeric current/unit/achievement.
    metric: Mapped[str | None] = mapped_column(String(150), nullable=True)
    current: Mapped[str | None] = mapped_column(String(100), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    achievement: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)

    employee: Mapped["Employee"] = relationship()


class PerformanceAppraisal(ServiceBase, TimestampMixin):
    __tablename__ = "performance_appraisals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    employee_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    period: Mapped[str | None] = mapped_column(String(50), nullable=True)
    rating: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    reviewer: Mapped[str | None] = mapped_column(String(150), nullable=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    appraisal_cycle: Mapped[str] = mapped_column(String(50), default="Q1-2026")
    self_score: Mapped[float | None] = mapped_column(Numeric(3, 1), nullable=True)
    manager_score: Mapped[float | None] = mapped_column(Numeric(3, 1), nullable=True)
    final_score: Mapped[float | None] = mapped_column(Numeric(3, 1), nullable=True)
    manager_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="Draft")  # Draft|Self Submitted|Reviewed|Finalized

    employee: Mapped["Employee"] = relationship()


class PerformanceIncentive(ServiceBase, TimestampMixin):
    __tablename__ = "performance_incentives"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    employee_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    basis: Mapped[str | None] = mapped_column(String(150), nullable=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    period: Mapped[str] = mapped_column(String(50), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Approved")  # Approved|Paid

    employee: Mapped["Employee"] = relationship()


# ─── Learning Management (LMS) ──────────────────────────────────────────────

class LearningCourse(ServiceBase, TimestampMixin):
    __tablename__ = "learning_courses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    duration: Mapped[int] = mapped_column(Integer, default=0)
    enrolled: Mapped[int] = mapped_column(Integer, default=0)
    completion: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), default="General")
    duration_hours: Mapped[float] = mapped_column(Numeric(5, 1), default=2.0)
    instructor: Mapped[str] = mapped_column(String(150), nullable=False)
    enrolled_count: Mapped[int] = mapped_column(Integer, default=0)
    rating: Mapped[float] = mapped_column(Numeric(3, 1), default=5.0)
    status: Mapped[str] = mapped_column(String(30), default="Active")


class LearningCertificate(ServiceBase, TimestampMixin):
    __tablename__ = "learning_certificates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    employee_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    cert_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    issuer: Mapped[str | None] = mapped_column(String(150), nullable=True)
    issued_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("learning_courses.id", ondelete="CASCADE"), nullable=False)
    certificate_code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    issue_date: Mapped[date] = mapped_column(Date, default=date.today)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    employee: Mapped["Employee"] = relationship()
    course: Mapped["LearningCourse"] = relationship()


class LearningAssessment(ServiceBase, TimestampMixin):
    __tablename__ = "learning_assessments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    course_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    participants: Mapped[int] = mapped_column(Integer, default=0)
    avg_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("learning_courses.id", ondelete="CASCADE"), nullable=False)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    score: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    passed: Mapped[bool] = mapped_column(Boolean, default=True)
    attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    course: Mapped["LearningCourse"] = relationship()
    employee: Mapped["Employee"] = relationship()


# ─── Exit Management & Offboarding ──────────────────────────────────────────

class ExitResignation(ServiceBase, TimestampMixin):
    __tablename__ = "exit_resignations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    employee_name: Mapped[str] = mapped_column(String(150), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    designation: Mapped[str] = mapped_column(String(100), nullable=False)
    resign_date: Mapped[date] = mapped_column(Date, default=date.today)
    last_working_day: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Pending")  # Pending|Accepted|Rejected|Completed

    employee: Mapped["Employee"] = relationship()


class ExitClearanceTask(ServiceBase, TimestampMixin):
    __tablename__ = "exit_clearance_tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    employee_name: Mapped[str] = mapped_column(String(150), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    task: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Pending")  # Pending|In Progress|Done
    assigned_to: Mapped[str] = mapped_column(String(150), nullable=False)

    employee: Mapped["Employee"] = relationship()


class ExitFinalSettlement(ServiceBase, TimestampMixin):
    __tablename__ = "exit_final_settlements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    employee_name: Mapped[str] = mapped_column(String(150), nullable=False)
    last_working_day: Mapped[date] = mapped_column(Date, nullable=False)
    components_json: Mapped[list] = mapped_column(JSONB, default=list)  # [{"item": "Unpaid Salary", "amount": 25000}]
    net_payable: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    status: Mapped[str] = mapped_column(String(30), default="Draft")  # Draft|Approved|Paid

    employee: Mapped["Employee"] = relationship()


class ExitExperienceLetter(ServiceBase, TimestampMixin):
    __tablename__ = "exit_experience_letters"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    employee_name: Mapped[str] = mapped_column(String(150), nullable=False)
    designation: Mapped[str] = mapped_column(String(150), nullable=False)
    from_date: Mapped[date] = mapped_column(Date, nullable=False)
    to_date: Mapped[date] = mapped_column(Date, nullable=False)
    issued_on: Mapped[str] = mapped_column(String(50), default="-")
    status: Mapped[str] = mapped_column(String(30), default="Pending")  # Pending|Issued
    pdf_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    employee: Mapped["Employee"] = relationship()


# ─── Legacy Staff & Tip Operations (Preserved) ──────────────────────────────

class ShiftRoster(ServiceBase, TimestampMixin):
    __tablename__ = "shift_rosters"
    __table_args__ = (
        UniqueConstraint("employee_id", "shift_date", name="uq_staff_roster_emp_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    shift_date: Mapped[date] = mapped_column(Date, nullable=False)
    shift_type: Mapped[ShiftType] = mapped_column(String(20), default=ShiftType.MORNING)
    start_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    end_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    status: Mapped[RosterStatus] = mapped_column(String(20), default=RosterStatus.SCHEDULED)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    employee: Mapped["Employee"] = relationship()


class TipEntry(ServiceBase, TimestampMixin):
    __tablename__ = "tip_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    bill_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    pool_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tip_pool_distributions.id", ondelete="SET NULL"), nullable=True)


class TipPoolDistribution(ServiceBase, TimestampMixin):
    __tablename__ = "tip_pool_distributions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    shares: Mapped[list] = mapped_column(JSONB, default=list)  # [{"employee_id": str, "amount": float}]
    status: Mapped[TipDistributionStatus] = mapped_column(String(20), default=TipDistributionStatus.PROPOSED)
    distributed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @property
    def total_pool(self) -> float:
        return float(self.total_amount or 0.0)

    @total_pool.setter
    def total_pool(self, val: float):
        self.total_amount = val

    @property
    def pool_amount_key(self) -> str:
        return f"{self.period_start}:{self.period_end}"

    @property
    def approved_by(self):
        return None

    @property
    def paid_at(self):
        return self.distributed_at

    @property
    def notes(self):
        return ""


class TipPoolShare:
    """Helper representing a single share in a tip pool distribution."""
    def __init__(self, id=None, distribution_id=None, employee_id=None, amount=0.0, fraction=0.0, reason=None, **kwargs):
        self.id = id or _uuid()
        self.distribution_id = distribution_id
        self.employee_id = employee_id
        self.amount = amount
        self.fraction = fraction
        self.reason = reason
        for k, v in kwargs.items():
            setattr(self, k, v)


# ─── Per-tenant key/value settings ───────────────────────────────────────────
# The monolith kept tenant overrides (e.g. the Google Maps API key the travel
# routes studio reads at /hrms/travel-routes/config) in a SystemSetting
# table. The split had no home for it, so the HRMS routes that survived from
# the monolith 500ed on the missing name. One tenant-scoped key/value table is
# all those endpoints need; nothing else in the split reads it.

class SystemSetting(ServiceBase, TimestampMixin):
    __tablename__ = "system_settings"
    __table_args__ = (UniqueConstraint("tenant_id", "key", name="uq_staff_setting_tenant_key"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)



# ─── Legacy monolith RBAC / tenant compat shims ──────────────────────────────
# The HRMS API files (employees.py, payroll.py, attendance.py, recruitment.py)
# were ported verbatim from the monolith, where ``Tenant``/``User``/``Role``/
# ``UserRole`` lived in the shared models module and queries like
# ``select(UserRole).join(Role, ...)`` ran against one database. In the split
# they 500ed with NameError on first use. These lightweight tenant-scoped
# tables let those legacy queries run inside ``restaurantos_staff`` — same
# treatment as the Company/Branch shims above. Every column the ported code
# actually reads is declared; nothing more.
#
# Column nullability is deliberately looser than the monolith's: the boot
# column-repair in schema_bootstrap refuses to ALTER-add a NOT NULL column
# with no default to an existing table, and these are pure compat rows —
# strictness would buy nothing.

class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class Tenant(ServiceBase, TimestampMixin):
    """Tenant row the monolith's tenant-scoped ``comp_name`` lookups need.

    Seeded per tenant by ``_ensure_company_rows``-style boot logic; reads are
    ``tenant.name if tenant else "<default>"`` everywhere, so a missing row is
    already tolerated by the legacy code paths."""
    __tablename__ = "tenants"
    __table_args__ = (UniqueConstraint("tenant_id", "slug", name="uq_staff_tenant_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(100), default="primary")
    name: Mapped[str] = mapped_column(String(200), default="Workspace")
    status: Mapped[str] = mapped_column(String(30), default="active")
    plan: Mapped[str | None] = mapped_column(String(50), nullable=True)


class User(ServiceBase, TimestampMixin):
    """Auth-service user row the HRMS face-recognition + role-assignment
    endpoints read/write. Mirrors the monolith's columns the ported code
    touches; identity stays owned by the auth service — this is the staff
    service's own copy, keyed by the same user uuids cross-service."""
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("tenant_id", "email", name="uq_staff_user_email"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="active")
    is_tenant_owner: Mapped[bool] = mapped_column(Boolean, default=False)
    # Face-recognition columns the attendance studio reads back from the
    # linked user row.
    face_photo: Mapped[str | None] = mapped_column(Text, nullable=True)
    face_photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    face_descriptor: Mapped[str | None] = mapped_column(Text, nullable=True)
    face_registered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Role(ServiceBase, TimestampMixin):
    """Role row for the HRMS role filter (``Role.name.ilike(...)`` joins from
    employees.py) and the role-assignment block. The auth service remains the
    source of truth for real RBAC — the /erp/roles compat proxy syncs reads
    from there; this table exists for the monolith-shaped joins."""
    __tablename__ = "roles"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_staff_role_name"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), default="")
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class UserRole(ServiceBase, TimestampMixin):
    """Join row the monolith's employee role-assignment block writes
    (``db.add(UserRole(user_id=..., role_id=..., is_default=True,
    company_id=..., branch_id=...))`` in employees.py)."""
    __tablename__ = "user_roles"
    __table_args__ = (
        UniqueConstraint("user_id", "role_id", name="uq_staff_user_role"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    role_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    branch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class OutboxMessage(ServiceBase, TimestampMixin):
    """Transactional outbox row — one per event this service would emit.

    Written in the same transaction as the domain change so the two commit
    or roll back together. A relay marks rows published or dead; pending rows
    are what the relay keeps picking up on crash-recovery. ``event_id`` is
    the bus dedupe key, so a re-delivered event is a no-op on the consumer
    side even if the relay over-publishes it.

    Status transitions: pending -> published (relay succeeded) / dead (retries
    exhausted).
    """

    __tablename__ = "outbox_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    event_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    type: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    source_service: Mapped[str] = mapped_column(String(50), default="staff")
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )


class ConsumedEvent(ServiceBase, TimestampMixin):
    """Durable idempotency ledger — one row per event this service consumed.

    Written by the bus's consumer loop via the installed dedupe ledger
    (``src.services.event_bus.dedupe``), so a redelivered event whose
    event_id is already here is skipped even after a process restart.

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
