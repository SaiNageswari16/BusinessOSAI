"""Reporting endpoints — sales, items, hours, staff, kitchen, RFM, P&L.

Every report is derived from settled bills and KOTs. Timestamps are stored as
ISO strings, so date filtering compares strings against `YYYY-MM-DD` bounds.
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission, resolve_outlet_id
from src.database.session import get_db
from src.models import (
    AccountType,
    Bill,
    BillItem,
    BillStatus,
    Customer,
    Employee,
    KOT,
    KOTItem,
    KOTItemStatus,
    KOTStatus,
    KitchenStation,
    MenuCategory,
    MenuItem,
    Order,
    OrderStatus,
    RestaurantTable,
    Shift,
    ShiftStatus,
    TableStatus,
    Tip,
)
from src.schemas.reports import (
    CategorySalesReport,
    CategorySalesRow,
    CustomerRfmReport,
    CustomerRfmRow,
    DashboardSummary,
    HourSalesReport,
    HourSalesRow,
    ItemSalesReport,
    ItemSalesRow,
    KitchenPerformanceReport,
    KitchenPerformanceRow,
    OutletSalesReport,
    OutletSalesRow,
    PnlReport,
    PnlRow,
    SalesSummary,
    ShiftBrief,
    WaiterSalesReport,
    WaiterSalesRow,
)
from src.services.kot_service import _status_value

router = APIRouter(prefix="/reports", tags=["Reports"])

TWO_PLACES = Decimal("0.01")


def _d(value) -> Decimal:
    return Decimal("0") if value is None else Decimal(str(value))


def _m(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _bounds(date_from: date, date_to: date) -> tuple[str, str]:
    """Inclusive ISO bounds for the window, matching how timestamps are stored."""
    return f"{date_from.isoformat()}T00:00:00", f"{date_to.isoformat()}T23:59:59"


async def _settled_bills(
    db: AsyncSession,
    ctx: CurrentUserContext,
    outlet_id: uuid.UUID | None,
    start: str,
    end: str,
    *,
    with_items: bool = False,
) -> list[Bill]:
    stmt = (
        select(Bill)
        .where(
            Bill.tenant_id == ctx.tenant_id,
            Bill.status == BillStatus.SETTLED,
            Bill.settled_at >= start,
            Bill.settled_at <= end,
        )
    )
    if outlet_id:
        stmt = stmt.where(Bill.outlet_id == outlet_id)
    if with_items:
        stmt = stmt.options(selectinload(Bill.items), selectinload(Bill.payments))

    return list((await db.execute(stmt)).scalars().all())


# ─── Dashboard ───────────────────────────────────────────────────

@router.get("/dashboard", response_model=DashboardSummary)
async def dashboard(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:reports"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
):
    """The manager's home screen — today's numbers plus what needs attention."""
    resolve_outlet_id(ctx, outlet_id)
    today = datetime.now(timezone.utc).date()
    start, end = _bounds(today, today)

    bills = await _settled_bills(db, ctx, outlet_id, start, end, with_items=True)

    gross = net = discount = Decimal("0")
    covers = 0
    for bill in bills:
        gross += _d(bill.grand_total)
        discount += _d(bill.discount_total)
        covers += int(bill.covers or 0)
    net = gross - discount

    active_orders = (
        await db.execute(
            select(func.count(Order.id)).where(
                Order.tenant_id == ctx.tenant_id,
                Order.outlet_id == outlet_id,
                Order.status.in_([
                    OrderStatus.PLACED, OrderStatus.IN_KITCHEN,
                    OrderStatus.PREPARING, OrderStatus.PARTIALLY_SERVED,
                ]),
            )
        )
    ).scalar() or 0

    active_kots = (
        await db.execute(
            select(func.count(KOT.id)).where(
                KOT.tenant_id == ctx.tenant_id,
                KOT.outlet_id == outlet_id,
                KOT.status.in_([
                    KOTStatus.PENDING, KOTStatus.ACKNOWLEDGED,
                    KOTStatus.PREPARING, KOTStatus.READY,
                ]),
            )
        )
    ).scalar() or 0

    total_tables = (
        await db.execute(
            select(func.count(RestaurantTable.id)).where(
                RestaurantTable.tenant_id == ctx.tenant_id,
                RestaurantTable.outlet_id == outlet_id,
            )
        )
    ).scalar() or 0

    occupied_tables = (
        await db.execute(
            select(func.count(RestaurantTable.id)).where(
                RestaurantTable.tenant_id == ctx.tenant_id,
                RestaurantTable.outlet_id == outlet_id,
                RestaurantTable.status == TableStatus.OCCUPIED,
            )
        )
    ).scalar() or 0

    # Items at or below reorder level
    from src.models import InventoryItem, InventoryStock
    low_stock = 0
    items = (
        await db.execute(
            select(InventoryItem)
            .options(selectinload(InventoryItem.stocks))
            .where(
                InventoryItem.tenant_id == ctx.tenant_id,
                InventoryItem.is_active.is_(True),
                InventoryItem.track_stock.is_(True),
                InventoryItem.reorder_level > 0,
            )
        )
    ).scalars().all()
    for item in items:
        if item.outlet_id and item.outlet_id != outlet_id:
            continue
        on_hand = sum((_d(s.qty_on_hand) for s in item.stocks or []), Decimal("0"))
        if on_hand <= _d(item.reorder_level):
            low_stock += 1

    open_shift = (
        await db.execute(
            select(Shift).where(
                Shift.tenant_id == ctx.tenant_id,
                Shift.outlet_id == outlet_id,
                Shift.status == ShiftStatus.OPEN,
            )
        )
    ).scalars().first()

    shift_brief = None
    if open_shift is not None:
        shift_bills = await _settled_bills(
            db, ctx, outlet_id, open_shift.opened_at or start, end
        )
        shift_brief = ShiftBrief(
            shift_id=open_shift.id,
            shift_number=open_shift.shift_number,
            opened_at=open_shift.opened_at,
            opening_cash=float(_d(open_shift.opening_cash)),
            gross_sales=_m(sum((_d(b.grand_total) for b in shift_bills), Decimal("0"))),
        )

    return DashboardSummary(
        outlet_id=outlet_id,
        today_gross_sales=_m(gross),
        today_net_sales=_m(net),
        today_orders=len(bills),
        today_covers=covers,
        today_avg_ticket=_m(gross / len(bills)) if bills else Decimal("0"),
        active_orders=int(active_orders),
        occupied_tables=int(occupied_tables),
        total_tables=int(total_tables),
        active_kots=int(active_kots),
        pending_reservations=0,
        low_stock_items=low_stock,
        open_shift=shift_brief,
    )


# ─── Sales ───────────────────────────────────────────────────────

@router.get("/sales-summary", response_model=SalesSummary)
async def sales_summary(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:reports"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
    date_from: date,
    date_to: date,
):
    """Headline sales for a window, broken down by tender."""
    resolve_outlet_id(ctx, outlet_id)
    if date_to < date_from:
        raise HTTPException(status_code=422, detail="date_to cannot precede date_from")

    start, end = _bounds(date_from, date_to)
    bills = await _settled_bills(db, ctx, outlet_id, start, end, with_items=True)

    gross = discount = tax = service = tips = round_off = Decimal("0")
    covers = 0
    by_method: dict[str, Decimal] = {
        "cash": Decimal("0"), "card": Decimal("0"), "upi": Decimal("0"),
        "wallet": Decimal("0"), "credit": Decimal("0"),
        "aggregator_paid": Decimal("0"), "online": Decimal("0"),
    }

    for bill in bills:
        gross += _d(bill.grand_total)
        discount += _d(bill.discount_total)
        tax += _d(bill.tax_total)
        service += _d(bill.service_charge)
        tips += _d(bill.tip)
        round_off += _d(bill.round_off)
        covers += int(bill.covers or 0)

        for payment in bill.payments or []:
            key = _status_value(payment.method)
            if key in by_method and _status_value(payment.status) == "success":
                by_method[key] += _d(payment.amount)

    count = len(bills)
    return SalesSummary(
        outlet_id=outlet_id,
        date_from=date_from,
        date_to=date_to,
        gross_sales=_m(gross),
        net_sales=_m(gross - discount - tax),
        total_discount=_m(discount),
        total_tax=_m(tax),
        total_service_charge=_m(service),
        total_tips=_m(tips),
        total_round_off=_m(round_off),
        total_orders=count,
        total_covers=covers,
        avg_ticket=_m(gross / count) if count else Decimal("0"),
        cash_sales=_m(by_method["cash"]),
        card_sales=_m(by_method["card"]),
        upi_sales=_m(by_method["upi"]),
        wallet_sales=_m(by_method["wallet"]),
        credit_sales=_m(by_method["credit"]),
        aggregator_sales=_m(by_method["aggregator_paid"]),
        online_sales=_m(by_method["online"]),
    )


@router.get("/item-sales", response_model=ItemSalesReport)
async def item_sales(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:reports"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
    date_from: date,
    date_to: date,
    limit: int = 100,
):
    """What sold, in what quantity, and what it was worth after discounts."""
    resolve_outlet_id(ctx, outlet_id)
    start, end = _bounds(date_from, date_to)

    items = (
        await db.execute(
            select(BillItem)
            .join(Bill, BillItem.bill_id == Bill.id)
            .where(
                Bill.tenant_id == ctx.tenant_id,
                Bill.outlet_id == outlet_id,
                Bill.status == BillStatus.SETTLED,
                Bill.settled_at >= start,
                Bill.settled_at <= end,
            )
        )
    ).scalars().all()

    categories = {
        c.id: c.name
        for c in (
            await db.execute(
                select(MenuCategory).where(MenuCategory.tenant_id == ctx.tenant_id)
            )
        ).scalars().all()
    }
    menu_items = {
        m.id: m
        for m in (
            await db.execute(
                select(MenuItem).where(MenuItem.tenant_id == ctx.tenant_id)
            )
        ).scalars().all()
    }

    totals: dict[uuid.UUID, dict] = {}
    for item in items:
        entry = totals.setdefault(item.menu_item_id, {
            "qty": 0, "gross": Decimal("0"), "discount": Decimal("0"),
            "tax": Decimal("0"), "first": None, "last": None,
        })
        entry["qty"] += int(item.qty or 0)
        entry["gross"] += _d(item.unit_price) * _d(item.qty)
        entry["discount"] += _d(item.discount_amount)
        entry["tax"] += _d(item.cgst) + _d(item.sgst) + _d(item.igst) + _d(item.cess)

    rows = []
    for menu_item_id, entry in totals.items():
        menu_item = menu_items.get(menu_item_id)
        rows.append(ItemSalesRow(
            menu_item_id=menu_item_id,
            item_name=menu_item.name if menu_item else "Unknown",
            category_name=(
                categories.get(menu_item.category_id)
                if menu_item and menu_item.category_id else None
            ),
            qty_sold=entry["qty"],
            gross_amount=_m(entry["gross"]),
            net_amount=_m(entry["gross"] - entry["discount"]),
            discount_amount=_m(entry["discount"]),
            tax_amount=_m(entry["tax"]),
        ))

    rows.sort(key=lambda r: r.qty_sold, reverse=True)
    rows = rows[:limit]

    return ItemSalesReport(
        outlet_id=outlet_id,
        date_from=date_from,
        date_to=date_to,
        rows=rows,
        total_qty=sum(r.qty_sold for r in rows),
        total_net=_m(sum((r.net_amount for r in rows), Decimal("0"))),
    )


@router.get("/hour-sales", response_model=HourSalesReport)
async def hour_sales(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:reports"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
    date_from: date,
    date_to: date,
):
    """Sales by hour of day — the staffing and prep-planning chart."""
    resolve_outlet_id(ctx, outlet_id)
    start, end = _bounds(date_from, date_to)

    bills = await _settled_bills(db, ctx, outlet_id, start, end)

    by_hour: dict[int, dict] = {
        h: {"orders": 0, "covers": 0, "gross": Decimal("0"), "discount": Decimal("0")}
        for h in range(24)
    }

    for bill in bills:
        if not bill.settled_at:
            continue
        try:
            hour = datetime.fromisoformat(bill.settled_at.replace("Z", "+00:00")).hour
        except (ValueError, TypeError):
            continue
        by_hour[hour]["orders"] += 1
        by_hour[hour]["covers"] += int(bill.covers or 0)
        by_hour[hour]["gross"] += _d(bill.grand_total)
        by_hour[hour]["discount"] += _d(bill.discount_total)

    rows = [
        HourSalesRow(
            hour=hour,
            orders=data["orders"],
            covers=data["covers"],
            gross_amount=_m(data["gross"]),
            net_amount=_m(data["gross"] - data["discount"]),
        )
        for hour, data in by_hour.items()
        if data["orders"] > 0
    ]
    rows.sort(key=lambda r: r.hour)

    peak = max(rows, key=lambda r: r.gross_amount).hour if rows else None

    return HourSalesReport(
        outlet_id=outlet_id,
        date_from=date_from,
        date_to=date_to,
        rows=rows,
        peak_hour=peak,
    )


@router.get("/category-sales", response_model=CategorySalesReport)
async def category_sales(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:reports"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
    date_from: date,
    date_to: date,
):
    resolve_outlet_id(ctx, outlet_id)
    start, end = _bounds(date_from, date_to)

    rows = (
        await db.execute(
            select(
                MenuCategory.id,
                MenuCategory.name,
                func.coalesce(func.sum(BillItem.qty), 0).label("qty"),
                func.coalesce(
                    func.sum(
                        (BillItem.unit_price * BillItem.qty) - BillItem.discount_amount
                    ), 0,
                ).label("net"),
            )
            .join(MenuItem, MenuItem.category_id == MenuCategory.id)
            .join(BillItem, BillItem.menu_item_id == MenuItem.id)
            .join(Bill, BillItem.bill_id == Bill.id)
            .where(
                MenuCategory.tenant_id == ctx.tenant_id,
                Bill.tenant_id == ctx.tenant_id,
                Bill.outlet_id == outlet_id,
                Bill.status == BillStatus.SETTLED,
                Bill.settled_at >= start,
                Bill.settled_at <= end,
            )
            .group_by(MenuCategory.id, MenuCategory.name)
            .order_by(func.sum(
                (BillItem.unit_price * BillItem.qty) - BillItem.discount_amount
            ).desc())
        )
    ).all()

    total = sum((_d(r.net) for r in rows), Decimal("0"))

    return CategorySalesReport(
        outlet_id=outlet_id,
        date_from=date_from,
        date_to=date_to,
        rows=[
            CategorySalesRow(
                category_id=r.id,
                category_name=r.name,
                qty_sold=int(_d(r.qty)),
                net_amount=_m(_d(r.net)),
                share_pct=(
                    _m(_d(r.net) / total * Decimal("100")) if total > 0 else Decimal("0")
                ),
            )
            for r in rows
        ],
        total_net=_m(total),
    )


@router.get("/outlet-sales", response_model=OutletSalesReport)
async def outlet_sales(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:reports"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    date_from: date,
    date_to: date,
):
    """Cross-outlet comparison — one row per outlet the user can see."""
    from src.models import Outlet
    start, end = _bounds(date_from, date_to)

    outlets = (
        await db.execute(
            select(Outlet).where(
                Outlet.tenant_id == ctx.tenant_id, Outlet.is_active.is_(True)
            )
        )
    ).scalars().all()

    visible = [
        o for o in outlets
        if not ctx.outlet_id or o.id == ctx.outlet_id
    ]

    bills = await _settled_bills(db, ctx, None, start, end)

    rows: list[OutletSalesRow] = []
    total_net = Decimal("0")

    for outlet in visible:
        outlet_bills = [b for b in bills if b.outlet_id == outlet.id]
        net = sum(
            (_d(b.grand_total) - _d(b.discount_total) for b in outlet_bills),
            Decimal("0"),
        )
        covers = sum(int(b.covers or 0) for b in outlet_bills)
        total_net += net

        rows.append(OutletSalesRow(
            outlet_id=outlet.id,
            outlet_name=outlet.name,
            outlet_code=outlet.code,
            total_orders=len(outlet_bills),
            total_covers=covers,
            net_sales=_m(net),
            avg_ticket=_m(net / len(outlet_bills)) if outlet_bills else Decimal("0"),
        ))

    rows.sort(key=lambda r: r.net_sales, reverse=True)

    return OutletSalesReport(
        date_from=date_from, date_to=date_to, rows=rows, total_net=_m(total_net)
    )


@router.get("/waiter-sales", response_model=WaiterSalesReport)
async def waiter_sales(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:reports"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
    date_from: date,
    date_to: date,
):
    """Per-server performance, tips included."""
    resolve_outlet_id(ctx, outlet_id)
    start, end = _bounds(date_from, date_to)

    bills = (
        await db.execute(
            select(Bill).where(
                Bill.tenant_id == ctx.tenant_id,
                Bill.outlet_id == outlet_id,
                Bill.status == BillStatus.SETTLED,
                Bill.settled_at >= start,
                Bill.settled_at <= end,
                Bill.waiter_id.is_not(None),
            )
        )
    ).scalars().all()

    waiters = {
        e.id: e.full_name
        for e in (
            await db.execute(
                select(Employee).where(Employee.tenant_id == ctx.tenant_id)
            )
        ).scalars().all()
    }

    tips = (
        await db.execute(
            select(Tip).where(
                Tip.tenant_id == ctx.tenant_id,
                Tip.outlet_id == outlet_id,
            )
        )
    ).scalars().all()
    tips_by_waiter: dict[uuid.UUID, Decimal] = {}
    for tip in tips:
        tips_by_waiter[tip.employee_id] = (
            tips_by_waiter.get(tip.employee_id, Decimal("0")) + _d(tip.amount)
        )

    totals: dict[uuid.UUID, dict] = {}
    for bill in bills:
        entry = totals.setdefault(
            bill.waiter_id, {"orders": 0, "covers": 0, "net": Decimal("0")}
        )
        entry["orders"] += 1
        entry["covers"] += int(bill.covers or 0)
        entry["net"] += _d(bill.grand_total) - _d(bill.discount_total)

    rows = [
        WaiterSalesRow(
            waiter_id=waiter_id,
            waiter_name=waiters.get(waiter_id, "Unknown"),
            total_orders=entry["orders"],
            total_covers=entry["covers"],
            net_sales=_m(entry["net"]),
            avg_ticket=_m(entry["net"] / entry["orders"]) if entry["orders"] else Decimal("0"),
            total_tips=_m(tips_by_waiter.get(waiter_id, Decimal("0"))),
        )
        for waiter_id, entry in totals.items()
    ]
    rows.sort(key=lambda r: r.net_sales, reverse=True)

    return WaiterSalesReport(
        outlet_id=outlet_id,
        date_from=date_from,
        date_to=date_to,
        rows=rows,
        total_net=_m(sum((r.net_sales for r in rows), Decimal("0"))),
    )


# ─── Kitchen ─────────────────────────────────────────────────────

@router.get("/kitchen-performance", response_model=KitchenPerformanceReport)
async def kitchen_performance(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:reports"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
    date_from: date,
    date_to: date,
):
    """Prep times per station — fired to ready, in minutes."""
    resolve_outlet_id(ctx, outlet_id)
    start, end = _bounds(date_from, date_to)

    kots = (
        await db.execute(
            select(KOT)
            .options(selectinload(KOT.items))
            .where(
                KOT.tenant_id == ctx.tenant_id,
                KOT.outlet_id == outlet_id,
                KOT.created_at >= start,
                KOT.created_at <= end,
            )
        )
    ).scalars().all()

    stations = {
        s.id: s.name
        for s in (
            await db.execute(
                select(KitchenStation).where(
                    KitchenStation.tenant_id == ctx.tenant_id,
                    KitchenStation.outlet_id == outlet_id,
                )
            )
        ).scalars().all()
    }

    def _minutes(later: str | None, earlier: str | None) -> float | None:
        if not later or not earlier:
            return None
        try:
            a = datetime.fromisoformat(earlier.replace("Z", "+00:00"))
            b = datetime.fromisoformat(later.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return None
        return round((b - a).total_seconds() / 60, 1)

    by_station: dict[uuid.UUID, dict] = {}
    all_times: list[Decimal] = []

    for kot in kots:
        entry = by_station.setdefault(kot.station_id, {
            "tickets": 0, "items": 0, "cancelled": 0, "times": [],
        })
        entry["tickets"] += 1

        for item in kot.items or []:
            entry["items"] += int(item.qty or 0)
            if _status_value(item.status) == KOTItemStatus.CANCELLED.value:
                entry["cancelled"] += 1

        # Prep time is measured from fire to ready
        minutes = _minutes(kot.ready_at, kot.fired_at or kot.created_at)
        if minutes is not None and minutes >= 0:
            entry["times"].append(minutes)
            all_times.append(_d(minutes))

    rows = []
    for station_id, entry in by_station.items():
        times = entry["times"]
        rows.append(KitchenPerformanceRow(
            station_id=station_id,
            station_name=stations.get(station_id, "Unknown"),
            tickets=entry["tickets"],
            items=entry["items"],
            cancelled_items=entry["cancelled"],
            avg_prep_minutes=(
                _m(sum((_d(t) for t in times), Decimal("0")) / Decimal(len(times)))
                if times else None
            ),
            max_prep_minutes=_m(max((_d(t) for t in times), default=Decimal("0")))
            if times else None,
        ))
    rows.sort(key=lambda r: r.tickets, reverse=True)

    return KitchenPerformanceReport(
        outlet_id=outlet_id,
        date_from=date_from,
        date_to=date_to,
        rows=rows,
        avg_prep_minutes=(
            _m(sum(all_times, Decimal("0")) / Decimal(len(all_times)))
            if all_times else None
        ),
        total_tickets=len(kots),
    )


# ─── Customer RFM ────────────────────────────────────────────────

@router.get("/customer-rfm", response_model=CustomerRfmReport)
async def customer_rfm(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:reports"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
    date_from: date,
    date_to: date,
):
    """Recency / frequency / monetary segmentation for targeted campaigns."""
    resolve_outlet_id(ctx, outlet_id)
    start, end = _bounds(date_from, date_to)

    bills = (
        await db.execute(
            select(Bill).where(
                Bill.tenant_id == ctx.tenant_id,
                Bill.outlet_id == outlet_id,
                Bill.status == BillStatus.SETTLED,
                Bill.settled_at >= start,
                Bill.settled_at <= end,
                Bill.customer_id.is_not(None),
            )
        )
    ).scalars().all()

    customers = {
        c.id: c
        for c in (
            await db.execute(
                select(Customer).where(Customer.tenant_id == ctx.tenant_id)
            )
        ).scalars().all()
    }

    by_customer: dict[uuid.UUID, dict] = {}
    for bill in bills:
        entry = by_customer.setdefault(
            bill.customer_id, {"count": 0, "spend": Decimal("0"), "last": None}
        )
        entry["count"] += 1
        entry["spend"] += _d(bill.grand_total)
        if bill.settled_at and (entry["last"] is None or bill.settled_at > entry["last"]):
            entry["last"] = bill.settled_at

    today = datetime.now(timezone.utc).date()
    rows: list[CustomerRfmRow] = []

    for customer_id, entry in by_customer.items():
        customer = customers.get(customer_id)
        if customer is None:
            continue

        last_visit = (
            datetime.fromisoformat(entry["last"].replace("Z", "+00:00"))
            if entry["last"] else None
        )
        recency = (today - last_visit.date()).days if last_visit else None

        # Segment on recency and frequency
        if recency is None:
            segment = "new"
        elif recency <= 30 and entry["count"] >= 5:
            segment = "champion"
        elif recency <= 30:
            segment = "regular"
        elif recency <= 90:
            segment = "at_risk"
        else:
            segment = "lapsed"

        rows.append(CustomerRfmRow(
            customer_id=customer_id,
            name=customer.name,
            phone=customer.phone,
            recency_days=recency,
            frequency=entry["count"],
            monetary=_m(entry["spend"]),
            rfm_segment=segment,
            last_visit=last_visit,
        ))

    # Champions first, then by spend
    rows.sort(key=lambda r: (-r.frequency, -r.monetary))

    return CustomerRfmReport(
        outlet_id=outlet_id,
        date_from=date_from,
        date_to=date_to,
        rows=rows,
    )


# ─── P&L ─────────────────────────────────────────────────────────

@router.get("/pnl", response_model=PnlReport)
async def pnl(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:reports"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
    date_from: date,
    date_to: date,
):
    """Profit and loss from posted journal entries, grouped by account type."""
    resolve_outlet_id(ctx, outlet_id)

    from src.models import ChartOfAccount, JournalEntry, JournalEntryLine

    rows = (
        await db.execute(
            select(
                ChartOfAccount.account_type,
                func.coalesce(func.sum(JournalEntryLine.debit), 0).label("debit"),
                func.coalesce(func.sum(JournalEntryLine.credit), 0).label("credit"),
            )
            .join(JournalEntryLine, JournalEntryLine.account_id == ChartOfAccount.id)
            .join(JournalEntry, JournalEntryLine.journal_entry_id == JournalEntry.id)
            .where(
                ChartOfAccount.tenant_id == ctx.tenant_id,
                ChartOfAccount.outlet_id == outlet_id,
                JournalEntry.status == "posted",
                JournalEntry.entry_date >= date_from,
                JournalEntry.entry_date <= date_to,
            )
            .group_by(ChartOfAccount.account_type)
        )
    ).all()

    # Revenue is credit-normal, expense is debit-normal
    revenue = expense = Decimal("0")
    pnl_rows: list[PnlRow] = []

    for row in rows:
        debit, credit = _d(row.debit), _d(row.credit)
        account_type = _status_value(row.account_type)

        if account_type == "revenue":
            amount = credit - debit
            revenue += amount
        elif account_type == "expense":
            amount = debit - credit
            expense += amount
        else:
            amount = debit - credit

        pnl_rows.append(PnlRow(account_type=account_type, amount=_m(amount)))

    net = revenue - expense

    return PnlReport(
        outlet_id=outlet_id,
        date_from=date_from,
        date_to=date_to,
        rows=pnl_rows,
        total_revenue=_m(revenue),
        total_expense=_m(expense),
        net_profit=_m(net),
        margin_pct=_m(net / revenue * Decimal("100")) if revenue > 0 else Decimal("0"),
    )
