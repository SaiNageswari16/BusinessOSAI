"""Reports service schemas (Pydantic v2)."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class DashboardSummaryResponse(BaseModel):
    summary_date: date
    total_sales: Decimal
    net_sales: Decimal
    total_orders: int
    total_covers: int
    avg_order_value: Decimal
    cash_sales: Decimal
    card_sales: Decimal
    upi_sales: Decimal
    aggregator_sales: Decimal


class SalesSummaryRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    summary_date: date
    total_sales: Decimal
    net_sales: Decimal
    total_tax: Decimal
    total_discount: Decimal
    total_orders: int
    total_covers: int
    avg_order_value: Decimal


class SalesSummaryReport(BaseModel):
    date_from: date
    date_to: date
    rows: list[SalesSummaryRow]
    grand_total_sales: Decimal
    grand_total_orders: int


class HourlySalesRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hour_of_day: int
    order_count: int
    total_sales: Decimal


class HourlySalesReport(BaseModel):
    summary_date: date
    rows: list[HourlySalesRow]
    peak_hour: int | None
    total_sales: Decimal


class ItemSalesRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    menu_item_id: uuid.UUID
    item_name: str
    category_name: str | None
    qty_sold: int
    revenue: Decimal
    cost: Decimal
    margin_pct: Decimal = Decimal("0")


class ItemSalesReport(BaseModel):
    date_from: date
    date_to: date
    rows: list[ItemSalesRow]
    total_qty_sold: int
    total_revenue: Decimal


class KitchenPerformanceRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    station_id: uuid.UUID
    station_name: str
    tickets_count: int
    avg_prep_time_minutes: Decimal
    delayed_tickets_count: int


class KitchenPerformanceReport(BaseModel):
    date_from: date
    date_to: date
    rows: list[KitchenPerformanceRow]
    total_tickets: int


# ─── Stock / GST / purchase / P&L / custom reports ──────────────────────────

class StockReportRow(BaseModel):
    """One item's valued stock position at an outlet."""

    item_id: uuid.UUID
    item_name: str
    on_hand: Decimal
    unit_cost: Decimal
    value: Decimal
    last_updated: datetime


class StockReport(BaseModel):
    outlet_id: uuid.UUID | None
    rows: list[StockReportRow]
    total_value: Decimal
    total_items: int
    """Zero, not an error, when the tenant has no stock movements yet."""


class GstReport(BaseModel):
    """The GST split for a date range.

    Projected from the bill.paid consumer's daily tax summary when it exists;
    every figure is zero-filled otherwise, so the endpoint never 500s on an
    outlet that has not settled a bill.
    """

    date_from: date
    date_to: date
    outlet_id: uuid.UUID | None
    cgst_total: Decimal
    sgst_total: Decimal
    igst_total: Decimal
    cess_total: Decimal
    tax_total: Decimal


class PurchaseReport(BaseModel):
    """GRN value (goods actually received) beside vendor-bill value (money
    owed), kept separate on purpose. Zero-filled when no purchase activity
    has been projected yet."""

    date_from: date
    date_to: date
    outlet_id: uuid.UUID | None
    grn_count: int
    grn_total: Decimal
    vendor_bill_count: int
    vendor_bill_total: Decimal


class PnlReport(BaseModel):
    """Revenue versus cost of goods sold, over a range.

    Revenue is net sales from the daily sales projection; COGS is the item
    cost snapshot the bill.paid consumer has already recorded per item. Both
    sides come from reports' own read models — no cross-service reads.
    """

    date_from: date
    date_to: date
    outlet_id: uuid.UUID | None
    revenue: Decimal
    cogs: Decimal
    gross_profit: Decimal
    gross_margin_pct: Decimal | None
    """None when revenue is zero — a margin over zero revenue is not a number."""


class OpsReport(BaseModel):
    """Operational facts over a range: money out, deliveries, production, campaigns.

    Every figure comes from reports' own daily-ops projection (the finance /
    delivery / production / marketing event consumers); a quiet tenant gets a
    zero-filled report rather than an error, matching the other readers.
    """

    date_from: date
    date_to: date
    outlet_id: uuid.UUID | None
    expense_count: int
    expense_total: Decimal
    withdrawal_count: int
    withdrawal_total: Decimal
    delivery_count: int
    production_run_count: int
    campaign_count: int
    campaign_recipients_total: int


class ReportDefinitionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    module: str = Field(default="sales", max_length=50)
    metric: dict = Field(default_factory=dict)
    """The metric's parameters, free-form: the runner dispatches on
    ``metric["type"]`` and the rest are its arguments (date range, outlet)."""
    filters: dict = Field(default_factory=dict)


class ReportDefinitionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    module: str
    metric: dict
    filters: dict
    created_by: uuid.UUID | None
    created_at: datetime


class ReportRunResult(BaseModel):
    """The rendered form of a saved report definition.

    ``unsupported`` is the structured answer to a definition whose metric
    type the runner does not know: the run fails gracefully with a zero-
    shaped result, never a 500 — a saved report must be readable even when
    the metric is ahead of the runner."""

    definition_id: uuid.UUID
    metric: str
    filters: dict
    rows: list[dict]
    totals: dict
    unsupported: bool = False
    error: str | None = None
