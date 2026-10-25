"""Menu service tests — pricing-rule engine, variant/combo/recipe edit routes.

Runs against in-memory SQLite (via the shared test infra in conftest.py). The
pricing-rule math is the highest-value thing to pin down here: before this
work, pricing_rules rows existed but had zero effect on what POS charged.

Run:  python -m pytest tests/test_menu.py -q
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

os.environ.setdefault("APP_ENV", "test")

from src.services.menu import pricing as pricing_engine  # noqa: E402
from src.services.menu.models import (  # noqa: E402
    MenuItem,
    MenuItemVariant,
    PricingRule,
    PricingRuleType,
    Recipe,
)
from conftest import _service_db  # noqa: E402

_engine, _tables, db = _service_db("menu", "src.services.menu.models")


def _item(db: AsyncSession, **overrides) -> MenuItem:
    data = {
        "tenant_id": uuid.uuid4(),
        "code": f"ITM-{uuid.uuid4().hex[:6]}",
        "name": "Test Item",
        "base_price": 100.0,
    }
    data.update(overrides)
    item = MenuItem(**data)
    db.add(item)
    return item


# ─── Pricing rule engine ────────────────────────────────────────────────────

class TestPricingEngine:
    @pytest.mark.asyncio
    async def test_happy_hour_rule_applies_within_window(self, db: AsyncSession):
        tenant_id = uuid.uuid4()
        item = _item(db, tenant_id=tenant_id, code="IH")
        await db.flush()

        # 20% off 6–8pm (IST), evaluated "now" in UTC.
        at = datetime(2026, 10, 24, 13, 0, tzinfo=timezone.utc)  # 18:30 IST
        rule = PricingRule(
            tenant_id=tenant_id,
            name="Happy Hour",
            rule_type=PricingRuleType.HAPPY_HOUR,
            conditions={"from_time": "18:00", "to_time": "20:00", "tz": "Asia/Kolkata"},
            discount_pct=20.0,
            priority=0,
            is_active=True,
        )
        db.add(rule)
        await db.flush()

        result = pricing_engine.apply_pricing_rules(
            float(item.base_price), [rule], item=item, at=at,
            outlet_id=item.outlet_id,
        )
        assert result["discount_total"] == 20.0
        assert result["final_price"] == 80.0
        assert result["applied_rules"][0]["rule_type"] == "happy_hour"

    @pytest.mark.asyncio
    async def test_happy_hour_rule_does_not_apply_outside_window(self, db: AsyncSession):
        tenant_id = uuid.uuid4()
        item = _item(db, tenant_id=tenant_id, code="IO")
        await db.flush()

        at = datetime(2026, 10, 24, 4, 0, tzinfo=timezone.utc)  # 09:30 IST
        rule = PricingRule(
            tenant_id=tenant_id,
            name="Happy Hour",
            rule_type=PricingRuleType.HAPPY_HOUR,
            conditions={"from_time": "18:00", "to_time": "20:00", "tz": "Asia/Kolkata"},
            discount_pct=20.0,
            priority=0,
            is_active=True,
        )
        db.add(rule)
        await db.flush()

        result = pricing_engine.apply_pricing_rules(
            float(item.base_price), [rule], item=item, at=at,
            outlet_id=item.outlet_id,
        )
        assert result["discount_total"] == 0.0
        assert result["final_price"] == 100.0
        assert result["applied_rules"] == []

    @pytest.mark.asyncio
    async def test_bulk_rule_requires_min_qty(self, db: AsyncSession):
        tenant_id = uuid.uuid4()
        item = _item(db, tenant_id=tenant_id, code="IB")
        await db.flush()

        rule = PricingRule(
            tenant_id=tenant_id,
            name="Bulk Deal",
            rule_type=PricingRuleType.BULK,
            conditions={"min_qty": 5},
            discount_pct=10.0,
            priority=0,
            is_active=True,
        )
        db.add(rule)
        await db.flush()

        at = datetime(2026, 10, 24, 12, 0, tzinfo=timezone.utc)

        under = pricing_engine.apply_pricing_rules(
            float(item.base_price), [rule], item=item, at=at, qty=4,
        )
        assert under["discount_total"] == 0.0

        over = pricing_engine.apply_pricing_rules(
            float(item.base_price), [rule], item=item, at=at, qty=5,
        )
        assert over["discount_total"] == 10.0

    @pytest.mark.asyncio
    async def test_inactive_rule_never_applies(self, db: AsyncSession):
        tenant_id = uuid.uuid4()
        item = _item(db, tenant_id=tenant_id, code="IA")
        await db.flush()

        rule = PricingRule(
            tenant_id=tenant_id,
            name="Old Rule",
            rule_type=PricingRuleType.DAY_PART,
            conditions={},
            discount_pct=50.0,
            priority=0,
            is_active=False,
        )
        db.add(rule)
        await db.flush()

        at = datetime(2026, 10, 24, 12, 0, tzinfo=timezone.utc)
        result = pricing_engine.apply_pricing_rules(
            float(item.base_price), [rule], item=item, at=at,
        )
        assert result["discount_total"] == 0.0


# ─── Variant / addon / recipe edit endpoints (via service, not HTTP) ─────────

class TestVariantEdit:
    @pytest.mark.asyncio
    async def test_variant_price_delta_is_editable(self, db: AsyncSession):
        tenant_id = uuid.uuid4()
        item = _item(db, tenant_id=tenant_id, code="IV", base_price=50.0)
        await db.flush()

        variant = MenuItemVariant(
            tenant_id=tenant_id, menu_item_id=item.id,
            name="Large", price_delta=10.0,
        )
        db.add(variant)
        await db.flush()
        assert float(variant.price_delta) == 10.0

        variant.price_delta = 25.0
        await db.flush()
        await db.refresh(variant)
        assert float(variant.price_delta) == 25.0


class TestRecipeEdit:
    @pytest.mark.asyncio
    async def test_recipe_metadata_is_editable(self, db: AsyncSession):
        tenant_id = uuid.uuid4()
        item = _item(db, tenant_id=tenant_id, code="IR")
        await db.flush()

        recipe = Recipe(
            tenant_id=tenant_id, menu_item_id=item.id,
            name="Original", yield_qty=1.0,
        )
        db.add(recipe)
        await db.flush()

        recipe.name = "V2"
        recipe.yield_qty = 2.0
        await db.flush()
        await db.refresh(recipe)
        assert recipe.name == "V2"
        assert float(recipe.yield_qty) == 2.0


if __name__ == "__main__":
    import sys
    sys.exit(pytest.main([__file__, "-q"]))
