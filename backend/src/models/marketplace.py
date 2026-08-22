"""
Marketplace-specific database models.

These tables extend the ERP models specifically for the B2B marketplace layer.

Column default policy:
  - KEEP defaults on: status strings, boolean flags, zero-init counters (usage_count,
    redeemed_count, impression_count, progress, current_orders_count, total_stops).
  - NO defaults on: any numeric business value (rates, prices, percentages, amounts,
    thresholds, multipliers). All such values MUST be explicitly supplied by the seed
    function or the API request payload.
"""

import uuid
from datetime import datetime
from sqlalchemy import Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB

from src.database.base import Base, TenantScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin


# ─── Promotions & Loyalty ─────────────────────────────────────────────────────

class MarketplaceCoupon(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "marketplace_coupons"

    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(50), default="Percentage")      # Percentage | Fixed Amount
    discount_value: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    min_order_value: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)             # counter — OK to default
    max_usage: Mapped[int] = mapped_column(Integer, nullable=False)
    expiry_date: Mapped[datetime | None] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(50), default="Active")        # Active | Expired | Scheduled


class MarketplaceFlashSale(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "marketplace_flash_sales"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    discount_percentage: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    start_time: Mapped[str] = mapped_column(String(50), nullable=False)
    end_time: Mapped[str] = mapped_column(String(50), nullable=False)
    items_count: Mapped[int] = mapped_column(Integer, default=0)             # counter — OK to default
    status: Mapped[str] = mapped_column(String(50), default="Upcoming")      # Live | Upcoming | Ended


class MarketplaceLoyaltyTier(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "marketplace_loyalty_tiers"

    tier_name: Mapped[str] = mapped_column(String(50), nullable=False)       # Bronze | Silver | Gold | Platinum
    min_spend: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    points_multiplier: Mapped[str] = mapped_column(String(10), nullable=False)
    members_count: Mapped[int] = mapped_column(Integer, default=0)           # counter — OK to default
    perks: Mapped[str] = mapped_column(Text, nullable=False)


class MarketplaceCampaign(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "marketplace_campaigns"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    channel: Mapped[str] = mapped_column(String(100), nullable=False)        # Email | Push Notification | Social Media Ad
    reach_count: Mapped[int] = mapped_column(Integer, default=0)             # counter — OK to default
    click_through_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    revenue_generated: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Draft")         # Live | Completed | Draft


class MarketplaceWalletRule(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "marketplace_wallet_rules"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    cashback_percentage: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    min_order_value: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    max_cashback_per_order: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    total_cashback_disbursed: Mapped[float] = mapped_column(Numeric(15, 2), default=0.0)  # running total — OK to default 0
    status: Mapped[str] = mapped_column(String(50), default="Active")        # Active | Inactive


class MarketplaceGiftCardBatch(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "marketplace_gift_card_batches"

    batch_name: Mapped[str] = mapped_column(String(255), nullable=False)
    code_prefix: Mapped[str] = mapped_column(String(50), nullable=False)
    voucher_value: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    total_vouchers: Mapped[int] = mapped_column(Integer, nullable=False)
    redeemed_count: Mapped[int] = mapped_column(Integer, default=0)          # counter — OK to default
    expiry_date: Mapped[str | None] = mapped_column(String(50))


class MarketplaceOffer(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "marketplace_offers"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(100), nullable=False)           # Buy 1 Get 1 | Category Discount | Vendor Co-Funded
    discount_detail: Mapped[str] = mapped_column(String(255), nullable=False)
    applicable_category: Mapped[str] = mapped_column(String(150), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Active")        # Active | Scheduled


# ─── Vendor ───────────────────────────────────────────────────────────────────

class MarketplaceVendorPayout(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "marketplace_vendor_payouts"

    vendor_name: Mapped[str] = mapped_column(String(150), nullable=False)
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    method: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Pending Approval")  # Pending Approval | Processed | In Transit


class MarketplaceVendorReview(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "marketplace_vendor_reviews"

    vendor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    vendor_name: Mapped[str] = mapped_column(String(150), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(150), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Pending")       # Approved | Flagged | Pending


# ─── Products & Catalog ───────────────────────────────────────────────────────

class MarketplaceService(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "marketplace_services"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_name: Mapped[str] = mapped_column(String(150), nullable=False)
    pricing_type: Mapped[str] = mapped_column(String(50), nullable=False)    # Project Rate | Hourly Rate | Monthly Retainer
    rate: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="Active")        # Active | Inactive | Suspended


class MarketplaceProductApproval(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "marketplace_product_approvals"

    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sku: Mapped[str] = mapped_column(String(100), nullable=False)
    vendor_name: Mapped[str] = mapped_column(String(150), nullable=False)
    compliance_score: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Pending Review") # Pending Review | Approved | Rejected


class MarketplacePricingRule(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "marketplace_pricing_rules"

    rule_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(150), nullable=False)
    min_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    max_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    markup_percentage: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Active")        # Active | Inactive


class MarketplaceFeaturedSlot(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "marketplace_featured_slots"

    product_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    product_title: Mapped[str] = mapped_column(String(255), nullable=False)
    vendor_name: Mapped[str] = mapped_column(String(150), nullable=False)
    slot_name: Mapped[str] = mapped_column(String(100), nullable=False)
    impression_count: Mapped[int] = mapped_column(Integer, default=0)        # counter — OK to default
    status: Mapped[str] = mapped_column(String(50), default="Live Slot")     # Live Slot | Scheduled | Expired


# ─── Orders & Fulfillment ─────────────────────────────────────────────────────

class MarketplaceOrderRefund(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "marketplace_order_refunds"

    order_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    customer_name: Mapped[str] = mapped_column(String(150), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    gateway_ref: Mapped[str | None] = mapped_column(String(150))
    method: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Pending")       # Pending | Processed | Failed
    return_id: Mapped[str | None] = mapped_column(String(100))


class MarketplaceOrderCancellation(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "marketplace_order_cancellations"

    order_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    customer_name: Mapped[str] = mapped_column(String(150), nullable=False)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    restocked_status: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Cancelled")


class MarketplaceOrderTimeline(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "marketplace_order_timelines"

    order_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    step: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    event_time: Mapped[str] = mapped_column(String(100), default="Pending")  # sentinel — OK to default
    status: Mapped[str] = mapped_column(String(50), default="Pending")       # Completed | In-Progress | Pending


class MarketplaceOrderTracking(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "marketplace_order_tracking"

    order_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    tracking_number: Mapped[str] = mapped_column(String(100), nullable=False)
    carrier: Mapped[str] = mapped_column(String(100), nullable=False)
    estimated_delivery: Mapped[str | None] = mapped_column(String(100))
    current_location: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(50), default="In Transit")


# ─── Delivery & Logistics ─────────────────────────────────────────────────────

class MarketplaceDeliveryPartner(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "marketplace_delivery_partners"

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    active_fleet: Mapped[int] = mapped_column(Integer, default=0)            # counter — OK to default
    sla_delivery_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Active Integration")


class MarketplaceDeliveryDriver(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "marketplace_delivery_drivers"

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    vehicle_type: Mapped[str] = mapped_column(String(100), nullable=False)
    license_number: Mapped[str] = mapped_column(String(50), nullable=False)
    duty_status: Mapped[str] = mapped_column(String(50), default="Available") # On Duty | Available | Off Duty
    current_orders_count: Mapped[int] = mapped_column(Integer, default=0)    # counter — OK to default
    rating: Mapped[float] = mapped_column(Numeric(3, 1), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30))


class MarketplaceDispatchQueue(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "marketplace_dispatch_queue"

    order_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    pickup_address: Mapped[str] = mapped_column(String(500), nullable=False)
    delivery_address: Mapped[str] = mapped_column(String(500), nullable=False)
    suggested_driver: Mapped[str | None] = mapped_column(String(150))
    assigned_driver: Mapped[str | None] = mapped_column(String(150))
    status: Mapped[str] = mapped_column(String(50), default="Unassigned")    # Unassigned | Assigned | In-Transit | Delivered


class MarketplaceLiveDelivery(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "marketplace_live_deliveries"

    order_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    driver_name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30))
    vehicle_type: Mapped[str] = mapped_column(String(100), nullable=False)
    courier_partner: Mapped[str] = mapped_column(String(100), nullable=False)
    destination: Mapped[str] = mapped_column(String(500), nullable=False)
    current_location: Mapped[str] = mapped_column(String(500), nullable=False)
    eta: Mapped[str] = mapped_column(String(50), default="Pending")          # sentinel — OK to default
    progress: Mapped[int] = mapped_column(Integer, default=0)                # 0-100 counter — OK to default
    status: Mapped[str] = mapped_column(String(50), default="In Transit")    # In Transit | Out for Delivery | Delayed | Delivered
    map_pos: Mapped[dict | None] = mapped_column(JSONB)


class MarketplaceHyperlocalZone(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "marketplace_hyperlocal_zones"

    zone_name: Mapped[str] = mapped_column(String(255), nullable=False)
    max_radius_km: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    guaranteed_delivery_time: Mapped[str] = mapped_column(String(50), nullable=False)
    dispatch_hubs_count: Mapped[int] = mapped_column(Integer, default=0)     # counter — OK to default
    express_surcharge: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Active Zone")


class MarketplaceShippingRule(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "marketplace_shipping_rules"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    zone: Mapped[str] = mapped_column(String(150), nullable=False)
    weight_min_kg: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    weight_max_kg: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    base_rate: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    per_kg_rate: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    free_shipping_min_order: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Active")


class MarketplaceDeliveryRoute(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "marketplace_delivery_routes"

    route_name: Mapped[str] = mapped_column(String(255), nullable=False)
    assigned_driver: Mapped[str] = mapped_column(String(150), nullable=False)
    vehicle: Mapped[str] = mapped_column(String(100), nullable=False)
    total_stops: Mapped[int] = mapped_column(Integer, default=0)             # counter — OK to default
    total_distance_km: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    estimated_time_hrs: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    stops: Mapped[list | None] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(50), default="Active")
