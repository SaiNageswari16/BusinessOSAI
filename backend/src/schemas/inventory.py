import uuid
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

# --- Enums from models ---
from src.models import EntityStatus

# ==========================================
# Base Schemas (Shared Properties)
# ==========================================

class TimestampSchema(BaseModel):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ProductCategoryBase(BaseModel):
    name: str = Field(..., max_length=150)
    category_code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    status: Optional[str] = "active"


class BrandBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    manufacturer: Optional[str] = Field(None, max_length=150)
    status: Optional[str] = "active"


class UnitOfMeasureBase(BaseModel):
    name: str = Field(..., max_length=50)
    abbreviation: str = Field(..., max_length=20)
    description: Optional[str] = None
    status: Optional[str] = "active"


class ProductBase(BaseModel):
    name: str = Field(..., max_length=255)
    sku: str = Field(..., max_length=100)
    barcode: Optional[str] = Field(None, max_length=100)
    
    category_id: Optional[uuid.UUID] = None
    brand_id: Optional[uuid.UUID] = None
    uom_id: Optional[uuid.UUID] = None
    
    short_description: Optional[str] = None
    long_description: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=1024)
    
    purchase_price: Optional[float] = 0.0
    mrp: Optional[float] = 0.0
    selling_price: Optional[float] = 0.0
    tax_percent: Optional[float] = 0.0
    discount_limit: Optional[float] = 0.0
    
    initial_stock: Optional[int] = 0
    reorder_level: Optional[int] = 0
    safety_stock: Optional[int] = 0
    
    supplier: Optional[str] = Field(None, max_length=150)
    warehouse: Optional[str] = Field(None, max_length=150)
    
    status: Optional[str] = "active"


# ==========================================
# Create & Update Schemas
# ==========================================

class ProductCategoryCreate(ProductCategoryBase):
    pass

class ProductCategoryUpdate(ProductCategoryBase):
    name: Optional[str] = Field(None, max_length=150)
    category_code: Optional[str] = Field(None, max_length=50)

class ProductCategoryBulkCreate(BaseModel):
    categories: List[ProductCategoryCreate]

class ProductCategoryBulkResponse(BaseModel):
    created_count: int
    skipped_count: int
    errors: List[str]


class BrandCreate(BrandBase):
    pass

class BrandUpdate(BrandBase):
    name: Optional[str] = Field(None, max_length=100)


class UnitOfMeasureCreate(UnitOfMeasureBase):
    pass

class UnitOfMeasureUpdate(UnitOfMeasureBase):
    name: Optional[str] = Field(None, max_length=50)
    abbreviation: Optional[str] = Field(None, max_length=20)


class ProductCreate(ProductBase):
    pass

class ProductUpdate(ProductBase):
    name: Optional[str] = Field(None, max_length=255)
    sku: Optional[str] = Field(None, max_length=100)


# ==========================================
# Response Schemas
# ==========================================

class ProductCategoryResponse(ProductCategoryBase, TimestampSchema):
    id: uuid.UUID
    tenant_id: uuid.UUID

    class Config:
        from_attributes = True


class BrandResponse(BrandBase, TimestampSchema):
    id: uuid.UUID
    tenant_id: uuid.UUID

    class Config:
        from_attributes = True


class UnitOfMeasureResponse(UnitOfMeasureBase, TimestampSchema):
    id: uuid.UUID
    tenant_id: uuid.UUID

    class Config:
        from_attributes = True


class ProductResponse(ProductBase, TimestampSchema):
    id: uuid.UUID
    tenant_id: uuid.UUID
    
    # Enrichment fields
    category_name: Optional[str] = None
    brand_name: Optional[str] = None
    uom_name: Optional[str] = None

    class Config:
        from_attributes = True

# ==========================================
# Master Import Schemas
# ==========================================

class MasterProductImportItem(ProductBase):
    brand_name: Optional[str] = None
    category_name: Optional[str] = None
    sub_category_name: Optional[str] = None
    uom_name: Optional[str] = None

class MasterProductBulkCreate(BaseModel):
    items: List[MasterProductImportItem]

class MasterProductBulkResponse(BaseModel):
    products_created: int
    brands_created: int
    categories_created: int
    uoms_created: int
    skipped_count: int
    errors: List[str]

# ==========================================
# New Product Master Feature Schemas
# ==========================================

# -- Attributes --
class ProductAttributeBase(BaseModel):
    name: str = Field(..., max_length=100)
    module: str = Field(..., max_length=100)
    options: List[str] = Field(default_factory=list)

class ProductAttributeCreate(ProductAttributeBase):
    pass

class ProductAttributeUpdate(ProductAttributeBase):
    name: Optional[str] = Field(None, max_length=100)
    module: Optional[str] = Field(None, max_length=100)
    options: Optional[List[str]] = None

class ProductAttributeResponse(ProductAttributeBase, TimestampSchema):
    id: uuid.UUID
    tenant_id: uuid.UUID
    class Config:
        from_attributes = True

# -- Variants --
class ProductVariantBase(BaseModel):
    product_id: uuid.UUID
    variant_name: str = Field(..., max_length=255)
    sku: str = Field(..., max_length=100)
    barcode: Optional[str] = Field(None, max_length=100)
    attributes: dict = Field(default_factory=dict)
    additional_price: Optional[float] = 0.0
    stock_override: Optional[int] = None

class ProductVariantCreate(ProductVariantBase):
    pass

class ProductVariantUpdate(ProductVariantBase):
    product_id: Optional[uuid.UUID] = None
    variant_name: Optional[str] = Field(None, max_length=255)
    sku: Optional[str] = Field(None, max_length=100)
    
class ProductVariantResponse(ProductVariantBase, TimestampSchema):
    id: uuid.UUID
    tenant_id: uuid.UUID
    class Config:
        from_attributes = True

# -- Bundles --
class ProductBundleItemBase(BaseModel):
    product_id: uuid.UUID
    quantity: int = 1

class ProductBundleItemCreate(ProductBundleItemBase):
    pass

class ProductBundleItemResponse(ProductBundleItemBase, TimestampSchema):
    id: uuid.UUID
    bundle_id: uuid.UUID
    class Config:
        from_attributes = True

class ProductBundleBase(BaseModel):
    name: str = Field(..., max_length=255)
    sku: str = Field(..., max_length=100)
    description: Optional[str] = None
    price: Optional[float] = 0.0

class ProductBundleCreate(ProductBundleBase):
    items: List[ProductBundleItemCreate]

class ProductBundleUpdate(ProductBundleBase):
    name: Optional[str] = Field(None, max_length=255)
    sku: Optional[str] = Field(None, max_length=100)
    items: Optional[List[ProductBundleItemCreate]] = None

class ProductBundleResponse(ProductBundleBase, TimestampSchema):
    id: uuid.UUID
    tenant_id: uuid.UUID
    items: List[ProductBundleItemResponse] = []
    class Config:
        from_attributes = True

# -- Kits --
class ProductKitItemBase(BaseModel):
    component_name: str = Field(..., max_length=255)
    quantity: int = 1

class ProductKitItemCreate(ProductKitItemBase):
    pass

class ProductKitItemResponse(ProductKitItemBase, TimestampSchema):
    id: uuid.UUID
    kit_id: uuid.UUID
    class Config:
        from_attributes = True

class ProductKitBase(BaseModel):
    name: str = Field(..., max_length=255)
    sku: str = Field(..., max_length=100)
    kit_type: str = Field(..., max_length=50)
    description: Optional[str] = None

class ProductKitCreate(ProductKitBase):
    items: List[ProductKitItemCreate]

class ProductKitUpdate(ProductKitBase):
    name: Optional[str] = Field(None, max_length=255)
    sku: Optional[str] = Field(None, max_length=100)
    kit_type: Optional[str] = Field(None, max_length=50)
    items: Optional[List[ProductKitItemCreate]] = None

class ProductKitResponse(ProductKitBase, TimestampSchema):
    id: uuid.UUID
    tenant_id: uuid.UUID
    items: List[ProductKitItemResponse] = []
    class Config:
        from_attributes = True

# -- Images --
class ProductImageBase(BaseModel):
    product_id: uuid.UUID
    image_url: str = Field(..., max_length=1024)
    is_primary: Optional[bool] = False
    display_order: Optional[int] = 0

class ProductImageCreate(ProductImageBase):
    pass

class ProductImageUpdate(ProductImageBase):
    product_id: Optional[uuid.UUID] = None
    image_url: Optional[str] = Field(None, max_length=1024)

class ProductImageResponse(ProductImageBase, TimestampSchema):
    id: uuid.UUID
    tenant_id: uuid.UUID
    class Config:
        from_attributes = True
