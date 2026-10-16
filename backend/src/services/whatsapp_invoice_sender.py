"""Invoice Multi-Channel Sender — dispatch invoice PDFs to customers via WhatsApp & SMTP Email.

Flow:
  1. Look up the tenant's active invoice DocumentTemplate.
  2. Render the PDF using that template's styling.
  3. Dispatch via WhatsApp Gateway /send-media or SMTP email with PDF attachment.
  4. Log a LiveNotification + LeadActivity.
"""
from __future__ import annotations

import base64
import logging
import os
import re
import uuid
from datetime import datetime
from typing import Any

import httpx
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Company, Customer, Lead, LeadActivity, Tenant, POSTransaction
from src.models.erp import Invoice
from src.services.invoice_pdf import (
    get_active_invoice_template,
    get_invoice_pdf_path,
    save_invoice_pdf,
)
from src.utils.email import send_email
from src.utils.notifications import add_system_notification

logger = logging.getLogger(__name__)

# WhatsApp gateway URL
_raw_gateway_url = os.getenv("WHATSAPP_GATEWAY_URL", "http://127.0.0.1:8005")
GATEWAY_URL = _raw_gateway_url.replace("localhost", "127.0.0.1")


class InvoiceSendError(Exception):
    """Raised when invoice dispatch via WhatsApp or Email fails."""


WhatsappInvoiceSendError = InvoiceSendError


def _fmt_amount(value: float | None) -> str:
    if value is None:
        return "0.00"
    return f"{float(value):,.2f}"


async def _get_gateway_session_id(allowed_sessions: list[str] | None = None) -> str | None:
    """Return the phone number (session id) of the first CONNECTED or AUTHENTICATED WhatsApp session belonging to the tenant."""
    if allowed_sessions is not None and len(allowed_sessions) == 0:
        return None
    try:
        async with httpx.AsyncClient(timeout=4.0) as http:
            resp = await http.get(f"{GATEWAY_URL}/sessions")
            if resp.status_code != 200:
                return None
            sessions = resp.json()
            if not isinstance(sessions, dict):
                return None

            # Filter sessions to only allowed tenant sessions if specified
            candidate_ids = allowed_sessions if allowed_sessions is not None else list(sessions.keys())

            # 1. First priority: fully CONNECTED session
            for sid in candidate_ids:
                sid_str = str(sid).strip()
                variants = [sid_str]
                if sid_str.startswith("91"):
                    variants.append(sid_str[2:])
                else:
                    variants.append(f"91{sid_str}")
                for variant in variants:
                    info = sessions.get(variant)
                    if isinstance(info, dict) and info.get("status") == "CONNECTED":
                        return variant

            # 2. Second priority: AUTHENTICATED session
            for sid in candidate_ids:
                sid_str = str(sid).strip()
                variants = [sid_str]
                if sid_str.startswith("91"):
                    variants.append(sid_str[2:])
                else:
                    variants.append(f"91{sid_str}")
                for variant in variants:
                    info = sessions.get(variant)
                    if isinstance(info, dict) and info.get("status") == "AUTHENTICATED":
                        return variant
    except Exception as exc:
        logger.warning("Could not reach WhatsApp gateway for session lookup: %s", exc)
    return None


def _get_user_owned_session_ids(tenant_settings: dict, user_id: uuid.UUID | str) -> list[str]:
    owner_id = str(user_id)
    owners = tenant_settings.get("agent_whatsapp_sessions") or {}
    allowed_sessions = list(tenant_settings.get("whatsapp_web_sessions") or [])
    owned_sessions = []
    for session_id in allowed_sessions:
        variants = {session_id}
        if session_id.startswith("91"):
            variants.add(session_id[2:])
        else:
            variants.add(f"91{session_id}")
        if any(str(owners.get(variant) or "") == owner_id for variant in variants):
            owned_sessions.append(session_id)
    return owned_sessions


async def _send_via_gateway(
    session_id: str,
    recipient_phone: str,
    pdf_b64: str,
    invoice_number: str,
    customer_name: str,
    total_amount: float = 0.0,
    balance_due: float = 0.0,
) -> dict:
    """Proxy the PDF to the WhatsApp gateway with fallback to rich text invoice summary."""
    # Normalize phone: remove non-digits and ensure country code
    clean_phone = re.sub(r"[^0-9]", "", recipient_phone)
    if len(clean_phone) == 10:
        clean_phone = f"91{clean_phone}"

    caption = (
        f"Dear {customer_name}, thank you for your purchase!\n"
        f"Your invoice *{invoice_number}* is attached.\n"
        f"Grand Total: *Rs. {total_amount:,.2f}*\n"
        f"Balance Due: *Rs. {balance_due:,.2f}*\n\n"
        f"For any queries, please reply to this message."
    )

    payload = {
        "mimeType": "application/pdf",
        "data": pdf_b64,
        "fileName": f"Invoice_{invoice_number}.pdf",
        "caption": caption,
    }
    media_timeout = httpx.Timeout(connect=10.0, read=120.0, write=120.0, pool=10.0)
    text_timeout = httpx.Timeout(connect=10.0, read=60.0, write=60.0, pool=10.0)
    try:
        async with httpx.AsyncClient(timeout=media_timeout) as http:
            resp = await http.post(
                f"{GATEWAY_URL}/sessions/{session_id}/chats/{clean_phone}/send-media",
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as media_err:
        err_detail = ""
        if hasattr(media_err, "response") and media_err.response is not None:
            try:
                err_detail = f" | Gateway Error: {media_err.response.text}"
            except Exception:
                pass
        logger.warning("WhatsApp send-media failed (%s%s), falling back to text dispatch...", media_err, err_detail)
        async with httpx.AsyncClient(timeout=text_timeout) as http2:
            resp2 = await http2.post(
                f"{GATEWAY_URL}/sessions/{session_id}/chats/{clean_phone}/send",
                json={"message": caption},
            )
            resp2.raise_for_status()
            return resp2.json()


async def send_invoice_whatsapp(
    db: AsyncSession,
    invoice: Invoice,
    recipient_phone: str | None = None,
) -> dict:
    """Send *invoice* as a PDF to the customer's WhatsApp number."""
    # 0. Check Company WhatsApp communication toggle
    comp_id = getattr(invoice, "company_id", None)
    if comp_id:
        comp = await db.get(Company, comp_id)
        if comp:
            if getattr(comp, "whatsapp_enabled", True) is False:
                raise InvoiceSendError(
                    f"WhatsApp communication is turned OFF for company '{comp.name}' in Integrations -> WhatsApp settings."
                )
            wa_settings = getattr(comp, "whatsapp_settings", {}) or {}
            if isinstance(wa_settings, dict) and wa_settings.get("auto_send_invoices") is False:
                raise InvoiceSendError(
                    "Automated invoice dispatch via WhatsApp is turned OFF in Integrations -> WhatsApp settings."
                )

    # 1. Resolve recipient
    phone = (recipient_phone or getattr(invoice, "customer_phone", None) or "").strip()
    if not phone and getattr(invoice, "customer_id", None):
        crm_phone = await db.scalar(
            select(Customer.phone).where(Customer.id == invoice.customer_id)
        )
        if crm_phone:
            phone = crm_phone.strip()
    if not phone and getattr(invoice, "customer_name", None):
        crm_phone = await db.scalar(
            select(Customer.phone).where(Customer.name == invoice.customer_name)
        )
        if crm_phone:
            phone = crm_phone.strip()

    if not phone:
        raise InvoiceSendError("Customer has no WhatsApp phone number on file.")

    # 2. Load tenant's active invoice template (prefer active A4 invoice template for official tax invoices)
    raw_tpl_id = str(getattr(invoice, "print_template_id", "") or getattr(invoice, "template_id", "") or "").lower()
    is_thermal = (
        (raw_tpl_id in ("thermal", "receipt") or "tpl-thm-" in raw_tpl_id)
        and not str(getattr(invoice, "invoice_number", "")).upper().startswith(("INV-", "TAX-", "QT-", "PI-", "EST-"))
    )
    cat = "thermal" if is_thermal else "invoices"
    template = await get_active_invoice_template(db, invoice.tenant_id, getattr(invoice, "company_id", None), category=cat)

    # Ensure invoice relationships (lines, payments, company) are eagerly loaded in memory
    inv_id = getattr(invoice, "id", None)
    if inv_id and db:
        inv_loaded = (
            await db.execute(
                select(Invoice)
                .options(
                    selectinload(Invoice.lines),
                    selectinload(Invoice.payments),
                    selectinload(Invoice.company),
                )
                .where(Invoice.id == inv_id)
            )
        ).scalar_one_or_none()
        if inv_loaded:
            invoice = inv_loaded

    # 3. Find connected gateway session strictly for this tenant
    tenant = await db.get(Tenant, invoice.tenant_id)
    tenant_allowed_sessions = list((tenant.settings or {}).get("whatsapp_web_sessions") or []) if tenant else []
    session_id = await _get_gateway_session_id(tenant_allowed_sessions)
    if session_id is None:
        raise InvoiceSendError(
            "No active WhatsApp session is connected for this organization. "
            "Please connect WhatsApp from CRM → WhatsApp Automation."
        )

    # 4. Generate fresh PDF with the active/selected template
    try:
        logger.info("Generating invoice PDF for WhatsApp: %s (thermal=%s)", getattr(invoice, "invoice_number", ""), is_thermal)
        pdf_path = save_invoice_pdf(invoice, template)
        pdf_b64 = base64.b64encode(pdf_path.read_bytes()).decode("ascii")
    except Exception as exc:
        raise InvoiceSendError(f"Failed to generate invoice PDF: {exc}") from exc

    # 5. Send via gateway
    try:
        gateway_res = await _send_via_gateway(
            session_id=session_id,
            recipient_phone=phone,
            pdf_b64=pdf_b64,
            invoice_number=invoice.invoice_number or str(invoice.id),
            customer_name=invoice.customer_name or "Customer",
            total_amount=float(getattr(invoice, "total_amount", 0.0) or 0.0),
            balance_due=float(getattr(invoice, "balance_due", 0.0) or 0.0),
        )
        message_id = gateway_res.get("message_id")
        logger.info(
            "Invoice %s sent via WhatsApp to %s (message_id=%s)",
            invoice.invoice_number, phone, message_id,
        )
    except httpx.HTTPStatusError as exc:
        raise InvoiceSendError(
            f"WhatsApp gateway rejected the send ({exc.response.status_code}): {exc.response.text}"
        ) from exc
    except Exception as exc:
        raise InvoiceSendError(f"WhatsApp send failed: {exc}") from exc

    # 6. LiveNotification
    try:
        await add_system_notification(
            db=db,
            tenant_id=invoice.tenant_id,
            title=f"Invoice {invoice.invoice_number} sent via WhatsApp",
            body=(
                f"Invoice {invoice.invoice_number} (Rs. {invoice.total_amount:,.2f}) "
                f"was sent to {invoice.customer_name} on WhatsApp."
            ),
            category="crm",
        )
    except Exception as exc:
        logger.warning("Could not create LiveNotification for invoice send: %s", exc)

    # 7. LeadActivity
    try:
        lead_res = await db.execute(
            select(Lead).where(
                Lead.tenant_id == invoice.tenant_id,
                Lead.phone == phone,
            )
        )
        lead = lead_res.scalars().first()
        if lead:
            activity = LeadActivity(
                tenant_id=invoice.tenant_id,
                lead_id=lead.id,
                activity_type="whatsapp_sent",
                summary=f"Invoice {invoice.invoice_number} PDF sent via WhatsApp",
                occurred_at=datetime.utcnow(),
            )
            db.add(activity)
            lead.last_contact_at = datetime.utcnow()
            lead.status = "Contacted"
    except Exception as exc:
        logger.warning("Could not create LeadActivity for invoice send: %s", exc)

    return {
        "success": True,
        "message_id": message_id,
        "error": None,
        "session_id": session_id,
    }

async def get_active_org_whatsapp_session(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID | None = None,
    cashier_user_id: uuid.UUID | None = None,
) -> str | None:
    """
    Find and return the active WhatsApp session belonging to the organization.
    Prioritizes the organization-level connected session (Tenant settings & Company settings),
    falling back to cashier user session or any active gateway session.
    """
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        return None
    tenant_settings = tenant.settings if isinstance(tenant.settings, dict) else {}

    company = None
    if company_id:
        company = await db.get(Company, company_id)
    if not company and tenant_id:
        company = await db.scalar(
            select(Company).where(Company.tenant_id == tenant_id).order_by(Company.created_at.asc()).limit(1)
        )

    # 1. Gather all Organization-level WhatsApp sessions
    org_sessions: list[str] = []
    for s in tenant_settings.get("whatsapp_web_sessions") or []:
        if s and str(s) not in org_sessions:
            org_sessions.append(str(s))

    default_sess = tenant_settings.get("default_whatsapp_session") or tenant_settings.get("whatsapp_session_id")
    if default_sess and str(default_sess) not in org_sessions:
        org_sessions.insert(0, str(default_sess))

    if company:
        comp_wa = getattr(company, "whatsapp_settings", {}) or {}
        if isinstance(comp_wa, dict):
            comp_sess = comp_wa.get("session_id") or comp_wa.get("whatsapp_session_id")
            if comp_sess and str(comp_sess) not in org_sessions:
                org_sessions.insert(0, str(comp_sess))
            for cs in comp_wa.get("whatsapp_web_sessions") or []:
                if cs and str(cs) not in org_sessions:
                    org_sessions.append(str(cs))

    # Priority 1: Official Organization Session (per organization / tenant)
    session_id = await _get_gateway_session_id(org_sessions) if org_sessions else None

    # Priority 2: Fallback to cashier personal session if org session not directly active
    if not session_id and cashier_user_id:
        cashier_sessions = _get_user_owned_session_ids(tenant_settings, cashier_user_id)
        if cashier_sessions:
            session_id = await _get_gateway_session_id(cashier_sessions)

    # Priority 3: Fallback to any active gateway session
    if not session_id:
        session_id = await _get_gateway_session_id(None)

    return session_id


async def send_pos_receipt_whatsapp(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID | None,
    cashier_user_id: uuid.UUID,
    receipt_number: str,
    recipient_phone: str,
    receipt_pdf_base64: str,
) -> dict:
    """Send the POS terminal's rendered thermal receipt via the organization's WhatsApp session."""
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise InvoiceSendError("Organization not found for POS receipt delivery.")
    tenant_settings = tenant.settings if isinstance(tenant.settings, dict) else {}

    # Check tenant master toggle
    if tenant_settings.get("whatsapp_enabled") is False:
        raise InvoiceSendError("WhatsApp communication is turned OFF for this organization.")

    company = None
    if company_id:
        company = await db.get(Company, company_id)
    if not company and tenant_id:
        company = await db.scalar(
            select(Company).where(Company.tenant_id == tenant_id).order_by(Company.created_at.asc()).limit(1)
        )

    if company:
        if getattr(company, "whatsapp_enabled", True) is False:
            raise InvoiceSendError("WhatsApp communication is turned OFF for this company.")
        settings = getattr(company, "whatsapp_settings", {}) or {}
        if isinstance(settings, dict) and settings.get("auto_send_pos") is False:
            raise InvoiceSendError("Automatic POS receipt delivery is turned OFF in WhatsApp settings.")

    clean_phone = re.sub(r"[^0-9]", "", recipient_phone)
    if len(clean_phone) == 10:
        clean_phone = f"91{clean_phone}"
    if len(clean_phone) < 7:
        raise InvoiceSendError("Customer has no valid WhatsApp phone number on file.")

    valid_pdf = False
    if receipt_pdf_base64:
        try:
            clean_b64 = str(receipt_pdf_base64).strip()
            if "," in clean_b64:
                clean_b64 = clean_b64.split(",", 1)[1]
            base64.b64decode(clean_b64, validate=True)
            valid_pdf = True
            receipt_pdf_base64 = clean_b64
        except Exception:
            logger.warning("POS receipt PDF base64 decode failed, will fallback to text delivery")

    # Prioritize and take the organization's WhatsApp session
    session_id = await get_active_org_whatsapp_session(
        db=db,
        tenant_id=tenant_id,
        company_id=company_id or (company.id if company else None),
        cashier_user_id=cashier_user_id,
    )

    if not session_id:
        raise InvoiceSendError(
            "No active WhatsApp session is connected for this organization. "
            "Please connect your organization WhatsApp in CRM → WhatsApp Automation."
        )

    logger.info(
        "Dispatching POS receipt %s via Organization WhatsApp session %s (tenant=%s)",
        receipt_number,
        session_id,
        tenant_id,
    )

    safe_receipt_number = re.sub(r"[^A-Za-z0-9_-]", "_", receipt_number)
    
    # Prefer the ERP Invoice if one was generated for this receipt (contains full item names, tax breakdowns, customer info)
    inv_record = await db.scalar(
        select(Invoice)
        .options(
            selectinload(Invoice.lines),
            selectinload(Invoice.payments),
        )
        .where(
            or_(
                Invoice.reference_number == receipt_number,
                Invoice.invoice_number == receipt_number,
            ),
            Invoice.tenant_id == tenant_id,
        )
    )

    tx = None
    if not inv_record:
        tx = await db.scalar(
            select(POSTransaction)
            .options(
                selectinload(POSTransaction.items),
                selectinload(POSTransaction.payments),
            )
            .where(
                POSTransaction.receipt_number == receipt_number,
                POSTransaction.tenant_id == tenant_id,
            )
        )

    target_record = inv_record or tx

    # If client did not provide thermal PDF base64, render it from the active thermal template
    if not valid_pdf:
        try:
            from src.services.invoice_pdf import _render_thermal_receipt_pdf
            thermal_tpl = await get_active_invoice_template(
                db,
                tenant_id=tenant_id,
                company_id=company_id or (company.id if company else None),
                category="thermal",
            )
            if target_record:
                # If target_record is a POSTransaction, enrich items with product_name if missing
                if tx and target_record is tx and getattr(tx, "items", None):
                    p_ids = [it.product_id for it in tx.items if getattr(it, "product_id", None)]
                    if p_ids:
                        from src.models.inventory import Product
                        prods = (await db.scalars(select(Product).where(Product.id.in_(p_ids)))).all()
                        p_map = {p.id: p.name for p in prods}
                        for it in tx.items:
                            if it.product_id in p_map and not getattr(it, "product_name", None):
                                setattr(it, "product_name", p_map[it.product_id])

                raw_thermal_pdf = _render_thermal_receipt_pdf(target_record, thermal_tpl)
                receipt_pdf_base64 = base64.b64encode(raw_thermal_pdf).decode("ascii")
                valid_pdf = True
                logger.info("Generated server-side thermal receipt PDF for %s using template: %s", receipt_number, thermal_tpl.get("name"))
        except Exception as gen_err:
            logger.warning("Server-side thermal receipt PDF generation failed: %s", gen_err)

    store_name = (company.name if company else None) or (tenant.name if tenant else None) or "Store"
    target_total = getattr(target_record, "total_amount", None)
    total_line = f"💵 *Total: ₹{float(target_total):.2f}*\n" if target_total is not None else ""
    date_line = f"📅 Date: {datetime.now().strftime('%d/%m/%Y %I:%M %p')}\n"

    caption = (
        f"🧾 *{store_name}*\n"
        f"*RECEIPT #{receipt_number}*\n"
        f"{date_line}"
        f"{total_line}"
        f"Thank you for shopping with us!\n"
        f"Your thermal receipt is attached.\n\n"
        f"For any queries, please keep this receipt handy."
    )

    text_receipt = (
        f"🧾 *{store_name}*\n"
        f"*RECEIPT #{receipt_number}*\n"
        f"{date_line}"
        f"{total_line}"
        f"Thank you for shopping with us!\n\n"
        f"For any queries, please keep this receipt handy."
    )

    result = {}
    media_sent = False
    if valid_pdf:
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(connect=5.0, read=20.0, write=20.0, pool=5.0)) as http:
                response = await http.post(
                    f"{GATEWAY_URL}/sessions/{session_id}/chats/{clean_phone}/send-media",
                    json={
                        "mimeType": "application/pdf",
                        "data": receipt_pdf_base64,
                        "fileName": f"POS_Receipt_{safe_receipt_number}.pdf",
                        "caption": caption,
                    },
                )
                if response.status_code == 200:
                    result = response.json()
                    media_sent = True
                else:
                    logger.warning("WhatsApp send-media status %s: %s", response.status_code, response.text)
        except Exception as exc:
            logger.warning("WhatsApp send-media failed, attempting text fallback: %s", exc)

    if not media_sent:
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(connect=5.0, read=15.0, write=15.0, pool=5.0)) as http:
                response = await http.post(
                    f"{GATEWAY_URL}/sessions/{session_id}/chats/{clean_phone}/send-message",
                    json={"message": text_receipt},
                )
                response.raise_for_status()
                result = response.json()
        except Exception as txt_exc:
            raise InvoiceSendError(f"Could not send POS receipt via WhatsApp: {txt_exc}") from txt_exc

    try:
        await add_system_notification(
            db=db,
            tenant_id=tenant_id,
            title=f"POS receipt {receipt_number} sent via WhatsApp",
            body=f"POS receipt {receipt_number} was delivered to {clean_phone} on WhatsApp.",
            category="pos",
        )
        await db.commit()
    except Exception as exc:
        logger.warning("Could not record POS receipt WhatsApp notification: %s", exc)

    import urllib.parse
    wa_url = f"https://api.whatsapp.com/send?phone={clean_phone}&text={urllib.parse.quote(caption)}"

    return {
        "success": True,
        "message_id": result.get("message_id"),
        "session_id": session_id,
        "whatsapp_url": wa_url,
    }


async def send_invoice_email(
    db: AsyncSession,
    invoice: Invoice,
    recipient_email: str | None = None,
) -> dict:
    """Send *invoice* as a PDF attachment to customer's email via configured SMTP."""
    # 0. Check Company Email communication toggle
    comp_id = getattr(invoice, "company_id", None)
    if comp_id:
        comp = await db.get(Company, comp_id)
        if comp and getattr(comp, "email_enabled", True) is False:
            raise InvoiceSendError(
                f"Email communication is turned OFF for company '{comp.name}' in Company Settings."
            )

    # 1. Resolve recipient email
    email = (recipient_email or getattr(invoice, "customer_email", None) or "").strip()
    if not email and getattr(invoice, "customer_id", None):
        crm_email = await db.scalar(
            select(Customer.email).where(Customer.id == invoice.customer_id)
        )
        if crm_email:
            email = crm_email.strip()
    if not email and getattr(invoice, "customer_name", None):
        crm_email = await db.scalar(
            select(Customer.email).where(Customer.name == invoice.customer_name)
        )
        if crm_email:
            email = crm_email.strip()

    if not email:
        raise InvoiceSendError("Customer has no email address on file. Please enter recipient email.")

    # 2. Resolve Tenant / Branding
    tenant = await db.get(Tenant, invoice.tenant_id)
    tenant_settings = (tenant.settings if tenant and isinstance(tenant.settings, dict) else {})
    org_name = tenant_settings.get("trade_name") or (tenant.name if tenant else "BusinessOS AI Global")

    # 3. Load tenant's active invoice template
    template = await get_active_invoice_template(db, invoice.tenant_id, getattr(invoice, "company_id", None))

    # Ensure invoice relationships (lines, payments, company) are eagerly loaded in memory
    inv_id = getattr(invoice, "id", None)
    if inv_id and db:
        inv_loaded = (
            await db.execute(
                select(Invoice)
                .options(
                    selectinload(Invoice.lines),
                    selectinload(Invoice.payments),
                    selectinload(Invoice.company),
                )
                .where(Invoice.id == inv_id)
            )
        ).scalar_one_or_none()
        if inv_loaded:
            invoice = inv_loaded

    # 4. Use already generated/saved PDF if it exists, or generate once
    try:
        saved_pdf_path = get_invoice_pdf_path(invoice)
        if saved_pdf_path.exists() and saved_pdf_path.stat().st_size > 100:
            pdf_bytes = saved_pdf_path.read_bytes()
        else:
            pdf_path = save_invoice_pdf(invoice, template)
            pdf_bytes = pdf_path.read_bytes()
    except Exception as exc:
        raise InvoiceSendError(f"Failed to generate invoice PDF: {exc}") from exc

    inv_num = invoice.invoice_number or str(invoice.id)
    safe_number = "".join(c if c.isalnum() or c in "-_" else "_" for c in inv_num)
    filename = f"Invoice_{safe_number}.pdf"
    cust_name = invoice.customer_name or "Valued Client"
    total_amt = float(getattr(invoice, "total_amount", 0.0) or 0.0)
    bal_due = float(getattr(invoice, "balance_due", 0.0) or 0.0)
    is_paid = getattr(invoice, "status", "").lower() == "paid" or bal_due <= 0.05
    inv_date = str(getattr(invoice, "invoice_date", "") or datetime.utcnow().strftime("%d %b %Y"))

    # Render items HTML table summary
    items_rows_html = ""
    for line in getattr(invoice, "lines", []):
        p_name = getattr(line, "product_name", None) or "Item"
        qty = float(getattr(line, "quantity", 1) or 1)
        price = float(getattr(line, "unit_price", 0) or 0)
        tot = float(getattr(line, "line_total", 0) or (qty * price))
        items_rows_html += f"""
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 8px; color: #1e293b; font-weight: 500;">{p_name}</td>
          <td style="padding: 10px 8px; text-align: center; color: #64748b;">{qty:g}</td>
          <td style="padding: 10px 8px; text-align: right; color: #64748b;">Rs. {_fmt_amount(price)}</td>
          <td style="padding: 10px 8px; text-align: right; font-weight: 600; color: #0f172a;">Rs. {_fmt_amount(tot)}</td>
        </tr>
        """

    doc_type_label = "Proforma Invoice" if getattr(invoice, "invoice_type", "").lower() == "proforma" or str(inv_num).startswith("PI-") else "Tax Invoice"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 20px; }}
        .card {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }}
        .header {{ border-bottom: 2px solid #2563eb; padding-bottom: 18px; margin-bottom: 20px; }}
        .badge {{ display: inline-block; background: #eff6ff; color: #2563eb; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; }}
        .badge-paid {{ background: #ecfdf5; color: #059669; }}
        .total-box {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 24px 0; }}
        .footer {{ text-align: center; font-size: 11px; color: #94a3b8; margin-top: 28px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span class="badge {('badge-paid' if is_paid else '')}">{doc_type_label}</span>
          <h2 style="margin: 8px 0 0 0; color: #0f172a;">{org_name}</h2>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Invoice Ref: <strong>#{inv_num}</strong> &bull; Date: {inv_date}</p>
        </div>
        <p>Dear <strong>{cust_name}</strong>,</p>
        <p>Thank you for your business. Please find attached your official {doc_type_label} <strong>#{inv_num}</strong>.</p>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 20px 0;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left; color: #475569; font-size: 11px; text-transform: uppercase;">
              <th style="padding: 8px;">Item Description</th>
              <th style="padding: 8px; text-align: center;">Qty</th>
              <th style="padding: 8px; text-align: right;">Unit Price</th>
              <th style="padding: 8px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            {items_rows_html or f'<tr><td colspan="4" style="padding: 10px; text-align: center; color: #94a3b8;">Document #{inv_num}</td></tr>'}
          </tbody>
        </table>

        <div class="total-box">
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="color: #64748b;">Grand Total:</td>
              <td style="text-align: right; font-weight: 800; color: #0f172a; font-size: 16px;">Rs. {_fmt_amount(total_amt)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding-top: 4px;">Payment Status:</td>
              <td style="text-align: right; font-weight: 700; color: {('#059669' if is_paid else '#dc2626')}; padding-top: 4px;">
                {('PAID IN FULL' if is_paid else f'BALANCE DUE (Rs. {_fmt_amount(bal_due)})')}
              </td>
            </tr>
          </table>
        </div>

        <p style="font-size: 13px; color: #475569;">
          The complete official PDF document has been attached to this email for your tax accounting and bookkeeping records.
        </p>

        <p style="margin-top: 24px; font-size: 13px; font-weight: 600;">
          Warm regards,<br>
          <span style="color: #2563eb;">{org_name} Billing Team</span>
        </p>

        <div class="footer">
          <p>Generated automatically via {org_name} BusinessOS AI ERP.</p>
        </div>
      </div>
    </body>
    </html>
    """

    subject = f"{doc_type_label} #{inv_num} from {org_name}"
    text_body = (
        f"Dear {cust_name},\n\n"
        f"Thank you for your business. Please find attached your official {doc_type_label} #{inv_num} for Rs. {total_amt:,.2f}.\n"
        f"Status: {'PAID' if is_paid else f'Balance Due Rs. {bal_due:,.2f}'}\n\n"
        f"Best regards,\n{org_name}"
    )

    success = await send_email(
        subject=subject,
        recipients=email,
        html=html_body,
        text=text_body,
        company_id=getattr(invoice, "company_id", None),
        tenant_id=invoice.tenant_id,
        attachment_bytes=pdf_bytes,
        attachment_filename=filename,
        db=db,
    )

    if not success:
        raise InvoiceSendError("SMTP server dispatch failed. Please verify SMTP settings in Settings -> Email/Communication.")

    # 6. LiveNotification
    try:
        await add_system_notification(
            db=db,
            tenant_id=invoice.tenant_id,
            title=f"Invoice {inv_num} emailed to customer",
            body=f"Invoice #{inv_num} PDF was emailed to {email}.",
            category="crm",
        )
    except Exception as exc:
        logger.warning("Notification creation failed: %s", exc)

    # 7. LeadActivity
    try:
        lead_res = await db.execute(
            select(Lead).where(
                Lead.tenant_id == invoice.tenant_id,
                (Lead.email == email) | (Lead.phone == (invoice.customer_phone or "")),
            )
        )
        lead = lead_res.scalars().first()
        if lead:
            activity = LeadActivity(
                tenant_id=invoice.tenant_id,
                lead_id=lead.id,
                activity_type="email_sent",
                summary=f"Invoice {inv_num} PDF sent via Email to {email}",
                occurred_at=datetime.utcnow(),
            )
            db.add(activity)
            lead.last_contact_at = datetime.utcnow()
            lead.status = "Contacted"
    except Exception as exc:
        logger.warning("LeadActivity creation failed for invoice email: %s", exc)

    return {
        "success": True,
        "email": email,
        "filename": filename,
    }


async def send_payment_receipt_whatsapp(
    db: AsyncSession,
    invoice: Invoice,
    payment_amount: float,
    payment_method: str,
) -> dict:
    """Send a payment receipt (text-only) to the customer's WhatsApp number."""
    comp_id = getattr(invoice, "company_id", None)
    if comp_id:
        comp = await db.get(Company, comp_id)
        if comp:
            if getattr(comp, "whatsapp_enabled", True) is False:
                raise InvoiceSendError(
                    f"WhatsApp communication is turned OFF for company '{comp.name}' in Integrations -> WhatsApp settings."
                )
            wa_settings = getattr(comp, "whatsapp_settings", {}) or {}
            if isinstance(wa_settings, dict) and wa_settings.get("auto_send_payments") is False:
                raise InvoiceSendError(
                    f"Automated payment receipt dispatch via WhatsApp is turned OFF in Integrations -> WhatsApp settings."
                )

    phone = (getattr(invoice, "customer_phone", None) or "").strip()
    if not phone:
        raise InvoiceSendError("Customer has no WhatsApp phone number on file.")

    tenant = await db.get(Tenant, invoice.tenant_id)
    tenant_allowed_sessions = list((tenant.settings or {}).get("whatsapp_web_sessions") or []) if tenant else []
    session_id = await _get_gateway_session_id(tenant_allowed_sessions)
    if session_id is None:
        raise InvoiceSendError(
            "No active WhatsApp session is connected for this organization. "
            "Please connect WhatsApp from CRM → WhatsApp Automation."
        )

    customer = invoice.customer_name or "Customer"
    balance = invoice.balance_due if invoice.balance_due is not None else 0.0
    caption = (
        f"Dear {customer}, we have received your payment of *Rs. {payment_amount:,.2f}* "
        f"towards invoice *{invoice.invoice_number}* ({payment_method}).\n"
        f"Remaining balance: Rs. {balance:,.2f}.\n"
        f"Thank you for your prompt payment!"
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            resp = await http.post(
                f"{GATEWAY_URL}/sessions/{session_id}/chats/{phone}/send",
                json={"message": caption},
            )
            resp.raise_for_status()
            message_id = resp.json().get("message_id")
    except Exception as exc:
        raise InvoiceSendError(f"Failed to send payment receipt: {exc}") from exc

    try:
        await add_system_notification(
            db=db,
            tenant_id=invoice.tenant_id,
            title=f"Payment receipt sent for {invoice.invoice_number}",
            body=f"Receipt of Rs. {payment_amount:,.2f} was sent to {customer} on WhatsApp.",
            category="crm",
        )
    except Exception as exc:
        logger.warning("LiveNotification for payment receipt failed: %s", exc)

    return {"success": True, "message_id": message_id, "session_id": session_id}


async def send_settlement_receipt_whatsapp(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    recipient_phone: str,
    customer_name: str,
    voucher_number: str,
    payment_amount: float,
    payment_method: str,
    payment_date: str,
    covered_invoices: list[dict],
    previous_total_dues: float,
    new_remaining_dues: float,
    wallet_surplus: float = 0.0,
    company_id: uuid.UUID | None = None,
) -> dict:
    """Send a consolidated payment settlement receipt breakdown to the customer's WhatsApp number."""
    if company_id:
        comp = await db.get(Company, company_id)
        if comp:
            if getattr(comp, "whatsapp_enabled", True) is False:
                raise InvoiceSendError(
                    f"WhatsApp communication is turned OFF for company '{comp.name}' in Integrations -> WhatsApp settings."
                )
            wa_settings = getattr(comp, "whatsapp_settings", {}) or {}
            if isinstance(wa_settings, dict) and wa_settings.get("auto_send_payments") is False:
                raise InvoiceSendError(
                    f"Automated payment receipt dispatch via WhatsApp is turned OFF in Integrations -> WhatsApp settings."
                )

    phone = (recipient_phone or "").strip()
    if not phone:
        raise InvoiceSendError("Customer has no WhatsApp phone number on file.")

    tenant = await db.get(Tenant, tenant_id)
    tenant_allowed_sessions = list((tenant.settings or {}).get("whatsapp_web_sessions") or []) if tenant else []
    session_id = await _get_gateway_session_id(tenant_allowed_sessions)
    if session_id is None:
        raise InvoiceSendError(
            "No active WhatsApp session is connected for this organization. "
            "Please connect WhatsApp from CRM → WhatsApp Automation."
        )

    customer = customer_name or "Valued Customer"

    # Build itemized invoice lines
    inv_lines = []
    for inv in covered_invoices:
        num = inv.get("invoice_number") or inv.get("id") or "Invoice"
        allocated = float(inv.get("amount_allocated") or inv.get("allocated") or 0.0)
        new_due = float(inv.get("new_pending") or inv.get("newPending") or 0.0)
        tot = float(inv.get("grand_total") or inv.get("total") or 0.0)
        st = "Settled ✅" if new_due <= 0.01 and allocated > 0 else "Partial ⚠️" if allocated > 0 else "Unpaid ⏳"
        inv_lines.append(f"• *{num}*: Total Rs. {tot:,.2f} | Paid: Rs. {allocated:,.2f} | Remaining Due: Rs. {new_due:,.2f} ({st})")

    breakdown_text = "\n".join(inv_lines) if inv_lines else "• Advance / Account credit"
    surplus_line = f"\n• Surplus Credited to Wallet: +Rs. {wallet_surplus:,.2f}" if wallet_surplus > 0.01 else ""

    caption = (
        f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"💳 *PAYMENT & SETTLEMENT RECEIPT*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"*Voucher No:* {voucher_number}\n"
        f"*Date:* {payment_date}\n"
        f"*Customer:* {customer}\n"
        f"*Amount Paid:* *Rs. {payment_amount:,.2f}*\n"
        f"*Payment Mode:* {payment_method}\n\n"
        f"📋 *INVOICES SETTLEMENT BREAKDOWN:*\n"
        f"{breakdown_text}\n\n"
        f"📊 *OUTSTANDING SUMMARY:*\n"
        f"• Previous Total Dues: Rs. {previous_total_dues:,.2f}\n"
        f"• Amount Paid: Rs. {payment_amount:,.2f}"
        f"{surplus_line}\n"
        f"• *Net Remaining Dues: Rs. {new_remaining_dues:,.2f}*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Thank you for your prompt payment!"
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            resp = await http.post(
                f"{GATEWAY_URL}/sessions/{session_id}/chats/{phone}/send",
                json={"message": caption},
            )
            resp.raise_for_status()
            message_id = resp.json().get("message_id")
    except Exception as exc:
        raise InvoiceSendError(f"Failed to send settlement receipt: {exc}") from exc

    try:
        await add_system_notification(
            db=db,
            tenant_id=tenant_id,
            title=f"Settlement Receipt sent: {voucher_number}",
            body=f"Settlement receipt of Rs. {payment_amount:,.2f} was sent to {customer} on WhatsApp.",
            category="crm",
        )
    except Exception as exc:
        logger.warning("LiveNotification for settlement receipt failed: %s", exc)

    return {"success": True, "message_id": message_id, "session_id": session_id}
