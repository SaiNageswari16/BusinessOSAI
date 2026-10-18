"""Reports service business logic and event projectors."""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.reports.models import (
    DailySalesSummary,
    HourlySalesSummary,
    ItemSalesSummary,
    KitchenPerformanceSummary,
)
from src.services.reports.schemas import (
    DashboardSummaryResponse,
    HourlySalesReport,
    HourlySalesRow,
    ItemSalesReport,
    ItemSalesRow,
    KitchenPerformanceReport,
    KitchenPerformanceRow,
    SalesSummaryReport,
    SalesSummaryRow,
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
