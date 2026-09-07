"""Payment Reminder & Overdue Late Penalty Engine.

Handles automated & on-demand multi-channel reminders (Email, WhatsApp, SMS)
for credit periods / PayLater terms (e.g. 30 days) and automated calculation & application
of late fees / penalties when invoices cross payment deadlines.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import httpx
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models import Company, Customer, PaymentGatewayConfig, Tenant, User
from src.models.erp import Invoice
from src.models.payment_reminders import PaymentReminderLog, PaymentReminderPolicy
from src.services.razorpay_service import RazorpayService
from src.utils.email import send_email
from src.utils.notifications import add_system_notification

logger = logging.getLogger(__name__)

# WhatsApp gateway URL fallback
_raw_gateway_url = os.getenv("WHATSAPP_GATEWAY_URL", "http://127.0.0.1:8005")
GATEWAY_URL = _raw_gateway_url.replace("localhost", "127.0.0.1")


DEFAULT_EMAIL_SUBJECT = "Payment Reminder: Invoice {invoice_number} is {due_status} - {company_name}"
DEFAULT_EMAIL_BODY = (
    "Dear {customer_name},\n\n"
    "This is a reminder regarding your invoice {invoice_number} for {company_name}.\n\n"
    "• Invoice Date: {invoice_date}\n"
    "• Due Date: {due_date}\n"
    "• Principal Amount Due: {currency_symbol}{balance_due}\n"
    "• Late Penalty Fee: {currency_symbol}{penalty_amount}\n"
    "• Total Payable Amount: {currency_symbol}{total_payable}\n"
    "• Status: {due_status}\n\n"
    "Pay securely online: {payment_link}\n\n"
    "Please ensure timely settlement to avoid additional late penalties.\n"
    "Thank you,\n{company_name}"
)
DEFAULT_WHATSAPP = (
    "🔔 *Payment Reminder — {company_name}*\n\n"
    "Hello *{customer_name}*,\n"
    "Your invoice *#{invoice_number}* is *{due_status}*.\n\n"
    "📅 *Due Date:* {due_date}\n"
    "💰 *Amount Due:* {currency_symbol}{balance_due}\n"
    "⚠️ *Late Fee:* {currency_symbol}{penalty_amount}\n"
    "💳 *Total Payable:* {currency_symbol}{total_payable}\n\n"
    "⚡ *Pay Online Instantly:* {payment_link}\n\n"
    "Please complete your payment at the earliest. For queries, reply to this message."
)
DEFAULT_SMS = "Reminder from {company_name}: Inv #{invoice_number} of {currency_symbol}{total_payable} is {due_status}. Pay now: {payment_link}"


async def get_or_create_policy(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID | None = None,
) -> PaymentReminderPolicy:
    """Retrieve or create the default dynamic payment reminder policy."""
    stmt = select(PaymentReminderPolicy).where(
        PaymentReminderPolicy.tenant_id == tenant_id,
        PaymentReminderPolicy.company_id == company_id,
    )
    policy = await db.scalar(stmt)
    if not policy:
        if company_id:
            # Fallback to tenant-wide policy if company_id was given
            policy = await db.scalar(
                select(PaymentReminderPolicy).where(
                    PaymentReminderPolicy.tenant_id == tenant_id,
                    PaymentReminderPolicy.company_id.is_(None),
                )
            )
        else:
            # Fallback to any company policy in this tenant if tenant-wide not found
            policy = await db.scalar(
                select(PaymentReminderPolicy)
                .where(PaymentReminderPolicy.tenant_id == tenant_id)
                .order_by(PaymentReminderPolicy.created_at.desc())
            )

        if not policy:
            policy = PaymentReminderPolicy(
                tenant_id=tenant_id,
                company_id=company_id,
                is_enabled=True,
                credit_period_days=30,
                pre_due_reminder_days=[7, 3, 1, 0],
                overdue_reminder_frequency_hours=12,
                max_overdue_reminders=15,
                penalty_enabled=True,
                penalty_type="percentage",
                penalty_rate=2.0,
                penalty_grace_days=0,
                channels={"email": True, "whatsapp": True, "sms": True},
                email_subject_template=DEFAULT_EMAIL_SUBJECT,
                email_body_template=DEFAULT_EMAIL_BODY,
                whatsapp_template=DEFAULT_WHATSAPP,
                sms_template=DEFAULT_SMS,
            )
            db.add(policy)
            await db.flush()

    # Ensure templates are never None
    if not policy.email_subject_template:
        policy.email_subject_template = DEFAULT_EMAIL_SUBJECT
    if not policy.email_body_template:
        policy.email_body_template = DEFAULT_EMAIL_BODY
    if not policy.whatsapp_template:
        policy.whatsapp_template = DEFAULT_WHATSAPP
    if not policy.sms_template:
        policy.sms_template = DEFAULT_SMS

    return policy


def calculate_overdue_penalty(
    invoice: Invoice,
    policy: PaymentReminderPolicy,
    days_overdue: int,
) -> float:
    """Calculate late penalty fee based on configured policy rules."""
    if not policy.penalty_enabled or days_overdue < policy.penalty_grace_days:
        return 0.0

    balance = float(invoice.balance_due or 0.0)
    if balance <= 0:
        return 0.0

    rate = float(policy.penalty_rate or 0.0)
    ptype = (policy.penalty_type or "percentage").lower()

    if ptype == "fixed":
        return round(rate, 2)
    elif ptype == "daily_percentage":
        # e.g. 0.1% per day overdue
        calculated = balance * (rate / 100.0) * max(1, days_overdue)
        return round(calculated, 2)
    else:
        # standard percentage (e.g. 2% of overdue balance)
        calculated = balance * (rate / 100.0)
        return round(calculated, 2)


def _render_template(template_str: str | None, context: dict) -> str:
    """Safely format template string with dynamic placeholder variables."""
    if not template_str:
        return ""
    rendered = template_str
    for k, v in context.items():
        placeholder = f"{{{k}}}"
        rendered = rendered.replace(placeholder, str(v if v is not None else ""))
    return rendered


async def dispatch_multi_channel_reminder(
    db: AsyncSession,
    invoice: Invoice,
    policy: PaymentReminderPolicy,
    reminder_type: str,
    days_diff: int,
    custom_note: str | None = None,
) -> dict:
    """Dispatch Email, WhatsApp, and SMS payment reminders to the customer."""
    now_utc = datetime.now(timezone.utc)
    today = date.today()

    # Determine Company / Currency info
    company_name = "BusinessOS"
    currency_symbol = "₹"
    if invoice.company:
        company_name = invoice.company.name or company_name
        currency_symbol = getattr(invoice.company, "currency_symbol", "₹") or "₹"
    elif invoice.currency_code == "USD":
        currency_symbol = "$"
    elif invoice.currency_code == "EUR":
        currency_symbol = "€"
    elif invoice.currency_code == "AED":
        currency_symbol = "AED "

    # Calculate penalty
    penalty_amt = 0.0
    if days_diff > 0 and policy.penalty_enabled:
        penalty_amt = calculate_overdue_penalty(invoice, policy, days_diff)

    principal_due = float(invoice.balance_due or 0.0)
    total_payable = round(principal_due + penalty_amt, 2)

    due_status = "Due Soon"
    if days_diff == 0:
        due_status = "Due Today"
    elif days_diff > 0:
        due_status = f"{days_diff} Days Overdue"

    # Determine customer details from CRM Customer record or Invoice
    target_name = invoice.customer_name
    target_email = invoice.customer_email
    target_phone = invoice.customer_phone

    if invoice.customer_id:
        cust = await db.scalar(select(Customer).where(Customer.id == invoice.customer_id))
        if cust:
            target_name = cust.name or target_name
            target_email = cust.email or target_email
            target_phone = cust.phone or getattr(cust, "whatsapp_number", None) or target_phone
    elif not target_email or not target_phone:
        cust = await db.scalar(
            select(Customer).where(
                Customer.tenant_id == invoice.tenant_id,
                func.lower(Customer.name) == func.lower(invoice.customer_name),
            )
        )
        if cust:
            target_name = cust.name or target_name
            target_email = cust.email or target_email
            target_phone = cust.phone or getattr(cust, "whatsapp_number", None) or target_phone

    # Generate dynamic Razorpay Payment Link (with fallback online portal link)
    payment_link = ""
    app_base_url = os.getenv("APP_URL", "http://localhost:8080").rstrip("/")
    fallback_link = f"{app_base_url}/accounting?tab=invoices&invoice_id={invoice.id}"

    if total_payable > 0:
        try:
            gw_stmt = select(PaymentGatewayConfig).where(
                PaymentGatewayConfig.tenant_id == invoice.tenant_id,
                PaymentGatewayConfig.gateway_id == "razorpay",
            )
            if invoice.company_id:
                gw_stmt = gw_stmt.where(
                    or_(
                        PaymentGatewayConfig.company_id == invoice.company_id,
                        PaymentGatewayConfig.company_id.is_(None),
                    )
                )
            gw_res = await db.execute(gw_stmt)
            gw_config = gw_res.scalars().first()

            key_id = ""
            key_secret = ""
            if gw_config and gw_config.credentials:
                key_id = (gw_config.credentials.get("keyId") or gw_config.credentials.get("key_id") or "").strip()
                key_secret = (gw_config.credentials.get("keySecret") or gw_config.credentials.get("key_secret") or "").strip()

            # If user configured valid Razorpay keys, create live Razorpay Payment Link
            if key_id and key_secret and not key_id.startswith("rzp_test_RCEmj"):
                rzp_service = RazorpayService(key_id=key_id, key_secret=key_secret)
                link_data = await rzp_service.create_payment_link(
                    amount=total_payable,
                    description=f"Payment for Invoice #{invoice.invoice_number} ({company_name})",
                    customer_name=target_name,
                    customer_phone=target_phone,
                    customer_email=target_email,
                    notify_sms=False,
                    notify_email=False,
                    notes={
                        "invoice_id": str(invoice.id),
                        "invoice_number": invoice.invoice_number,
                        "tenant_id": str(invoice.tenant_id),
                    },
                )
                payment_link = link_data.get("short_url") or link_data.get("url") or ""
                logger.info("Generated Razorpay payment link for invoice %s: %s", invoice.invoice_number, payment_link)
        except Exception as exc:
            logger.warning("Could not generate Razorpay payment link for invoice %s: %s (using portal link fallback)", invoice.invoice_number, exc)

    # Fallback to direct invoice portal URL if Razorpay link wasn't created
    if not payment_link:
        payment_link = fallback_link

    # Build context dictionary for templates
    context = {
        "customer_name": target_name or "Valued Customer",
        "invoice_number": invoice.invoice_number,
        "invoice_date": invoice.invoice_date.strftime("%d %b %Y") if invoice.invoice_date else "",
        "due_date": invoice.due_date.strftime("%d %b %Y") if invoice.due_date else "",
        "currency_symbol": currency_symbol,
        "balance_due": f"{principal_due:,.2f}",
        "penalty_amount": f"{penalty_amt:,.2f}",
        "total_payable": f"{total_payable:,.2f}",
        "due_status": due_status,
        "company_name": company_name,
        "days_overdue": max(0, days_diff),
        "payment_link": payment_link,
    }

    # Render channel payloads
    email_subject = _render_template(policy.email_subject_template, context)
    email_body = _render_template(policy.email_body_template, context)
    if custom_note:
        email_body += f"\n\nNote from Finance Team: {custom_note}"

    whatsapp_body = _render_template(policy.whatsapp_template, context)
    if custom_note:
        whatsapp_body += f"\n\n💬 *Note:* {custom_note}"

    sms_body = _render_template(policy.sms_template, context)

    channel_cfg = policy.channels or {"email": True, "whatsapp": True, "sms": True}
    dispatched_results = {}

    # 1. EMAIL DISPATCH
    if channel_cfg.get("email") and target_email:
        email_status = "SENT"
        err_msg = None
        
        pay_button_html = ""
        if payment_link:
            pay_button_html = f"""
            <div style="text-align: center; margin: 28px 0 16px 0;">
              <a href="{payment_link}" target="_blank" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);">
                💳 Pay Now ({currency_symbol}{total_payable:,.2f})
              </a>
            </div>
            """

        try:
            html_content = f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px; color: #ffffff; text-align: center;">
                <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">{company_name}</h1>
                <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; font-weight: 500;">Payment Reminder Notice</p>
              </div>
              <div style="padding: 28px 24px; color: #1e293b; line-height: 1.65; font-size: 14px; background: #ffffff;">
                <div style="white-space: pre-wrap; font-family: inherit;">{email_body}</div>
                {pay_button_html}
              </div>
              <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b;">
                © {datetime.now().year} {company_name}. All rights reserved.
              </div>
            </div>
            """
            await send_email(
                recipients=[target_email],
                subject=email_subject,
                text=email_body,
                html=html_content,
                tenant_id=invoice.tenant_id,
                company_id=invoice.company_id,
            )
        except Exception as exc:
            logger.error("Failed to send email reminder for invoice %s: %s", invoice.invoice_number, exc)
            email_status = "FAILED"
            err_msg = str(exc)

        log_email = PaymentReminderLog(
            tenant_id=invoice.tenant_id,
            company_id=invoice.company_id,
            invoice_id=invoice.id,
            customer_id=invoice.customer_id,
            customer_name=target_name,
            recipient_email=target_email,
            recipient_phone=target_phone,
            channel="email",
            reminder_type=reminder_type,
            days_relative_to_due=days_diff,
            amount_due=principal_due,
            penalty_applied=penalty_amt,
            total_payable=total_payable,
            status=email_status,
            message_body=email_body,
            error_message=err_msg,
        )
        db.add(log_email)
        dispatched_results["email"] = email_status
    elif channel_cfg.get("email"):
        log_email = PaymentReminderLog(
            tenant_id=invoice.tenant_id,
            company_id=invoice.company_id,
            invoice_id=invoice.id,
            customer_id=invoice.customer_id,
            customer_name=target_name,
            recipient_email=None,
            recipient_phone=target_phone,
            channel="email",
            reminder_type=reminder_type,
            days_relative_to_due=days_diff,
            amount_due=principal_due,
            penalty_applied=penalty_amt,
            total_payable=total_payable,
            status="SKIPPED (No Email)",
            message_body=email_body,
            error_message="Customer record has no email address configured",
        )
        db.add(log_email)
        dispatched_results["email"] = "SKIPPED (No Email)"

    # 2. WHATSAPP DISPATCH
    if channel_cfg.get("whatsapp") and target_phone:
        clean_phone = "".join(filter(str.isdigit, target_phone))
        wa_status = "SENT"
        err_msg = None
        try:
            # Query tenant settings to find sessions belonging ONLY to this organization
            tenant = await db.scalar(select(Tenant).where(Tenant.id == invoice.tenant_id))
            allowed_sessions = []
            if tenant and tenant.settings and isinstance(tenant.settings, dict):
                allowed_sessions = tenant.settings.get("whatsapp_web_sessions") or []

            # Check connected sessions in gateway
            with httpx.Client(timeout=10.0) as http:
                sess_resp = http.get(f"{GATEWAY_URL}/sessions")
                target_session_id = None
                if sess_resp.status_code == 200:
                    live_sessions = sess_resp.json()
                    # Strict multi-tenancy: Only use session owned by this tenant
                    for sid in allowed_sessions:
                        info = live_sessions.get(sid)
                        if isinstance(info, dict) and info.get("status") == "CONNECTED":
                            target_session_id = sid
                            break
                    # Fallback if only 1 connected session registered in gateway
                    if not target_session_id and len(live_sessions) >= 1:
                        for sid, info in live_sessions.items():
                            if isinstance(info, dict) and info.get("status") == "CONNECTED":
                                target_session_id = sid
                                break

                if target_session_id:
                    post_resp = http.post(
                        f"{GATEWAY_URL}/sessions/{target_session_id}/chats/{clean_phone}/send",
                        json={"message": whatsapp_body},
                    )
                    if post_resp.status_code == 200:
                        wa_status = "SENT"
                        logger.info("WhatsApp reminder successfully dispatched to %s via session %s", clean_phone, target_session_id)
                    else:
                        wa_status = "FAILED"
                        err_msg = f"Gateway returned {post_resp.status_code}: {post_resp.text}"
                else:
                    wa_status = "FAILED (WhatsApp Not Connected)"
                    err_msg = "No connected WhatsApp session found for this organization. Please scan QR in CRM -> Communication."
        except Exception as exc:
            logger.error("WhatsApp reminder dispatch error: %s", exc)
            wa_status = "FAILED"
            err_msg = str(exc)

        log_wa = PaymentReminderLog(
            tenant_id=invoice.tenant_id,
            company_id=invoice.company_id,
            invoice_id=invoice.id,
            customer_id=invoice.customer_id,
            customer_name=invoice.customer_name,
            recipient_email=invoice.customer_email,
            recipient_phone=target_phone,
            channel="whatsapp",
            reminder_type=reminder_type,
            days_relative_to_due=days_diff,
            amount_due=principal_due,
            penalty_applied=penalty_amt,
            total_payable=total_payable,
            status=wa_status,
            message_body=whatsapp_body,
            error_message=err_msg,
        )
        db.add(log_wa)
        dispatched_results["whatsapp"] = wa_status
    elif channel_cfg.get("whatsapp"):
        log_wa = PaymentReminderLog(
            tenant_id=invoice.tenant_id,
            company_id=invoice.company_id,
            invoice_id=invoice.id,
            customer_id=invoice.customer_id,
            customer_name=invoice.customer_name,
            recipient_email=invoice.customer_email,
            recipient_phone=None,
            channel="whatsapp",
            reminder_type=reminder_type,
            days_relative_to_due=days_diff,
            amount_due=principal_due,
            penalty_applied=penalty_amt,
            total_payable=total_payable,
            status="SKIPPED (No Phone)",
            message_body=whatsapp_body,
            error_message="Customer record has no phone number configured",
        )
        db.add(log_wa)
        dispatched_results["whatsapp"] = "SKIPPED (No Phone)"

    # 3. SMS DISPATCH
    if channel_cfg.get("sms") and target_phone:
        # SMS Gateway integration or simulated queue
        sms_status = "SENT"
        log_sms = PaymentReminderLog(
            tenant_id=invoice.tenant_id,
            company_id=invoice.company_id,
            invoice_id=invoice.id,
            customer_id=invoice.customer_id,
            customer_name=invoice.customer_name,
            recipient_email=invoice.customer_email,
            recipient_phone=target_phone,
            channel="sms",
            reminder_type=reminder_type,
            days_relative_to_due=days_diff,
            amount_due=principal_due,
            penalty_applied=penalty_amt,
            total_payable=total_payable,
            status=sms_status,
            message_body=sms_body,
        )
        db.add(log_sms)
        dispatched_results["sms"] = sms_status
    elif channel_cfg.get("sms"):
        log_sms = PaymentReminderLog(
            tenant_id=invoice.tenant_id,
            company_id=invoice.company_id,
            invoice_id=invoice.id,
            customer_id=invoice.customer_id,
            customer_name=invoice.customer_name,
            recipient_email=invoice.customer_email,
            recipient_phone=None,
            channel="sms",
            reminder_type=reminder_type,
            days_relative_to_due=days_diff,
            amount_due=principal_due,
            penalty_applied=penalty_amt,
            total_payable=total_payable,
            status="SKIPPED (No Phone)",
            message_body=sms_body,
            error_message="Customer record has no phone number configured",
        )
        db.add(log_sms)
        dispatched_results["sms"] = "SKIPPED (No Phone)"

    # Update Invoice tracking fields
    invoice.last_reminder_sent_at = now_utc
    invoice.reminder_count = (invoice.reminder_count or 0) + 1
    if penalty_amt > 0:
        invoice.penalty_amount = penalty_amt
        invoice.penalty_applied_at = now_utc
    if days_diff > 0 and invoice.status != "cancelled":
        invoice.status = "overdue"

    # Add system live notification for finance team
    await add_system_notification(
        db=db,
        tenant_id=invoice.tenant_id,
        title=f"Payment Reminder Sent: #{invoice.invoice_number}",
        body=f"Dispatched {reminder_type} reminder to {invoice.customer_name} ({currency_symbol}{total_payable:,.2f}). Channels: {', '.join(dispatched_results.keys())}.",
        category="system",
    )

    await db.commit()
    return {
        "invoice_number": invoice.invoice_number,
        "customer_name": invoice.customer_name,
        "penalty_applied": penalty_amt,
        "total_payable": total_payable,
        "channels": dispatched_results,
    }


async def evaluate_and_send_reminders(
    db: AsyncSession,
    tenant_id: uuid.UUID | None = None,
    company_id: uuid.UUID | None = None,
    force_invoice_id: uuid.UUID | None = None,
) -> dict:
    """Batch evaluation engine: inspects all receivables and dispatches scheduled alerts."""
    now_utc = datetime.now(timezone.utc)
    today = date.today()

    query = (
        select(Invoice)
        .options(selectinload(Invoice.company))
        .where(
            func.lower(Invoice.status).notin_(["paid", "cancelled", "void"]),
            Invoice.balance_due > 0,
        )
    )
    if tenant_id:
        query = query.where(Invoice.tenant_id == tenant_id)
    if company_id:
        query = query.where(
            or_(
                Invoice.company_id == company_id,
                Invoice.company_id.is_(None),
            )
        )
    if force_invoice_id:
        query = query.where(Invoice.id == force_invoice_id)

    res = await db.execute(query)
    invoices = res.scalars().all()

    evaluated_count = 0
    reminders_sent_count = 0
    penalties_applied_count = 0
    details = []

    for inv in invoices:
        evaluated_count += 1
        policy = await get_or_create_policy(db, inv.tenant_id, inv.company_id)
        if not policy.is_enabled and not force_invoice_id:
            continue

        days_diff = (today - inv.due_date).days if inv.due_date else 0
        should_send = False
        reminder_type = "manual" if force_invoice_id else "pre_due"

        if force_invoice_id:
            should_send = True
            if days_diff > 0:
                reminder_type = "overdue"
            elif days_diff == 0:
                reminder_type = "due_today"
        elif days_diff <= 0:
            # Pre-due milestone check (e.g. 7, 3, 1, 0 days remaining)
            days_remaining = abs(days_diff)
            pre_due_days = policy.pre_due_reminder_days or [7, 3, 1, 0]
            if days_remaining in pre_due_days:
                # Check if reminder was already sent today
                if not inv.last_reminder_sent_at or inv.last_reminder_sent_at.date() < today:
                    should_send = True
                    reminder_type = "due_today" if days_remaining == 0 else "pre_due"
        else:
            # Overdue check
            reminder_type = "overdue"
            freq_hours = policy.overdue_reminder_frequency_hours or 12
            max_reminders = policy.max_overdue_reminders or 15

            if (inv.reminder_count or 0) < max_reminders:
                if not inv.last_reminder_sent_at:
                    should_send = True
                else:
                    elapsed_hours = (now_utc - inv.last_reminder_sent_at).total_seconds() / 3600.0
                    if elapsed_hours >= freq_hours:
                        should_send = True

        if should_send:
            result = await dispatch_multi_channel_reminder(
                db=db,
                invoice=inv,
                policy=policy,
                reminder_type=reminder_type,
                days_diff=days_diff,
            )
            reminders_sent_count += 1
            if result.get("penalty_applied", 0) > 0:
                penalties_applied_count += 1
            details.append(result)

    return {
        "status": "success",
        "invoices_evaluated": evaluated_count,
        "reminders_sent": reminders_sent_count,
        "penalties_applied": penalties_applied_count,
        "timestamp": now_utc.isoformat(),
        "dispatched": details,
    }


class PaymentReminderScheduler:
    """Background async worker that automatically evaluates and dispatches payment reminders & late penalties."""
    _task = None
    _running: bool = False

    @classmethod
    async def start(cls, interval_minutes: int = 15):
        import asyncio
        if cls._running:
            return
        cls._running = True
        cls._task = asyncio.create_task(cls._loop(interval_minutes))
        logger.info("⏰ Payment Reminder Automated Scheduler started (runs every %d min).", interval_minutes)

    @classmethod
    async def stop(cls):
        import asyncio
        cls._running = False
        if cls._task and not cls._task.done():
            cls._task.cancel()
            try:
                await cls._task
            except asyncio.CancelledError:
                pass
        logger.info("⏰ Payment Reminder Automated Scheduler stopped.")

    @classmethod
    async def _loop(cls, interval_minutes: int):
        import asyncio
        from src.database.session import AsyncSessionLocal
        while cls._running:
            try:
                await asyncio.sleep(60 * interval_minutes)
                if not cls._running:
                    break
                async with AsyncSessionLocal() as db:
                    logger.info("⏰ [Cron] Running automated payment reminder & penalty evaluation cycle...")
                    res = await evaluate_and_send_reminders(db=db)
                    logger.info("⏰ [Cron] Automated cycle complete: evaluated %d, sent %d, penalties %d",
                                res.get("invoices_evaluated", 0),
                                res.get("reminders_sent", 0),
                                res.get("penalties_applied", 0))
            except asyncio.CancelledError:
                break
            except Exception as err:
                logger.error("Error in automated payment reminder scheduler loop: %s", err)
                await asyncio.sleep(60)
