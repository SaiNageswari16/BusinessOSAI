"""
GST Filing & Compliance Router
Handles GSTR-1, GSTR-3B Computation, Summary Generation, and Direct GSTN Upload using Whitebooks GSP API.
"""

from datetime import datetime, date
from typing import Annotated, Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission
from src.database.session import get_db
from src.services.whitebooks_service import whitebooks_service

router = APIRouter(prefix="/gst", tags=["GST Filing & Compliance"])


class GSTR1UploadRequest(BaseModel):
    year: int
    month: int
    gstr1_payload: Dict[str, Any]


@router.get("/gstr1-summary")
async def get_gstr1_summary(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(default=datetime.now().year),
    month: int = Query(default=datetime.now().month),
):
    """
    Compute and return GSTR-1 sections (B2B, B2CL, B2CS, HSN Table 12, Doc Issue) for the specified month.
    """
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Invalid month. Must be between 1 and 12.")

    summary = await whitebooks_service.compute_gstr1_summary(
        db=db,
        tenant_id=ctx.tenant_id,
        year=year,
        month=month,
    )
    return summary


@router.post("/gstr1-upload")
async def upload_gstr1(
    payload: GSTR1UploadRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("create:invoices"))],
):
    """
    Verify and push GSTR-1 monthly return directly to the GST portal via Whitebooks GSP.
    """
    res = await whitebooks_service.upload_gstr1_return(payload.gstr1_payload)
    return res


@router.get("/gstr3b-summary")
async def get_gstr3b_summary(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(default=datetime.now().year),
    month: int = Query(default=datetime.now().month),
):
    """
    Compute high-level GSTR-3B tax liability and Input Tax Credit summary.
    """
    gstr1 = await whitebooks_service.compute_gstr1_summary(
        db=db,
        tenant_id=ctx.tenant_id,
        year=year,
        month=month,
    )

    outward_taxable = gstr1.get("total_taxable_value", 0.0)
    cgst_payable = gstr1.get("total_cgst", 0.0)
    sgst_payable = gstr1.get("total_sgst", 0.0)
    igst_payable = gstr1.get("total_igst", 0.0)

    return {
        "period": f"{month:02d}{year}",
        "month_name": datetime(year, month, 1).strftime("%B %Y"),
        "table_3_1_outward_supplies": {
            "nature_of_supplies": "(a) Outward taxable supplies (other than zero rated, nil rated and exempted)",
            "total_taxable_value": outward_taxable,
            "integrated_tax": igst_payable,
            "central_tax": cgst_payable,
            "state_tax": sgst_payable,
            "cess": 0.0,
        },
        "table_4_eligible_itc": {
            "all_other_itc_cgst": round(cgst_payable * 0.4, 2),  # Estimated Input credit
            "all_other_itc_sgst": round(sgst_payable * 0.4, 2),
            "all_other_itc_igst": round(igst_payable * 0.4, 2),
        },
        "net_tax_payable": {
            "cgst": round(cgst_payable * 0.6, 2),
            "sgst": round(sgst_payable * 0.6, 2),
            "igst": round(igst_payable * 0.6, 2),
            "total": round((cgst_payable + sgst_payable + igst_payable) * 0.6, 2),
        },
    }
