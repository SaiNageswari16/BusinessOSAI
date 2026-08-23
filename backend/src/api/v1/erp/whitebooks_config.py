"""
Whitebooks 3-Module Settings & Diagnostics Router
Allows tenants to configure and test credentials for e-Way Bill, GST Returns, and e-Invoice modules independently.
"""

import uuid
from typing import Annotated, Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import select

from src.database.session import get_db
from src.api.deps import require_permission, CurrentUserContext
from src.models import Tenant
from src.services.whitebooks_service import whitebooks_service

router = APIRouter(prefix="/erp/whitebooks", tags=["ERP - Whitebooks GSP Configuration"])


class ModuleCredentials(BaseModel):
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    gstin: Optional[str] = None
    base_url: Optional[str] = None


class WhitebooksConfigPayload(BaseModel):
    environment: str = Field(default="sandbox")  # "sandbox" | "production"
    ip_address: Optional[str] = "106.213.64.83"
    ewb: ModuleCredentials = Field(default_factory=ModuleCredentials)
    gst: ModuleCredentials = Field(default_factory=ModuleCredentials)
    einv: ModuleCredentials = Field(default_factory=ModuleCredentials)


class TestConnectionRequest(BaseModel):
    module: str  # "ewb" | "gst" | "einv"
    credentials: Optional[Dict[str, Any]] = None


@router.get("/config")
async def get_whitebooks_config(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get active 3-module Whitebooks credentials and environment settings for this tenant.
    """
    t_uuid = uuid.UUID(str(ctx.tenant_id))
    tenant = await db.scalar(select(Tenant).where(Tenant.id == t_uuid))
    tenant_settings = tenant.settings if tenant and tenant.settings else {}

    resolved = whitebooks_service._resolve_config(tenant_settings)
    return {
        "environment": resolved["environment"],
        "ip_address": resolved["ip_address"],
        "ewb": {
            "client_id": resolved["ewb"]["client_id"] or "",
            "client_secret": resolved["ewb"]["client_secret"] or "",
            "username": resolved["ewb"]["username"] or "",
            "password": resolved["ewb"]["password"] or "",
            "gstin": resolved["ewb"]["gstin"] or "",
            "base_url": resolved["ewb"]["base_url"] or "",
            "is_configured": bool(resolved["ewb"]["client_id"] and resolved["ewb"]["client_secret"]),
        },
        "gst": {
            "client_id": resolved["gst"]["client_id"] or "",
            "client_secret": resolved["gst"]["client_secret"] or "",
            "username": resolved["gst"]["username"] or "",
            "password": resolved["gst"]["password"] or "",
            "gstin": resolved["gst"]["gstin"] or "",
            "base_url": resolved["gst"]["base_url"] or "",
            "is_configured": bool(resolved["gst"]["client_id"] and resolved["gst"]["client_secret"]),
        },
        "einv": {
            "client_id": resolved["einv"]["client_id"] or "",
            "client_secret": resolved["einv"]["client_secret"] or "",
            "username": resolved["einv"]["username"] or "",
            "password": resolved["einv"]["password"] or "",
            "gstin": resolved["einv"]["gstin"] or "",
            "base_url": resolved["einv"]["base_url"] or "",
            "is_configured": bool(resolved["einv"]["client_id"] and resolved["einv"]["client_secret"]),
        },
    }


@router.put("/config")
async def save_whitebooks_config(
    payload: WhitebooksConfigPayload,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Save 3-module Whitebooks credentials and environment settings for this tenant.
    """
    t_uuid = uuid.UUID(str(ctx.tenant_id))
    tenant = await db.scalar(select(Tenant).where(Tenant.id == t_uuid))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    settings = tenant.settings or {}
    config_dict = payload.model_dump()
    settings["whitebooks_config"] = config_dict
    tenant.settings = settings
    flag_modified(tenant, "settings")
    await db.commit()

    return {
        "success": True,
        "message": "Whitebooks 3-module credentials saved successfully.",
        "config": payload.model_dump(),
    }


@router.post("/test-connection")
async def test_module_connection(
    payload: TestConnectionRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Test live authentication and handshake for a specific module (EWB, GST, EINV).
    """
    t_uuid = uuid.UUID(str(ctx.tenant_id))
    tenant = await db.scalar(select(Tenant).where(Tenant.id == t_uuid))
    tenant_settings = tenant.settings if tenant and tenant.settings else {}

    custom_cfg = payload.credentials or tenant_settings.get("whitebooks_config")
    res = await whitebooks_service.test_module_connection(payload.module, custom_cfg)
    return res
