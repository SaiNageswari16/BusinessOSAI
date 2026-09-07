"""API Endpoints for Payment Reminders & Overdue Late Penalties."""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission
from src.database.session import get_db
from src.models.erp import Invoice
from src.models.payment_reminders import PaymentReminderLog, PaymentReminderPolicy
from src.services.payment_reminder_engine import (
    dispatch_multi_channel_reminder,
    evaluate_and_send_reminders,
    get_or_create_policy,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/invoices/reminders", tags=["Payment Reminders & Penalties"])


class PolicyUpdatePayload(BaseModel):
    is_enabled: bool = True
    credit_period_days: int = Field(default=30, ge=1, le=365)
    pre_due_reminder_days: list[int] = Field(default=[7, 3, 1, 0])
    overdue_reminder_frequency_hours: int = Field(default=12, ge=1, le=168)
    max_overdue_reminders: int = Field(default=15, ge=1, le=100)
    penalty_enabled: bool = True
    penalty_type: str = "percentage"  # "percentage", "fixed", "daily_percentage"
    penalty_rate: float = 2.0
    penalty_grace_days: int = 0
    channels: dict = Field(default_factory=lambda: {"email": True, "whatsapp": True, "sms": True})
    email_subject_template: str | None = None
    email_body_template: str | None = None
    whatsapp_template: str | None = None
    sms_template: str | None = None


class SendManualReminderPayload(BaseModel):
    custom_note: str | None = None


@router.get("/policy")
async def get_policy(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:invoices"))],
    db: AsyncSession = Depends(get_db),
):
    """Fetch active Payment Reminder and Late Penalty Policy for the current workspace."""
    policy = await get_or_create_policy(db, ctx.tenant_id, ctx.active_company_id)
    return {
        "id": str(policy.id),
        "is_enabled": policy.is_enabled,
        "credit_period_days": policy.credit_period_days,
        "pre_due_reminder_days": policy.pre_due_reminder_days or [7, 3, 1, 0],
        "overdue_reminder_frequency_hours": policy.overdue_reminder_frequency_hours or 12,
        "max_overdue_reminders": policy.max_overdue_reminders or 15,
        "penalty_enabled": policy.penalty_enabled,
        "penalty_type": policy.penalty_type,
        "penalty_rate": float(policy.penalty_rate or 0),
        "penalty_grace_days": policy.penalty_grace_days,
        "channels": policy.channels or {"email": True, "whatsapp": True, "sms": True},
        "email_subject_template": policy.email_subject_template,
        "email_body_template": policy.email_body_template,
        "whatsapp_template": policy.whatsapp_template,
        "sms_template": policy.sms_template,
    }


@router.put("/policy")
async def update_policy(
    payload: PolicyUpdatePayload,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:invoices"))],
    db: AsyncSession = Depends(get_db),
):
    """Update dynamic Payment Reminder rules, overdue frequencies, penalty rates, and templates."""
    policy = await get_or_create_policy(db, ctx.tenant_id, ctx.active_company_id)
    policy.is_enabled = payload.is_enabled
    policy.credit_period_days = payload.credit_period_days
    policy.pre_due_reminder_days = payload.pre_due_reminder_days
    policy.overdue_reminder_frequency_hours = payload.overdue_reminder_frequency_hours
    policy.max_overdue_reminders = payload.max_overdue_reminders
    policy.penalty_enabled = payload.penalty_enabled
    policy.penalty_type = payload.penalty_type
    policy.penalty_rate = payload.penalty_rate
    policy.penalty_grace_days = payload.penalty_grace_days
    policy.channels = payload.channels
    if payload.email_subject_template is not None:
        policy.email_subject_template = payload.email_subject_template
    if payload.email_body_template is not None:
        policy.email_body_template = payload.email_body_template
    if payload.whatsapp_template is not None:
        policy.whatsapp_template = payload.whatsapp_template
    if payload.sms_template is not None:
        policy.sms_template = payload.sms_template

    await db.commit()
    await db.refresh(policy)
    return {"message": "Payment reminder policy updated successfully"}


@router.post("/evaluate-batch")
async def evaluate_batch_reminders(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:invoices"))],
    db: AsyncSession = Depends(get_db),
):
    """Run batch evaluation across all receivables to apply overdue penalties and dispatch alerts."""
    result = await evaluate_and_send_reminders(
        db=db,
        tenant_id=ctx.tenant_id,
        company_id=ctx.active_company_id,
    )
    return result


@router.post("/invoices/{invoice_id}/send-now")
async def send_single_invoice_reminder(
    invoice_id: uuid.UUID,
    payload: SendManualReminderPayload,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:invoices"))],
    db: AsyncSession = Depends(get_db),
):
    """Send immediate dynamic reminder (Email, WhatsApp, SMS) for a specific invoice."""
    invoice = await db.scalar(
        select(Invoice)
        .options(selectinload(Invoice.company))
        .where(
            Invoice.id == invoice_id,
            Invoice.tenant_id == ctx.tenant_id,
        )
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    policy = await get_or_create_policy(db, ctx.tenant_id, invoice.company_id)
    today = date.today()
    days_diff = (today - invoice.due_date).days if invoice.due_date else 0

    reminder_type = "manual"
    if days_diff > 0:
        reminder_type = "overdue"
    elif days_diff == 0:
        reminder_type = "due_today"

    result = await dispatch_multi_channel_reminder(
        db=db,
        invoice=invoice,
        policy=policy,
        reminder_type=reminder_type,
        days_diff=days_diff,
        custom_note=payload.custom_note,
    )
    return {"message": "Payment reminder dispatched successfully", "result": result}


@router.get("/logs")
async def list_reminder_logs(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:invoices"))],
    channel: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List history of sent payment reminders, channels, and penalties applied."""
    stmt = select(PaymentReminderLog).where(PaymentReminderLog.tenant_id == ctx.tenant_id)
    if ctx.active_company_id:
        stmt = stmt.where(
            or_(
                PaymentReminderLog.company_id == ctx.active_company_id,
                PaymentReminderLog.company_id.is_(None),
            )
        )
    if channel:
        stmt = stmt.where(PaymentReminderLog.channel == channel)

    stmt = stmt.order_by(desc(PaymentReminderLog.created_at)).limit(limit)
    res = await db.execute(stmt)
    logs = res.scalars().all()

    return [
        {
            "id": str(l.id),
            "invoice_id": str(l.invoice_id),
            "customer_name": l.customer_name,
            "recipient_email": l.recipient_email,
            "recipient_phone": l.recipient_phone,
            "channel": l.channel,
            "reminder_type": l.reminder_type,
            "days_relative_to_due": l.days_relative_to_due,
            "amount_due": float(l.amount_due or 0),
            "penalty_applied": float(l.penalty_applied or 0),
            "total_payable": float(l.total_payable or 0),
            "status": l.status,
            "message_body": l.message_body,
            "error_message": l.error_message,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]


@router.get("/summary")
async def get_reminder_summary(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:invoices"))],
    db: AsyncSession = Depends(get_db),
):
    """Get live receivables overview: overdue count, penalties accrued, and upcoming dues."""
    today = date.today()
    invoices_stmt = select(Invoice).where(
        Invoice.tenant_id == ctx.tenant_id,
        func.lower(Invoice.status).notin_(["paid", "cancelled", "void"]),
        Invoice.balance_due > 0,
    )
    if ctx.active_company_id:
        invoices_stmt = invoices_stmt.where(
            or_(
                Invoice.company_id == ctx.active_company_id,
                Invoice.company_id.is_(None),
            )
        )

    res = await db.execute(invoices_stmt)
    invoices = res.scalars().all()

    total_pending_balance = 0.0
    total_penalty_accrued = 0.0
    overdue_count = 0
    overdue_amount = 0.0
    due_today_count = 0
    due_within_7d_count = 0

    items_preview = []

    for inv in invoices:
        bal = float(inv.balance_due or 0.0)
        pen = float(inv.penalty_amount or 0.0)
        total_pending_balance += bal
        total_penalty_accrued += pen

        days_diff = (today - inv.due_date).days if inv.due_date else 0
        is_overdue = days_diff > 0

        if is_overdue:
            overdue_count += 1
            overdue_amount += bal + pen
        elif days_diff == 0:
            due_today_count += 1
        elif 0 < abs(days_diff) <= 7:
            due_within_7d_count += 1

        items_preview.append({
            "id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "customer_name": inv.customer_name,
            "customer_email": inv.customer_email,
            "customer_phone": inv.customer_phone,
            "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
            "due_date": inv.due_date.isoformat() if inv.due_date else None,
            "principal_due": bal,
            "penalty_amount": pen,
            "total_payable": bal + pen,
            "status": inv.status,
            "days_diff": days_diff,
            "last_reminder_sent_at": inv.last_reminder_sent_at.isoformat() if inv.last_reminder_sent_at else None,
            "reminder_count": inv.reminder_count or 0,
        })

    # Sort: overdue first, then nearest due date
    items_preview.sort(key=lambda x: -x["days_diff"])

    return {
        "total_pending_balance": total_pending_balance,
        "total_penalty_accrued": total_penalty_accrued,
        "total_receivables": total_pending_balance + total_penalty_accrued,
        "overdue_count": overdue_count,
        "overdue_amount": overdue_amount,
        "due_today_count": due_today_count,
        "due_within_7d_count": due_within_7d_count,
        "invoices": items_preview,
    }
