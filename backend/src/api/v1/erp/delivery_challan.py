from typing import Annotated
import uuid
import random
import string
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission
from src.database.session import get_db
from src.models.erp import DeliveryChallan, DeliveryChallanItem, Invoice, InvoiceLine
from src.models.inventory import Product, StockMovement
from src.schemas.erp import (
    DeliveryChallanCreate,
    DeliveryChallanResponse,
)
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter(prefix="/delivery-challans", tags=["ERP - Delivery Challans"])

def generate_challan_number():
    return "DC-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


@router.post("", response_model=DeliveryChallanResponse, status_code=status.HTTP_201_CREATED)
async def create_delivery_challan(
    payload: DeliveryChallanCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    challan = DeliveryChallan(
        tenant_id=ctx.tenant_id,
        invoice_id=payload.invoice_id,
        customer_id=payload.customer_id,
        reference_number=payload.reference_number,
        recipient_name=payload.recipient_name,
        challan_number=generate_challan_number(),
        challan_date=payload.challan_date,
        status="draft",
        transporter_name=payload.transporter_name,
        vehicle_number=payload.vehicle_number,
        waybill_number=payload.waybill_number,
        notes=payload.notes,
    )
    db.add(challan)
    await db.flush()

    for item in payload.items:
        challan_item = DeliveryChallanItem(
            challan_id=challan.id,
            product_id=item.product_id,
            product_name=item.product_name,
            quantity=item.quantity,
            uom=item.uom,
        )
        db.add(challan_item)

    await db.commit()
    await db.refresh(challan)
    
    # Reload with items
    stmt = select(DeliveryChallan).options(selectinload(DeliveryChallan.items)).where(DeliveryChallan.id == challan.id)
    result = await db.execute(stmt)
    return result.scalar_one()


@router.get("", response_model=PaginatedResponse)
async def list_delivery_challans(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    status_filter: str | None = None,
    customer_id: str | None = None,
    search: str | None = None,
):
    q = select(DeliveryChallan).where(DeliveryChallan.tenant_id == ctx.tenant_id)

    if status_filter:
        q = q.where(DeliveryChallan.status == status_filter)
    if customer_id:
        try:
            cid = uuid.UUID(customer_id)
            q = q.where(DeliveryChallan.customer_id == cid)
        except ValueError:
            pass
    if search:
        q = q.where(DeliveryChallan.challan_number.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(q.subquery()))

    q = q.order_by(desc(DeliveryChallan.created_at))
    q = q.options(selectinload(DeliveryChallan.items))

    result = await db.execute(q.offset((page - 1) * page_size).limit(page_size))
    return paginate(result.scalars().unique().all(), total or 0, page, page_size)


@router.get("/{challan_id}", response_model=DeliveryChallanResponse)
async def get_delivery_challan(
    challan_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    stmt = select(DeliveryChallan).options(selectinload(DeliveryChallan.items)).where(
        DeliveryChallan.id == challan_id,
        DeliveryChallan.tenant_id == ctx.tenant_id,
    )
    result = await db.execute(stmt)
    challan = result.scalar_one_or_none()
    if not challan:
        raise HTTPException(status_code=404, detail="Delivery Challan not found")
    return challan


@router.post("/{challan_id}/dispatch", response_model=DeliveryChallanResponse)
async def dispatch_delivery_challan(
    challan_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    stmt = select(DeliveryChallan).options(selectinload(DeliveryChallan.items)).where(
        DeliveryChallan.id == challan_id,
        DeliveryChallan.tenant_id == ctx.tenant_id,
    ).with_for_update()
    
    result = await db.execute(stmt)
    challan = result.scalar_one_or_none()
    
    if not challan:
        raise HTTPException(status_code=404, detail="Delivery Challan not found")
        
    if challan.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft challans can be dispatched")

    # Deduct stock and record movement
    for item in challan.items:
        if not item.product_id:
            continue
            
        prod_stmt = select(Product).where(
            Product.id == item.product_id,
            Product.tenant_id == ctx.tenant_id
        ).with_for_update()
        
        prod_res = await db.execute(prod_stmt)
        product = prod_res.scalar_one_or_none()
        
        if product:
            if product.initial_stock is None:
                product.initial_stock = 0
            product.initial_stock -= item.quantity
            
            movement = StockMovement(
                tenant_id=ctx.tenant_id,
                movement_number=f"SM-{challan.challan_number}-{str(uuid.uuid4())[:8]}",
                product_id=product.id,
                source_location="Warehouse",
                destination_location="Customer Dispatch",
                quantity=-item.quantity,
                notes=f"Dispatched via Challan: {challan.challan_number}",
                status="Completed"
            )
            db.add(movement)

    challan.status = "dispatched"
    await db.commit()
    await db.refresh(challan)
    
    return challan


@router.put("/{challan_id}", response_model=DeliveryChallanResponse)
@router.patch("/{challan_id}", response_model=DeliveryChallanResponse)
async def update_delivery_challan(
    challan_id: uuid.UUID,
    payload: DeliveryChallanCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    stmt = select(DeliveryChallan).options(selectinload(DeliveryChallan.items)).where(
        DeliveryChallan.id == challan_id,
        DeliveryChallan.tenant_id == ctx.tenant_id,
    ).with_for_update()

    result = await db.execute(stmt)
    challan = result.scalar_one_or_none()
    if not challan:
        raise HTTPException(status_code=404, detail="Delivery Challan not found")

    challan.invoice_id = payload.invoice_id
    challan.customer_id = payload.customer_id
    challan.reference_number = payload.reference_number
    challan.recipient_name = payload.recipient_name
    challan.challan_date = payload.challan_date
    challan.transporter_name = payload.transporter_name
    challan.vehicle_number = payload.vehicle_number
    challan.waybill_number = payload.waybill_number
    challan.notes = payload.notes

    # Delete existing items and insert updated ones
    await db.execute(
        delete(DeliveryChallanItem).where(DeliveryChallanItem.challan_id == challan.id)
    )

    for item in payload.items:
        challan_item = DeliveryChallanItem(
            challan_id=challan.id,
            product_id=item.product_id,
            product_name=item.product_name,
            quantity=item.quantity,
            uom=item.uom,
        )
        db.add(challan_item)

    await db.commit()
    await db.refresh(challan)

    stmt = select(DeliveryChallan).options(selectinload(DeliveryChallan.items)).where(DeliveryChallan.id == challan.id)
    result = await db.execute(stmt)
    return result.scalar_one()


@router.delete("/{challan_id}")
async def delete_delivery_challan(
    challan_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:inventory"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    stmt = select(DeliveryChallan).where(
        DeliveryChallan.id == challan_id,
        DeliveryChallan.tenant_id == ctx.tenant_id,
    )
    result = await db.execute(stmt)
    challan = result.scalar_one_or_none()
    if not challan:
        raise HTTPException(status_code=404, detail="Delivery Challan not found")

    await db.execute(
        delete(DeliveryChallanItem).where(DeliveryChallanItem.challan_id == challan.id)
    )
    await db.delete(challan)
    await db.commit()
    return {"message": "Delivery Challan deleted successfully"}

