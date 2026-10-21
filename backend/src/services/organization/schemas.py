"""Organization service Pydantic schemas — public API surface.

These live here, not in a shared kernel, so the service owns its contract
completely. Other services that need to validate an outlet_id do so by calling
this service over HTTP through the gateway.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# ─── Mixin aliases (for documentation) ──────────────────────────────────────

class _Timestamp(BaseModel):
    created_at: datetime
    updated_at: datetime


class _Scoped(BaseModel):
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None = None


# ─── Tenant ─────────────────────────────────────────────────────────────────

class TenantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    slug: str = Field(min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$")
    contact_email: str | None = None
    contact_phone: str | None = None


class TenantUpdate(BaseModel):
    name: str | None = None
    status: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None


class TenantResponse(_Timestamp):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    slug: str
    status: str
    plan: str
    contact_email: str | None = None
    contact_phone: str | None = None
    trial_ends_at: datetime | None = None


# ─── Outlet ──────────────────────────────────────────────────────────────────

class OutletCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=1, max_length=20)
    outlet_type: str = Field(default="dine_in")
    address_line1: str | None = None
    city: str | None = None
    state: str | None = None
    state_code: str | None = Field(default=None, max_length=5)
    country: str = Field(default="IN", max_length=5)
    phone: str | None = None
    email: str | None = None
    gstin: str | None = Field(default=None, max_length=20)
    timezone: str = Field(default="Asia/Kolkata")
    currency: str = Field(default="INR", max_length=5)
    is_active: bool = True


class OutletUpdate(BaseModel):
    name: str | None = None
    address_line1: str | None = None
    city: str | None = None
    state: str | None = None
    state_code: str | None = None
    phone: str | None = None
    email: str | None = None
    gstin: str | None = None
    timezone: str | None = None
    is_active: bool | None = None
    settings: dict[str, Any] | None = None


class OutletResponse(_Scoped, _Timestamp):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    code: str
    outlet_type: str
    address_line1: str | None = None
    city: str | None = None
    state: str | None = None
    state_code: str | None = None
    country: str
    phone: str | None = None
    email: str | None = None
    gstin: str | None = None
    timezone: str
    currency: str
    is_active: bool
    settings: dict[str, Any] = Field(default_factory=dict)


# ─── Section ─────────────────────────────────────────────────────────────────

class SectionCreate(BaseModel):
    outlet_id: uuid.UUID
    name: str = Field(min_length=1, max_length=100)
    section_type: str = Field(default="ac_hall")
    capacity: int = Field(default=0, ge=0)
    is_active: bool = True
    sort_order: int = 0


class SectionUpdate(BaseModel):
    name: str | None = None
    section_type: str | None = None
    capacity: int | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class SectionResponse(_Scoped, _Timestamp):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    outlet_id: uuid.UUID
    name: str
    section_type: str
    capacity: int
    is_active: bool
    sort_order: int


# ─── Table ───────────────────────────────────────────────────────────────────

class TableCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    section_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=50)
    code: str = Field(min_length=1, max_length=20)
    seats: int = Field(default=4, ge=1, le=100)
    shape: str = Field(default="round")
    min_covers: int = Field(default=1, ge=1)
    max_covers: int = Field(default=6, ge=1)
    is_active: bool = True
    position_x: float | None = None
    position_y: float | None = None


class TableUpdate(BaseModel):
    name: str | None = None
    section_id: uuid.UUID | None = None
    seats: int | None = None
    shape: str | None = None
    min_covers: int | None = None
    max_covers: int | None = None
    status: str | None = None
    is_active: bool | None = None
    position_x: float | None = None
    position_y: float | None = None


class TableStatusUpdate(BaseModel):
    status: str = Field(pattern=r"^(free|available|occupied|reserved|billing|billed|cleaning|dirty|blocked|out_of_service)$")


class TableResponse(_Scoped, _Timestamp):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    outlet_id: uuid.UUID
    section_id: uuid.UUID | None = None
    name: str
    code: str
    seats: int
    shape: str = "round"
    min_covers: int
    max_covers: int
    status: str
    is_active: bool
    position_x: float | None = None
    position_y: float | None = None


# ─── Floor plan ─────────────────────────────────────────────────────────────

class FloorPlanUpdateEntry(BaseModel):
    id: uuid.UUID | None = None
    section_id: uuid.UUID | None = None
    shape: str | None = None
    position_x: float | None = None
    position_y: float | None = None


class FloorPlanUpdate(BaseModel):
    tables: list[FloorPlanUpdateEntry] = Field(default_factory=list)


class FloorPlanResponse(BaseModel):
    sections: list[SectionResponse]
    tables: list[TableResponse]


# ─── CostCentre ─────────────────────────────────────────────────────────────

class CostCentreCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=150)
    code: str = Field(min_length=1, max_length=20)
    center_type: str = "operating"


class CostCentreResponse(_Scoped, _Timestamp):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    outlet_id: uuid.UUID | None = None
    name: str
    code: str
    center_type: str
    is_active: bool


# ─── UoM ────────────────────────────────────────────────────────────────────

class UomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    code: str = Field(min_length=1, max_length=20)
    uom_type: str = "quantity"
    base_factor: float = 1.0


class UomResponse(_Scoped, _Timestamp):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    code: str
    uom_type: str
    base_factor: float
    is_active: bool


# ─── Bulk ops ────────────────────────────────────────────────────────────────

class TableBulkStatusUpdate(BaseModel):
    table_ids: list[uuid.UUID] = Field(min_length=1)
    status: str = Field(pattern=r"^(free|occupied|reserved|billing|cleaning|blocked)$")


class BulkDeleteResponse(BaseModel):
    deleted: int
    errors: list[str] = Field(default_factory=list)
