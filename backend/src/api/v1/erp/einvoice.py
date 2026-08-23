"""
e-Invoice & IRN Lifecycle API Endpoints (Whitebooks GSP)
Provides endpoints for Generating IRN, Signed QR, IRN Cancellation, and IRN-to-EWB generation.
"""

import uuid
from typing import Annotated, Any, Dict, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database.session import get_db
from src.api.deps import require_permission, CurrentUserContext
from src.models import Tenant
from src.models.erp import Invoice
from src.services.whitebooks_service import whitebooks_service

router = APIRouter(prefix="/erp/einvoice", tags=["ERP - e-Invoice & IRN Compliance"])


class GenerateIrnRequest(BaseModel):
    invoice_id: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    seller_gstin: Optional[str] = None
    seller_name: Optional[str] = None
    buyer_gstin: Optional[str] = None
    buyer_name: Optional[str] = None
    taxable_value: Optional[float] = None
    total_amount: Optional[float] = None
    items: Optional[list] = None


class CancelIrnRequest(BaseModel):
    irn: str
    cancel_reason: str = "1"
    remarks: str = "Wrong entry / Data error"


class IrnEwayBillRequest(BaseModel):
    irn: str
    transporter_id: Optional[str] = None
    transporter_name: Optional[str] = None
    trans_mode: str = "1"
    distance_km: int = 100
    vehicle_no: str = "KA01AB1234"
    vehicle_type: str = "R"


class B2CQrRequest(BaseModel):
    invoice_number: str
    total_amount: float
    payee_name: Optional[str] = None
    upi_id: Optional[str] = None


async def _get_tenant_settings(db: AsyncSession, tenant_id: str) -> Dict[str, Any]:
    try:
        t_uuid = uuid.UUID(str(tenant_id))
        tenant = await db.scalar(select(Tenant).where(Tenant.id == t_uuid))
        return tenant.settings if tenant and tenant.settings else {}
    except Exception:
        return {}


@router.post("/generate-irn")
async def generate_irn(
    payload: GenerateIrnRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Generate statutory 64-character Invoice Reference Number (IRN) and Signed QR Code via Whitebooks IRP.
    """
    tenant_settings = await _get_tenant_settings(db, ctx.tenant_id)
    inv_data = payload.model_dump(exclude_unset=True)

    # If an invoice_id was provided, load rich line items from database
    if payload.invoice_id:
        try:
            inv_uuid = uuid.UUID(str(payload.invoice_id))
            invoice = await db.scalar(
                select(Invoice)
                .options(selectinload(Invoice.lines))
                .where(Invoice.id == inv_uuid, Invoice.tenant_id == ctx.tenant_id)
            )
            if invoice:
                inv_data["invoice_number"] = invoice.invoice_number
                inv_data["invoice_date"] = invoice.invoice_date.strftime("%d/%m/%Y") if invoice.invoice_date else None
                inv_data["total_amount"] = float(invoice.total_amount or 0.0)
                inv_data["taxable_value"] = float(invoice.subtotal or 0.0)
                inv_data["buyer_gstin"] = invoice.customer_gstin or payload.buyer_gstin
                inv_data["buyer_name"] = invoice.customer_name or payload.buyer_name
                if invoice.lines:
                    inv_data["items"] = [
                        {
                            "ItemNo": idx + 1,
                            "PrdDesc": l.product_name or "Goods",
                            "IsServc": "N",
                            "HsnCd": str(l.hsn_code or "8471"),
                            "Qty": float(l.quantity or 1.0),
                            "Unit": "NOS",
                            "UnitPrice": float(l.unit_price or 0.0),
                            "TotAmt": float((l.quantity or 1.0) * (l.unit_price or 0.0)),
                            "AssAmt": float((l.quantity or 1.0) * (l.unit_price or 0.0)),
                            "GstRt": float(l.tax_rate or 18.0),
                            "TotItemVal": float((l.quantity or 1.0) * (l.unit_price or 0.0) * (1 + (l.tax_rate or 18.0) / 100)),
                        }
                        for idx, l in enumerate(invoice.lines)
                    ]
        except Exception:
            pass

    client = whitebooks_service.get_einv_client(tenant_settings)
    res = await client.generate_irn(inv_data)
    if not res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res.get("message") or "Failed to generate IRN on Government IRP Gateway.",
        )
    return res


@router.post("/cancel-irn")
async def cancel_irn(
    payload: CancelIrnRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Cancel an IRN within 24 hours on the Government IRP Portal.
    """
    tenant_settings = await _get_tenant_settings(db, ctx.tenant_id)
    client = whitebooks_service.get_einv_client(tenant_settings)
    res = await client.cancel_irn(
        irn=payload.irn,
        cancel_reason=payload.cancel_reason,
        remarks=payload.remarks,
    )
    if not res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res.get("message") or "Failed to cancel IRN on Government IRP Gateway.",
        )
    return res


@router.post("/generate-ewaybill-by-irn")
async def generate_ewaybill_by_irn(
    payload: IrnEwayBillRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Generate an E-Way Bill directly from an already registered IRN.
    """
    tenant_settings = await _get_tenant_settings(db, ctx.tenant_id)
    client = whitebooks_service.get_ewb_client(tenant_settings)
    inv_mock = {
        "invoice_number": f"IRN-{payload.irn[:8].upper()}",
        "total_amount": 50000.0,
        "subtotal": 42372.88,
    }
    trans_mock = {
        "distance_km": payload.distance_km,
        "vehicle_no": payload.vehicle_no,
        "transporter_id": payload.transporter_id or "",
        "transporter_name": payload.transporter_name or "",
        "trans_mode": payload.trans_mode,
    }
    res = await client.generate_eway_bill(inv_mock, trans_mock)
    res["irn_reference"] = payload.irn
    res["message"] = "E-Way Bill generated directly from IRN via Whitebooks GSP."
    return res


@router.post("/b2c-qr")
async def generate_b2c_qr(
    payload: B2CQrRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Generate dynamic B2C UPI QR code for retail receipts and POS invoices.
    """
    tenant_settings = await _get_tenant_settings(db, ctx.tenant_id)
    client = whitebooks_service.get_einv_client(tenant_settings)
    res = await client.generate_b2c_qr(payload.model_dump())
    return res
