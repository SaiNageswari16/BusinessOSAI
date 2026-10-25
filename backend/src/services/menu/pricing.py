"""The pricing-rule engine — the part of the menu service that turns stored
``pricing_rules`` rows into an actual discount for a priced item.

Today (pre-this-file) the rules were stored but never consulted: a
happy-hour/day-part/seasonal/bulk row existed in the database and had no
effect on what POS was charged. This module closes that gap. It is kept
separate from ``api.py`` so the pure matching math is unit-testable without a
FastAPI app.
"""
from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from src.services.menu.models import MenuItem, PricingRule, PricingRuleType


def _rule_active_now(rule: PricingRule, *, at: datetime, outlet_id) -> bool:
    """A rule applies only if it is active and scoped to this outlet (or
    unscoped). outlet_id==None matches only unscoped rules — an outlet
    request never sees a rule pinned to a different outlet."""
    if not rule.is_active:
        return False
    if rule.outlet_id is not None and rule.outlet_id != outlet_id:
        return False
    return True


def _time_window_contains(conditions: dict, at: datetime) -> bool:
    """``from_time``/``to_time`` in ``HH:MM`` local time, same day. No window
    means "always"."""
    from_t = conditions.get("from_time")
    to_t = conditions.get("to_time")
    if from_t is None and to_t is None:
        return True

    target_tz = conditions.get("tz") or "Asia/Kolkata"
    try:
        local_at = at.astimezone(ZoneInfo(target_tz))
    except Exception:
        local_at = at

    def _parse(s: str) -> time:
        hh, mm = s.split(":")
        return time(int(hh), int(mm))

    start = _parse(from_t) if from_t else local_at.time()
    end = _parse(to_t) if to_t else local_at.time()
    return start <= local_at.time() <= end


def _day_part_matches(conditions: dict, at: datetime) -> bool:
    """``day_parts``: a list of daypart names (["lunch"], ["dinner"], …).
    Each name maps to a fixed window; a request inside any listed window
    matches. No ``day_parts`` key means "no day-part restriction"."""
    parts = conditions.get("day_parts")
    if not parts:
        return True

    local_tz = conditions.get("tz") or "Asia/Kolkata"
    try:
        local_at = at.astimezone(ZoneInfo(local_tz))
    except Exception:
        local_at = at
    now = local_at.time()

    WINDOWS = {
        "breakfast": (time(6), time(11)),
        "lunch": (time(11), time(16)),
        "afternoon": (time(16), time(18)),
        "dinner": (time(18), time(23)),
        "late_night": (time(23), time(24)),
    }
    for name in parts:
        lo, hi = WINDOWS.get(str(name).lower(), (time(0), time(23, 59)))
        if lo <= now <= hi:
            return True
    return False


def _seasonal_window_matches(conditions: dict, at: datetime) -> bool:
    """``valid_from``/``valid_to`` ISO dates (YYYY-MM-DD). No window =
    always."""
    valid_from = conditions.get("valid_from")
    valid_to = conditions.get("valid_to")
    if valid_from is None and valid_to is None:
        return True
    day = at.date()
    if valid_from and day < datetime.fromisoformat(valid_from).date():
        return False
    if valid_to and day > datetime.fromisoformat(valid_to).date():
        return False
    return True


def _bulk_matches(conditions: dict, qty: int) -> bool:
    """``min_qty``: the whole-order quantity threshold for a bulk discount.
    No ``min_qty`` means "no bulk restriction"."""
    min_qty = conditions.get("min_qty")
    if min_qty is None:
        return True
    return qty >= int(min_qty)


def rule_applies(
    rule: PricingRule,
    *,
    item: MenuItem,
    at: datetime,
    outlet_id,
    qty: int = 1,
) -> bool:
    """Does this one rule apply to this item, right now, at this outlet?

    ``conditions`` is a free-form JSONB body, but this module only understands
    a fixed set of keys — everything else is ignored, so new rule conditions
    can be added to the UI without breaking existing rules.
    """
    if not _rule_active_now(rule, at=at, outlet_id=outlet_id):
        return False

    conditions = rule.conditions or {}

    # A rule can target specific items (by code) — everything else applies to
    # the whole outlet/tenant.
    target_codes = conditions.get("target_item_codes")
    if target_codes and item.code not in target_codes:
        return False

    matchers = {
        PricingRuleType.HAPPY_HOUR: _time_window_contains,
        PricingRuleType.DAY_PART: _day_part_matches,
        PricingRuleType.SEASONAL: _seasonal_window_matches,
        PricingRuleType.BULK: lambda c, t: _bulk_matches(c, qty),
    }
    matcher = matchers.get(rule.rule_type, lambda c, t: True)
    return matcher(conditions, at)


def apply_pricing_rules(
    base_price: float,
    rules: list[PricingRule],
    *,
    item: MenuItem,
    at: datetime | None = None,
    outlet_id=None,
    qty: int = 1,
) -> dict:
    """Discount ``base_price`` by the matching rules.

    Rules are independent price modifiers that compose additively on the
    original base (not cascaded off one another), so the math is stable no
    matter how many rules match. Higher ``priority`` wins on a tie only in the
    sense that it's evaluated first; there is no "only one rule may apply"
    semantics here — Petpooja's happy hour and a bulk deal can both be live
    at once and both should discount.
    """
    at = at or datetime.now(timezone.utc)

    applicable = [
        r for r in rules
        if rule_applies(r, item=item, at=at, outlet_id=outlet_id, qty=qty)
    ]
    applicable.sort(key=lambda r: r.priority, reverse=True)

    total_discount = 0.0
    applied = []
    for rule in applicable:
        discount = base_price * (float(rule.discount_pct) / 100.0)
        total_discount += discount
        applied.append({
            "rule_id": str(rule.id),
            "name": rule.name,
            "rule_type": rule.rule_type.value,
            "discount_pct": float(rule.discount_pct),
            "discount_amount": round(discount, 2),
        })

    return {
        "base_price": round(base_price, 2),
        "discount_total": round(total_discount, 2),
        "final_price": round(max(base_price - total_discount, 0.0), 2),
        "applied_rules": applied,
    }
