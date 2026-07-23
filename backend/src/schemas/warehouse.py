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
