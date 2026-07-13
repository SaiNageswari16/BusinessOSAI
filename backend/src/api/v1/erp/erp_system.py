"""
System Administration — Global Settings, System Health, Error Logs
"""
import platform
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import (
    SystemSetting,
    AuditLog,
)
from src.schemas.erp import (
    SystemSettingResponse,
    SystemSettingUpdate,
    SystemSettingsBatchUpdate,
)
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter(prefix="/erp", tags=["Core ERP - System Administration"])


# ─── System Settings ──────────────────────────────────────────────

DEFAULT_SETTINGS_SEED = {
    "default_currency": ("INR", "general", "Default Currency", True),
    "default_timezone": ("Asia/Kolkata", "general", "Default Timezone", True),
    "system_language": ("en", "general", "System Language", True),
    "date_format": ("YYYY-MM-DD", "general", "Date Format", True),
    "enable_gst_vat": ("true", "general", "Enable GST / VAT Tracking", True),
    "strict_fy_locking": ("false", "general", "Strict Financial Year Locking", True),
    "mfa_required": ("false", "security", "Require MFA for all users", True),
    "session_timeout_hours": ("12", "security", "Session Timeout (hours)", True),
    "password_expiry_days": ("90", "security", "Password Expiry (days)", True),
    "email_notifications": ("true", "notifications", "Email Notifications", True),
    "sms_notifications": ("false", "notifications", "SMS Notifications", True),
    "primary_color": ("#6366f1", "branding", "Primary Brand Color", True),
    "company_logo_url": ("", "branding", "Company Logo URL", True),
    "backup_frequency": ("daily", "data", "Backup Frequency", True),
    "data_retention_days": ("30", "data", "Data Retention (days)", True),
}


@router.get("/system-settings", response_model=list[SystemSettingResponse])
async def get_system_settings(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    category: str | None = None,
):
    """Retrieve all system settings for the current tenant. Auto-seeds defaults if missing."""
    # 1. Fetch current settings
    query = select(SystemSetting).where(SystemSetting.tenant_id == ctx.tenant_id)
    result = await db.execute(query)
    existing_settings = result.scalars().all()
    existing_keys = {s.key for s in existing_settings}

    # 2. Seed missing settings
    seeded = False
    for key, (val, cat, desc, is_pub) in DEFAULT_SETTINGS_SEED.items():
        if key not in existing_keys:
            setting = SystemSetting(
                tenant_id=ctx.tenant_id,
                key=key,
                value=val,
                category=cat,
                description=desc,
                is_public=is_pub,
            )
            db.add(setting)
            seeded = True

    if seeded:
        await db.commit()
        # Re-fetch
        result = await db.execute(
            select(SystemSetting).where(SystemSetting.tenant_id == ctx.tenant_id)
        )
        existing_settings = result.scalars().all()

    # Filter by category if requested
    if category:
        filtered = [s for s in existing_settings if s.category == category]
    else:
        filtered = list(existing_settings)

    # Sort
    filtered.sort(key=lambda s: (s.category, s.key))
    return filtered


@router.patch("/system-settings", response_model=list[SystemSettingResponse])
async def update_system_settings(
    payload: SystemSettingsBatchUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Upsert multiple system settings at once."""
    updated: list[SystemSetting] = []
    for item in payload.settings:
        existing = await db.scalar(
            select(SystemSetting).where(
                SystemSetting.tenant_id == ctx.tenant_id,
                SystemSetting.key == item.key,
            )
        )
        if existing:
            existing.value = item.value
            existing.category = item.category
            existing.description = item.description
            existing.is_public = item.is_public
            updated.append(existing)
        else:
            setting = SystemSetting(
                tenant_id=ctx.tenant_id,
                key=item.key,
                value=item.value,
                category=item.category,
                description=item.description,
                is_public=item.is_public,
            )
            db.add(setting)
            await db.flush()
            updated.append(setting)

    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
        action="updated", entity_type="system_settings", entity_id=None,
        new_values={"keys": [s.key for s in payload.settings]},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    # Re-fetch to ensure fresh data
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.tenant_id == ctx.tenant_id)
        .order_by(SystemSetting.category, SystemSetting.key)
    )
    return result.scalars().all()


@router.put("/system-settings/{key}", response_model=SystemSettingResponse)
async def upsert_system_setting(
    key: str,
    payload: SystemSettingUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Upsert a single system setting by key."""
    existing = await db.scalar(
        select(SystemSetting).where(
            SystemSetting.tenant_id == ctx.tenant_id,
            SystemSetting.key == key,
        )
    )
    if existing:
        existing.value = payload.value
        existing.category = payload.category
        existing.description = payload.description
        existing.is_public = payload.is_public
        setting = existing
    else:
        setting = SystemSetting(
            tenant_id=ctx.tenant_id,
            key=key,
            value=payload.value,
            category=payload.category,
            description=payload.description,
            is_public=payload.is_public,
        )
        db.add(setting)
        await db.flush()

    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
        action="updated", entity_type="system_setting", entity_id=setting.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return setting


# ─── System Health ────────────────────────────────────────────────

@router.get("/system-health")
async def get_system_health(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return live system health metrics."""
    # Test database connectivity
    db_ok = True
    db_latency_ms = 0
    try:
        import time
        t0 = time.monotonic()
        await db.execute(text("SELECT 1"))
        db_latency_ms = round((time.monotonic() - t0) * 1000, 2)
    except Exception:
        db_ok = False

    # Count recent audit log entries (activity proxy)
    try:
        log_count = await db.scalar(
            select(func.count()).select_from(AuditLog).where(
                AuditLog.tenant_id == ctx.tenant_id
            )
        ) or 0
    except Exception:
        log_count = 0

    return {
        "status": "healthy" if db_ok else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "python_version": platform.python_version(),
        "database": {
            "status": "online" if db_ok else "offline",
            "latency_ms": db_latency_ms,
        },
        "tenant": {
            "id": str(ctx.tenant_id),
            "total_audit_logs": log_count,
        },
        "services": [
            {"name": "API Server", "status": "online", "latency_ms": 0},
            {"name": "Database (PostgreSQL)", "status": "online" if db_ok else "offline", "latency_ms": db_latency_ms},
            {"name": "File Storage", "status": "online", "latency_ms": None},
        ],
    }


# ─── Error Logs (from Audit Log with status=failed) ───────────────

@router.get("/error-logs", response_model=PaginatedResponse[dict])
async def list_error_logs(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    module: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """List failed/error audit log entries as error logs."""
    query = select(AuditLog).where(
        AuditLog.tenant_id == ctx.tenant_id,
        AuditLog.status == "failed",
    )
    if module:
        query = query.where(AuditLog.module == module)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    logs = result.scalars().all()
    items = [
        {
            "id": str(log.id),
            "module": log.module,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": str(log.entity_id) if log.entity_id else None,
            "user_id": str(log.user_id) if log.user_id else None,
            "ip_address": log.ip_address,
            "error_details": log.new_values,
            "status": log.status,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]
    return {
        "items": items,
        "total": total or 0,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, ((total or 0) + page_size - 1) // page_size),
    }


# ─── Backup / Restore Status ──────────────────────────────────────

@router.get("/backup-status")
async def get_backup_status(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
):
    """Return placeholder backup status (real implementation would integrate with backup service)."""
    return {
        "last_backup": None,
        "backup_frequency": "daily",
        "retention_days": 30,
        "status": "no_backup_configured",
        "message": "Automated backup configuration is managed by the platform team.",
    }
