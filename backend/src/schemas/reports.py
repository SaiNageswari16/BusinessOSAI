"""Reports & analytics schemas."""
import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SalesSummary(BaseModel):
    outlet_id: uuid.UUID
    date_from: date
    date_to: date
    gross_sales: Decimal = 0
    net_sales: Decimal = 0
    total_discount: Decimal = 0
    total_tax: Decimal = 0
    total_service_charge: Decimal = 0
    total_tips: Decimal = 0
    total_round_off: Decimal = 0
    total_orders: int = 0
    total_covers: int = 0
    avg_ticket: Decimal = 0
    cash_sales: Decimal = 0
    card_sales: Decimal = 0
    upi_sales: Decimal = 0
    wallet_sales: Decimal = 0
    credit_sales: Decimal = 0
    aggregator_sales: Decimal = 0
    online_sales: Decimal = 0


class ItemSalesRow(BaseModel):
    menu_item_id: uuid.UUID
    item_name: str
    category_name: str | None = None
    qty_sold: int = 0
    gross_amount: Decimal = 0
    net_amount: Decimal = 0
    discount_amount: Decimal = 0
    tax_amount: Decimal = 0
    first_sold_at: datetime | None = None
    last_sold_at: datetime | None = None


class ItemSalesReport(BaseModel):
    outlet_id: uuid.UUID
    date_from: date
    date_to: date
    rows: list[ItemSalesRow] = Field(default_factory=list)
    total_qty: int = 0
    total_net: Decimal = 0


class HourSalesRow(BaseModel):
    hour: int
    orders: int = 0
    covers: int = 0
    gross_amount: Decimal = 0
    net_amount: Decimal = 0


class HourSalesReport(BaseModel):
    outlet_id: uuid.UUID
    date_from: date
    date_to: date
    rows: list[HourSalesRow] = Field(default_factory=list)
    peak_hour: int | None = None


class CategorySalesRow(BaseModel):
    category_id: uuid.UUID | None
    category_name: str
    qty_sold: int = 0
    net_amount: Decimal = 0
    share_pct: Decimal = 0


class CategorySalesReport(BaseModel):
    outlet_id: uuid.UUID
    date_from: date
    date_to: date
    rows: list[CategorySalesRow] = Field(default_factory=list)
    total_net: Decimal = 0


class OutletSalesRow(BaseModel):
    outlet_id: uuid.UUID
    outlet_name: str
    outlet_code: str
    total_orders: int = 0
    total_covers: int = 0
    net_sales: Decimal = 0
    avg_ticket: Decimal = 0


class OutletSalesReport(BaseModel):
    date_from: date
    date_to: date
    rows: list[OutletSalesRow] = Field(default_factory=list)
    total_net: Decimal = 0


class WaiterSalesRow(BaseModel):
    waiter_id: uuid.UUID
    waiter_name: str
    total_orders: int = 0
    total_covers: int = 0
    net_sales: Decimal = 0
    avg_ticket: Decimal = 0
    total_tips: Decimal = 0


class WaiterSalesReport(BaseModel):
    outlet_id: uuid.UUID
    date_from: date
    date_to: date
    rows: list[WaiterSalesRow] = Field(default_factory=list)
    total_net: Decimal = 0


class KitchenPerformanceRow(BaseModel):
    station_id: uuid.UUID
    station_name: str
    tickets: int = 0
    items: int = 0
    cancelled_items: int = 0
    avg_prep_minutes: Decimal | None = None
    max_prep_minutes: Decimal | None = None


class KitchenPerformanceReport(BaseModel):
    outlet_id: uuid.UUID
    date_from: date
    date_to: date
    rows: list[KitchenPerformanceRow] = Field(default_factory=list)
    avg_prep_minutes: Decimal | None = None
    total_tickets: int = 0


class CustomerRfmRow(BaseModel):
    customer_id: uuid.UUID
    name: str
    phone: str
    recency_days: int | None = None
    frequency: int = 0
    monetary: Decimal = 0
    rfm_segment: str = "new"
    last_visit: datetime | None = None


class CustomerRfmReport(BaseModel):
    outlet_id: uuid.UUID
    date_from: date
    date_to: date
    rows: list[CustomerRfmRow] = Field(default_factory=list)


class PnlRow(BaseModel):
    account_type: str
    amount: Decimal = 0


class PnlReport(BaseModel):
    outlet_id: uuid.UUID
    date_from: date
    date_to: date
    rows: list[PnlRow] = Field(default_factory=list)
    total_revenue: Decimal = 0
    total_expense: Decimal = 0
    net_profit: Decimal = 0
    margin_pct: Decimal = 0


class ShiftBrief(BaseModel):
    shift_id: uuid.UUID
    shift_number: str
    opened_at: str | None
    opening_cash: float
    gross_sales: Decimal = 0


class DashboardSummary(BaseModel):
    outlet_id: uuid.UUID
    today_gross_sales: Decimal = 0
    today_net_sales: Decimal = 0
    today_orders: int = 0
    today_covers: int = 0
    today_avg_ticket: Decimal = 0
    active_orders: int = 0
    occupied_tables: int = 0
    total_tables: int = 0
    active_kots: int = 0
    pending_reservations: int = 0
    low_stock_items: int = 0
    open_shift: ShiftBrief | None = None
