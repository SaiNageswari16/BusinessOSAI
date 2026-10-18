"""Reports service models — Read-model projections and analytics summaries.

Owns ``restaurantos_reports``. Zero foreign keys cross service boundaries:
  * ``outlet_id`` — organization service
  * ``menu_item_id`` — menu service
  * ``station_id`` — kitchen service
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    Date,
    DateTime,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.services.shared.service_db import service_base

ServiceBase = service_base("reports")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )


class DailySalesSummary(ServiceBase, TimestampMixin):
    __tablename__ = "daily_sales_summaries"
    __table_args__ = (
        UniqueConstraint("outlet_id", "summary_date", name="uq_reports_daily_sales"),
        Index("ix_reports_daily_sales_date", "tenant_id", "outlet_id", "summary_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    summary_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    total_sales: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    net_sales: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_tax: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_discount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_orders: Mapped[int] = mapped_column(Integer, default=0)
    total_covers: Mapped[int] = mapped_column(Integer, default=0)
    avg_order_value: Mapped[float] = mapped_column(Numeric(14, 2), default=0)

    cash_sales: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    card_sales: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    upi_sales: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    wallet_sales: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    aggregator_sales: Mapped[float] = mapped_column(Numeric(14, 2), default=0)


class HourlySalesSummary(ServiceBase, TimestampMixin):
    __tablename__ = "hourly_sales_summaries"
    __table_args__ = (
        UniqueConstraint("outlet_id", "summary_date", "hour_of_day", name="uq_reports_hourly_sales"),
        Index("ix_reports_hourly_sales_date", "tenant_id", "outlet_id", "summary_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    summary_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    hour_of_day: Mapped[int] = mapped_column(Integer, nullable=False)  # 0 to 23

    order_count: Mapped[int] = mapped_column(Integer, default=0)
    total_sales: Mapped[float] = mapped_column(Numeric(14, 2), default=0)


class ItemSalesSummary(ServiceBase, TimestampMixin):
    __tablename__ = "item_sales_summaries"
    __table_args__ = (
        UniqueConstraint("outlet_id", "summary_date", "menu_item_id", name="uq_reports_item_sales"),
        Index("ix_reports_item_sales_date", "tenant_id", "outlet_id", "summary_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    summary_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    menu_item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    category_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    qty_sold: Mapped[int] = mapped_column(Integer, default=0)
    revenue: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    cost: Mapped[float] = mapped_column(Numeric(14, 2), default=0)


class KitchenPerformanceSummary(ServiceBase, TimestampMixin):
    __tablename__ = "kitchen_performance_summaries"
    __table_args__ = (
        UniqueConstraint("outlet_id", "summary_date", "station_id", name="uq_reports_kitchen_perf"),
        Index("ix_reports_kitchen_perf_date", "tenant_id", "outlet_id", "summary_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    summary_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    station_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    station_name: Mapped[str] = mapped_column(String(100), nullable=False)

    tickets_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_prep_time_minutes: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    delayed_tickets_count: Mapped[int] = mapped_column(Integer, default=0)
