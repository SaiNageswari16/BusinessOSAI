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
    settings: Mapped[dict | None] = mapped_column(JSONB, default=dict)

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

# ─── HRMS — Recruitment Models ───────────────────────────────────

class JobOpening(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "job_openings"

    title: Mapped[str] = mapped_column(String(150), nullable=False)
    department: Mapped[str] = mapped_column(String(200), nullable=False)
    location: Mapped[str] = mapped_column(String(150), nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="Full-Time")  # Full-Time|Part-Time|Contract
    experience: Mapped[str] = mapped_column(String(50), nullable=False)
    openings: Mapped[int] = mapped_column(Integer, default=1)
    applicants_count: Mapped[int] = mapped_column(Integer, default=0)
    posted_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    status: Mapped[str] = mapped_column(String(30), default="Open")  # Open|On Hold|Closed
    description: Mapped[str] = mapped_column(Text, nullable=False)
    threshold_score: Mapped[int] = mapped_column(Integer, default=70)
    portals: Mapped[list[str]] = mapped_column(JSONB, default=list)  # JSON list
    criteria: Mapped[str] = mapped_column(Text, nullable=False)  # Comma-separated search words (no length limit)

    # Zoho Recruit & third-party recruitment sync columns
    provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    provider_job_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sync_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_synced: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    applicants: Mapped[list["Applicant"]] = relationship(back_populates="job", cascade="all, delete-orphan")


class Applicant(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "recruitment_applicants"

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(150), nullable=False)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("job_openings.id", ondelete="CASCADE"), nullable=False)
    job_title: Mapped[str] = mapped_column(String(150), nullable=False)
    applied_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    experience: Mapped[str] = mapped_column(String(50), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, default=0)
    stage: Mapped[str] = mapped_column(String(30), default="Applied")  # Applied|Screening|Interview|Offer|Hired|Rejected
    source: Mapped[str] = mapped_column(String(100), default="Careers Page")
    match_score: Mapped[int] = mapped_column(Integer, default=50)
    resume_text: Mapped[str | None] = mapped_column(Text)
    
    expected_salary: Mapped[float | None] = mapped_column(Numeric(12, 2))
    proposed_salary: Mapped[float | None] = mapped_column(Numeric(12, 2))
    notes_json: Mapped[list[dict]] = mapped_column(JSONB, default=list)

    # Sync tracking columns
    provider_candidate_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sync_status: Mapped[str | None] = mapped_column(String(50), nullable=True)

    job: Mapped["JobOpening"] = relationship(back_populates="applicants")


class Interview(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "recruitment_interviews"

    applicant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("recruitment_applicants.id", ondelete="CASCADE"), nullable=False)
    candidate: Mapped[str] = mapped_column(String(150), nullable=False)
    job_title: Mapped[str] = mapped_column(String(150), nullable=False)
    interviewer_name: Mapped[str] = mapped_column(String(150), nullable=False)
    date: Mapped[str] = mapped_column(String(50), nullable=False)
    time: Mapped[str] = mapped_column(String(50), nullable=False)
    duration: Mapped[int] = mapped_column(Integer, default=60)
    type: Mapped[str] = mapped_column(String(100), default="Technical")
    mode: Mapped[str] = mapped_column(String(50), default="Video Call")
    meeting_link: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(30), default="Scheduled")  # Scheduled|Completed|Cancelled
    feedback: Mapped[str | None] = mapped_column(Text)

    # Sync tracking columns
    provider_interview_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sync_status: Mapped[str | None] = mapped_column(String(50), nullable=True)

    applicant: Mapped["Applicant"] = relationship()


class OfferLetter(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "recruitment_offer_letters"

    applicant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("recruitment_applicants.id", ondelete="CASCADE"), nullable=False)
    candidate: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[str] = mapped_column(String(150), nullable=False)
    ctc: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    offer_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    joining_date: Mapped[date] = mapped_column(Date, nullable=False)
    signer_name: Mapped[str] = mapped_column(String(150), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Awaiting Acceptance")  # Awaiting Acceptance|Accepted|Declined
    email_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    custom_template: Mapped[str | None] = mapped_column(Text)

    applicant: Mapped["Applicant"] = relationship()


class OnboardingRecord(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "recruitment_onboardings"

    applicant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("recruitment_applicants.id", ondelete="CASCADE"), nullable=False)
    new_hire: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[str] = mapped_column(String(150), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    tasks_json: Mapped[list[dict]] = mapped_column(JSONB, default=list)  # List of dicts

    applicant: Mapped["Applicant"] = relationship()


# ─── HRMS — Performance Models ───────────────────────────────────

class PerformanceGoal(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "performance_goals"

    employee_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"))
    employee_name: Mapped[str] = mapped_column(String(150), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Not Started")  # Not Started|On Track|At Risk|Completed
    weight: Mapped[int] = mapped_column(Integer, default=10)
    progress: Mapped[int] = mapped_column(Integer, default=0)

    employee: Mapped["Employee | None"] = relationship()


class PerformanceKpi(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "performance_kpis"

    metric: Mapped[str] = mapped_column(String(200), nullable=False)
    target: Mapped[str] = mapped_column(String(50), nullable=False)
    current: Mapped[str] = mapped_column(String(50), nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    achievement: Mapped[int] = mapped_column(Integer, default=0)


class PerformanceAppraisal(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "performance_appraisals"

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    employee_name: Mapped[str] = mapped_column(String(150), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    period: Mapped[str] = mapped_column(String(50), nullable=False)  # H1 2026
    self_score: Mapped[int] = mapped_column(Integer, default=0)
    manager_score: Mapped[int] = mapped_column(Integer, default=0)
    final_score: Mapped[int] = mapped_column(Integer, default=0)
    rating: Mapped[str] = mapped_column(String(100), default="Meets Expectations")  # Outstanding|Exceeds Expectations|Meets Expectations|Needs Improvement
    reviewer: Mapped[str] = mapped_column(String(150), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Pending")  # Pending|In Progress|Completed

    employee: Mapped["Employee"] = relationship()


class PerformanceIncentive(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "performance_incentives"

    employee_name: Mapped[str] = mapped_column(String(150), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    basis: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Pending")  # Pending|Approved|Paid


# ─── HRMS — Learning Models ──────────────────────────────────────

class LearningCourse(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "learning_courses"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    instructor: Mapped[str] = mapped_column(String(150), nullable=False)
    duration: Mapped[str] = mapped_column(String(50), nullable=False)
    enrolled: Mapped[int] = mapped_column(Integer, default=0)
    completion: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="Active")  # Active | Mandatory | Closed


class LearningCertificate(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "learning_certificates"

    employee_name: Mapped[str] = mapped_column(String(150), nullable=False)
    cert_name: Mapped[str] = mapped_column(String(200), nullable=False)
    issuer: Mapped[str] = mapped_column(String(150), nullable=False)
    issued_date: Mapped[str] = mapped_column(String(50), nullable=False)
    expiry_date: Mapped[str] = mapped_column(String(50), default="N/A")
    status: Mapped[str] = mapped_column(String(30), default="Valid")  # Valid | Expired


class LearningAssessment(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "learning_assessments"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    course_name: Mapped[str] = mapped_column(String(200), nullable=False)
    due_date: Mapped[str] = mapped_column(String(50), nullable=False)
    participants: Mapped[int] = mapped_column(Integer, default=0)
    avg_score: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="Active")  # Active | Closed | Not Started


# ─── HRMS — Exit Management Models ───────────────────────────────

class ExitResignation(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "exit_resignations"

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    employee_name: Mapped[str] = mapped_column(String(150), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    designation: Mapped[str] = mapped_column(String(100), nullable=False)
    resign_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    last_working_day: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Pending")  # Pending|Accepted|Rejected|Completed

    employee: Mapped["Employee"] = relationship()


class ExitClearanceTask(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "exit_clearance_tasks"

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    employee_name: Mapped[str] = mapped_column(String(150), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    task: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Pending")  # Pending|In Progress|Done
    assigned_to: Mapped[str] = mapped_column(String(150), nullable=False)


class ExitFinalSettlement(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "exit_final_settlements"

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    employee_name: Mapped[str] = mapped_column(String(150), nullable=False)
    last_working_day: Mapped[date] = mapped_column(Date, nullable=False)
    components_json: Mapped[list[dict]] = mapped_column(JSONB, default=list)  # [{item: str, amount: float}]


class ExitExperienceLetter(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "exit_experience_letters"

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    employee_name: Mapped[str] = mapped_column(String(150), nullable=False)
    designation: Mapped[str] = mapped_column(String(150), nullable=False)
    from_date: Mapped[date] = mapped_column(Date, nullable=False)
    to_date: Mapped[date] = mapped_column(Date, nullable=False)
    issued_on: Mapped[str] = mapped_column(String(50), default="—")
    status: Mapped[str] = mapped_column(String(30), default="Pending")  # Pending|Issued


# ─── CRM — Customers & Lead Management ──────────────────────────

class Customer(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Customer 360 — comprehensive CRM customer profile."""
    __tablename__ = "crm_customers"
    __table_args__ = (UniqueConstraint("tenant_id", "email", name="uq_crm_customers_tenant_email"),)

    # ── Identity ──────────────────────────────────────────────────────
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    customer_code: Mapped[str | None] = mapped_column(String(50), index=True)
    first_name: Mapped[str | None] = mapped_column(String(150))
    last_name: Mapped[str | None] = mapped_column(String(150))
    gender: Mapped[str | None] = mapped_column(String(20))  # Male|Female|Other|Prefer not to say
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    anniversary_date: Mapped[date | None] = mapped_column(Date)

    # ── Contact ───────────────────────────────────────────────────────
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    phone: Mapped[str | None] = mapped_column(String(30))
    alternate_phone: Mapped[str | None] = mapped_column(String(30))
    whatsapp_number: Mapped[str | None] = mapped_column(String(30))
    website: Mapped[str | None] = mapped_column(String(255))

    # ── Company / B2B ─────────────────────────────────────────────────
    company_name: Mapped[str | None] = mapped_column(String(255))
    designation: Mapped[str | None] = mapped_column(String(150))
    industry: Mapped[str | None] = mapped_column(String(100))
    company_size: Mapped[str | None] = mapped_column(String(50))  # 1-10|11-50|51-200|201-500|500+
    annual_revenue: Mapped[float | None] = mapped_column(Numeric(18, 2))

    # ── Classification ───────────────────────────────────────────────
    customer_type: Mapped[str] = mapped_column(String(50), default="Retail")  # Retail|Corporate|Wholesale|VIP|Distributor|Dealer
    customer_category: Mapped[str] = mapped_column(String(30), default="B2C")  # B2C|B2B
    lifecycle_stage: Mapped[str] = mapped_column(String(30), default="Lead")  # Lead|Prospect|Active|At-Risk|Dormant|Lost|Champion
    source: Mapped[str | None] = mapped_column(String(100))  # Website|Referral|Walk-in|Social|Email|Campaign|Import
    referred_by: Mapped[str | None] = mapped_column(String(255))

    # ── Tax & Compliance ─────────────────────────────────────────────
    gst_number: Mapped[str | None] = mapped_column(String(50))
    pan_number: Mapped[str | None] = mapped_column(String(20))
    gst_treatment: Mapped[str | None] = mapped_column(String(50))  # Registered|Unregistered|Composition|Regular

    # ── Addresses ─────────────────────────────────────────────────────
    address: Mapped[str | None] = mapped_column(Text)
    billing_address: Mapped[str | None] = mapped_column(Text)
    shipping_address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(100), default="India")
    postal_code: Mapped[str | None] = mapped_column(String(20))

    # ── Financial ─────────────────────────────────────────────────────
    credit_limit: Mapped[float | None] = mapped_column(Numeric(18, 2))
    payment_terms: Mapped[str | None] = mapped_column(String(100))  # Net 30|Net 60|COD|Advance
    outstanding_balance: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    lifetime_value: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    total_orders: Mapped[int] = mapped_column(Integer, default=0)
    total_returns: Mapped[int] = mapped_column(Integer, default=0)
    average_order_value: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    last_purchase_date: Mapped[date | None] = mapped_column(Date)
    first_purchase_date: Mapped[date | None] = mapped_column(Date)

    # ── Loyalty / Wallet (denormalized for fast reads) ────────────────
    loyalty_points_balance: Mapped[int] = mapped_column(Integer, default=0)
    loyalty_tier: Mapped[str | None] = mapped_column(String(50))  # Bronze|Silver|Gold|Platinum|Diamond
    loyalty_tier_progress: Mapped[float] = mapped_column(Numeric(5, 2), default=0)  # % progress to next tier
    wallet_balance: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    wallet_lifetime_credited: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    wallet_lifetime_debited: Mapped[float] = mapped_column(Numeric(18, 2), default=0)

    # ── Engagement ────────────────────────────────────────────────────
    preferred_language: Mapped[str | None] = mapped_column(String(20), default="en")
    preferred_channel: Mapped[str | None] = mapped_column(String(30))  # Email|SMS|WhatsApp|Phone|In-App
    preferred_currency: Mapped[str | None] = mapped_column(String(10), default="INR")
    timezone: Mapped[str | None] = mapped_column(String(50))
    marketing_opt_in: Mapped[bool] = mapped_column(Boolean, default=True)
    sms_opt_in: Mapped[bool] = mapped_column(Boolean, default=True)
    email_opt_in: Mapped[bool] = mapped_column(Boolean, default=True)
    whatsapp_opt_in: Mapped[bool] = mapped_column(Boolean, default=True)
    do_not_disturb: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── Social handles ────────────────────────────────────────────────
    facebook_id: Mapped[str | None] = mapped_column(String(100))
    instagram_handle: Mapped[str | None] = mapped_column(String(100))
    twitter_handle: Mapped[str | None] = mapped_column(String(100))
    linkedin_handle: Mapped[str | None] = mapped_column(String(100))

    # ── RFM / Analytics ───────────────────────────────────────────────
    rfm_recency_days: Mapped[int | None] = mapped_column(Integer)
    rfm_frequency_score: Mapped[int | None] = mapped_column(Integer)
    rfm_monetary_score: Mapped[int | None] = mapped_column(Integer)
    rfm_segment: Mapped[str | None] = mapped_column(String(50))  # Champions|Loyal|At-Risk|Dormant|New
    churn_risk_score: Mapped[float | None] = mapped_column(Numeric(5, 2))  # 0-100

    # ── Status / Meta ─────────────────────────────────────────────────
    status: Mapped[str] = mapped_column(String(30), default="Active")  # Active|Inactive|Blocked|Blacklisted
    notes: Mapped[str | None] = mapped_column(Text)
    tags: Mapped[list | None] = mapped_column(JSONB, default=list)
    custom_fields: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    lead_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_leads.id", ondelete="SET NULL"), unique=True)

    # Relationships
    group_memberships: Mapped[list["CustomerGroupMember"]] = relationship(
        back_populates="customer", cascade="all, delete-orphan"
    )
    wallet_transactions: Mapped[list["CustomerWalletTransaction"]] = relationship(
        back_populates="customer", cascade="all, delete-orphan"
    )
    loyalty_transactions: Mapped[list["LoyaltyTransaction"]] = relationship(
        back_populates="customer", cascade="all, delete-orphan"
    )
    memberships: Mapped[list["CustomerMembership"]] = relationship(
        back_populates="customer", cascade="all, delete-orphan"
    )


class Lead(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "crm_leads"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    company_name: Mapped[str | None] = mapped_column(String(255), index=True)
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    phone: Mapped[str | None] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(30), default="New", index=True)
    source: Mapped[str | None] = mapped_column(String(100))
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    estimated_value: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    last_contact_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_follow_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    lost_reason: Mapped[str | None] = mapped_column(String(255))
    
    external_id: Mapped[str | None] = mapped_column(String(100), index=True)
    external_source: Mapped[str | None] = mapped_column(String(50), index=True)
    meta: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    ai_score: Mapped[int | None] = mapped_column(Integer)
    ai_sentiment: Mapped[str | None] = mapped_column(String(50))


class LeadActivity(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "crm_lead_activities"

    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_leads.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    summary: Mapped[str] = mapped_column(String(500), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))


class CRMSupportTicket(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "crm_support_tickets"

    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_customers.id", ondelete="SET NULL"))
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(30), default="Medium")  # Low|Medium|High
    status: Mapped[str] = mapped_column(String(30), default="Open")  # Open|In Progress|Resolved|Closed
    category: Mapped[str] = mapped_column(String(100), default="Support")
    ai_summary: Mapped[str | None] = mapped_column(Text)


class CRMQuotation(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "crm_quotations"

    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_customers.id", ondelete="CASCADE"), nullable=False)
    quote_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    items: Mapped[dict | None] = mapped_column(JSONB, default=dict)  # [{"product_id": ..., "qty": ..., "price": ...}]
    subtotal: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    tax: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    status: Mapped[str] = mapped_column(String(30), default="Draft")  # Draft|Sent|Accepted|Declined|Expired


class CRMSalesOrder(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "crm_sales_orders"

    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_customers.id", ondelete="CASCADE"), nullable=False)
    order_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    items: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    total: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    status: Mapped[str] = mapped_column(String(30), default="Pending")  # Pending|Processing|Shipped|Delivered|Cancelled
    payment_status: Mapped[str] = mapped_column(String(30), default="Unpaid")  # Unpaid|Partially Paid|Paid


class CRMOpportunity(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "crm_opportunities"

    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_customers.id", ondelete="SET NULL"), index=True)
    lead_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_leads.id", ondelete="SET NULL"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    stage: Mapped[str] = mapped_column(String(50), nullable=False, default="Prospecting", index=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    probability: Mapped[int] = mapped_column(Integer, default=10)
    expected_close_date: Mapped[date | None] = mapped_column(Date)
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    next_step: Mapped[str | None] = mapped_column(String(500))
    next_step_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    forecast_category: Mapped[str] = mapped_column(String(30), default="Pipeline")
    lost_reason: Mapped[str | None] = mapped_column(String(255))


class OrganizationIntegration(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "organization_integrations"
    __table_args__ = (
        UniqueConstraint("organization_id", "provider", name="uq_org_integrations_provider"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expiry: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    api_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    organization_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    connected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class EmailCampaign(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Email campaign logs and details."""
    __tablename__ = "email_campaigns"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body_html: Mapped[str] = mapped_column(Text, nullable=False)
    target_category: Mapped[str] = mapped_column(String(50), nullable=False)  # employees|candidates|customers|others
    status: Mapped[str] = mapped_column(String(50), default="Draft")  # Draft|Sent
    recipient_count: Mapped[int] = mapped_column(Integer, default=0)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class EmailTemplate(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Custom reusable email campaign templates."""
    __tablename__ = "email_templates"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    body_html: Mapped[str] = mapped_column(Text, nullable=False)


class LiveNotification(Base, UUIDPrimaryKeyMixin, TenantScopedMixin):
    """Real-time push notifications of system events / submissions."""
    __tablename__ = "live_notifications"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="system")  # crm|hrms|pos|inventory|system
    unread: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MetaAdCampaign(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Local mirror of a Meta Marketing API Campaign."""
    __tablename__ = "fb_ad_campaigns"

    meta_campaign_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    objective: Mapped[str] = mapped_column(String(50), nullable=False, default="OUTCOME_LEADS")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="PAUSED", index=True)
    special_ad_categories: Mapped[dict | None] = mapped_column(JSONB, default=list)
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    stop_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    daily_budget_cents: Mapped[int | None] = mapped_column(Integer)
    lifetime_budget_cents: Mapped[int | None] = mapped_column(Integer)
    meta_payload: Mapped[dict | None] = mapped_column(JSONB, default=dict)

    __table_args__ = (
        UniqueConstraint("tenant_id", "meta_campaign_id", name="uq_fb_ad_campaigns_tenant_meta"),
    )

    ad_sets: Mapped[list["MetaAdSet"]] = relationship(
        back_populates="campaign", cascade="all, delete-orphan"
    )


class MetaAdSet(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Local mirror of a Meta Ad Set (budget + targeting + schedule)."""
    __tablename__ = "fb_ad_sets"

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fb_ad_campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    meta_adset_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    optimization_goal: Mapped[str] = mapped_column(String(50), nullable=False, default="LEAD_GENERATION")
    billing_event: Mapped[str] = mapped_column(String(30), nullable=False, default="IMPRESSIONS")
    bid_amount_cents: Mapped[int | None] = mapped_column(Integer)
    targeting: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="PAUSED")
    meta_payload: Mapped[dict | None] = mapped_column(JSONB, default=dict)

    __table_args__ = (
        UniqueConstraint("tenant_id", "meta_adset_id", name="uq_fb_ad_sets_tenant_meta"),
    )

    campaign: Mapped["MetaAdCampaign"] = relationship(back_populates="ad_sets")
    ads: Mapped[list["MetaAd"]] = relationship(
        back_populates="adset", cascade="all, delete-orphan"
    )


class MetaAd(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Local mirror of a Meta Ad (creative + ad set link + destination)."""
    __tablename__ = "fb_ads"

    adset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fb_ad_sets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    meta_ad_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    meta_creative_id: Mapped[str | None] = mapped_column(String(50))
    meta_image_hash: Mapped[str | None] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    lead_form_id: Mapped[str | None] = mapped_column(String(50))
    destination_url: Mapped[str | None] = mapped_column(Text)
    headline: Mapped[str | None] = mapped_column(String(255))
    body: Mapped[str | None] = mapped_column(Text)
    cta_type: Mapped[str | None] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="PAUSED")
    meta_payload: Mapped[dict | None] = mapped_column(JSONB, default=dict)

    __table_args__ = (
        UniqueConstraint("tenant_id", "meta_ad_id", name="uq_fb_ads_tenant_meta"),
    )

    adset: Mapped["MetaAdSet"] = relationship(back_populates="ads")


class AssetLibrary(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """AI-generated marketing assets approved for reuse."""
    __tablename__ = "asset_library"

    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    public_url: Mapped[str] = mapped_column(String(500), nullable=False)
    thumbnail_url: Mapped[str | None] = mapped_column(String(500))
    aspect_ratio: Mapped[str] = mapped_column(String(10), nullable=False, default="1:1")
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer)
    mime_type: Mapped[str] = mapped_column(String(50), nullable=False, default="image/jpeg")
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="claude")
    provider_model: Mapped[str | None] = mapped_column(String(100))
    original_prompt: Mapped[str | None] = mapped_column(Text)
    enhanced_prompt: Mapped[str | None] = mapped_column(Text)
    style: Mapped[str | None] = mapped_column(String(100))
    approval_status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    used_in_organic_post: Mapped[bool] = mapped_column(Boolean, default=False)
    used_in_paid_campaign: Mapped[bool] = mapped_column(Boolean, default=False)
    organic_post_id: Mapped[str | None] = mapped_column(String(100))
    paid_campaign_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fb_ad_campaigns.id", ondelete="SET NULL")
    )
    tags: Mapped[list | None] = mapped_column(JSONB, default=list)
    notes: Mapped[str | None] = mapped_column(Text)


class CustomerMembership(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Tracks which membership plan a customer is enrolled in and their tier status."""
    __tablename__ = "crm_memberships"
    __table_args__ = (
        UniqueConstraint("tenant_id", "customer_id", name="uq_memberships_tenant_customer"),
    )

    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_customers.id", ondelete="CASCADE"), nullable=False)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_membership_plans.id", ondelete="RESTRICT"), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Active")  # Active|Expired|Cancelled|Suspended
    enrolled_at: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    expires_at: Mapped[date | None] = mapped_column(Date)
    tier: Mapped[str | None] = mapped_column(String(50))  # Bronze|Silver|Gold|Platinum|Diamond
    tier_progress: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    points_earned: Mapped[int] = mapped_column(Integer, default=0)
    points_redeemed: Mapped[int] = mapped_column(Integer, default=0)
    total_spend_with_plan: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancellation_reason: Mapped[str | None] = mapped_column(String(255))

    customer: Mapped["Customer"] = relationship(back_populates="memberships")
    plan: Mapped["MembershipPlan"] = relationship()


class MembershipPlan(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Defines a membership plan with pricing, cycle, tiers, and perks."""
    __tablename__ = "crm_membership_plans"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_membership_plans_tenant_name"),)

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    plan_code: Mapped[str | None] = mapped_column(String(50), index=True)  # e.g., GOLD-2026

    # Pricing
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    cycle: Mapped[str] = mapped_column(String(30), default="Monthly")  # Monthly|Quarterly|Yearly|Lifetime

    # Benefits
    points_multiplier: Mapped[float] = mapped_column(Numeric(4, 2), default=1)  # Earn N× points
    discount_percent: Mapped[float | None] = mapped_column(Numeric(5, 2))  # Flat discount for members
    free_shipping: Mapped[bool] = mapped_column(Boolean, default=False)
    priority_support: Mapped[bool] = mapped_column(Boolean, default=False)
    early_access: Mapped[bool] = mapped_column(Boolean, default=False)

    # Tiers (JSONB: [{name, min_points, max_points, multiplier, color}])
    tiers: Mapped[list | None] = mapped_column(JSONB, default=list)

    # Eligibility & validity
    min_qualifying_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    max_active_members: Mapped[int | None] = mapped_column(Integer)
    max_duration_months: Mapped[int | None] = mapped_column(Integer)

    status: Mapped[str] = mapped_column(String(30), default="Active")  # Active|Draft|Archived
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    subscriber_count: Mapped[int] = mapped_column(Integer, default=0)
    terms_conditions: Mapped[str | None] = mapped_column(Text)


class CustomerGroup(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Named customer group for segmentation, bulk operations, and discount targeting."""
    __tablename__ = "crm_customer_groups"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_crm_groups_tenant_name"),)

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    group_code: Mapped[str | None] = mapped_column(String(50), index=True)
    color: Mapped[str] = mapped_column(String(20), default="#6366f1")

    # Defaults
    default_discount_percent: Mapped[float | None] = mapped_column(Numeric(5, 2))
    default_credit_limit: Mapped[float | None] = mapped_column(Numeric(18, 2))
    default_payment_terms: Mapped[str | None] = mapped_column(String(100))

    # Targeting metadata
    criteria: Mapped[dict | None] = mapped_column(JSONB, default=dict)  # Auto-assignment rules
    tags: Mapped[list | None] = mapped_column(JSONB, default=list)

    status: Mapped[str] = mapped_column(String(30), default="Active")  # Active|Archived
    member_count: Mapped[int] = mapped_column(Integer, default=0)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)

    members: Mapped[list["CustomerGroupMember"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )


class CustomerGroupMember(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Many-to-many join: customers ↔ groups."""
    __tablename__ = "crm_customer_group_members"
    __table_args__ = (
        UniqueConstraint("group_id", "customer_id", name="uq_group_customer"),
    )

    group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_customer_groups.id", ondelete="CASCADE"), nullable=False)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_customers.id", ondelete="CASCADE"), nullable=False)
    joined_at: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    added_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    reason: Mapped[str | None] = mapped_column(String(255))

    group: Mapped["CustomerGroup"] = relationship(back_populates="members")
    customer: Mapped["Customer"] = relationship(back_populates="group_memberships")


class CustomerSegment(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Dynamic customer segment — rule-based or static member list."""
    __tablename__ = "crm_customer_segments"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_crm_segments_tenant_name"),)

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    color: Mapped[str] = mapped_column(String(20), default="#6366f1")

    # Matching mode
    mode: Mapped[str] = mapped_column(String(30), default="rules")  # rules|manual
    is_auto_computed: Mapped[bool] = mapped_column(Boolean, default=True)

    # Rules (JSONB): [{field, operator, value}]
    # Example: {field: "total_orders", operator: ">", value: 10}
    rules: Mapped[dict | None] = mapped_column(JSONB, default=dict)

    # Manual customer IDs (used when mode == manual)
    manual_customer_ids: Mapped[list | None] = mapped_column(JSONB, default=list)

    # Computed fields (auto-updated when is_auto_computed=True)
    member_count: Mapped[int] = mapped_column(Integer, default=0)
    total_revenue: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    avg_ltv: Mapped[float] = mapped_column(Numeric(18, 2), default=0)

    # Schedule
    compute_schedule: Mapped[str | None] = mapped_column(String(50))  # daily|weekly|monthly|manual
    last_computed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_computed_count: Mapped[int | None] = mapped_column(Integer)

    status: Mapped[str] = mapped_column(String(30), default="Active")  # Active|Draft|Archived
    tags: Mapped[list | None] = mapped_column(JSONB, default=list)


class CustomerWallet(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """One wallet record per customer (balance is also denormalized on Customer for performance)."""
    __tablename__ = "crm_wallets"
    __table_args__ = (UniqueConstraint("tenant_id", "customer_id", name="uq_wallets_tenant_customer"),)

    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_customers.id", ondelete="CASCADE"), nullable=False)
    balance: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    lifetime_credited: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    lifetime_debited: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    credit_count: Mapped[int] = mapped_column(Integer, default=0)
    debit_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text)

    customer: Mapped["Customer"] = relationship()


class CustomerWalletTransaction(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Immutable log of every wallet credit/debit."""
    __tablename__ = "crm_wallet_transactions"

    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_customers.id", ondelete="CASCADE"), nullable=False)
    wallet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_wallets.id", ondelete="CASCADE"), nullable=False)

    transaction_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    # topup|refund|cashback|payment|loyalty_redemption|promotion|adjustment|transfer
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    balance_before: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    balance_after: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)

    reference_type: Mapped[str | None] = mapped_column(String(50))  # order|invoice|payment|loyalty|manual
    reference_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    description: Mapped[str | None] = mapped_column(String(500))
    meta: Mapped[dict | None] = mapped_column(JSONB, default=dict)

    initiated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    customer: Mapped["Customer"] = relationship()
    wallet: Mapped["CustomerWallet"] = relationship()


class LoyaltyProgram(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Configurable loyalty program definition (one active program per tenant)."""
    __tablename__ = "crm_loyalty_programs"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_loyalty_programs_tenant_name"),)

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    starts_at: Mapped[date | None] = mapped_column(Date)
    ends_at: Mapped[date | None] = mapped_column(Date)

    # Earning rules
    points_per_currency_unit: Mapped[float] = mapped_column(Numeric(8, 4), default=1)  # 1 point per ₹1
    points_per_referral: Mapped[int] = mapped_column(Integer, default=0)
    bonus_points_on_birthday: Mapped[int] = mapped_column(Integer, default=0)
    bonus_points_on_anniversary: Mapped[int] = mapped_column(Integer, default=0)

    # Redemption rules
    redemption_rate: Mapped[float] = mapped_column(Numeric(8, 4), default=0.01)  # 1 point = ₹0.01
    min_redemption_points: Mapped[int] = mapped_column(Integer, default=100)
    max_redemption_per_order_percent: Mapped[float | None] = mapped_column(Numeric(5, 2))  # max % of order

    # Tiers (JSONB): [{name, min_points, max_points, earn_multiplier, redemption_multiplier, color, icon}]
    tier_definitions: Mapped[list | None] = mapped_column(JSONB, default=list)

    # Restrictions
    max_points_expiry_months: Mapped[int | None] = mapped_column(Integer)  # Points expire after N months
    earn_on_payment_methods: Mapped[list | None] = mapped_column(JSONB, default=list)  # All if empty
    exclude_product_categories: Mapped[list | None] = mapped_column(JSONB, default=list)

    terms_conditions: Mapped[str | None] = mapped_column(Text)


class LoyaltyTransaction(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Immutable ledger of loyalty point earn/redeem/expire/bonus events."""
    __tablename__ = "crm_loyalty_transactions"

    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_customers.id", ondelete="CASCADE"), nullable=False, index=True)

    transaction_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    # earn|redeem|expire|bonus|manual_credit|manual_debit|transfer_in|transfer_out
    points: Mapped[int] = mapped_column(Integer, nullable=False)  # Positive for earn, negative for redeem
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)

    tier_at_time: Mapped[str | None] = mapped_column(String(50))
    multiplier_applied: Mapped[float] = mapped_column(Numeric(4, 2), default=1)

    reference_type: Mapped[str | None] = mapped_column(String(50))  # order|invoice|referral|promotion|manual|birthday
    reference_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    program_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_loyalty_programs.id", ondelete="SET NULL"))

    description: Mapped[str | None] = mapped_column(String(500))
    meta: Mapped[dict | None] = mapped_column(JSONB, default=dict)

    initiated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    expires_at: Mapped[date | None] = mapped_column(Date)  # Only for earned points that expire

    customer: Mapped["Customer"] = relationship()


class Discount(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Discount / coupon / promotion code definition."""
    __tablename__ = "crm_discounts"
    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_crm_discounts_tenant_code"),)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)

    # Discount configuration
    discount_type: Mapped[str] = mapped_column(String(30), nullable=False)  # percentage|fixed_amount|bogof|free_shipping
    value: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)  # percent or fixed amount
    max_discount_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))  # Cap for percentage discounts
    min_order_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))

    # Applicability
    applies_to: Mapped[str] = mapped_column(String(30), default="all_customers")
    # all_customers|customer_group|customer_segment|membership_plan|individual_customer|product_category|product
    target_customer_ids: Mapped[list | None] = mapped_column(JSONB, default=list)
    target_group_ids: Mapped[list | None] = mapped_column(JSONB, default=list)
    target_segment_ids: Mapped[list | None] = mapped_column(JSONB, default=list)
    target_membership_ids: Mapped[list | None] = mapped_column(JSONB, default=list)
    target_product_ids: Mapped[list | None] = mapped_column(JSONB, default=list)
    target_categories: Mapped[list | None] = mapped_column(JSONB, default=list)

    # Applicable channels
    applicable_channels: Mapped[list | None] = mapped_column(JSONB, default=list)  # All channels if empty

    # Validity
    valid_from: Mapped[date | None] = mapped_column(Date)
    valid_until: Mapped[date | None] = mapped_column(Date)
    valid_days_of_week: Mapped[list | None] = mapped_column(JSONB, default=list)  # All if empty
    valid_time_ranges: Mapped[list | None] = mapped_column(JSONB, default=list)  # e.g. [{start: "09:00", end: "18:00"}]

    # Usage limits
    usage_limit_per_customer: Mapped[int | None] = mapped_column(Integer)  # per customer
    usage_limit_total: Mapped[int | None] = mapped_column(Integer)  # global cap
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    used_customer_ids: Mapped[list | None] = mapped_column(JSONB, default=list)  # track per-customer usage

    # Stacking
    is_stackable: Mapped[bool] = mapped_column(Boolean, default=False)
    stack_priority: Mapped[int] = mapped_column(Integer, default=0)  # Higher = applied first

    # Meta
    status: Mapped[str] = mapped_column(String(30), default="Active")  # Active|Scheduled|Expired|Disabled|Exhausted
    priority: Mapped[int] = mapped_column(Integer, default=0)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    auto_apply: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_coupon_code: Mapped[bool] = mapped_column(Boolean, default=True)
    tags: Mapped[list | None] = mapped_column(JSONB, default=list)


from .erp import *
from .inventory import *
from .procurement import *
