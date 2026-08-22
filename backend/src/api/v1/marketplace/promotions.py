"""
Marketplace Promotions & Loyalty Engine — fully database-backed.

All endpoints query and persist data via SQLAlchemy async models defined in
src/models/marketplace.py. Auto-seeding injects initial rows on first request.
"""

import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from src.database.session import get_db
from src.models.marketplace import (
    MarketplaceCoupon, MarketplaceFlashSale, MarketplaceLoyaltyTier,
    MarketplaceCampaign, MarketplaceWalletRule, MarketplaceGiftCardBatch, MarketplaceOffer
)

router = APIRouter(prefix="/promotions", tags=["Marketplace - Promotions & Loyalty Engine"])


# --- Pydantic Schemas ---
class CouponCreatePayload(BaseModel):
    code: str
    type: str  # Percentage or Fixed Amount
    discountValue: float
    minOrderValue: float
    maxUsage: int
    expiryDate: str


class FlashSaleCreatePayload(BaseModel):
    title: str
    discountPercentage: float
    startTime: str
    endTime: str
    itemsCount: int


from src.api.v1.marketplace.utils import get_or_create_tenant_id

def format_date_safe(val) -> str:
    if not val:
        return "2026-12-31"
    if hasattr(val, "strftime"):
        return val.strftime("%Y-%m-%d")
    return str(val).split("T")[0]

# --- Auto-Seeding Helpers ---
async def seed_coupons(db: AsyncSession):
    res = await db.execute(select(func.count(MarketplaceCoupon.id)))
    if (res.scalar() or 0) == 0:
        tenant_id = await get_or_create_tenant_id(db)
        db.add_all([
            MarketplaceCoupon(code="WELCOME20", type="Percentage", discount_value=20, min_order_value=50, usage_count=428, max_usage=1000, expiry_date="2026-12-31", status="Active", tenant_id=tenant_id),
            MarketplaceCoupon(code="FLASH50", type="Fixed Amount", discount_value=50, min_order_value=250, usage_count=195, max_usage=300, expiry_date="2026-08-31", status="Active", tenant_id=tenant_id),
            MarketplaceCoupon(code="SUMMER15", type="Percentage", discount_value=15, min_order_value=100, usage_count=500, max_usage=500, expiry_date="2026-07-31", status="Expired", tenant_id=tenant_id),
        ])
        await db.commit()


async def seed_flash_sales(db: AsyncSession):
    res = await db.execute(select(func.count(MarketplaceFlashSale.id)))
    if (res.scalar() or 0) == 0:
        tenant_id = await get_or_create_tenant_id(db)
        db.add_all([
            MarketplaceFlashSale(title="SuperTech Midnight Mega Flash Sale", discount_percentage=40, start_time="2026-08-15 00:00", end_time="2026-08-16 23:59", items_count=48, status="Live", tenant_id=tenant_id),
            MarketplaceFlashSale(title="Weekend Office & Electronics Bonanza", discount_percentage=35, start_time="2026-08-20 09:00", end_time="2026-08-22 23:59", items_count=120, status="Upcoming", tenant_id=tenant_id),
        ])
        await db.commit()


async def seed_loyalty_tiers(db: AsyncSession):
    res = await db.execute(select(func.count(MarketplaceLoyaltyTier.id)))
    if (res.scalar() or 0) == 0:
        tenant_id = await get_or_create_tenant_id(db)
        db.add_all([
            MarketplaceLoyaltyTier(tier_name="Bronze", min_spend=0, points_multiplier="1.0x", members_count=12400, perks="Standard Rewards & Free Ground Shipping > $100", tenant_id=tenant_id),
            MarketplaceLoyaltyTier(tier_name="Silver", min_spend=1000, points_multiplier="1.5x", members_count=3200, perks="Priority Support & Early Access to Flash Sales", tenant_id=tenant_id),
            MarketplaceLoyaltyTier(tier_name="Gold", min_spend=5000, points_multiplier="2.0x", members_count=850, perks="Dedicated Account Manager & 2% Extra Wallet Cashback", tenant_id=tenant_id),
            MarketplaceLoyaltyTier(tier_name="Platinum", min_spend=25000, points_multiplier="3.0x", members_count=120, perks="VIP Concierge, Custom Invoicing & Zero Payment Fees", tenant_id=tenant_id),
        ])
        await db.commit()


async def seed_campaigns(db: AsyncSession):
    res = await db.execute(select(func.count(MarketplaceCampaign.id)))
    if (res.scalar() or 0) == 0:
        tenant_id = await get_or_create_tenant_id(db)
        db.add_all([
            MarketplaceCampaign(title="Q3 B2B Tech Procurement Mega Campaign", channel="Email", reach_count=45000, click_through_rate=8.4, revenue_generated=124500, status="Live", tenant_id=tenant_id),
            MarketplaceCampaign(title="Social Media Sponsored Vendor Showcase", channel="Social Media Ad", reach_count=120000, click_through_rate=4.2, revenue_generated=68000, status="Live", tenant_id=tenant_id),
            MarketplaceCampaign(title="Push Alert: Flash Sale Countdown Blast", channel="Push Notification", reach_count=88000, click_through_rate=12.1, revenue_generated=48500, status="Completed", tenant_id=tenant_id),
        ])
        await db.commit()


async def seed_wallet_rules(db: AsyncSession):
    res = await db.execute(select(func.count(MarketplaceWalletRule.id)))
    if (res.scalar() or 0) == 0:
        tenant_id = await get_or_create_tenant_id(db)
        db.add_all([
            MarketplaceWalletRule(name="Standard 5% Store Wallet Cashback", cashback_percentage=5, min_order_value=100, max_cashback_per_order=25, total_cashback_disbursed=14850, status="Active", tenant_id=tenant_id),
            MarketplaceWalletRule(name="Premium Buyer 10% First Order Cashback", cashback_percentage=10, min_order_value=200, max_cashback_per_order=50, total_cashback_disbursed=4200, status="Active", tenant_id=tenant_id),
        ])
        await db.commit()


async def seed_gift_cards(db: AsyncSession):
    res = await db.execute(select(func.count(MarketplaceGiftCardBatch.id)))
    if (res.scalar() or 0) == 0:
        tenant_id = await get_or_create_tenant_id(db)
        db.add_all([
            MarketplaceGiftCardBatch(batch_name="Corporate B2B Buyer Welcome Vouchers", code_prefix="CORP2026", voucher_value=100, total_vouchers=500, redeemed_count=342, expiry_date="2026-12-31", tenant_id=tenant_id),
            MarketplaceGiftCardBatch(batch_name="Employee Incentive Gift Vouchers Q3", code_prefix="EMP2026Q3", voucher_value=50, total_vouchers=250, redeemed_count=78, expiry_date="2026-09-30", tenant_id=tenant_id),
        ])
        await db.commit()


async def seed_offers(db: AsyncSession):
    res = await db.execute(select(func.count(MarketplaceOffer.id)))
    if (res.scalar() or 0) == 0:
        tenant_id = await get_or_create_tenant_id(db)
        db.add_all([
            MarketplaceOffer(title="Buy 1 Monitor Get Heavy Duty Mount Free", type="Buy 1 Get 1 (BOGO)", discount_detail="Free Mount ($45 Value)", applicable_category="Electronics & Computing", status="Active", tenant_id=tenant_id),
            MarketplaceOffer(title="Vendor Co-Funded Office Furniture Sale", type="Vendor Co-Funded", discount_detail="Flat 25% Off (50/50 Split)", applicable_category="Office Furniture", status="Active", tenant_id=tenant_id),
            MarketplaceOffer(title="Industrial Tools Category Clearance", type="Category Discount", discount_detail="Flat 15% Off All SKUs", applicable_category="Industrial Hardware", status="Active", tenant_id=tenant_id),
        ])
        await db.commit()


# --- API Endpoints ---

@router.get("/coupons")
async def get_promotional_coupons(db: AsyncSession = Depends(get_db)):
    """Fetch all discount coupons from marketplace_coupons database table."""
    await seed_coupons(db)

    res = await db.execute(select(MarketplaceCoupon))
    coupons = res.scalars().all()

    return {
        "coupons": [
            {
                "id": str(c.id)[:8].upper(),
                "code": c.code,
                "type": c.type,
                "discountValue": float(c.discount_value),
                "minOrderValue": float(c.min_order_value),
                "usageCount": c.usage_count,
                "maxUsage": c.max_usage,
                "expiryDate": format_date_safe(c.expiry_date),
                "status": c.status,
            }
            for c in coupons
        ]
    }


@router.post("/coupons", status_code=201)
async def create_coupon(payload: CouponCreatePayload, db: AsyncSession = Depends(get_db)):
    """Persist a new discount coupon into the database."""
    tenant_id = await get_or_create_tenant_id(db)
    new_coupon = MarketplaceCoupon(
        code=payload.code.upper(),
        type=payload.type,
        discount_value=payload.discountValue,
        min_order_value=payload.minOrderValue,
        usage_count=0,
        max_usage=payload.maxUsage,
        expiry_date=payload.expiryDate,
        status="Active",
        tenant_id=tenant_id,
    )
    db.add(new_coupon)
    await db.commit()
    await db.refresh(new_coupon)

    return {
        "status": "success",
        "coupon": {
            "id": str(new_coupon.id)[:8].upper(),
            "code": new_coupon.code,
            "type": new_coupon.type,
            "discountValue": float(new_coupon.discount_value),
            "status": new_coupon.status,
        },
        "message": "Coupon persisted in database successfully."
    }


@router.get("/offers")
async def get_promotional_offers(db: AsyncSession = Depends(get_db)):
    """Fetch promotional offers and BOGO deals from marketplace_offers table."""
    await seed_offers(db)

    res = await db.execute(select(MarketplaceOffer))
    offers = res.scalars().all()

    return {
        "offers": [
            {
                "id": str(o.id)[:8].upper(),
                "title": o.title,
                "type": o.type,
                "discountDetail": o.discount_detail,
                "applicableCategory": o.applicable_category,
                "status": o.status,
            }
            for o in offers
        ]
    }


@router.get("/campaigns")
async def get_marketing_campaigns(db: AsyncSession = Depends(get_db)):
    """Fetch marketing campaign analytics from marketplace_campaigns table."""
    await seed_campaigns(db)

    res = await db.execute(select(MarketplaceCampaign))
    campaigns = res.scalars().all()

    return {
        "campaigns": [
            {
                "id": str(c.id)[:8].upper(),
                "title": c.title,
                "channel": c.channel,
                "reachCount": c.reach_count,
                "clickThroughRate": float(c.click_through_rate),
                "revenueGenerated": float(c.revenue_generated),
                "status": c.status,
            }
            for c in campaigns
        ]
    }


@router.get("/flash-sales")
async def get_flash_sales(db: AsyncSession = Depends(get_db)):
    """Fetch live and upcoming flash sales from marketplace_flash_sales table."""
    await seed_flash_sales(db)

    res = await db.execute(select(MarketplaceFlashSale))
    sales = res.scalars().all()

    return {
        "flashSales": [
            {
                "id": str(s.id)[:8].upper(),
                "title": s.title,
                "discountPercentage": float(s.discount_percentage),
                "startTime": format_date_safe(s.start_time),
                "endTime": format_date_safe(s.end_time),
                "itemsCount": s.items_count,
                "status": s.status,
            }
            for s in sales
        ]
    }


@router.post("/flash-sales", status_code=201)
async def create_flash_sale(payload: FlashSaleCreatePayload, db: AsyncSession = Depends(get_db)):
    """Persist a new flash sale event into the database."""
    tenant_id = await get_or_create_tenant_id(db)
    new_sale = MarketplaceFlashSale(
        title=payload.title,
        discount_percentage=payload.discountPercentage,
        start_time=payload.startTime,
        end_time=payload.endTime,
        items_count=payload.itemsCount,
        status="Upcoming",
        tenant_id=tenant_id,
    )
    db.add(new_sale)
    await db.commit()
    await db.refresh(new_sale)

    return {"status": "success", "flashSaleId": str(new_sale.id)[:8].upper(), "message": "Flash sale scheduled and persisted."}


@router.get("/wallet")
async def get_wallet_cashback_rules(db: AsyncSession = Depends(get_db)):
    """Fetch buyer cashback rules from marketplace_wallet_rules table."""
    await seed_wallet_rules(db)

    res = await db.execute(select(MarketplaceWalletRule))
    rules = res.scalars().all()

    return {
        "walletRules": [
            {
                "id": str(r.id)[:8].upper(),
                "name": r.name,
                "cashbackPercentage": float(r.cashback_percentage),
                "minOrderValue": float(r.min_order_value),
                "maxCashbackPerOrder": float(r.max_cashback_per_order),
                "totalCashbackDisbursed": float(r.total_cashback_disbursed),
                "status": r.status,
            }
            for r in rules
        ]
    }


@router.get("/loyalty")
async def get_loyalty_tiers(db: AsyncSession = Depends(get_db)):
    """Fetch VIP loyalty tiers from marketplace_loyalty_tiers table."""
    await seed_loyalty_tiers(db)

    res = await db.execute(select(MarketplaceLoyaltyTier))
    tiers = res.scalars().all()

    return {
        "tiers": [
            {
                "tierName": t.tier_name,
                "minSpend": float(t.min_spend),
                "pointsMultiplier": t.points_multiplier,
                "membersCount": t.members_count,
                "perks": t.perks,
            }
            for t in tiers
        ]
    }


@router.get("/gift-cards")
async def get_gift_cards(db: AsyncSession = Depends(get_db)):
    """Fetch digital gift card batches from marketplace_gift_card_batches table."""
    await seed_gift_cards(db)

    res = await db.execute(select(MarketplaceGiftCardBatch))
    batches = res.scalars().all()

    return {
        "batches": [
            {
                "id": str(b.id)[:8].upper(),
                "batchName": b.batch_name,
                "codePrefix": b.code_prefix,
                "voucherValue": float(b.voucher_value),
                "totalVouchers": b.total_vouchers,
                "redeemedCount": b.redeemed_count,
                "expiryDate": format_date_safe(b.expiry_date),
            }
            for b in batches
        ]
    }
