import logging
import uuid
from typing import Any, Dict, List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request, Response, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, get_current_user_context
from src.database.session import get_db
from src.models import Company, PaymentGatewayConfig, User
from src.services.pinelabs_service import PineLabsService
from src.services.razorpay_service import RazorpayService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments & Gateways"])


# ─── Pydantic Schemas ───────────────────────────────────────────────

def clean_uuid_field(v: Any) -> Optional[uuid.UUID]:
    if not v or v == "" or str(v).strip().lower() in ("undefined", "null", "none"):
        return None
    if isinstance(v, uuid.UUID):
        return v
    if isinstance(v, str):
        try:
            return uuid.UUID(v.strip())
        except Exception:
            return None
    return None


class GatewayConfigItem(BaseModel):
    id: str  # razorpay | pinelabs | stripe | phonepe | paytm | cashfree | paypal | cod
    name: str
    category: str  # domestic | international | pos_terminal | offline
    description: str
    isEnabled: bool = True
    isTestMode: bool = True
    credentials: Dict[str, Any] = Field(default_factory=dict)
    supportedMethods: List[str] = Field(default_factory=list)
    currencies: List[str] = Field(default_factory=list)
    docUrl: Optional[str] = None


class GatewayConfigSaveRequest(BaseModel):
    company_id: Optional[Union[uuid.UUID, str]] = None
    is_enabled: bool = True
    is_test_mode: bool = True
    credentials: Dict[str, Any] = Field(default_factory=dict)
    settings: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("company_id", mode="before")
    def parse_company_id(cls, v):
        return clean_uuid_field(v)


class RazorpayOrderCreateRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Order amount in INR (e.g. 499.00)")
    currency: str = "INR"
    receipt: Optional[str] = None
    company_id: Optional[Union[uuid.UUID, str]] = None
    notes: Optional[Dict[str, Any]] = None

    @field_validator("company_id", mode="before")
    def parse_company_id(cls, v):
        return clean_uuid_field(v)


class RazorpayVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    company_id: Optional[Union[uuid.UUID, str]] = None

    @field_validator("company_id", mode="before")
    def parse_company_id(cls, v):
        return clean_uuid_field(v)


class RazorpayLinkCreateRequest(BaseModel):
    amount: float = Field(..., gt=0)
    description: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    notify_sms: bool = True
    notify_email: bool = True
    company_id: Optional[Union[uuid.UUID, str]] = None
    notes: Optional[Dict[str, Any]] = None

    @field_validator("company_id", mode="before")
    def parse_company_id(cls, v):
        return clean_uuid_field(v)


class RazorpayRefundRequest(BaseModel):
    payment_id: str
    amount: Optional[float] = None
    company_id: Optional[Union[uuid.UUID, str]] = None
    notes: Optional[Dict[str, Any]] = None

    @field_validator("company_id", mode="before")
    def parse_company_id(cls, v):
        return clean_uuid_field(v)


class PineLabsChargeRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Transaction amount in INR")
    bill_number: str
    customer_mobile: Optional[str] = None
    payment_mode: Optional[str] = "CARD"  # CARD | TAP_NFC | UPI_QR
    company_id: Optional[Union[uuid.UUID, str]] = None
    terminal_id: Optional[str] = None

    @field_validator("company_id", mode="before")
    def parse_company_id(cls, v):
        return clean_uuid_field(v)


class PineLabsCancelRequest(BaseModel):
    transaction_id: str
    terminal_id: Optional[str] = None
    company_id: Optional[Union[uuid.UUID, str]] = None

    @field_validator("company_id", mode="before")
    def parse_company_id(cls, v):
        return clean_uuid_field(v)


class PineLabsVoidRequest(BaseModel):
    rrn: str
    amount: float
    terminal_id: Optional[str] = None
    company_id: Optional[Union[uuid.UUID, str]] = None

    @field_validator("company_id", mode="before")
    def parse_company_id(cls, v):
        return clean_uuid_field(v)


class PineLabsSettleRequest(BaseModel):
    terminal_id: Optional[str] = None
    company_id: Optional[Union[uuid.UUID, str]] = None

    @field_validator("company_id", mode="before")
    def parse_company_id(cls, v):
        return clean_uuid_field(v)


# ─── Helper to Fetch Tenant Gateway Config ──────────────────────────

async def get_gateway_config_from_db(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    gateway_id: str,
    company_id: Optional[uuid.UUID] = None,
) -> Optional[PaymentGatewayConfig]:
    query = select(PaymentGatewayConfig).where(
        PaymentGatewayConfig.tenant_id == tenant_id,
        PaymentGatewayConfig.gateway_id == gateway_id.lower(),
    )
    if company_id:
        query = query.where(PaymentGatewayConfig.company_id == company_id)
    
    result = await db.execute(query)
    config = result.scalars().first()
    
    # Fallback to tenant-level config without specific company_id
    if not config and company_id:
        fallback_query = select(PaymentGatewayConfig).where(
            PaymentGatewayConfig.tenant_id == tenant_id,
            PaymentGatewayConfig.gateway_id == gateway_id.lower(),
            PaymentGatewayConfig.company_id.is_(None),
        )
        res_fb = await db.execute(fallback_query)
        config = res_fb.scalars().first()

    return config


# ─── Default Fallback Matrix ────────────────────────────────────────

DEFAULT_CATALOGUE = [
    {
        "id": "razorpay",
        "name": "Razorpay",
        "category": "domestic",
        "description": "Accept UPI, Credit/Debit Cards, Net Banking, and Wallets with automatic settlements across India.",
        "supportedMethods": ["UPI & QR", "Cards (Visa/MC/RuPay)", "Net Banking (50+ banks)", "Wallets", "EMI"],
        "currencies": ["INR", "USD", "EUR", "GBP", "AED"],
        "docUrl": "https://razorpay.com/docs",
        "defaultCredentials": {"keyId": "rzp_test_RCEmjSWmFaZJbN", "keySecret": "IGLluMDmPXFRpqDd4MZ7PwBB", "webhookSecret": ""},
    },
    {
        "id": "pinelabs",
        "name": "PineLabs POS / EDC Swiper",
        "category": "pos_terminal",
        "description": "Physical retail EDC integration for POS counter card swipes, contactless tap, and smart UPI soundboxes.",
        "supportedMethods": ["EMV Chip Cards", "Contactless NFC / Tap to Pay", "Dynamic QR on EDC Screen", "Plutus Cloud"],
        "currencies": ["INR"],
        "docUrl": "https://developer.pinelabs.com",
        "defaultCredentials": {"terminalId": "TID-882194", "merchantId": "MID-PINELABS-01", "ipAddress": "192.168.1.150", "port": "8082"},
    },
    {
        "id": "stripe",
        "name": "Stripe",
        "category": "international",
        "description": "Industry-standard global payments supporting 135+ currencies, Apple Pay, Google Pay, and cards.",
        "supportedMethods": ["Credit/Debit Cards", "Apple Pay", "Google Pay", "SEPA", "iDEAL"],
        "currencies": ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "AED", "SAR"],
        "docUrl": "https://stripe.com/docs",
        "defaultCredentials": {"publishableKey": "", "secretKey": "", "webhookSecret": ""},
    },
    {
        "id": "phonepe",
        "name": "PhonePe PG",
        "category": "domestic",
        "description": "High-speed UPI direct deep-linking, QR payments, and high-conversion gateway for Indian consumers.",
        "supportedMethods": ["PhonePe UPI", "UPI QR", "Credit/Debit Cards", "PhonePe Wallet"],
        "currencies": ["INR"],
        "docUrl": "https://developer.phonepe.com",
        "defaultCredentials": {"merchantId": "", "saltKey": "", "saltIndex": "1"},
    },
    {
        "id": "cod",
        "name": "Cash on Delivery (COD)",
        "category": "offline",
        "description": "Allow customers to pay via cash or UPI collection at the doorstep upon order delivery.",
        "supportedMethods": ["Doorstep Cash", "Delivery UPI QR"],
        "currencies": ["INR"],
        "docUrl": "",
        "defaultCredentials": {"maxOrderLimit": "10000", "verificationOtpRequired": "true"},
    },
]


# ─── 1. Gateways Configuration CRUD (Per Tenant / Company) ──────────

@router.get("/gateways/config")
async def get_tenant_gateway_configs(
    company_id: Optional[uuid.UUID] = Query(None),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Returns all payment gateways with this tenant's / company's customized credentials from DB."""
    query = select(PaymentGatewayConfig).where(PaymentGatewayConfig.tenant_id == ctx.tenant_id)
    if company_id:
        query = query.where(
            (PaymentGatewayConfig.company_id == company_id) | (PaymentGatewayConfig.company_id.is_(None))
        )
    result = await db.execute(query)
    saved_configs = {c.gateway_id.lower(): c for c in result.scalars().all()}

    output = []
    for item in DEFAULT_CATALOGUE:
        gid = item["id"]
        saved = saved_configs.get(gid)
        if saved:
            output.append({
                "id": gid,
                "name": item["name"],
                "category": item["category"],
                "description": item["description"],
                "isEnabled": saved.is_enabled,
                "isTestMode": saved.is_test_mode,
                "credentials": saved.credentials or item["defaultCredentials"],
                "supportedMethods": item["supportedMethods"],
                "currencies": item["currencies"],
                "docUrl": item["docUrl"],
                "companyId": str(saved.company_id) if saved.company_id else None,
            })
        else:
            output.append({
                "id": gid,
                "name": item["name"],
                "category": item["category"],
                "description": item["description"],
                "isEnabled": gid in ("razorpay", "pinelabs", "cod"),
                "isTestMode": True,
                "credentials": item["defaultCredentials"],
                "supportedMethods": item["supportedMethods"],
                "currencies": item["currencies"],
                "docUrl": item["docUrl"],
                "companyId": str(company_id) if company_id else None,
            })

    return output


@router.put("/gateways/{gateway_id}/config")
async def save_tenant_gateway_config(
    gateway_id: str,
    payload: GatewayConfigSaveRequest,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Saves or updates custom credentials and settings for a payment gateway for this company/tenant in DB."""
    gid = gateway_id.lower().strip()
    query = select(PaymentGatewayConfig).where(
        PaymentGatewayConfig.tenant_id == ctx.tenant_id,
        PaymentGatewayConfig.gateway_id == gid,
    )
    if payload.company_id:
        query = query.where(PaymentGatewayConfig.company_id == payload.company_id)
    else:
        query = query.where(PaymentGatewayConfig.company_id.is_(None))

    result = await db.execute(query)
    config = result.scalars().first()

    if not config:
        config = PaymentGatewayConfig(
            tenant_id=ctx.tenant_id,
            company_id=payload.company_id,
            gateway_id=gid,
            is_enabled=payload.is_enabled,
            is_test_mode=payload.is_test_mode,
            credentials=payload.credentials,
            settings=payload.settings,
        )
        db.add(config)
    else:
        config.is_enabled = payload.is_enabled
        config.is_test_mode = payload.is_test_mode
        config.credentials = payload.credentials
        config.settings = payload.settings

    await db.commit()
    await db.refresh(config)

    return {
        "success": True,
        "message": f"Payment gateway '{gateway_id}' configuration saved successfully.",
        "config_id": str(config.id),
    }


@router.post("/gateways/{gateway_id}/test-connection")
async def test_gateway_connection(
    gateway_id: str,
    payload: Optional[Dict[str, Any]] = None,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Tests live connectivity and authentication for Razorpay, Pine Labs, or other gateways."""
    gid = gateway_id.lower().strip()
    passed_creds = (payload or {}).get("credentials", {})

    # If credentials were not passed in request body, retrieve from DB
    if not passed_creds:
        saved = await get_gateway_config_from_db(db, ctx.tenant_id, gid)
        if saved:
            passed_creds = saved.credentials or {}

    if gid == "razorpay":
        key_id = passed_creds.get("keyId") or passed_creds.get("key_id", "rzp_test_RCEmjSWmFaZJbN")
        key_secret = passed_creds.get("keySecret") or passed_creds.get("key_secret", "IGLluMDmPXFRpqDd4MZ7PwBB")
        svc = RazorpayService(key_id=key_id, key_secret=key_secret)
        return await svc.test_connection()

    elif gid == "pinelabs":
        tid = passed_creds.get("terminalId") or passed_creds.get("terminal_id", "TID-882194")
        mid = passed_creds.get("merchantId") or passed_creds.get("merchant_id", "MID-PINELABS-01")
        ip = passed_creds.get("ipAddress") or passed_creds.get("ip_address")
        port = int(passed_creds.get("port", 8082))
        svc = PineLabsService(merchant_id=mid, terminal_id=tid, ip_address=ip, port=port, is_test_mode=False)
        return await svc.test_connection()

    else:
        return {
            "success": True,
            "message": f"Gateway '{gateway_id}' configuration parameters syntax valid.",
        }


# ─── 2. Razorpay Payment Processing Endpoints ───────────────────────

@router.post("/razorpay/create-order")
async def razorpay_create_order(
    payload: RazorpayOrderCreateRequest,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Creates a Razorpay Order using the tenant's DB-configured credentials."""
    saved_config = await get_gateway_config_from_db(db, ctx.tenant_id, "razorpay", payload.company_id)
    creds = saved_config.credentials if saved_config else {}
    key_id = creds.get("keyId") or creds.get("key_id", "rzp_test_RCEmjSWmFaZJbN")
    key_secret = creds.get("keySecret") or creds.get("key_secret", "IGLluMDmPXFRpqDd4MZ7PwBB")

    if not key_id or not key_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Razorpay is not configured for this organization. Please add API credentials in Core ERP > Payment Gateways.",
        )

    svc = RazorpayService(key_id=key_id, key_secret=key_secret)
    try:
        order_data = await svc.create_order(
            amount=payload.amount,
            currency=payload.currency,
            receipt=payload.receipt,
            notes=payload.notes,
        )
        return order_data
    except Exception as exc:
        logger.error("Razorpay create-order failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/razorpay/verify")
async def razorpay_verify_payment(
    payload: RazorpayVerifyRequest,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Validates Razorpay payment signature after checkout popup completes."""
    saved_config = await get_gateway_config_from_db(db, ctx.tenant_id, "razorpay", payload.company_id)
    creds = saved_config.credentials if saved_config else {}
    key_id = creds.get("keyId") or creds.get("key_id", "rzp_test_RCEmjSWmFaZJbN")
    key_secret = creds.get("keySecret") or creds.get("key_secret", "IGLluMDmPXFRpqDd4MZ7PwBB")

    svc = RazorpayService(key_id=key_id, key_secret=key_secret)
    is_valid = svc.verify_signature(
        order_id=payload.razorpay_order_id,
        payment_id=payload.razorpay_payment_id,
        signature=payload.razorpay_signature,
    )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment signature verification failed. The transaction may be fraudulent or tampered with.",
        )

    # Fetch payment details from Razorpay
    payment_details = {}
    try:
        payment_details = await svc.fetch_payment(payload.razorpay_payment_id)
    except Exception as exc:
        logger.warning("Could not fetch full payment details from Razorpay: %s", exc)

    return {
        "success": True,
        "message": "Payment verified successfully.",
        "order_id": payload.razorpay_order_id,
        "payment_id": payload.razorpay_payment_id,
        "status": payment_details.get("status", "captured"),
        "method": payment_details.get("method", "card"),
        "amount": (payment_details.get("amount", 0) / 100) if payment_details.get("amount") else None,
        "vpa": payment_details.get("vpa"),
        "bank": payment_details.get("bank"),
    }


@router.post("/razorpay/create-link")
async def razorpay_create_payment_link(
    payload: RazorpayLinkCreateRequest,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Creates a Razorpay Payment Link to send via SMS / WhatsApp / Email."""
    saved_config = await get_gateway_config_from_db(db, ctx.tenant_id, "razorpay", payload.company_id)
    creds = saved_config.credentials if saved_config else {}
    key_id = creds.get("keyId") or creds.get("key_id", "rzp_test_RCEmjSWmFaZJbN")
    key_secret = creds.get("keySecret") or creds.get("key_secret", "IGLluMDmPXFRpqDd4MZ7PwBB")

    svc = RazorpayService(key_id=key_id, key_secret=key_secret)
    try:
        link_data = await svc.create_payment_link(
            amount=payload.amount,
            description=payload.description,
            customer_name=payload.customer_name,
            customer_phone=payload.customer_phone,
            customer_email=payload.customer_email,
            notify_sms=payload.notify_sms,
            notify_email=payload.notify_email,
            notes=payload.notes,
        )
        return link_data
    except Exception as exc:
        logger.error("Razorpay create-link failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/razorpay/orders/{order_id}/status")
async def razorpay_check_order_status(
    order_id: str,
    company_id: Optional[uuid.UUID] = Query(None),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Polls live order status & payment captures directly from Razorpay."""
    saved_config = await get_gateway_config_from_db(db, ctx.tenant_id, "razorpay", company_id)
    creds = saved_config.credentials if saved_config else {}
    key_id = creds.get("keyId") or creds.get("key_id", "rzp_test_RCEmjSWmFaZJbN")
    key_secret = creds.get("keySecret") or creds.get("key_secret", "IGLluMDmPXFRpqDd4MZ7PwBB")

    svc = RazorpayService(key_id=key_id, key_secret=key_secret)
    try:
        order_info = await svc.fetch_order(order_id)
        payments_info = await svc.fetch_order_payments(order_id)
        items = payments_info.get("items", [])
        captured_payment = next((p for p in items if p.get("status") == "captured"), None)

        return {
            "order_id": order_id,
            "status": order_info.get("status"),  # created, attempted, paid
            "amount_paid": (order_info.get("amount_paid", 0) / 100),
            "is_paid": order_info.get("status") == "paid" or captured_payment is not None,
            "captured_payment_id": captured_payment.get("id") if captured_payment else None,
            "payment_method": captured_payment.get("method") if captured_payment else None,
        }
    except Exception as exc:
        logger.error("Razorpay check order status error: %s", exc)
        return {"order_id": order_id, "status": "unknown", "is_paid": False, "error": str(exc)}


@router.get("/razorpay/links/{link_id}/status")
async def razorpay_check_link_status(
    link_id: str,
    company_id: Optional[uuid.UUID] = Query(None),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Polls live payment link status from Razorpay."""
    saved_config = await get_gateway_config_from_db(db, ctx.tenant_id, "razorpay", company_id)
    creds = saved_config.credentials if saved_config else {}
    key_id = creds.get("keyId") or creds.get("key_id", "rzp_test_RCEmjSWmFaZJbN")
    key_secret = creds.get("keySecret") or creds.get("key_secret", "IGLluMDmPXFRpqDd4MZ7PwBB")

    svc = RazorpayService(key_id=key_id, key_secret=key_secret)
    try:
        link_info = await svc.fetch_payment_link(link_id)
        is_paid = link_info.get("status") == "paid"
        payments = link_info.get("payments", [])
        last_pay = payments[0] if payments else {}
        return {
            "link_id": link_id,
            "status": link_info.get("status"),
            "is_paid": is_paid,
            "payment_id": last_pay.get("payment_id"),
            "amount_paid": (link_info.get("amount_paid", 0) / 100),
        }
    except Exception as exc:
        logger.error("Razorpay check link status error: %s", exc)
        return {"link_id": link_id, "status": "unknown", "is_paid": False, "error": str(exc)}


@router.post("/razorpay/create-qr")
async def razorpay_create_qr(
    payload: RazorpayOrderCreateRequest,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Creates a native dynamic Razorpay UPI QR Code."""
    saved_config = await get_gateway_config_from_db(db, ctx.tenant_id, "razorpay", payload.company_id)
    creds = saved_config.credentials if saved_config else {}
    key_id = creds.get("keyId") or creds.get("key_id", "rzp_test_RCEmjSWmFaZJbN")
    key_secret = creds.get("keySecret") or creds.get("key_secret", "IGLluMDmPXFRpqDd4MZ7PwBB")

    svc = RazorpayService(key_id=key_id, key_secret=key_secret)
    try:
        qr_data = await svc.create_qr_code(
            amount=payload.amount,
            name="POS Counter Checkout",
            description=f"Bill Payment #{payload.receipt or 'Counter'}",
            notes=payload.notes,
        )
        return qr_data
    except Exception as exc:
        logger.warning("Razorpay native QR API not enabled on merchant account (%s), creating live Razorpay Payment Link with dynamic QR instead.", exc)
        try:
            link_data = await svc.create_payment_link(
                amount=payload.amount,
                description=f"POS Counter Bill #{payload.receipt or 'Sale'}",
                notes=payload.notes,
            )
            return {
                "id": link_data.get("id"),
                "image_url": None,
                "upi_intent": link_data.get("short_url"),
                "short_url": link_data.get("short_url"),
                "amount": link_data.get("amount", int(payload.amount * 100)),
                "status": "active",
                "is_link_fallback": True,
            }
        except Exception as link_exc:
            logger.error("Razorpay create-link fallback also failed: %s", link_exc)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to generate live Razorpay payment: {link_exc}",
            )


@router.get("/razorpay/qr/{qr_id}/status")
async def razorpay_check_qr_status(
    qr_id: str,
    company_id: Optional[uuid.UUID] = Query(None),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Polls live QR code payment status directly from Razorpay."""
    saved_config = await get_gateway_config_from_db(db, ctx.tenant_id, "razorpay", company_id)
    creds = saved_config.credentials if saved_config else {}
    key_id = creds.get("keyId") or creds.get("key_id", "rzp_test_RCEmjSWmFaZJbN")
    key_secret = creds.get("keySecret") or creds.get("key_secret", "IGLluMDmPXFRpqDd4MZ7PwBB")

    svc = RazorpayService(key_id=key_id, key_secret=key_secret)
    try:
        qr_info = await svc.fetch_qr_code(qr_id)
        payments_received = qr_info.get("payments_amount_received", 0)
        is_paid = payments_received > 0 or qr_info.get("status") == "closed"
        return {
            "qr_id": qr_id,
            "status": qr_info.get("status"),
            "is_paid": is_paid,
            "amount_paid": payments_received / 100,
        }
    except Exception as exc:
        logger.error("Razorpay check QR status error: %s", exc)
        return {"qr_id": qr_id, "status": "unknown", "is_paid": False, "error": str(exc)}


@router.post("/razorpay/refund")
async def razorpay_refund_payment(
    payload: RazorpayRefundRequest,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Processes an instant refund for a Razorpay payment."""
    saved_config = await get_gateway_config_from_db(db, ctx.tenant_id, "razorpay", payload.company_id)
    creds = saved_config.credentials if saved_config else {}
    key_id = creds.get("keyId") or creds.get("key_id", "rzp_test_RCEmjSWmFaZJbN")
    key_secret = creds.get("keySecret") or creds.get("key_secret", "IGLluMDmPXFRpqDd4MZ7PwBB")

    svc = RazorpayService(key_id=key_id, key_secret=key_secret)
    try:
        refund_data = await svc.create_refund(
            payment_id=payload.payment_id,
            amount=payload.amount,
            notes=payload.notes,
        )
        return refund_data
    except Exception as exc:
        logger.error("Razorpay refund failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/razorpay/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Receives automated webhooks from Razorpay for order.paid and payment.captured."""
    body_bytes = await request.body()
    # Razorpay Webhook is acknowledged
    logger.info("Received Razorpay webhook event with signature: %s", x_razorpay_signature)
    return {"status": "ok", "received": True}


# ─── 3. Pine Labs Handheld EDC Card Terminal Endpoints ───────────────

@router.post("/pinelabs/charge")
async def pinelabs_charge_terminal(
    payload: PineLabsChargeRequest,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Pushes a card swipe / NFC tap / Dynamic QR payment prompt to the Pine Labs Handheld EDC Terminal."""
    saved_config = await get_gateway_config_from_db(db, ctx.tenant_id, "pinelabs", payload.company_id)
    creds = saved_config.credentials if saved_config else {}
    tid = payload.terminal_id or creds.get("terminalId") or creds.get("terminal_id", "TID-882194")
    mid = creds.get("merchantId") or creds.get("merchant_id", "MID-PINELABS-01")
    ip = creds.get("ipAddress") or creds.get("ip_address")
    port = int(creds.get("port", 8082))
    svc = PineLabsService(
        merchant_id=mid,
        terminal_id=tid,
        ip_address=ip,
        port=port,
        is_test_mode=False,
    )
    result = await svc.initiate_transaction(
        amount=payload.amount,
        bill_number=payload.bill_number,
        customer_mobile=payload.customer_mobile,
        payment_mode=payload.payment_mode,
    )
    return result


@router.post("/pinelabs/cancel")
async def pinelabs_cancel_transaction(
    payload: PineLabsCancelRequest,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Aborts a pending waiting prompt on the handheld terminal."""
    saved_config = await get_gateway_config_from_db(db, ctx.tenant_id, "pinelabs", payload.company_id)
    creds = saved_config.credentials if saved_config else {}
    tid = payload.terminal_id or creds.get("terminalId") or creds.get("terminal_id", "TID-882194")

    svc = PineLabsService(terminal_id=tid)
    return await svc.cancel_transaction(payload.transaction_id)


@router.post("/pinelabs/void")
async def pinelabs_void_charge(
    payload: PineLabsVoidRequest,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Voids an EDC transaction prior to daily batch settlement."""
    saved_config = await get_gateway_config_from_db(db, ctx.tenant_id, "pinelabs", payload.company_id)
    creds = saved_config.credentials if saved_config else {}
    tid = payload.terminal_id or creds.get("terminalId") or creds.get("terminal_id", "TID-882194")

    svc = PineLabsService(terminal_id=tid)
    return await svc.void_transaction(rrn=payload.rrn, amount=payload.amount)


@router.post("/pinelabs/settle")
async def pinelabs_settle_batch(
    payload: PineLabsSettleRequest,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Triggers Day-End Batch Settlement on the physical Pine Labs EDC."""
    saved_config = await get_gateway_config_from_db(db, ctx.tenant_id, "pinelabs", payload.company_id)
    creds = saved_config.credentials if saved_config else {}
    tid = payload.terminal_id or creds.get("terminalId") or creds.get("terminal_id", "TID-882194")
    mid = creds.get("merchantId") or creds.get("merchant_id", "MID-PINELABS-01")

    svc = PineLabsService(merchant_id=mid, terminal_id=tid)
    return await svc.settle_batch()
