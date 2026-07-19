import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database.base import Base, TenantScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin


class TenantStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    CANCELLED = "cancelled"


class EntityStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class FiscalYearStatus(str, enum.Enum):
    OPEN = "open"
    LOCKED = "locked"
    CLOSED = "closed"


class Tenant(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "tenants"

    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    plan: Mapped[str] = mapped_column(String(50), nullable=False, default="starter")
    status: Mapped[TenantStatus] = mapped_column(
        Enum(TenantStatus, name="tenant_status"),
        nullable=False,
        default=TenantStatus.TRIAL,
    )
    subscription_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    max_users: Mapped[int] = mapped_column(Integer, default=50)
    max_branches: Mapped[int] = mapped_column(Integer, default=10)

    companies: Mapped[list["Company"]] = relationship(back_populates="tenant")
    users: Mapped[list["User"]] = relationship(back_populates="tenant")
    roles: Mapped[list["Role"]] = relationship(back_populates="tenant")


class Permission(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "permissions"

    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    module: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    role_permissions: Mapped[list["RolePermission"]] = relationship(back_populates="permission")


class Role(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "roles"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_roles_tenant_name"),)

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status"),
        default=EntityStatus.ACTIVE,
    )

    tenant: Mapped["Tenant"] = relationship(back_populates="roles")
    role_permissions: Mapped[list["RolePermission"]] = relationship(
        back_populates="role",
        cascade="all, delete-orphan",
    )
    user_roles: Mapped[list["UserRole"]] = relationship(back_populates="role")


class RolePermission(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "role_permissions"
    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_role_permissions"),
    )

    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False
    )

    role: Mapped["Role"] = relationship(back_populates="role_permissions")
    permission: Mapped["Permission"] = relationship(back_populates="role_permissions")


class User(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("tenant_id", "email", name="uq_users_tenant_email"),)

    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    employee_id: Mapped[str | None] = mapped_column(String(50))
    phone: Mapped[str | None] = mapped_column(String(30))
    avatar_initials: Mapped[str | None] = mapped_column(String(5))
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status"),
        default=UserStatus.ACTIVE,
    )
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    is_tenant_owner: Mapped[bool] = mapped_column(Boolean, default=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    tenant: Mapped["Tenant"] = relationship(back_populates="users")
    user_roles: Mapped[list["UserRole"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    user_branches: Mapped[list["UserBranch"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserRole(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "user_roles"
    __table_args__ = (
        UniqueConstraint("user_id", "role_id", "company_id", "branch_id", name="uq_user_roles_scope"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False
    )
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL")
    )
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="SET NULL")
    )
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship(back_populates="user_roles")
    role: Mapped["Role"] = relationship(back_populates="user_roles")


class UserBranch(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "user_branches"
    __table_args__ = (UniqueConstraint("user_id", "branch_id", name="uq_user_branches"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship(back_populates="user_branches")
    branch: Mapped["Branch"] = relationship(back_populates="user_branches")


class RefreshToken(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    ip_address: Mapped[str | None] = mapped_column(String(45))

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


class Company(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "companies"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_companies_tenant_name"),)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    legal_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_type: Mapped[str | None] = mapped_column(String(100))
    gst_number: Mapped[str | None] = mapped_column(String(50))
    pan_number: Mapped[str | None] = mapped_column(String(20))
    registration_number: Mapped[str | None] = mapped_column(String(100))
    industry: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100))
    city: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(255))
    website: Mapped[str | None] = mapped_column(String(255))
    default_currency_code: Mapped[str] = mapped_column(String(10), default="INR")
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata")
    language: Mapped[str] = mapped_column(String(20), default="en")
    financial_year_start_month: Mapped[int] = mapped_column(Integer, default=4)
    tax_config_label: Mapped[str | None] = mapped_column(String(100))
    plan: Mapped[str | None] = mapped_column(String(50))
    logo_initials: Mapped[str | None] = mapped_column(String(5))
    established_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )

    tenant: Mapped["Tenant"] = relationship(back_populates="companies")
    branches: Mapped[list["Branch"]] = relationship(back_populates="company")
    business_units: Mapped[list["BusinessUnit"]] = relationship(back_populates="company")
    regions: Mapped[list["Region"]] = relationship(back_populates="company")
    departments: Mapped[list["Department"]] = relationship(back_populates="company")
    designations: Mapped[list["Designation"]] = relationship(back_populates="company")
    fiscal_years: Mapped[list["FiscalYear"]] = relationship(back_populates="company")
    tax_configurations: Mapped[list["TaxConfiguration"]] = relationship(back_populates="company")
    number_series: Mapped[list["NumberSeries"]] = relationship(back_populates="company")
    workspaces: Mapped[list["Workspace"]] = relationship(back_populates="company")


class BusinessUnit(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "business_units"
    __table_args__ = (
        UniqueConstraint("company_id", "name", name="uq_business_units_company_name"),
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    head_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )

    company: Mapped["Company"] = relationship(back_populates="business_units")


class Region(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "regions"
    __table_args__ = (UniqueConstraint("company_id", "code", name="uq_regions_company_code"),)

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    country: Mapped[str | None] = mapped_column(String(100))
    manager_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )

    company: Mapped["Company"] = relationship(back_populates="regions")
    zones: Mapped[list["Zone"]] = relationship(back_populates="region")
    branches: Mapped[list["Branch"]] = relationship(back_populates="region")


class Zone(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "zones"
    __table_args__ = (UniqueConstraint("region_id", "name", name="uq_zones_region_name"),)

    region_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("regions.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    manager_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )

    region: Mapped["Region"] = relationship(back_populates="zones")
    branches: Mapped[list["Branch"]] = relationship(back_populates="zone")


class Branch(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "branches"
    __table_args__ = (UniqueConstraint("company_id", "code", name="uq_branches_company_code"),)

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    region_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("regions.id", ondelete="SET NULL")
    )
    zone_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("zones.id", ondelete="SET NULL")
    )
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    manager_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(255))
    has_warehouse: Mapped[bool] = mapped_column(Boolean, default=False)
    working_hours: Mapped[str | None] = mapped_column(String(100))
    opening_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )

    company: Mapped["Company"] = relationship(back_populates="branches")
    region: Mapped["Region | None"] = relationship(back_populates="branches")
    zone: Mapped["Zone | None"] = relationship(back_populates="branches")
    user_branches: Mapped[list["UserBranch"]] = relationship(back_populates="branch")
    departments: Mapped[list["Department"]] = relationship(back_populates="branch")
    teams: Mapped[list["Team"]] = relationship(back_populates="branch")
    workspaces: Mapped[list["Workspace"]] = relationship(back_populates="branch")


class Department(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "departments"
    __table_args__ = (
        UniqueConstraint("company_id", "code", name="uq_departments_company_code"),
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="SET NULL")
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL")
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    head_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )

    company: Mapped["Company"] = relationship(back_populates="departments")
    branch: Mapped["Branch | None"] = relationship(back_populates="departments")
    teams: Mapped[list["Team"]] = relationship(back_populates="department")
    cost_centers: Mapped[list["CostCenter"]] = relationship(back_populates="department")


class Designation(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "designations"
    __table_args__ = (
        UniqueConstraint("company_id", "name", name="uq_designations_company_name"),
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    level: Mapped[str | None] = mapped_column(String(20))
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )

    company: Mapped["Company"] = relationship(back_populates="designations")


class Team(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "teams"
    __table_args__ = (UniqueConstraint("department_id", "name", name="uq_teams_department_name"),)

    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False
    )
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="SET NULL")
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    lead_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )

    department: Mapped["Department"] = relationship(back_populates="teams")
    branch: Mapped["Branch | None"] = relationship(back_populates="teams")


class CostCenter(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "cost_centers"
    __table_args__ = (
        UniqueConstraint("department_id", "code", name="uq_cost_centers_department_code"),
    )

    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    budget_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    expense_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )

    department: Mapped["Department"] = relationship(back_populates="cost_centers")


class FiscalYear(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "fiscal_years"
    __table_args__ = (
        UniqueConstraint("company_id", "name", name="uq_fiscal_years_company_name"),
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(20), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[FiscalYearStatus] = mapped_column(
        Enum(FiscalYearStatus, name="fiscal_year_status"),
        default=FiscalYearStatus.OPEN,
    )

    company: Mapped["Company"] = relationship(back_populates="fiscal_years")


class Currency(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "currencies"
    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_currencies_tenant_code"),)

    code: Mapped[str] = mapped_column(String(10), nullable=False)
    symbol: Mapped[str] = mapped_column(String(10), nullable=False)
    exchange_rate: Mapped[float] = mapped_column(Numeric(18, 6), default=1)
    decimal_places: Mapped[int] = mapped_column(Integer, default=2)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )


class TaxConfiguration(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "tax_configurations"
    __table_args__ = (
        UniqueConstraint("company_id", "name", name="uq_tax_configurations_company_name"),
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    tax_type: Mapped[str] = mapped_column(String(50), nullable=False)
    rate_percent: Mapped[float] = mapped_column(Numeric(8, 4), nullable=False)
    components: Mapped[str | None] = mapped_column(Text)
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )

    company: Mapped["Company"] = relationship(back_populates="tax_configurations")


class PaymentTerm(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "payment_terms"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_payment_terms_tenant_name"),
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    days: Mapped[int] = mapped_column(Integer, default=0)
    credit_limit: Mapped[float | None] = mapped_column(Numeric(18, 2))
    late_fee_percent: Mapped[float | None] = mapped_column(Numeric(8, 4))
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )


class NumberSeries(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "number_series"
    __table_args__ = (
        UniqueConstraint("company_id", "module_name", name="uq_number_series_company_module"),
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    module_name: Mapped[str] = mapped_column(String(100), nullable=False)
    prefix: Mapped[str] = mapped_column(String(50), nullable=False)
    current_number: Mapped[int] = mapped_column(Integer, default=0)
    padding: Mapped[int] = mapped_column(Integer, default=5)
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )

    company: Mapped["Company"] = relationship(back_populates="number_series")


class Workspace(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "workspaces"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_workspaces_tenant_name"),)

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="SET NULL")
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    theme: Mapped[str] = mapped_column(String(20), default="light")
    language: Mapped[str] = mapped_column(String(10), default="en")
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata")
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )

    company: Mapped["Company"] = relationship(back_populates="workspaces")
    branch: Mapped["Branch | None"] = relationship(back_populates="workspaces")


class AuditLog(Base, UUIDPrimaryKeyMixin, TenantScopedMixin):
    __tablename__ = "audit_logs"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    module: Mapped[str] = mapped_column(String(50), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(100))
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    old_values: Mapped[dict | None] = mapped_column(JSONB)
    new_values: Mapped[dict | None] = mapped_column(JSONB)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    device: Mapped[str | None] = mapped_column(String(100))
    location: Mapped[str | None] = mapped_column(String(150))
    status: Mapped[str] = mapped_column(String(20), default="success")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class ActivityLog(Base, UUIDPrimaryKeyMixin, TenantScopedMixin):
    __tablename__ = "activity_logs"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    module: Mapped[str | None] = mapped_column(String(50))
    metadata_json: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class ApiKey(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "api_keys"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    service: Mapped[str] = mapped_column(String(100), nullable=False)
    env: Mapped[str] = mapped_column(String(20), default="Production")
    secret_key: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MfaPolicy(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "mfa_policies"

    role_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE")
    )
    methods: Mapped[str] = mapped_column(String(100), default="Authenticator")
    timeout: Mapped[str] = mapped_column(String(50), default="12 hours")
    restrict_ip: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )

    role: Mapped["Role | None"] = relationship()


# ─── Workflow Engine ──────────────────────────────────────────────


class ApprovalWorkflow(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Multi-level approval workflow definitions per module."""
    __tablename__ = "approval_workflows"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", "module", name="uq_approval_workflows_tenant_name_module"),
    )

    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    module: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    # Steps stored as JSONB: [{level, approver_role_id, approver_user_id, timeout_hours}]
    steps: Mapped[list | None] = mapped_column(JSONB, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )

    company: Mapped["Company | None"] = relationship()


class NotificationTemplate(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Email / SMS / in-app notification templates."""
    __tablename__ = "notification_templates"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", "channel", name="uq_notification_templates_name_channel"),
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    event: Mapped[str] = mapped_column(String(100), nullable=False)
    channel: Mapped[str] = mapped_column(String(20), nullable=False, default="email")  # email|sms|in_app
    subject: Mapped[str | None] = mapped_column(String(500))
    body: Mapped[str | None] = mapped_column(Text)
    variables: Mapped[list | None] = mapped_column(JSONB, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )


class DocumentTemplate(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Document templates (PDF, Word) for ERP documents."""
    __tablename__ = "document_templates"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", "document_type", name="uq_document_templates_name_type"),
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    document_type: Mapped[str] = mapped_column(String(100), nullable=False)  # invoice|po|receipt|report
    format: Mapped[str] = mapped_column(String(20), default="pdf")  # pdf|word|excel
    description: Mapped[str | None] = mapped_column(Text)
    template_content: Mapped[str | None] = mapped_column(Text)  # HTML/Jinja2 template
    variables: Mapped[list | None] = mapped_column(JSONB, default=list)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )


class AutomationRule(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Trigger-action automation rules."""
    __tablename__ = "automation_rules"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_automation_rules_tenant_name"),
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    module: Mapped[str] = mapped_column(String(100), nullable=False)
    trigger_event: Mapped[str] = mapped_column(String(100), nullable=False)
    conditions: Mapped[dict | None] = mapped_column(JSONB, default=dict)  # field/operator/value conditions
    actions: Mapped[list | None] = mapped_column(JSONB, default=list)    # action type + params
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    run_count: Mapped[int] = mapped_column(Integer, default=0)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )


class CustomField(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Tenant-level custom field definitions for any entity."""
    __tablename__ = "custom_fields"
    __table_args__ = (
        UniqueConstraint("tenant_id", "entity_type", "field_name", name="uq_custom_fields_entity_name"),
    )

    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)  # employee|customer|product
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    field_label: Mapped[str] = mapped_column(String(200), nullable=False)
    field_type: Mapped[str] = mapped_column(String(50), nullable=False, default="text")  # text|number|date|dropdown|checkbox
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)
    options: Mapped[list | None] = mapped_column(JSONB)  # dropdown options
    default_value: Mapped[str | None] = mapped_column(String(500))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )


# ─── Master Data ──────────────────────────────────────────────────


class GeographyCountry(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Countries master data for geography management."""
    __tablename__ = "geography_countries"
    __table_args__ = (
        UniqueConstraint("tenant_id", "iso_code", name="uq_geography_countries_tenant_iso"),
    )

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    iso_code: Mapped[str] = mapped_column(String(3), nullable=False)
    phone_code: Mapped[str | None] = mapped_column(String(10))
    currency_code: Mapped[str | None] = mapped_column(String(10))
    states: Mapped[list | None] = mapped_column(JSONB, default=list)  # [{name, code, cities:[]}]
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )


class Location(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Physical locations beyond branches (warehouses, offices, sites)."""
    __tablename__ = "locations"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_locations_tenant_code"),
    )

    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE")
    )
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="SET NULL")
    )
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    location_type: Mapped[str] = mapped_column(String(50), default="office")  # office|warehouse|factory|site
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(100))
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )

    company: Mapped["Company | None"] = relationship()
    branch: Mapped["Branch | None"] = relationship()


class WorkCalendar(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Work calendars and shift patterns."""
    __tablename__ = "work_calendars"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_work_calendars_tenant_name"),
    )

    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    calendar_type: Mapped[str] = mapped_column(String(30), default="standard")  # standard|shift|flexi
    working_days: Mapped[list | None] = mapped_column(JSONB, default=list)  # ["Mon","Tue","Wed","Thu","Fri"]
    shifts: Mapped[list | None] = mapped_column(JSONB, default=list)  # [{name, start_time, end_time}]
    holidays: Mapped[list | None] = mapped_column(JSONB, default=list)  # [{date, name}]
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )

    company: Mapped["Company | None"] = relationship()


class Tag(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Tenant-level tags and labels for entity categorization."""
    __tablename__ = "tags"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", "entity_type", name="uq_tags_tenant_name_entity"),
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False, default="any")  # any|employee|customer|product
    color: Mapped[str] = mapped_column(String(20), default="#6366f1")
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_constraint=False),
        default=EntityStatus.ACTIVE,
    )


# ─── System Settings ──────────────────────────────────────────────


class SystemSetting(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Key-value tenant-scoped system settings."""
    __tablename__ = "system_settings"
    __table_args__ = (
        UniqueConstraint("tenant_id", "key", name="uq_system_settings_tenant_key"),
    )

    key: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(50), default="general")
    description: Mapped[str | None] = mapped_column(Text)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)



# ─── HRMS — Employee & Attendance Models ───────────────────────────

class Employee(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "employees"
    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_code", name="uq_employees_tenant_code"),
        UniqueConstraint("tenant_id", "email", name="uq_employees_tenant_email"),
        UniqueConstraint("tenant_id", "user_id", name="uq_employees_tenant_user"),
    )

    employee_code: Mapped[str] = mapped_column(String(50), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    date_of_joining: Mapped[date] = mapped_column(Date, nullable=False)
    employment_type: Mapped[str] = mapped_column(String(50), default="Full-Time")  # Full-Time|Part-Time|Contract|Internship
    status: Mapped[str] = mapped_column(String(30), default="Active")  # Active|On Leave|Inactive
    basic_salary: Mapped[float | None] = mapped_column(Numeric(12, 2))
    
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"))
    branch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="SET NULL"))
    department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"))
    designation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("designations.id", ondelete="SET NULL"))
    manager_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    company: Mapped["Company | None"] = relationship()
    branch: Mapped["Branch | None"] = relationship()
    department: Mapped["Department | None"] = relationship()
    designation: Mapped["Designation | None"] = relationship()
    user: Mapped["User | None"] = relationship()


class EmployeeDocument(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "employee_documents"

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    document_name: Mapped[str] = mapped_column(String(200), nullable=False)
    document_type: Mapped[str] = mapped_column(String(100), nullable=False)  # Contract|ID Proof|NDA|compliance
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    upload_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    expiry_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(30), default="Valid")  # Valid|Expired

    employee: Mapped["Employee"] = relationship()


class AttendanceRecord(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_id", "date", name="uq_attendance_employee_date"),
    )

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    check_in: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    check_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    hours_worked: Mapped[float | None] = mapped_column(Numeric(5, 2))
    status: Mapped[str] = mapped_column(String(30), default="Present")  # Present|Absent|Late|Half Day|On Leave
    method: Mapped[str] = mapped_column(String(30), default="Biometric")  # Biometric|GPS|Face|Manual
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    notes: Mapped[str | None] = mapped_column(Text)

    employee: Mapped["Employee"] = relationship()


class BiometricDevice(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "biometric_devices"
    __table_args__ = (
        UniqueConstraint("tenant_id", "device_code", name="uq_biometric_device_code"),
    )

    device_code: Mapped[str] = mapped_column(String(50), nullable=False)
    location: Mapped[str] = mapped_column(String(150), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    enrolled_employees: Mapped[int] = mapped_column(Integer, default=0)
    last_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="Online")  # Online|Offline


class FaceRecognitionLog(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "face_recognition_logs"

    employee_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    confidence: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    location: Mapped[str] = mapped_column(String(150), nullable=False)
    action: Mapped[str] = mapped_column(String(30), default="Check-In")  # Check-In|Check-Out
    status: Mapped[str] = mapped_column(String(20), default="Verified")  # Verified|Failed

    employee: Mapped["Employee | None"] = relationship()


class AttendanceCorrection(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "attendance_corrections"

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    original_status: Mapped[str] = mapped_column(String(30), nullable=False)
    original_check_in: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    original_check_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    corrected_status: Mapped[str] = mapped_column(String(30), nullable=False)
    corrected_check_in: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    corrected_check_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="Pending")  # Pending|Approved|Rejected
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    employee: Mapped["Employee"] = relationship()
    reviewer: Mapped["User | None"] = relationship()

class LeaveRequest(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "leave_requests"

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    leave_type: Mapped[str] = mapped_column(String(50), nullable=False)  # Annual|Sick|Casual|Maternity|Unpaid
    from_date: Mapped[date] = mapped_column(Date, nullable=False)
    to_date: Mapped[date] = mapped_column(Date, nullable=False)
    days_requested: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="Pending")  # Pending|Approved|Rejected
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    employee: Mapped["Employee"] = relationship()
    approver: Mapped["User | None"] = relationship()


class LeaveBalance(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "leave_balances"
    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_id", "leave_type", name="uq_leave_balance_emp_type"),
    )

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    leave_type: Mapped[str] = mapped_column(String(50), nullable=False)
    total_days: Mapped[int] = mapped_column(Integer, default=0)
    used_days: Mapped[int] = mapped_column(Integer, default=0)
    balance: Mapped[int] = mapped_column(Integer, default=0)

    employee: Mapped["Employee"] = relationship()


class SalaryStructure(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "salary_structures"
    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_id", name="uq_salary_structure_emp"),
    )

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    hra: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    other_allowances: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    pf_deduction: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    esi_deduction: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    tds_deduction: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    other_deductions: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    net_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)

    employee: Mapped["Employee"] = relationship()


class Payslip(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "payslips"
    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_id", "month", "year", name="uq_payslip_emp_period"),
    )

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    hra: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    other_allowances: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    pf_deduction: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    esi_deduction: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    tds_deduction: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    other_deductions: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    gross_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    net_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="Processing")  # Processing|Paid
    pdf_url: Mapped[str | None] = mapped_column(String(500))

    employee: Mapped["Employee"] = relationship()

class LeavePolicy(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "leave_policies"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    leave_type: Mapped[str] = mapped_column(String(50), nullable=False)  # Annual|Sick|Casual|Maternity|Unpaid
    entitled_days: Mapped[int] = mapped_column(Integer, nullable=False)
    applicable_to: Mapped[str] = mapped_column(String(100), default="All")  # All | Department Name | Designation Name

class PayGrade(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "pay_grades"
    __table_args__ = (
        UniqueConstraint("tenant_id", "designation_id", name="uq_pay_grade_designation"),
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    designation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("designations.id", ondelete="CASCADE"), nullable=False)
    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    hra: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    other_allowances: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    pf_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    esi_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    tds_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)

    designation: Mapped["Designation"] = relationship()

# -------------------------------------------------------------------------
# POS MODULE MODELS
# -------------------------------------------------------------------------

class POSCategory(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "pos_categories"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    color: Mapped[str | None] = mapped_column(String(80))   # e.g. "bg-blue-100 text-blue-700"
    icon: Mapped[str | None] = mapped_column(String(80))    # lucide icon name
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    products: Mapped[list["POSProduct"]] = relationship(back_populates="category")


class POSProduct(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "pos_products"

    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pos_categories.id", ondelete="SET NULL")
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    brand: Mapped[str | None] = mapped_column(String(100))
    sku: Mapped[str | None] = mapped_column(String(100), unique=True, index=True)
    barcode: Mapped[str | None] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))

    purchase_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    mrp: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    selling_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=5.0)
    discount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)

    stock: Mapped[int] = mapped_column(Integer, default=0)
    reorder_level: Mapped[int] = mapped_column(Integer, default=10)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    category: Mapped["POSCategory | None"] = relationship(back_populates="products")


class POSTransactionStatus(str, enum.Enum):
    COMPLETED = "completed"
    REFUNDED = "refunded"
    ON_HOLD = "on_hold"

class POSTransaction(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "pos_transactions"

    cashier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pos_sessions.id", ondelete="RESTRICT"), nullable=False)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    
    receipt_number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    status: Mapped[POSTransactionStatus] = mapped_column(Enum(POSTransactionStatus, name="pos_transaction_status"), default=POSTransactionStatus.COMPLETED)
    
    parent_transaction_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("pos_transactions.id", ondelete="SET NULL"))
    delivery_status: Mapped[str | None] = mapped_column(String(50))
    delivery_address: Mapped[str | None] = mapped_column(String(255))
    driver_name: Mapped[str | None] = mapped_column(String(100))
    
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    cashier: Mapped["User"] = relationship()
    items: Mapped[list["POSTransactionItem"]] = relationship(back_populates="transaction", cascade="all, delete-orphan")
    payments: Mapped[list["POSPayment"]] = relationship(back_populates="transaction", cascade="all, delete-orphan")


class POSTransactionItem(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "pos_transaction_items"

    transaction_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pos_transactions.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    discount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    transaction: Mapped["POSTransaction"] = relationship(back_populates="items")


class POSPaymentMethod(str, enum.Enum):
    CASH = "cash"
    CARD = "card"
    ONLINE = "online"
    GIFT_CARD = "gift_card"

class POSPayment(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "pos_payments"

    transaction_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pos_transactions.id", ondelete="CASCADE"), nullable=False)
    payment_method: Mapped[POSPaymentMethod] = mapped_column(Enum(POSPaymentMethod, name="pos_payment_method"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    reference_number: Mapped[str | None] = mapped_column(String(100))  # For card/online transactions

    transaction: Mapped["POSTransaction"] = relationship(back_populates="payments")


class POSSessionStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"


class POSSession(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "pos_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    starting_cash: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    status: Mapped[POSSessionStatus] = mapped_column(Enum(POSSessionStatus, name="pos_session_status"), default=POSSessionStatus.OPEN)
    closing_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expected_cash: Mapped[float | None] = mapped_column(Numeric(12, 2))
    actual_cash: Mapped[float | None] = mapped_column(Numeric(12, 2))
    discrepancy_reason: Mapped[str | None] = mapped_column(String(500))

    user: Mapped["User"] = relationship()
