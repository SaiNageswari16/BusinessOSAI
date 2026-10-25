"""Purchase service tests — P2P chain correctness: received_qty accumulation,
three-way match, over-receipt guard.

The accumulated ``received_qty`` on PO lines is the single most consequential
thing to pin down here: without it, a PO with two partial GRNs cannot be
tracked, the PO status can never move to PARTIAL/RECEIVED on real data, and
the whole "did we get what we ordered" check is impossible.

Run:  python -m pytest tests/test_purchase.py -q
"""
from __future__ import annotations

import os
import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

os.environ.setdefault("APP_ENV", "test")

from src.services.purchase import service as purchase_svc  # noqa: E402
from src.services.purchase.models import (  # noqa: E402
    GoodsReceiptNote,
    GRNLine,
    GRNStatus,
    POStatus,
    PurchaseOrder,
    PurchaseOrderLine,
    Vendor,
    VendorBillStatus,
)
from src.services.purchase.schemas import GRNLineIn, POLineIn  # noqa: E402
from conftest import _service_db  # noqa: E402

_engine, _tables, db = _service_db("purchase", "src.services.purchase.models")


async def _vendor(db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID) -> Vendor:
    v = Vendor(tenant_id=tenant_id, outlet_id=outlet_id,
               name="Test Vendor", code=f"V-{uuid.uuid4().hex[:6]}")
    db.add(v)
    await db.flush()
    return v


async def _po(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    vendor: Vendor,
    *,
    lines: list[dict] | None = None,
) -> PurchaseOrder:
    if lines is None:
        lines = [
            {"inventory_item_id": str(uuid.uuid4()), "ordered_qty": 10.0, "unit_price": 50.0},
        ]
    po_lines_in = [POLineIn(**l) for l in lines]
    return await purchase_svc.create_order(
        db, tenant_id, outlet_id, vendor.id, po_lines_in,
    )


# ─── The received_qty accumulation bug (the big one) ───────────────────────

class TestReceivedQtyAccumulation:
    @pytest.mark.asyncio
    async def test_partial_grn_marks_po_partial_not_received(self, db: AsyncSession):
        tenant_id, outlet_id = uuid.uuid4(), uuid.uuid4()
        vendor = await _vendor(db, tenant_id, outlet_id)
        po = await _po(db, tenant_id, outlet_id, vendor)
        po_line = (await db.execute(
            select(PurchaseOrderLine).where(PurchaseOrderLine.purchase_order_id == po.id)
        )).scalars().one()

        grn_lines = [GRNLineIn(
            inventory_item_id=po_line.inventory_item_id,
            received_qty=4.0,
            accepted_qty=4.0,
            rejected_qty=0.0,
            unit_price=50.0,
        )]
        await purchase_svc.create_grn(db, tenant_id, po, grn_lines)

        await db.refresh(po_line)
        assert float(po_line.received_qty) == 4.0, "the accumulation this whole module was missing"
        assert status_is(po.status, POStatus.PARTIAL)
        assert float(po_line.ordered_qty) - float(po_line.received_qty) == 6.0

    @pytest.mark.asyncio
    async def test_two_partial_grns_accumulate_to_full_receipt(self, db: AsyncSession):
        tenant_id, outlet_id = uuid.uuid4(), uuid.uuid4()
        vendor = await _vendor(db, tenant_id, outlet_id)
        po = await _po(db, tenant_id, outlet_id, vendor)
        po_line = (await db.execute(
            select(PurchaseOrderLine).where(PurchaseOrderLine.purchase_order_id == po.id)
        )).scalars().one()

        grn1 = await purchase_svc.create_grn(db, tenant_id, po, [
            GRNLineIn(inventory_item_id=po_line.inventory_item_id,
                         received_qty=6.0, accepted_qty=6.0, rejected_qty=0.0,
                         unit_price=50.0),
        ])
        await db.refresh(po_line)
        assert float(po_line.received_qty) == 6.0
        assert status_is(po.status, POStatus.PARTIAL)

        grn2 = await purchase_svc.create_grn(db, tenant_id, po, [
            GRNLineIn(inventory_item_id=po_line.inventory_item_id,
                         received_qty=4.0, accepted_qty=4.0, rejected_qty=0.0,
                         unit_price=50.0),
        ])
        await db.refresh(po_line)
        assert float(po_line.received_qty) == 10.0, "second receipt must build on the first"
        assert status_is(po.status, POStatus.RECEIVED)

    @pytest.mark.asyncio
    async def test_over_receipt_is_rejected(self, db: AsyncSession):
        tenant_id, outlet_id = uuid.uuid4(), uuid.uuid4()
        vendor = await _vendor(db, tenant_id, outlet_id)
        po = await _po(db, tenant_id, outlet_id, vendor)
        po_line = (await db.execute(
            select(PurchaseOrderLine).where(PurchaseOrderLine.purchase_order_id == po.id)
        )).scalars().one()

        with pytest.raises(purchase_svc.PurchaseError) as exc:
            await purchase_svc.create_grn(db, tenant_id, po, [
                GRNLineIn(inventory_item_id=po_line.inventory_item_id,
                             received_qty=15.0, accepted_qty=15.0, rejected_qty=0.0,
                             unit_price=50.0),
            ])
        assert "Over-receipt" in str(exc.value)


def status_is(value, expected: POStatus) -> bool:
    return purchase_svc.status_value(value) == expected.value


# ─── Three-way match ────────────────────────────────────────────────────────

class TestThreeWayMatch:
    @pytest.mark.asyncio
    async def test_match_with_no_variance(self, db: AsyncSession):
        tenant_id, outlet_id = uuid.uuid4(), uuid.uuid4()
        vendor = await _vendor(db, tenant_id, outlet_id)
        item_id = uuid.uuid4()
        po = await _po(db, tenant_id, outlet_id, vendor,
                       lines=[{"inventory_item_id": item_id, "ordered_qty": 10.0,
                               "unit_price": 50.0}])
        po_line = (await db.execute(
            select(PurchaseOrderLine).where(PurchaseOrderLine.purchase_order_id == po.id)
        )).scalars().one()

        grn = await purchase_svc.create_grn(db, tenant_id, po, [
            GRNLineIn(inventory_item_id=item_id,
                         received_qty=10.0, accepted_qty=10.0, rejected_qty=0.0,
                         unit_price=50.0, po_line_id=po_line.id),
        ])
        result = await purchase_svc.three_way_match(db, tenant_id, grn.id, tolerance_pct=0.0)
        assert result["match"] is True
        assert result["mismatches"] == []

    @pytest.mark.asyncio
    async def test_variance_beyond_tolerance_is_flagged(self, db: AsyncSession):
        tenant_id, outlet_id = uuid.uuid4(), uuid.uuid4()
        vendor = await _vendor(db, tenant_id, outlet_id)
        item_id = uuid.uuid4()
        po = await _po(db, tenant_id, outlet_id, vendor,
                       lines=[{"inventory_item_id": item_id, "ordered_qty": 10.0,
                               "unit_price": 50.0}])
        po_line = (await db.execute(
            select(PurchaseOrderLine).where(PurchaseOrderLine.purchase_order_id == po.id)
        )).scalars().one()

        # Received 10, accepted 8, rejected 2 — a ₹100 shortfall against the
        # PO's expected ₹500 (8 accepted × ₹50 = ₹400, ordered ₹500).
        grn = await purchase_svc.create_grn(db, tenant_id, po, [
            GRNLineIn(inventory_item_id=item_id,
                         received_qty=10.0, accepted_qty=8.0, rejected_qty=2.0,
                         unit_price=50.0, po_line_id=po_line.id),
        ])
        result = await purchase_svc.three_way_match(db, tenant_id, grn.id, tolerance_pct=0.0)
        assert result["match"] is False
        assert len(result["mismatches"]) == 1
        assert result["mismatches"][0]["inventory_item_id"] == str(item_id)


if __name__ == "__main__":
    import sys
    sys.exit(pytest.main([__file__, "-q"]))
