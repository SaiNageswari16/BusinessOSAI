import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import get_db, require_any_permission, require_permission, CurrentUserContext
from src.models.inventory import GoodsReceipt, GoodsReceiptItem
from src.schemas.inventory_operations import GoodsReceiptCreate, GoodsReceiptResponse, GoodsReceiptUpdate
from src.utils.notifications import add_system_notification

router = APIRouter()

@router.get("/", response_model=List[GoodsReceiptResponse])
async def list_goods_receipts(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos"))
):
    stmt = select(GoodsReceipt).where(GoodsReceipt.tenant_id == ctx.tenant_id).options(selectinload(GoodsReceipt.items)).offset(skip).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/{receipt_id}", response_model=GoodsReceiptResponse)
async def get_goods_receipt(
    receipt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos"))
):
    stmt = select(GoodsReceipt).where(
        GoodsReceipt.id == receipt_id,
        GoodsReceipt.tenant_id == ctx.tenant_id
    ).options(selectinload(GoodsReceipt.items))
    res = await db.execute(stmt)
    receipt = res.scalar_one_or_none()
    
    if not receipt:
        raise HTTPException(status_code=404, detail="Goods Receipt not found")
        
    return receipt


@router.post("/", response_model=GoodsReceiptResponse)
async def create_goods_receipt(
    data: GoodsReceiptCreate,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_permission("manage:erp"))
):
    new_receipt = GoodsReceipt(
        tenant_id=ctx.tenant_id,
        receipt_number=data.receipt_number,
        supplier=data.supplier,
        reference_number=data.reference_number,
        notes=data.notes,
        status=data.status
    )
    
    if data.items:
        for item in data.items:
            new_item = GoodsReceiptItem(
                tenant_id=ctx.tenant_id,
                product_id=item.product_id,
                quantity_received=item.quantity_received,
                unit_price=item.unit_price
            )
            new_receipt.items.append(new_item)
            
    db.add(new_receipt)
    await db.flush()

    await add_system_notification(
        db, 
        ctx.tenant_id, 
        f"Goods Receipt Submitted: {new_receipt.receipt_number}", 
        f"Goods receipt '{new_receipt.receipt_number}' from supplier '{new_receipt.supplier or 'Unknown'}' was submitted by {ctx.user.full_name}", 
        "inventory"
    )
    await db.commit()
    await db.refresh(new_receipt)
    
    # Reload with items
    stmt = select(GoodsReceipt).where(GoodsReceipt.id == new_receipt.id).options(selectinload(GoodsReceipt.items))
    res = await db.execute(stmt)
    return res.scalar_one()


@router.put("/{receipt_id}", response_model=GoodsReceiptResponse)
async def update_goods_receipt(
    receipt_id: uuid.UUID,
    data: GoodsReceiptCreate,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_permission("manage:erp"))
):
    stmt = select(GoodsReceipt).where(
        GoodsReceipt.id == receipt_id,
        GoodsReceipt.tenant_id == ctx.tenant_id
    ).options(selectinload(GoodsReceipt.items))
    res = await db.execute(stmt)
    receipt = res.scalar_one_or_none()
    
    if not receipt:
        raise HTTPException(status_code=404, detail="Goods Receipt not found")
        
    receipt.receipt_number = data.receipt_number or receipt.receipt_number
    receipt.supplier = data.supplier
    receipt.reference_number = data.reference_number
    receipt.notes = data.notes
    receipt.status = data.status or receipt.status
    
    # Clean existing items and re-add
    for item in list(receipt.items):
        await db.delete(item)
    receipt.items.clear()
    
    if data.items:
        for item in data.items:
            new_item = GoodsReceiptItem(
                tenant_id=ctx.tenant_id,
                product_id=item.product_id,
                quantity_received=item.quantity_received,
                unit_price=item.unit_price
            )
            receipt.items.append(new_item)
            
    await db.commit()
    await db.refresh(receipt)
    
    # Reload with items
    stmt = select(GoodsReceipt).where(GoodsReceipt.id == receipt.id).options(selectinload(GoodsReceipt.items))
    res = await db.execute(stmt)
    return res.scalar_one()


@router.delete("/{receipt_id}")
async def delete_goods_receipt(
    receipt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_permission("manage:erp"))
):
    stmt = select(GoodsReceipt).where(
        GoodsReceipt.id == receipt_id,
        GoodsReceipt.tenant_id == ctx.tenant_id
    )
    res = await db.execute(stmt)
    receipt = res.scalar_one_or_none()
    
    if not receipt:
        raise HTTPException(status_code=404, detail="Goods Receipt not found")
        
    await db.delete(receipt)
    await db.commit()
    return {"status": "success"}
