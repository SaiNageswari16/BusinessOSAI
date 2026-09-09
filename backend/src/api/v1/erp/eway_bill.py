"""
E-Way Bill Router
Provides endpoints for Generating, Tracking, Updating Vehicle/Part-B, and Cancelling E-Way Bills using Whitebooks GSP API.
"""

import uuid
from typing import Annotated, Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from src.database.session import get_db
from src.api.deps import require_permission, CurrentUserContext
from src.models import Tenant
from src.models.erp import Invoice
from src.services.whitebooks_service import whitebooks_service

router = APIRouter(prefix="/erp/eway-bill", tags=["ERP - E-Way Bill Compliance"])


class EWayBillGenerateRequest(BaseModel):
    invoice_id: Optional[str] = None
    invoice_number: str
    invoice_date: Optional[str] = None
    total_amount: float
    cgst_amount: Optional[float] = 0.0
    sgst_amount: Optional[float] = 0.0
    igst_amount: Optional[float] = 0.0
    from_gstin: Optional[str] = None
    from_trade_name: Optional[str] = None
    from_address: Optional[str] = None
    from_city: Optional[str] = None
    from_pincode: Optional[str] = None
    to_gstin: Optional[str] = "URP"
    to_customer_name: Optional[str] = None
    to_address: Optional[str] = None
    to_city: Optional[str] = None
    to_pincode: Optional[str] = None
    transporter_id: Optional[str] = ""
    transporter_name: Optional[str] = ""
    lr_number: Optional[str] = ""
    vehicle_number: str
    transport_mode: Optional[str] = "1"  # 1=Road, 2=Rail, 3=Air, 4=Ship
    approx_distance_km: Optional[int] = 100
    vehicle_type: Optional[str] = "R"
    items: Optional[List[Dict[str, Any]]] = []


class EWayBillCancelRequest(BaseModel):
    eway_bill_number: str
    cancel_reason_code: str = "2"  # 1=Duplicate, 2=Order Cancelled, 3=Data Entry Error, 4=Others
    remarks: Optional[str] = "Order cancelled or vehicle changed"


class EWayBillUpdateVehicleRequest(BaseModel):
    eway_bill_number: str
    vehicle_no: str
    from_place: str = "Bengaluru"
    from_state: str = "29"
    reason_code: str = "2"
    remarks: str = "Vehicle change / Breakdown"


async def _get_tenant_settings(db: AsyncSession, tenant_id: str) -> tuple[Dict[str, Any], Optional[Any]]:
    try:
        t_uuid = uuid.UUID(str(tenant_id))
        tenant = await db.scalar(select(Tenant).where(Tenant.id == t_uuid))
        settings = tenant.settings if tenant and tenant.settings else {}
        from src.models import Company
        company = await db.scalar(
            select(Company).where(Company.tenant_id == t_uuid).order_by(Company.created_at.asc())
        )
        if (not settings or not settings.get("whitebooks_config")) and company and company.gsp_credentials:
            settings = {**(settings or {}), "whitebooks_config": company.gsp_credentials}
        return settings, company
    except Exception:
        return {}, None


@router.post("/generate")
async def generate_eway_bill(
    payload: EWayBillGenerateRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("create:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Generate an official E-Way Bill for consignments exceeding ₹50,000 via Whitebooks GSP.
    """
    if payload.total_amount <= 0:
        raise HTTPException(status_code=400, detail="Consignment total value must be greater than zero.")

    tenant_settings, company = await _get_tenant_settings(db, ctx.tenant_id)
    
    # Resolve supplier GSTIN and address from company if not provided or dummy
    supp_gstin = payload.from_gstin
    supp_name = payload.from_trade_name
    supp_addr = payload.from_address
    from_city = payload.from_city
    from_pin = payload.from_pincode

    if company:
        comp_gst = None
        if company.gst_registrations:
            comp_gst = next((r.get("gstin") for r in company.gst_registrations if r.get("is_primary")), None) or (company.gst_registrations[0].get("gstin") if company.gst_registrations else None)
        comp_gst = comp_gst or company.gst_number
        if not supp_gstin or supp_gstin == "29AAGCB1286Q000":
            supp_gstin = comp_gst or supp_gstin
        if not supp_name or supp_name == "welton":
            supp_name = company.legal_name or company.name or supp_name
        if not supp_addr or supp_addr == "2ND CROSS NO 59 19 A":
            supp_addr = company.address or supp_addr
        if not from_city or from_city == "Bengaluru":
            from_city = company.city or from_city

    invoice_data = {
        "invoice_number": payload.invoice_number,
        "invoice_date": payload.invoice_date,
        "total_amount": payload.total_amount,
        "cgst_amount": payload.cgst_amount,
        "sgst_amount": payload.sgst_amount,
        "igst_amount": payload.igst_amount,
        "supplier_gstin": supp_gstin,
        "supplier_name": supp_name,
        "supplier_address": supp_addr,
        "from_city": from_city,
        "from_pincode": from_pin,
        "recipient_gstin": payload.to_gstin,
        "recipient_name": payload.to_customer_name,
        "recipient_address": payload.to_address,
        "to_city": payload.to_city,
        "to_pincode": payload.to_pincode,
        "items": payload.items or [],
    }

    transporter_data = {
        "transporter_id": payload.transporter_id,
        "transporter_name": payload.transporter_name,
        "trans_doc_no": payload.lr_number,
        "vehicle_no": payload.vehicle_number,
        "trans_mode": payload.transport_mode,
        "distance_km": payload.approx_distance_km,
        "vehicle_type": payload.vehicle_type,
    }

    client = whitebooks_service.get_ewb_client(tenant_settings, override_gstin=supp_gstin)
    res = await client.generate_eway_bill(invoice_data, transporter_data)
    if not res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res.get("message") or "Failed to generate e-Way Bill on GSTN.",
        )
    return res


@router.post("/cancel")
async def cancel_eway_bill(
    payload: EWayBillCancelRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("create:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Cancel an E-Way Bill within 24 hours of generation on the GSTN Portal.
    """
    if not payload.eway_bill_number:
        raise HTTPException(status_code=400, detail="E-Way Bill Number is required.")

    tenant_settings, _ = await _get_tenant_settings(db, ctx.tenant_id)
    client = whitebooks_service.get_ewb_client(tenant_settings)
    res = await client.cancel_eway_bill(
        payload.eway_bill_number,
        payload.cancel_reason_code,
        payload.remarks or "Cancelled by user request",
    )
    if not res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res.get("message") or "Failed to cancel e-Way Bill on GSTN.",
        )
    return res


@router.post("/update-vehicle")
async def update_eway_bill_vehicle(
    payload: EWayBillUpdateVehicleRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("create:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Update Part-B / Vehicle Details for an active E-Way Bill.
    """
    tenant_settings, _ = await _get_tenant_settings(db, ctx.tenant_id)
    client = whitebooks_service.get_ewb_client(tenant_settings)
    res = await client.update_vehicle(
        ewb_number=payload.eway_bill_number,
        vehicle_no=payload.vehicle_no,
        from_place=payload.from_place,
        from_state=payload.from_state,
        reason_code=payload.reason_code,
        remarks=payload.remarks,
    )
    if not res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res.get("message") or "Failed to update Part-B Vehicle on GSTN.",
        )
    return res


@router.get("/{ewb_number}")
async def get_eway_bill_details(
    ewb_number: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Fetch full E-Way Bill metadata and status from Whitebooks GSP.
    """
    tenant_settings, _ = await _get_tenant_settings(db, ctx.tenant_id)
    client = whitebooks_service.get_ewb_client(tenant_settings)
    res = await client.get_eway_bill_details(ewb_number)
    if not res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=res.get("message") or f"e-Way Bill {ewb_number} not found on GSTN Portal.",
        )
    return res
