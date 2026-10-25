"""Schemas for Platform Control Plane & Super Admin Service."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


# ─── Auth Schemas ────────────────────────────────────────────────────────────

class PlatformLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)


class PlatformAdminResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime


class PlatformTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    admin: PlatformAdminResponse


# ─── Tenant Onboarding Schemas ──────────────────────────────────────────────

class TenantOnboardRequest(BaseModel):
    """Wizard request onboarding a new enterprise organization & tenant."""
    name: str = Field(..., min_length=2, max_length=200)
    slug: str = Field(..., min_length=2, max_length=100)
    vertical: str = Field("restaurant", description="Primary vertical: restaurant, salon, gym, retail, clinic, carwash")
    enabled_modules: list[str] = Field(default_factory=lambda: ["restaurant"])
    plan: str = Field("pro", description="starter, pro, enterprise")
    contact_email: EmailStr
    contact_phone: str | None = None
    initial_branch_name: str = "Main Branch"
    initial_branch_code: str = "MAIN"
    owner_name: str = "Owner Admin"
    owner_email: EmailStr
    owner_password: str = Field(..., min_length=8)
    initial_settings: dict[str, Any] = Field(default_factory=dict)


class TenantOnboardResponse(BaseModel):
    tenant_id: uuid.UUID
    organization_id: uuid.UUID
    outlet_id: uuid.UUID
    slug: str
    name: str
    vertical: str
    active_modules: list[str]
    owner_email: str
    created_at: datetime


class TenantSummaryResponse(BaseModel):
    tenant_id: uuid.UUID
    name: str
    slug: str
    status: str
    plan: str
    contact_email: str | None = None
    active_modules: list[str]
    module_versions: dict[str, str] = Field(default_factory=dict)
    created_at: datetime


# ─── Module Lifecycle Schemas ────────────────────────────────────────────────

class ModuleLifecycleRequest(BaseModel):
    config: dict[str, Any] = Field(default_factory=dict)


class TenantModuleStateResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    plugin_id: str
    state: str
    activated_version: str
    schema_version: str
    config: dict[str, Any]
    activated_at: datetime | None = None
    suspended_at: datetime | None = None
    archived_at: datetime | None = None


class PluginManifestResponse(BaseModel):
    id: str
    name: str
    version: str
    category: str
    description: str | None = None
    icon: str
    required_capabilities: list[str]
    permissions: list[str]
    navigation: list[dict[str, Any]]
    settings_schema: dict[str, Any]
    is_system: bool
    is_active: bool
    # Whether the API gateway enforces this module's per-tenant state.
    # Core verticals without a descriptor entry report False: a kill-switch
    # row exists, but nothing gates on it until a gateway descriptor is added.
    gated: bool = False


# ─── Permissions & Policies ─────────────────────────────────────────────────

class PermissionItem(BaseModel):
    code: str
    module: str
    name: str
    description: str | None = None
    tier: int
    is_system: bool


class PermissionCreateRequest(BaseModel):
    code: str = Field(..., pattern=r"^[a-z0-9_]+:[a-z0-9_]+:[a-z0-9_]+$")
    module: str
    name: str
    description: str | None = None
    tier: int = 3


class AccessPolicyCreateRequest(BaseModel):
    tenant_id: uuid.UUID | None = None
    subject: dict[str, Any]
    module: str
    resource: str
    operation: str
    effect: str = Field("allow", pattern=r"^(allow|deny|mask|limit)$")
    params: dict[str, Any] = Field(default_factory=dict)
    condition: dict[str, Any] | None = None
    priority: int = 100


class AccessPolicyResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID | None
    subject: dict[str, Any]
    module: str
    resource: str
    operation: str
    effect: str
    params: dict[str, Any]
    condition: dict[str, Any] | None
    priority: int
    created_at: datetime


# ─── Audit Trail ─────────────────────────────────────────────────────────────

class AuditEntryResponse(BaseModel):
    id: uuid.UUID
    admin_id: uuid.UUID | None
    admin_email: str
    action: str
    target_type: str
    target_id: str
    details: dict[str, Any]
    ip_address: str | None = None
    created_at: datetime


class AuditListResponse(BaseModel):
    items: list[AuditEntryResponse]
    total: int
    has_more: bool


# ─── Admin Users ────────────────────────────────────────────────────────────

class AdminCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=1, max_length=200)
    role: str = Field(
        "ops_admin",
        description="super_admin | ops_admin | support_admin | billing_admin",
    )


class AdminUpdateRequest(BaseModel):
    is_active: bool | None = None
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    role: str | None = Field(
        default=None,
        description="super_admin | ops_admin | support_admin | billing_admin",
    )


class AdminListResponse(BaseModel):
    items: list[PlatformAdminResponse]
    total: int


# ─── Tenant Roster ───────────────────────────────────────────────────────────

class TenantRosterItem(BaseModel):
    """One row of the full tenant roster, enriched with platform-managed state."""
    id: uuid.UUID
    name: str
    slug: str
    status: str
    plan: str
    created_at: datetime
    # Set when this tenant is under platform module management: active_modules
    # reflects the platform DB's TenantModuleState rows.
    active_modules: list[str] = Field(default_factory=list)
    module_versions: dict[str, str] = Field(default_factory=dict)
    is_managed: bool = False


class TenantRosterResponse(BaseModel):
    items: list[TenantRosterItem]
    total: int


# ─── Fleet Telemetry ────────────────────────────────────────────────────────

class ServiceHealthStatus(BaseModel):
    service: str
    port: int
    status: str
    latency_ms: float | None = None
    database: str = "unknown"
    error: str | None = None


class FleetHealthReport(BaseModel):
    overall_status: str
    services_up: int
    services_total: int
    services: list[ServiceHealthStatus]
    checked_at: datetime
