"""AI copilot endpoints — chat, menu engineering, demand forecast, pricing.

The analytics are computed locally from sales and cost data so the numbers are
always traceable; the LLM is only used to phrase the chat answer. If no AI
provider is configured the copilot still works — it just reports the computed
figures instead of prose.
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission, resolve_outlet_id
from src.database.session import get_db
from src.models import (
    Bill,
    BillItem,
    BillStatus,
    MenuCategory,
    MenuItem,
    Order,
)
from src.schemas.integrations import (
    CopilotChatRequest,
    CopilotChatResponse,
    DemandForecastReport,
    DemandForecastRow,
    MenuEngineeringReport,
    MenuEngineeringRow,
    PriceOptimizationResponse,
    PriceOptimizationRow,
)
from src.services import ai_service, costing_service

router = APIRouter(prefix="/ai/copilot", tags=["AI Copilot"])

TWO_PLACES = Decimal("0.01")


def _d(value) -> Decimal:
    return Decimal("0") if value is None else Decimal(str(value))


def _m(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _bounds(date_from: date, date_to: date) -> tuple[str, str]:
    return f"{date_from.isoformat()}T00:00:00", f"{date_to.isoformat()}T23:59:59"


# ─── Menu engineering ────────────────────────────────────────────

@router.get("/menu-engineering", response_model=MenuEngineeringReport)
async def menu_engineering(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:reports"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
    date_from: date,
    date_to: date,
):
    """Classify each item by popularity × profitability.

    Popularity is measured against the median quantity sold, profitability
    against the median contribution margin — the classic star / plowhorse /
    puzzle / dog matrix.
    """
    resolve_outlet_id(ctx, outlet_id)
    start, end = _bounds(date_from, date_to)

    items = (
        await db.execute(
            select(
                BillItem.menu_item_id,
                func.sum(BillItem.qty).label("qty"),
                func.sum(
                    (BillItem.unit_price * BillItem.qty) - BillItem.discount_amount
                ).label("net"),
            )
            .join(Bill, BillItem.bill_id == Bill.id)
            .where(
                Bill.tenant_id == ctx.tenant_id,
                Bill.outlet_id == outlet_id,
                Bill.status == BillStatus.SETTLED,
                Bill.settled_at >= start,
                Bill.settled_at <= end,
            )
            .group_by(BillItem.menu_item_id)
        )
    ).all()

    if not items:
        return MenuEngineeringReport(
            outlet_id=outlet_id,
            date_from=date_from.isoformat(),
            date_to=date_to.isoformat(),
        )

    menu_items = {
        m.id: m
        for m in (
            await db.execute(
                select(MenuItem).where(MenuItem.tenant_id == ctx.tenant_id)
            )
        ).scalars().all()
    }
    categories = {
        c.id: c.name
        for c in (
            await db.execute(
                select(MenuCategory).where(MenuCategory.tenant_id == ctx.tenant_id)
            )
        ).scalars().all()
    }

    # One costing pass for every item in the report
    costs = await costing_service.menu_item_costs(
        db, [m.id for m in menu_items.values()], ctx.tenant_id
    )

    rows: list[MenuEngineeringRow] = []
    for row in items:
        menu_item = menu_items.get(row.menu_item_id)
        if menu_item is None:
            continue

        qty = int(_d(row.qty))
        net = _d(row.net)

        cost = costs.get(menu_item.id, Decimal("0"))
        price = _d(menu_item.price)
        margin_pct = (
            float(_m((price - cost) / price * Decimal("100")))
            if price > 0 else None
        )

        rows.append(MenuEngineeringRow(
            menu_item_id=menu_item.id,
            item_name=menu_item.name,
            category_name=(
                categories.get(menu_item.category_id)
                if menu_item.category_id else None
            ),
            qty_sold=qty,
            net_amount=float(_m(net)),
            margin_pct=margin_pct,
        ))

    # Median splits — more robust than the mean for skewed sales
    quantities = sorted(r.qty_sold for r in rows)
    margins = sorted(
        r.margin_pct for r in rows if r.margin_pct is not None
    )

    median_qty = quantities[len(quantities) // 2] if quantities else 0
    median_margin = margins[len(margins) // 2] if margins else 0

    for row in rows:
        popular = row.qty_sold >= median_qty
        profitable = (row.margin_pct or 0) >= median_margin
        if popular and profitable:
            row.classification = "star"
        elif popular and not profitable:
            row.classification = "plowhorse"
        elif not popular and profitable:
            row.classification = "puzzle"
        else:
            row.classification = "dog"

    by_class: dict[str, list[MenuEngineeringRow]] = {
        "star": [], "plowhorse": [], "puzzle": [], "dog": [],
    }
    for row in rows:
        by_class[row.classification].append(row)

    # Best performers first within each bucket
    for bucket in by_class.values():
        bucket.sort(key=lambda r: r.net_amount, reverse=True)

    return MenuEngineeringReport(
        outlet_id=outlet_id,
        date_from=date_from.isoformat(),
        date_to=date_to.isoformat(),
        stars=by_class["star"],
        plowhorses=by_class["plowhorse"],
        puzzles=by_class["puzzle"],
        dogs=by_class["dog"],
    )


# ─── Demand forecast ─────────────────────────────────────────────

@router.get("/demand-forecast", response_model=DemandForecastReport)
async def demand_forecast(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:reports"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
    days: int = 7,
):
    """Project covers, orders and sales for the next N days.

    Uses a day-of-week moving average over the last eight weeks, with a linear
    trend adjustment — enough for prep and staffing without a forecasting stack.
    """
    resolve_outlet_id(ctx, outlet_id)
    if days < 1 or days > 60:
        raise HTTPException(status_code=422, detail="days must be between 1 and 60")

    today = datetime.now(timezone.utc).date()

    # Eight weeks of history, bucketed by day
    history_start = today - timedelta(weeks=8)
    start, end = _bounds(history_start, today)

    bills = (
        await db.execute(
            select(Bill).where(
                Bill.tenant_id == ctx.tenant_id,
                Bill.outlet_id == outlet_id,
                Bill.status == BillStatus.SETTLED,
                Bill.settled_at >= start,
                Bill.settled_at <= end,
            )
        )
    ).scalars().all()

    by_weekday: dict[int, list[dict]] = {i: [] for i in range(7)}
    for bill in bills:
        if not bill.settled_at:
            continue
        try:
            settled = datetime.fromisoformat(bill.settled_at.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            continue
        by_weekday[settled.weekday()].append({
            "sales": _d(bill.grand_total),
            "covers": int(bill.covers or 0),
            "date": settled.date(),
        })

    rows: list[DemandForecastRow] = []
    for offset in range(1, days + 1):
        target = today + timedelta(days=offset)
        samples = by_weekday.get(target.weekday(), [])

        if samples:
            count = len(samples)
            avg_sales = sum((s["sales"] for s in samples), Decimal("0")) / count
            avg_covers = sum((s["covers"] for s in samples), Decimal("0")) / count

            # Trend: compare the recent half to the older half
            ordered = sorted(samples, key=lambda s: s["date"])
            mid = count // 2
            if mid > 0:
                older = sum((s["sales"] for s in ordered[:mid]), Decimal("0")) / mid
                recent = sum((s["sales"] for s in ordered[mid:]), Decimal("0")) / (
                    count - mid
                )
                trend = (recent - older) / older if older > 0 else Decimal("0")
            else:
                trend = Decimal("0")

            # Cap the trend so a single bad week cannot distort the forecast
            trend = max(Decimal("-0.3"), min(Decimal("0.3"), trend))
            projected = avg_sales * (Decimal("1") + trend)

            # Confidence grows with sample size
            confidence = min(Decimal("0.9"), Decimal("0.4") + Decimal("0.06") * count)

            rows.append(DemandForecastRow(
                day=target.isoformat(),
                predicted_covers=int(avg_covers * (Decimal("1") + trend / 2)),
                predicted_orders=int(
                    (avg_covers / Decimal("2.5")) * (Decimal("1") + trend)
                ) if avg_covers > 0 else 0,
                predicted_sales=float(_m(projected)),
                confidence=float(confidence),
            ))
        else:
            rows.append(DemandForecastRow(
                day=target.isoformat(),
                predicted_covers=0,
                predicted_orders=0,
                predicted_sales=0,
                confidence=None,
            ))

    return DemandForecastReport(
        outlet_id=outlet_id,
        rows=rows,
        model="day_of_week_moving_average",
    )


# ─── Price optimisation ──────────────────────────────────────────

@router.get("/price-optimization", response_model=PriceOptimizationResponse)
async def price_optimization(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:reports"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
    date_from: date,
    date_to: date,
    limit: int = 20,
):
    """Suggest price moves for items with poor margins and healthy demand."""
    resolve_outlet_id(ctx, outlet_id)

    engineering = await menu_engineering(ctx, db, outlet_id, date_from, date_to)

    candidates = [
        row for row in engineering.plowhorses
        if row.qty_sold > 0 and (row.margin_pct or 0) < 50
    ][:limit]

    rows: list[PriceOptimizationRow] = []
    for row in candidates:
        menu_item = await db.scalar(
            select(MenuItem).where(MenuItem.id == row.menu_item_id)
        )
        if menu_item is None:
            continue

        price = _d(menu_item.price)
        if price <= 0:
            continue

        cost = await costing_service.menu_item_cost(
            db, menu_item.id, ctx.tenant_id
        )
        if cost <= 0:
            # No recipe — no defensible suggestion
            continue

        # Aim for a 65% margin, capped at a 15% increase, never a decrease
        suggested = costing_service.suggested_price(
            cost=cost,
            target_margin_pct=Decimal("65"),
            current_price=price,
        )
        delta = suggested - price

        if delta <= 0:
            continue

        rows.append(PriceOptimizationRow(
            menu_item_id=menu_item.id,
            item_name=menu_item.name,
            current_price=float(_m(price)),
            suggested_price=float(_m(suggested)),
            expected_margin_delta=float(_m(delta * _d(row.qty_sold))),
            rationale=(
                f"Sold {row.qty_sold} times at a {row.margin_pct:.0f}% margin — "
                f"popular but under-priced"
            ),
        ))

    rows.sort(key=lambda r: r.expected_margin_delta, reverse=True)

    return PriceOptimizationResponse(outlet_id=outlet_id, rows=rows)


# ─── Chat ────────────────────────────────────────────────────────

@router.post("/chat", response_model=CopilotChatResponse)
async def chat(
    payload: CopilotChatRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:reports"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Ask a question about sales, stock or the menu in plain language.

    The analytics are computed first, then handed to the LLM as context so the
    answer is grounded in this outlet's actual numbers.
    """
    resolve_outlet_id(ctx, payload.outlet_id, required=False)

    if payload.outlet_id is None:
        raise HTTPException(status_code=422, detail="outlet_id is required")

    # Assemble the context the model needs to answer
    today = datetime.now(timezone.utc).date()
    start, end = _bounds(today - timedelta(days=30), today)

    bills = (
        await db.execute(
            select(Bill).where(
                Bill.tenant_id == ctx.tenant_id,
                Bill.outlet_id == payload.outlet_id,
                Bill.status == BillStatus.SETTLED,
                Bill.settled_at >= start,
                Bill.settled_at <= end,
            )
        )
    ).scalars().all()

    total_sales = sum((_d(b.grand_total) for b in bills), Decimal("0"))
    total_covers = sum(int(b.covers or 0) for b in bills)

    context = {
        "period": f"{start[:10]} to {end[:10]}",
        "total_sales": float(_m(total_sales)),
        "bill_count": len(bills),
        "total_covers": total_covers,
        "avg_ticket": float(_m(total_sales / len(bills))) if bills else 0,
        "active_orders": (
            await db.execute(
                select(func.count(Order.id)).where(
                    Order.tenant_id == ctx.tenant_id,
                    Order.outlet_id == payload.outlet_id,
                    Order.status.in_(["placed", "in_kitchen", "preparing"]),
                )
            )
        ).scalar() or 0,
    }

    reply, provider = await ai_service.answer_question(
        message=payload.message,
        context=context,
        history=payload.history,
    )

    return CopilotChatResponse(
        reply=reply,
        data=context,
        provider=provider,
        suggestions=[
            "What sold best this month?",
            "Which items have the worst margins?",
            "How did this week compare to last?",
        ],
    )
