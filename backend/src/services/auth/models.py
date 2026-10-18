"""Auth service models — tenants, users, roles, tokens.

These tables live in ``restaurantos_auth`` ONLY. Every other service holds
``tenant_id`` / ``user_id`` as bare UUID columns with no foreign key — that
is the boundary.

Roles and permissions are not normalised into join tables. They are read
once, at token-issue time, and then travel in the token itself, so there is
no table to keep in sync on a hot path. ``refresh_tokens`` is the exception:
it has to be queryable, because that is the only way revocation works.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.services.shared.service_db import service_base

# This service's own base, not the shared ServiceBase. See
# service_db.service_base for why: a plain subclass inherits the shared
# metadata, and one create_all() would emit every service's DDL here.
ServiceBase = service_base("auth")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _utcnow() -> datetime:
    from datetime import timezone

    return datetime.now(timezone.utc)


class TenantStatus(str, enum.Enum):
    TRIAL = "trial"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    CANCELLED = "cancelled"


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    INVITED = "invited"
    DISABLED = "disabled"
    DEACTIVATED = "deactivated"


def status_value(value: object) -> str:
    """The plain string for a status field, however it was obtained.

    Status columns are ``String``, not ``Enum``: a value just assigned in
    Python is the enum member, but the same field loaded back from Postgres is
    a plain ``str``. Because the members subclass ``str``, equality and
    comparison work either way — ``user.status != UserStatus.ACTIVE`` is
    correct for both. Only ``.value`` is member-specific, so calling it on a
    loaded row raises AttributeError. This is the accessor that always works.
    """
    return value.value if isinstance(value, enum.Enum) else str(value)


class TimestampMixin:
    """Timestamps set application-side, not by the DB.

    A server_default/onupdate function makes SQLAlchemy re-SELECT the row to
    learn the value. That lazy load lands outside the request's async context
    and fails as MissingGreenlet when Pydantic serialises the response, so the
    values are generated in Python instead.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )


class Tenant(ServiceBase, TimestampMixin):
    __tablename__ = "auth_tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    status: Mapped[TenantStatus] = mapped_column(String(20), default=TenantStatus.TRIAL)
    plan: Mapped[str] = mapped_column(String(50), default="trial")
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)
    contact_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)

    users: Mapped[list["User"]] = relationship(
        back_populates="tenant",
        primaryjoin="Tenant.id == User.tenant_id",
        foreign_keys="User.tenant_id",
        cascade="all, delete-orphan",
    )

    # Tenant -> User is the only relationship that is ever traversed. Roles
    # and refresh tokens are read through explicit joins in service.py,
    # because session_factory() runs with expire_on_commit off and lazy loads
    # would fire outside the request's async context — the MissingGreenlet
    # failure the TimestampMixin docstring describes. The User-side
    # collections below are declared for completeness and are never loaded.


class User(ServiceBase, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("tenant_id", "email", name="uq_tenant_user_email"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )

    email: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[UserStatus] = mapped_column(
        String(20), default=UserStatus.ACTIVE, index=True
    )
    is_tenant_owner: Mapped[bool] = mapped_column(Boolean, default=False)
    is_platform_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Every relationship in this module names its join explicitly. None of
    # these columns carries a ForeignKey constraint — the service boundary is
    # drawn with bare UUID columns — so SQLAlchemy has nothing to infer the
    # join from and raises at first query, not at import.
    tenant: Mapped["Tenant"] = relationship(
        back_populates="users",
        primaryjoin="User.tenant_id == Tenant.id",
        foreign_keys="User.tenant_id",
    )
    roles: Mapped[list["UserRole"]] = relationship(
        back_populates="user",
        primaryjoin="User.id == UserRole.user_id",
        foreign_keys="UserRole.user_id",
        cascade="all, delete-orphan",
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user",
        primaryjoin="User.id == RefreshToken.user_id",
        foreign_keys="RefreshToken.user_id",
        cascade="all, delete-orphan",
    )


class RefreshToken(ServiceBase, TimestampMixin):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # Only the hash is stored, so a leaked token table cannot authenticate.
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)

    user: Mapped["User"] = relationship(
        back_populates="refresh_tokens",
        primaryjoin="RefreshToken.user_id == User.id",
        foreign_keys="RefreshToken.user_id",
    )


class Role(ServiceBase, TimestampMixin):
    """A tenant-scoped role. ``permissions`` is a flat code list.

    ``module:*`` is a wildcard over every code starting with that module,
    resolved at token-issue time by ``derived_permissions``.
    """

    __tablename__ = "roles"
    __table_args__ = (UniqueConstraint("tenant_id", "slug", name="uq_tenant_role_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    permissions: Mapped[list] = mapped_column(JSONB, default=list)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class UserRole(ServiceBase, TimestampMixin):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_user_role"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    # None means all outlets in the tenant, which is how owners work.
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    user: Mapped["User"] = relationship(
        back_populates="roles",
        primaryjoin="UserRole.user_id == User.id",
        foreign_keys="UserRole.user_id",
    )
