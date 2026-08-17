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


def _get_gateway_session_id() -> str | None:
    """Return the phone number (session id) of the first CONNECTED WhatsApp session."""
    try:
        with httpx.Client(timeout=8.0) as http:
            resp = http.get(f"{GATEWAY_URL}/sessions")
            if resp.status_code != 200:
                return None
            sessions = resp.json()
            for sid, info in sessions.items():
                if isinstance(info, dict) and info.get("status") == "CONNECTED":
                    return sid
    except Exception as exc:
        logger.warning("Could not reach WhatsApp gateway for session lookup: %s", exc)
    return None


def _send_via_gateway(
    session_id: str,
    recipient_phone: str,
    pdf_b64: str,
    invoice_number: str,
    customer_name: str,
) -> dict:
    """Proxy the PDF to the WhatsApp gateway."""
    payload = {
        "mimeType": "application/pdf",
        "data": pdf_b64,
        "fileName": f"Invoice_{invoice_number}.pdf",
        "caption": (
            f"Dear {customer_name}, thank you for your purchase!\n"
            f"Your invoice *{invoice_number}* is attached.\n"
            f"For any queries, please reply to this message."
        ),
    }
    with httpx.Client(timeout=30.0) as http:
        resp = http.post(
            f"{GATEWAY_URL}/sessions/{session_id}/chats/{recipient_phone}/send-media",
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


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
    session_id = _get_gateway_session_id()
    if session_id is None:
        raise WhatsappInvoiceSendError(
            "No active WhatsApp session is connected. "
            "Please connect WhatsApp from CRM → WhatsApp Automation."
        )

    # 4. Generate PDF bytes using the template -----------------------------
    try:
        pdf_b64 = render_invoice_pdf_b64(invoice, template)
        try:
            save_invoice_pdf(invoice, template)
        except Exception:
            pass
    except Exception as exc:
        raise WhatsappInvoiceSendError(f"Failed to generate invoice PDF: {exc}") from exc

    # 5. Send via gateway ---------------------------------------------------
    try:
        gateway_res = _send_via_gateway(
            session_id=session_id,
            recipient_phone=phone,
            pdf_b64=pdf_b64,
            invoice_number=invoice.invoice_number or str(invoice.id),
            customer_name=invoice.customer_name or "Customer",
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

    session_id = _get_gateway_session_id()
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
        with httpx.Client(timeout=20.0) as http:
            resp = http.post(
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
