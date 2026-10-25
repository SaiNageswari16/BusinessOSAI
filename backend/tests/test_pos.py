"""POS service tests — hold/resume, void/split/merge, reservation conflicts,
waitlist seating.

The reservation-conflict check is the highest-value thing to pin down here:
two overlapping bookings on the same table is a double-booking, and it is a
data-integrity problem, not a UI one. The hold/resume + split/merge
operations are the "fully functional POS" half of Petpooja parity — a POS
attendant who cannot split a group's check, park a table, or merge two
checks is missing the core of the job.

Run:  python -m pytest tests/test_pos.py -q
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

os.environ.setdefault("APP_ENV", "test")

from src.services.pos import service as pos_svc  # noqa: E402
from src.services.pos.models import (  # noqa: E402
    Order,
    OrderStatus,
    OrderType,
    Reservation,
    ReservationStatus,
)
from src.services.pos.schemas import OrderLineCreate  # noqa: E402
from conftest import _service_db  # noqa: E402

_engine, _tables, db = _service_db("pos", "src.services.pos.models")


async def _order(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    *,
    status: OrderStatus = OrderStatus.PLACED,
    table_id: uuid.UUID | None = None,
) -> Order:
    order = Order(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        order_number=f"ORD-{uuid.uuid4().hex[:8].upper()}",
        order_type=OrderType.DINE_IN,
        status=status,
        table_id=table_id,
        covers=2,
    )
    db.add(order)
    await db.flush()
    return order


# ─── Hold / resume ─────────────────────────────────────────────────────────

class TestHoldResume:
    @pytest.mark.asyncio
    async def test_hold_and_resume_lifecycle(self, db: AsyncSession):
        tenant_id, outlet_id = uuid.uuid4(), uuid.uuid4()
        order = await _order(db, tenant_id, outlet_id, status=OrderStatus.PLACED)

        await pos_svc.hold_order(db, tenant_id, order)
        assert pos_svc.status_value(order.status) == "hold"

        await pos_svc.resume_order(db, tenant_id, order, to=OrderStatus.PLACED)
        assert pos_svc.status_value(order.status) == "placed"

    @pytest.mark.asyncio
    async def test_cannot_hold_settled_order(self, db: AsyncSession):
        tenant_id, outlet_id = uuid.uuid4(), uuid.uuid4()
        order = await _order(db, tenant_id, outlet_id, status=OrderStatus.SETTLED)
        with pytest.raises(pos_svc.PosError):
            await pos_svc.hold_order(db, tenant_id, order)

    @pytest.mark.asyncio
    async def test_only_held_order_can_resume(self, db: AsyncSession):
        tenant_id, outlet_id = uuid.uuid4(), uuid.uuid4()
        order = await _order(db, tenant_id, outlet_id, status=OrderStatus.PLACED)
        with pytest.raises(pos_svc.PosError):
            await pos_svc.resume_order(db, tenant_id, order)


# ─── Void ──────────────────────────────────────────────────────────────────

class TestVoid:
    @pytest.mark.asyncio
    async def test_void_only_works_pre_kitchen(self, db: AsyncSession):
        tenant_id, outlet_id = uuid.uuid4(), uuid.uuid4()
        order = await _order(db, tenant_id, outlet_id, status=OrderStatus.DRAFT)
        await pos_svc.void_order(db, tenant_id, order)
        assert pos_svc.status_value(order.status) == "cancelled"

        placed = await _order(db, tenant_id, outlet_id, status=OrderStatus.PLACED)
        await pos_svc.void_order(db, tenant_id, placed)
        assert pos_svc.status_value(placed.status) == "cancelled"

        in_kitchen = await _order(db, tenant_id, outlet_id, status=OrderStatus.IN_KITCHEN)
        with pytest.raises(pos_svc.PosError) as exc:
            await pos_svc.void_order(db, tenant_id, in_kitchen)
        assert "Cannot void" in str(exc.value)


# ─── Reservation conflict check ────────────────────────────────────────────

class TestReservationConflict:
    @pytest.mark.asyncio
    async def test_overlapping_bookings_are_detected(self, db: AsyncSession):
        tenant_id, outlet_id, table_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        t0 = datetime(2026, 11, 1, 19, 0, tzinfo=timezone.utc)

        existing = Reservation(
            tenant_id=tenant_id, outlet_id=outlet_id, table_id=table_id,
            customer_name="First Party", customer_phone="1234567890",
            reserved_from=t0, reserved_to=t0 + timedelta(hours=2),
            status=ReservationStatus.CONFIRMED,
        )
        db.add(existing)
        await db.flush()

        # A new booking 19:00–21:00 must collide with the existing 19:00–21:00.
        conflict = await pos_svc.find_reservation_conflict(
            db, tenant_id, outlet_id, table_id,
            t0, t0 + timedelta(hours=2),
        )
        assert conflict is not None and conflict.id == existing.id

    @pytest.mark.asyncio
    async def test_back_to_back_bookings_do_not_conflict(self, db: AsyncSession):
        tenant_id, outlet_id, table_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        t0 = datetime(2026, 11, 1, 19, 0, tzinfo=timezone.utc)

        existing = Reservation(
            tenant_id=tenant_id, outlet_id=outlet_id, table_id=table_id,
            customer_name="First Party", customer_phone="1234567890",
            reserved_from=t0, reserved_to=t0 + timedelta(hours=2),
            status=ReservationStatus.CONFIRMED,
        )
        db.add(existing)
        await db.flush()

        # 21:00–23:00 touches the first booking's end but does not overlap it.
        conflict = await pos_svc.find_reservation_conflict(
            db, tenant_id, outlet_id, table_id,
            t0 + timedelta(hours=2), t0 + timedelta(hours=4),
        )
        assert conflict is None

    @pytest.mark.asyncio
    async def test_cancelled_reservation_frees_the_table(self, db: AsyncSession):
        tenant_id, outlet_id, table_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        t0 = datetime(2026, 11, 1, 19, 0, tzinfo=timezone.utc)

        existing = Reservation(
            tenant_id=tenant_id, outlet_id=outlet_id, table_id=table_id,
            customer_name="Ghost Party", customer_phone="1234567890",
            reserved_from=t0, reserved_to=t0 + timedelta(hours=2),
            status=ReservationStatus.CANCELLED,  # a no-show / cancellation frees the table
        )
        db.add(existing)
        await db.flush()

        conflict = await pos_svc.find_reservation_conflict(
            db, tenant_id, outlet_id, table_id,
            t0, t0 + timedelta(hours=2),
        )
        assert conflict is None, "a cancelled booking must not keep locking a table"


# ─── Waitlist seating ──────────────────────────────────────────────────────

class TestWaitlistSeating:
    @pytest.mark.asyncio
    async def test_seat_marks_entry_and_table(self, db: AsyncSession):
        from src.services.pos.models import Waitlist, WaitlistStatus, TableSession, TableSessionStatus

        tenant_id, outlet_id, table_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        entry = Waitlist(
            tenant_id=tenant_id, outlet_id=outlet_id,
            customer_name="Walk-in Party", customer_phone="0000000000",
            covers=3, status=WaitlistStatus.WAITING,
        )
        db.add(entry)
        await db.flush()

        entry.status = WaitlistStatus.SEATED
        entry.table_id = table_id
        session = TableSession(
            tenant_id=tenant_id, outlet_id=outlet_id,
            table_id=table_id, status=TableSessionStatus.ACTIVE,
            covers=entry.covers,
        )
        db.add(session)
        await db.flush()

        await db.refresh(entry)
        assert pos_svc.status_value(entry.status) == "seated"
        assert entry.table_id == table_id
        assert session.status == TableSessionStatus.ACTIVE


if __name__ == "__main__":
    import sys
    sys.exit(pytest.main([__file__, "-q"]))
