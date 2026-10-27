from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

from src.database.session import get_db
from src.api.deps import CurrentUserContext, get_current_user_context
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func, and_, or_, desc
from src.models import Tenant, LiveNotification, Company
from src.utils.clock import clock
from src.utils.notifications import add_system_notification
from src.services.inventory_alert_service import (
    get_tenant_alert_config,
    generate_inventory_alert_signals,
    dispatch_inventory_alert_digest,
    send_whatsapp_alert_text,
    get_active_whatsapp_session,
)

router = APIRouter()


class InventoryAlertConfigSchema(BaseModel):
    low_stock_push: bool = True
    low_stock_whatsapp: bool = True
    dead_stock_push: bool = True
    dead_stock_whatsapp: bool = True
    dead_stock_days: int = Field(default=90, ge=15, le=365)
    expiry_alerts: bool = True
    expiry_days_threshold: int = Field(default=30, ge=1, le=180)
    manager_whatsapp: Optional[str] = ""
    auto_digest_enabled: bool = True


class TestWhatsAppAlertRequest(BaseModel):
    phone_number: Optional[str] = None
    custom_message: Optional[str] = None


@router.get("/config")
async def get_inventory_alert_configuration(
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve organization-wide inventory alerting settings & WhatsApp configuration."""
    cfg = await get_tenant_alert_config(db, ctx.tenant_id)
    session_id = await get_active_whatsapp_session(db=db, tenant_id=ctx.tenant_id, company_id=ctx.active_company_id)
    return {
        "config": cfg,
        "whatsapp_connected": bool(session_id),
        "active_whatsapp_session": session_id or "Not connected",
    }


@router.put("/config")
async def update_inventory_alert_configuration(
    payload: InventoryAlertConfigSchema,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Update organization inventory alert preferences (push, WhatsApp, dead stock days, phone numbers)."""
    tenant = await db.get(Tenant, ctx.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    settings = tenant.settings or {}
    settings["inventory_alerts"] = payload.model_dump()
    tenant.settings = dict(settings)

    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)

    return {
        "message": "Inventory alerting settings saved successfully.",
        "config": tenant.settings.get("inventory_alerts", {}),
    }


@router.get("/status")
async def get_inventory_alert_status(
    dead_stock_days: Optional[int] = Query(None, description="Override dead stock days threshold"),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Get live breakdown of stockouts, low-stock items, dead stock capital, and expiring batches."""
    cfg = await get_tenant_alert_config(db, ctx.tenant_id)
    days = dead_stock_days if dead_stock_days is not None else int(cfg.get("dead_stock_days", 90))

    signals = await generate_inventory_alert_signals(
        db=db,
        tenant_id=ctx.tenant_id,
        company_id=ctx.active_company_id,
        dead_stock_days=days,
        expiry_days_threshold=int(cfg.get("expiry_days_threshold", 30)),
    )
    return signals


@router.post("/trigger-digest")
async def trigger_inventory_alert_digest(
    phone_number: Optional[str] = Query(None, description="Optional target WhatsApp number"),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Immediately triggers an In-App push notification and WhatsApp stock health digest for this organization."""
    result = await dispatch_inventory_alert_digest(
        db=db,
        tenant_id=ctx.tenant_id,
        company_id=ctx.active_company_id,
        target_phone=phone_number,
    )
    return result


@router.post("/test-whatsapp")
async def send_test_whatsapp_stock_alert(
    payload: TestWhatsAppAlertRequest,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Send an instant test WhatsApp alert to verify gateway connectivity."""
    cfg = await get_tenant_alert_config(db, ctx.tenant_id)
    target_phone = payload.phone_number or cfg.get("manager_whatsapp")

    if not target_phone:
        raise HTTPException(
            status_code=400,
            detail="Please provide a recipient WhatsApp phone number.",
        )

    msg = payload.custom_message or (
        "✅ *BusinessOS Alert Engine — Test Ping*\n\n"
        "Your WhatsApp notification channel for Low Stock and Dead Stock alerts is active and ready!\n"
        "You will receive automatic alerts when items drop below reorder thresholds or stagnate in inventory."
    )

    delivery = await send_whatsapp_alert_text(
        target_phone, msg, db=db, tenant_id=ctx.tenant_id, company_id=ctx.active_company_id
    )
    if not delivery.get("success"):
        raise HTTPException(
            status_code=502,
            detail=f"WhatsApp test failed: {delivery.get('error', 'Gateway error')}",
        )

    await add_system_notification(
        db=db,
        tenant_id=ctx.tenant_id,
        company_id=ctx.active_company_id,
        title="📱 WhatsApp Test Ping Dispatched",
        body=f"Sent to {target_phone}: Verification ping successful.",
        category="inventory_whatsapp",
    )
    await db.commit()

    return {"message": f"Test alert successfully sent to {target_phone} via WhatsApp!", "delivery": delivery}


@router.get("/history")
async def get_inventory_alert_history(
    period: str = Query("7d", description="today, 7d, 30d, all"),
    channel: Optional[str] = Query(None, description="in_app, whatsapp, or all"),
    limit: int = Query(50, ge=1, le=200),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns time-filtered inventory alert dispatch history (In-App Push & WhatsApp)
    with total counts, channel breakdowns, and recent activity log.
    """
    now = clock.now()
    start_time = None
    if period == "today":
        start_time = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=now.tzinfo)
    elif period == "7d":
        start_time = now - timedelta(days=7)
    elif period == "30d":
        start_time = now - timedelta(days=30)
    # "all" leaves start_time = None

    # Base filters: tenant scoped and optionally company scoped
    conditions = [
        LiveNotification.tenant_id == ctx.tenant_id,
        LiveNotification.category.in_(["inventory", "inventory_whatsapp"]),
    ]
    if ctx.active_company_id:
        first_comp_id = await db.scalar(
            select(Company.id)
            .where(Company.tenant_id == ctx.tenant_id)
            .order_by(Company.created_at.asc())
            .limit(1)
        )
        if ctx.active_company_id == first_comp_id:
            conditions.append(
                or_(
                    LiveNotification.company_id == ctx.active_company_id,
                    LiveNotification.company_id.is_(None),
                )
            )
        else:
            conditions.append(LiveNotification.company_id == ctx.active_company_id)
    if start_time:
        conditions.append(LiveNotification.created_at >= start_time)

    # 1. Summary aggregations
    total_q = select(func.count(LiveNotification.id)).where(and_(*conditions))
    total_count = (await db.scalar(total_q)) or 0

    in_app_q = select(func.count(LiveNotification.id)).where(
        and_(*conditions, LiveNotification.category == "inventory")
    )
    in_app_count = (await db.scalar(in_app_q)) or 0

    wa_q = select(func.count(LiveNotification.id)).where(
        and_(*conditions, LiveNotification.category == "inventory_whatsapp")
    )
    wa_count = (await db.scalar(wa_q)) or 0

    # 2. List recent alerts
    list_conditions = list(conditions)
    if channel == "in_app":
        list_conditions.append(LiveNotification.category == "inventory")
    elif channel == "whatsapp":
        list_conditions.append(LiveNotification.category == "inventory_whatsapp")

    query = (
        select(LiveNotification)
        .where(and_(*list_conditions))
        .order_by(desc(LiveNotification.created_at))
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.scalars().all()

    alert_items = []
    for r in rows:
        ch = "whatsapp" if r.category == "inventory_whatsapp" else "in_app"
        alert_items.append({
            "id": str(r.id),
            "title": r.title,
            "body": r.body,
            "category": r.category,
            "channel": ch,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {
        "period": period,
        "summary": {
            "total": total_count,
            "in_app": in_app_count,
            "whatsapp": wa_count,
        },
        "alerts": alert_items,
    }
