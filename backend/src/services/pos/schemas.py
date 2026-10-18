"""POS service schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.services.pos.models import (
    OrderItemStatus,
    OrderStatus,
    OrderType,
    ReservationStatus,
    WaitlistStatus,
)


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Addons on a line ────────────────────────────────────────────────────────

class AddonEntry(BaseModel):
    """An addon/modifier chosen for a line. ``addon_id`` is kept for
    traceability but name and price are the snapshot that matters."""

    name: str = Field(max_length=100)
    price: float = 0
    qty: int = 1
    addon_id: uuid.UUID | None = None
    modifier_id: uuid.UUID | None = None

    @field_validator("qty")
    @classmethod
    def _qty_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("qty must be at least 1")
        return v


# ─── Order lines ─────────────────────────────────────────────────────────────

class OrderLineCreate(BaseModel):
    """A line to add to a draft order.

    The snapshot fields (``item_name``, ``unit_price``) are authoritative when
    present: the POS sends what it displayed to the customer, which may
    predate a menu edit. ``menu_item_id`` is provenance, not a lookup.
    """

    menu_item_id: uuid.UUID | None = None
    variant_id: uuid.UUID | None = None
    combo_id: uuid.UUID | None = None

    item_name: str = Field(min_length=1, max_length=200)
    variant_name: str | None = Field(default=None, max_length=100)
    unit_price: float = Field(ge=0)
    qty: int = Field(ge=1, default=1)

    course_number: int = Field(ge=1, default=1)
    notes: str | None = None
    discount_pct: float | None = Field(default=None, ge=0, le=100)
    tax_code_id: uuid.UUID | None = None
    tax_amount: float = Field(ge=0, default=0)
    kitchen_station_id: uuid.UUID | None = None

    addons: list[AddonEntry] = Field(default_factory=list)


class OrderLineUpdate(BaseModel):
    qty: int | None = Field(default=None, ge=1)
    unit_price: float | None = Field(default=None, ge=0)
    discount_pct: float | None = Field(default=None, ge=0, le=100)
    notes: str | None = None
    status: OrderItemStatus | None = None


class AddonResponse(OrmModel):
    id: uuid.UUID
    addon_id: uuid.UUID | None
    modifier_id: uuid.UUID | None
    name: str
    price: float
    qty: int


class OrderItemResponse(OrmModel):
    id: uuid.UUID
    menu_item_id: uuid.UUID | None
    variant_id: uuid.UUID | None
    combo_id: uuid.UUID | None
    item_name: str
    variant_name: str | None
    unit_price: float
    qty: int
    position: int
    status: OrderItemStatus
    course_number: int
    notes: str | None
    discount_pct: float | None
    discount_amount: float
    tax_code_id: uuid.UUID | None
    tax_amount: float
    total: float
    kitchen_station_id: uuid.UUID | None
    addons: list[AddonResponse]


class OrderCourseResponse(OrmModel):
    id: uuid.UUID
    course_number: int
    name: str | None
    status: str
    fired_at: datetime | None
    served_at: datetime | None


# ─── Orders ──────────────────────────────────────────────────────────────────

class OrderCreate(BaseModel):
    outlet_id: uuid.UUID
    order_type: OrderType = OrderType.DINE_IN
    table_id: uuid.UUID | None = None
    section_id: uuid.UUID | None = None
    covers: int = Field(ge=1, default=1)
    waiter_id: uuid.UUID | None = None
    shift_id: uuid.UUID | None = None

    customer_id: uuid.UUID | None = None
    customer_name: str | None = Field(default=None, max_length=200)
    customer_phone: str | None = Field(default=None, max_length=30)

    aggregator_name: str | None = Field(default=None, max_length=50)
    aggregator_order_id: str | None = Field(default=None, max_length=100)

    notes: str | None = None
    is_parcel: bool = False
    token_number: int | None = None

    lines: list[OrderLineCreate] = Field(default_factory=list)

    @field_validator("covers")
    @classmethod
    def _covers_positive(cls, v: int) -> int:
        return v


class OrderUpdate(BaseModel):
    status: OrderStatus | None = None
    notes: str | None = None
    customer_id: uuid.UUID | None = None
    customer_name: str | None = Field(default=None, max_length=200)
    customer_phone: str | None = Field(default=None, max_length=30)
    token_number: int | None = None
    table_id: uuid.UUID | None = None


class OrderCreateResponse(OrmModel):
    """What a placement returns: the order plus its computed totals."""

    id: uuid.UUID
    order_number: str
    status: OrderStatus
    subtotal: float
    grand_total: float
    item_count: int
    items: list[OrderItemResponse]


class OrderDetailResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID
    order_number: str
    order_type: OrderType
    status: OrderStatus

    table_id: uuid.UUID | None
    section_id: uuid.UUID | None
    covers: int
    waiter_id: uuid.UUID | None
    shift_id: uuid.UUID | None

    customer_id: uuid.UUID | None
    customer_name: str | None
    customer_phone: str | None

    aggregator_name: str | None
    aggregator_order_id: str | None

    notes: str | None
    is_parcel: bool
    token_number: int | None

    placed_at: datetime | None
    closed_at: datetime | None

    subtotal: float
    discount_total: float
    tax_total: float
    service_charge: float
    grand_total: float

    items: list[OrderItemResponse] = Field(default_factory=list)
    courses: list[OrderCourseResponse] = Field(default_factory=list)
    created_at: datetime


class OrderListResponse(OrmModel):
    """Slim list view for a dashboard.

    Deliberately contains only columns. Adding a per-order line count here
    would mean loading ``items`` for every row — a lazy load during response
    serialisation, which fails as MissingGreenlet in an async session. The
    detail endpoint returns the lines; this one stays a flat SELECT.
    """

    id: uuid.UUID
    outlet_id: uuid.UUID
    order_number: str
    order_type: OrderType
    status: OrderStatus
    table_id: uuid.UUID | None
    covers: int
    customer_name: str | None
    token_number: int | None
    subtotal: float
    grand_total: float
    placed_at: datetime | None
    closed_at: datetime | None
    created_at: datetime


# ─── Table sessions ──────────────────────────────────────────────────────────

class TableSessionCreate(BaseModel):
    outlet_id: uuid.UUID
    table_id: uuid.UUID
    covers: int = Field(ge=1, default=1)
    waiter_id: uuid.UUID | None = None
    order_id: uuid.UUID | None = None


class TableSessionResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID
    table_id: uuid.UUID
    order_id: uuid.UUID | None
    status: str
    covers: int
    waiter_id: uuid.UUID | None
    started_at: datetime | None
    ended_at: datetime | None
    created_at: datetime


# ─── Reservations ────────────────────────────────────────────────────────────

class ReservationCreate(BaseModel):
    outlet_id: uuid.UUID
    table_id: uuid.UUID | None = None
    customer_id: uuid.UUID | None = None
    customer_name: str = Field(min_length=1, max_length=200)
    customer_phone: str = Field(min_length=1, max_length=30)
    covers: int = Field(ge=1, default=2)
    reserved_from: datetime
    reserved_to: datetime | None = None
    status: ReservationStatus = ReservationStatus.PENDING
    notes: str | None = None
    occasion: str | None = Field(default=None, max_length=100)
    deposit_amount: float = Field(ge=0, default=0)


class ReservationUpdate(BaseModel):
    status: ReservationStatus | None = None
    table_id: uuid.UUID | None = None
    covers: int | None = Field(default=None, ge=1)
    notes: str | None = None
    occasion: str | None = Field(default=None, max_length=100)
    deposit_amount: float | None = Field(default=None, ge=0)


class ReservationResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID
    table_id: uuid.UUID | None
    customer_id: uuid.UUID | None
    reservation_number: str | None
    customer_name: str
    customer_phone: str
    covers: int
    reserved_from: datetime
    reserved_to: datetime | None
    status: ReservationStatus
    notes: str | None
    occasion: str | None
    deposit_amount: float
    created_at: datetime


# ─── Waitlist ────────────────────────────────────────────────────────────────

class WaitlistCreate(BaseModel):
    outlet_id: uuid.UUID
    customer_name: str = Field(min_length=1, max_length=200)
    customer_phone: str = Field(min_length=1, max_length=30)
    covers: int = Field(ge=1, default=2)
    quoted_wait_minutes: int | None = Field(default=None, ge=0)


class WaitlistUpdate(BaseModel):
    status: WaitlistStatus | None = None
    covers: int | None = Field(default=None, ge=1)


class WaitlistResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID
    customer_name: str
    customer_phone: str
    covers: int
    quoted_wait_minutes: int | None
    status: WaitlistStatus
    created_at: datetime


# ─── Event payload ───────────────────────────────────────────────────────────

class OrderPlacedEvent(BaseModel):
    """The shape kitchen/billing/inventory receive on ``order.placed``.

    Deliberately self-contained: a consumer must be able to act on this without
    calling back into pos. Item snapshots travel with it because the menu may
    change between the sale and when the kitchen prepares it.
    """

    order_id: str
    order_number: str
    order_type: str
    outlet_id: str
    table_id: str | None = None
    customer_id: str | None = None
    covers: int = 1
    item_count: int = 0
    subtotal: float = 0
    grand_total: float = 0
    lines: list[dict] = Field(default_factory=list)
