"""Budget Management — CRUD endpoints."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models.erp import Budget
from src.schemas.erp_accounting import BudgetCreate, BudgetResponse, BudgetUpdate
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter(prefix="/budgets", tags=["Budgets"])


@router.get("", response_model=PaginatedResponse[BudgetResponse])
async def list_budgets(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:budgets"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
):
    query = select(Budget).where(Budget.tenant_id == ctx.tenant_id)
    if search:
        query = query.where(Budget.name.ilike(f"%{search}%") | Budget.category.ilike(f"%{search}%"))
    if status_filter:
        query = query.where(Budget.status == status_filter)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.get("/{budget_id}", response_model=BudgetResponse)
async def get_budget(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:budgets"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    budget_id: str,
):
    obj = await db.scalar(select(Budget).where(Budget.id == budget_id, Budget.tenant_id == ctx.tenant_id))
    if not obj:
        raise HTTPException(status_code=404, detail="Budget not found")
    return obj


@router.post("", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(
    payload: BudgetCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:budgets"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    obj = Budget(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(obj)
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="budgets", action="created", entity_type="budget", entity_id=obj.id, new_values={"name": obj.name, "amount": str(obj.budgeted_amount)}, ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:budgets"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    budget_id: str,
    payload: BudgetUpdate,
    request: Request,
):
    obj = await db.scalar(select(Budget).where(Budget.id == budget_id, Budget.tenant_id == ctx.tenant_id))
    if not obj:
        raise HTTPException(status_code=404, detail="Budget not found")
    old = {k: getattr(obj, k) for k in ("name", "status", "budgeted_amount", "actual_amount", "notes")}
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="budgets", action="updated", entity_type="budget", entity_id=obj.id, old_values=old, ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:budgets"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    budget_id: str,
    request: Request,
):
    obj = await db.scalar(select(Budget).where(Budget.id == budget_id, Budget.tenant_id == ctx.tenant_id))
    if not obj:
        raise HTTPException(status_code=404, detail="Budget not found")
    await db.delete(obj)
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="budgets", action="deleted", entity_type="budget", entity_id=budget_id, ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    await db.commit()
