"""Auth service tests — TOTP MFA, session listing/revocation, kill-switch.

Runs against SQLite (no Postgres/Redis needed). The auth service's models
register on a service-specific declarative base (``service_base("auth")``)
rather than a shared one — see service_db.py's docstring — so the schema is
created from that base's own metadata.

Run:  python -m pytest tests/test_auth.py -q
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

os.environ.setdefault("APP_ENV", "test")  # (test-only)

from src.utils.security import create_access_token, decode_access_token, hash_password  # noqa: E402
from src.services.auth import service as auth_service  # noqa: E402
from src.services.auth.models import (  # noqa: E402
    Tenant,
    TenantStatus,
    User,
    UserStatus,
)
from conftest import _service_db  # noqa: E402

_engine, _tables, db = _service_db("auth", "src.services.auth.models")


async def _create_tenant_and_user(
    db: AsyncSession, *, email: str = "owner@auth.test"
) -> tuple[Tenant, User]:
    tenant = Tenant(name="Auth Test", slug="auth-test", status=TenantStatus.ACTIVE)
    db.add(tenant)
    await db.flush()

    user = User(
        tenant_id=tenant.id,
        email=email,
        hashed_password=hash_password("password123"),
        full_name="Owner",
        status=UserStatus.ACTIVE,
        is_tenant_owner=True,
    )
    db.add(user)
    await db.flush()
    return tenant, user


def _code_for(secret: str) -> str:
    import pyotp
    return pyotp.TOTP(secret, digits=6).now()


# ─── TOTP MFA ───────────────────────────────────────────────────────────────

class TestMfa:
    @pytest.mark.asyncio
    async def test_enable_and_verify_mfa(self, db: AsyncSession):
        _, user = await _create_tenant_and_user(db)

        result = await auth_service.enable_mfa(db, user)
        assert result["secret"]
        assert "RestaurantOS" in result["provisioning_uri"]
        await db.refresh(user)
        assert user.mfa_enabled is False, "stays off until verified"

        code = _code_for(user.mfa_secret)
        await auth_service.verify_mfa(db, user, code)
        await db.refresh(user)
        assert user.mfa_enabled is True

    @pytest.mark.asyncio
    async def test_verify_wrong_code_fails(self, db: AsyncSession):
        _, user = await _create_tenant_and_user(db)
        await auth_service.enable_mfa(db, user)
        await db.refresh(user)

        with pytest.raises(HTTPException) as exc:
            await auth_service.verify_mfa(db, user, "000000")
        assert "Invalid code" in str(exc.value.detail)

    @pytest.mark.asyncio
    async def test_authenticate_requires_mfa_when_enabled(self, db: AsyncSession):
        tenant, user = await _create_tenant_and_user(db)
        result = await auth_service.enable_mfa(db, user)
        await auth_service.verify_mfa(db, user, _code_for(result["secret"]))

        with pytest.raises(HTTPException) as exc:
            await auth_service.authenticate(
                db, email=user.email, password="password123", tenant_slug=tenant.slug
            )
        assert "MFA code required" in str(exc.value.detail)

        await auth_service.authenticate(
            db,
            email=user.email,
            password="password123",
            tenant_slug=tenant.slug,
            mfa_code=_code_for(user.mfa_secret),
        )

    @pytest.mark.asyncio
    async def test_disable_mfa_requires_current_code(self, db: AsyncSession):
        _, user = await _create_tenant_and_user(db)
        result = await auth_service.enable_mfa(db, user)
        await auth_service.verify_mfa(db, user, _code_for(result["secret"]))
        await db.refresh(user)
        assert user.mfa_enabled is True

        with pytest.raises(HTTPException) as exc:
            await auth_service.disable_mfa(db, user, None)
        assert "Current MFA code required" in str(exc.value.detail)

        await auth_service.disable_mfa(db, user, _code_for(user.mfa_secret))
        await db.refresh(user)
        assert user.mfa_enabled is False
        assert user.mfa_secret is None


# ─── Sessions ───────────────────────────────────────────────────────────────

class TestSessions:
    @pytest.mark.asyncio
    async def test_list_sessions_returns_active_refresh_tokens(self, db: AsyncSession):
        _, user = await _create_tenant_and_user(db)
        await auth_service.issue_tokens(db, user, user_agent="pytest-agent", ip_address="127.0.0.1")
        sessions = await auth_service.list_sessions(db, user.id)
        assert len(sessions) == 1
        assert sessions[0]["user_agent"] == "pytest-agent"
        assert sessions[0]["active"] is True

    @pytest.mark.asyncio
    async def test_revoke_session(self, db: AsyncSession):
        _, user = await _create_tenant_and_user(db)
        await auth_service.issue_tokens(db, user)
        sessions = await auth_service.list_sessions(db, user.id)
        session_id = uuid.UUID(sessions[0]["id"])

        assert await auth_service.revoke_session(db, user.id, session_id) is True
        remaining = await auth_service.list_sessions(db, user.id)
        assert remaining == []

        assert await auth_service.revoke_session(db, user.id, uuid.uuid4()) is False


# ─── Kill-switch (access-token revocation by iat floor) ────────────────────

class TestKillSwitch:
    @pytest.mark.asyncio
    async def test_change_password_revokes_access_tokens(self, db: AsyncSession):
        _, user = await _create_tenant_and_user(db)

        pair = await auth_service.issue_tokens(db, user)
        claims_before = decode_access_token(pair["access_token"])

        await auth_service.change_password(
            db, user, current_password="password123", new_password="new-password"
        )
        await db.refresh(user)
        assert user.token_revoked_before is not None

        # The pre-change token was minted before the floor — the check in
        # shared/identity._decode rejects it.
        minted_at = datetime.fromtimestamp(claims_before["iat"], tz=timezone.utc)
        floor = user.token_revoked_before
        if floor.tzinfo is None:
            floor = floor.replace(tzinfo=timezone.utc)
        assert minted_at < floor

    @pytest.mark.asyncio
    async def test_revoke_all_access_tokens_sets_floor(self, db: AsyncSession):
        _, user = await _create_tenant_and_user(db)
        assert user.token_revoked_before is None

        await auth_service.revoke_all_access_tokens(db, user)
        await db.refresh(user)
        assert user.token_revoked_before is not None


if __name__ == "__main__":
    import sys
    sys.exit(pytest.main([__file__, "-q"]))
