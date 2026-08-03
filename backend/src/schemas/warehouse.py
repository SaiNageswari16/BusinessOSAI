from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime
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


# ==========================================
# Inventory Batch, Serial, QR Code, RFID & Traceability Schemas
# ==========================================

from datetime import date

class InventoryBatchBase(BaseModel):
    batch_number: str
    product_id: Optional[UUID] = None
    product_name: Optional[str] = None
    sku: Optional[str] = None
    warehouse_id: Optional[UUID] = None
    warehouse_name: Optional[str] = None
    quantity: int = 0
    remaining_quantity: int = 0
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None
    supplier: Optional[str] = None
    status: str = "Active"
    notes: Optional[str] = None

class InventoryBatchCreate(InventoryBatchBase):
    pass

class InventoryBatchUpdate(BaseModel):
    batch_number: Optional[str] = None
    warehouse_id: Optional[UUID] = None
    warehouse_name: Optional[str] = None
    quantity: Optional[int] = None
    remaining_quantity: Optional[int] = None
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None
    supplier: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class InventoryBatchResponse(InventoryBatchBase, TimestampSchema):
    id: UUID
    tenant_id: UUID
    model_config = ConfigDict(from_attributes=True)


class InventorySerialBase(BaseModel):
    serial_number: str
    product_id: Optional[UUID] = None
    product_name: Optional[str] = None
    sku: Optional[str] = None
    batch_id: Optional[UUID] = None
    warehouse_id: Optional[UUID] = None
    warehouse_name: Optional[str] = None
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None
    status: str = "In Stock"
    location: Optional[str] = None
    notes: Optional[str] = None

class InventorySerialCreate(InventorySerialBase):
    pass

class InventorySerialUpdate(BaseModel):
    serial_number: Optional[str] = None
    status: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None

class InventorySerialResponse(InventorySerialBase, TimestampSchema):
    id: UUID
    tenant_id: UUID
    model_config = ConfigDict(from_attributes=True)


class ProductQRCodeBase(BaseModel):
    product_id: UUID
    qr_data: str
    label_format: str = "Standard"
    notes: Optional[str] = None

class ProductQRCodeCreate(ProductQRCodeBase):
    pass

class ProductQRCodeUpdate(BaseModel):
    qr_data: Optional[str] = None
    label_format: Optional[str] = None
    notes: Optional[str] = None

class ProductQRCodeResponse(ProductQRCodeBase, TimestampSchema):
    id: UUID
    tenant_id: UUID
    print_count: int = 0
    last_printed_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class ProductRFIDBase(BaseModel):
    product_id: UUID
    tag_uid: str
    frequency: str = "UHF"
    status: str = "Active"
    notes: Optional[str] = None

class ProductRFIDCreate(ProductRFIDBase):
    pass

class ProductRFIDUpdate(BaseModel):
    tag_uid: Optional[str] = None
    frequency: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class ProductRFIDResponse(ProductRFIDBase, TimestampSchema):
    id: UUID
    tenant_id: UUID
    write_count: int = 0
    last_seen_at: Optional[datetime] = None
    last_seen_location: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class TraceabilityEventBase(BaseModel):
    event_type: str
    product_id: UUID
    batch_id: Optional[UUID] = None
    serial_id: Optional[UUID] = None
    location: Optional[str] = None
    actor: Optional[str] = None
    notes: Optional[str] = None

class TraceabilityEventCreate(TraceabilityEventBase):
    pass

class TraceabilityEventResponse(TraceabilityEventBase, TimestampSchema):
    id: UUID
    tenant_id: UUID
    model_config = ConfigDict(from_attributes=True)


class PutAwayRuleBase(BaseModel):
    name: str
    warehouse_id: Optional[UUID] = None
    zone: Optional[str] = None
    category_id: Optional[UUID] = None
    destination_location: Optional[str] = None
    priority: int = 1
    status: str = "Active"
    notes: Optional[str] = None

class PutAwayRuleCreate(PutAwayRuleBase):
    pass

class PutAwayRuleUpdate(BaseModel):
    name: Optional[str] = None
    warehouse_id: Optional[UUID] = None
    zone: Optional[str] = None
    category_id: Optional[UUID] = None
    destination_location: Optional[str] = None
    priority: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class PutAwayRuleResponse(PutAwayRuleBase, TimestampSchema):
    id: UUID
    tenant_id: UUID
    model_config = ConfigDict(from_attributes=True)


class PickingRuleBase(BaseModel):
    name: str
    strategy: str = "FIFO"
    warehouse_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    status: str = "Active"
    notes: Optional[str] = None

class PickingRuleCreate(PickingRuleBase):
    pass

class PickingRuleUpdate(BaseModel):
    name: Optional[str] = None
    strategy: Optional[str] = None
    warehouse_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class PickingRuleResponse(PickingRuleBase, TimestampSchema):
    id: UUID
    tenant_id: UUID
    model_config = ConfigDict(from_attributes=True)


