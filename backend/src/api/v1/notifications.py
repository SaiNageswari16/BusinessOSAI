import uuid
from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update, desc
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, get_current_user_context
from src.database.session import get_db
from src.models import LiveNotification, Tenant
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/system/notifications", tags=["System - Notifications"])

class NotificationSettingsUpdate(BaseModel):
    enabled: bool
    categories: List[str]
    polling_interval: int

class LiveNotificationResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    title: str
    body: str
    category: str
    unread: bool
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("/live", response_model=List[LiveNotificationResponse])
async def get_live_notifications(
    limit: int = 50,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetches the latest live notifications for the current tenant.
    Used for real-time top-bar alert polling.
    """
    stmt = (
        select(LiveNotification)
        .where(LiveNotification.tenant_id == ctx.tenant_id)
        .order_by(desc(LiveNotification.created_at))
        .limit(limit)
    )
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/read-all")
async def mark_all_as_read(
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Marks all live notifications for this tenant as read."""
    stmt = (
        update(LiveNotification)
        .where(
            LiveNotification.tenant_id == ctx.tenant_id,
            LiveNotification.unread == True
        )
        .values(unread=False)
    )
    await db.execute(stmt)
    await db.commit()
    return {"message": "All notifications marked as read."}

@router.get("/settings")
async def get_notification_settings(
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Fetches the current tenant's notification settings."""
    tenant = await db.get(Tenant, ctx.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    settings = tenant.settings or {}
    notif_cfg = settings.get("notifications", {
        "enabled": True,
        "categories": ["crm", "hrms", "pos", "inventory", "system"],
        "polling_interval": 6
    })
    return notif_cfg

@router.put("/settings")
async def update_notification_settings(
    payload: NotificationSettingsUpdate,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Updates the current tenant's notification configurations."""
    tenant = await db.get(Tenant, ctx.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Ensure settings dict is initialized
    if tenant.settings is None:
        tenant.settings = {}
    
    # Update notifications configuration block
    tenant.settings["notifications"] = {
        "enabled": payload.enabled,
        "categories": payload.categories,
        "polling_interval": payload.polling_interval
    }
    
    # Flag modification for JSONB
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(tenant, "settings")
    
    db.add(tenant)
    await db.commit()
    return {"message": "Notification configurations updated successfully.", "settings": tenant.settings["notifications"]}
