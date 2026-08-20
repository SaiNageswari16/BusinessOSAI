"""
E-Way Bill Router
Provides endpoints for Generating, Tracking, and Cancelling E-Way Bills using Whitebooks GSP API.
"""

from typing import Annotated, Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from src.api.deps import CurrentUserContext, require_permission
from src.database.session import get_db
from src.models.erp import Invoice
from src.services.whitebooks_service import whitebooks_service

router = APIRouter(prefix="/eway-bill", tags=["E-Way Bill"])


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


@router.post("/generate")
async def generate_eway_bill(
    payload: EWayBillGenerateRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("create:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Generate an official E-Way Bill for consignments exceeding ₹50,000.
    """
    if payload.total_amount <= 0:
        raise HTTPException(status_code=400, detail="Consignment total value must be greater than zero.")

    invoice_data = {
        "invoice_number": payload.invoice_number,
        "invoice_date": payload.invoice_date,
        "grand_total": payload.total_amount,
        "cgst_amount": payload.cgst_amount,
        "sgst_amount": payload.sgst_amount,
        "igst_amount": payload.igst_amount,
        "from_gstin": payload.from_gstin,
        "from_trade_name": payload.from_trade_name,
        "from_address": payload.from_address,
        "from_city": payload.from_city,
        "from_pincode": payload.from_pincode,
        "to_gstin": payload.to_gstin,
        "to_customer_name": payload.to_customer_name,
        "to_address": payload.to_address,
        "to_city": payload.to_city,
        "to_pincode": payload.to_pincode,
        "items": payload.items or [],
    }

    transporter_data = {
        "transporter_id": payload.transporter_id,
        "transporter_name": payload.transporter_name,
        "lr_number": payload.lr_number,
        "vehicle_number": payload.vehicle_number,
        "transport_mode": payload.transport_mode,
        "approx_distance_km": payload.approx_distance_km,
        "vehicle_type": payload.vehicle_type,
    }

    res = await whitebooks_service.generate_eway_bill(invoice_data, transporter_data)
    return res


@router.post("/cancel")
async def cancel_eway_bill(
    payload: EWayBillCancelRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("create:invoices"))],
):
    """
    Cancel an E-Way Bill within 24 hours of generation.
    """
    if not payload.eway_bill_number:
        raise HTTPException(status_code=400, detail="E-Way Bill Number is required.")

    res = await whitebooks_service.cancel_eway_bill(
        payload.eway_bill_number,
        payload.cancel_reason_code,
        payload.remarks or "Cancelled by user request",
    )
    return res
