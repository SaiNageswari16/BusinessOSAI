"""Reports service schemas (Pydantic v2)."""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


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
