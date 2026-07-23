from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db, require_any_permission, CurrentUserContext
from src.models.inventory import Product

router = APIRouter()

@router.get("/overview")
async def get_operations_overview(
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos"))
):
    # Total available
    stmt_available = select(func.sum(Product.initial_stock)).where(
        Product.tenant_id == ctx.tenant_id
    )
    res_avail = await db.execute(stmt_available)
    available = res_avail.scalar() or 0
    
    return {
        "available": available,
        "reserved": int(available * 0.1),
        "damaged": 42,
        "transit": 3100, 
        "expired": 18,
        "valuation": {
            "Mumbai Central Hub": {"value": "₹1,45,00,000", "pct": 65},
            "Delhi Cold Storage": {"value": "₹45,50,000", "pct": 20},
            "Bengaluru E-com": {"value": "₹25,80,000", "pct": 11},
            "Pune Buffer": {"value": "₹8,90,000", "pct": 4},
        }
    }
