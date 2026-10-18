"""Order, dine-in, reservation and waitlist schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from src.models.orders import OrderStatus, OrderType, ReservationStatus


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Orders ──────────────────────────────────────────────────────

class OrderItemAddonIn(BaseModel):
    addon_id: uuid.UUID | None = None
    modifier_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=100)
    price: float = Field(default=0, ge=0)
    qty: int = Field(default=1, ge=1)


class OrderItemIn(BaseModel):
    """One line of a running order as sent by the captain's tablet."""

    menu_item_id: uuid.UUID | None = None
    combo_id: uuid.UUID | None = None
    variant_id: uuid.UUID | None = None
    qty: int = Field(default=1, ge=1)
    course_number: int = Field(default=1, ge=1)
    notes: str | None = None
    # Explicit unit price override — used for manager-approved price edits
    unit_price_override: float | None = Field(default=None, ge=0)
    discount_pct: float | None = Field(default=None, ge=0, le=100)
    kitchen_station_id: uuid.UUID | None = None
    addons: list[OrderItemAddonIn] = Field(default_factory=list)


class OrderItemUpdate(BaseModel):
    qty: int | None = Field(default=None, ge=1)
    notes: str | None = None
    discount_pct: float | None = Field(default=None, ge=0, le=100)
    course_number: int | None = Field(default=None, ge=1)


class OrderItemResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    order_id: uuid.UUID
    menu_item_id: uuid.UUID | None
    variant_id: uuid.UUID | None
    combo_id: uuid.UUID | None
    item_name: str
    variant_name: str | None
    unit_price: float
    qty: int
    status: str
    course_number: int
    notes: str | None
    discount_pct: float | None
    discount_amount: float
    tax_amount: float
    total: float
    kitchen_station_id: uuid.UUID | None
    addons: list["OrderItemAddonResponse"] = Field(default_factory=list)


class OrderItemAddonResponse(ORMBase):
    id: uuid.UUID
    order_item_id: uuid.UUID
    addon_id: uuid.UUID | None
    modifier_id: uuid.UUID | None
    name: str
    price: float
    qty: int


class OrderCreate(BaseModel):
    outlet_id: uuid.UUID
    order_type: OrderType = OrderType.DINE_IN
    table_id: uuid.UUID | None = None
    covers: int = Field(default=1, ge=1)
    waiter_id: uuid.UUID | None = None
    customer_id: uuid.UUID | None = None
    customer_name: str | None = Field(default=None, max_length=200)
    customer_phone: str | None = Field(default=None, max_length=30)
    is_parcel: bool = False
    notes: str | None = None
    aggregator_name: str | None = Field(default=None, max_length=50)
    aggregator_order_id: str | None = Field(default=None, max_length=100)
    items: list[OrderItemIn] = Field(default_factory=list)


class OrderUpdate(BaseModel):
    covers: int | None = Field(default=None, ge=1)
    waiter_id: uuid.UUID | None = None
    customer_id: uuid.UUID | None = None
    customer_name: str | None = Field(default=None, max_length=200)
    customer_phone: str | None = Field(default=None, max_length=30)
    notes: str | None = None


class OrderResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    order_number: str
    order_type: str
    status: str
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
    subtotal: float
    discount_total: float
    tax_total: float
    service_charge: float
    grand_total: float
    items: list[OrderItemResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class FireRequest(BaseModel):
    """Fire specific courses (or all unfired items) to the kitchen."""

    course_numbers: list[int] | None = None
    order_item_ids: list[uuid.UUID] | None = None
    priority: str | None = Field(default=None, pattern="^(normal|rush|vip)$")
    notes: str | None = None


class FireResponse(BaseModel):
    fired: int
    kots: list["KOTSummary"]


class KOTSummary(BaseModel):
    id: uuid.UUID
    kot_number: str
    station_id: uuid.UUID | None
    status: str
    item_count: int
    course_number: int


class TransferTableRequest(BaseModel):
    target_table_id: uuid.UUID


class MergeOrderRequest(BaseModel):
    target_order_id: uuid.UUID


class SplitOrderRequest(BaseModel):
    """Split a bill either by item or by an amount on the target order."""

    order_item_ids: list[uuid.UUID] = Field(default_factory=list)
    target_order_id: uuid.UUID | None = None
    new_table_id: uuid.UUID | None = None
    covers: int | None = Field(default=None, ge=1)


# ─── Reservations ────────────────────────────────────────────────

class ReservationCreate(BaseModel):
    outlet_id: uuid.UUID
    table_id: uuid.UUID | None = None
    customer_id: uuid.UUID | None = None
    customer_name: str = Field(min_length=1, max_length=200)
    customer_phone: str = Field(min_length=5, max_length=30)
    covers: int = Field(default=2, ge=1)
    reserved_from: str = Field(min_length=1, max_length=50)
    reserved_to: str | None = Field(default=None, max_length=50)
    notes: str | None = None
    occasion: str | None = Field(default=None, max_length=100)
    deposit_amount: float = Field(default=0, ge=0)


class ReservationUpdate(BaseModel):
    table_id: uuid.UUID | None = None
    customer_name: str | None = Field(default=None, max_length=200)
    customer_phone: str | None = Field(default=None, max_length=30)
    covers: int | None = Field(default=None, ge=1)
    reserved_from: str | None = Field(default=None, max_length=50)
    reserved_to: str | None = Field(default=None, max_length=50)
    notes: str | None = None
    occasion: str | None = Field(default=None, max_length=100)
    deposit_amount: float | None = Field(default=None, ge=0)


class ReservationStatusUpdate(BaseModel):
    status: ReservationStatus


class ReservationResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    table_id: uuid.UUID | None
    customer_id: uuid.UUID | None
    reservation_number: str | None
    customer_name: str
    customer_phone: str
    covers: int
    reserved_from: str
    reserved_to: str | None
    status: str
    notes: str | None
    occasion: str | None
    deposit_amount: float
    created_at: datetime


class SeatReservationRequest(BaseModel):
    """Seat a reservation — creates the order and marks the table occupied."""
    waiter_id: uuid.UUID | None = None


# ─── Waitlist ────────────────────────────────────────────────────

class WaitlistCreate(BaseModel):
    outlet_id: uuid.UUID
    customer_name: str = Field(min_length=1, max_length=200)
    customer_phone: str = Field(min_length=5, max_length=30)
    covers: int = Field(default=2, ge=1)
    quoted_wait_minutes: int | None = None


class WaitlistResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    customer_name: str
    customer_phone: str
    covers: int
    requested_at: str
    quoted_wait_minutes: int | None
    status: str
    created_at: datetime


class SeatWaitlistRequest(BaseModel):
    table_id: uuid.UUID
    waiter_id: uuid.UUID | None = None


OrderItemResponse.model_rebuild()
