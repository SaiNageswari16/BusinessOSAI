import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import get_db, require_any_permission, require_permission, CurrentUserContext
from src.models.inventory import GoodsIssue, GoodsIssueItem
from src.schemas.inventory_operations import GoodsIssueCreate, GoodsIssueResponse, GoodsIssueUpdate

router = APIRouter()

@router.get("/", response_model=List[GoodsIssueResponse])
async def list_goods_issues(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos"))
):
    stmt = select(GoodsIssue).where(GoodsIssue.tenant_id == ctx.tenant_id).options(selectinload(GoodsIssue.items)).offset(skip).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/{issue_id}", response_model=GoodsIssueResponse)
async def get_goods_issue(
    issue_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos"))
):
    stmt = select(GoodsIssue).where(
        GoodsIssue.id == issue_id,
        GoodsIssue.tenant_id == ctx.tenant_id
    ).options(selectinload(GoodsIssue.items))
    res = await db.execute(stmt)
    issue = res.scalar_one_or_none()
    
    if not issue:
        raise HTTPException(status_code=404, detail="Goods Issue not found")
        
    return issue


@router.post("/", response_model=GoodsIssueResponse)
async def create_goods_issue(
    data: GoodsIssueCreate,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_permission("manage:erp"))
):
    new_issue = GoodsIssue(
        tenant_id=ctx.tenant_id,
        issue_number=data.issue_number,
        recipient=data.recipient,
        reference_number=data.reference_number,
        notes=data.notes,
        status=data.status
    )
    
    if data.items:
        for item in data.items:
            new_item = GoodsIssueItem(
                tenant_id=ctx.tenant_id,
                product_id=item.product_id,
                quantity_issued=item.quantity_issued
            )
            new_issue.items.append(new_item)
            
    db.add(new_issue)
    await db.commit()
    await db.refresh(new_issue)
    
    # Reload with items
    stmt = select(GoodsIssue).where(GoodsIssue.id == new_issue.id).options(selectinload(GoodsIssue.items))
    res = await db.execute(stmt)
    return res.scalar_one()


@router.delete("/{issue_id}")
async def delete_goods_issue(
    issue_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_permission("manage:erp"))
):
    stmt = select(GoodsIssue).where(
        GoodsIssue.id == issue_id,
        GoodsIssue.tenant_id == ctx.tenant_id
    )
    res = await db.execute(stmt)
    issue = res.scalar_one_or_none()
    
    if not issue:
        raise HTTPException(status_code=404, detail="Goods Issue not found")
        
    await db.delete(issue)
    await db.commit()
    return {"status": "success"}
