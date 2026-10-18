import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
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
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database.base import (
    Base,
    EntityStatus,
    TenantScopedMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    db_enum,
    enum_values,
)


# ─── Tenant / Workspace ───────────────────────────────────────────

class TenantStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    CANCELLED = "cancelled"


class Tenant(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    status: Mapped[TenantStatus] = mapped_column(
        db_enum(TenantStatus, name="tenant_status"), default=TenantStatus.TRIAL
    )
    plan: Mapped[str] = mapped_column(String(50), default="trial")
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)
    contact_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    users: Mapped[list["User"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    outlets: Mapped[list["Outlet"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")


# ─── Users / Auth ─────────────────────────────────────────────────

class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class User(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("tenant_id", "email", name="uq_tenant_user_email"),
    )

    email: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[UserStatus] = mapped_column(
        db_enum(UserStatus, name="user_status"), default=UserStatus.ACTIVE
    )
    is_tenant_owner: Mapped[bool] = mapped_column(Boolean, default=False)
    is_platform_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Outlets this user may access. Empty list = all outlets in the tenant.
    outlet_ids: Mapped[list] = mapped_column(JSONB, default=list)

    tenant: Mapped["Tenant"] = relationship(back_populates="users", foreign_keys="User.tenant_id")
    user_roles: Mapped[list["UserRole"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class RefreshToken(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


class UserPasskey(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "user_passkeys"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    credential_id: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    public_key: Mapped[str] = mapped_column(Text, nullable=False)
    sign_count: Mapped[int] = mapped_column(Integer, default=0)
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(foreign_keys=[user_id])


# ─── RBAC ─────────────────────────────────────────────────────────

class Role(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    role_permissions: Mapped[list["RolePermission"]] = relationship(
        back_populates="role", cascade="all, delete-orphan"
    )
    user_roles: Mapped[list["UserRole"]] = relationship(
        back_populates="role", cascade="all, delete-orphan"
    )


class Permission(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Global permission catalogue — not tenant scoped, seeded once."""

    __tablename__ = "permissions"

    code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    module: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)


class RolePermission(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "role_permissions"
    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )

    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False, index=True
    )

    role: Mapped["Role"] = relationship(back_populates="role_permissions")
    permission: Mapped["Permission"] = relationship()


class UserRole(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "user_roles"
    __table_args__ = (
        UniqueConstraint("user_id", "role_id", name="uq_user_role"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True, index=True
    )

    user: Mapped["User"] = relationship(back_populates="user_roles")
    role: Mapped["Role"] = relationship(back_populates="user_roles")


class MfaPolicy(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "mfa_policies"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=False)
    methods: Mapped[list] = mapped_column(JSONB, default=list)  # ["totp", "email", "sms"]
    applies_to_roles: Mapped[list] = mapped_column(JSONB, default=list)


class ApiKey(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "api_keys"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    key_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    scopes: Mapped[list] = mapped_column(JSONB, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


# ─── Organization: Outlets ────────────────────────────────────────

class OutletType(str, enum.Enum):
    DINE_IN = "dine_in"
    TAKEAWAY = "takeaway"
    QSR = "qsr"
    CLOUD_KITCHEN = "cloud_kitchen"
    CAFE = "cafe"
    FOOD_TRUCK = "food_truck"


class Outlet(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "outlets"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_tenant_outlet_code"),
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    outlet_type: Mapped[OutletType] = mapped_column(
        db_enum(OutletType, name="outlet_type"), default=OutletType.DINE_IN
    )

    # Address
    address_line1: Mapped[str | None] = mapped_column(String(300), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(300), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state_code: Mapped[str | None] = mapped_column(String(5), nullable=True)  # GST state code, e.g. "29"
    pincode: Mapped[str | None] = mapped_column(String(10), nullable=True)
    country: Mapped[str] = mapped_column(String(5), default="IN")

    # Contact & compliance
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    gstin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    fssai_license: Mapped[str | None] = mapped_column(String(50), nullable=True)
    pan: Mapped[str | None] = mapped_column(String(15), nullable=True)

    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata")
    currency: Mapped[str] = mapped_column(String(5), default="INR")

    # Hours
    opening_time: Mapped[str | None] = mapped_column(String(5), nullable=True)   # "09:00"
    closing_time: Mapped[str | None] = mapped_column(String(5), nullable=True)   # "23:00"
    weekly_hours: Mapped[dict] = mapped_column(JSONB, default=dict)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)

    tenant: Mapped["Tenant"] = relationship(back_populates="outlets", foreign_keys="Outlet.tenant_id")
    sections: Mapped[list["Section"]] = relationship(
        back_populates="outlet", cascade="all, delete-orphan"
    )
    tables: Mapped[list["RestaurantTable"]] = relationship(
        back_populates="outlet", cascade="all, delete-orphan"
    )


class SectionType(str, enum.Enum):
    AC_HALL = "ac_hall"
    NON_AC = "non_ac"
    TERRACE = "terrace"
    PRIVATE_DINING = "private_dining"
    BAR = "bar"
    COUNTER = "counter"
    GARDEN = "garden"


class Section(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "sections"

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    section_type: Mapped[SectionType] = mapped_column(
        db_enum(SectionType, name="section_type"), default=SectionType.AC_HALL
    )
    capacity: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    outlet: Mapped["Outlet"] = relationship(back_populates="sections", foreign_keys=[outlet_id])
    tables: Mapped[list["RestaurantTable"]] = relationship(
        back_populates="section", cascade="all, delete-orphan"
    )


class TableStatus(str, enum.Enum):
    FREE = "free"
    OCCUPIED = "occupied"
    RESERVED = "reserved"
    BILLING = "billing"
    CLEANING = "cleaning"
    BLOCKED = "blocked"


class RestaurantTable(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "restaurant_tables"
    __table_args__ = (
        UniqueConstraint("outlet_id", "code", name="uq_outlet_table_code"),
    )

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    section_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sections.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    seats: Mapped[int] = mapped_column(Integer, default=4)
    min_covers: Mapped[int] = mapped_column(Integer, default=1)
    max_covers: Mapped[int] = mapped_column(Integer, default=6)
    status: Mapped[TableStatus] = mapped_column(
        db_enum(TableStatus, name="table_status"), default=TableStatus.FREE
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Floor-plan coordinates for the layout editor
    position_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    position_y: Mapped[float | None] = mapped_column(Float, nullable=True)

    outlet: Mapped["Outlet"] = relationship(back_populates="tables", foreign_keys=[outlet_id])
    section: Mapped["Section | None"] = relationship(back_populates="tables", foreign_keys=[section_id])


# ─── Organization: supporting master data ────────────────────────

class CostCenter(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "cost_centers"

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    center_type: Mapped[str] = mapped_column(String(50), default="operating")  # operating|profit|investment
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class FiscalYearStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"


class FiscalYear(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "fiscal_years"

    name: Mapped[str] = mapped_column(String(50), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[FiscalYearStatus] = mapped_column(
        db_enum(FiscalYearStatus, name="fiscal_year_status"), default=FiscalYearStatus.OPEN
    )
    is_current: Mapped[bool] = mapped_column(Boolean, default=False)


class Currency(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "currencies"

    code: Mapped[str] = mapped_column(String(5), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    symbol: Mapped[str] = mapped_column(String(10), nullable=False)
    exchange_rate: Mapped[float] = mapped_column(Numeric(14, 6), default=1.0)
    is_base: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Tag(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "tags"

    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    module: Mapped[str | None] = mapped_column(String(50), nullable=True)


class UnitOfMeasure(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "units_of_measure"

    name: Mapped[str] = mapped_column(String(50), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    uom_type: Mapped[str] = mapped_column(String(30), default="weight")  # weight|volume|count
    base_factor: Mapped[float] = mapped_column(Numeric(14, 6), default=1.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


# ─── System ───────────────────────────────────────────────────────

class NumberSeries(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "number_series"
    __table_args__ = (
        UniqueConstraint("tenant_id", "module", "outlet_id", name="uq_tenant_module_outlet_series"),
    )

    module: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True, index=True
    )
    prefix: Mapped[str] = mapped_column(String(30), default="")
    suffix: Mapped[str] = mapped_column(String(30), default="")
    next_number: Mapped[int] = mapped_column(Integer, default=1)
    padding: Mapped[int] = mapped_column(Integer, default=4)
    reset_period: Mapped[str] = mapped_column(String(20), default="monthly")  # never|monthly|yearly
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class AuditLog(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "audit_logs"

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    old_values: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    new_values: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)


class ActivityLog(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "activity_logs"

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    activity_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    extra_data: Mapped[dict] = mapped_column(JSONB, default=dict)


class Printer(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "printers"

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    printer_type: Mapped[str] = mapped_column(String(20), default="KOT")  # KOT|BILL|LABEL|REPORT
    connection: Mapped[str] = mapped_column(String(20), default="NETWORK")  # USB|NETWORK|BLUETOOTH
    address: Mapped[str | None] = mapped_column(String(100), nullable=True)
    port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    paper_width_mm: Mapped[int] = mapped_column(Integer, default=80)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class NotificationChannel(str, enum.Enum):
    WHATSAPP = "whatsapp"
    SMS = "sms"
    EMAIL = "email"
    PUSH = "push"


class NotificationTemplate(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "notification_templates"

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    event: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    channel: Mapped[NotificationChannel] = mapped_column(
        db_enum(NotificationChannel, name="notification_channel"), default=NotificationChannel.WHATSAPP
    )
    subject: Mapped[str | None] = mapped_column(String(300), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    variables: Mapped[list] = mapped_column(JSONB, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class NotificationStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    DELIVERED = "delivered"


class NotificationLog(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "notification_logs"

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="SET NULL"), nullable=True
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("notification_templates.id", ondelete="SET NULL"), nullable=True
    )
    event: Mapped[str] = mapped_column(String(50), nullable=True)
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    recipient: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    status: Mapped[NotificationStatus] = mapped_column(
        db_enum(NotificationStatus, name="notification_status"), default=NotificationStatus.PENDING
    )
    provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    provider_message_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
