"""Auth service — the logic behind the endpoints.

Kept out of ``api.py`` so the token issuance rules are testable without an
HTTP client, and so the ordering constraints below are visible in one place
rather than spread across handlers.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.services.auth.models import (
    RefreshToken,
    Role,
    Tenant,
    TenantStatus,
    User,
    UserRole,
    UserStatus,
    status_value,
)
from src.services.auth.permissions import DEFAULT_ROLES, derived_permissions

try:
    import pyotp
except ImportError:
    # pyotp is required for MFA; a missing install must not crash the whole
    # auth service (login/register/onboarding all import this module at startup).
    # The MFA endpoints will return a clear 503 instead of the service dying.
    pyotp = None

from src.utils.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_token,
    verify_password,
)

# A bcrypt hash of a throwaway value, used to keep the failed-login path the
# same duration as the success path. Without it, "user not found" returns in
# ~0ms and "wrong password" in ~230ms, which is a user-enumeration oracle.
#
# Generated with hash_password(), not hand-written: a hand-written hash with
# the wrong padding bits still verifies as False, but passlib warns about it
# and turns the warning into an error under Passlib 2.0.
_DUMMY_HASH = "$2b$12$fnEutMN3ZWc3KmoIGVkPdO.7VLH3VFQRLqjgDIENpK9FCRWPz1ZaC"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    """Postgres returns aware datetimes; SQLite (tests) returns naive ones.

    Comparing a naive and an aware datetime raises TypeError, so a refresh
    token read back from a test database would crash the expiry check rather
    than fail it. Normalise before comparing.
    """
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


# ─── Registration ───────────────────────────────────────────────────────────

async def register_tenant(
    db: AsyncSession,
    *,
    tenant_name: str,
    tenant_slug: str,
    email: str,
    password: str,
    full_name: str,
) -> tuple[Tenant, User]:
    """Create a tenant, its default roles, and its owner — or nothing at all.

    The caller's session commits once, so a failure partway leaves no
    half-built tenant: one without roles would have an owner who can log in
    and do nothing, which is worse than a clean failure.
    """
    slug = tenant_slug.strip().lower()
    email = email.strip().lower()

    if await db.scalar(select(Tenant.id).where(Tenant.slug == slug)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tenant slug '{slug}' is already taken",
        )

    tenant = Tenant(name=tenant_name.strip(), slug=slug, status=TenantStatus.ACTIVE)
    db.add(tenant)
    await db.flush()  # assigns tenant.id

    roles = await seed_default_roles(db, tenant.id)

    user = User(
        tenant_id=tenant.id,
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name.strip(),
        status=UserStatus.ACTIVE,
        is_tenant_owner=True,
        email_verified=False,
    )
    db.add(user)
    await db.flush()

    db.add(UserRole(
        tenant_id=tenant.id,
        user_id=user.id,
        role_id=roles["owner"].id,
    ))

    return tenant, user


async def seed_default_roles(db: AsyncSession, tenant_id: uuid.UUID) -> dict[str, Role]:
    """Create the default roles for a tenant. Idempotent.

    Existing roles are returned rather than recreated, so this is safe to call
    on a tenant that already has some — which is what makes it usable both at
    registration and from the seed script.
    """
    existing = {
        r.slug: r
        for r in (await db.execute(
            select(Role).where(Role.tenant_id == tenant_id)
        )).scalars().all()
    }

    for slug, spec in DEFAULT_ROLES.items():
        if slug in existing:
            continue
        role = Role(
            tenant_id=tenant_id,
            name=spec["name"],
            slug=slug,
            description=spec["description"],
            permissions=spec["permissions"],
            is_system=True,
            is_active=True,
        )
        db.add(role)
        existing[slug] = role

    await db.flush()
    return existing


async def create_user(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    email: str,
    password: str,
    full_name: str,
    phone: str | None = None,
    role_slugs: list[str] | None = None,
    is_tenant_owner: bool = False,
) -> User:
    email = email.strip().lower()

    clash = await db.scalar(
        select(User.id).where(User.tenant_id == tenant_id, User.email == email)
    )
    if clash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"'{email}' already exists in this tenant",
        )

    user = User(
        tenant_id=tenant_id,
        email=email,
        phone=phone,
        hashed_password=hash_password(password),
        full_name=full_name.strip(),
        status=UserStatus.ACTIVE,
        is_tenant_owner=is_tenant_owner,
    )
    db.add(user)
    await db.flush()

    for slug in role_slugs or []:
        await assign_role(db, tenant_id=tenant_id, user_id=user.id, role_slug=slug)

    return user


async def assign_role(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    role_slug: str,
    outlet_id: uuid.UUID | None = None,
) -> UserRole:
    role = await db.scalar(
        select(Role).where(
            Role.tenant_id == tenant_id, Role.slug == role_slug, Role.is_active.is_(True)
        )
    )
    if role is None:
        raise HTTPException(status_code=404, detail=f"Role '{role_slug}' not found")

    already = await db.scalar(
        select(UserRole).where(
            UserRole.user_id == user_id,
            UserRole.role_id == role.id,
            UserRole.outlet_id == outlet_id,
        )
    )
    if already is not None:
        return already

    link = UserRole(
        tenant_id=tenant_id, user_id=user_id, role_id=role.id, outlet_id=outlet_id
    )
    db.add(link)
    await db.flush()
    return link


# ─── Claims ─────────────────────────────────────────────────────────────────

async def build_claims(
    db: AsyncSession,
    user: User,
    *,
    active_outlet_id: uuid.UUID | None = None,
) -> dict:
    """Everything the other services need to authorise a request.

    Resolved once, here, and carried in the token. The alternative — each
    service calling auth per request — would put this service on the critical
    path of every request in the system.
    """
    tenant = await db.get(Tenant, user.tenant_id)

    role_rows = (await db.execute(
        select(Role, UserRole)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user.id, Role.is_active.is_(True))
    )).all()

    permissions: set[str] = set()
    role_slugs: list[str] = []
    allowed_outlets: set[uuid.UUID] = set()
    # True as soon as ANY held role is unscoped. A user with a tenant-wide
    # role and an outlet-specific one reaches every outlet: the unscoped role
    # already grants that, so narrowing to the scoped role's outlets would
    # take away access they genuinely hold.
    has_unscoped_role = False

    for role, link in role_rows:
        role_slugs.append(role.slug)
        permissions.update(derived_permissions(role.permissions))
        if link.outlet_id is None:
            has_unscoped_role = True
        else:
            allowed_outlets.add(link.outlet_id)

    # An owner, or anyone holding an unscoped role, reaches every outlet. The
    # empty set is the signal for that: this service does not own outlets, so
    # it cannot enumerate them — an empty list means "unrestricted", matching
    # Identity.can_access_outlet. A non-empty list is an allow-list.
    if user.is_tenant_owner or has_unscoped_role:
        allowed_outlets = set()

    return {
        "email": user.email,
        "full_name": user.full_name,
        "permissions": sorted(permissions),
        "roles": sorted(set(role_slugs)),
        "is_tenant_owner": bool(user.is_tenant_owner),
        "tenant_slug": tenant.slug if tenant else "",
        "active_outlet_id": str(active_outlet_id) if active_outlet_id else None,
        "allowed_outlet_ids": [str(o) for o in sorted(allowed_outlets, key=str)],
    }


async def issue_tokens(
    db: AsyncSession,
    user: User,
    *,
    active_outlet_id: uuid.UUID | None = None,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> dict:
    """Mint an access/refresh pair and record the refresh token's hash."""
    settings = get_settings()
    claims = await build_claims(db, user, active_outlet_id=active_outlet_id)

    access = create_access_token(
        user_id=user.id, tenant_id=user.tenant_id, claims=claims
    )
    refresh = create_refresh_token(user_id=user.id, tenant_id=user.tenant_id)

    db.add(RefreshToken(
        tenant_id=user.tenant_id,
        user_id=user.id,
        token_hash=hash_token(refresh),
        expires_at=_utcnow() + timedelta(days=settings.refresh_token_expire_days),
        user_agent=(user_agent or "")[:500] or None,
        ip_address=(ip_address or "")[:50] or None,
    ))

    user.last_login_at = _utcnow()

    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60,
    }


# ─── MFA (TOTP) ─────────────────────────────────────────────────────────────

def _totp(settings, secret: str, code: str) -> bool:
    """Check a 6-digit TOTP code against the user's secret.

    A 1-step window on either side of "now" is accepted so a client clock a
    few seconds off (the overwhelmingly common cause of 'wrong code') does
    not read as a lockout.
    """
    if pyotp is None:
        raise HTTPException(status_code=503, detail="MFA unavailable: pyotp not installed")
    totp = pyotp.TOTP(secret, digits=6)
    return totp.verify(code, valid_window=1)


async def enable_mfa(db: AsyncSession, user: User) -> dict:
    """Generate a fresh TOTP secret and hand the user everything they need to
    add it to an authenticator app. ``mfa_enabled`` stays False until
    ``verify_mfa`` succeeds — enabling is deliberately two-step so a half-
    finished flow can't leave a user unable to log in with only a password."""
    if pyotp is None:
        raise HTTPException(status_code=503, detail="MFA unavailable: pyotp not installed")
    user.mfa_secret = pyotp.random_base32()
    user.mfa_enabled = False
    await db.flush()

    totp = pyotp.TOTP(user.mfa_secret, digits=6)
    provisioning = totp.provisioning_uri(name=f"{user.email}", issuer_name="RestaurantOS")
    return {
        "secret": user.mfa_secret,
        "provisioning_uri": provisioning,
    }


async def verify_mfa(db: AsyncSession, user: User, code: str) -> bool:
    """First use of a TOTP code after enable: confirm it and flip
    ``mfa_enabled`` on. Wrong code leaves the user where they were — no
    lockout, no half-state."""
    if not user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA not initialised")
    if not _totp(get_settings(), user.mfa_secret, code):
        raise HTTPException(status_code=400, detail="Invalid code")
    user.mfa_enabled = True
    await db.flush()
    return True


async def disable_mfa(db: AsyncSession, user: User, current_code: str | None) -> None:
    """Turn MFA off. Requires a valid current code when MFA is on (so a
    stolen session can't strip the second factor); skips the check if
    ``mfa_enabled`` is already off — the secret is still discarded."""
    if user.mfa_enabled and current_code is None:
        raise HTTPException(status_code=400, detail="Current MFA code required")
    if user.mfa_enabled and not _totp(get_settings(), user.mfa_secret, current_code):
        raise HTTPException(status_code=400, detail="Invalid code")
    user.mfa_enabled = False
    user.mfa_secret = None
    await db.flush()


# ─── Sessions ───────────────────────────────────────────────────────────────

async def list_sessions(db: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    rows = (await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False)
        ).order_by(RefreshToken.created_at.desc())
    )).scalars().all()
    now = _utcnow()
    return [
        {
            "id": str(r.id),
            "user_agent": r.user_agent,
            "ip_address": r.ip_address,
            "created_at": r.created_at,
            "expires_at": r.expires_at,
            "active": _as_utc(r.expires_at) >= now,
        }
        for r in rows
    ]


async def revoke_session(db: AsyncSession, user_id: uuid.UUID, session_id: uuid.UUID) -> bool:
    row = await db.scalar(
        select(RefreshToken).where(
            RefreshToken.id == session_id, RefreshToken.user_id == user_id
        )
    )
    if row is None:
        return False
    row.revoked = True
    await db.flush()
    return True


# ─── Kill-switch ────────────────────────────────────────────────────────────

async def revoke_all_access_tokens(db: AsyncSession, user: User) -> None:
    """Invalidate every access token issued before this instant.

    Access tokens are stateless JWTs; the only way to kill one mid-life
    without a per-token revocation table is a timestamp floor checked at
    decode time (see ``shared/identity.py`` — the caller is expected to
    apply it). Cheap to store, exact to enforce.
    """
    user.token_revoked_before = _utcnow()
    await db.flush()


# ─── Login ──────────────────────────────────────────────────────────────────

async def authenticate(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    tenant_slug: str | None = None,
    mfa_code: str | None = None,
) -> User:
    """Resolve a user by credentials (+ optional TOTP), or raise 401/403.

    Every failure returns the same message. Distinguishing "no such user" from
    "wrong password" would let anyone probe which emails are registered.
    """
    email = email.strip().lower()

    stmt = select(User).where(User.email == email)
    if tenant_slug:
        stmt = stmt.join(Tenant, Tenant.id == User.tenant_id).where(
            Tenant.slug == tenant_slug.strip().lower()
        )
    users = (await db.execute(stmt)).scalars().all()

    if not users:
        # Same work as a real check, so the response time does not reveal
        # whether the account exists.
        verify_password(password, _DUMMY_HASH)
        raise _invalid_credentials()

    if len(users) > 1 and not tenant_slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email exists in more than one tenant — send tenant_slug",
        )

    user = users[0]
    if not verify_password(password, user.hashed_password):
        raise _invalid_credentials()

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {status_value(user.status)}",
        )

    tenant = await db.get(Tenant, user.tenant_id)
    if tenant is not None and tenant.status in (TenantStatus.SUSPENDED,
                                                TenantStatus.CANCELLED):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tenant is {status_value(tenant.status)}",
        )

    if user.mfa_enabled:
        if not mfa_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="MFA code required",
            )
        if not _totp(get_settings(), user.mfa_secret, mfa_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid MFA code",
            )

    return user


def _invalid_credentials() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )


# ─── Refresh / logout ───────────────────────────────────────────────────────

async def rotate_refresh_token(
    db: AsyncSession,
    *,
    refresh_token: str,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> dict:
    """Exchange a refresh token for a new pair, invalidating the old one.

    Single use. A replayed token is either a race or a theft; both are handled
    by revoking every token for that user, which forces a fresh login rather
    than leaving the attacker with a working session.
    """
    row = await db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token))
    )
    if row is None:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if row.revoked:
        # Presented twice. Treat the whole family as compromised.
        await revoke_all_for_user(db, row.user_id)
        # Commit before raising. get_db rolls back when the handler raises, so
        # without this the revocation is discarded — the theft is detected,
        # reported, and then undone, leaving the attacker's token working.
        # This is the one write in the service that must survive an error.
        await db.commit()
        raise HTTPException(
            status_code=401,
            detail="Refresh token already used — all sessions revoked",
        )

    if _as_utc(row.expires_at) < _utcnow():
        row.revoked = True
        raise HTTPException(status_code=401, detail="Refresh token expired")

    user = await db.get(User, row.user_id)
    if user is None or user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=401, detail="Account is not active")

    row.revoked = True
    await db.flush()

    return await issue_tokens(
        db, user, user_agent=user_agent, ip_address=ip_address
    )


async def revoke_refresh_token(db: AsyncSession, refresh_token: str) -> bool:
    """Log out one session. Returns False if the token was not recognised.

    Not an error: a caller logging out with a token we already forgot has
    still achieved what they wanted.
    """
    row = await db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token))
    )
    if row is None:
        return False
    row.revoked = True
    await db.flush()
    return True


async def revoke_all_for_user(db: AsyncSession, user_id: uuid.UUID) -> int:
    rows = (await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False)
        )
    )).scalars().all()
    for row in rows:
        row.revoked = True
    await db.flush()
    return len(rows)


# ─── Password change ────────────────────────────────────────────────────────

async def change_password(
    db: AsyncSession, user: User, *, current_password: str, new_password: str
) -> None:
    """Change a password and invalidate every existing session.

    Without the revocation, a stolen token stays valid for its full lifetime
    after the victim has done the one thing that is supposed to lock the
    attacker out.
    """
    if not verify_password(current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.hashed_password = hash_password(new_password)
    await db.flush()
    await revoke_all_for_user(db, user.id)
    # A password change is exactly the "compromised credential" moment the
    # kill-switch exists for — drop every access token minted before now too,
    # not just the refresh family.
    await revoke_all_access_tokens(db, user)
