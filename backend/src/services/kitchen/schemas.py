"""Kitchen service schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.services.kitchen.models import (
    DeviceType,
    KOTItemStatus,
    KOTPriority,
    KOTStatus,
    PrintStatus,
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


class StationMetricsResponse(BaseModel):
    """Observed prep performance for a station over a rolling window, instead
    of the static ``avg_prep_minutes`` set at creation time."""

    station_id: uuid.UUID
    window_hours: int
    tickets_completed: int
    """KOTs that reached READY within the window (fired_at -> ready_at)."""
    avg_prep_minutes: float | None
    """Mean fired_at -> ready_at in minutes, over the completed tickets. None
    if the station has had no completions in the window — the caller decides
    whether to fall back to the station's configured value."""
    slowest_minutes: float | None
    fastest_minutes: float | None


# ─── KDS devices ─────────────────────────────────────────────────────────────

class DeviceCreate(BaseModel):
    outlet_id: uuid.UUID
    station_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=100)
    # What this device can render: KDS display, receipt printer, or both.
    # Optional — a screen registered before the field existed is read back
    # as KDS. A device with no station binding is an outlet-level receipt
    # printer, not a pass screen.
    device_type: DeviceType = DeviceType.KDS


class DeviceResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID
    station_id: uuid.UUID | None
    name: str
    device_token: str
    device_type: DeviceType | None
    is_active: bool
    last_seen_at: datetime | None
    created_at: datetime

    @model_validator(mode="after")
    def _default_device_type(self) -> "DeviceResponse":
        # A NULL device_type (a row written before the column existed) is the
        # same as KDS — that is what every existing screen is — so the caller
        # never has to special-case the null.
        if self.device_type is None:
            self.device_type = DeviceType.KDS
        return self


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


class KOTBumpRequest(BaseModel):
    """Move a ticket to the front of the queue / change its urgency.

    ``priority`` is the KOT's urgency (RUSH beats VIP beats NORMAL in board
    ordering). ``station_id`` moves it to a different station — the pass
    screen's "send this ticket to the fry station instead" case. At least one
    must be set; a bump with neither is a no-op, not an error.
    """

    priority: KOTPriority | None = None
    station_id: uuid.UUID | None = None
    reason: str | None = Field(default=None, max_length=300)


class KOTRefireRequest(BaseModel):
    """Re-open a cancelled/served ticket for a second trip through the pass.

    A dish that dropped on the way to the table, or a course fired too early
    before the guest was ready, comes back to the kitchen as a re-fire rather
    than a brand-new order line. The ticket keeps its items; only its status
    and fire timestamps reset.
    """

    reason: str = Field(min_length=1, max_length=300)


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


# ─── Kitchen print requests ──────────────────────────────────────────────────

class PrintRequest(BaseModel):
    """Route a print request to a printer destination.

    ``printer_ref`` is a bare UUID into the printers service's hardware
    registry — the kitchen does not resolve it. Omitted means "use the
    station's configured printer" (or the outlet default when there is no
    station binding), and the printers service is the one that maps a
    destination to a physical device.
    """

    printer_ref: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=300)


class PrintLogResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    kot_id: uuid.UUID | None
    station_id: uuid.UUID | None
    status: PrintStatus
    printer_ref: uuid.UUID | None
    ack_reason: str | None
    acked_at: datetime | None
    created_at: datetime


class PrintLogUpdate(BaseModel):
    """The printers service's ack of a print request.

    Flips the row to SENT or FAILED. ``ack_reason`` is optional free text —
    a job id on success, the error on failure — kept short because the
    column is a string, not JSON.
    """

    status: PrintStatus
    ack_reason: str | None = Field(default=None, max_length=300)


class PrintQueueResponse(BaseModel):
    """Open print requests for a station, oldest first.

    This is how the printers service polls for work: it reads this, then
    acks each row it completes through ``PATCH /print-log/{id}``. No items
    here — the queue is a flat list by design, the way the KDS board is.
    """

    station_id: uuid.UUID
    rows: list[PrintLogResponse]
    total: int


class KOTPrintPreview(BaseModel):
    """A structured receipt/thermal render of one ticket. No HTML.

    The frontend and the printers service both consume this — it is the
    single source of truth for "what goes on the paper," with the item
    lines, modifiers and notes in a form a thermal printer can lay out
    without needing to know about the KOT row shape.
    """

    kot_id: uuid.UUID
    kot_number: str
    order_number: str | None
    order_type: str | None
    table_name: str | None
    station_id: uuid.UUID
    station_name: str | None
    status: KOTStatus
    priority: KOTPriority
    item_count: int = 0

    @model_validator(mode="after")
    def _fill_item_count(self) -> "KOTPrintPreview":
        self.item_count = len(self.items)
        return self
    course_number: int | None
    covers: int
    notes: str | None
    fired_at: datetime | None
    ready_at: datetime | None
    served_at: datetime | None
    items: list[dict]
    """Each item: {name, variant_name, qty, notes, modifiers, course_number}."""
