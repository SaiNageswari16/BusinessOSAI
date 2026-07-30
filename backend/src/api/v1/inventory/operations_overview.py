from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db, CurrentUserContext, require_any_permission
from src.models.inventory import Product, GoodsIssue, GoodsIssueItem, StockMovement, StockAdjustment

router = APIRouter()

@router.get("/overview")
async def get_operations_overview(
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos"))
):
    # Available stock
    stmt_available = select(func.sum(Product.initial_stock)).where(
        Product.tenant_id == ctx.tenant_id,
        Product.status == "active"
    )
    res_avail = await db.execute(stmt_available)
    available = (res_avail.scalar() or 0)

    # Reserved = goods issues not yet completed (in progress / pending dispatch)
    stmt_reserved = select(func.sum(GoodsIssueItem.quantity_issued)).join(
        GoodsIssue, GoodsIssue.id == GoodsIssueItem.issue_id
    ).where(
        GoodsIssue.tenant_id == ctx.tenant_id,
        GoodsIssue.status != "Completed",
        GoodsIssue.status != "Cancelled",
    )
    res_reserved = await db.execute(stmt_reserved)
    reserved = (res_reserved.scalar() or 0)

    # Damaged = stock adjustments with type containing damage/write-off with negative qty
    stmt_damaged = select(func.abs(func.sum(StockAdjustment.quantity_changed))).where(
        StockAdjustment.tenant_id == ctx.tenant_id,
        StockAdjustment.adjustment_type.ilike("%damage%"),
        StockAdjustment.quantity_changed < 0,
    )
    res_damaged = await db.execute(stmt_damaged)
    damaged = (res_damaged.scalar() or 0)

    # In transit = stock movements not yet completed
    stmt_transit = select(func.sum(StockMovement.quantity)).where(
        StockMovement.tenant_id == ctx.tenant_id,
        StockMovement.status != "Completed",
    )
    res_transit = await db.execute(stmt_transit)
    transit = (res_transit.scalar() or 0)

    # Valuation = stock × purchase_price grouped by warehouse
    stmt_valuation = select(
        Product.warehouse,
        func.sum(Product.initial_stock * Product.purchase_price).label("total_value"),
        func.sum(Product.initial_stock).label("total_qty"),
    ).where(
        Product.tenant_id == ctx.tenant_id,
        Product.warehouse.isnot(None),
        Product.status == "active",
        Product.initial_stock > 0,
    ).group_by(Product.warehouse)

    res_valuation = await db.execute(stmt_valuation)
    rows = res_valuation.all()

    total_value = sum((r.total_value or 0) for r in rows)
    valuation = {}
    for row in rows:
        wh = row.warehouse or "Unassigned"
        val = float(row.total_value or 0)
        pct = round((val / total_value * 100)) if total_value > 0 else 0
        valuation[wh] = {
            "value": f"₹{val:,.0f}",
            "pct": pct,
        }

    return {
        "available": int(available),
        "reserved": int(reserved),
        "damaged": int(damaged),
        "transit": int(transit),
        "expired": 0,
        "valuation": valuation,
    }
