"""Kitchen service tests — KOT lifecycle, bump/refire, device polling, metrics.

Runs against in-memory SQLite via the shared conftest.py helpers. The KOT
state machine is the thing to pin down: forward-only transitions plus the
deliberate exceptions (bump, refire) are where kitchen logic silently goes
wrong (a ticket "re-fired" from a served state is food the guest already
ate, and that is a data-integrity problem, not a UI one).

Run:  python -m pytest tests/test_kitchen.py -q
"""
from __future__ import annotations

import os
import uuid

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

os.environ.setdefault("APP_ENV", "test")

from src.services.kitchen import service as kitchen_svc  # noqa: E402
from src.services.kitchen.models import (  # noqa: E402
    KDSDevice,
    KOT,
    KOTItem,
    KOTItemStatus,
    KOTPriority,
    KOTStatus,
    KOTStatusLog,
    KitchenStation,
)
from conftest import _service_db  # noqa: E402

_engine, _tables, db = _service_db("kitchen", "src.services.kitchen.models")


async def _station(db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID) -> KitchenStation:
    station = KitchenStation(
        tenant_id=tenant_id, outlet_id=outlet_id,
        name="Fry Station", station_type="fry",
    )
    db.add(station)
    await db.flush()
    return station


async def _kot(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    station: KitchenStation,
    *,
    status: KOTStatus = KOTStatus.PENDING,
) -> KOT:
    order_id = uuid.uuid4()
    kot = KOT(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        order_id=order_id,
        order_number=f"ORD-{uuid.uuid4().hex[:6]}",
        station_id=station.id,
        kot_number=f"KOT-{uuid.uuid4().hex[:4].upper()}",
        status=status,
        priority=KOTPriority.NORMAL,
        fired_at=kitchen_svc._now(),
        covers=2,
        order_type="dine_in",
    )
    db.add(kot)
    await db.flush()
    db.add(KOTItem(
        tenant_id=tenant_id, kot_id=kot.id,
        station_id=station.id,
        name="Fried Item", qty=1, position=0,
        status=KOTItemStatus.PENDING,
    ))
    db.add(KOTStatusLog(
        tenant_id=tenant_id, kot_id=kot.id,
        from_status=None, to_status=status.value,
        reason="created for test",
    ))
    await db.flush()
    return kot


# ─── KOT lifecycle ─────────────────────────────────────────────────────────

class TestKotLifecycle:
    @pytest.mark.asyncio
    async def test_full_forward_lifecycle(self, db: AsyncSession):
        tenant_id, outlet_id = uuid.uuid4(), uuid.uuid4()
        station = await _station(db, tenant_id, outlet_id)
        kot = await _kot(db, tenant_id, outlet_id, station)

        kot = await kitchen_svc.update_kot_status(db, tenant_id, kot, KOTStatus.ACKNOWLEDGED)
        assert kitchen_svc.status_value(kot.status) == "acknowledged"
        assert kot.acknowledged_at is not None

        kot = await kitchen_svc.update_kot_status(db, tenant_id, kot, KOTStatus.PREPARING)
        assert kitchen_svc.status_value(kot.status) == "preparing"

        kot = await kitchen_svc.update_kot_status(db, tenant_id, kot, KOTStatus.READY)
        assert kot.ready_at is not None

        kot = await kitchen_svc.update_kot_status(db, tenant_id, kot, KOTStatus.SERVED)
        assert kot.served_at is not None

    @pytest.mark.asyncio
    async def test_illegal_transition_rejected(self, db: AsyncSession):
        tenant_id, outlet_id = uuid.uuid4(), uuid.uuid4()
        station = await _station(db, tenant_id, outlet_id)
        kot = await _kot(db, tenant_id, outlet_id, station)

        # PENDING -> READY skips ACKNOWLEDGED — the whole point of the
        # forward-only guardrail.
        with pytest.raises(kitchen_svc.KitchenError):
            await kitchen_svc.update_kot_status(db, tenant_id, kot, KOTStatus.READY)

    @pytest.mark.asyncio
    async def test_served_cannot_move_forward(self, db: AsyncSession):
        tenant_id, outlet_id = uuid.uuid4(), uuid.uuid4()
        station = await _station(db, tenant_id, outlet_id)
        kot = await kitchen_svc.load_kot(
            db, tenant_id, (await _kot(db, tenant_id, outlet_id, station, status=KOTStatus.SERVED)).id
        )

        with pytest.raises(kitchen_svc.KitchenError):
            await kitchen_svc.update_kot_status(db, tenant_id, kot, KOTStatus.READY)


# ─── Bump / rush / transfer ────────────────────────────────────────────────

class TestBump:
    @pytest.mark.asyncio
    async def test_priority_bump_is_logged(self, db: AsyncSession):
        tenant_id, outlet_id = uuid.uuid4(), uuid.uuid4()
        station = await _station(db, tenant_id, outlet_id)
        kot = await _kot(db, tenant_id, outlet_id, station)

        await kitchen_svc.bump_kot(
            db, tenant_id, kot, priority=KOTPriority.RUSH,
            changed_by=uuid.uuid4(), reason="VIP walk-in",
        )
        assert kitchen_svc.status_value(kot.priority) == "rush"
        # Re-load with items/logs eager, like the real API path does — a bare
        # ORM object from _kot() hasn't had those collections populated.
        reloaded = await kitchen_svc.load_kot(db, tenant_id, kot.id)
        logs = await kitchen_svc.kot_history(db, tenant_id, reloaded)
        assert any("VIP walk-in" in (l.reason or "") for l in logs)

    @pytest.mark.asyncio
    async def test_station_transfer_moves_items_too(self, db: AsyncSession):
        tenant_id, outlet_id = uuid.uuid4(), uuid.uuid4()
        station_a = await _station(db, tenant_id, outlet_id)
        station_b = await _station(db, tenant_id, outlet_id)
        station_b.name = "Curry Station"
        station_b.station_type = "curry"
        await db.flush()

        kot = await kitchen_svc.load_kot(db, tenant_id, (await _kot(db, tenant_id, outlet_id, station_a)).id)
        item = kot.items[0]
        assert item.station_id == station_a.id

        await kitchen_svc.bump_kot(
            db, tenant_id, kot, station_id=station_b.id,
            changed_by=uuid.uuid4(), reason="Fry station backed up",
        )
        assert kot.station_id == station_b.id
        await db.refresh(item)
        assert item.station_id == station_b.id, "items must follow the ticket"

    @pytest.mark.asyncio
    async def test_bump_with_nothing_set_is_rejected(self, db: AsyncSession):
        tenant_id, outlet_id = uuid.uuid4(), uuid.uuid4()
        station = await _station(db, tenant_id, outlet_id)
        kot = await _kot(db, tenant_id, outlet_id, station)

        with pytest.raises(kitchen_svc.KitchenError):
            await kitchen_svc.bump_kot(db, tenant_id, kot)


# ─── Re-fire ───────────────────────────────────────────────────────────────

class TestRefire:
    @pytest.mark.asyncio
    async def test_refire_only_works_on_cancelled(self, db: AsyncSession):
        tenant_id, outlet_id = uuid.uuid4(), uuid.uuid4()
        station = await _station(db, tenant_id, outlet_id)

        cancelled_id = (await _kot(db, tenant_id, outlet_id, station, status=KOTStatus.CANCELLED)).id
        cancelled = await kitchen_svc.load_kot(db, tenant_id, cancelled_id)
        await kitchen_svc.refire_kot(db, tenant_id, cancelled, reason="dropped on the way")
        assert kitchen_svc.status_value(cancelled.status) == "pending"
        assert cancelled.items[0].status == KOTItemStatus.PENDING

        served = await _kot(db, tenant_id, outlet_id, station, status=KOTStatus.SERVED)
        with pytest.raises(kitchen_svc.KitchenError) as exc:
            await kitchen_svc.refire_kot(db, tenant_id, served, reason="test")
        assert "Only a cancelled" in str(exc.value)


# ─── KDS device polling auth ────────────────────────────────────────────────

class TestKdsDevicePolling:
    @pytest.mark.asyncio
    async def test_device_token_resolves_its_station(self, db: AsyncSession):
        tenant_id, outlet_id = uuid.uuid4(), uuid.uuid4()
        station = await _station(db, tenant_id, outlet_id)

        token = uuid.uuid4().hex + uuid.uuid4().hex
        device = KDSDevice(
            tenant_id=tenant_id, outlet_id=outlet_id,
            station_id=station.id,
            name="Fry Pass",
            device_token=token,
        )
        db.add(device)
        await db.flush()

        resolved = await kitchen_svc.resolve_device_global(db, token)
        assert resolved is not None
        assert resolved.station_id == station.id
        assert resolved.tenant_id == tenant_id
        assert resolved.last_seen_at is not None, "poll stamps a heartbeat"

    @pytest.mark.asyncio
    async def test_unknown_token_returns_none(self, db: AsyncSession):
        resolved = await kitchen_svc.resolve_device_global(db, "not-a-real-token")
        assert resolved is None

    @pytest.mark.asyncio
    async def test_decommissioned_device_is_not_resolved(self, db: AsyncSession):
        tenant_id, outlet_id = uuid.uuid4(), uuid.uuid4()
        station = await _station(db, tenant_id, outlet_id)

        token = uuid.uuid4().hex
        device = KDSDevice(
            tenant_id=tenant_id, outlet_id=outlet_id,
            station_id=station.id,
            name="Old Pass",
            device_token=token,
            is_active=False,
        )
        db.add(device)
        await db.flush()

        assert await kitchen_svc.resolve_device_global(db, token) is None


# ─── Station metrics ───────────────────────────────────────────────────────

class TestStationMetrics:
    @pytest.mark.asyncio
    async def test_metrics_empty_window(self, db: AsyncSession):
        tenant_id, outlet_id = uuid.uuid4(), uuid.uuid4()
        station = await _station(db, tenant_id, outlet_id)

        result = await kitchen_svc.station_metrics(db, tenant_id, station.id)
        assert result["tickets_completed"] == 0
        assert result["avg_prep_minutes"] is None

    @pytest.mark.asyncio
    async def test_metrics_completes_over_window(self, db: AsyncSession):
        tenant_id, outlet_id = uuid.uuid4(), uuid.uuid4()
        station = await _station(db, tenant_id, outlet_id)

        from datetime import timedelta
        now = kitchen_svc._now()
        kot = KOT(
            tenant_id=tenant_id, outlet_id=outlet_id,
            order_id=uuid.uuid4(),
            station_id=station.id,
            kot_number=f"KOT-{uuid.uuid4().hex[:4].upper()}",
            status=KOTStatus.READY,
            fired_at=now - timedelta(minutes=15),
            ready_at=now - timedelta(minutes=5),
        )
        db.add(kot)
        await db.flush()

        result = await kitchen_svc.station_metrics(db, tenant_id, station.id)
        assert result["tickets_completed"] == 1
        assert result["avg_prep_minutes"] == 10.0


if __name__ == "__main__":
    import sys
    sys.exit(pytest.main([__file__, "-q"]))
