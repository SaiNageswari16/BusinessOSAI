"""
Inventory Intelligence Engine

Pure heuristic AI — no external ML service required.
Computes real signals from your inventory data:
- Composite Health Score
- Dead Stock + Dead Capital identification
- Stockout Risk + Reorder Recommendations
- ABC classification (Pareto)
- Anomaly Detection (no movement vs. sudden spikes)
- Category Concentration
- Natural-Language Smart Insights
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, case, desc
from sqlalchemy.orm import selectinload, joinedload
from typing import Annotated, List, Dict
from datetime import date, datetime, timedelta
from collections import defaultdict

from src.database.session import get_db
from src.models.inventory import (
    Product, ProductCategory, Brand, UnitOfMeasure,
    InventoryBatch, InventorySerial,
    StockMovement, StockAdjustment,
    GoodsReceipt, GoodsIssue,
    Warehouse,
)
from src.api.deps import CurrentUserContext, get_current_user_context

router = APIRouter()


# ───────────────────────── helpers ─────────────────────────

async def _products_with_signals(ctx, db) -> List[Dict]:
    """Materialise each product with computed signals."""
    today = date.today()

    # Category + brand name lookup
    cats_q = select(ProductCategory.id, ProductCategory.name).where(ProductCategory.tenant_id == ctx.tenant_id)
    cats = {r[0]: r[1] for r in (await db.execute(cats_q)).all()}

    # Batches aggregated per product (expiry, qty)
    batch_q = select(
        InventoryBatch.product_id,
        func.coalesce(func.sum(InventoryBatch.remaining_quantity), 0).label("qty"),
        func.min(InventoryBatch.expiry_date).label("next_expiry"),
        func.count(InventoryBatch.id).label("batch_count"),
    ).where(
        InventoryBatch.tenant_id == ctx.tenant_id,
    ).group_by(InventoryBatch.product_id)
    batches_raw = (await db.execute(batch_q)).all()

    expiry_by_pid: Dict = {}
    qty_by_pid: Dict = {}
    for pid, qty, nxt, bc in batches_raw:
        if pid is None: continue
        qty_by_pid[pid] = (qty_by_pid.get(pid, 0) or 0) + int(qty or 0)
        if nxt:
            if pid not in expiry_by_pid or nxt < expiry_by_pid[pid]:
                expiry_by_pid[pid] = nxt

    # Stock movement counts per product in last 30/90/365 days
    async def movement_agg(days: int):
        since = datetime.utcnow() - timedelta(days=days)
        q = (
            select(
                StockMovement.product_id,
                func.coalesce(func.sum(StockMovement.quantity), 0).label("qty"),
                func.count(StockMovement.id).label("moves"),
            )
            .where(
                StockMovement.tenant_id == ctx.tenant_id,
                StockMovement.created_at >= since,
            )
            .group_by(StockMovement.product_id)
        )
        return {(r[0] or 0): {"qty": int(r[1] or 0), "moves": int(r[2] or 0)} for r in (await db.execute(q)).all()}

    last30 = await movement_agg(30)
    last90 = await movement_agg(90)
    last365 = await movement_agg(365)

    # Stock adjustments per product (negative = written off, positive = found)
    adj_q = select(
        StockAdjustment.product_id,
        func.coalesce(func.sum(StockAdjustment.quantity_changed), 0).label("net"),
        func.count(StockAdjustment.id).label("adj_count"),
    ).where(StockAdjustment.tenant_id == ctx.tenant_id
    ).group_by(StockAdjustment.product_id)
    adj_by_pid = {(r[0] or 0): {"net": int(r[1] or 0), "count": int(r[2] or 0)} for r in (await db.execute(adj_q)).all()}

    # All products — eager-load relationships to avoid lazy-load after await
    prod_q = (
        select(Product)
        .where(Product.tenant_id == ctx.tenant_id)
        .options(selectinload(Product.brand), selectinload(Product.uom))
        .order_by(Product.name)
    )
    products = (await db.execute(prod_q)).scalars().all()

    out = []
    for p in products:
        pid = p.id
        cat_name = cats.get(p.category_id, "Uncategorised") if p.category_id else "Uncategorised"
        on_hand = int(qty_by_pid.get(pid, 0) or 0)
        if on_hand == 0:
            on_hand = p.initial_stock  # fallback
        sell = float(p.selling_price) if p.selling_price is not None else 0.0
        cost = float(p.purchase_price) if p.purchase_price is not None else 0.0
        reorder = p.reorder_level or 0
        safety = p.safety_stock or 0

        last30_data = last30.get(pid, {"qty": 0, "moves": 0})
        last90_data = last90.get(pid, {"qty": 0, "moves": 0})
        last365_data = last365.get(pid, {"qty": 0, "moves": 0})
        adj = adj_by_pid.get(pid, {"net": 0, "count": 0})

        days_of_cover = None
        if last30_data["qty"] > 0 and on_hand > 0:
            days_of_cover = round(on_hand / (last30_data["qty"] / 30.0), 1)

        expiry = expiry_by_pid.get(pid)
        days_to_expiry = (expiry - today).days if expiry else None

        out.append({
            "id": str(pid),
            "name": p.name,
            "sku": p.sku,
            "category": cat_name,
            "brand": p.brand.name if p.brand else None,
            "uom": p.uom.name if p.uom else None,
            "barcode": p.barcode,
            "image_url": p.image_url,
            "selling_price": sell,
            "purchase_price": cost,
            "initial_stock": p.initial_stock,
            "reorder_level": reorder,
            "safety_stock": safety,
            "status": p.status.value if hasattr(p.status, "value") else str(p.status),
            "on_hand": on_hand,
            "next_expiry": str(expiry) if expiry else None,
            "days_to_expiry": days_to_expiry,
            "batch_count": len([b for b in batches_raw if b[0] == pid]) if batches_raw else 0,
            # Movement signals
            "movement_30d_qty": last30_data["qty"],
            "movement_30d_count": last30_data["moves"],
            "movement_90d_qty": last90_data["qty"],
            "movement_90d_count": last90_data["moves"],
            "movement_365d_qty": last365_data["qty"],
            "movement_365d_count": last365_data["moves"],
            "days_of_cover": days_of_cover,
            "adjustments_count": adj["count"],
            "adjustments_net": adj["net"],
            # Derived value
            "stock_value": round(on_hand * cost, 2),
            "potential_revenue": round(on_hand * sell, 2),
        })
    return out


def _grade(score: float) -> str:
    if score >= 85: return "A+"
    if score >= 75: return "A"
    if score >= 65: return "B"
    if score >= 50: return "C"
    if score >= 35: return "D"
    return "F"


def _grade_color(g: str) -> str:
    return {
        "A+": "#10b981", "A": "#22c55e",
        "B": "#84cc16", "C": "#eab308",
        "D": "#f97316", "F": "#ef4444",
    }.get(g, "#94a3b8")


def _abc_class(p: Dict, sorted_by_value: List[Dict]) -> str:
    """A = top 80% cumulative value, B = next 15%, C = remaining 5%."""
    total = sum(x["stock_value"] for x in sorted_by_value) or 1
    cum = 0
    for x in sorted_by_value:
        cum += x["stock_value"]
        if x["id"] == p["id"]:
            if cum / total <= 0.80: return "A"
            if cum / total <= 0.95: return "B"
            return "C"
    return "C"


@router.get("/intelligence/health-score")
async def health_score(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
):
    """
    Composite inventory health, scored 0–100.
    Components:
      - Stock-out risk  (25%)
      - Dead-stock ratio (20%)
      - Expiry risk (20%)
      - Stock vs. safety buffer (15%)
      - Movement velocity (10%)
      - Pricing coverage (10%)
    """
    prods = await _products_with_signals(ctx, db)
    if not prods:
        return {"overall": 0, "grade": "F", "components": [], "total_products": 0}

    total_value = sum(p["stock_value"] for p in prods) or 1
    total_units = sum(p["on_hand"] for p in prods) or 1

    # 1. Stock-out risk: products with on_hand <= reorder AND reorder > 0
    stocked_out = sum(1 for p in prods if p["reorder_level"] > 0 and p["on_hand"] <= p["reorder_level"])
    stockout_pct = (stocked_out / len(prods)) * 100
    stockout_score = max(0, 100 - stockout_pct * 1.5)

    # 2. Dead-stock ratio: products with 0 movement in 90 days
    dead = sum(1 for p in prods if p["movement_90d_count"] == 0 and p["on_hand"] > 0)
    dead_pct = (dead / len(prods)) * 100
    dead_stock_score = max(0, 100 - dead_pct * 1.2)

    # 3. Expiry risk: value of batches expiring in next 30 days
    expiry_value = sum(p["stock_value"] for p in prods
                      if p["days_to_expiry"] is not None and p["days_to_expiry"] <= 30 and p["on_hand"] > 0)
    expiry_pct = (expiry_value / total_value) * 100 if total_value else 0
    expiry_score = max(0, 100 - expiry_pct * 1.5)

    # 4. Safety buffer: products below safety stock
    below_safety = sum(1 for p in prods if p["safety_stock"] > 0 and p["on_hand"] < p["safety_stock"])
    safety_pct = (below_safety / len(prods)) * 100
    safety_score = max(0, 100 - safety_pct * 1.3)

    # 5. Movement velocity — share with last-30-day activity
    active_30 = sum(1 for p in prods if p["movement_30d_count"] > 0)
    velocity_pct = (active_30 / len(prods)) * 100
    velocity_score = min(100, velocity_pct * 1.5)

    # 6. Pricing coverage
    with_price = sum(1 for p in prods if p["selling_price"] > 0)
    pricing_score = (with_price / len(prods)) * 100

    components = [
        {"key": "stockout",     "label": "Stock-out Risk",     "score": round(stockout_score, 1),     "weight": 25, "signal": f"{stocked_out} products at or below reorder"},
        {"key": "dead_stock",   "label": "Dead-stock Ratio",   "score": round(dead_stock_score, 1),   "weight": 20, "signal": f"{dead} products haven't moved in 90 days"},
        {"key": "expiry",       "label": "Expiry Risk",        "score": round(expiry_score, 1),       "weight": 20, "signal": f"₹{expiry_value:,.0f} in stock expiring ≤30d"},
        {"key": "safety",       "label": "Safety Buffers",     "score": round(safety_score, 1),       "weight": 15, "signal": f"{below_safety} products below safety stock"},
        {"key": "velocity",     "label": "Movement Velocity",  "score": round(velocity_score, 1),     "weight": 10, "signal": f"{active_30} products active in last 30 days"},
        {"key": "pricing",      "label": "Pricing Coverage",   "score": round(pricing_score, 1),      "weight": 10, "signal": f"{with_price}/{len(prods)} products have selling prices"},
    ]

    overall = sum(c["score"] * (c["weight"] / 100) for c in components)
    grade = _grade(overall)

    return {
        "overall": round(overall, 1),
        "grade": grade,
        "grade_color": _grade_color(grade),
        "components": components,
        "total_products": len(prods),
        "total_value": round(total_value, 2),
        "total_units": total_units,
        "stocked_out_count": stocked_out,
        "dead_stock_count": dead,
        "expiry_at_risk_value": round(expiry_value, 2),
    }


@router.get("/intelligence/dead-stock")
async def dead_stock(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
):
    """Products with stock but no movement in 90+ days."""
    prods = await _products_with_signals(ctx, db)
    today = date.today()

    candidates = []
    for p in prods:
        if p["on_hand"] <= 0: continue

        # Hard rule: no movement for > 90 days AND stock sits
        no_movement_for = None
        if p["movement_365d_count"] == 0:
            no_movement_for = "365+"
        elif p["movement_90d_count"] == 0 and p["movement_365d_count"] > 0:
            no_movement_for = "90+"
        elif p["movement_30d_count"] == 0 and p["movement_90d_count"] > 0:
            no_movement_for = "30+"

        if not no_movement_for: continue

        months_old = (p["days_to_expiry"] is not None
                      and max(0, round((p["days_to_expiry"] - 365) / 30))
                      or None)

        # Recommendation logic
        days_to_exp = p["days_to_expiry"]
        if days_to_exp is not None and days_to_exp < 0:
            rec = "WRITE-OFF"
            rec_severity = "critical"
        elif days_to_exp is not None and days_to_exp < 30:
            rec = "DISCOUNT-50%"
            rec_severity = "high"
        elif days_to_exp is not None and days_to_exp < 90:
            rec = "BUNDLE"
            rec_severity = "medium"
        elif p["stock_value"] > 5000:
            rec = "LIQUIDATE"
            rec_severity = "high"
        elif p["stock_value"] > 1000:
            rec = "PROMOTE"
            rec_severity = "medium"
        else:
            rec = "MONITOR"
            rec_severity = "low"

        candidates.append({
            **p,
            "no_movement_for": no_movement_for,
            "months_until_expiry": months_old,
            "recommendation": rec,
            "recommendation_severity": rec_severity,
        })

    candidates.sort(key=lambda x: -x["stock_value"])
    total_dead_value = sum(c["stock_value"] for c in candidates)
    return {
        "items": candidates,
        "total_count": len(candidates),
        "total_dead_value": round(total_dead_value, 2),
        "total_units": sum(c["on_hand"] for c in candidates),
    }


@router.get("/intelligence/reorder-recommendations")
async def reorder_recommendations(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
):
    """
    Smart reorder signals, not just 'below reorder level'.
    Considers movement velocity, days-of-cover, expiry.
    """
    prods = await _products_with_signals(ctx, db)

    recs = []
    for p in prods:
        days_of_cover = p["days_of_cover"]
        reorder = p["reorder_level"]
        on_hand = p["on_hand"]

        urgency = None
        reason = None
        qty = 0

        # Rule 1: Below reorder level
        if reorder > 0 and on_hand <= reorder:
            urgency = "critical" if on_hand == 0 else "high"
            reason = f"Stock at {on_hand}u — below reorder level of {reorder}u"
            qty = max(reorder * 2, 50)

        # Rule 2: Days-of-cover < lead time (assume 7-day lead time)
        elif days_of_cover is not None and days_of_cover < 7:
            urgency = "high" if days_of_cover < 3 else "medium"
            reason = f"Only {days_of_cover} days of stock cover at current consumption"
            qty = max(int(p["movement_30d_qty"] * 1.5), 30)

        # Rule 3: Has high expiry coming up — restock after rotation
        elif p["days_to_expiry"] is not None and 0 < p["days_to_expiry"] < 60 and on_hand > 0:
            urgency = "low"
            reason = f"Near-expiry stock expiring {p['days_to_expiry']}d — replace after clearance"
            qty = max(int(p["movement_30d_qty"] * 0.8), 20)

        if not urgency: continue

        recs.append({
            **p,
            "urgency": urgency,
            "reason": reason,
            "suggested_order_qty": qty,
            "suggested_order_value": round(qty * p["purchase_price"], 2),
        })

    urgency_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    recs.sort(key=lambda x: (urgency_order[x["urgency"]], -x["on_hand"]))
    return {
        "items": recs,
        "total_count": len(recs),
        "critical": sum(1 for r in recs if r["urgency"] == "critical"),
        "high":     sum(1 for r in recs if r["urgency"] == "high"),
        "medium":   sum(1 for r in recs if r["urgency"] == "medium"),
        "low":      sum(1 for r in recs if r["urgency"] == "low"),
        "estimated_total_value": round(sum(r["suggested_order_value"] for r in recs), 2),
    }


@router.get("/intelligence/abc-classification")
async def abc_classification(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
):
    """A/B/C classification (Pareto) — A=top revenue, C=dead weight."""
    prods = await _products_with_signals(ctx, db)
    # Sort by 30-day movement × price (proxy for revenue impact)
    enriched = []
    for p in prods:
        revenue_proxy = p["movement_30d_qty"] * p["selling_price"]
        enriched.append({**p, "revenue_30d_proxy": round(revenue_proxy, 2)})
    enriched.sort(key=lambda x: -x["revenue_30d_proxy"])

    total = sum(x["revenue_30d_proxy"] for x in enriched) or 1
    cumulative = 0
    counts = {"A": 0, "B": 0, "C": 0}
    value_by = {"A": 0.0, "B": 0.0, "C": 0.0}
    units_by = {"A": 0, "B": 0, "C": 0}

    for x in enriched:
        cumulative += x["revenue_30d_proxy"]
        ratio = cumulative / total
        cls = "A" if ratio <= 0.80 else ("B" if ratio <= 0.95 else "C")
        x["abc_class"] = cls
        x["cumulative_revenue_share"] = round(ratio * 100, 1)
        counts[cls] += 1
        value_by[cls] += x["revenue_30d_proxy"]
        units_by[cls] += x["on_hand"]

    summary = {
        cls: {
            "count": counts[cls],
            "value_share": round(value_by[cls], 2),
            "units": units_by[cls],
            "description": {
                "A": "Top 80% revenue impact — protect availability",
                "B": "Next 15% — important secondary items",
                "C": "Bottom 5% — long tail, candidates for rationalisation",
            }[cls]
        }
        for cls in ("A", "B", "C")
    }

    return {
        "items": enriched,
        "summary": summary,
    }


@router.get("/intelligence/anomalies")
async def anomalies(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
):
    """
    Heuristic anomaly detection — no ML library needed:
    - Sudden movement spikes (>3× the long-term average)
    - Heavy negative adjustments (potential shrinkage)
    - Products with no consumption at all but lots of stock (sleeper risk)
    """
    prods = await _products_with_signals(ctx, db)
    findings = []

    for p in prods:
        # Spike detection
        avg_daily = p["movement_365d_qty"] / 365 if p["movement_365d_qty"] else 0
        recent_daily = p["movement_30d_qty"] / 30 if p["movement_30d_qty"] else 0

        if avg_daily > 0 and recent_daily > avg_daily * 3 and p["movement_30d_count"] >= 5:
            findings.append({
                "product_id": p["id"],
                "product_name": p["name"],
                "sku": p["sku"],
                "anomaly_type": "velocity_spike",
                "severity": "info",
                "title": "Velocity spike detected",
                "message": f"Recent 30-day rate is {recent_daily:.1f}u/day vs. long-term {avg_daily:.1f}u/day ({recent_daily / max(avg_daily, 0.01):.1f}×).",
                "metric": f"{recent_daily:.1f} u/day",
                "context": "May be seasonal demand, marketing campaign, or stock-out backfill.",
                "ts": datetime.utcnow().isoformat(),
            })

        if avg_daily > 0 and recent_daily < avg_daily * 0.2 and p["movement_365d_qty"] > 50 and p["on_hand"] > 0:
            findings.append({
                "product_id": p["id"],
                "product_name": p["name"],
                "sku": p["sku"],
                "anomaly_type": "velocity_drop",
                "severity": "warning",
                "title": "Velocity drop",
                "message": f"Recent 30-day rate {recent_daily:.1f}u/day is way below long-term {avg_daily:.1f}u/day.",
                "metric": f"{recent_daily:.1f} u/day",
                "context": "Possible demand shift, supplier issue, or competitor entry.",
                "ts": datetime.utcnow().isoformat(),
            })

        # Shrinkage
        if p["adjustments_net"] < -10 and p["adjustments_count"] >= 3:
            findings.append({
                "product_id": p["id"],
                "product_name": p["name"],
                "sku": p["sku"],
                "anomaly_type": "shrinkage",
                "severity": "warning",
                "title": "Net shrinkage",
                "message": f"{p['adjustments_count']} adjustments totaling {p['adjustments_net']} units negative.",
                "metric": f"{p['adjustments_net']} units",
                "context": "Investigate counting variance, damage patterns, or theft.",
                "ts": datetime.utcnow().isoformat(),
            })

        # Sleeper: high stock, zero movement, nearing expiry
        if (p["on_hand"] > 50 and
            p["movement_90d_count"] == 0 and
            p["days_to_expiry"] is not None and
            p["days_to_expiry"] < 60):
            findings.append({
                "product_id": p["id"],
                "product_name": p["name"],
                "sku": p["sku"],
                "anomaly_type": "sleeper",
                "severity": "critical",
                "title": "Sleeper with expiry",
                "message": f"{p['on_hand']} units unmoved for 90+ days, expiring in {p['days_to_expiry']} days.",
                "metric": f"{p['on_hand']}u · ₹{p['stock_value']:.0f}",
                "context": "High-priority clearance candidate.",
                "ts": datetime.utcnow().isoformat(),
            })

    # Negative-stocked products (data integrity)
    for p in prods:
        if p["on_hand"] < 0:
            findings.append({
                "product_id": p["id"],
                "product_name": p["name"],
                "sku": p["sku"],
                "anomaly_type": "negative_stock",
                "severity": "critical",
                "title": "Negative stock",
                "message": f"On-hand quantity is {p['on_hand']} — investigate cycle-count error.",
                "metric": f"{p['on_hand']} units",
                "context": "Indicates missing receipt, double-issued, or counting error.",
                "ts": datetime.utcnow().isoformat(),
            })

    severity_order = {"critical": 0, "warning": 1, "info": 2}
    findings.sort(key=lambda x: (severity_order[x["severity"]], x["anomaly_type"]))
    return {
        "items": findings,
        "counts": {
            "critical": sum(1 for f in findings if f["severity"] == "critical"),
            "warning":  sum(1 for f in findings if f["severity"] == "warning"),
            "info":     sum(1 for f in findings if f["severity"] == "info"),
        }
    }


@router.get("/intelligence/category-breakdown")
async def category_breakdown(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
):
    """Stock value & units per category — for heat-map visualisation."""
    prods = await _products_with_signals(ctx, db)

    by_cat: Dict = defaultdict(lambda: {"units": 0, "value": 0, "potential_revenue": 0, "count": 0, "expiring_value": 0, "dead_value": 0})
    today = date.today()

    for p in prods:
        c = p["category"]
        by_cat[c]["units"] += p["on_hand"]
        by_cat[c]["value"] += p["stock_value"]
        by_cat[c]["potential_revenue"] += p["potential_revenue"]
        by_cat[c]["count"] += 1
        if p["days_to_expiry"] is not None and p["days_to_expiry"] <= 30 and p["on_hand"] > 0:
            by_cat[c]["expiring_value"] += p["stock_value"]
        if p["movement_90d_count"] == 0 and p["on_hand"] > 0:
            by_cat[c]["dead_value"] += p["stock_value"]

    rows = [
        {
            "category": c,
            "units": v["units"],
            "value": round(v["value"], 2),
            "potential_revenue": round(v["potential_revenue"], 2),
            "potential_margin": round(v["potential_revenue"] - v["value"], 2),
            "margin_pct": round(((v["potential_revenue"] - v["value"]) / v["potential_revenue"] * 100) if v["potential_revenue"] > 0 else 0, 1),
            "product_count": v["count"],
            "expiring_value": round(v["expiring_value"], 2),
            "dead_value": round(v["dead_value"], 2),
            "avg_value_per_sku": round(v["value"] / v["count"], 2) if v["count"] else 0,
        }
        for c, v in by_cat.items()
    ]
    rows.sort(key=lambda r: -r["value"])
    total_value = sum(r["value"] for r in rows) or 1
    for r in rows:
        r["value_share_pct"] = round((r["value"] / total_value) * 100, 1)
    return {"items": rows, "total_value": round(total_value, 2)}


@router.get("/intelligence/smart-insights")
async def smart_insights(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
):
    """
    Natural-language insights derived from all signals — drop into the AI sidebar.
    Like a consultant looking at your numbers and calling out the key issues.
    """
    prods = await _products_with_signals(ctx, db)
    if not prods:
        return {"insights": [], "summary": "No product data yet."}

    insights = []
    today = date.today()
    total_value = sum(p["stock_value"] for p in prods) or 1

    # 1. Dead capital report
    dead_value = sum(p["stock_value"] for p in prods
                    if p["movement_90d_count"] == 0 and p["on_hand"] > 0)
    dead_pct = (dead_value / total_value) * 100
    if dead_pct > 5:
        insights.append({
            "tone": "warning",
            "icon": "Package",
            "title": f"{dead_pct:.0f}% of capital is stuck in dead stock",
            "body": f"You have ₹{dead_value:,.0f} in products that haven't moved in 90+ days. Recommend clearance campaigns — even at 30% discount, you recover capital faster than letting it sit.",
        })
    elif dead_pct > 0 and dead_pct <= 5:
        insights.append({
            "tone": "info",
            "icon": "Package",
            "title": f"{dead_pct:.1f}% capital in slow-movers (₹{dead_value:,.0f})",
            "body": "Manageable. Monitor these products quarterly and bundle them with fast-movers.",
        })

    # 2. Stock-out risks
    stocked_out = [p for p in prods if p["reorder_level"] > 0 and p["on_hand"] <= p["reorder_level"]]
    if len(stocked_out) > 3:
        insights.append({
            "tone": "critical",
            "icon": "AlertTriangle",
            "title": f"{len(stocked_out)} products at critical stock levels",
            "body": f"Top urgency items: " + ", ".join(p["name"][:25] for p in stocked_out[:3]) + ". Generate POs today to avoid lost sales.",
        })
    elif stocked_out:
        insights.append({
            "tone": "warning",
            "icon": "AlertTriangle",
            "title": f"{len(stocked_out)} product{'' if len(stocked_out) == 1 else 's'} need reordering",
            "body": ", ".join(p["name"][:30] for p in stocked_out[:3]) + ("..." if len(stocked_out) > 3 else "") + ". Review the Reorder Recommendations tab.",
        })

    # 3. Expiry risk
    near_expiry_value = sum(p["stock_value"] for p in prods
                            if p["days_to_expiry"] is not None and p["days_to_expiry"] <= 60 and p["on_hand"] > 0)
    if near_expiry_value > 0:
        insights.append({
            "tone": "warning",
            "icon": "Calendar",
            "title": f"₹{near_expiry_value:,.0f} in stock expiring within 60 days",
            "body": "Trigger a discount workflow (30% for 30-day window, 50% for 14-day) and prioritise for promotion in POS.",
        })

    # 4. Velocity winners
    movers = [p for p in prods if p["movement_30d_qty"] > 0]
    if movers:
        top = sorted(movers, key=lambda p: -p["movement_30d_qty"])[0]
        insights.append({
            "tone": "success",
            "icon": "TrendingUp",
            "title": f"{top['name'][:40]} is your top mover",
            "body": f"Moved {top['movement_30d_qty']} units in last 30 days ({top['movement_30d_count']} transactions). Make sure reorder buffer is generous — stock-outs here cost the most.",
        })

    # 5. Category concentration
    cat_value = defaultdict(float)
    for p in prods: cat_value[p["category"]] += p["stock_value"]
    if cat_value:
        sorted_cats = sorted(cat_value.items(), key=lambda x: -x[1])
        top_cat, top_val = sorted_cats[0]
        share = (top_val / total_value) * 100
        if share > 40:
            insights.append({
                "tone": "info",
                "icon": "PieChart",
                "title": f"{share:.0f}% of inventory value is in '{top_cat}'",
                "body": "Concentration risk — if this category experiences demand drop, your working capital is exposed. Consider diversifying SKU count.",
            })

    # 6. Pricing audit
    no_price = [p for p in prods if p["selling_price"] <= 0]
    if no_price:
        insights.append({
            "tone": "warning",
            "icon": "Tag",
            "title": f"{len(no_price)} product{'' if len(no_price) == 1 else 's'} have no selling price",
            "body": "These items can't be sold through POS. Either set prices or remove from active catalog.",
        })

    # 7. Capital velocity — how fast stock turns
    total_30d_revenue = sum(p["movement_30d_qty"] * p["selling_price"] for p in prods)
    if total_value > 0 and total_30d_revenue > 0:
        annualised = total_30d_revenue * 12
        turns = annualised / total_value
        insights.append({
            "tone": "info",
            "icon": "RotateCcw",
            "title": f"Estimated inventory turns: {turns:.1f}× per year",
            "body": f"At current pace, stock cycles {turns:.1f} times yearly. Retail best-practice is 6–12 turns; FMCG target is 12+.",
        })

    # 8. Positive signal
    active_pct = sum(1 for p in prods if p["movement_30d_count"] > 0) / len(prods) * 100
    if active_pct > 70:
        insights.append({
            "tone": "success",
            "icon": "Sparkles",
            "title": f"{active_pct:.0f}% of your catalog is actively moving",
            "body": "That's a healthy ratio. Most products have engaged with customers in the last 30 days — keep this above 60%.",
        })

    return {
        "insights": insights,
        "summary": f"{len(insights)} insights generated across {len(prods)} products.",
    }


@router.get("/intelligence/velocity-leaderboard")
async def velocity_leaderboard(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
    direction: str = "top",  # top | bottom
):
    """Sort products by velocity for performance review."""
    prods = await _products_with_signals(ctx, db)
    sorted_list = sorted(prods, key=lambda p: p["movement_30d_qty"], reverse=(direction == "top"))
    return {
        "items": sorted_list[:20],
        "direction": direction,
    }


@router.get("/intelligence/capital-distribution")
async def capital_distribution(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
):
    """Histogram of capital by stock-value bucket."""
    prods = await _products_with_signals(ctx, db)
    buckets = [
        {"label": "< ₹100",        "lo": 0,    "hi": 100,  "count": 0, "value": 0, "products": []},
        {"label": "₹100 – ₹500",   "lo": 100,  "hi": 500,  "count": 0, "value": 0, "products": []},
        {"label": "₹500 – ₹2K",    "lo": 500,  "hi": 2000, "count": 0, "value": 0, "products": []},
        {"label": "₹2K – ₹10K",    "lo": 2000, "hi": 10000, "count": 0, "value": 0, "products": []},
        {"label": "₹10K – ₹50K",   "lo": 10000, "hi": 50000, "count": 0, "value": 0, "products": []},
        {"label": "> ₹50K",        "lo": 50000, "hi": float("inf"), "count": 0, "value": 0, "products": []},
    ]
    for p in prods:
        for b in buckets:
            if b["lo"] <= p["stock_value"] < b["hi"]:
                b["count"] += 1
                b["value"] += p["stock_value"]
                if len(b["products"]) < 3:
                    b["products"].append({"name": p["name"], "sku": p["sku"], "value": p["stock_value"]})
                break
    for b in buckets:
        b["value"] = round(b["value"], 2)
    return {"buckets": buckets, "total_skus": len(prods)}


@router.get("/intelligence/summary")
async def intelligence_summary(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
):
    """
    One-shot endpoint — all signals packed into a single response.
    Powers the dashboard with one fetch.
    """
    health = await health_score(ctx, db)
    dead = await dead_stock(ctx, db)
    recs = await reorder_recommendations(ctx, db)
    insights = await smart_insights(ctx, db)
    breakdown = await category_breakdown(ctx, db)
    anomalies_data = await anomalies(ctx, db)

    return {
        "health": health,
        "dead_stock": dead,
        "reorder": recs,
        "insights": insights,
        "categories": breakdown,
        "anomalies": anomalies_data,
        "generated_at": datetime.utcnow().isoformat(),
    }
