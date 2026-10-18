"""Kitchen station, KOT and KDS schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from src.models.kitchen import KOTPriority, KOTStatus, StationType


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Stations ────────────────────────────────────────────────────

class KitchenStationCreate(BaseModel):
    outlet_id: uuid.UUID
    name: str = Field(min_length=1, max_length=100)
    station_type: StationType = StationType.CURRY
    printer_id: uuid.UUID | None = None
    capacity_concurrent: int = Field(default=10, ge=1)
    avg_prep_minutes: int | None = Field(default=None, ge=0)


class KitchenStationUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    station_type: StationType | None = None
    printer_id: uuid.UUID | None = None
    capacity_concurrent: int | None = Field(default=None, ge=1)
    avg_prep_minutes: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class KitchenStationResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    name: str
    station_type: str
    printer_id: uuid.UUID | None
    is_active: bool
    capacity_concurrent: int
    avg_prep_minutes: int | None
    created_at: datetime


# ─── KOT ─────────────────────────────────────────────────────────

class KOTItemResponse(ORMBase):
    id: uuid.UUID
    kot_id: uuid.UUID
    order_item_id: uuid.UUID | None
    menu_item_id: uuid.UUID | None
    variant_id: uuid.UUID | None
    name: str
    variant_name: str | None
    qty: int
    status: str
    course_number: int
    notes: str | None
    modifiers: list
    prepared_at: str | None


class KOTResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    order_id: uuid.UUID
    table_id: uuid.UUID | None
    station_id: uuid.UUID | None
    kot_number: str
    status: str
    priority: str
    course_number: int
    fired_at: str | None
    acknowledged_at: str | None
    ready_at: str | None
    served_at: str | None
    printed_count: int
    notes: str | None
    items: list[KOTItemResponse] = Field(default_factory=list)
    created_at: datetime


class KOTItemStatusUpdate(BaseModel):
    """KDS marking a single line prepared / served / cancelled."""
    status: str = Field(pattern="^(preparing|ready|served|cancelled)$")
    reason: str | None = None


class KOTStatusUpdate(BaseModel):
    status: str = Field(pattern="^(acknowledged|preparing|ready|served|cancelled)$")
    reason: str | None = None


class KOTPriorityUpdate(BaseModel):
    priority: KOTPriority


class KOTCancelRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


# ─── KDS devices ─────────────────────────────────────────────────

class KDSDeviceRegister(BaseModel):
    outlet_id: uuid.UUID
    station_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=100)


class KDSDeviceResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    station_id: uuid.UUID | None
    name: str
    device_token: str
    is_active: bool
    last_seen_at: str | None


class KDSHeartbeat(BaseModel):
    station_id: uuid.UUID | None = None


# ─── Analytics ───────────────────────────────────────────────────

class StationPerformance(BaseModel):
    station_id: uuid.UUID
    station_name: str
    tickets_completed: int
    avg_prep_minutes: float | None
    backlog: int


class KitchenAnalytics(BaseModel):
    outlet_id: uuid.UUID
    active_tickets: int
    completed_today: int
    cancelled_today: int
    avg_prep_minutes: float | None
    stations: list[StationPerformance] = Field(default_factory=list)
