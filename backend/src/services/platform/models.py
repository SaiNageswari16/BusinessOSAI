"""Platform Service models — platform admins, plugin manifests, tenant module states,
permission catalog, ABAC access policies, and platform audit logs.

All tables live in ``restaurantos_platform_admin`` ONLY.
Zero cross-service foreign keys.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.services.shared.service_db import service_base

ServiceBase = service_base("platform")


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


class ModuleLifecycleState(str, enum.Enum):
    NOT_INSTALLED = "not_installed"
    INSTALLED = "installed"
    MIGRATING = "migrating"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    ARCHIVED = "archived"
    INSTALL_FAILED = "install_failed"


class PlatformAdminRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    OPS_ADMIN = "ops_admin"
    SUPPORT_ADMIN = "support_admin"
    BILLING_ADMIN = "billing_admin"


class PlatformAdmin(ServiceBase, TimestampMixin):
    """Platform Super Admin user accounts (distinct realm from tenant users)."""
    __tablename__ = "platform_admins"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default=PlatformAdminRole.SUPER_ADMIN)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PluginManifest(ServiceBase, TimestampMixin):
    """Catalog of available plugins/verticals in the platform marketplace."""
    __tablename__ = "plugin_manifests"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # "restaurant", "salon", "gym", "retail", "clinic", "carwash"
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    version: Mapped[str] = mapped_column(String(20), nullable=False, default="1.0.0")
    category: Mapped[str] = mapped_column(String(50), default="vertical")  # "core" | "vertical" | "add_on"
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    icon: Mapped[str] = mapped_column(String(50), default="Package")
    required_capabilities: Mapped[list] = mapped_column(JSONB, default=list)  # ["catalog", "metering", "schedule"]
    permissions: Mapped[list] = mapped_column(JSONB, default=list)  # declared permission keys
    navigation: Mapped[list] = mapped_column(JSONB, default=list)  # UI navigation nodes
    settings_schema: Mapped[dict] = mapped_column(JSONB, default=dict)  # JSON schema for tenant config
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)  # Global platform kill-switch


class TenantModuleState(ServiceBase, TimestampMixin):
    """Tracks per-tenant module state machine (ACTIVE, SUSPENDED, ARCHIVED, etc.)."""
    __tablename__ = "tenant_module_states"
    __table_args__ = (UniqueConstraint("tenant_id", "plugin_id", name="uq_tenant_plugin_state"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    plugin_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    state: Mapped[str] = mapped_column(String(30), default=ModuleLifecycleState.ACTIVE, index=True)
    activated_version: Mapped[str] = mapped_column(String(20), default="1.0.0")
    schema_version: Mapped[str] = mapped_column(String(20), default="1.0.0")
    config: Mapped[dict] = mapped_column(JSONB, default=dict)
    activated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    suspended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PermissionCatalogue(ServiceBase, TimestampMixin):
    """Authoritative catalogue of all fine-grained permissions across microservices."""
    __tablename__ = "permission_catalogue"

    code: Mapped[str] = mapped_column(String(100), primary_key=True)  # e.g. "pos:orders:discount"
    module: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # pos, kitchen, inventory, etc.
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tier: Mapped[int] = mapped_column(Integer, default=1)  # 1: module, 2: feature, 3: action/button, 4: field
    is_system: Mapped[bool] = mapped_column(Boolean, default=True)


class AccessPolicy(ServiceBase, TimestampMixin):
    """ABAC policy rules (e.g. discount limit, phone masking, cost concealment)."""
    __tablename__ = "access_policies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    subject: Mapped[dict] = mapped_column(JSONB, nullable=False)  # {"roles": ["manager"]} or {"is_tenant_owner": true}
    module: Mapped[str] = mapped_column(String(50), nullable=False)
    resource: Mapped[str] = mapped_column(String(100), nullable=False)
    operation: Mapped[str] = mapped_column(String(50), nullable=False)  # view, create, update, delete, approve, export
    effect: Mapped[str] = mapped_column(String(20), nullable=False)  # allow, deny, mask, limit
    params: Mapped[dict] = mapped_column(JSONB, default=dict)
    condition: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=100)


class PlatformAuditEntry(ServiceBase, TimestampMixin):
    """Immutable audit trail for all Platform Super Admin actions."""
    __tablename__ = "platform_audit_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    admin_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    admin_email: Mapped[str] = mapped_column(String(200), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    target_type: Mapped[str] = mapped_column(String(50), nullable=False)
    target_id: Mapped[str] = mapped_column(String(100), nullable=False)
    details: Mapped[dict] = mapped_column(JSONB, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)


class OutboxMessage(ServiceBase, TimestampMixin):
    """Transactional outbox for platform control-plane events.

    Every module-lifecycle change (activate / suspend / archive / kill-switch)
    writes a row in the *same transaction* as the state change; a background
    relay polls pending rows and pushes them to the event bus. This is what
    makes the gate-invalidation channel (0.13) durable: a crash between the
    state commit and a direct bus publish no longer loses the event.

    Status transitions: pending -> published (relay succeeded) / dead
    (retries exhausted).
    """

    __tablename__ = "outbox_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    event_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    type: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    source_service: Mapped[str] = mapped_column(String(50), default="platform")
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
