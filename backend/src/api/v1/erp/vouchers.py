"""Payment Vouchers & Expense Claims."""
import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models.erp import (
    ExpenseClaim,
    ExpenseClaimLine,
    PaymentVoucher,
    PaymentVoucherLine,
)
from src.schemas.erp_accounting import (
    BudgetCreate,
    BudgetResponse,
    BudgetUpdate,
    ExpenseClaimCreate,
    ExpenseClaimLineCreate,
    ExpenseClaimLineResponse,
    ExpenseClaimResponse,
    ExpenseClaimUpdate,
    PaymentVoucherCreate,
    PaymentVoucherLineCreate,
    PaymentVoucherLineResponse,
    PaymentVoucherResponse,
    PaymentVoucherUpdate,
)
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter(prefix="/vouchers", tags=["Vouchers & Expenses"])


# ─── Payment Vouchers ──────────────────────────────────────────

@router.get("/payment-vouchers", response_model=PaginatedResponse[PaymentVoucherResponse])
async def list_payment_vouchers(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:payment_vouchers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    voucher_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    search: str | None = None,
):
    query = select(PaymentVoucher).where(PaymentVoucher.tenant_id == ctx.tenant_id)
    if status_filter:
        query = query.where(PaymentVoucher.status == status_filter)
    if voucher_type:
        query = query.where(PaymentVoucher.voucher_type == voucher_type)
    if date_from:
        query = query.where(PaymentVoucher.voucher_date >= date_from)
    if date_to:
        query = query.where(PaymentVoucher.voucher_date <= date_to)
    if search:
        query = query.where(
            PaymentVoucher.voucher_number.ilike(f"%{search}%")
            | PaymentVoucher.payee_name.ilike(f"%{search}%")
        )

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(PaymentVoucher.voucher_date.desc())
        .options(selectinload(PaymentVoucher.lines))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.get("/payment-vouchers/{voucher_id}", response_model=PaymentVoucherResponse)
async def get_payment_voucher(
    voucher_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:payment_vouchers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    voucher = await db.scalar(
        select(PaymentVoucher)
        .options(selectinload(PaymentVoucher.lines))
        .where(PaymentVoucher.id == voucher_id, PaymentVoucher.tenant_id == ctx.tenant_id)
    )
    if not voucher:
        raise HTTPException(status_code=404, detail="Payment voucher not found")
    return voucher


@router.post(
    "/payment-vouchers",
    response_model=PaymentVoucherResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_payment_voucher(
    payload: PaymentVoucherCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:payment_vouchers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.utils.number_series import generate_number

    voucher_number = await generate_number(db, ctx.tenant_id, "voucher", payload.company_id)

    total_amount = sum(line.amount for line in payload.lines)

    voucher = PaymentVoucher(
        tenant_id=ctx.tenant_id,
        voucher_number=voucher_number,
        total_amount=total_amount,
        status="draft",
        **payload.model_dump(exclude={"lines"}),
    )
    db.add(voucher)
    await db.flush()

    for idx, line_payload in enumerate(payload.lines):
        line = PaymentVoucherLine(
            voucher_id=voucher.id,
            line_number=idx + 1,
            **line_payload.model_dump(),
        )
        db.add(line)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="vouchers",
        action="payment_voucher_created",
        entity_type="payment_voucher",
        entity_id=voucher.id,
        new_values={"voucher_number": voucher_number, "total": str(total_amount)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    voucher = await db.scalar(
        select(PaymentVoucher)
        .options(selectinload(PaymentVoucher.lines))
        .where(PaymentVoucher.id == voucher.id)
    )
    return voucher


@router.patch("/payment-vouchers/{voucher_id}", response_model=PaymentVoucherResponse)
async def update_payment_voucher(
    voucher_id: uuid.UUID,
    payload: PaymentVoucherUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:payment_vouchers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    voucher = await db.scalar(
        select(PaymentVoucher)
        .options(selectinload(PaymentVoucher.lines))
        .where(PaymentVoucher.id == voucher_id, PaymentVoucher.tenant_id == ctx.tenant_id)
    )
    if not voucher:
        raise HTTPException(status_code=404, detail="Payment voucher not found")

    updates = payload.model_dump(exclude_unset=True, exclude={"lines"})
    for key, value in updates.items():
        setattr(voucher, key, value)

    if payload.lines is not None:
        for old_line in list(voucher.lines):
            await db.delete(old_line)
        for idx, line_payload in enumerate(payload.lines):
            line = PaymentVoucherLine(
                voucher_id=voucher.id,
                line_number=idx + 1,
                **line_payload.model_dump(),
            )
            db.add(line)
        voucher.total_amount = sum(line.amount for line in payload.lines)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="vouchers",
        action="payment_voucher_updated",
        entity_type="payment_voucher",
        entity_id=voucher.id,
        new_values=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    voucher = await db.scalar(
        select(PaymentVoucher)
        .options(selectinload(PaymentVoucher.lines))
        .where(PaymentVoucher.id == voucher.id)
    )
    return voucher


@router.post("/payment-vouchers/{voucher_id}/approve")
async def approve_payment_voucher(
    voucher_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("approve:payment_vouchers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    voucher = await db.scalar(
        select(PaymentVoucher).where(
            PaymentVoucher.id == voucher_id, PaymentVoucher.tenant_id == ctx.tenant_id
        )
    )
    if not voucher:
        raise HTTPException(status_code=404, detail="Payment voucher not found")

    voucher.status = "approved"
    voucher.approved_by_user_id = ctx.user.id
    voucher.approved_at = datetime.now()

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="vouchers",
        action="payment_voucher_approved",
        entity_type="payment_voucher",
        entity_id=voucher.id,
        new_values={"voucher_number": voucher.voucher_number},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return {"status": "approved", "voucher_number": voucher.voucher_number}


# ─── Expense Claims ────────────────────────────────────────────

@router.get("/expense-claims", response_model=PaginatedResponse[ExpenseClaimResponse])
async def list_expense_claims(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    date_from: str | None = None,
    date_to: str | None = None,
):
    query = select(ExpenseClaim).where(ExpenseClaim.tenant_id == ctx.tenant_id)
    if status_filter:
        query = query.where(ExpenseClaim.status == status_filter)
    if date_from:
        query = query.where(ExpenseClaim.claim_date >= date_from)
    if date_to:
        query = query.where(ExpenseClaim.claim_date <= date_to)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(ExpenseClaim.claim_date.desc())
        .options(selectinload(ExpenseClaim.lines))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.get("/expense-claims/{claim_id}", response_model=ExpenseClaimResponse)
async def get_expense_claim(
    claim_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    claim = await db.scalar(
        select(ExpenseClaim)
        .options(selectinload(ExpenseClaim.lines))
        .where(ExpenseClaim.id == claim_id, ExpenseClaim.tenant_id == ctx.tenant_id)
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    return claim


@router.post(
    "/expense-claims",
    response_model=ExpenseClaimResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_expense_claim(
    payload: ExpenseClaimCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    total_amount = sum(line.amount for line in payload.lines)
    claim_number = f"EC-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"

    claim = ExpenseClaim(
        tenant_id=ctx.tenant_id,
        claim_number=claim_number,
        total_amount=total_amount,
        status="pending",
        **payload.model_dump(exclude={"lines"}),
    )
    db.add(claim)
    await db.flush()

    for idx, line_payload in enumerate(payload.lines):
        line = ExpenseClaimLine(
            claim_id=claim.id,
            line_number=idx + 1,
            **line_payload.model_dump(),
        )
        db.add(line)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="vouchers",
        action="expense_claim_created",
        entity_type="expense_claim",
        entity_id=claim.id,
        new_values={"claim_number": claim_number, "total": str(total_amount)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    claim = await db.scalar(
        select(ExpenseClaim)
        .options(selectinload(ExpenseClaim.lines))
        .where(ExpenseClaim.id == claim.id)
    )
    return claim


@router.patch("/expense-claims/{claim_id}", response_model=ExpenseClaimResponse)
async def update_expense_claim(
    claim_id: uuid.UUID,
    payload: ExpenseClaimUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    claim = await db.scalar(
        select(ExpenseClaim)
        .options(selectinload(ExpenseClaim.lines))
        .where(ExpenseClaim.id == claim_id, ExpenseClaim.tenant_id == ctx.tenant_id)
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Expense claim not found")

    updates = payload.model_dump(exclude_unset=True, exclude={"lines"})
    for key, value in updates.items():
        setattr(claim, key, value)

    if payload.lines is not None:
        for old_line in list(claim.lines):
            await db.delete(old_line)
        for idx, line_payload in enumerate(payload.lines):
            line = ExpenseClaimLine(
                claim_id=claim.id,
                line_number=idx + 1,
                **line_payload.model_dump(),
            )
            db.add(line)
        claim.total_amount = sum(line.amount for line in payload.lines)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="vouchers",
        action="expense_claim_updated",
        entity_type="expense_claim",
        entity_id=claim.id,
        new_values=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    claim = await db.scalar(
        select(ExpenseClaim)
        .options(selectinload(ExpenseClaim.lines))
        .where(ExpenseClaim.id == claim.id)
    )
    return claim


@router.post("/expense-claims/{claim_id}/approve")
async def approve_expense_claim(
    claim_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("approve:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    claim = await db.scalar(
        select(ExpenseClaim).where(
            ExpenseClaim.id == claim_id, ExpenseClaim.tenant_id == ctx.tenant_id
        )
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Expense claim not found")

    claim.status = "approved"
    claim.approved_by_user_id = ctx.user.id
    claim.approved_at = datetime.now()

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="vouchers",
        action="expense_claim_approved",
        entity_type="expense_claim",
        entity_id=claim.id,
        new_values={"claim_number": claim.claim_number},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return {"status": "approved", "claim_number": claim.claim_number}


# ─── Budgets ───────────────────────────────────────────────────

@router.get("/budgets", response_model=PaginatedResponse[BudgetResponse])
async def list_budgets(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:budgets"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    company_id: uuid.UUID | None = None,
    category: str | None = None,
):
    query = select(Budget).where(Budget.tenant_id == ctx.tenant_id)
    if company_id:
        query = query.where(Budget.company_id == company_id)
    if category:
        query = query.where(Budget.category == category)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(Budget.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post(
    "/budgets",
    response_model=BudgetResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_budget(
    payload: BudgetCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:budgets"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    budget = Budget(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(budget)
    await db.flush()
    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="vouchers",
        action="budget_created",
        entity_type="budget",
        entity_id=budget.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(budget)
    return budget


@router.patch("/budgets/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: uuid.UUID,
    payload: BudgetUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:budgets"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    budget = await db.scalar(
        select(Budget).where(Budget.id == budget_id, Budget.tenant_id == ctx.tenant_id)
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(budget, key, value)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="vouchers",
        action="budget_updated",
        entity_type="budget",
        entity_id=budget.id,
        new_values=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(budget)
    return budget
