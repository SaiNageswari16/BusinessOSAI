"""Expense Claims — CRUD, approve, reject endpoints."""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models.erp import ExpenseClaim
from src.schemas.erp_accounting import ExpenseClaimCreate, ExpenseClaimResponse, ExpenseClaimUpdate
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter(prefix="/expense-claims", tags=["Expense Claims"])


@router.get("", response_model=PaginatedResponse[ExpenseClaimResponse])
async def list_expense_claims(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = None,
):
    query = select(ExpenseClaim).where(ExpenseClaim.tenant_id == ctx.tenant_id).options(selectinload(ExpenseClaim.lines))
    if status_filter:
        query = query.where(ExpenseClaim.status == status_filter)
    if search:
        query = query.where(ExpenseClaim.description.ilike(f"%{search}%"))
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
    return paginate(result.scalars().unique().all(), total or 0, page, page_size)


@router.get("/{claim_id}", response_model=ExpenseClaimResponse)
async def get_expense_claim(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    claim_id: str,
):
    obj = await db.scalar(
        select(ExpenseClaim).where(ExpenseClaim.id == claim_id, ExpenseClaim.tenant_id == ctx.tenant_id).options(selectinload(ExpenseClaim.lines))
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    return obj


@router.post("", response_model=ExpenseClaimResponse, status_code=status.HTTP_201_CREATED)
async def create_expense_claim(
    payload: ExpenseClaimCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = payload.model_dump()
    lines_data = data.pop("lines", [])
    obj = ExpenseClaim(tenant_id=ctx.tenant_id, **data)
    db.add(obj)
    await db.flush()
    for line in lines_data:
        from src.models.erp import ExpenseClaimLine
        db.add(ExpenseClaimLine(claim_id=obj.id, **line))
    obj.total_amount = sum(l["amount"] for l in lines_data)
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="expense_claims", action="created", entity_type="expense_claim", entity_id=obj.id, new_values={"total_amount": str(obj.total_amount)}, ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{claim_id}", response_model=ExpenseClaimResponse)
async def update_expense_claim(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    claim_id: str,
    payload: ExpenseClaimUpdate,
    request: Request,
):
    obj = await db.scalar(
        select(ExpenseClaim).where(ExpenseClaim.id == claim_id, ExpenseClaim.tenant_id == ctx.tenant_id).options(selectinload(ExpenseClaim.lines))
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    old = {k: getattr(obj, k) for k in ("status", "description", "rejection_reason")}
    for k, v in payload.model_dump(exclude_unset=True).items():
        if k != "lines":
            setattr(obj, k, v)
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="expense_claims", action="updated", entity_type="expense_claim", entity_id=obj.id, old_values=old, ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    await db.commit()
    await db.refresh(obj)
    return obj


@router.post("/{claim_id}/approve", response_model=dict)
async def approve_expense_claim(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("approve:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    claim_id: str,
    request: Request,
    note: str | None = None,
):
    obj = await db.scalar(select(ExpenseClaim).where(ExpenseClaim.id == claim_id, ExpenseClaim.tenant_id == ctx.tenant_id))
    if not obj:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    obj.status = "approved"
    obj.approved_by_user_id = ctx.user.id
    from datetime import datetime
    obj.approved_at = datetime.now()
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="expense_claims", action="approved", entity_type="expense_claim", entity_id=obj.id, ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    await db.commit()
    return {"message": "Expense claim approved"}


@router.post("/{claim_id}/reject", response_model=dict)
async def reject_expense_claim(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("approve:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    claim_id: str,
    request: Request,
    reason: str = "",
):
    obj = await db.scalar(select(ExpenseClaim).where(ExpenseClaim.id == claim_id, ExpenseClaim.tenant_id == ctx.tenant_id))
    if not obj:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    obj.status = "rejected"
    obj.rejection_reason = reason
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="expense_claims", action="rejected", entity_type="expense_claim", entity_id=obj.id, ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    await db.commit()
    return {"message": "Expense claim rejected"}


@router.delete("/{claim_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense_claim(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    claim_id: str,
    request: Request,
):
    obj = await db.scalar(select(ExpenseClaim).where(ExpenseClaim.id == claim_id, ExpenseClaim.tenant_id == ctx.tenant_id))
    if not obj:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    await db.delete(obj)
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="expense_claims", action="deleted", entity_type="expense_claim", entity_id=claim_id, ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    await db.commit()
