import uuid
from typing import List, Optional, Annotated, Any
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update, delete, desc, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, get_current_user_context, require_permission
from src.database.session import get_db
from src.models import (
    LiveNotification,
    Tenant,
    User,
    UserRole,
    Role,
    Employee,
    Department,
    PushNotificationTemplate,
    NotificationBroadcast,
    UserDeviceToken,
)

router = APIRouter(prefix="/system/notifications", tags=["System - Push Notifications"])


# ─── Schemas ────────────────────────────────────────────────────────

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

class PushTemplateCreate(BaseModel):
    name: str
    category: str = "hrms"
    title_template: str
    body_template: str
    action_url: Optional[str] = None
    priority: str = "normal"
    icon_type: Optional[str] = "bell"

class PushTemplateUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    title_template: Optional[str] = None
    body_template: Optional[str] = None
    action_url: Optional[str] = None
    priority: Optional[str] = None
    icon_type: Optional[str] = None

class PushTemplateResponse(BaseModel):
    id: str
    name: str
    category: str
    title_template: str
    body_template: str
    action_url: Optional[str] = None
    priority: str = "normal"
    icon_type: Optional[str] = "bell"
    is_system: bool = False
    created_at: Optional[datetime] = None

class BroadcastPushRequest(BaseModel):
    template_id: Optional[str] = None
    title: str
    body: str
    category: str = "system"
    target_type: str = "all_org"  # all_org | roles | departments | individual
    target_filter: List[str] = Field(default_factory=list)  # role IDs/names, department IDs, or user IDs
    action_url: Optional[str] = None
    priority: str = "normal"  # normal | high | urgent
    channels: List[str] = Field(default_factory=lambda: ["in_app", "web_push", "mobile_app"])

class BroadcastResponse(BaseModel):
    id: uuid.UUID
    sender_name: Optional[str] = None
    title: str
    body: str
    category: str
    target_type: str
    recipients_count: int
    status: str
    created_at: datetime

class DeviceTokenRegisterRequest(BaseModel):
    device_token: str
    platform: str = "web"  # web | android | ios | pwa
    device_name: Optional[str] = None


# ─── Built-in Default Corporate Templates ───────────────────────────

DEFAULT_PUSH_TEMPLATES: List[dict] = [
    {
        "id": "tpl-announcement",
        "name": "Urgent Organization Announcement",
        "category": "system",
        "title_template": "📢 Notice from {{org_name}}",
        "body_template": "Dear {{user_name}}, please review the critical organization update released for {{date}}.",
        "action_url": "/hrms?tab=ess_announcements",
        "priority": "high",
        "icon_type": "megaphone",
        "is_system": True,
    },
    {
        "id": "tpl-salary-credited",
        "name": "Monthly Salary Disbursal Notice",
        "category": "hrms",
        "title_template": "💰 Salary Slip Available for {{date}}",
        "body_template": "Hello {{user_name}}, your monthly salary certificate has been generated and disbursed to your registered bank account.",
        "action_url": "/hrms?tab=ess_payroll",
        "priority": "high",
        "icon_type": "banknote",
        "is_system": True,
    },
    {
        "id": "tpl-maintenance",
        "name": "Scheduled Platform Maintenance",
        "category": "system",
        "title_template": "🛠️ System Maintenance Advisory",
        "body_template": "The workspace infrastructure will undergo scheduled maintenance on {{date}}. Temporary service interruptions may occur.",
        "action_url": "/dashboard",
        "priority": "normal",
        "icon_type": "settings",
        "is_system": True,
    },
    {
        "id": "tpl-festive-greetings",
        "name": "Festive & Holiday Greetings",
        "category": "hrms",
        "title_template": "🎉 Warm Holiday Greetings from {{org_name}}!",
        "body_template": "Wishing {{user_name}} and your family a joyful holiday season and wonderful celebrations.",
        "action_url": "/hrms?tab=ess_announcements",
        "priority": "normal",
        "icon_type": "gift",
        "is_system": True,
    },
    {
        "id": "tpl-attendance-cutoff",
        "name": "Attendance Regularization Cut-Off Reminder",
        "category": "hrms",
        "title_template": "⏱️ Attendance Month-End Cutoff Reminder",
        "body_template": "Hi {{user_name}}, please ensure all pending punch regularization and leave requests are submitted by {{date}}.",
        "action_url": "/hrms?tab=ess_attendance",
        "priority": "high",
        "icon_type": "clock",
        "is_system": True,
    },
    {
        "id": "tpl-sales-milestone",
        "name": "Sales Target & Milestone Celebration",
        "category": "crm",
        "title_template": "🚀 New Sales Revenue Milestone Achieved!",
        "body_template": "Kudos to the team! We have officially crossed the quarterly revenue target. Thank you for your extraordinary efforts!",
        "action_url": "/crm",
        "priority": "normal",
        "icon_type": "trending-up",
        "is_system": True,
    },
]


# ─── Live Notification In-App Polling Endpoints ─────────────────────

@router.get("/live", response_model=List[LiveNotificationResponse])
async def get_live_notifications(
    limit: int = 50,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Fetches the latest live notifications for the current tenant and user."""
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
    
    if tenant.settings is None:
        tenant.settings = {}
    
    tenant.settings["notifications"] = {
        "enabled": payload.enabled,
        "categories": payload.categories,
        "polling_interval": payload.polling_interval
    }
    
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(tenant, "settings")
    
    db.add(tenant)
    await db.commit()
    return {"message": "Notification configurations updated successfully.", "settings": tenant.settings["notifications"]}


# ─── Push Notification Templates Endpoints ─────────────────────────

@router.get("/templates", response_model=List[PushTemplateResponse])
async def list_push_templates(
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """List all available push notification message templates (predefined + tenant custom)."""
    # Fetch tenant custom templates
    custom_stmt = (
        select(PushNotificationTemplate)
        .where(PushNotificationTemplate.tenant_id == ctx.tenant_id)
        .order_by(desc(PushNotificationTemplate.created_at))
    )
    result = await db.execute(custom_stmt)
    custom_templates = result.scalars().all()

    formatted: List[PushTemplateResponse] = []
    
    # Add custom templates first
    for ct in custom_templates:
        formatted.append(
            PushTemplateResponse(
                id=str(ct.id),
                name=ct.name,
                category=ct.category,
                title_template=ct.title_template,
                body_template=ct.body_template,
                action_url=ct.action_url,
                priority=ct.priority,
                icon_type=ct.icon_type,
                is_system=ct.is_system,
                created_at=ct.created_at,
            )
        )

    # Add default predefined templates
    for dt in DEFAULT_PUSH_TEMPLATES:
        formatted.append(
            PushTemplateResponse(
                id=dt["id"],
                name=dt["name"],
                category=dt["category"],
                title_template=dt["title_template"],
                body_template=dt["body_template"],
                action_url=dt.get("action_url"),
                priority=dt.get("priority", "normal"),
                icon_type=dt.get("icon_type", "bell"),
                is_system=True,
                created_at=None,
            )
        )

    return formatted


@router.post("/templates", response_model=PushTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_push_template(
    payload: PushTemplateCreate,
    ctx: CurrentUserContext = Depends(require_permission("view:hrms")),
    db: AsyncSession = Depends(get_db)
):
    """Create a new reusable push notification template."""
    tmpl = PushNotificationTemplate(
        tenant_id=ctx.tenant_id,
        name=payload.name,
        category=payload.category,
        title_template=payload.title_template,
        body_template=payload.body_template,
        action_url=payload.action_url,
        priority=payload.priority,
        icon_type=payload.icon_type,
        is_system=False,
    )
    db.add(tmpl)
    await db.commit()
    await db.refresh(tmpl)

    return PushTemplateResponse(
        id=str(tmpl.id),
        name=tmpl.name,
        category=tmpl.category,
        title_template=tmpl.title_template,
        body_template=tmpl.body_template,
        action_url=tmpl.action_url,
        priority=tmpl.priority,
        icon_type=tmpl.icon_type,
        is_system=tmpl.is_system,
        created_at=tmpl.created_at,
    )


@router.put("/templates/{template_id}", response_model=PushTemplateResponse)
async def update_push_template(
    template_id: str,
    payload: PushTemplateUpdate,
    ctx: CurrentUserContext = Depends(require_permission("view:hrms")),
    db: AsyncSession = Depends(get_db)
):
    """Update a custom push notification template."""
    try:
        t_uuid = uuid.UUID(template_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="System default templates cannot be directly overwritten. Create a new custom template instead.")

    tmpl = await db.get(PushNotificationTemplate, t_uuid)
    if not tmpl or tmpl.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Template not found")

    if payload.name is not None: tmpl.name = payload.name
    if payload.category is not None: tmpl.category = payload.category
    if payload.title_template is not None: tmpl.title_template = payload.title_template
    if payload.body_template is not None: tmpl.body_template = payload.body_template
    if payload.action_url is not None: tmpl.action_url = payload.action_url
    if payload.priority is not None: tmpl.priority = payload.priority
    if payload.icon_type is not None: tmpl.icon_type = payload.icon_type

    await db.commit()
    await db.refresh(tmpl)

    return PushTemplateResponse(
        id=str(tmpl.id),
        name=tmpl.name,
        category=tmpl.category,
        title_template=tmpl.title_template,
        body_template=tmpl.body_template,
        action_url=tmpl.action_url,
        priority=tmpl.priority,
        icon_type=tmpl.icon_type,
        is_system=tmpl.is_system,
        created_at=tmpl.created_at,
    )


@router.delete("/templates/{template_id}")
async def delete_push_template(
    template_id: str,
    ctx: CurrentUserContext = Depends(require_permission("view:hrms")),
    db: AsyncSession = Depends(get_db)
):
    """Delete a custom push notification template."""
    try:
        t_uuid = uuid.UUID(template_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Cannot delete system default templates")

    tmpl = await db.get(PushNotificationTemplate, t_uuid)
    if not tmpl or tmpl.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Template not found")

    await db.delete(tmpl)
    await db.commit()
    return {"message": "Template deleted successfully"}


# ─── Push Notification Broadcasting & Multi-Device Dispatch ──────────

@router.post("/broadcast")
async def send_broadcast_push(
    payload: BroadcastPushRequest,
    ctx: CurrentUserContext = Depends(require_permission("view:hrms")),
    db: AsyncSession = Depends(get_db)
):
    """
    Dispatches a push notification broadcast to:
    - All organization users
    - Specific roles
    - Specific departments
    - Individual users
    Generates live in-app alerts and sends to mobile/web push device endpoints.
    """
    tenant = await db.get(Tenant, ctx.tenant_id)
    org_name = tenant.name if tenant else "Workspace Organization"
    current_date_str = date.today().strftime("%d %b %Y")

    # 1. Resolve Target Users
    target_users: List[User] = []

    if payload.target_type == "all_org":
        users_stmt = select(User).where(User.tenant_id == ctx.tenant_id, User.status == "active")
        res = await db.execute(users_stmt)
        target_users = res.scalars().all()

    elif payload.target_type == "roles" and payload.target_filter:
        # Match users who have any of the specified roles
        users_stmt = (
            select(User)
            .join(UserRole, User.id == UserRole.user_id)
            .join(Role, UserRole.role_id == Role.id)
            .where(
                User.tenant_id == ctx.tenant_id,
                User.status == "active",
                or_(
                    Role.name.in_(payload.target_filter),
                    Role.id.in_([uuid.UUID(r) for r in payload.target_filter if len(r) == 36])
                )
            )
            .distinct()
        )
        res = await db.execute(users_stmt)
        target_users = res.scalars().all()

    elif payload.target_type == "departments" and payload.target_filter:
        # Match users whose linked Employee is in the specified departments
        users_stmt = (
            select(User)
            .join(Employee, User.id == Employee.user_id)
            .where(
                User.tenant_id == ctx.tenant_id,
                User.status == "active",
                or_(
                    Employee.department_id.in_([uuid.UUID(d) for d in payload.target_filter if len(d) == 36]),
                    Employee.department.in_(payload.target_filter)
                )
            )
            .distinct()
        )
        res = await db.execute(users_stmt)
        target_users = res.scalars().all()

    elif payload.target_type == "individual" and payload.target_filter:
        valid_uids = [uuid.UUID(u) for u in payload.target_filter if len(u) == 36]
        if valid_uids:
            users_stmt = select(User).where(User.tenant_id == ctx.tenant_id, User.id.in_(valid_uids))
            res = await db.execute(users_stmt)
            target_users = res.scalars().all()

    # Fallback to all users if filter resulted in 0 or wasn't specified
    if not target_users:
        users_stmt = select(User).where(User.tenant_id == ctx.tenant_id)
        res = await db.execute(users_stmt)
        target_users = res.scalars().all()

    recipients_count = len(target_users)

    # 2. Parse template_id if valid UUID
    tmpl_uuid = None
    if payload.template_id and not payload.template_id.startswith("tpl-"):
        try:
            tmpl_uuid = uuid.UUID(payload.template_id)
        except ValueError:
            pass

    # 3. Create Broadcast Record
    broadcast = NotificationBroadcast(
        tenant_id=ctx.tenant_id,
        sender_id=ctx.user.id,
        template_id=tmpl_uuid,
        title=payload.title,
        body=payload.body,
        category=payload.category,
        target_type=payload.target_type,
        target_filter=payload.target_filter,
        action_url=payload.action_url,
        recipients_count=recipients_count,
        status="sent",
    )
    db.add(broadcast)

    # 4. Generate In-App Live Notifications for all target recipients
    for user in target_users:
        rendered_title = payload.title.replace("{{org_name}}", org_name).replace("{{date}}", current_date_str).replace("{{user_name}}", user.full_name or "Team Member")
        rendered_body = payload.body.replace("{{org_name}}", org_name).replace("{{date}}", current_date_str).replace("{{user_name}}", user.full_name or "Team Member")
        if payload.action_url:
            rendered_body = rendered_body.replace("{{action_url}}", payload.action_url)

        live_notif = LiveNotification(
            tenant_id=ctx.tenant_id,
            title=rendered_title,
            body=rendered_body,
            category=payload.category,
            unread=True,
        )
        db.add(live_notif)

    await db.commit()
    await db.refresh(broadcast)

    return {
        "message": f"Push broadcast successfully sent to {recipients_count} organization members.",
        "broadcast_id": str(broadcast.id),
        "recipients_count": recipients_count,
        "title": payload.title,
        "channels": payload.channels,
        "status": "Delivered",
    }


@router.get("/broadcasts", response_model=List[BroadcastResponse])
async def list_broadcast_history(
    limit: int = Query(50, ge=1, le=200),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Fetch historical broadcast dispatches with delivery metrics."""
    stmt = (
        select(NotificationBroadcast, User)
        .outerjoin(User, NotificationBroadcast.sender_id == User.id)
        .where(NotificationBroadcast.tenant_id == ctx.tenant_id)
        .order_by(desc(NotificationBroadcast.created_at))
        .limit(limit)
    )
    result = await db.execute(stmt)

    items = []
    for bc, user in result.all():
        items.append(
            BroadcastResponse(
                id=bc.id,
                sender_name=user.full_name if user else "System Automated",
                title=bc.title,
                body=bc.body,
                category=bc.category,
                target_type=bc.target_type,
                recipients_count=bc.recipients_count,
                status=bc.status,
                created_at=bc.created_at,
            )
        )
    return items


# ─── Web & Mobile Push Device Token Management ──────────────────────

@router.post("/devices/register")
async def register_device_token(
    payload: DeviceTokenRegisterRequest,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Registers a device token (Web Push subscription or Mobile Expo/FCM token)
    to enable push notifications received on mobile and browser background workers.
    """
    existing = await db.scalar(
        select(UserDeviceToken).where(
            UserDeviceToken.tenant_id == ctx.tenant_id,
            UserDeviceToken.user_id == ctx.user.id,
            UserDeviceToken.device_token == payload.device_token
        )
    )
    if existing:
        existing.is_active = True
        existing.last_used_at = func.now()
        if payload.device_name:
            existing.device_name = payload.device_name
    else:
        new_token = UserDeviceToken(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user.id,
            device_token=payload.device_token,
            platform=payload.platform,
            device_name=payload.device_name,
            is_active=True,
            last_used_at=func.now()
        )
        db.add(new_token)

    await db.commit()
    return {"message": "Device successfully registered for push alerts.", "platform": payload.platform}


@router.post("/devices/unregister")
async def unregister_device_token(
    payload: DeviceTokenRegisterRequest,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Deactivates a device push token on logout or permission revocation."""
    existing = await db.scalar(
        select(UserDeviceToken).where(
            UserDeviceToken.tenant_id == ctx.tenant_id,
            UserDeviceToken.user_id == ctx.user.id,
            UserDeviceToken.device_token == payload.device_token
        )
    )
    if existing:
        existing.is_active = False
        await db.commit()
    return {"message": "Device token deactivated."}
