import base64
import json
import uuid
from datetime import datetime, timedelta, timezone
import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
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
        avatar_initials="".join(part[0].upper() for part in payload.admin_name.split()[:2]),
        status=UserStatus.SUSPENDED,
        is_tenant_owner=True,
    )
    db.add(admin)
    await db.flush()
    db.add(UserRole(user_id=admin.id, role_id=super_role.id, is_default=True))

    company = Company(
        tenant_id=tenant.id,
        name=payload.company_name,
        legal_name=payload.company_name,
        logo_initials="".join(part[0].upper() for part in payload.company_name.split()[:2]),
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

    if user.status.value in ("suspended", "inactive") or (user.tenant and user.tenant.status.value == "suspended"):
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
        await db.flush()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.status.value != "active":
        raise HTTPException(status_code=403, detail="User account is not active")

    if user.tenant.status.value in ("suspended", "cancelled"):
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
        tenant_slug=ctx.user.tenant.slug,
        is_tenant_owner=ctx.user.is_tenant_owner,
        permissions=sorted(ctx.permissions),
        roles=roles,
    )



