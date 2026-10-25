"""Organization service Pydantic schemas — public API surface.

These live here, not in a shared kernel, so the service owns its contract
completely. Other services that need to validate an outlet_id do so by calling
this service over HTTP through the gateway.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


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


# ─── Brand (enterprise) ────────────────────────────────────────────────────

class BrandCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=1, max_length=50)
    description: str | None = None
    is_active: bool = True


class BrandUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class BrandResponse(_Timestamp):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    code: str
    description: str | None = None
    is_active: bool


# ─── Outlet ──────────────────────────────────────────────────────────────────

class OutletCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=1, max_length=20)
    outlet_type: str = Field(default="dine_in")
    brand_id: uuid.UUID | None = None
    parent_outlet_id: uuid.UUID | None = None
    ownership_type: str = Field(default="direct")
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
    brand_id: uuid.UUID | None = None
    parent_outlet_id: uuid.UUID | None = None
    ownership_type: str | None = None
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
    brand_id: uuid.UUID | None = None
    parent_outlet_id: uuid.UUID | None = None
    ownership_type: str
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
    size_w: float | None = None
    size_h: float | None = None
    rotation: float = 0.0
    label: str | None = Field(default=None, max_length=100)
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
    size_w: float | None = None
    size_h: float | None = None
    rotation: float | None = None
    label: str | None = None
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
    size_w: float | None = None
    size_h: float | None = None
    rotation: float = 0.0
    label: str | None = None
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
    size_w: float | None = None
    size_h: float | None = None
    rotation: float | None = None
    label: str | None = None
    position_x: float | None = None
    position_y: float | None = None


class FloorPlanUpdate(BaseModel):
    tables: list[FloorPlanUpdateEntry] = Field(default_factory=list)


class FloorPlanResponse(BaseModel):
    sections: list[SectionResponse]
    tables: list[TableResponse]


class NamedFloorPlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100,
                      description="A friendly label for this layout variant.")
    # Capture the outlet's current sections + tables geometry into the snapshot.
    include_tables: bool = True


class NamedFloorPlanRestore(BaseModel):
    floor_plan_id: uuid.UUID
    outlet_id: uuid.UUID


class NamedFloorPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    outlet_id: uuid.UUID
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ─── CostCentre ─────────────────────────────────────────────────────────────

class CostCentreCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=150)
    code: str = Field(min_length=1, max_length=20)
    center_type: str = "operating"


class CostCentreUpdate(BaseModel):
    name: str | None = None
    center_type: str | None = None
    is_active: bool | None = None


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


class UomUpdate(BaseModel):
    name: str | None = None
    uom_type: str | None = None
    base_factor: float | None = None
    is_active: bool | None = None


class UomResponse(_Scoped, _Timestamp):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    code: str
    uom_type: str
    base_factor: float
    is_active: bool


# ─── Royalty (franchise) ────────────────────────────────────────────────────

class RoyaltyAgreementCreate(BaseModel):
    brand_id: uuid.UUID
    outlet_id: uuid.UUID
    rate_pct: Decimal | None = Field(
        default=None, ge=0, le=100,
        description="Percentage of revenue, e.g. 5.00. Exactly one of rate_pct/fixed_amount required.",
    )
    fixed_amount: Decimal | None = Field(
        default=None, ge=0,
        description="A flat fee instead of a percentage. Exactly one of rate_pct/fixed_amount required.",
    )
    period: str = Field(default="monthly", pattern=r"^(monthly|quarterly|annual)$")
    effective_from: date
    effective_to: date | None = None
    notes: str | None = None
    is_active: bool = True

    @model_validator(mode="after")
    def _exactly_one_basis(self) -> "RoyaltyAgreementCreate":
        if (self.rate_pct is None) == (self.fixed_amount is None):
            raise ValueError("provide exactly one of rate_pct or fixed_amount")
        return self


class RoyaltyAgreementUpdate(BaseModel):
    rate_pct: Decimal | None = None
    fixed_amount: Decimal | None = None
    period: str | None = Field(default=None, pattern=r"^(monthly|quarterly|annual)$")
    effective_to: date | None = None
    notes: str | None = None
    is_active: bool | None = None


class RoyaltyAgreementResponse(_Timestamp):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    tenant_id: uuid.UUID
    brand_id: uuid.UUID
    outlet_id: uuid.UUID
    rate_pct: Decimal | None = None
    fixed_amount: Decimal | None = None
    period: str
    effective_from: date
    effective_to: date | None = None
    notes: str | None = None
    is_active: bool


class RoyaltySettleRequest(BaseModel):
    agreement_id: uuid.UUID
    period_start: date
    period_end: date
    base_amount: Decimal | None = Field(
        default=None,
        description="Revenue for the window, used when the agreement is rate-based.",
    )
    notes: str | None = None


class RoyaltySettleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    agreement_id: uuid.UUID
    outlet_id: uuid.UUID
    period_start: date
    period_end: date
    base_amount: Decimal | None = None
    amount: Decimal
    status: str
    settled_at: datetime | None = None
    notes: str | None = None


class RoyaltySettleListResponse(BaseModel):
    items: list[RoyaltySettleResponse]
    total: int


# ─── Bulk ops ────────────────────────────────────────────────────────────────

class TableBulkStatusUpdate(BaseModel):
    table_ids: list[uuid.UUID] = Field(min_length=1)
    status: str = Field(pattern=r"^(free|occupied|reserved|billing|cleaning|blocked)$")


class BulkDeleteResponse(BaseModel):
    deleted: int
    errors: list[str] = Field(default_factory=list)
