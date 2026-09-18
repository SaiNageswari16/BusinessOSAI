"""Tax Management — Tax Codes, Returns, Payments."""
import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from src.api.deps import CurrentUserContext, require_permission, require_any_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models.erp import TaxCode, TaxPayment, TaxReturn
from src.schemas.erp_accounting import (
    TaxCodeCreate,
    TaxCodeResponse,
    TaxCodeUpdate,
    TaxPaymentCreate,
    TaxPaymentResponse,
    TaxReturnCreate,
    TaxReturnResponse,
    TaxReturnUpdate,
)
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter(prefix="/tax", tags=["Tax Management"])

DEFAULT_GST_CODES = [
    {"code": "GST0", "name": "GST 0% (Exempt / Nil Rated)", "tax_type": "GST", "rate_percent": 0.0, "is_inclusive": True},
    {"code": "GST0.1", "name": "GST 0.1% (Diamond / Precious Stones)", "tax_type": "GST", "rate_percent": 0.1, "is_inclusive": True},
    {"code": "GST0.25", "name": "GST 0.25% (Rough Precious Stones)", "tax_type": "GST", "rate_percent": 0.25, "is_inclusive": True},
    {"code": "GST1.5", "name": "GST 1.5% (Precious Metals Special)", "tax_type": "GST", "rate_percent": 1.5, "is_inclusive": True},
    {"code": "GST3", "name": "GST 3% (Gold / Silver / Jewelry)", "tax_type": "GST", "rate_percent": 3.0, "is_inclusive": True},
    {"code": "GST5", "name": "GST 5% (CGST 2.5% + SGST 2.5%)", "tax_type": "GST", "rate_percent": 5.0, "is_inclusive": True},
    {"code": "GST6", "name": "GST 6% (CGST 3% + SGST 3%)", "tax_type": "GST", "rate_percent": 6.0, "is_inclusive": True},
    {"code": "GST12", "name": "GST 12% (CGST 6% + SGST 6%)", "tax_type": "GST", "rate_percent": 12.0, "is_inclusive": True},
    {"code": "GST18", "name": "GST 18% (CGST 9% + SGST 9%)", "tax_type": "GST", "rate_percent": 18.0, "is_inclusive": True},
    {"code": "GST28", "name": "GST 28% (CGST 14% + SGST 14%)", "tax_type": "GST", "rate_percent": 28.0, "is_inclusive": True},
    {"code": "GST40", "name": "GST 40% (Sin / Luxury Goods + Cess)", "tax_type": "GST", "rate_percent": 40.0, "is_inclusive": True},
]


# ─── Tax Codes ─────────────────────────────────────────────────

@router.get("/codes", response_model=list[TaxCodeResponse])
async def list_tax_codes(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:tax", "view:erp", "view:pos", "view:inventory", "view:procurement"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    tax_type: str | None = None,
    active_only: bool = True,
):
    query = select(TaxCode).where(TaxCode.tenant_id == ctx.tenant_id)
    if tax_type:
        query = query.where(TaxCode.tax_type == tax_type)
    if active_only:
        query = query.where(TaxCode.status == "active")
    result = await db.execute(query.order_by(TaxCode.tax_type, TaxCode.rate_percent.asc(), TaxCode.code))
    codes = list(result.scalars().all())

    if not codes and (not tax_type or tax_type == "GST"):
        for item in DEFAULT_GST_CODES:
            tc = TaxCode(
                tenant_id=ctx.tenant_id,
                code=item["code"],
                name=item["name"],
                tax_type=item["tax_type"],
                rate_percent=item["rate_percent"],
                is_inclusive=item["is_inclusive"],
                is_reverse_charge=False,
            )
            db.add(tc)
        try:
            await db.commit()
            result = await db.execute(query.order_by(TaxCode.tax_type, TaxCode.rate_percent.asc(), TaxCode.code))
            codes = list(result.scalars().all())
        except Exception:
            await db.rollback()

    return codes


@router.post(
    "/codes",
    response_model=TaxCodeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_tax_code(
    payload: TaxCodeCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("manage:tax", "manage:erp", "manage:pos", "manage:inventory", "manage:procurement"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    clean_code = payload.code.strip().upper()
    existing = await db.scalar(
        select(TaxCode).where(TaxCode.tenant_id == ctx.tenant_id, TaxCode.code == clean_code)
    )
    if existing:
        existing.name = payload.name
        existing.rate_percent = payload.rate_percent
        existing.is_inclusive = payload.is_inclusive
        existing.is_reverse_charge = payload.is_reverse_charge
        existing.tax_type = payload.tax_type
        if payload.account_id:
            existing.account_id = payload.account_id
        await db.commit()
        await db.refresh(existing)
        return existing

    dump = payload.model_dump()
    dump["code"] = clean_code
    tax_code = TaxCode(tenant_id=ctx.tenant_id, **dump)
    db.add(tax_code)
    await db.flush()
    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="tax",
        action="tax_code_created",
        entity_type="tax_code",
        entity_id=tax_code.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(tax_code)
    return tax_code


@router.patch("/codes/{code_id}", response_model=TaxCodeResponse)
async def update_tax_code(
    code_id: uuid.UUID,
    payload: TaxCodeUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:tax"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tax_code = await db.scalar(
        select(TaxCode).where(TaxCode.id == code_id, TaxCode.tenant_id == ctx.tenant_id)
    )
    if not tax_code:
        raise HTTPException(status_code=404, detail="Tax code not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(tax_code, key, value)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="tax",
        action="tax_code_updated",
        entity_type="tax_code",
        entity_id=tax_code.id,
        new_values=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(tax_code)
    return tax_code


# ─── Tax Returns ───────────────────────────────────────────────

@router.get("/returns", response_model=PaginatedResponse[TaxReturnResponse])
async def list_tax_returns(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:tax"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    return_type: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    period: str | None = None,
):
    query = select(TaxReturn).where(TaxReturn.tenant_id == ctx.tenant_id)
    if return_type:
        query = query.where(TaxReturn.return_type == return_type)
    if status_filter:
        query = query.where(TaxReturn.status == status_filter)
    if period:
        query = query.where(TaxReturn.period == period)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(TaxReturn.period.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.get("/returns/{return_id}", response_model=TaxReturnResponse)
async def get_tax_return(
    return_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:tax"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tax_return = await db.scalar(
        select(TaxReturn)
        .where(TaxReturn.id == return_id, TaxReturn.tenant_id == ctx.tenant_id)
    )
    if not tax_return:
        raise HTTPException(status_code=404, detail="Tax return not found")
    return tax_return


@router.post(
    "/returns",
    response_model=TaxReturnResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_tax_return(
    payload: TaxReturnCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:tax"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tax_return = TaxReturn(tenant_id=ctx.tenant_id, status="draft", **payload.model_dump())
    db.add(tax_return)
    await db.flush()
    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="tax",
        action="tax_return_created",
        entity_type="tax_return",
        entity_id=tax_return.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(tax_return)
    return tax_return


@router.patch("/returns/{return_id}", response_model=TaxReturnResponse)
async def update_tax_return(
    return_id: uuid.UUID,
    payload: TaxReturnUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:tax"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tax_return = await db.scalar(
        select(TaxReturn).where(TaxReturn.id == return_id, TaxReturn.tenant_id == ctx.tenant_id)
    )
    if not tax_return:
        raise HTTPException(status_code=404, detail="Tax return not found")

    updates = payload.model_dump(exclude_unset=True)
    old_values = {k: getattr(tax_return, k) for k in updates}
    for key, value in updates.items():
        setattr(tax_return, key, value)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="tax",
        action="tax_return_updated",
        entity_type="tax_return",
        entity_id=tax_return.id,
        old_values=old_values,
        new_values=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(tax_return)
    return tax_return


@router.post("/returns/{return_id}/file", response_model=TaxReturnResponse)
async def file_tax_return(
    return_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("file:tax"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tax_return = await db.scalar(
        select(TaxReturn).where(TaxReturn.id == return_id, TaxReturn.tenant_id == ctx.tenant_id)
    )
    if not tax_return:
        raise HTTPException(status_code=404, detail="Tax return not found")

    tax_return.status = "filed"
    tax_return.filed_at = datetime.now()
    tax_return.filed_by_user_id = ctx.user.id

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="tax",
        action="tax_return_filed",
        entity_type="tax_return",
        entity_id=tax_return.id,
        new_values={"period": tax_return.period},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(tax_return)
    return tax_return


# ─── Tax Payments ──────────────────────────────────────────────

@router.get("/payments", response_model=PaginatedResponse[TaxPaymentResponse])
async def list_tax_payments(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:tax"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    tax_return_id: uuid.UUID | None = None,
    tax_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    query = select(TaxPayment).where(TaxPayment.tenant_id == ctx.tenant_id)
    if tax_return_id:
        query = query.where(TaxPayment.tax_return_id == tax_return_id)
    if tax_type:
        query = query.where(TaxPayment.tax_type == tax_type)
    if date_from:
        query = query.where(TaxPayment.payment_date >= date_from)
    if date_to:
        query = query.where(TaxPayment.payment_date <= date_to)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(TaxPayment.payment_date.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post(
    "/payments",
    response_model=TaxPaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_tax_payment(
    payload: TaxPaymentCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:tax"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tax_payment = TaxPayment(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(tax_payment)
    await db.flush()
    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="tax",
        action="tax_payment_created",
        entity_type="tax_payment",
        entity_id=tax_payment.id,
        new_values={"amount": str(tax_payment.amount), "tax_type": tax_payment.tax_type},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(tax_payment)
    return tax_payment
