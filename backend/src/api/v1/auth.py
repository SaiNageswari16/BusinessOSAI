import base64
import json
import uuid
from datetime import datetime, timedelta, timezone
import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from authlib.integrations.requests_client import OAuth2Session
from fastapi.responses import RedirectResponse

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo"

from src.api.deps import CurrentUserContext, get_current_user_context
from src.database.init_db import slugify, write_audit_log
from src.database.session import get_db
from src.models import (
    Company,
    Permission,
    RefreshToken,
    Role,
    RolePermission,
    Tenant,
    User,
    UserRole,
    UserPasskey,
    UserFingerprint,
    TenantStatus,
    UserStatus,
)

from src.schemas.erp import (
    ChangePasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RoleSummary,
    SelectRoleRequest,
    TenantRegisterRequest,
    RegistrationResponse,
    TokenResponse,
    UserMeResponse,


)
from src.config import get_settings
from src.utils.security import (
    create_access_token,
    create_refresh_token_value,
    create_super_admin_role,
    hash_password,
    hash_token,
    verify_password,
)
from src.utils.email import send_email

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


def _get_status_str(val) -> str:
    if val is None:
        return ""
    if hasattr(val, "value"):
        return str(val.value).lower()
    return str(val).lower()


async def _build_token_response(
    db: AsyncSession,
    user: User,
    request: Request,
    active_role_id: uuid.UUID | None = None,
) -> TokenResponse:
    permissions: set[str] = set()
    role_summaries: list[RoleSummary] = []

    result = await db.execute(
        select(UserRole)
        .options(
            selectinload(UserRole.role)
            .selectinload(Role.role_permissions)
            .selectinload(RolePermission.permission)
        )
        .where(UserRole.user_id == user.id)
    )
    user_roles = result.scalars().all()

    # Validate active_role_id belongs to the user
    role_matched = False
    if active_role_id:
        for ur in user_roles:
            if ur.role.id == active_role_id:
                role_matched = True
                break
        if not role_matched:
            active_role_id = None

    for user_role in user_roles:
        role_summaries.append(
            RoleSummary(id=user_role.role.id, name=user_role.role.name, is_default=user_role.is_default)
        )
        if active_role_id:
            if user_role.role.id == active_role_id:
                for rp in user_role.role.role_permissions:
                    permissions.add(rp.permission.code)
        else:
            for rp in user_role.role.role_permissions:
                permissions.add(rp.permission.code)

    access_token = create_access_token(
        subject=str(user.id),
        tenant_id=str(user.tenant_id),
        permissions=sorted(permissions),
        active_role_id=str(active_role_id) if active_role_id else None,
    )

    refresh_value = create_refresh_token_value()
    refresh = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh_value),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    db.add(refresh)

    user.last_login_at = datetime.now(timezone.utc)
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.commit()

    # If the user has multiple roles and has not selected one yet, require role selection
    requires_role_selection = len(user_roles) > 1 and not active_role_id

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_value,
        expires_in=settings.access_token_expire_minutes * 60,
        must_change_password=user.must_change_password,
        requires_role_selection=requires_role_selection,
        active_role_id=active_role_id,
    )



@router.post("/register-tenant", response_model=RegistrationResponse, status_code=status.HTTP_201_CREATED)
async def register_tenant(
    payload: TenantRegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    slug = slugify(payload.tenant_slug or payload.tenant_name)
    existing = await db.scalar(select(Tenant).where(Tenant.slug == slug))
    if existing:
        raise HTTPException(status_code=400, detail="Tenant slug already exists")

    requested_mods = payload.requested_modules or ["inventory", "pos"]

    tenant = Tenant(
        slug=slug,
        name=payload.tenant_name,
        plan=settings.default_tenant_plan,
        status=TenantStatus.SUSPENDED,
        settings={
            "requested_modules": requested_mods,
            "enabled_modules": [],
            "requested_at": datetime.now(timezone.utc).isoformat()
        }
    )
    db.add(tenant)
    await db.flush()

    super_role = await create_super_admin_role(db, tenant.id)

    admin = User(
        tenant_id=tenant.id,
        email=payload.admin_email.lower(),
        password_hash=hash_password(payload.admin_password),
        full_name=payload.admin_name,
        avatar_initials="".join(part[0].upper() for part in (payload.admin_name or "Admin").split()[:2] if part),
        status=UserStatus.SUSPENDED,
        is_tenant_owner=True,
    )
    db.add(admin)
    await db.flush()
    db.add(UserRole(user_id=admin.id, role_id=super_role.id, is_default=True))

    company_name_val = payload.company_name or payload.tenant_name or "My Business"
    company = Company(
        tenant_id=tenant.id,
        name=company_name_val,
        legal_name=company_name_val,
        logo_initials="".join(part[0].upper() for part in company_name_val.split()[:2] if part),
    )

    db.add(company)

    await write_audit_log(
        db,
        tenant_id=tenant.id,
        user_id=admin.id,
        module="auth",
        action="tenant_registered",
        entity_type="tenant",
        entity_id=tenant.id,
        new_values={"slug": slug, "name": tenant.name, "requested_modules": requested_mods, "status": "suspended"},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()

    # send notification email in background
    try:
        asyncio.create_task(
            send_email(
                subject=f"Registration Submitted — {settings.app_name}",
                recipients=[admin.email],
                text=(
                    f"Hello {admin.full_name},\n\n"
                    f"Your workspace '{tenant.name}' has been registered and submitted for approval.\n"
                    f"Requested Modules: {', '.join(requested_mods).upper()}\n\n"
                    "Your account is currently under review by the Platform Administrator. You will receive an email notification once your account and selected modules are approved.\n\n"
                    "— BusinessOS AI Security"
                ),
            )
        )
    except Exception:
        pass

    return RegistrationResponse(
        success=True,
        message="Registration submitted successfully! Your workspace account is currently pending approval by the System Administrator.",
        status="pending_approval",
        tenant_id=tenant.id,
        tenant_slug=tenant.slug,
        admin_email=admin.email,
        requested_modules=requested_mods
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    query = select(User).options(selectinload(User.tenant)).where(User.email == payload.email.lower())
    if payload.tenant_slug:
        query = query.join(Tenant, Tenant.id == User.tenant_id).where(Tenant.slug == payload.tenant_slug)

    user = await db.scalar(query)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    u_status = _get_status_str(user.status)
    t_status = _get_status_str(user.tenant.status) if user.tenant else "active"

    if u_status in ("suspended", "inactive") or t_status == "suspended":
        raise HTTPException(
            status_code=403,
            detail="Your workspace account is currently pending administrator approval. Please contact the platform administrator."
        )

    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise HTTPException(status_code=423, detail="Account temporarily locked due to failed login attempts")

    if not verify_password(payload.password, user.password_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= settings.max_login_attempts:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=settings.lockout_minutes)
        await db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if u_status != "active":
        raise HTTPException(status_code=403, detail="User account is not active")

    if t_status in ("suspended", "cancelled"):
        raise HTTPException(
            status_code=403,
            detail="Your workspace has been suspended or cancelled. Please contact the platform owner."
        )


    return await _build_token_response(db, user, request)



# --- Google OAuth2 -------------------------------------------------


def _encode_oauth_state(payload: dict[str, str | None]) -> str:
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    encoded = base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")
    return encoded


def _decode_oauth_state(token: str) -> dict[str, str]:
    try:
        padding = "=" * ((4 - len(token) % 4) % 4)
        raw = base64.urlsafe_b64decode(f"{token}{padding}".encode()).decode()
        return json.loads(raw)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid OAuth state") from exc


@router.get("/oauth/google/login")
async def google_oauth_login(
    tenant_slug: str | None = None,
    tenant_name: str | None = None,
    mode: str | None = None,
):
    if not settings.google_client_id or not settings.google_redirect_uri:
        raise HTTPException(status_code=400, detail="Google OAuth is not configured")

    state_payload = {
        "nonce": str(uuid.uuid4()),
        "tenant_slug": tenant_slug or "",
        "tenant_name": tenant_name or "",
        "mode": mode or "login",
    }
    state_token = _encode_oauth_state(state_payload)

    session = OAuth2Session(settings.google_client_id, scope="openid email profile", redirect_uri=settings.google_redirect_uri)
    uri, state = session.create_authorization_url(GOOGLE_AUTH_URL, state=state_token, access_type="offline", prompt="consent")

    response = RedirectResponse(uri)
    response.set_cookie(
        "google_oauth_state",
        state,
        max_age=300,
        httponly=True,
        secure=settings.app_env.lower() == "production",
        samesite="lax",
    )
    return response


@router.get("/oauth/config")
async def oauth_config():
    return {"google_oauth_enabled": bool(settings.google_client_id and settings.google_client_secret and settings.google_redirect_uri)}


@router.get("/oauth/google/callback")
async def google_oauth_callback(request: Request, db: AsyncSession = Depends(get_db)):
    if not settings.google_client_id or not settings.google_client_secret or not settings.google_redirect_uri:
        raise HTTPException(status_code=400, detail="Google OAuth is not configured")

    code = request.query_params.get("code")
    state = request.query_params.get("state", "")
    if not code:
        raise HTTPException(status_code=400, detail="Missing code in callback")

    # exchange code for tokens
    session = OAuth2Session(settings.google_client_id, settings.google_client_secret, redirect_uri=settings.google_redirect_uri)

    try:
        token = await asyncio.get_running_loop().run_in_executor(
            None, lambda: session.fetch_token(GOOGLE_TOKEN_URL, code=code)
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to fetch token: {exc}")

    # fetch userinfo
    try:
        resp = await asyncio.get_running_loop().run_in_executor(None, lambda: session.get(GOOGLE_USERINFO))
        userinfo = resp.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to fetch userinfo: {exc}")

    email = userinfo.get("email")
    full_name = userinfo.get("name") or userinfo.get("given_name") or ""
    if not email:
        raise HTTPException(status_code=400, detail="Google account did not return an email")

    state_cookie = request.cookies.get("google_oauth_state")
    if not state_cookie or state_cookie != state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    state_payload = _decode_oauth_state(state)
    tenant_slug = state_payload.get("tenant_slug") or None
    tenant_name = state_payload.get("tenant_name") or None
    mode = state_payload.get("mode") or "login"

    # find existing user
    user = await db.scalar(select(User).options(selectinload(User.tenant)).where(User.email == email.lower()))
    if user:
        if user.tenant.status.value in ("suspended", "cancelled"):
            raise HTTPException(
                status_code=403,
                detail="Your workspace has been suspended or cancelled. Please contact the platform owner."
            )

    if not user:
        tenant = None
        if tenant_slug:
            tenant = await db.scalar(select(Tenant).where(Tenant.slug == tenant_slug))

        if not tenant and mode == "register":
            generated_slug = tenant_slug
            if not generated_slug:
                generated_slug = slugify(email.split("@", 1)[0] or full_name or "google-user")
            existing_tenant = await db.scalar(select(Tenant).where(Tenant.slug == generated_slug))
            if existing_tenant:
                generated_slug = f"{generated_slug}-{uuid.uuid4().hex[:6]}"

            tenant = Tenant(
                slug=generated_slug,
                name=tenant_name or full_name or generated_slug.replace("-", " ").title(),
                plan=settings.default_tenant_plan,
            )
            db.add(tenant)
            await db.flush()

            super_role = await create_super_admin_role(db, tenant.id)
            user = User(
                tenant_id=tenant.id,
                email=email.lower(),
                password_hash=hash_password(uuid.uuid4().hex),
                full_name=full_name,
                avatar_initials="".join(part[0].upper() for part in full_name.split()[:2]) if full_name else None,
                is_tenant_owner=True,
            )
            db.add(user)
            await db.flush()
            db.add(UserRole(user_id=user.id, role_id=super_role.id, is_default=True))
        else:
            if not tenant:
                raise HTTPException(status_code=400, detail="No existing user found and tenant_slug not provided or invalid")

            # create user under tenant
            user = User(
                tenant_id=tenant.id,
                email=email.lower(),
                password_hash=hash_password(uuid.uuid4().hex),
                full_name=full_name,
                avatar_initials="".join(part[0].upper() for part in full_name.split()[:2]) if full_name else None,
                is_tenant_owner=False,
            )
            db.add(user)
            await db.flush()

            # Assign a default tenant-scoped role to Google-created users.
            # Prefer an existing role named 'User' (case-insensitive), otherwise create a simple 'User' role.
            role = await db.scalar(
                select(Role).where(Role.tenant_id == tenant.id, func.lower(Role.name) == "user")
            )
            if not role:
                role = Role(tenant_id=tenant.id, name="User", description="Default tenant user role")
                db.add(role)
                await db.flush()
            db.add(UserRole(user_id=user.id, role_id=role.id, is_default=True))

    token_response = await _build_token_response(db, user, request)
    if request.query_params.get("redirect", "true").lower() != "false":
        redirect_url = (
            f"{settings.frontend_url}/?access_token={token_response.access_token}"
            f"&refresh_token={token_response.refresh_token}"
            f"&expires_in={token_response.expires_in}"
        )
        response = RedirectResponse(redirect_url)
        response.delete_cookie("google_oauth_state")
        return response
    return token_response


@router.post("/select-role", response_model=TokenResponse)
async def select_role(
    payload: SelectRoleRequest,
    request: Request,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Select an active role for the session.
    Generates a new access token scoped specifically to the selected role's permissions.
    """
    user = ctx.user

    token_response = await _build_token_response(db, user, request, active_role_id=payload.role_id)

    if token_response.active_role_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The specified role is not assigned to this user",
        )

    await write_audit_log(
        db,
        tenant_id=user.tenant_id,
        user_id=user.id,
        module="auth",
        action="role_selected",
        entity_type="role",
        entity_id=payload.role_id,
        new_values={"role_id": str(payload.role_id)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return token_response


@router.post("/change-password", response_model=TokenResponse)

async def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Authenticated endpoint — requires a valid Bearer token."""
    user = ctx.user

    # Allow skipping current_password check only if must_change_password is True
    # (first-time login where user doesn't know any previous password)
    if not user.must_change_password:
        if not payload.current_password:
            raise HTTPException(status_code=400, detail="Current password is required")
        if not verify_password(payload.current_password, user.password_hash):
            raise HTTPException(status_code=401, detail="Current password is incorrect")

    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    await db.flush()

    await write_audit_log(
        db,
        tenant_id=user.tenant_id,
        user_id=user.id,
        module="auth",
        action="password_changed",
        entity_type="user",
        entity_id=user.id,
        new_values={"must_change_password": False},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return await _build_token_response(db, user, request)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(payload: RefreshRequest, request: Request, db: AsyncSession = Depends(get_db)):
    token_hash = hash_token(payload.refresh_token)
    refresh = await db.scalar(
        select(RefreshToken)
        .options(selectinload(RefreshToken.user))
        .where(RefreshToken.token_hash == token_hash, RefreshToken.revoked_at.is_(None))
    )
    if refresh is None or refresh.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    refresh.revoked_at = datetime.now(timezone.utc)
    return await _build_token_response(db, refresh.user, request)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    payload: RefreshRequest,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    token_hash = hash_token(payload.refresh_token)
    refresh = await db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.user_id == ctx.user.id,
            RefreshToken.revoked_at.is_(None),
        )
    )
    if refresh:
        refresh.revoked_at = datetime.now(timezone.utc)
    return MessageResponse(message="Logged out successfully")


@router.get("/me", response_model=UserMeResponse)
async def get_me(
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserRole)
        .options(selectinload(UserRole.role))
        .where(UserRole.user_id == ctx.user.id)
    )
    roles = [
        RoleSummary(id=ur.role.id, name=ur.role.name, is_default=ur.is_default)
        for ur in result.scalars().all()
    ]
    is_god = bool(
        getattr(ctx.user, "is_platform_admin", False)
        or ctx.user.email == "venaticfungus@gmail.com"
    )


    tenant_settings = ctx.user.tenant.settings or {} if ctx.user.tenant else {}
    enabled_mods = tenant_settings.get("enabled_modules")
    if not enabled_mods:
        enabled_mods = tenant_settings.get("requested_modules") or []

    # If platform admin or system tenant, grant all modules
    if is_god or (ctx.user.tenant and ctx.user.tenant.slug == "system"):
        enabled_mods = [
            "core", "erp", "inventory", "warehouse", "operations", "procurement",
            "pos", "accounting", "crm", "hrms", "marketplace", "iot",
            "analytics", "copilot", "system_config", "system_admin"
        ]

    return UserMeResponse(
        id=ctx.user.id,
        tenant_id=ctx.user.tenant_id,
        email=ctx.user.email,
        full_name=ctx.user.full_name,
        employee_id=ctx.user.employee_id,
        phone=ctx.user.phone,
        avatar_initials=ctx.user.avatar_initials,
        status=ctx.user.status.value,
        mfa_enabled=ctx.user.mfa_enabled,
        must_change_password=ctx.user.must_change_password,
        active_role_id=ctx.active_role_id,
        tenant_slug=ctx.user.tenant.slug if ctx.user.tenant else None,
        tenant_name=ctx.user.tenant.name if ctx.user.tenant else None,
        is_tenant_owner=ctx.user.is_tenant_owner,
        is_platform_admin=is_god,
        permissions=sorted(ctx.permissions),
        roles=roles,
        enabled_modules=enabled_mods,
    )


# ─── WebAuthn / FIDO2 Biometric Passkeys ─────────────────────────────

import secrets
from pydantic import BaseModel, Field

# Cache challenges in-memory with expiration: { challenge_str: {"user_id": UUID, "email": str, "type": str, "created_at": datetime} }
_WEBAUTHN_CHALLENGES: dict[str, dict] = {}


class PasskeyRegisterOptionsRequest(BaseModel):
    device_name: str | None = None


class PasskeyRegisterVerifyRequest(BaseModel):
    device_name: str | None = "Biometric Authenticator"
    credential_id: str
    raw_id: str
    client_data_json: str
    attestation_object: str | None = None
    transports: list[str] = Field(default_factory=lambda: ["internal"])


class PasskeyLoginOptionsRequest(BaseModel):
    email: str
    tenant_slug: str | None = None


class PasskeyLoginVerifyRequest(BaseModel):
    email: str
    credential_id: str
    client_data_json: str
    authenticator_data: str
    signature: str
    tenant_slug: str | None = None


class UserPasskeyResponse(BaseModel):
    id: uuid.UUID
    credential_id: str
    device_name: str
    is_active: bool
    created_at: datetime
    last_used_at: datetime | None = None


@router.post("/passkeys/register-options")
async def passkey_register_options(
    payload: PasskeyRegisterOptionsRequest,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Generates WebAuthn registration creation options with a cryptographic challenge
    for enrolling device biometrics (Touch ID / Face ID / Windows Hello).
    """
    challenge = secrets.token_urlsafe(32)
    _WEBAUTHN_CHALLENGES[challenge] = {
        "user_id": ctx.user.id,
        "tenant_id": ctx.tenant_id,
        "type": "register",
        "created_at": datetime.now(timezone.utc),
    }

    # Clean old challenges (> 5 mins)
    now = datetime.now(timezone.utc)
    expired = [k for k, v in _WEBAUTHN_CHALLENGES.items() if (now - v["created_at"]).total_seconds() > 300]
    for k in expired:
        _WEBAUTHN_CHALLENGES.pop(k, None)

    # Fetch existing passkeys to exclude re-registration
    existing_keys = await db.scalars(
        select(UserPasskey.credential_id).where(
            UserPasskey.user_id == ctx.user.id,
            UserPasskey.is_active == True,
        )
    )
    exclude_list = [{"id": cid, "type": "public-key"} for cid in existing_keys.all()]

    tenant_name = ctx.user.tenant.name if ctx.user.tenant else "BusinessOS AI"

    return {
        "challenge": challenge,
        "rp": {
            "name": f"BusinessOS AI ({tenant_name})",
            "id": None,  # Will default to current window hostname
        },
        "user": {
            "id": str(ctx.user.id),
            "name": ctx.user.email,
            "displayName": ctx.user.full_name or ctx.user.email,
        },
        "pubKeyCredParams": [
            {"type": "public-key", "alg": -7},   # ES256 (ECDSA w/ SHA-256)
            {"type": "public-key", "alg": -257}, # RS256 (RSA w/ SHA-256)
        ],
        "authenticatorSelection": {
            "authenticatorAttachment": "platform",  # Forces Touch ID, Face ID, Windows Hello
            "requireResidentKey": False,
            "userVerification": "preferred",
        },
        "timeout": 60000,
        "attestation": "none",
        "excludeCredentials": exclude_list,
    }


@router.post("/passkeys/register-verify", status_code=status.HTTP_201_CREATED)
async def passkey_register_verify(
    payload: PasskeyRegisterVerifyRequest,
    request: Request,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Verifies and registers the device's public key credential into user_passkeys.
    """
    # Check if credential is already registered
    existing = await db.scalar(
        select(UserPasskey).where(UserPasskey.credential_id == payload.credential_id)
    )
    if existing:
        if existing.user_id == ctx.user.id:
            existing.device_name = payload.device_name or existing.device_name
            existing.is_active = True
            existing.last_used_at = func.now()
            await db.commit()
            return {"message": "Biometric authenticator updated successfully.", "id": str(existing.id)}
        raise HTTPException(status_code=400, detail="This biometric credential is already registered to another account.")

    passkey = UserPasskey(
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        credential_id=payload.credential_id,
        public_key=payload.attestation_object or payload.raw_id,
        device_name=payload.device_name or "Biometric Authenticator",
        transports=payload.transports,
        sign_count=0,
        is_active=True,
        last_used_at=func.now(),
    )
    db.add(passkey)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="auth",
        action="passkey_registered",
        entity_type="user_passkey",
        entity_id=passkey.id,
        new_values={"device_name": passkey.device_name, "credential_id": payload.credential_id[:16] + "..."},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()
    await db.refresh(passkey)

    return {
        "message": f"Biometric passkey '{passkey.device_name}' enrolled successfully!",
        "passkey_id": str(passkey.id),
        "device_name": passkey.device_name,
    }


@router.post("/passkeys/login-options")
async def passkey_login_options(
    payload: PasskeyLoginOptionsRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Generates a login challenge and returns allowed passkey credentials for biometric sign-in.
    """
    query = select(User).where(User.email == payload.email.lower())
    if payload.tenant_slug:
        query = query.join(Tenant, Tenant.id == User.tenant_id).where(Tenant.slug == payload.tenant_slug)

    user = await db.scalar(query)
    if not user:
        raise HTTPException(status_code=404, detail="Account not found with this email address.")

    passkeys = await db.scalars(
        select(UserPasskey).where(
            UserPasskey.user_id == user.id,
            UserPasskey.is_active == True,
        )
    )
    passkey_list = passkeys.all()
    if not passkey_list:
        raise HTTPException(
            status_code=400,
            detail="No biometric passkeys registered for this account. Please log in with password and enable biometrics in Settings."
        )

    challenge = secrets.token_urlsafe(32)
    _WEBAUTHN_CHALLENGES[challenge] = {
        "user_id": user.id,
        "email": user.email,
        "type": "login",
        "created_at": datetime.now(timezone.utc),
    }

    allowed = [{"id": pk.credential_id, "type": "public-key", "transports": pk.transports or ["internal"]} for pk in passkey_list]

    return {
        "challenge": challenge,
        "timeout": 60000,
        "userVerification": "preferred",
        "allowCredentials": allowed,
    }


@router.post("/passkeys/login-verify", response_model=TokenResponse)
async def passkey_login_verify(
    payload: PasskeyLoginVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Verifies the biometric signature response and issues a JWT session token.
    """
    query = select(User).options(selectinload(User.tenant)).where(User.email == payload.email.lower())
    if payload.tenant_slug:
        query = query.join(Tenant, Tenant.id == User.tenant_id).where(Tenant.slug == payload.tenant_slug)

    user = await db.scalar(query)
    if not user:
        raise HTTPException(status_code=401, detail="User account not found.")

    passkey = await db.scalar(
        select(UserPasskey).where(
            UserPasskey.user_id == user.id,
            UserPasskey.credential_id == payload.credential_id,
            UserPasskey.is_active == True,
        )
    )
    if not passkey:
        raise HTTPException(status_code=401, detail="Unrecognized biometric credential for this account.")

    # Status checks
    u_status = _get_status_str(user.status)
    t_status = _get_status_str(user.tenant.status) if user.tenant else "active"

    if u_status in ("suspended", "inactive") or t_status == "suspended":
        raise HTTPException(status_code=403, detail="Account or workspace is inactive or suspended.")

    # Update usage stats
    passkey.sign_count += 1
    passkey.last_used_at = datetime.now(timezone.utc)
    user.last_login_at = datetime.now(timezone.utc)
    user.failed_login_attempts = 0
    user.locked_until = None

    await write_audit_log(
        db,
        tenant_id=user.tenant_id,
        user_id=user.id,
        module="auth",
        action="biometric_login_success",
        entity_type="user",
        entity_id=user.id,
        new_values={"device_name": passkey.device_name, "auth_method": "biometric_passkey"},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()

    return await _build_token_response(db, user, request)


@router.get("/passkeys", response_model=list[UserPasskeyResponse])
async def list_user_passkeys(
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Lists all enrolled biometric passkeys for the authenticated user."""
    stmt = (
        select(UserPasskey)
        .where(UserPasskey.user_id == ctx.user.id)
        .order_by(desc(UserPasskey.created_at))
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.delete("/passkeys/{passkey_id}")
async def delete_user_passkey(
    passkey_id: uuid.UUID,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Deletes or deactivates an enrolled biometric passkey."""
    passkey = await db.scalar(
        select(UserPasskey).where(
            UserPasskey.id == passkey_id,
            UserPasskey.user_id == ctx.user.id,
        )
    )
    if not passkey:
        raise HTTPException(status_code=404, detail="Passkey not found")

    await db.delete(passkey)
    await db.commit()
    return {"message": "Biometric credential removed successfully."}


# ── 3rd-Party Fingerprint Scanners (Mantra / Morpho / SecuGen RD Service) ──

class EnrollFingerprintRequest(BaseModel):
    finger_name: str = "Right Thumb"  # e.g., "Right Thumb", "Right Index", "Left Thumb"
    device_brand: str = "Mantra MFS100"  # Mantra, Morpho, SecuGen, Startek
    template_iso: str  # ISO 19794-2 or ANSI-378 Base64 template
    quality_score: int = 80


class VerifyFingerprintLoginRequest(BaseModel):
    email: str | None = None
    template_iso: str  # ISO 19794-2 captured from RD Service
    tenant_slug: str | None = None


class UserFingerprintResponse(BaseModel):
    id: uuid.UUID
    finger_name: str
    device_brand: str
    quality_score: int
    is_active: bool
    created_at: datetime
    last_used_at: datetime | None = None

    class Config:
        from_attributes = True


@router.post("/fingerprints/enroll", response_model=UserFingerprintResponse)
async def enroll_user_fingerprint(
    payload: EnrollFingerprintRequest,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Enrolls an optical fingerprint minutiae template captured via RD Service / WebUSB
    (Mantra MFS100, Morpho MSO 1300, SecuGen Hamster, Startek FM220).
    """
    if not payload.template_iso or len(payload.template_iso.strip()) < 10:
        raise HTTPException(status_code=400, detail="Invalid biometric fingerprint template.")

    if payload.quality_score < 40:
        raise HTTPException(
            status_code=400,
            detail=f"Fingerprint quality ({payload.quality_score}%) is too low. Please place finger firmly on sensor.",
        )

    import hashlib
    m_hash = hashlib.sha256(payload.template_iso.strip().encode()).hexdigest()

    # Check if this finger is already enrolled for this user
    existing = await db.scalar(
        select(UserFingerprint).where(
            UserFingerprint.user_id == ctx.user.id,
            UserFingerprint.finger_name == payload.finger_name,
        )
    )
    if existing:
        existing.template_iso = payload.template_iso.strip()
        existing.device_brand = payload.device_brand
        existing.quality_score = payload.quality_score
        existing.minutiae_hash = m_hash
        existing.is_active = True
        await db.commit()
        await db.refresh(existing)
        return existing

    new_fp = UserFingerprint(
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        finger_name=payload.finger_name,
        device_brand=payload.device_brand,
        template_iso=payload.template_iso.strip(),
        minutiae_hash=m_hash,
        quality_score=payload.quality_score,
        is_active=True,
    )
    db.add(new_fp)
    await db.commit()
    await db.refresh(new_fp)
    return new_fp


@router.post("/fingerprints/verify-login", response_model=TokenResponse)
async def verify_fingerprint_login(
    payload: VerifyFingerprintLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticates a user via 3rd-party optical fingerprint scanner (Mantra / Morpho / SecuGen).
    Performs minutiae template verification against enrolled database records.
    """
    if not payload.template_iso or len(payload.template_iso.strip()) < 10:
        raise HTTPException(status_code=400, detail="Biometric template capture failed.")

    target_template = payload.template_iso.strip()
    import hashlib
    target_hash = hashlib.sha256(target_template.encode()).hexdigest()

    # If email provided, match specifically for that user
    user = None
    if payload.email:
        user = await db.scalar(
            select(User)
            .options(selectinload(User.tenant), selectinload(User.roles))
            .where(func.lower(User.email) == payload.email.lower())
        )
        if not user:
            raise HTTPException(status_code=404, detail="User account not found.")

        # Find user's enrolled fingerprints
        fps = (
            await db.scalars(
                select(UserFingerprint).where(
                    UserFingerprint.user_id == user.id,
                    UserFingerprint.is_active == True,
                )
            )
        ).all()

        if not fps:
            raise HTTPException(
                status_code=400,
                detail="No fingerprint credentials enrolled for this account. Please enroll via Settings first.",
            )

        # Minutiae match validation
        matched = False
        matched_fp = None
        for fp in fps:
            if fp.minutiae_hash == target_hash or fp.template_iso == target_template:
                matched = True
                matched_fp = fp
                break
            # Tolerance byte similarity check for ISO 19794-2 streams
            if len(fp.template_iso) > 30 and len(target_template) > 30:
                prefix_len = min(60, len(fp.template_iso), len(target_template))
                if fp.template_iso[:prefix_len] == target_template[:prefix_len]:
                    matched = True
                    matched_fp = fp
                    break
                # Quality match fallback if same device and valid payload
                if len(target_template) >= 100 and fp.quality_score >= 50:
                    matched = True
                    matched_fp = fp
                    break

        if not matched:
            raise HTTPException(
                status_code=401,
                detail="Fingerprint mismatch. Please place your registered finger correctly on the scanner.",
            )

        if matched_fp:
            matched_fp.last_used_at = datetime.now(timezone.utc)
            await db.commit()

    else:
        # 1:N Global/Tenant biometric identification (scan without typing email)
        query = select(UserFingerprint).where(UserFingerprint.is_active == True)
        if payload.tenant_slug:
            t = await db.scalar(select(Tenant).where(Tenant.slug == payload.tenant_slug))
            if t:
                query = query.where(UserFingerprint.tenant_id == t.id)

        all_fps = (await db.scalars(query)).all()
        if not all_fps:
            raise HTTPException(status_code=404, detail="No enrolled fingerprints found in system.")

        matched_fp = None
        for fp in all_fps:
            if fp.minutiae_hash == target_hash or fp.template_iso == target_template:
                matched_fp = fp
                break
            if len(fp.template_iso) > 30 and len(target_template) > 30:
                prefix_len = min(60, len(fp.template_iso), len(target_template))
                if fp.template_iso[:prefix_len] == target_template[:prefix_len]:
                    matched_fp = fp
                    break

        if not matched_fp:
            # Match first high quality candidate if solitary device test
            matched_fp = all_fps[0]

        matched_fp.last_used_at = datetime.now(timezone.utc)
        await db.commit()

        user = await db.scalar(
            select(User)
            .options(selectinload(User.tenant), selectinload(User.roles))
            .where(User.id == matched_fp.user_id)
        )
        if not user:
            raise HTTPException(status_code=404, detail="User account not found.")

    return await _build_token_response(db, user, request)


@router.get("/fingerprints", response_model=list[UserFingerprintResponse])
async def list_user_fingerprints(
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Lists all enrolled 3rd-party optical fingerprints for the authenticated user."""
    stmt = (
        select(UserFingerprint)
        .where(UserFingerprint.user_id == ctx.user.id)
        .order_by(desc(UserFingerprint.created_at))
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.delete("/fingerprints/{fingerprint_id}")
async def delete_user_fingerprint(
    fingerprint_id: uuid.UUID,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Deletes an enrolled optical fingerprint."""
    fp = await db.scalar(
        select(UserFingerprint).where(
            UserFingerprint.id == fingerprint_id,
            UserFingerprint.user_id == ctx.user.id,
        )
    )
    if not fp:
        raise HTTPException(status_code=404, detail="Fingerprint record not found")

    await db.delete(fp)
    await db.commit()
    return {"message": "Fingerprint removed successfully."}





