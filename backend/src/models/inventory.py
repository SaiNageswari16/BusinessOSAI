from __future__ import annotations
import uuid
from sqlalchemy import Boolean, Column, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB, UUID
from datetime import datetime, date

from src.database.base import Base, TenantScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin
from src.models import EntityStatus

class ProductCategory(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_product_categories"
    
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    category_code: Mapped[str | None] = mapped_column(String(50), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    parent_id = mapped_column(ForeignKey("erp_product_categories.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_type=False),
        default=EntityStatus.ACTIVE,
    )
    
    products: Mapped[list["Product"]] = relationship(back_populates="category")


class Brand(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_brands"
    
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    manufacturer: Mapped[str | None] = mapped_column(String(150))
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_type=False),
        default=EntityStatus.ACTIVE,
    )

    products: Mapped[list["Product"]] = relationship(back_populates="brand")


class UnitOfMeasure(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_uoms"
    
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    abbreviation: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_type=False),
        default=EntityStatus.ACTIVE,
    )

    products: Mapped[list["Product"]] = relationship(back_populates="uom")


class Product(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_products"
    
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sku: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    barcode: Mapped[str | None] = mapped_column(String(100), index=True)
    
    category_id = mapped_column(ForeignKey("erp_product_categories.id", ondelete="SET NULL"), nullable=True)
    brand_id = mapped_column(ForeignKey("erp_brands.id", ondelete="SET NULL"), nullable=True)
    uom_id = mapped_column(ForeignKey("erp_uoms.id", ondelete="SET NULL"), nullable=True)
    
    short_description: Mapped[str | None] = mapped_column(Text)
    long_description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(1024))
    
    purchase_price: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    mrp: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    selling_price: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    tax_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    discount_limit: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    
    initial_stock: Mapped[int] = mapped_column(Integer, default=0)
    reorder_level: Mapped[int] = mapped_column(Integer, default=0)
    safety_stock: Mapped[int] = mapped_column(Integer, default=0)
    
    supplier: Mapped[str | None] = mapped_column(String(150))
    warehouse: Mapped[str | None] = mapped_column(String(150))
    
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_type=False),
        default=EntityStatus.ACTIVE,
    )
    
    category: Mapped["ProductCategory"] = relationship(back_populates="products")
    brand: Mapped["Brand"] = relationship(back_populates="products")
    uom: Mapped["UnitOfMeasure"] = relationship(back_populates="products")
    
    images: Mapped[list["ProductImage"]] = relationship(back_populates="product", cascade="all, delete-orphan")
    variants: Mapped[list["ProductVariant"]] = relationship(back_populates="product", cascade="all, delete-orphan")

class ProductAttribute(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_product_attributes"
    
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    module: Mapped[str] = mapped_column(String(100), nullable=False)
    options: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)


class ProductVariant(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_product_variants"
    
    product_id = mapped_column(ForeignKey("erp_products.id", ondelete="CASCADE"), nullable=False)
    variant_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sku: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    barcode: Mapped[str | None] = mapped_column(String(100), index=True)
    
    attributes: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    
    additional_price: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    stock_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    product: Mapped["Product"] = relationship(back_populates="variants")


class ProductBundle(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_product_bundles"
    
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sku: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    price: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    
    items: Mapped[list["ProductBundleItem"]] = relationship(back_populates="bundle", cascade="all, delete-orphan")


class ProductBundleItem(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_product_bundle_items"
    
    bundle_id = mapped_column(ForeignKey("erp_product_bundles.id", ondelete="CASCADE"), nullable=False)
    product_id = mapped_column(ForeignKey("erp_products.id", ondelete="RESTRICT"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    
    bundle: Mapped["ProductBundle"] = relationship(back_populates="items")


class ProductKit(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_product_kits"
    
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sku: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    kit_type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    
    items: Mapped[list["ProductKitItem"]] = relationship(back_populates="kit", cascade="all, delete-orphan")


class ProductKitItem(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_product_kit_items"
    
    kit_id = mapped_column(ForeignKey("erp_product_kits.id", ondelete="CASCADE"), nullable=False)
    component_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    
    kit: Mapped["ProductKit"] = relationship(back_populates="items")


class ProductImage(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_product_images"
    
    product_id = mapped_column(ForeignKey("erp_products.id", ondelete="CASCADE"), nullable=False)
    image_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    
    product: Mapped["Product"] = relationship(back_populates="images")


# ==========================================
# Warehouse Management Models
# ==========================================

class Warehouse(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_warehouses"
    
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    warehouse_type: Mapped[str] = mapped_column(String(50), default="Distribution Center")
    capacity: Mapped[str | None] = mapped_column(String(100))
    manager_name: Mapped[str | None] = mapped_column(String(100))
    employees: Mapped[int] = mapped_column(Integer, default=0)
    temperature_control: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(50), default="Active")
    
    locations: Mapped[list["StorageLocation"]] = relationship(back_populates="warehouse", cascade="all, delete-orphan")


class StorageLocation(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_storage_locations"
    
    warehouse_id = mapped_column(ForeignKey("erp_warehouses.id", ondelete="CASCADE"), nullable=False)
    zone: Mapped[str | None] = mapped_column(String(50))
    aisle: Mapped[str | None] = mapped_column(String(50))
    rack: Mapped[str | None] = mapped_column(String(50))
    shelf: Mapped[str | None] = mapped_column(String(50))
    bin: Mapped[str | None] = mapped_column(String(50))
    barcode: Mapped[str | None] = mapped_column(String(100), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(50), default="Available")
    
    warehouse: Mapped["Warehouse"] = relationship(back_populates="locations")


class PutAwayRule(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Rule that decides where incoming stock is placed inside a warehouse.

    Conditions and special requirements are stored as JSONB arrays so the
    schema can evolve without further migrations.
    """
    __tablename__ = "erp_put_away_rules"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    destination_zone: Mapped[str | None] = mapped_column(String(100))
    destination_rack: Mapped[str | None] = mapped_column(String(100))
    bin_assignment: Mapped[str] = mapped_column(String(50), default="first_available")
    stacking_limit: Mapped[int] = mapped_column(Integer, default=5)
    special_requirements: Mapped[list] = mapped_column(JSONB, default=list)
    conditions: Mapped[list] = mapped_column(JSONB, default=list)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class PickingRule(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Rule that decides how orders are picked from inventory.

    `zone_priority` is an ordered list of zone names.
    """
    __tablename__ = "erp_picking_rules"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    strategy: Mapped[str] = mapped_column(String(50), default="discrete")
    order_rule: Mapped[str] = mapped_column(String(50), default="by_aging")
    batch_size: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    zone_priority: Mapped[list] = mapped_column(JSONB, default=list)
    exclude_hazmat: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_partial: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_release: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class InventoryBatch(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Inventory batch / lot number — the unit of traceability for perishable
    or regulated goods. A batch groups serials and stock movements together.
    """
    __tablename__ = "erp_inventory_batches"
    __table_args__ = (
        # One batch number per tenant
    )

    batch_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("erp_products.id", ondelete="SET NULL"), nullable=True
    )
    product_name: Mapped[str | None] = mapped_column(String(255))
    sku: Mapped[str | None] = mapped_column(String(100), index=True)
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("erp_warehouses.id", ondelete="SET NULL"), nullable=True
    )
    warehouse_name: Mapped[str | None] = mapped_column(String(150))
    supplier: Mapped[str | None] = mapped_column(String(255))
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    remaining_quantity: Mapped[int] = mapped_column(Integer, default=0)
    manufacturing_date: Mapped[date | None] = mapped_column(Date)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="Active")  # Active | Quarantined | Expired | Consumed

    product: Mapped["Product | None"] = relationship()
    warehouse: Mapped["Warehouse | None"] = relationship()
    events: Mapped[list["TraceabilityEvent"]] = relationship(
        back_populates="batch", cascade="all, delete-orphan"
    )


class InventorySerial(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Individual serial number for high-value / warranty-tracked units."""
    __tablename__ = "erp_inventory_serials"

    serial_number: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    batch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("erp_inventory_batches.id", ondelete="SET NULL"), nullable=True
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("erp_products.id", ondelete="SET NULL"), nullable=True
    )
    product_name: Mapped[str | None] = mapped_column(String(255))
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("erp_warehouses.id", ondelete="SET NULL"), nullable=True
    )
    warehouse_name: Mapped[str | None] = mapped_column(String(150))
    manufacturing_date: Mapped[date | None] = mapped_column(Date)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="In Stock")
    # In Stock | Reserved | Sold | In Transit | Returned | Damaged | Written-off

    batch: Mapped["InventoryBatch | None"] = relationship()
    product: Mapped["Product | None"] = relationship()
    warehouse: Mapped["Warehouse | None"] = relationship()


class TraceabilityEvent(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Immutable event log: every movement and lifecycle change for a batch
    or serial. Forms the genealogy chain for forward + backward traceability.
    """
    __tablename__ = "erp_traceability_events"

    event_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    # received | produced | packed | shipped | delivered | returned | recalled |
    # quarantined | released | consumed | adjusted | transferred

    batch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("erp_inventory_batches.id", ondelete="CASCADE"), nullable=True, index=True
    )
    serial_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("erp_inventory_serials.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Locations involved (free text + warehouse FK where known)
    source_location: Mapped[str | None] = mapped_column(String(255))
    destination_location: Mapped[str | None] = mapped_column(String(255))
    source_warehouse_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("erp_warehouses.id", ondelete="SET NULL"), nullable=True
    )
    destination_warehouse_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("erp_warehouses.id", ondelete="SET NULL"), nullable=True
    )

    # Counterparty in the event (supplier, customer, carrier, etc.)
    party_type: Mapped[str | None] = mapped_column(String(50))  # supplier|customer|carrier|internal
    party_name: Mapped[str | None] = mapped_column(String(255))
    reference_document: Mapped[str | None] = mapped_column(String(150))  # GRN, PO, SO, Invoice #

    quantity: Mapped[int | None] = mapped_column(Integer)
    unit: Mapped[str | None] = mapped_column(String(30))
    notes: Mapped[str | None] = mapped_column(Text)
    event_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    batch: Mapped["InventoryBatch | None"] = relationship(back_populates="events")

class GoodsReceipt(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_goods_receipts"
    
    receipt_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    supplier: Mapped[str | None] = mapped_column(String(255))
    reference_number: Mapped[str | None] = mapped_column(String(100)) # PO number or invoice
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="Completed")
    
    items: Mapped[list["GoodsReceiptItem"]] = relationship(back_populates="receipt", cascade="all, delete-orphan")


class GoodsReceiptItem(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_goods_receipt_items"
    
    receipt_id = mapped_column(ForeignKey("erp_goods_receipts.id", ondelete="CASCADE"), nullable=False)
    product_id = mapped_column(ForeignKey("erp_products.id", ondelete="RESTRICT"), nullable=False)
    quantity_received: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    
    receipt: Mapped["GoodsReceipt"] = relationship(back_populates="items")


class GoodsIssue(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_goods_issues"
    
    issue_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    recipient: Mapped[str | None] = mapped_column(String(255))
    reference_number: Mapped[str | None] = mapped_column(String(100)) # SO number
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="Completed")
    
    items: Mapped[list["GoodsIssueItem"]] = relationship(back_populates="issue", cascade="all, delete-orphan")


class GoodsIssueItem(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_goods_issue_items"
    
    issue_id = mapped_column(ForeignKey("erp_goods_issues.id", ondelete="CASCADE"), nullable=False)
    product_id = mapped_column(ForeignKey("erp_products.id", ondelete="RESTRICT"), nullable=False)
    quantity_issued: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    
    issue: Mapped["GoodsIssue"] = relationship(back_populates="items")


class StockMovement(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_stock_movements"
    
    movement_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    product_id = mapped_column(ForeignKey("erp_products.id", ondelete="RESTRICT"), nullable=False)
    source_location: Mapped[str] = mapped_column(String(150), nullable=False)
    destination_location: Mapped[str] = mapped_column(String(150), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="Completed")


class StockAdjustment(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_stock_adjustments"
    
    adjustment_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    product_id = mapped_column(ForeignKey("erp_products.id", ondelete="RESTRICT"), nullable=False)
    adjustment_type: Mapped[str] = mapped_column(String(50), nullable=False) # e.g. "Write-Off", "Found"
    quantity_changed: Mapped[int] = mapped_column(Integer, nullable=False) # positive or negative
    reason: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="Completed")


class CycleCount(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_cycle_counts"
    
    count_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    location: Mapped[str | None] = mapped_column(String(150))
    auditor: Mapped[str | None] = mapped_column(String(150))
    status: Mapped[str] = mapped_column(String(50), default="In Progress")
    notes: Mapped[str | None] = mapped_column(Text)
    
    items: Mapped[list["CycleCountItem"]] = relationship(back_populates="cycle_count", cascade="all, delete-orphan")


class CycleCountItem(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_cycle_count_items"
    
    cycle_count_id = mapped_column(ForeignKey("erp_cycle_counts.id", ondelete="CASCADE"), nullable=False)
    product_id = mapped_column(ForeignKey("erp_products.id", ondelete="RESTRICT"), nullable=False)
    system_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    counted_quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    variance: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    cycle_count: Mapped["CycleCount"] = relationship(back_populates="items")


class MasterCatalogProduct(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "erp_master_catalog"
    
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    brand: Mapped[str | None] = mapped_column(String(150), index=True)
    barcode: Mapped[str | None] = mapped_column(String(100), index=True)
    sku_code: Mapped[str | None] = mapped_column(String(100), index=True)
    product_code: Mapped[str | None] = mapped_column(String(100), index=True)
    hsn_code: Mapped[str | None] = mapped_column(String(100), index=True)
    plu_no: Mapped[str | None] = mapped_column(String(100), index=True)
    
    cost_price: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    mrp: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    sale_price: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    wholesale_price: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    special_price: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    online_price: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    
    weight: Mapped[str | None] = mapped_column(String(100))
    quantity: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    expired_quantity: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    near_expiry_quantity: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    
    tax: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    type: Mapped[str | None] = mapped_column(String(100))
    cess: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    cess_on: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    cess_type: Mapped[str | None] = mapped_column(String(100))
    tax_amount: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    taxable_value: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    cess_tax_amount: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    additional_cess_tax_amount: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    
    supplier: Mapped[str | None] = mapped_column(String(255))
    discount_rs: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    discount_percent: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    actual_margin_rs: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    margin_on_cp: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    margin_on_sp: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)
    category: Mapped[str | None] = mapped_column(String(150), index=True)
    sub_category: Mapped[str | None] = mapped_column(String(150))
    instock_value: Mapped[float | None] = mapped_column(Numeric(15, 4), default=0.0)

    # UI / AI fields
    image_url: Mapped[str | None] = mapped_column(String(1024))
    short_description: Mapped[str | None] = mapped_column(Text)
    specifications: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(50), default="EXCEL_IMPORT")

    # Automated RAG enricher tracking columns
    ai_search_done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    rag_status: Mapped[str | None] = mapped_column(String(50), default="pending", index=True)
    rag_enriched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rag_error: Mapped[str | None] = mapped_column(Text, nullable=True)



class ProductQRCode(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_product_qr_codes"

    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("erp_products.id", ondelete="CASCADE"), nullable=True, index=True
    )
    qr_data: Mapped[str] = mapped_column(String, nullable=False)
    qr_type: Mapped[str] = mapped_column(String(50), default="product")  # product | batch | serial | location
    format: Mapped[str | None] = mapped_column(String(20))  # EAN-13 | QR | Code-128 | GS1-128
    version: Mapped[str | None] = mapped_column(String(20))
    error_correction: Mapped[str | None] = mapped_column(String(10), default="M")
    print_count: Mapped[int] = mapped_column(Integer, default=0)
    last_printed_at: Mapped[datetime | None] = mapped_column(DateTime)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text)


class ProductRFID(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_product_rfids"

    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("erp_products.id", ondelete="CASCADE"), nullable=True, index=True
    )
    tag_uid: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    tag_type: Mapped[str | None] = mapped_column(String(50))  # passive | active | semi-passive
    frequency: Mapped[str | None] = mapped_column(String(20))  # LF 125kHz | HF 13.56MHz | UHF 860-960MHz
    protocol: Mapped[str | None] = mapped_column(String(30))  # ISO 15693 | EPC Gen2 | etc.
    memory_bits: Mapped[int | None] = mapped_column(Integer)
    write_count: Mapped[int] = mapped_column(Integer, default=0)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_seen_location: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(50), default="active")  # active | deactivated | lost
    notes: Mapped[str | None] = mapped_column(Text)

