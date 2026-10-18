"""Kitchen service schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.services.kitchen.models import (
    KOTItemStatus,
    KOTPriority,
    KOTStatus,
    StationType,
)


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Stations ────────────────────────────────────────────────────────────────

class StationCreate(BaseModel):
    outlet_id: uuid.UUID
    name: str = Field(min_length=1, max_length=100)
    station_type: StationType = StationType.OTHER
    printer_id: uuid.UUID | None = None
    capacity_concurrent: int = Field(ge=1, default=10)
    avg_prep_minutes: int | None = Field(default=None, ge=1)


class StationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    station_type: StationType | None = None
    printer_id: uuid.UUID | None = None
    is_active: bool | None = None
    capacity_concurrent: int | None = Field(default=None, ge=1)
    avg_prep_minutes: int | None = Field(default=None, ge=1)


class StationResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID
    name: str
    station_type: StationType
    printer_id: uuid.UUID | None
    is_active: bool
    capacity_concurrent: int
    avg_prep_minutes: int | None
    open_ticket_count: int = 0
    created_at: datetime


# ─── KDS devices ─────────────────────────────────────────────────────────────

class DeviceCreate(BaseModel):
    outlet_id: uuid.UUID
    station_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=100)


class DeviceResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID
    station_id: uuid.UUID | None
    name: str
    device_token: str
    is_active: bool
    last_seen_at: datetime | None
    created_at: datetime


# ─── KOT tickets ─────────────────────────────────────────────────────────────

class KOTItemResponse(OrmModel):
    id: uuid.UUID
    name: str
    variant_name: str | None
    qty: int
    position: int
    status: KOTItemStatus
    course_number: int | None
    notes: str | None
    modifiers: list
    prepared_at: datetime | None


class StatusLogResponse(OrmModel):
    id: uuid.UUID
    from_status: str | None
    to_status: str
    changed_by: uuid.UUID | None
    reason: str | None
    created_at: datetime


class KOTResponse(OrmModel):
    """Full ticket.

    ``item_count`` is derived from ``items`` after validation. The KOT row has
    no such column, so from_attributes would AttributeError on it — a
    model-level ``after`` validator runs once everything else has resolved and
    fills it in, which is the only safe place for this.
    """

    id: uuid.UUID
    outlet_id: uuid.UUID
    order_id: uuid.UUID
    order_number: str | None
    table_id: uuid.UUID | None
    table_name: str | None
    station_id: uuid.UUID
    kot_number: str
    status: KOTStatus
    priority: KOTPriority
    course_number: int | None
    covers: int
    order_type: str | None

    fired_at: datetime | None
    acknowledged_at: datetime | None
    ready_at: datetime | None
    served_at: datetime | None

    printed_count: int
    notes: str | None
    items: list[KOTItemResponse]
    created_at: datetime
    item_count: int = 0

    @model_validator(mode="after")
    def _fill_item_count(self) -> "KOTResponse":
        self.item_count = len(self.items)
        return self


class KOTListResponse(OrmModel):
    """Ticket summary for a station board.

    Columns only. The board polls several times a second, so a per-ticket
    item count here would mean either an N+1 count query or a lazy load of
    ``items`` during response serialisation (MissingGreenlet). The detail
    endpoint carries the line count; this stays a flat SELECT.
    """

    id: uuid.UUID
    station_id: uuid.UUID
    kot_number: str
    order_number: str | None
    table_name: str | None
    covers: int
    order_type: str | None
    status: KOTStatus
    priority: KOTPriority
    course_number: int | None
    fired_at: datetime | None
    acknowledged_at: datetime | None
    ready_at: datetime | None


class KOTStatusUpdate(BaseModel):
    """Kitchen feedback loop. Only ``to_status`` is required."""

    to_status: KOTStatus
    reason: str | None = Field(default=None, max_length=300)


class KOTCancelRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=300)


class KOTItemStatusRequest(BaseModel):
    """Per-dish status from the pass, e.g. a single component done early."""

    to_status: KOTItemStatus


class KOTListResponseModel(BaseModel):
    """Envelope for station-board polls."""

    tickets: list[KOTListResponse]
    total: int


class KOTItemCreate(BaseModel):
    menu_item_id: uuid.UUID | None = None
    name: str
    variant_name: str | None = None
    qty: int = 1
    notes: str | None = None
    course_number: int | None = 1
    modifiers: list = []


class KOTCreate(BaseModel):
    outlet_id: uuid.UUID
    order_id: uuid.UUID | None = None
    order_number: str | None = None
    table_id: uuid.UUID | None = None
    table_name: str | None = None
    station_id: uuid.UUID
    course_number: int | None = 1
    covers: int = 1
    order_type: str | None = "dine_in"
    priority: KOTPriority = KOTPriority.NORMAL
    notes: str | None = None
    items: list[KOTItemCreate] = []
