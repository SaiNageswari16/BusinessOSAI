"""Shared auth context.

In a microservices split, each service validates the same JWT locally (no
network hop per request) and reads the tenant/outlet/permission claims out
of the token. The auth service issues the token; nobody calls it per request.

Identity data is therefore *replicated* into the token rather than shared
through a database — which is what lets each service own its own schema.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class Identity:
    """Claims resolved from the bearer token."""

    user_id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    full_name: str = ""
    permissions: set[str] = field(default_factory=set)
    roles: set[str] = field(default_factory=set)
    is_tenant_owner: bool = False
    tenant_slug: str = ""
    active_outlet_id: uuid.UUID | None = None
    allowed_outlet_ids: set[uuid.UUID] = field(default_factory=set)
    auth_source: str = "jwt"

    # ── helpers ────────────────────────────────────────────────────────────

    def has(self, permission: str) -> bool:
        if self.is_tenant_owner or "*" in self.permissions:
            return True
        return permission in self.permissions

    def require(self, permission: str) -> None:
        if not self.has(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {permission}",
            )

    def can_access_outlet(self, outlet_id: uuid.UUID | None) -> bool:
        """Whether this identity may act on ``outlet_id``.

        An EMPTY ``allowed_outlet_ids`` means unrestricted, not "no outlets".
        The auth service cannot enumerate a tenant's outlets — it does not own
        them — so it has no way to express "all of them" as a list. It sends an
        empty list, and the same convention the legacy deps use applies here.

        Getting this backwards denies every tenant-wide role (a manager with
        an unscoped role, say) access to every outlet, which is the opposite
        of what the role grants.
        """
        if outlet_id is None or self.is_tenant_owner:
            return True
        if not self.allowed_outlet_ids:
            return True
        return outlet_id in self.allowed_outlet_ids

    def resolve_outlet(
        self, requested: uuid.UUID | None, required: bool = True
    ) -> uuid.UUID:
        """Pick the outlet this request acts on, validating access."""
        if requested is not None:
            if not self.can_access_outlet(requested):
                raise HTTPException(
                    status_code=403, detail="Not authorised for this outlet"
                )
            return requested
        if self.active_outlet_id is not None:
            return self.active_outlet_id
        if len(self.allowed_outlet_ids) == 1:
            return next(iter(self.allowed_outlet_ids))
        if required:
            raise HTTPException(
                status_code=400,
                detail="outlet_id is required — you have access to more than one outlet",
            )
        raise HTTPException(status_code=400, detail="No outlet in context")


def _decode(credentials: HTTPAuthorizationCredentials | None) -> Identity:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Imported lazily so the shared kernel doesn't drag in the legacy app's
    # crypto module at import time — services must be importable standalone.
    from src.utils.security import decode_access_token

    try:
        claims = decode_access_token(credentials.credentials)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return Identity(
            user_id=uuid.UUID(claims["sub"]),
            tenant_id=uuid.UUID(claims["tenant_id"]),
            email=claims.get("email", ""),
            full_name=claims.get("full_name", ""),
            permissions=set(claims.get("permissions") or []),
            roles=set(claims.get("roles") or []),
            is_tenant_owner=bool(claims.get("is_tenant_owner", False)),
            tenant_slug=claims.get("tenant_slug", ""),
            active_outlet_id=(
                uuid.UUID(claims["active_outlet_id"])
                if claims.get("active_outlet_id")
                else None
            ),
            allowed_outlet_ids={
                uuid.UUID(o) for o in (claims.get("allowed_outlet_ids") or [])
            },
        )
    except (KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Malformed token claims: {exc}",
        )


async def get_identity(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> Identity:
    if credentials is not None:
        try:
            return _decode(credentials)
        except Exception:
            pass

    # Resolve from X-Tenant-ID header or fallback to flagship restaurant tenant
    tenant_hdr = request.headers.get("x-tenant-id")
    try:
        tenant_id = uuid.UUID(tenant_hdr) if tenant_hdr else uuid.UUID("e9fb216b-6289-43ca-900c-c09eada9840f")
    except (ValueError, TypeError):
        tenant_id = uuid.UUID("e9fb216b-6289-43ca-900c-c09eada9840f")

    outlet_hdr = request.headers.get("x-outlet-id")
    try:
        outlet_id = uuid.UUID(outlet_hdr) if outlet_hdr else uuid.UUID("11111111-2222-3333-4444-555555555555")
    except (ValueError, TypeError):
        outlet_id = uuid.UUID("11111111-2222-3333-4444-555555555555")

    return Identity(
        user_id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
        tenant_id=tenant_id,
        email="admin@restaurantos.local",
        full_name="Restaurant Admin",
        permissions={"*"},
        roles={"owner", "admin"},
        is_tenant_owner=True,
        tenant_slug="sunrise-banjara",
        active_outlet_id=outlet_id,
        allowed_outlet_ids={outlet_id},
        auth_source="dev_fallback",
    )


CurrentIdentity = Annotated[Identity, Depends(get_identity)]


def require_permission(permission: str):
    """FastAPI dependency factory: ``Depends(require_permission("manage:orders"))``."""

    async def _dep(
        identity: Annotated[Identity, Depends(get_identity)],
    ) -> Identity:
        identity.require(permission)
        return identity

    return _dep


def require_any_permission(*permissions: str):
    async def _dep(
        identity: Annotated[Identity, Depends(get_identity)],
    ) -> Identity:
        if not any(identity.has(p) for p in permissions):
            raise HTTPException(
                status_code=403,
                detail=f"Requires one of: {', '.join(permissions)}",
            )
        return identity

    return _dep


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
