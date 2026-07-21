from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime

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


# ==========================================
# Inventory Operations Models
# ==========================================

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
