"""Auth service Pydantic schemas — the public API surface.

These live here rather than in a shared kernel so the service owns its
contract completely. Only the token a caller receives is a cross-service
interface; everything else is internal to this service.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# ─── Password rules ─────────────────────────────────────────────────────────
#
# Enforced here so every entry point — registration, change, reset — shares
# one definition. Length is the only rule that materially matters; the rest
# exists to reject the passwords that actually show up in credential dumps.

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128

PASSWORD_FIELD = Field(
    min_length=MIN_PASSWORD_LENGTH,
    max_length=MAX_PASSWORD_LENGTH,
    description=f"{MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH} characters",
)


# ─── Tenants ────────────────────────────────────────────────────────────────

class TenantRegister(BaseModel):
    """First-run signup: creates the tenant and its owner in one transaction."""

    tenant_name: str = Field(min_length=2, max_length=200)
    tenant_slug: str = Field(min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$")
    email: EmailStr
    password: str = PASSWORD_FIELD
    full_name: str = Field(min_length=1, max_length=200)


class TenantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    slug: str
    status: str
    plan: str
    created_at: datetime


# ─── Users ──────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str = PASSWORD_FIELD
    full_name: str = Field(min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    role_slugs: list[str] = Field(default_factory=list)
    is_tenant_owner: bool = False


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    full_name: str
    phone: str | None = None
    status: str
    is_tenant_owner: bool
    email_verified: bool
    last_login_at: datetime | None = None
    created_at: datetime


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    status: str | None = None


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = PASSWORD_FIELD


# ─── Roles ──────────────────────────────────────────────────────────────────

class RoleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9_:*-]+$")
    description: str | None = Field(default=None, max_length=500)
    permissions: list[str] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    permissions: list[str] | None = None
    is_active: bool | None = None


class RoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    slug: str
    description: str | None = None
    permissions: list[str]
    is_system: bool
    is_active: bool


class RoleAssign(BaseModel):
    """Grant a role. ``outlet_id=None`` means every outlet in the tenant."""

    role_slug: str = Field(min_length=1, max_length=100)
    outlet_id: uuid.UUID | None = None


# ─── Tokens ─────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)
    tenant_slug: str | None = Field(
        default=None,
        description="Only needed when the same email exists in more than one tenant.",
    )
    outlet_id: uuid.UUID | None = Field(
        default=None, description="Sets the token's active outlet."
    )
    mfa_code: str | None = Field(
        default=None,
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        description="Required when MFA is enabled for this user.",
    )


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access-token lifetime in seconds")


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class TokenClaims(BaseModel):
    """Decoded token, for debugging. Never returned on the auth path."""

    sub: uuid.UUID
    tenant_id: uuid.UUID
    email: str | None = None
    full_name: str | None = None
    roles: list[str] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)
    is_tenant_owner: bool = False
    tenant_slug: str | None = None
    active_outlet_id: uuid.UUID | None = None
    allowed_outlet_ids: list[uuid.UUID] = Field(default_factory=list)
    exp: datetime | None = None


# ─── MFA ────────────────────────────────────────────────────────────────────

class MfaEnrollResponse(BaseModel):
    """First half of a two-step MFA enable. ``secret`` is shown once —
    present it as a QR code to the user; it is not re-fetchable from
    anywhere else in the system. ``provisioning_uri`` is a ``otpauth://``
    link an authenticator app can deep-link-import directly."""
    secret: str
    provisioning_uri: str
    mfa_enabled: bool = False  # stays off until /me/mfa/verify succeeds


class MfaVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class MfaDisableRequest(BaseModel):
    current_code: str | None = Field(
        default=None,
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        description="A valid current TOTP code; required to turn MFA off while it is on.",
    )


class MfaStatusResponse(BaseModel):
    mfa_enabled: bool
    has_secret: bool
    last_verified_at: datetime | None = None


# ─── Sessions ───────────────────────────────────────────────────────────────

class SessionResponse(BaseModel):
    id: uuid.UUID
    user_agent: str | None = None
    ip_address: str | None = None
    created_at: datetime
    expires_at: datetime
    active: bool
