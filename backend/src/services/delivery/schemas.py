"""Delivery service schemas."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Delivery boys ───────────────────────────────────────────────────────────

class DeliveryBoyCreate(BaseModel):
    outlet_id: uuid.UUID
    name: str = Field(min_length=1, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=255)
    area: str | None = Field(default=None, max_length=200)
    active: bool = True
    notes: str | None = None


class DeliveryBoyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=255)
    area: str | None = Field(default=None, max_length=200)
    active: bool | None = None
    notes: str | None = None


class DeliveryBoyResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    name: str
    phone: str | None
    email: str | None
    area: str | None
    active: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime


# ─── Delivery zones ──────────────────────────────────────────────────────────

class DeliveryZoneCreate(BaseModel):
    outlet_id: uuid.UUID
    name: str = Field(min_length=1, max_length=100)
    radius_km: Decimal = Field(default=Decimal("5.00"), ge=Decimal("0"))
    pincode: str | None = Field(default=None, max_length=10)
    active: bool = True


class DeliveryZoneUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    radius_km: Decimal | None = Field(default=None, ge=Decimal("0"))
    pincode: str | None = Field(default=None, max_length=10)
    active: bool | None = None


class DeliveryZoneResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    name: str
    radius_km: Decimal
    pincode: str | None
    active: bool
    created_at: datetime
    updated_at: datetime


# ─── Deliveries ──────────────────────────────────────────────────────────────

class DeliveryCreate(BaseModel):
    order_id: uuid.UUID
    outlet_id: uuid.UUID | None = None
    zone_id: uuid.UUID | None = None
    boy_id: uuid.UUID | None = None
    notes: str | None = None


class DeliveryStatusUpdate(BaseModel):
    to_status: str = Field(min_length=1, max_length=20)
    note: str | None = Field(default=None, max_length=300)


class DeliveryResponse(OrmModel):
    """A delivery joined to its boy/zone so the board renders in one hop."""

    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    order_id: uuid.UUID
    boy_id: uuid.UUID | None
    zone_id: uuid.UUID | None
    status: str
    boy_name: str | None = None
    zone_name: str | None = None
    assigned_at: datetime | None
    delivered_at: datetime | None
    cancel_reason: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class DeliveryLiveItem(BaseModel):
    """One tile on the live dispatch board — a delivery plus its boy."""

    delivery: DeliveryResponse
    boy: DeliveryBoyResponse | None
