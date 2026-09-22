"""WhatsApp Invoice Sender — dispatch invoice PDFs to customers.

Flow:
  1. Look up the tenant's active invoice DocumentTemplate.
  2. Render the PDF using that template's styling.
  3. Base64-encode the PDF.
  4. POST to the WhatsApp gateway /send-media endpoint.
  5. Log a LiveNotification + LeadActivity.
"""
from __future__ import annotations

import logging
import os
import re
from datetime import datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.erp import Invoice
from src.models import Lead, LeadActivity
from src.services.invoice_pdf import (
    get_active_invoice_template,
    render_invoice_pdf_b64,
    save_invoice_pdf,
)
from src.utils.notifications import add_system_notification

logger = logging.getLogger(__name__)

# Force 127.0.0.1 to avoid Windows IPv6/localhost resolution ambiguity
_raw_gateway_url = os.getenv("WHATSAPP_GATEWAY_URL", "http://127.0.0.1:8005")
GATEWAY_URL = _raw_gateway_url.replace("localhost", "127.0.0.1")


class WhatsappInvoiceSendError(Exception):
    """Raised when the invoice cannot be sent via WhatsApp."""


async def _get_gateway_session_id() -> str | None:
    """Return the phone number (session id) of the first CONNECTED or AUTHENTICATED WhatsApp session."""
    try:
        async with httpx.AsyncClient(timeout=4.0) as http:
            resp = await http.get(f"{GATEWAY_URL}/sessions")
            if resp.status_code != 200:
                return None
            sessions = resp.json()
            # 1. First priority: fully CONNECTED session
            for sid, info in sessions.items():
                if isinstance(info, dict) and info.get("status") == "CONNECTED":
                    return sid
            # 2. Second priority: AUTHENTICATED session
            for sid, info in sessions.items():
                if isinstance(info, dict) and info.get("status") == "AUTHENTICATED":
                    return sid
    except Exception as exc:
        logger.warning("Could not reach WhatsApp gateway for session lookup: %s", exc)
    return None


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
    # Non-blocking async timeouts: connect 10s, read 120s (PDF upload over CDP can take up to 60-90s)
    media_timeout = httpx.Timeout(connect=10.0, read=120.0, write=120.0, pool=10.0)
    text_timeout  = httpx.Timeout(connect=10.0, read=60.0, write=60.0, pool=10.0)
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
    """Send *invoice* as a PDF to the customer's WhatsApp number.

    The PDF is rendered using the tenant's active ``DocumentTemplate`` so
    the visual style matches what the organization configured in
    **Inventory → Print Templates**.

    Parameters
    ----------
    db : AsyncSession
        Current database session (used to load the template and create
        LeadActivity + LiveNotification).
    invoice : Invoice
        The ORM invoice instance.  Must have its ``lines`` relationship
        loaded (``selectinload`` or ``joinedload``).
    recipient_phone : str | None
        Override the recipient.  Falls back to ``invoice.customer_phone``.

    Returns
    -------
    dict with keys: ``success``, ``message_id``, ``error``, ``session_id``.

    Raises
    ------
    WhatsappInvoiceSendError on unrecoverable failures (no session, no phone,
    no template).
    """
    # 1. Resolve recipient --------------------------------------------------
    phone = (recipient_phone or getattr(invoice, "customer_phone", None) or "").strip()
    if not phone:
        raise WhatsappInvoiceSendError("Customer has no WhatsApp phone number on file.")

    # 2. Load tenant's active invoice template ------------------------------
    template = await get_active_invoice_template(db, invoice.tenant_id)
    if template is None:
        raise WhatsappInvoiceSendError(
            "No active invoice template found for this organization. "
            "Please set a default template in Inventory → Print Templates."
        )

    # 3. Find connected gateway session -------------------------------------
    session_id = await _get_gateway_session_id()
    if session_id is None:
        raise WhatsappInvoiceSendError(
            "No active WhatsApp session is connected. "
            "Please connect WhatsApp from CRM → WhatsApp Automation."
        )

    # 4. Use already generated/saved PDF if it exists, or generate once -----
    try:
        from src.services.invoice_pdf import get_invoice_pdf_path
        saved_pdf_path = get_invoice_pdf_path(invoice)

        if saved_pdf_path.exists() and saved_pdf_path.stat().st_size > 100:
            logger.info("Using already generated and saved invoice PDF as-is: %s (%d bytes)", saved_pdf_path, saved_pdf_path.stat().st_size)
            import base64
            pdf_b64 = base64.b64encode(saved_pdf_path.read_bytes()).decode("ascii")
        else:
            logger.info("No saved PDF on disk for invoice %s; generating once and saving to %s", getattr(invoice, "invoice_number", ""), saved_pdf_path)
            pdf_path = save_invoice_pdf(invoice, template)
            import base64
            pdf_b64 = base64.b64encode(pdf_path.read_bytes()).decode("ascii")
    except Exception as exc:
        raise WhatsappInvoiceSendError(f"Failed to retrieve/generate invoice PDF: {exc}") from exc

    # 5. Send via gateway ---------------------------------------------------
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
        raise WhatsappInvoiceSendError(
            f"WhatsApp gateway rejected the send ({exc.response.status_code}): {exc.response.text}"
        ) from exc
    except Exception as exc:
        raise WhatsappInvoiceSendError(f"WhatsApp send failed: {exc}") from exc

    # 6. LiveNotification (dashboard bell) -----------------------------------
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

    # 7. LeadActivity (CRM timeline) ----------------------------------------
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


async def send_payment_receipt_whatsapp(
    db: AsyncSession,
    invoice: Invoice,
    payment_amount: float,
    payment_method: str,
) -> dict:
    """Send a payment receipt (text-only) to the customer's WhatsApp number."""
    phone = (getattr(invoice, "customer_phone", None) or "").strip()
    if not phone:
        raise WhatsappInvoiceSendError("Customer has no WhatsApp phone number on file.")

    session_id = await _get_gateway_session_id()
    if session_id is None:
        raise WhatsappInvoiceSendError(
            "No active WhatsApp session is connected. "
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
        raise WhatsappInvoiceSendError(f"Failed to send payment receipt: {exc}") from exc

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
