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
from sqlalchemy.dialects.postgresql import JSONB, UUID
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


class ConsumedEvent(ServiceBase, TimestampMixin):
    """Durable idempotency ledger — one row per event this service consumed.

    Written by the bus's consumer loop via the installed dedupe ledger
    (``src.services.event_bus.dedupe``), so a redelivered event whose
    event_id is already here is skipped even after a process restart. The
    in-memory dedupe gate in ``EventBus`` alone is not restart-safe; this
    table closes that gap.

    ``event_id`` is the primary key — a redelivery with the same event_id
    is a no-op insert (``ON CONFLICT DO NOTHING``), which is exactly the
    check-then-mark primitive the dedupe helper needs.
    """

    __tablename__ = "consumed_events"

    event_id: Mapped[str] = mapped_column(
        String(64), primary_key=True
    )
    type: Mapped[str] = mapped_column(
        String(120), nullable=False, default="", index=True
    )
    consumed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
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


# ─── Stock, GST, purchase and P&L projections ───────────────────────────────
#
# Every model below is built from events alone — reports never reads another
# service's tables. The cross-service ids in this section are bare UUID
# columns with NO foreign key:
#   * item_id / inventory_item_id — inventory service
#   * grn_id, bill_id, vendor_id  — purchase service
#   * created_by                   — auth service

class CurrentStockProjection(ServiceBase, TimestampMixin):
    """Valued on-hand stock per item per outlet, from movements only.

    Built from ``stock.movement.created`` events — the inventory service is
    the one that owns the stock ledger, and reports only ever sees the
    movement it emits. ``on_hand`` is a running sum of movement quantities
    and can legitimately go negative if a movement is mis-posted: this is a
    projection, and a negative figure is exactly the signal a stock report
    should surface. ``value`` is the running cost basis, and ``unit_cost``
    is the moving average (value / on_hand on inbound movements; the last
    known average is kept on outbound ones, so a stock-out never zeroes the
    cost that the next purchase will average against).

    ``item_id`` is the inventory service's item, held as a bare UUID.
    """

    __tablename__ = "current_stock_projections"
    __table_args__ = (
        UniqueConstraint("tenant_id", "outlet_id", "item_id", name="uq_reports_current_stock"),
        Index("ix_reports_current_stock_outlet", "tenant_id", "outlet_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    # Snapshot of the item name at the time of the movement — the item may
    # be renamed later, and a stock report should say what it was called
    # when the stock moved.
    item_name: Mapped[str] = mapped_column(String(200), nullable=False, default="Unknown item")
    on_hand: Mapped[float] = mapped_column(Numeric(14, 3), default=0)
    unit_cost: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    value: Mapped[float] = mapped_column(Numeric(14, 2), default=0)


class DailyTaxSummary(ServiceBase, TimestampMixin):
    """The CGST / SGST / IGST split for one outlet day, from bill.paid.

    A settled bill's payload carries the split already computed by billing
    (``cgst_total`` / ``sgst_total`` / ``igst_total`` / ``cess_total``);
    this model is where that split lands so the GST report endpoint can
    answer "what is this month's CGST liability" without re-reading every
    bill. Projected by the same bill.paid consumer that writes the daily
    sales summary, so the two commit or roll back together.
    """

    __tablename__ = "daily_tax_summaries"
    __table_args__ = (
        UniqueConstraint("outlet_id", "summary_date", name="uq_reports_daily_tax"),
        Index("ix_reports_daily_tax_date", "tenant_id", "outlet_id", "summary_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    summary_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    cgst_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    sgst_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    igst_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    cess_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    tax_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0)


class DailyPurchaseSummary(ServiceBase, TimestampMixin):
    """Purchase spend for one outlet day, from GRN and vendor-bill events.

    Two additive sides, each kept separate on purpose: a GRN is goods that
    actually entered stock, and a vendor bill is money owed — they are not
    the same number (a bill can exist without a passed GRN, and a GRN can be
    posted before its bill is raised). Reporting them side by side is the
    purchase report; summing them into one figure would mix cost of goods
    with accounts payable and would not mean anything.

    ``grn.posted`` contributes ``grn_total`` (the received value, from the
    GRN's accepted lines) and ``vendor_bill.created`` contributes
    ``vendor_bill_total``.
    """

    __tablename__ = "daily_purchase_summaries"
    __table_args__ = (
        UniqueConstraint("outlet_id", "summary_date", name="uq_reports_daily_purchase"),
        Index("ix_reports_daily_purchase_date", "tenant_id", "outlet_id", "summary_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    summary_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    grn_count: Mapped[int] = mapped_column(Integer, default=0)
    grn_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    vendor_bill_count: Mapped[int] = mapped_column(Integer, default=0)
    vendor_bill_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0)


class DailyOpsSummary(ServiceBase, TimestampMixin):
    """Operational facts for one outlet day that no other read model holds.

    The finance + delivery + production topics project here: money out
    (operational expenses, owner withdrawals), deliveries finished,
    production runs completed, campaigns sent. Kept as one table with a
    column per fact (all additive counts/totals, all guarded by
    ``EventReference``) rather than five tables — the ops report reads
    them side by side, and a per-fact table would just be five round
    trips for one screen.
    """

    __tablename__ = "daily_ops_summaries"
    __table_args__ = (
        UniqueConstraint("outlet_id", "summary_date", name="uq_reports_daily_ops"),
        Index("ix_reports_daily_ops_date", "tenant_id", "outlet_id", "summary_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    summary_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    expense_count: Mapped[int] = mapped_column(Integer, default=0)
    expense_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    withdrawal_count: Mapped[int] = mapped_column(Integer, default=0)
    withdrawal_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    delivery_count: Mapped[int] = mapped_column(Integer, default=0)
    production_run_count: Mapped[int] = mapped_column(Integer, default=0)
    campaign_count: Mapped[int] = mapped_column(Integer, default=0)
    campaign_recipients_total: Mapped[int] = mapped_column(Integer, default=0)


class EventReference(ServiceBase, TimestampMixin):
    """Structural idempotency guard — one row per domain reference consumed.

    The durable ``consumed_events`` ledger in the consumer loop dedupes by
    ``event_id``, which stops a re-delivered copy of the same event. It does
    NOT stop a re-emitted event: the purchase service that passes a GRN a
    second time (rejected, re-passed) writes a fresh outbox row with a fresh
    ``event_id`` carrying the same ``grn_id``, and that passes the ledger
    and would double-count the day's purchase total. This table is the guard
    for that case — keyed on the domain reference, not the event — and it is
    written in the same transaction as the projection it protects, so the
    pair commits or rolls back together.

    The ledger is layer 1; this is layer 2, per the house rules.
    """

    __tablename__ = "event_references"
    __table_args__ = (
        UniqueConstraint("tenant_id", "ref_kind", "ref_id", name="uq_reports_event_reference"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    # e.g. "movement", "grn", "vendor_bill".
    ref_kind: Mapped[str] = mapped_column(String(40), nullable=False)
    ref_id: Mapped[str] = mapped_column(String(64), nullable=False)


class ReportDefinition(ServiceBase, TimestampMixin):
    """A saved report: tenant-owned, with a metric and a filter blob.

    ``metric`` and ``filters`` are JSONB on purpose — the vocabulary of
    supported metrics lives in the service layer (``run_report_definition``
    dispatches on it), not in the schema, so a new metric type never needs a
    migration. A definition whose metric is unknown runs into a structured
    "unsupported" result, not an error: saving a report must never break
    running one.

    ``created_by`` is a bare UUID into the auth service.
    """

    __tablename__ = "report_definitions"
    __table_args__ = (
        Index("ix_reports_definitions_tenant", "tenant_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # Which module the report belongs to, for the UI's grouping. Free-form on
    # purpose — "sales", "stock", "purchase", "kitchen" — the metric blob is
    # what actually drives the run.
    module: Mapped[str] = mapped_column(String(50), nullable=False, default="sales")
    metric: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    filters: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
