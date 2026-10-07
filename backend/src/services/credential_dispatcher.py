"""
Unified Credential & Verification Code Dispatcher.
Dispatches user login credentials, temporary password, and 6-digit first-time activation code
simultaneously via Email (SMTP) and WhatsApp (Connected Gateway Session).

Two Operating Tiers:
  1. Level 1 (Platform Admin God Mode -> New Tenant Admin):
     - Dispatches via Platform Master SMTP + Platform Master WhatsApp Session.
  2. Level 2 (Tenant Admin -> Organization Users / Employees):
     - Dispatches via Tenant SMTP + Tenant's Connected Self-Org WhatsApp Session.
"""
import asyncio
import logging
import os
import re
import uuid
from typing import Any
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.models import Tenant, User
from src.utils.email import send_email, resolve_email_config

logger = logging.getLogger(__name__)

# Force 127.0.0.1 to avoid Windows IPv6 resolution ambiguity
_raw_gateway_url = os.getenv("WHATSAPP_GATEWAY_URL", "http://127.0.0.1:8005")
GATEWAY_URL = _raw_gateway_url.replace("localhost", "127.0.0.1")


def _clean_phone(phone: str | None) -> str:
    """Normalize recipient phone number to digits only, auto-prepending 91 for 10-digit Indian numbers."""
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 10:
        digits = "91" + digits
    return digits


def _clean_session_id(session_id: str | None) -> str:
    """Normalize session ID without altering country code prefix."""
    if not session_id:
        return ""
    return re.sub(r"\D", "", str(session_id))


async def _resolve_whatsapp_session(db: AsyncSession | None, tenant_settings: dict | None, is_platform_level: bool) -> str | None:
    """
    Strictly resolves the configured WhatsApp session ID based on operating tier.
    NO fallbacks:
      - Level 1: Platform Master session configured in Platform Admin settings or active connected gateway session.
      - Level 2: Tenant Organization's self-linked WhatsApp session.
    """
    if is_platform_level:
        try:
            from src.database.session import async_session_maker
            async with async_session_maker() as session:
                god_tenant = await session.scalar(
                    select(Tenant).where((Tenant.slug == "admin") | (Tenant.slug == "master")).limit(1)
                )
                if not god_tenant:
                    god_tenant = await session.scalar(select(Tenant).order_by(Tenant.created_at.asc()).limit(1))

                if god_tenant and god_tenant.settings and isinstance(god_tenant.settings, dict):
                    plat_sess = god_tenant.settings.get("platform_whatsapp_session_id")
                    if plat_sess:
                        return _clean_session_id(str(plat_sess))
        except Exception as db_err:
            logger.debug("Database error resolving god tenant settings: %s", db_err)

        return None
    else:
        try:
            if tenant_settings and isinstance(tenant_settings, dict):
                active_sessions = tenant_settings.get("whatsapp_web_sessions") or []
                if active_sessions and len(active_sessions) > 0:
                    return _clean_session_id(str(active_sessions[0]))
        except Exception as err:
            logger.debug("Error checking tenant whatsapp session: %s", err)
        return None


async def send_whatsapp_media(
    session_id: str,
    recipient_phone: str,
    pdf_bytes: bytes,
    file_name: str,
    caption: str,
) -> dict:
    """Send PDF document file directly via WhatsApp Gateway /send-media endpoint with fallback to text."""
    import base64
    clean_phone = _clean_phone(recipient_phone)
    clean_sess = _clean_session_id(session_id)
    if not clean_phone:
        return {"success": False, "error": "Invalid recipient phone number"}
    if not clean_sess:
        return {"success": False, "error": "Invalid WhatsApp session ID"}

    pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")
    payload = {
        "mimeType": "application/pdf",
        "data": pdf_b64,
        "fileName": file_name,
        "caption": caption,
    }
    media_timeout = httpx.Timeout(connect=10.0, read=90.0, write=90.0, pool=10.0)
    try:
        async with httpx.AsyncClient(timeout=media_timeout) as http:
            resp = await http.post(
                f"{GATEWAY_URL}/sessions/{clean_sess}/chats/{clean_phone}/send-media",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info("WhatsApp SLA PDF media dispatched to %s via session +%s: %s", clean_phone, clean_sess, data)
            return data
    except Exception as exc:
        logger.warning("WhatsApp send-media failed to %s via session +%s: %s, falling back to text dispatch", clean_phone, clean_sess, exc)
        return await send_whatsapp_text(session_id, recipient_phone, caption)


async def send_whatsapp_text(session_id: str, recipient_phone: str, message: str) -> dict:
    """Send text message directly via WhatsApp Gateway."""
    clean_phone = _clean_phone(recipient_phone)
    clean_sess = _clean_session_id(session_id)
    if not clean_phone:
        return {"success": False, "error": "Invalid recipient phone number"}
    if not clean_sess:
        return {"success": False, "error": "Invalid WhatsApp session ID"}

    payload = {"message": message}
    timeout = httpx.Timeout(connect=6.0, read=45.0, write=45.0, pool=6.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as http:
            resp = await http.post(
                f"{GATEWAY_URL}/sessions/{clean_sess}/chats/{clean_phone}/send",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info("WhatsApp text dispatched to %s via session +%s: %s", clean_phone, clean_sess, data)
            return data
    except Exception as exc:
        logger.warning("WhatsApp message dispatch failed to %s via session +%s: %s", clean_phone, clean_sess, exc)
        return {"success": False, "error": str(exc)}


async def dispatch_user_onboarding_credentials(
    db: AsyncSession | None = None,
    user: Any = None,
    tenant: Any = None,
    temp_password: str = "",
    verification_code: str = "",
    is_platform_level: bool = False,
    login_url: str | None = None,
    invoice_details: dict | None = None,
) -> dict:
    """
    Simultaneously dispatches login credentials, temporary password,
    6-digit first-time activation verification code, and optional subscription invoice details
    to both Email (SMTP) and WhatsApp (Gateway).
    Extracts all attributes safely to avoid greenlet/expired attribute issues in background tasks.
    """
    cfg = get_settings()
    frontend_url = login_url or cfg.frontend_url or "http://localhost:8080"

    # Safely extract scalar attributes to avoid greenlet/expired ORM issues
    user_email = str(getattr(user, "email", "") or "")
    user_full_name = str(getattr(user, "full_name", "") or "")
    user_phone = str(getattr(user, "phone", "") or getattr(user, "whatsapp_number", "") or "")
    tenant_name = str(getattr(tenant, "name", "") or "Workspace")
    tenant_slug = str(getattr(tenant, "slug", "") or "")
    tenant_id = getattr(tenant, "id", None)
    tenant_settings = getattr(tenant, "settings", None) or {}

    portal_login_link = f"{frontend_url.rstrip('/')}/login?tenant={tenant_slug}&email={user_email}"

    results = {
        "email_sent": False,
        "whatsapp_sent": False,
        "email_detail": None,
        "whatsapp_detail": None,
    }

    # 1. ─── Prepare Content & Generate PDF Document ───
    tier_title = "Platform Administrator" if is_platform_level else f"{tenant_name} Team"
    
    email_subject = f"Welcome to {tenant_name} — {'Subscription Agreement & ' if invoice_details else ''}First-Time Login & Verification Code"
    
    invoice_email_section = ""
    invoice_wa_section = ""
    pdf_bytes = None
    inv_num = "INV-N/A"

    if invoice_details and isinstance(invoice_details, dict):
        inv_num = invoice_details.get("invoice_number", "INV-N/A")
        plan_name = str(invoice_details.get("plan", "Enterprise")).upper()
        tenure_str = f"{invoice_details.get('tenure_value', 12)} {invoice_details.get('tenure_unit', 'months')}"
        tot_amt = invoice_details.get("total_amount", 0.0)
        curr = invoice_details.get("currency", "INR")
        pay_st = str(invoice_details.get("payment_status", "paid")).upper()
        sla_tier = invoice_details.get("sla_tier", "Enterprise Gold (99.9% Uptime)")

        invoice_email_section = (
            f"🧾 SUBSCRIPTION INVOICE & AGREEMENT:\n"
            f"• Invoice Number: {inv_num}\n"
            f"• Plan: {plan_name} Cloud License\n"
            f"• Tenure Term: {tenure_str}\n"
            f"• Total Amount: {curr} {tot_amt:,.2f}\n"
            f"• Payment Status: {pay_st}\n"
            f"• SLA Guarantee: {sla_tier}\n\n"
        )
        invoice_wa_section = (
            f"🧾 *Subscription Invoice & Agreement:*\n"
            f"• *Invoice #:* `{inv_num}`\n"
            f"• *Plan:* `{plan_name}` ({tenure_str})\n"
            f"• *Amount:* `{curr} {tot_amt:,.2f}` ({pay_st})\n"
            f"• *SLA:* {sla_tier}\n\n"
        )

        try:
            from src.api.v1.system_admin import generate_subscription_sla_pdf
            pdf_bytes = generate_subscription_sla_pdf(tenant, user, invoice_details)
        except Exception as pdf_err:
            logger.warning("Failed to render SLA PDF for onboarding: %s", pdf_err)
            pdf_bytes = None

    invoice_html_section = ""
    if invoice_details and isinstance(invoice_details, dict):
        inv_num = invoice_details.get("invoice_number", "INV-N/A")
        plan_name = str(invoice_details.get("plan", "Enterprise")).upper()
        tenure_str = f"{invoice_details.get('tenure_value', 12)} {invoice_details.get('tenure_unit', 'months')}"
        tot_amt = invoice_details.get("total_amount", 0.0)
        curr = invoice_details.get("currency", "INR")
        pay_st = str(invoice_details.get("payment_status", "paid")).upper()
        sla_tier = invoice_details.get("sla_tier", "Enterprise Gold (99.9% Uptime)")

        invoice_html_section = f"""
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #0f172a; margin-top: 0; font-size: 16px;">🧾 Subscription Invoice & SLA Summary</h3>
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; color: #64748b;">Invoice #:</td><td style="font-weight: bold; color: #0f172a;">{inv_num}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Plan:</td><td style="font-weight: bold; color: #0f172a;">{plan_name} Cloud License ({tenure_str})</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Total Amount:</td><td style="font-weight: bold; color: #059669;">{curr} {tot_amt:,.2f} ({pay_st})</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">SLA Guarantee:</td><td style="font-weight: bold; color: #0f172a;">{sla_tier}</td></tr>
            </table>
        </div>
        """

    email_html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; padding: 20px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #0ea5e9, #0284c7); padding: 30px 24px; text-align: center; color: #ffffff;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 800;">Welcome to {tenant_name}</h1>
                <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">{cfg.app_name} Workspace Activation</p>
            </div>
            <div style="padding: 28px 24px; color: #334155;">
                <p style="font-size: 15px; margin-top: 0;">Hello <strong>{user_full_name}</strong>,</p>
                <p style="font-size: 14px; color: #475569;">Your workspace account has been provisioned. Please use the credentials and first-time verification code below to activate your account.</p>
                
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0;">
                    <h3 style="color: #0f172a; margin-top: 0; font-size: 16px;">🔐 Login Credentials</h3>
                    <p style="margin: 6px 0; font-size: 14px;"><strong>Workspace:</strong> {tenant_name} ({tenant_slug})</p>
                    <p style="margin: 6px 0; font-size: 14px;"><strong>Username / Email:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">{user_email}</code></p>
                    <p style="margin: 6px 0; font-size: 14px;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">{temp_password}</code></p>
                </div>

                <div style="background-color: #ecfdf5; border: 2px dashed #10b981; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
                    <p style="margin: 0 0 6px; font-size: 12px; font-weight: bold; color: #065f46; text-transform: uppercase; letter-spacing: 1px;">First-Time Verification Code</p>
                    <div style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #047857; font-family: monospace;">{verification_code}</div>
                    <p style="margin: 6px 0 0; font-size: 12px; color: #047857;">Enter this 6-digit code on the login portal to verify your account.</p>
                </div>

                {invoice_html_section}

                <div style="text-align: center; margin: 28px 0;">
                    <a href="{portal_login_link}" style="background-color: #0284c7; color: #ffffff; padding: 14px 32px; font-size: 15px; font-weight: bold; text-decoration: none; border-radius: 10px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">Login to Workspace</a>
                </div>

                <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">
                    Best regards,<br>
                    <strong>{tier_title}</strong><br>
                    {cfg.app_name} Security System
                </p>
            </div>
        </div>
    </body>
    </html>
    """

    email_text = (
        f"Hello {user_full_name},\n\n"
        f"Your workspace account has been provisioned on {cfg.app_name} for '{tenant_name}'.\n\n"
        f"════════════════════════════════════════════════\n"
        f"🔐 YOUR LOGIN CREDENTIALS:\n"
        f"• Workspace: {tenant_name} ({tenant_slug})\n"
        f"• Username / Email: {user_email}\n"
        f"• Temporary Password: {temp_password}\n\n"
        f"🛡️ FIRST-TIME VERIFICATION CODE:\n"
        f"👉  {verification_code}  👈\n"
        f"════════════════════════════════════════════════\n\n"
        f"{invoice_email_section}"
        f"Please visit the login portal to activate your account:\n"
        f"🔗 Login URL: {portal_login_link}\n\n"
        f"Instructions:\n"
        f"1. Enter your Email and Temporary Password on the login screen.\n"
        f"2. When prompted, enter your 6-digit Verification Code: {verification_code}\n"
        f"3. Set your new permanent password to secure your account.\n\n"
        f"Best regards,\n"
        f"{tier_title}\n"
        f"{cfg.app_name} Security System"
    )

    whatsapp_message = (
        f"👋 *Welcome to {tenant_name}!* ({cfg.app_name})\n\n"
        f"Your workspace user account and subscription are ready for activation.\n\n"
        f"🔐 *Login Credentials:*\n"
        f"• *Workspace:* {tenant_name}\n"
        f"• *Username / Email:* `{user_email}`\n"
        f"• *Temporary Password:* `{temp_password}`\n\n"
        f"🛡️ *First-Time Activation Code:*\n"
        f"👉 *{verification_code}*\n\n"
        f"{invoice_wa_section}"
        f"🌐 *Login Portal:* {portal_login_link}\n\n"
        f"_Please enter this 6-digit code on your first login to verify and set your new password._"
    )

    # 2. ─── Email Dispatch (SMTP) ───
    try:
        custom_mail_cfg = None
        if isinstance(tenant_settings, dict):
            t_email = tenant_settings.get("email_settings")
            if isinstance(t_email, dict) and t_email.get("mail_server"):
                custom_mail_cfg = t_email

        email_success = await send_email(
            subject=email_subject,
            recipients=[user_email],
            text=email_text,
            html=email_html,
            attachment_bytes=pdf_bytes,
            attachment_filename=f"Master_SLA_Invoice_{inv_num}.pdf" if pdf_bytes else None,
            db=db,
            custom_config=custom_mail_cfg,
            tenant_id=None if is_platform_level else tenant_id,
        )
        results["email_sent"] = bool(email_success)
        results["email_detail"] = "Sent successfully" if email_success else "SMTP returned false"
        logger.info("Onboarding email dispatch result for %s: %s", user_email, results["email_detail"])
    except Exception as err:
        logger.warning("Failed to dispatch onboarding email to %s: %s", user_email, err)
        results["email_detail"] = str(err)

    # 3. ─── WhatsApp Dispatch (PDF Media document or text) ───
    try:
        if user_phone:
            session_id = await _resolve_whatsapp_session(db, tenant_settings, is_platform_level)
            if session_id:
                if pdf_bytes:
                    wa_res = await send_whatsapp_media(
                        session_id=session_id,
                        recipient_phone=user_phone,
                        pdf_bytes=pdf_bytes,
                        file_name=f"Subscription_Invoice_{inv_num}.pdf",
                        caption=whatsapp_message,
                    )
                else:
                    wa_res = await send_whatsapp_text(session_id, user_phone, whatsapp_message)

                if wa_res.get("success") or wa_res.get("messageId") or wa_res.get("id"):
                    results["whatsapp_sent"] = True
                    results["whatsapp_detail"] = "Sent via session +" + session_id
                else:
                    results["whatsapp_detail"] = wa_res.get("error", "Gateway dispatch failed")
            else:
                results["whatsapp_detail"] = "No active WhatsApp session connected"
        else:
            results["whatsapp_detail"] = "No phone number provided on user record"
        logger.info("Onboarding WhatsApp dispatch result for %s: %s", user_phone, results["whatsapp_detail"])
    except Exception as wa_err:
        logger.warning("Failed to dispatch WhatsApp credentials to %s: %s", user_email, wa_err)
        results["whatsapp_detail"] = str(wa_err)

    return results


async def dispatch_verification_code_resend(
    db: AsyncSession | None = None,
    user: Any = None,
    tenant: Any = None,
    verification_code: str = "",
    is_platform_level: bool = False,
) -> dict:
    """Dispatches a resent 6-digit verification code to both Email and WhatsApp."""
    cfg = get_settings()
    results = {"email_sent": False, "whatsapp_sent": False}

    user_email = str(getattr(user, "email", "") or "")
    user_full_name = str(getattr(user, "full_name", "") or "")
    user_phone = str(getattr(user, "phone", "") or getattr(user, "whatsapp_number", "") or "")
    tenant_name = str(getattr(tenant, "name", "") or "Workspace")
    tenant_id = getattr(tenant, "id", None)
    tenant_settings = getattr(tenant, "settings", None) or {}

    tier_title = "Platform Administrator" if is_platform_level else f"{tenant_name} Team"

    email_subject = f"Your Security Verification Code — {tenant_name}"
    email_text = (
        f"Hello {user_full_name},\n\n"
        f"A new verification code was requested for your account on {tenant_name} ({cfg.app_name}).\n\n"
        f"════════════════════════════════════════════════\n"
        f"🛡️ NEW VERIFICATION CODE:\n"
        f"👉  {verification_code}  👈\n"
        f"════════════════════════════════════════════════\n\n"
        f"This code will expire in 15 minutes.\n\n"
        f"Best regards,\n"
        f"{tier_title}\n"
        f"{cfg.app_name} Security Team"
    )

    whatsapp_message = (
        f"🛡️ *Security Verification Code* — {tenant_name}\n\n"
        f"Hello {user_full_name},\n"
        f"Your new 6-digit verification code is:\n\n"
        f"👉 *{verification_code}*\n\n"
        f"_(Valid for 15 minutes. Enter this code on the login screen to activate your account.)_"
    )

    # Email
    try:
        email_success = await send_email(
            subject=email_subject,
            recipients=[user_email],
            text=email_text,
            db=db,
            tenant_id=None if is_platform_level else tenant_id,
        )
        results["email_sent"] = bool(email_success)
    except Exception as err:
        logger.warning("Failed to resend email code: %s", err)

    # WhatsApp
    try:
        if user_phone:
            session_id = await _resolve_whatsapp_session(db, tenant_settings, is_platform_level)
            if session_id:
                wa_res = await send_whatsapp_text(session_id, user_phone, whatsapp_message)
                if wa_res.get("success") or wa_res.get("messageId") or wa_res.get("id"):
                    results["whatsapp_sent"] = True
    except Exception as wa_err:
        logger.warning("Failed to resend WhatsApp code: %s", wa_err)

    return results
