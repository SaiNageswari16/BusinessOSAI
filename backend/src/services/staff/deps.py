"""Staff service dependencies and security context."""
from __future__ import annotations

import logging
import uuid
from types import SimpleNamespace
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.shared.identity import Identity, _forwarded_identity, dev_fallback_enabled, build_dev_fallback_identity

logger = logging.getLogger("staff.deps")


async def get_db(request: Request):
    """Session-per-request from the staff ServiceDatabase."""
    session = request.app.state.db.session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


DbDep = Annotated[AsyncSession, Depends(get_db)]


class CurrentUserContext:
    """Compatibility context wrapper providing tenant and user identity."""

    def __init__(self, identity: Identity):
        self.identity = identity
        self.tenant_id = identity.tenant_id
        self.user_id = identity.user_id
        self.outlet_id = identity.active_outlet_id
        self.user = SimpleNamespace(
            id=identity.user_id,
            email=identity.email,
            full_name=identity.full_name,
            is_tenant_owner=identity.is_tenant_owner,
            roles=identity.roles,
            permissions=identity.permissions,
        )
        self.tenant = SimpleNamespace(
            id=identity.tenant_id,
            slug=identity.tenant_slug,
        )

    def require(self, permission: str) -> None:
        if self.identity.is_tenant_owner or "*" in self.identity.permissions:
            return
        if permission not in self.identity.permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {permission}",
            )


async def get_current_user_context(request: Request) -> CurrentUserContext:
    """Resolve current user identity from forwarded headers or dev fallback."""
    identity = _forwarded_identity(request)
    if identity is None and dev_fallback_enabled():
        identity = build_dev_fallback_identity()
    if identity is None:
        # Check bearer token directly as a secondary fallback
        from src.services.shared.identity import bearer_scheme, _decode
        credentials = await bearer_scheme(request)
        if credentials:
            try:
                identity = _decode(credentials)
            except Exception:
                pass
    if identity is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return CurrentUserContext(identity)


def require_permission(permission: str):
    """Dependency factory checking permissions against current identity."""
    async def _dep(ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)]) -> CurrentUserContext:
        ctx.require(permission)
        return ctx
    return _dep


async def write_audit_log(*args, **kwargs):
    """Safe audit log sink."""
    pass


async def add_system_notification(*args, **kwargs):
    """Safe system notification sink."""
    pass


from math import ceil
from typing import Generic, Sequence, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class PaginatedResponse(BaseModel, Generic[T]):
    items: Sequence[T]
    total: int
    page: int
    page_size: int
    total_pages: int


def paginate(items: Sequence[T], total: int, page: int, page_size: int) -> PaginatedResponse[T]:
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if page_size else 0,
    )


def _resolve_company_id(db=None, tenant_id: uuid.UUID | None = None, company_id=None) -> uuid.UUID:
    if company_id:
        try:
            return uuid.UUID(str(company_id))
        except Exception:
            pass
    return tenant_id or uuid.uuid4()


def hash_password(password: str) -> str:
    import hashlib
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


async def unified_send_email(*args, **kwargs):
    logger.info("unified_send_email called: %s", kwargs.get("to") or args)
    return True


async def dispatch_user_onboarding_credentials(*args, **kwargs):
    logger.info("dispatch_user_onboarding_credentials dispatched")
    return True

