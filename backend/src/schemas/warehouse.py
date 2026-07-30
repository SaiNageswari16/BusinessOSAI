from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, date
from src.schemas.inventory import TimestampSchema

class StorageLocationBase(BaseModel):
    zone: Optional[str] = None
    aisle: Optional[str] = None
    rack: Optional[str] = None
    shelf: Optional[str] = None
    bin: Optional[str] = None
    barcode: Optional[str] = None
    status: str = "Available"

class StorageLocationCreate(StorageLocationBase):
    pass

class StorageLocationUpdate(StorageLocationBase):
    pass

class StorageLocationResponse(StorageLocationBase, TimestampSchema):
    id: UUID
    warehouse_id: UUID
    tenant_id: UUID

    model_config = ConfigDict(from_attributes=True)


class WarehouseBase(BaseModel):
    name: str
    warehouse_type: str = "Distribution Center"
    capacity: Optional[str] = None
    manager_name: Optional[str] = None
    employees: int = 0
    temperature_control: Optional[str] = None
    status: str = "Active"

class WarehouseCreate(WarehouseBase):
    pass

class WarehouseUpdate(WarehouseBase):
    name: Optional[str] = None

class WarehouseResponse(WarehouseBase, TimestampSchema):
    id: UUID
    tenant_id: UUID
    locations: List[StorageLocationResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Put-Away Rules
# ==========================================

class PutAwayRuleBase(BaseModel):
    name: str
    priority: int = 10
    destination_zone: Optional[str] = None
    destination_rack: Optional[str] = None
    bin_assignment: str = "first_available"
    stacking_limit: int = 5
    special_requirements: List[str] = []
    conditions: List[Dict[str, Any]] = []
    description: Optional[str] = None
    is_active: bool = True


class PutAwayRuleCreate(PutAwayRuleBase):
    pass


class PutAwayRuleUpdate(BaseModel):
    name: Optional[str] = None
    priority: Optional[int] = None
    destination_zone: Optional[str] = None
    destination_rack: Optional[str] = None
    bin_assignment: Optional[str] = None
    stacking_limit: Optional[int] = None
    special_requirements: Optional[List[str]] = None
    conditions: Optional[List[Dict[str, Any]]] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class PutAwayRuleResponse(PutAwayRuleBase, TimestampSchema):
    id: UUID
    tenant_id: UUID

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Picking Rules
# ==========================================

class PickingRuleBase(BaseModel):
    name: str
    strategy: str = "discrete"
    order_rule: str = "by_aging"
    batch_size: int = 10
    zone_priority: List[str] = []
    exclude_hazmat: bool = True
    allow_partial: bool = False
    auto_release: bool = False
    description: Optional[str] = None
    is_active: bool = True


class PickingRuleCreate(PickingRuleBase):
    pass


class PickingRuleUpdate(BaseModel):
    name: Optional[str] = None
    strategy: Optional[str] = None
    order_rule: Optional[str] = None
    batch_size: Optional[int] = None
    zone_priority: Optional[List[str]] = None
    exclude_hazmat: Optional[bool] = None
    allow_partial: Optional[bool] = None
    auto_release: Optional[bool] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class PickingRuleResponse(PickingRuleBase, TimestampSchema):
    id: UUID
    tenant_id: UUID

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Inventory Batch / Serial / Traceability
# ==========================================

class InventoryBatchBase(BaseModel):
    batch_number: str
    product_id: Optional[UUID] = None
    product_name: Optional[str] = None
    sku: Optional[str] = None
    warehouse_id: Optional[UUID] = None
    warehouse_name: Optional[str] = None
    supplier: Optional[str] = None
    quantity: int = 0
    remaining_quantity: int = 0
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None
    notes: Optional[str] = None
    status: str = "Active"


class InventoryBatchCreate(InventoryBatchBase):
    pass


class InventoryBatchUpdate(BaseModel):
    batch_number: Optional[str] = None
    product_name: Optional[str] = None
    sku: Optional[str] = None
    warehouse_name: Optional[str] = None
    supplier: Optional[str] = None
    quantity: Optional[int] = None
    remaining_quantity: Optional[int] = None
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class InventoryBatchResponse(InventoryBatchBase, TimestampSchema):
    id: UUID
    tenant_id: UUID

    model_config = ConfigDict(from_attributes=True)


class InventorySerialBase(BaseModel):
    serial_number: str
    batch_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    product_name: Optional[str] = None
    warehouse_id: Optional[UUID] = None
    warehouse_name: Optional[str] = None
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None
    notes: Optional[str] = None
    status: str = "In Stock"


class InventorySerialCreate(InventorySerialBase):
    pass


class InventorySerialUpdate(BaseModel):
    serial_number: Optional[str] = None
    batch_id: Optional[UUID] = None
    product_name: Optional[str] = None
    warehouse_name: Optional[str] = None
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class InventorySerialResponse(InventorySerialBase, TimestampSchema):
    id: UUID
    tenant_id: UUID

    model_config = ConfigDict(from_attributes=True)


class TraceabilityEventCreate(BaseModel):
    event_type: str
    batch_id: Optional[UUID] = None
    serial_id: Optional[UUID] = None
    source_location: Optional[str] = None
    destination_location: Optional[str] = None
    source_warehouse_id: Optional[UUID] = None
    destination_warehouse_id: Optional[UUID] = None
    party_type: Optional[str] = None
    party_name: Optional[str] = None
    reference_document: Optional[str] = None
    quantity: Optional[int] = None
    unit: Optional[str] = None
    notes: Optional[str] = None
    event_at: Optional[datetime] = None


class TraceabilityEventResponse(TraceabilityEventCreate):
    id: UUID
    tenant_id: UUID
    actor_user_id: Optional[UUID] = None
    event_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UnitOfMeasureBase(BaseModel):
    name: str
    abbreviation: str
    description: Optional[str] = None
    status: str = "Active"

class UnitOfMeasureCreate(UnitOfMeasureBase):
    pass

class UnitOfMeasureUpdate(UnitOfMeasureBase):
    name: Optional[str] = None
    abbreviation: Optional[str] = None

class UnitOfMeasureResponse(UnitOfMeasureBase, TimestampSchema):
    id: UUID
    tenant_id: UUID

    model_config = ConfigDict(from_attributes=True)


class ProductQRCodeBase(BaseModel):
    product_id: Optional[UUID] = None
    qr_data: str
    qr_type: str = "product"
    format: Optional[str] = None
    version: Optional[str] = None
    error_correction: Optional[str] = "M"
    notes: Optional[str] = None
    is_active: bool = True


class ProductQRCodeCreate(ProductQRCodeBase):
    pass


class ProductQRCodeUpdate(BaseModel):
    qr_data: Optional[str] = None
    qr_type: Optional[str] = None
    format: Optional[str] = None
    version: Optional[str] = None
    error_correction: Optional[str] = None
    print_count: Optional[int] = None
    last_printed_at: Optional[datetime] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class ProductQRCodeResponse(ProductQRCodeBase, TimestampSchema):
    id: UUID
    tenant_id: UUID
    print_count: int
    last_printed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ProductRFIDBase(BaseModel):
    product_id: Optional[UUID] = None
    tag_uid: str
    tag_type: Optional[str] = None
    frequency: Optional[str] = None
    protocol: Optional[str] = None
    memory_bits: Optional[int] = None
    last_seen_location: Optional[str] = None
    status: str = "active"
    notes: Optional[str] = None


class ProductRFIDCreate(ProductRFIDBase):
    pass


class ProductRFIDUpdate(BaseModel):
    tag_uid: Optional[str] = None
    tag_type: Optional[str] = None
    frequency: Optional[str] = None
    protocol: Optional[str] = None
    memory_bits: Optional[int] = None
    last_seen_at: Optional[datetime] = None
    last_seen_location: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ProductRFIDResponse(ProductRFIDBase, TimestampSchema):
    id: UUID
    tenant_id: UUID
    write_count: int
    last_seen_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
