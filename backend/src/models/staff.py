import enum
import uuid

from sqlalchemy import (
    Boolean,
    Date,
    Enum,
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

from src.database.base import (
    Base,
    TenantScopedMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    db_enum,
    enum_values,
)


# ─── Employees ───────────────────────────────────────────────────

class EmployeeRoleType(str, enum.Enum):
    MANAGER = "manager"
    CASHIER = "cashier"
    WAITER = "waiter"
    CAPTAIN = "captain"
    CHEF = "chef"
    KITCHEN_STAFF = "kitchen_staff"
    DELIVERY = "delivery"
    HOUSEKEEPING = "housekeeping"


class Employee(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "employees"
    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_code", name="uq_tenant_employee_code"),
    )

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    employee_code: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    designation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    role_type: Mapped[EmployeeRoleType] = mapped_column(
        db_enum(EmployeeRoleType, name="employee_role_type"), default=EmployeeRoleType.WAITER
    )
    joined_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    hourly_rate: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    emergency_contact: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User | None"] = relationship(foreign_keys=[user_id])


class ShiftType(str, enum.Enum):
    MORNING = "morning"
    EVENING = "evening"
    NIGHT = "night"


class RosterStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    ABSENT = "absent"
    SWAPPED = "swapped"


class ShiftRoster(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "shift_rosters"
    __table_args__ = (
        Index("ix_shift_rosters_outlet_date", "outlet_id", "shift_date"),
    )

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    shift_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    end_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    shift_type: Mapped[ShiftType] = mapped_column(
        db_enum(ShiftType, name="shift_type"), default=ShiftType.MORNING
    )
    status: Mapped[RosterStatus] = mapped_column(
        db_enum(RosterStatus, name="roster_status"), default=RosterStatus.SCHEDULED
    )

    employee: Mapped["Employee"] = relationship(foreign_keys=[employee_id])


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    HALF_DAY = "half_day"
    LEAVE = "leave"
    HOLIDAY = "holiday"


class Attendance(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "attendances"
    __table_args__ = (
        UniqueConstraint("employee_id", "attendance_date", name="uq_employee_attendance_date"),
    )

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    attendance_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    check_in: Mapped[str | None] = mapped_column(String(50), nullable=True)
    check_out: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[AttendanceStatus] = mapped_column(
        db_enum(AttendanceStatus, name="attendance_status"), default=AttendanceStatus.PRESENT
    )
    worked_hours: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    overtime_hours: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    employee: Mapped["Employee"] = relationship(foreign_keys=[employee_id])


# ─── Tips ────────────────────────────────────────────────────────

class Tip(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "tips"

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    bill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bills.id", ondelete="SET NULL"), nullable=True
    )
    employee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    distributed_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_distributed: Mapped[bool] = mapped_column(Boolean, default=False)

    bill: Mapped["Bill | None"] = relationship(foreign_keys=[bill_id])
    employee: Mapped["Employee | None"] = relationship(foreign_keys=[employee_id])


class TipPoolDistribution(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "tip_pool_distributions"

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pool_date: Mapped[Date] = mapped_column(Date, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    distribution: Mapped[dict] = mapped_column(JSONB, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|distributed
    distributed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


# ─── Customers ───────────────────────────────────────────────────

class Customer(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint("tenant_id", "phone", name="uq_tenant_customer_phone"),
    )

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    gstin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    birthday: Mapped[Date | None] = mapped_column(Date, nullable=True)
    anniversary: Mapped[Date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    total_visits: Mapped[int] = mapped_column(Integer, default=0)
    total_spent: Mapped[float] = mapped_column(Numeric(14, 2), default=0)


# ─── Feedback & complaints ───────────────────────────────────────

class FeedbackStatus(str, enum.Enum):
    NEW = "new"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


class FeedbackSource(str, enum.Enum):
    POS = "pos"
    QR = "qr"
    WHATSAPP = "whatsapp"
    GOOGLE = "google"
    ZOMATO = "zomato"
    SWIGGY = "swiggy"


class Feedback(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "feedback"
    __table_args__ = (
        Index("ix_feedback_outlet_created", "outlet_id", "created_at"),
    )

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True
    )
    bill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bills.id", ondelete="SET NULL"), nullable=True
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )
    rating_overall: Mapped[int] = mapped_column(Integer, default=5)
    rating_food: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rating_service: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rating_ambience: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[FeedbackStatus] = mapped_column(
        db_enum(FeedbackStatus, name="feedback_status"), default=FeedbackStatus.NEW
    )
    source: Mapped[FeedbackSource] = mapped_column(
        db_enum(FeedbackSource, name="feedback_source"), default=FeedbackSource.POS
    )


class ComplaintStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class Complaint(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "complaints"

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )
    raised_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="medium")  # low|medium|high
    status: Mapped[ComplaintStatus] = mapped_column(
        db_enum(ComplaintStatus, name="complaint_status"), default=ComplaintStatus.OPEN
    )
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    resolved_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
