from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db, require_any_permission, CurrentUserContext
from src.models.inventory import Product, Warehouse

router = APIRouter()

@router.get("/overview")
async def get_operations_overview(
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos"))
):
    cid = ctx.active_company_id

    prod_filter = [Product.tenant_id == ctx.tenant_id]
    if cid:
        prod_filter.append(Product.company_id == cid)

    prods_stmt = select(
        Product.id,
        Product.name,
        Product.warehouse,
        Product.on_hand_stock,
        Product.initial_stock,
        Product.selling_price,
        Product.mrp,
        Product.purchase_price,
        Product.reserved_stock
    ).where(*prod_filter)

    prods_res = await db.execute(prods_stmt)
    prods = prods_res.all()

    wh_filter = [Warehouse.tenant_id == ctx.tenant_id]
    if cid:
        wh_filter.append(Warehouse.company_id == cid)
    whs_stmt = select(Warehouse.id, Warehouse.name).where(*wh_filter)
    whs_res = await db.execute(whs_stmt)
    whs = whs_res.all()

    wh_val_map = {w[1]: 0.0 for w in whs}
    total_val = 0.0
    total_available = 0
    total_reserved = 0
    unassigned_val = 0.0

    for p in prods:
        stock = max(0, int(p[3] if p[3] is not None else (p[4] or 0)))
        price = float(p[5] if p[5] is not None else (p[6] if p[6] is not None else (p[7] or 0.0)))
        item_val = stock * price
        total_val += item_val
        total_available += stock
        total_reserved += int(p[8] or 0)

        wh_name = (p[2] or "").strip()
        if wh_name and wh_name in wh_val_map:
            wh_val_map[wh_name] += item_val
        else:
            unassigned_val += item_val

    # If there are unassigned products, attribute them to default/first warehouse or "Main Store"
    if unassigned_val > 0:
        if wh_val_map:
            first_wh = next(iter(wh_val_map))
            wh_val_map[first_wh] += unassigned_val
        else:
            wh_val_map["Main Store / Warehouse"] = unassigned_val

    valuation_dict = {}
    for wname, wval in wh_val_map.items():
        pct = int(round((wval / total_val * 100))) if total_val > 0 else 0
        valuation_dict[wname] = {
            "value": f"₹{wval:,.2f}",
            "pct": pct
        }

    return {
        "available": total_available,
        "reserved": total_reserved,
        "damaged": 0,
        "transit": 0,
        "expired": 0,
        "valuation": valuation_dict
    }
