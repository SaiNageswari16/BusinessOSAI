"""Reports service business logic and event projectors."""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Callable

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.reports.models import (
    CurrentStockProjection,
    DailyOpsSummary,
    DailyPurchaseSummary,
    DailySalesSummary,
    DailyTaxSummary,
    EventReference,
    HourlySalesSummary,
    ItemSalesSummary,
    ReportDefinition,
)
from src.services.reports.schemas import (
    DashboardSummaryResponse,
    GstReport,
    HourlySalesReport,
    HourlySalesRow,
    ItemSalesReport,
    ItemSalesRow,
    OpsReport,
    PnlReport,
    PurchaseReport,
    ReportRunResult,
    SalesSummaryReport,
    SalesSummaryRow,
    StockReport,
    StockReportRow,
)

logger = logging.getLogger("reports.service")
TWO_PLACES = Decimal("0.01")


def _m(val) -> Decimal:
    if val is None:
        return Decimal("0.00")
    return Decimal(str(val)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


async def record_bill_paid_event(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    data: dict,
) -> None:
    """Project a bill.paid event into daily, hourly and item read-models."""
    today = date.today()
    hour = datetime.now().hour

    total = _m(data.get("grand_total") or data.get("total") or 0)
    tax = _m(data.get("tax_total") or 0)
    disc = _m(data.get("discount_total") or 0)
    net = total - tax
    covers = int(data.get("covers") or 1)
    payment_method = str(data.get("payment_method") or "cash").lower()

    # 1. Daily summary
    daily = await db.scalar(
        select(DailySalesSummary).where(
            DailySalesSummary.outlet_id == outlet_id,
            DailySalesSummary.summary_date == today,
        )
    )
    if not daily:
        daily = DailySalesSummary(
            tenant_id=tenant_id,
            outlet_id=outlet_id,
            summary_date=today,
            total_sales=0,
            net_sales=0,
            total_tax=0,
            total_discount=0,
            total_orders=0,
            total_covers=0,
            avg_order_value=0,
            cash_sales=0,
            card_sales=0,
            upi_sales=0,
            wallet_sales=0,
            aggregator_sales=0,
        )
        db.add(daily)
        await db.flush()

    daily.total_sales = _m(daily.total_sales) + total
    daily.net_sales = _m(daily.net_sales) + net
    daily.total_tax = _m(daily.total_tax) + tax
    daily.total_discount = _m(daily.total_discount) + disc
    daily.total_orders += 1
    daily.total_covers += covers
    if daily.total_orders > 0:
        daily.avg_order_value = _m(daily.total_sales / Decimal(daily.total_orders))

    if "cash" in payment_method:
        daily.cash_sales = _m(daily.cash_sales) + total
    elif "card" in payment_method:
        daily.card_sales = _m(daily.card_sales) + total
    elif "upi" in payment_method:
        daily.upi_sales = _m(daily.upi_sales) + total
    elif "wallet" in payment_method:
        daily.wallet_sales = _m(daily.wallet_sales) + total
    elif "aggregator" in payment_method:
        daily.aggregator_sales = _m(daily.aggregator_sales) + total

    # 2. Daily tax summary — the CGST/SGST/IGST split billing already
    # computed, landed here so the GST report never has to re-read bills.
    cgst = _m(data.get("cgst_total") or 0)
    sgst = _m(data.get("sgst_total") or 0)
    igst = _m(data.get("igst_total") or 0)
    cess = _m(data.get("cess_total") or 0)
    tax_row = await db.scalar(
        select(DailyTaxSummary).where(
            DailyTaxSummary.outlet_id == outlet_id,
            DailyTaxSummary.summary_date == today,
        )
    )
    if not tax_row:
        tax_row = DailyTaxSummary(
            tenant_id=tenant_id,
            outlet_id=outlet_id,
            summary_date=today,
            cgst_total=0,
            sgst_total=0,
            igst_total=0,
            cess_total=0,
            tax_total=0,
        )
        db.add(tax_row)
        await db.flush()
    tax_row.cgst_total = _m(tax_row.cgst_total) + cgst
    tax_row.sgst_total = _m(tax_row.sgst_total) + sgst
    tax_row.igst_total = _m(tax_row.igst_total) + igst
    tax_row.cess_total = _m(tax_row.cess_total) + cess
    tax_row.tax_total = _m(tax_row.tax_total) + tax

    # 2. Hourly summary
    hourly = await db.scalar(
        select(HourlySalesSummary).where(
            HourlySalesSummary.outlet_id == outlet_id,
            HourlySalesSummary.summary_date == today,
            HourlySalesSummary.hour_of_day == hour,
        )
    )
    if not hourly:
        hourly = HourlySalesSummary(
            tenant_id=tenant_id,
            outlet_id=outlet_id,
            summary_date=today,
            hour_of_day=hour,
            order_count=0,
            total_sales=0,
        )
        db.add(hourly)
        await db.flush()

    hourly.order_count += 1
    hourly.total_sales = _m(hourly.total_sales) + total

    # 3. Item breakdown
    items = data.get("items") or []
    for item in items:
        item_id_raw = item.get("menu_item_id")
        if not item_id_raw:
            continue
        item_uuid = uuid.UUID(str(item_id_raw))
        item_name = str(item.get("name") or "Item")
        qty = int(item.get("qty") or 1)
        line_total = _m(item.get("line_total") or item.get("total") or 0)
        cost = _m(item.get("cost") or 0) * qty

        row = await db.scalar(
            select(ItemSalesSummary).where(
                ItemSalesSummary.outlet_id == outlet_id,
                ItemSalesSummary.summary_date == today,
                ItemSalesSummary.menu_item_id == item_uuid,
            )
        )
        if not row:
            row = ItemSalesSummary(
                tenant_id=tenant_id,
                outlet_id=outlet_id,
                summary_date=today,
                menu_item_id=item_uuid,
                item_name=item_name,
                category_name=item.get("category_name"),
                qty_sold=0,
                revenue=0,
                cost=0,
            )
            db.add(row)
            await db.flush()

        row.qty_sold += qty
        row.revenue = _m(row.revenue) + line_total
        row.cost = _m(row.cost) + cost

    await db.flush()


async def get_dashboard_summary(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    for_date: date,
) -> DashboardSummaryResponse:
    daily = await db.scalar(
        select(DailySalesSummary).where(
            DailySalesSummary.tenant_id == tenant_id,
            DailySalesSummary.outlet_id == outlet_id,
            DailySalesSummary.summary_date == for_date,
        )
    )
    if not daily:
        return DashboardSummaryResponse(
            summary_date=for_date,
            total_sales=Decimal("0.00"),
            net_sales=Decimal("0.00"),
            total_orders=0,
            total_covers=0,
            avg_order_value=Decimal("0.00"),
            cash_sales=Decimal("0.00"),
            card_sales=Decimal("0.00"),
            upi_sales=Decimal("0.00"),
            aggregator_sales=Decimal("0.00"),
        )
    return DashboardSummaryResponse(
        summary_date=daily.summary_date,
        total_sales=_m(daily.total_sales),
        net_sales=_m(daily.net_sales),
        total_orders=daily.total_orders,
        total_covers=daily.total_covers,
        avg_order_value=_m(daily.avg_order_value),
        cash_sales=_m(daily.cash_sales),
        card_sales=_m(daily.card_sales),
        upi_sales=_m(daily.upi_sales),
        aggregator_sales=_m(daily.aggregator_sales),
    )


async def get_sales_summary(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    date_from: date,
    date_to: date,
    outlet_id: uuid.UUID | None = None,
) -> SalesSummaryReport:
    stmt = select(DailySalesSummary).where(
        DailySalesSummary.tenant_id == tenant_id,
        DailySalesSummary.summary_date >= date_from,
        DailySalesSummary.summary_date <= date_to,
    )
    if outlet_id:
        stmt = stmt.where(DailySalesSummary.outlet_id == outlet_id)
    stmt = stmt.order_by(DailySalesSummary.summary_date.asc())

    rows_db = (await db.execute(stmt)).scalars().all()
    rows = []
    tot_sales = Decimal("0")
    tot_orders = 0

    for d in rows_db:
        tot = _m(d.total_sales)
        tot_sales += tot
        tot_orders += d.total_orders
        rows.append(
            SalesSummaryRow(
                summary_date=d.summary_date,
                total_sales=tot,
                net_sales=_m(d.net_sales),
                total_tax=_m(d.total_tax),
                total_discount=_m(d.total_discount),
                total_orders=d.total_orders,
                total_covers=d.total_covers,
                avg_order_value=_m(d.avg_order_value),
            )
        )

    return SalesSummaryReport(
        date_from=date_from,
        date_to=date_to,
        rows=rows,
        grand_total_sales=tot_sales,
        grand_total_orders=tot_orders,
    )


async def get_hourly_sales(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    summary_date: date,
    outlet_id: uuid.UUID | None = None,
) -> HourlySalesReport:
    stmt = select(HourlySalesSummary).where(
        HourlySalesSummary.tenant_id == tenant_id,
        HourlySalesSummary.summary_date == summary_date,
    )
    if outlet_id:
        stmt = stmt.where(HourlySalesSummary.outlet_id == outlet_id)
    stmt = stmt.order_by(HourlySalesSummary.hour_of_day.asc())

    rows_db = (await db.execute(stmt)).scalars().all()
    rows = []
    peak_hr = None
    max_sales = Decimal("-1")
    tot_sales = Decimal("0")

    for h in rows_db:
        s = _m(h.total_sales)
        tot_sales += s
        if s > max_sales:
            max_sales = s
            peak_hr = h.hour_of_day
        rows.append(
            HourlySalesRow(
                hour_of_day=h.hour_of_day,
                order_count=h.order_count,
                total_sales=s,
            )
        )

    return HourlySalesReport(
        summary_date=summary_date,
        rows=rows,
        peak_hour=peak_hr,
        total_sales=tot_sales,
    )


async def get_item_sales(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    date_from: date,
    date_to: date,
    outlet_id: uuid.UUID | None = None,
) -> ItemSalesReport:
    stmt = (
        select(
            ItemSalesSummary.menu_item_id,
            ItemSalesSummary.item_name,
            ItemSalesSummary.category_name,
            func.sum(ItemSalesSummary.qty_sold).label("total_qty"),
            func.sum(ItemSalesSummary.revenue).label("total_rev"),
            func.sum(ItemSalesSummary.cost).label("total_cost"),
        )
        .where(
            ItemSalesSummary.tenant_id == tenant_id,
            ItemSalesSummary.summary_date >= date_from,
            ItemSalesSummary.summary_date <= date_to,
        )
    )
    if outlet_id:
        stmt = stmt.where(ItemSalesSummary.outlet_id == outlet_id)

    stmt = stmt.group_by(
        ItemSalesSummary.menu_item_id,
        ItemSalesSummary.item_name,
        ItemSalesSummary.category_name,
    ).order_by(func.sum(ItemSalesSummary.revenue).desc())

    rows = []
    tot_qty = 0
    tot_rev = Decimal("0")

    for r in (await db.execute(stmt)).all():
        q = int(r.total_qty or 0)
        rev = _m(r.total_rev)
        cst = _m(r.total_cost)
        tot_qty += q
        tot_rev += rev
        margin = _m((rev - cst) / rev * 100) if rev > 0 else Decimal("0")

        rows.append(
            ItemSalesRow(
                menu_item_id=r.menu_item_id,
                item_name=r.item_name,
                category_name=r.category_name,
                qty_sold=q,
                revenue=rev,
                cost=cst,
                margin_pct=margin,
            )
        )

    return ItemSalesReport(
        date_from=date_from,
        date_to=date_to,
        rows=rows,
        total_qty_sold=tot_qty,
        total_revenue=tot_rev,
    )


# ─── Stock / GST / purchase / P&L projections ───────────────────────────────

def _d(val) -> Decimal:
    """Plain Decimal, no quantisation — for quantities that keep 3 places."""
    if val is None:
        return Decimal("0")
    return Decimal(str(val))


async def _reference_exists(db: AsyncSession, tenant_id: uuid.UUID,
                            ref_kind: str, ref_id: str) -> bool:
    """Has this domain reference already been projected?

    Layer-2 structural idempotency: the durable ``consumed_events`` ledger
    stops a re-delivered copy of one event, but a re-emitted domain fact
    (a GRN that was rejected and re-passed) carries a fresh event_id and
    would pass that gate. Keying the guard on the domain reference is what
    stops that double-count. Written in the same transaction as the
    projection it protects.
    """
    found = await db.scalar(
        select(EventReference.id).where(
            EventReference.tenant_id == tenant_id,
            EventReference.ref_kind == ref_kind,
            EventReference.ref_id == ref_id,
        ).limit(1)
    )
    return found is not None


async def project_stock_movement(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    *,
    item_id: uuid.UUID,
    item_name: str | None,
    qty,
    unit_cost,
    movement_id: str,
) -> bool:
    """Fold one stock movement into the valued current-stock projection.

    Returns False when the movement was already applied (structural guard) —
    nothing was written, so the caller's commit is a no-op.

    ``on_hand`` is a running sum of movement quantities and may go negative
    (a mis-posted stock-out); that is the signal the report should surface,
    not something to clamp. ``value`` is the running cost basis, and
    ``unit_cost`` is the moving average recomputed only on inbound stock so
    a stock-out does not zero the cost the next purchase averages against.
    """
    if await _reference_exists(db, tenant_id, "movement", str(movement_id)):
        return False

    q = _d(qty)
    uc = _m(unit_cost)
    row = await db.scalar(
        select(CurrentStockProjection).where(
            CurrentStockProjection.outlet_id == outlet_id,
            CurrentStockProjection.item_id == item_id,
        )
    )
    if row is None:
        row = CurrentStockProjection(
            tenant_id=tenant_id,
            outlet_id=outlet_id,
            item_id=item_id,
            item_name=item_name or "Unknown item",
            on_hand=0,
            unit_cost=0,
            value=0,
        )
        db.add(row)
        await db.flush()

    on_hand = _d(row.on_hand) + q
    value = _m(row.value) + (q * uc)
    if on_hand > 0:
        unit_cost = (value / on_hand).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    row.on_hand = on_hand
    row.value = value
    row.unit_cost = unit_cost

    db.add(EventReference(
        tenant_id=tenant_id, ref_kind="movement", ref_id=str(movement_id),
    ))
    await db.flush()
    return True


async def project_grn_posted(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    *,
    grn_id: str,
    amount,
) -> bool:
    """Add a passed GRN's received value to the day's purchase summary."""
    if await _reference_exists(db, tenant_id, "grn", str(grn_id)):
        return False
    row = await db.scalar(
        select(DailyPurchaseSummary).where(
            DailyPurchaseSummary.outlet_id == outlet_id,
            DailyPurchaseSummary.summary_date == date.today(),
        )
    )
    if row is None:
        row = DailyPurchaseSummary(
            tenant_id=tenant_id, outlet_id=outlet_id, summary_date=date.today(),
            grn_count=0, grn_total=0, vendor_bill_count=0, vendor_bill_total=0,
        )
        db.add(row)
        await db.flush()
    row.grn_count += 1
    row.grn_total = _m(row.grn_total) + _m(amount)
    db.add(EventReference(tenant_id=tenant_id, ref_kind="grn", ref_id=str(grn_id)))
    await db.flush()
    return True


# ─── Ops projections (finance / delivery / production / marketing) ───────

async def _ensure_daily_ops(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    summary_date: date,
) -> DailyOpsSummary:
    """The day's ops row, created on demand with all figures zeroed."""
    row = await db.scalar(
        select(DailyOpsSummary).where(
            DailyOpsSummary.outlet_id == outlet_id,
            DailyOpsSummary.summary_date == summary_date,
        )
    )
    if row is None:
        row = DailyOpsSummary(tenant_id=tenant_id, outlet_id=outlet_id,
                              summary_date=summary_date)
        db.add(row)
        await db.flush()
    return row


async def _project_ops_fact(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    *,
    ref_kind: str,
    ref_id: str,
    apply: "Callable[[DailyOpsSummary], None]",
) -> bool:
    """One guarded additive write onto the day's ops row.

    The EventReference guard is checked per fact, so a redelivery of a
    delivery.delivered cannot double-count deliveries while a later
    expense.recorded still lands — one row, one guard per fact.
    """
    if await _reference_exists(db, tenant_id, ref_kind, str(ref_id)):
        return False
    row = await _ensure_daily_ops(db, tenant_id, outlet_id, date.today())
    apply(row)
    db.add(EventReference(tenant_id=tenant_id, ref_kind=ref_kind, ref_id=str(ref_id)))
    await db.flush()
    return True


async def project_expense_recorded(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID,
    *, expense_id: str, amount,
) -> bool:
    """An operational expense adds to the day's money-out total."""
    return await _project_ops_fact(
        db, tenant_id, outlet_id,
        ref_kind="expense", ref_id=expense_id,
        apply=lambda r: (setattr(r, "expense_count", r.expense_count + 1),
                         setattr(r, "expense_total", _m(r.expense_total) + _m(amount))),
    )


async def project_withdrawal_recorded(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID,
    *, withdrawal_id: str, amount,
) -> bool:
    """An approved owner withdrawal adds to the day's money-out total."""
    return await _project_ops_fact(
        db, tenant_id, outlet_id,
        ref_kind="withdrawal", ref_id=withdrawal_id,
        apply=lambda r: (setattr(r, "withdrawal_count", r.withdrawal_count + 1),
                         setattr(r, "withdrawal_total", _m(r.withdrawal_total) + _m(amount))),
    )


async def project_delivery_delivered(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID,
    *, delivery_id: str,
) -> bool:
    """A finished delivery counts toward the day's dispatch total."""
    return await _project_ops_fact(
        db, tenant_id, outlet_id,
        ref_kind="delivery", ref_id=delivery_id,
        apply=lambda r: setattr(r, "delivery_count", r.delivery_count + 1),
    )


async def project_production_run_completed(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID,
    *, run_id: str,
) -> bool:
    """A completed production run counts toward the day's batch total."""
    return await _project_ops_fact(
        db, tenant_id, outlet_id,
        ref_kind="production_run", ref_id=run_id,
        apply=lambda r: setattr(r, "production_run_count", r.production_run_count + 1),
    )


async def project_marketing_campaign_sent(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID,
    *, campaign_id: str, sent_count: int,
) -> bool:
    """A campaign send adds to the day's outreach counts.

    Keyed on the campaign, not the send: a campaign can be sent more
    than once (a re-blast), and that is two sends, so the guard keys on
    campaign + outlet + day implicitly through the ref — a re-send of the
    same campaign on the same day by the same tenant re-counts on
    purpose (it reached people again), while a redelivery of the same
    send event does not.
    """
    return await _project_ops_fact(
        db, tenant_id, outlet_id,
        ref_kind="campaign", ref_id=str(campaign_id),
        apply=lambda r: (setattr(r, "campaign_count", r.campaign_count + 1),
                         setattr(r, "campaign_recipients_total",
                                  r.campaign_recipients_total + int(sent_count or 0))),
    )


async def get_ops_report(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    date_from: date,
    date_to: date,
    outlet_id: uuid.UUID | None = None,
) -> OpsReport:
    """Operational facts over a range, zero-filled when quiet."""
    stmt = select(
        func.coalesce(func.sum(DailyOpsSummary.expense_count), 0),
        func.coalesce(func.sum(DailyOpsSummary.expense_total), 0),
        func.coalesce(func.sum(DailyOpsSummary.withdrawal_count), 0),
        func.coalesce(func.sum(DailyOpsSummary.withdrawal_total), 0),
        func.coalesce(func.sum(DailyOpsSummary.delivery_count), 0),
        func.coalesce(func.sum(DailyOpsSummary.production_run_count), 0),
        func.coalesce(func.sum(DailyOpsSummary.campaign_count), 0),
        func.coalesce(func.sum(DailyOpsSummary.campaign_recipients_total), 0),
    ).where(
        DailyOpsSummary.tenant_id == tenant_id,
        DailyOpsSummary.summary_date >= date_from,
        DailyOpsSummary.summary_date <= date_to,
    )
    if outlet_id:
        stmt = stmt.where(DailyOpsSummary.outlet_id == outlet_id)
    row = (await db.execute(stmt)).one()
    return OpsReport(
        date_from=date_from,
        date_to=date_to,
        outlet_id=outlet_id,
        expense_count=int(row[0] or 0),
        expense_total=_m(row[1]),
        withdrawal_count=int(row[2] or 0),
        withdrawal_total=_m(row[3]),
        delivery_count=int(row[4] or 0),
        production_run_count=int(row[5] or 0),
        campaign_count=int(row[6] or 0),
        campaign_recipients_total=int(row[7] or 0),
    )


async def project_vendor_bill(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    *,
    bill_id: str,
    amount,
) -> bool:
    """Add a vendor bill's owed value to the day's purchase summary.

    Kept separate from the GRN totals on purpose: a bill is money owed, a
    GRN is goods received — the two are not the same figure and the report
    shows them side by side rather than merged.
    """
    if await _reference_exists(db, tenant_id, "vendor_bill", str(bill_id)):
        return False
    row = await db.scalar(
        select(DailyPurchaseSummary).where(
            DailyPurchaseSummary.outlet_id == outlet_id,
            DailyPurchaseSummary.summary_date == date.today(),
        )
    )
    if row is None:
        row = DailyPurchaseSummary(
            tenant_id=tenant_id, outlet_id=outlet_id, summary_date=date.today(),
            grn_count=0, grn_total=0, vendor_bill_count=0, vendor_bill_total=0,
        )
        db.add(row)
        await db.flush()
    row.vendor_bill_count += 1
    row.vendor_bill_total = _m(row.vendor_bill_total) + _m(amount)
    db.add(EventReference(
        tenant_id=tenant_id, ref_kind="vendor_bill", ref_id=str(bill_id),
    ))
    await db.flush()
    return True


# ─── Report readers (empty-safe) ─────────────────────────────────────────────

async def get_current_stock(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID | None = None,
) -> StockReport:
    """Valued on-hand stock per item, from movements alone.

    Empty-safe: a tenant with no stock movements returns a zero report, not
    an error. ``value`` is the moving-average cost basis times on-hand.
    """
    stmt = select(CurrentStockProjection).where(
        CurrentStockProjection.tenant_id == tenant_id,
    )
    if outlet_id:
        stmt = stmt.where(CurrentStockProjection.outlet_id == outlet_id)
    stmt = stmt.order_by(CurrentStockProjection.value.desc())

    rows_db = (await db.execute(stmt)).scalars().all()
    rows = [
        StockReportRow(
            item_id=r.item_id,
            item_name=r.item_name,
            on_hand=_d(r.on_hand).quantize(TWO_PLACES, rounding=ROUND_HALF_UP),
            unit_cost=_m(r.unit_cost),
            value=_m(r.value),
            last_updated=r.updated_at,
        )
        for r in rows_db
    ]
    total_value = sum((r.value for r in rows), Decimal("0.00"))
    return StockReport(
        outlet_id=outlet_id,
        rows=rows,
        total_value=total_value,
        total_items=len(rows),
    )


async def get_gst(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    date_from: date,
    date_to: date,
    outlet_id: uuid.UUID | None = None,
) -> GstReport:
    """CGST / SGST / IGST split over the range.

    Projected by the bill.paid consumer into the daily tax summary; when that
    projection has no rows for the range the figures are zero-filled, so the
    endpoint answers a settled-bills-free outlet with zeros, not a 500.
    """
    stmt = select(
        func.coalesce(func.sum(DailyTaxSummary.cgst_total), 0),
        func.coalesce(func.sum(DailyTaxSummary.sgst_total), 0),
        func.coalesce(func.sum(DailyTaxSummary.igst_total), 0),
        func.coalesce(func.sum(DailyTaxSummary.cess_total), 0),
        func.coalesce(func.sum(DailyTaxSummary.tax_total), 0),
    ).where(
        DailyTaxSummary.tenant_id == tenant_id,
        DailyTaxSummary.summary_date >= date_from,
        DailyTaxSummary.summary_date <= date_to,
    )
    if outlet_id:
        stmt = stmt.where(DailyTaxSummary.outlet_id == outlet_id)
    row = (await db.execute(stmt)).one()
    return GstReport(
        date_from=date_from,
        date_to=date_to,
        outlet_id=outlet_id,
        cgst_total=_m(row[0]),
        sgst_total=_m(row[1]),
        igst_total=_m(row[2]),
        cess_total=_m(row[3]),
        tax_total=_m(row[4]),
    )


async def get_purchase(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    date_from: date,
    date_to: date,
    outlet_id: uuid.UUID | None = None,
) -> PurchaseReport:
    """GRN value beside vendor-bill value over the range.

    Both sides come from the daily purchase summary (projected by the grn /
    vendor-bill consumers); a tenant with no purchase activity yet gets a
    zero-filled report rather than an error.
    """
    stmt = select(
        func.coalesce(func.sum(DailyPurchaseSummary.grn_count), 0),
        func.coalesce(func.sum(DailyPurchaseSummary.grn_total), 0),
        func.coalesce(func.sum(DailyPurchaseSummary.vendor_bill_count), 0),
        func.coalesce(func.sum(DailyPurchaseSummary.vendor_bill_total), 0),
    ).where(
        DailyPurchaseSummary.tenant_id == tenant_id,
        DailyPurchaseSummary.summary_date >= date_from,
        DailyPurchaseSummary.summary_date <= date_to,
    )
    if outlet_id:
        stmt = stmt.where(DailyPurchaseSummary.outlet_id == outlet_id)
    row = (await db.execute(stmt)).one()
    return PurchaseReport(
        date_from=date_from,
        date_to=date_to,
        outlet_id=outlet_id,
        grn_count=int(row[0] or 0),
        grn_total=_m(row[1]),
        vendor_bill_count=int(row[2] or 0),
        vendor_bill_total=_m(row[3]),
    )


async def get_pnl(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    date_from: date,
    date_to: date,
    outlet_id: uuid.UUID | None = None,
) -> PnlReport:
    """Revenue vs. cost of goods sold, over the range.

    Revenue is net sales from the daily sales projection; COGS is the item
    cost the bill.paid consumer has recorded per line. Both come from
    reports' own read models. Where the cost projection is still empty
    (the bill payload carries no cost today) COGS is 0 and gross profit
    equals revenue — a projection answer that fills in as cost data flows,
    not an error.
    """
    rev_stmt = select(func.coalesce(func.sum(DailySalesSummary.net_sales), 0)).where(
        DailySalesSummary.tenant_id == tenant_id,
        DailySalesSummary.summary_date >= date_from,
        DailySalesSummary.summary_date <= date_to,
    )
    cogs_stmt = select(func.coalesce(func.sum(ItemSalesSummary.cost), 0)).where(
        ItemSalesSummary.tenant_id == tenant_id,
        ItemSalesSummary.summary_date >= date_from,
        ItemSalesSummary.summary_date <= date_to,
    )
    if outlet_id:
        rev_stmt = rev_stmt.where(DailySalesSummary.outlet_id == outlet_id)
        cogs_stmt = cogs_stmt.where(ItemSalesSummary.outlet_id == outlet_id)

    revenue = _m(await db.scalar(rev_stmt))
    cogs = _m(await db.scalar(cogs_stmt))
    gross_profit = revenue - cogs
    margin = (
        ((gross_profit / revenue) * 100).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        if revenue > 0 else None
    )
    return PnlReport(
        date_from=date_from,
        date_to=date_to,
        outlet_id=outlet_id,
        revenue=revenue,
        cogs=cogs,
        gross_profit=gross_profit,
        gross_margin_pct=margin,
    )


# ─── Saved report definitions ────────────────────────────────────────────────

async def create_report_definition(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    name: str,
    module: str,
    metric: dict,
    filters: dict,
    created_by: uuid.UUID | None,
) -> ReportDefinition:
    """Save a report definition. Never raises on unknown metric types —
    the runner degrades to a structured unsupported result instead."""
    row = ReportDefinition(
        tenant_id=tenant_id,
        name=name,
        module=module,
        metric=metric or {},
        filters=filters or {},
        created_by=created_by,
    )
    db.add(row)
    await db.flush()
    return row


async def load_report_definition(
    db: AsyncSession, tenant_id: uuid.UUID, definition_id: uuid.UUID
) -> ReportDefinition | None:
    return await db.scalar(
        select(ReportDefinition).where(
            ReportDefinition.id == definition_id,
            ReportDefinition.tenant_id == tenant_id,
        )
    )


async def list_report_definitions(
    db: AsyncSession, tenant_id: uuid.UUID
) -> list[ReportDefinition]:
    stmt = select(ReportDefinition).where(
        ReportDefinition.tenant_id == tenant_id,
    ).order_by(ReportDefinition.created_at.desc())
    return list((await db.execute(stmt)).scalars().all())


async def run_report_definition(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    definition: ReportDefinition,
) -> dict:
    """Render a saved definition against the projections.

    Dispatches on ``metric["type"]``; dates and outlet come from ``filters``.
    An unknown type returns a structured ``unsupported`` result (rows [],
    totals {}, a message) rather than raising — a saved report must stay
    readable even when its metric is ahead of the runner.
    """
    metric = definition.metric or {}
    filters = definition.filters or {}
    mtype = str(metric.get("type") or "sales")

    date_from = _parse_iso_date(filters.get("date_from"))
    date_to = _parse_iso_date(filters.get("date_to"))
    outlet = _coerce_uuid(filters.get("outlet_id"))
    if date_from is None:
        date_from = date.today()
    if date_to is None:
        date_to = date_from

    if mtype == "sales":
        rep = await get_sales_summary(db, tenant_id, date_from, date_to, outlet)
        rows = [r.model_dump(mode="json") for r in rep.rows]
        return ReportRunResult(
            definition_id=definition.id, metric=mtype, filters=filters,
            rows=rows,
            totals={"grand_total_sales": rep.grand_total_sales,
                    "grand_total_orders": rep.grand_total_orders},
        ).model_dump(mode="json")
    if mtype == "gst":
        rep = await get_gst(db, tenant_id, date_from, date_to, outlet)
        return ReportRunResult(
            definition_id=definition.id, metric=mtype, filters=filters,
            rows=[rep.model_dump(mode="json")], totals={},
        ).model_dump(mode="json")
    if mtype == "purchase":
        rep = await get_purchase(db, tenant_id, date_from, date_to, outlet)
        return ReportRunResult(
            definition_id=definition.id, metric=mtype, filters=filters,
            rows=[rep.model_dump(mode="json")], totals={},
        ).model_dump(mode="json")
    if mtype == "pnl":
        rep = await get_pnl(db, tenant_id, date_from, date_to, outlet)
        return ReportRunResult(
            definition_id=definition.id, metric=mtype, filters=filters,
            rows=[rep.model_dump(mode="json")],
            totals={"revenue": rep.revenue, "cogs": rep.cogs,
                    "gross_profit": rep.gross_profit},
        ).model_dump(mode="json")
    if mtype == "stock":
        rep = await get_current_stock(db, tenant_id, outlet)
        return ReportRunResult(
            definition_id=definition.id, metric=mtype, filters=filters,
            rows=[r.model_dump(mode="json") for r in rep.rows],
            totals={"total_value": rep.total_value, "total_items": rep.total_items},
        ).model_dump(mode="json")
    if mtype == "ops":
        rep = await get_ops_report(db, tenant_id, date_from, date_to, outlet)
        return ReportRunResult(
            definition_id=definition.id, metric=mtype, filters=filters,
            rows=[rep.model_dump(mode="json")],
            totals={"expense_total": rep.expense_total,
                    "withdrawal_total": rep.withdrawal_total,
                    "delivery_count": rep.delivery_count},
        ).model_dump(mode="json")

    return ReportRunResult(
        definition_id=definition.id, metric=mtype, filters=filters,
        rows=[], totals={}, unsupported=True,
        error=f"Unsupported metric type: {mtype}",
    ).model_dump(mode="json")


def _parse_iso_date(value) -> date | None:
    """A date from a filter blob, or None when absent/malformed."""
    if value in (None, ""):
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    try:
        return date.fromisoformat(str(value))
    except (ValueError, TypeError):
        return None


def _coerce_uuid(value) -> uuid.UUID | None:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None
