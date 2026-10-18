"""Notification endpoints — templates, logs, broadcasts.

Sending is delegated to a pluggable provider (WhatsApp gateway, SMS, email).
This router only manages templates and the delivery log; the actual send is
queued so a slow provider never blocks a request.
"""
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission, resolve_outlet_id
from src.database.session import get_db
from src.models import (
    Customer,
    NotificationChannel,
    NotificationLog,
    NotificationStatus,
    NotificationTemplate,
)
from src.schemas.notifications import (
    BroadcastRequest,
    BroadcastResponse,
    NotificationLogResponse,
    NotificationTemplateCreate,
    NotificationTemplateResponse,
    NotificationTemplateUpdate,
)
from src.services.kot_service import _status_value
from src.services.notification_service import (
    SUPPORTED_VARIABLES,
    render_template,
    validate_variables,
)
from src.utils.phone import clean_phone

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Templates ───────────────────────────────────────────────────

@router.get("/templates", response_model=list[NotificationTemplateResponse])
async def list_templates(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:settings"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    event: str | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(NotificationTemplate).where(
        NotificationTemplate.tenant_id == ctx.tenant_id
    )
    if outlet_id:
        stmt = stmt.where(NotificationTemplate.outlet_id == outlet_id)
    if event:
        stmt = stmt.where(NotificationTemplate.event == event)
    stmt = stmt.order_by(NotificationTemplate.event, NotificationTemplate.name)

    return [
        NotificationTemplateResponse.model_validate(t)
        for t in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/templates", response_model=NotificationTemplateResponse,
             status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: NotificationTemplateCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:settings"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id, required=False)

    # One template per event per channel per outlet
    clash = await db.scalar(
        select(NotificationTemplate.id).where(
            NotificationTemplate.tenant_id == ctx.tenant_id,
            NotificationTemplate.event == payload.event,
            NotificationTemplate.channel == payload.channel,
            NotificationTemplate.outlet_id == payload.outlet_id,
        )
    )
    if clash:
        raise HTTPException(
            status_code=409,
            detail=f"A {_status_value(payload.channel)} template for "
                   f"'{payload.event}' already exists here",
        )

    # Catch typos in {{placeholders}} before they send blank messages
    unknown = validate_variables(payload.body, payload.variables)
    if unknown:
        raise HTTPException(
            status_code=422,
            detail=f"Body uses variables not declared: {', '.join(unknown)}",
        )

    template = NotificationTemplate(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return NotificationTemplateResponse.model_validate(template)


@router.get("/templates/{template_id}", response_model=NotificationTemplateResponse)
async def get_template(
    template_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:settings"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    template = await db.scalar(
        select(NotificationTemplate).where(
            NotificationTemplate.id == template_id,
            NotificationTemplate.tenant_id == ctx.tenant_id,
        )
    )
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.outlet_id:
        resolve_outlet_id(ctx, template.outlet_id)
    return NotificationTemplateResponse.model_validate(template)


@router.put("/templates/{template_id}", response_model=NotificationTemplateResponse)
async def update_template(
    template_id: uuid.UUID,
    payload: NotificationTemplateUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:settings"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    template = await db.scalar(
        select(NotificationTemplate).where(
            NotificationTemplate.id == template_id,
            NotificationTemplate.tenant_id == ctx.tenant_id,
        )
    )
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.outlet_id:
        resolve_outlet_id(ctx, template.outlet_id)

    data = payload.model_dump(exclude_unset=True)

    body = data.get("body", template.body)
    variables = data.get("variables", template.variables)
    unknown = validate_variables(body, variables or [])
    if unknown:
        raise HTTPException(
            status_code=422,
            detail=f"Body uses variables not declared: {', '.join(unknown)}",
        )

    for field, value in data.items():
        setattr(template, field, value)

    await db.commit()
    await db.refresh(template)
    return NotificationTemplateResponse.model_validate(template)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:settings"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    template = await db.scalar(
        select(NotificationTemplate).where(
            NotificationTemplate.id == template_id,
            NotificationTemplate.tenant_id == ctx.tenant_id,
        )
    )
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.outlet_id:
        resolve_outlet_id(ctx, template.outlet_id)

    await db.delete(template)
    await db.commit()


@router.get("/templates/variables/supported", response_model=list[str])
async def supported_variables(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:settings"))],
):
    """For the template editor's autocomplete."""
    return sorted(SUPPORTED_VARIABLES)


@router.post("/templates/{template_id}/preview")
async def preview_template(
    template_id: uuid.UUID,
    variables: dict,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:settings"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Render the template with sample data without sending anything."""
    template = await db.scalar(
        select(NotificationTemplate).where(
            NotificationTemplate.id == template_id,
            NotificationTemplate.tenant_id == ctx.tenant_id,
        )
    )
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.outlet_id:
        resolve_outlet_id(ctx, template.outlet_id)

    body = render_template(template.body, variables)
    subject = render_template(template.subject, variables) if template.subject else None

    return {
        "subject": subject,
        "body": body,
        "channel": _status_value(template.channel),
    }


# ─── Logs ────────────────────────────────────────────────────────

@router.get("/logs", response_model=list[NotificationLogResponse])
async def list_logs(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:settings"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    channel: str | None = None,
    recipient: str | None = None,
    limit: int = 100,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(NotificationLog).where(NotificationLog.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(NotificationLog.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(NotificationLog.status == status_filter)
    if channel:
        stmt = stmt.where(NotificationLog.channel == channel)
    if recipient:
        digits = clean_phone(recipient)
        stmt = stmt.where(NotificationLog.recipient.like(f"%{digits}%"))
    stmt = stmt.order_by(NotificationLog.created_at.desc()).limit(limit)

    return [
        NotificationLogResponse.model_validate(l)
        for l in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/logs/{log_id}/retry", response_model=NotificationLogResponse)
async def retry_notification(
    log_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:settings"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Re-queue a failed send."""
    log = await db.scalar(
        select(NotificationLog).where(
            NotificationLog.id == log_id, NotificationLog.tenant_id == ctx.tenant_id
        )
    )
    if log is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    if log.outlet_id:
        resolve_outlet_id(ctx, log.outlet_id)

    if _status_value(log.status) == NotificationStatus.SENT.value:
        raise HTTPException(status_code=409, detail="This notification already went out")

    log.status = NotificationStatus.PENDING
    log.error = None
    await db.commit()
    await db.refresh(log)
    return NotificationLogResponse.model_validate(log)


# ─── Broadcasts ──────────────────────────────────────────────────

@router.post("/broadcast", response_model=BroadcastResponse)
async def broadcast(
    payload: BroadcastRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:settings"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Queue an ad-hoc message to a list of phone numbers or emails.

    Recipients are queued as PENDING log rows; the worker delivers them.
    """
    resolve_outlet_id(ctx, payload.outlet_id, required=False)

    body = render_template(payload.body, payload.variables)
    subject = render_template(payload.subject, payload.variables) if payload.subject else None

    # Normalise recipients — phones become digits, emails stay lowercase
    seen: set[str] = set()
    recipients: list[str] = []
    for raw in payload.recipients:
        value = clean_phone(raw) if "@" not in raw else raw.strip().lower()
        if value and value not in seen:
            seen.add(value)
            recipients.append(value)

    if not recipients:
        raise HTTPException(status_code=422, detail="No valid recipients supplied")

    logs: list[NotificationLog] = []
    for recipient in recipients:
        logs.append(NotificationLog(
            tenant_id=ctx.tenant_id,
            outlet_id=payload.outlet_id,
            template_id=None,
            event=payload.event,
            channel=_status_value(payload.channel),
            recipient=recipient,
            payload={
                "subject": subject,
                "body": body,
                "variables": payload.variables,
            },
            status=NotificationStatus.PENDING,
        ))

    db.add_all(logs)
    await db.commit()

    for log in logs:
        await db.refresh(log)

    return BroadcastResponse(
        queued=len(logs),
        failed=0,
        log_ids=[log.id for log in logs],
    )


# ─── Customer-driven sends ───────────────────────────────────────

@router.post("/send-to-customer/{customer_id}", response_model=NotificationLogResponse)
async def send_to_customer(
    customer_id: uuid.UUID,
    event: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:settings"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    channel: str = "whatsapp",
    variables: dict | None = None,
):
    """Send the active template for an event to one customer."""
    customer = await db.scalar(
        select(Customer).where(
            Customer.id == customer_id, Customer.tenant_id == ctx.tenant_id
        )
    )
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.outlet_id:
        resolve_outlet_id(ctx, customer.outlet_id)

    template = await db.scalar(
        select(NotificationTemplate).where(
            NotificationTemplate.tenant_id == ctx.tenant_id,
            NotificationTemplate.event == event,
            NotificationTemplate.channel == channel,
            NotificationTemplate.is_active.is_(True),
        )
    )
    if template is None:
        raise HTTPException(
            status_code=404,
            detail=f"No active '{channel}' template for event '{event}'",
        )

    # Customer details are always available to templates
    merged = {
        "customer_name": customer.name,
        "customer_phone": customer.phone,
        **(variables or {}),
    }

    recipient = clean_phone(customer.phone)
    if channel == "email":
        if not customer.email:
            raise HTTPException(
                status_code=422, detail="This customer has no email address"
            )
        recipient = customer.email.lower()

    log = NotificationLog(
        tenant_id=ctx.tenant_id,
        outlet_id=customer.outlet_id or ctx.outlet_id,
        template_id=template.id,
        event=event,
        channel=channel,
        recipient=recipient,
        payload={
            "subject": render_template(template.subject, merged) if template.subject else None,
            "body": render_template(template.body, merged),
            "variables": merged,
        },
        status=NotificationStatus.PENDING,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return NotificationLogResponse.model_validate(log)
