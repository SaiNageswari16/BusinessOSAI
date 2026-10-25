"""Organization service tests — hierarchy, floor plans, royalty, bulk status.

Runs against in-memory SQLite. The organization service's models register on
a service-specific declarative base (``service_base("organization")``); the
schema is created from that base's own metadata so no other service's tables
get pulled in.

Run:  python -m pytest tests/test_organization.py -q
"""
from __future__ import annotations

import os
import uuid
from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

os.environ.setdefault("APP_ENV", "test")

from src.services.organization import service as org_svc  # noqa: E402
from src.services.organization.models import (  # noqa: E402
    EnterpriseBrand,
    Outlet,
    OwnershipType,
    Section,
    TableStatus,
    Tenant,
    TenantStatus,
)
from src.services.organization.schemas import RoyaltyAgreementCreate  # noqa: E402
from conftest import _service_db  # noqa: E402

_engine, _tables, db = _service_db("organization", "src.services.organization.models")


async def _tenant(db: AsyncSession, slug: str = "org-test") -> Tenant:
    t = Tenant(name="Org Test", slug=slug, status=TenantStatus.ACTIVE)
    db.add(t)
    await db.flush()
    return t


async def _outlet(db: AsyncSession, tenant: Tenant, *, code: str = "O1") -> Outlet:
    o = Outlet(
        tenant_id=tenant.id,
        name="Outlet One",
        code=code,
        ownership_type=OwnershipType.DIRECT,
    )
    db.add(o)
    await db.flush()
    return o


# ─── Hierarchy: brand → outlet → section → table ───────────────────────────

class TestHierarchy:
    @pytest.mark.asyncio
    async def test_brand_outlet_section_table_chain(self, db: AsyncSession):
        tenant = await _tenant(db)

        brand = await org_svc.create_brand(
            db, tenant_id=tenant.id,
            data={"name": "Sunrise Group", "code": "SG"},
        )
        outlet = await org_svc.create_outlet(
            db, tenant_id=tenant.id,
            data={"name": "Sunrise Banjara", "code": "SB"},
        )
        outlet.brand_id = brand.id
        outlet.ownership_type = OwnershipType.FRANCHISE
        await db.flush()
        assert outlet.brand_id == brand.id

        section = await org_svc.create_section(
            db, outlet=outlet,
            data={"name": "AC Hall", "section_type": "ac_hall", "capacity": 40},
        )
        table = await org_svc.create_table(
            db, outlet=outlet,
            data={
                "code": "T-1", "name": "Table 1", "section_id": section.id,
                "size_w": 120.0, "size_h": 80.0, "rotation": 45.0, "label": "VIP",
                "position_x": 10.0, "position_y": 20.0,
            },
        )
        assert table.section_id == section.id
        assert table.rotation == 45.0

    @pytest.mark.asyncio
    async def test_parent_child_outlet(self, db: AsyncSession):
        tenant = await _tenant(db)
        hub = await org_svc.create_outlet(
            db, tenant_id=tenant.id,
            data={"name": "Central", "code": "HUB", "ownership_type": "hub"},
        )
        spoke = await org_svc.create_outlet(
            db, tenant_id=tenant.id,
            data={"name": "Branch 1", "code": "SPK", "parent_outlet_id": hub.id,
                  "ownership_type": "spoke"},
        )
        assert spoke.parent_outlet_id == hub.id


# ─── Section deletion guardrail ────────────────────────────────────────────

class TestSectionDeletion:
    @pytest.mark.asyncio
    async def test_delete_section_refused_while_tables_reference_it(self, db: AsyncSession):
        tenant = await _tenant(db)
        outlet = await _outlet(db, tenant)
        section = await org_svc.create_section(
            db, outlet=outlet, data={"name": "AC", "section_type": "ac_hall"}
        )
        await org_svc.create_table(
            db, outlet=outlet,
            data={"code": "T-1", "name": "Table 1", "section_id": section.id},
        )

        with pytest.raises(HTTPException) as exc:
            await org_svc.delete_section(db, section, force=False)
        assert exc.value.status_code == 409

        await org_svc.delete_section(db, section, force=True)  # unassigns tables

    @pytest.mark.asyncio
    async def test_delete_empty_section_succeeds(self, db: AsyncSession):
        tenant = await _tenant(db)
        outlet = await _outlet(db, tenant)
        section = await org_svc.create_section(
            db, outlet=outlet, data={"name": "Terrace"}
        )
        await org_svc.delete_section(db, section, force=False)  # no tables, no 409


# ─── Bulk status ────────────────────────────────────────────────────────────

class TestBulkStatus:
    @pytest.mark.asyncio
    async def test_bulk_set_status_counts_only_actual_changes(self, db: AsyncSession):
        tenant = await _tenant(db)
        outlet = await _outlet(db, tenant)
        ids = []
        for i in range(3):
            t = await org_svc.create_table(
                db, outlet=outlet, data={"code": f"T-{i}", "name": f"Table {i}"}
            )
            ids.append(t.id)

        result = await org_svc.bulk_set_table_status(
            db, tenant.id, ids, "occupied"
        )
        assert result["changed"] == 3

        # All already "occupied" now — a second identical call changes nothing.
        result2 = await org_svc.bulk_set_table_status(
            db, tenant.id, ids, "occupied"
        )
        assert result2["changed"] == 0


# ─── Floor plan snapshot / restore ─────────────────────────────────────────

class TestFloorPlans:
    @pytest.mark.asyncio
    async def test_snapshot_and_restore(self, db: AsyncSession):
        tenant = await _tenant(db)
        outlet = await _outlet(db, tenant)
        table = await org_svc.create_table(
            db, outlet=outlet,
            data={"code": "T-1", "name": "Table 1", "size_w": 100.0, "size_h": 50.0},
        )

        plan = await org_svc.snapshot_floor_plan(db, outlet, name="default")
        assert plan.layout["tables"][0]["code"] == "T-1"

        # Mutate the live table, then restore the snapshot back onto it.
        table.size_w = 999.0
        table.position_x = 500.0
        await db.flush()

        result = await org_svc.restore_floor_plan(db, tenant.id, outlet.id, plan.id)
        assert result["applied"] == 1
        await db.refresh(table)
        assert table.size_w == 100.0, "restore should put the snapshot value back"


# ─── Royalty ────────────────────────────────────────────────────────────────

class TestRoyalty:
    @pytest.mark.asyncio
    async def test_rate_based_settlement_math(self, db: AsyncSession):
        tenant = await _tenant(db)
        brand = await org_svc.create_brand(
            db, tenant_id=tenant.id, data={"name": "SG", "code": "SG"}
        )
        outlet = await _outlet(db, tenant)

        agreement = await org_svc.create_royalty_agreement(
            db,
            tenant_id=tenant.id,
            data={
                "brand_id": brand.id,
                "outlet_id": outlet.id,
                "rate_pct": Decimal("5.00"),
                "period": "monthly",
                "effective_from": date(2026, 1, 1),
            },
        )

        settlement = await org_svc.settle_royalty(
            db,
            tenant_id=tenant.id,
            agreement_id=agreement.id,
            period_start=date(2026, 1, 1),
            period_end=date(2026, 1, 31),
            base_amount=Decimal("200000"),
        )
        # 5% of 200000 = 10000.00
        assert settlement.amount == Decimal("10000.00")

    @pytest.mark.asyncio
    async def test_fixed_fee_settlement(self, db: AsyncSession):
        tenant = await _tenant(db)
        brand = await org_svc.create_brand(
            db, tenant_id=tenant.id, data={"name": "SG2", "code": "SG2"}
        )
        outlet = await _outlet(db, tenant, code="O2")

        agreement = await org_svc.create_royalty_agreement(
            db,
            tenant_id=tenant.id,
            data={
                "brand_id": brand.id,
                "outlet_id": outlet.id,
                "fixed_amount": Decimal("25000"),
                "period": "monthly",
                "effective_from": date(2026, 1, 1),
            },
        )
        settlement = await org_svc.settle_royalty(
            db,
            tenant_id=tenant.id,
            agreement_id=agreement.id,
            period_start=date(2026, 1, 1),
            period_end=date(2026, 1, 31),
        )
        assert settlement.amount == Decimal("25000")

    @pytest.mark.asyncio
    async def test_duplicate_settlement_for_same_window_is_409(self, db: AsyncSession):
        tenant = await _tenant(db)
        brand = await org_svc.create_brand(
            db, tenant_id=tenant.id, data={"name": "SG3", "code": "SG3"}
        )
        outlet = await _outlet(db, tenant, code="O3")
        agreement = await org_svc.create_royalty_agreement(
            db,
            tenant_id=tenant.id,
            data={
                "brand_id": brand.id,
                "outlet_id": outlet.id,
                "fixed_amount": Decimal("1000"),
                "period": "monthly",
                "effective_from": date(2026, 1, 1),
            },
        )
        await org_svc.settle_royalty(
            db, tenant_id=tenant.id, agreement_id=agreement.id,
            period_start=date(2026, 1, 1), period_end=date(2026, 1, 31),
        )
        with pytest.raises(HTTPException) as exc:
            await org_svc.settle_royalty(
                db, tenant_id=tenant.id, agreement_id=agreement.id,
                period_start=date(2026, 1, 1), period_end=date(2026, 1, 31),
            )
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_agreement_must_have_exactly_one_basis(self, db: AsyncSession):
        with pytest.raises(ValueError):
            RoyaltyAgreementCreate(
                brand_id=uuid.uuid4(),
                outlet_id=uuid.uuid4(),
                effective_from=date(2026, 1, 1),
            )  # neither rate_pct nor fixed_amount
        with pytest.raises(ValueError):
            RoyaltyAgreementCreate(
                brand_id=uuid.uuid4(),
                outlet_id=uuid.uuid4(),
                rate_pct=Decimal("5"),
                fixed_amount=Decimal("100"),
                effective_from=date(2026, 1, 1),
            )  # both


if __name__ == "__main__":
    import sys
    sys.exit(pytest.main([__file__, "-q"]))
