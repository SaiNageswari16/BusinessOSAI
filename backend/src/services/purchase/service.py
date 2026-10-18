"""Purchase service logic — vendors, PRs, POs, GRNs, bills, payments.

The P2P chain runs: PurchaseRequest -> PurchaseOrder -> GoodsReceiptNote
-> VendorBill -> VendorPayment.

Two rules this module enforces:

1. Stock is only ever added on a QC-passed GRN. Goods that arrive are not
   necessarily goods we keep, and billing on received-not-QC'd stock would
   invoice for items that went back to the vendor.

2. Bills are sourced from a GRN, not from a PO. A PO says what we ordered; a
   GRN says what we got. Paying on the PO would pay for the difference.
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.purchase.models import (
    GoodsReceiptNote,
    GRNLine,
    GRNStatus,
    PaymentMode,
    PaymentStatus,
    POStatus,
    PRStatus,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseRequest,
    PurchaseRequestLine,
    Vendor,
    VendorBill,
    VendorBillStatus,
    VendorPayment,
    status_value,
)
from src.services.purchase.schemas import (
    POLineIn,
    PRLineIn,
    VendorPaymentCreate,
)

TWO_PLACES = 2


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _money(value) -> float:
    return round(float(value or 0), TWO_PLACES)


def _coerce_uuid(value) -> uuid.UUID | None:
    """Parse a UUID from event data without raising on bad input."""
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


def _member(value, enum_type):
    """Coerce a stored value to an enum member, however it was loaded.

    Status columns are ``String``, so a value loaded back from Postgres is a
    bare ``str`` and comparing it to an enum member would always fail.
    """
    return value if isinstance(value, enum_type) else enum_type(str(value))


class PurchaseError(Exception):
    """A rejected purchase operation. The API maps this to 409 or 400."""


# ─── Vendors ───────────────────────────────────────────────────────────────

async def load_vendor(db: AsyncSession, tenant_id: uuid.UUID,
                      vendor_id: uuid.UUID) -> Vendor | None:
    return await db.scalar(
        select(Vendor).where(Vendor.id == vendor_id,
                             Vendor.tenant_id == tenant_id))


# ─── Purchase requests ─────────────────────────────────────────────────────

async def load_request(db: AsyncSession, tenant_id: uuid.UUID,
                       pr_id: uuid.UUID) -> PurchaseRequest | None:
    """Load a request with its lines. Eager: a lazy load during serialisation
    would raise MissingGreenlet."""
    return (
        await db.execute(
            select(PurchaseRequest)
            .options(selectinload(PurchaseRequest.lines))
            .where(PurchaseRequest.id == pr_id,
                   PurchaseRequest.tenant_id == tenant_id)
        )
    ).scalars().first()


async def create_request(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    lines: list[PRLineIn],
    *,
    requested_by: uuid.UUID | None = None,
    notes: str | None = None,
) -> PurchaseRequest:
    """Raise a request to buy a set of items.

    A request is not a commitment — nothing is ordered until it is approved and
    converted into a PO. Keeping the two separate means stockouts can raise
    requests cheaply, and procurement only deals with approved ones.
    """
    pr = PurchaseRequest(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        pr_number=f"PR-{uuid.uuid4().hex[:8].upper()}",
        status=PRStatus.SUBMITTED,
        requested_by=requested_by,
        notes=notes,
    )
    db.add(pr)
    await db.flush()
    for line in lines:
        db.add(PurchaseRequestLine(
            tenant_id=tenant_id,
            purchase_request_id=pr.id,
            inventory_item_id=line.inventory_item_id,
            qty=float(line.qty),
            uom_id=line.uom_id,
            required_by=line.required_by,
            notes=line.notes,
        ))
    await db.flush()
    return pr


async def set_pr_status(db: AsyncSession, tenant_id: uuid.UUID,
                        pr: PurchaseRequest, status: PRStatus,
                        *, decided_by: uuid.UUID | None = None,
                        notes: str | None = None) -> PurchaseRequest:
    """Move a request through its lifecycle.

    Converted and rejected are terminal; anything else is a normal transition.
    """
    current = _member(pr.status, PRStatus)
    if current in (PRStatus.CONVERTED, PRStatus.REJECTED):
        raise PurchaseError(
            f"Request is already {current.value}, a terminal state")
    pr.status = status
    if decided_by is not None and status in (PRStatus.APPROVED, PRStatus.REJECTED):
        pr.approved_by = decided_by
        pr.approved_at = _now()
    if notes and pr.notes is None:
        pr.notes = notes
    await db.flush()
    return pr


# ─── Purchase orders ───────────────────────────────────────────────────────

async def load_order(db: AsyncSession, tenant_id: uuid.UUID,
                     po_id: uuid.UUID) -> PurchaseOrder | None:
    """Load an order with its lines, eager."""
    return (
        await db.execute(
            select(PurchaseOrder)
            .options(selectinload(PurchaseOrder.lines))
            .where(PurchaseOrder.id == po_id,
                   PurchaseOrder.tenant_id == tenant_id)
        )
    ).scalars().first()


async def create_order(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    vendor_id: uuid.UUID,
    lines: list[POLineIn],
    *,
    pr_id: uuid.UUID | None = None,
    expected_date: date | None = None,
    notes: str | None = None,
    created_by: uuid.UUID | None = None,
) -> PurchaseOrder:
    """Create a purchase order and compute its totals.

    The order total is the sum of each line's ordered quantity times its unit
    price, not an average and not the price on the vendor item. The unit price
    is what was agreed for THIS order; using a stale vendor price would bill
    for an amount that was never agreed.
    """
    po = PurchaseOrder(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        vendor_id=vendor_id,
        pr_id=pr_id,
        po_number=f"PO-{uuid.uuid4().hex[:8].upper()}",
        status=POStatus.DRAFT,
        order_date=_now().date(),
        expected_date=expected_date,
        notes=notes,
        created_by=created_by,
    )
    db.add(po)
    await db.flush()

    subtotal = 0.0
    for line in lines:
        total = _money(float(line.ordered_qty) * float(line.unit_price))
        subtotal += total
        db.add(PurchaseOrderLine(
            tenant_id=tenant_id,
            purchase_order_id=po.id,
            inventory_item_id=line.inventory_item_id,
            uom_id=line.uom_id,
            ordered_qty=float(line.ordered_qty),
            received_qty=0.0,
            unit_price=_money(line.unit_price),
            line_total=total,
            notes=line.notes,
        ))
    po.subtotal = _money(subtotal)
    po.grand_total = _money(subtotal)
    await db.flush()
    return po


async def set_po_status(db: AsyncSession, tenant_id: uuid.UUID,
                        po: PurchaseOrder, status: POStatus) -> PurchaseOrder:
    """Move an order through its lifecycle.

    Receipt is what changes received_qty on the lines; this only moves the
    header state.
    """
    current = _member(po.status, POStatus)
    if current == POStatus.CANCELLED:
        raise PurchaseError("A cancelled purchase order cannot be advanced")
    po.status = status
    if status == POStatus.RECEIVED:
        po.received_date = _now().date()
    await db.flush()
    return po


# ─── Goods receipt notes ───────────────────────────────────────────────────

async def load_grn(db: AsyncSession, tenant_id: uuid.UUID,
                   grn_id: uuid.UUID) -> GoodsReceiptNote | None:
    """Load a GRN with its lines, eager."""
    return (
        await db.execute(
            select(GoodsReceiptNote)
            .options(selectinload(GoodsReceiptNote.lines))
            .where(GoodsReceiptNote.id == grn_id,
                   GoodsReceiptNote.tenant_id == tenant_id)
        )
    ).scalars().first()


async def create_grn(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    po: PurchaseOrder,
    lines,
    *,
    received_by: uuid.UUID | None = None,
    received_date: date | None = None,
    notes: str | None = None,
) -> GoodsReceiptNote:
    """Receive goods against an order.

    Accepted quantity is what enters the store; rejected is what goes back to
    the vendor and is never billed. Recording both at receipt is what makes the
    "we paid for what we kept" check possible at month end.
    """
    grn = GoodsReceiptNote(
        tenant_id=tenant_id,
        outlet_id=po.outlet_id,
        po_id=po.id,
        vendor_id=po.vendor_id,
        grn_number=f"GRN-{uuid.uuid4().hex[:8].upper()}",
        status=GRNStatus.RECEIVED,
        received_date=received_date or _now().date(),
        received_by=received_by,
        notes=notes,
    )
    db.add(grn)
    await db.flush()

    for line in lines:
        accepted = float(line.accepted_qty)
        db.add(GRNLine(
            tenant_id=tenant_id,
            grn_id=grn.id,
            po_line_id=getattr(line, "po_line_id", None),
            inventory_item_id=line.inventory_item_id,
            uom_id=getattr(line, "uom_id", None),
            received_qty=float(line.received_qty),
            accepted_qty=accepted,
            rejected_qty=float(line.rejected_qty),
            unit_price=_money(line.unit_price),
            line_total=_money(accepted * float(line.unit_price)),
            batch_number=getattr(line, "batch_number", None),
            expiry_date=getattr(line, "expiry_date", None),
        ))

    # Receipt moves the order, but only to RECEIVED if every line was received
    # in full. A partial delivery must show PARTIAL so the balance is visible.
    await db.flush()
    return grn


async def set_grn_status(db: AsyncSession, tenant_id: uuid.UUID,
                         grn: GoodsReceiptNote, status: GRNStatus,
                         *, notes: str | None = None) -> GoodsReceiptNote:
    """QC a GRN. Only QC_PASSED is eligible to post stock."""
    current = _member(grn.status, GRNStatus)
    if current in (GRNStatus.QC_PASSED, GRNStatus.CANCELLED):
        raise PurchaseError(
            f"GRN is already {current.value}, a terminal state")
    grn.status = status
    if notes and grn.notes is None:
        grn.notes = notes
    await db.flush()
    return grn


# ─── Vendor bills ──────────────────────────────────────────────────────────

async def create_bill_from_grn(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    grn_id: uuid.UUID,
    *,
    tax_total: float = 0,
    invoice_number: str | None = None,
    invoice_date: date | None = None,
    notes: str | None = None,
) -> VendorBill:
    """Raise a bill from a QC-passed GRN.

    Sourced from the GRN, never from the PO: the bill amount is what was
    accepted, not what was ordered. Billing from a PO would invoice the gap
    between ordered and received.
    """
    grn = await load_grn(db, tenant_id, grn_id)
    if grn is None:
        raise PurchaseError("GRN not found")
    if _member(grn.status, GRNStatus) != GRNStatus.QC_PASSED:
        raise PurchaseError(
            "A bill can only be raised from a QC-passed GRN — goods that failed "
            "quality control are returned and must not be billed")

    subtotal = _money(sum(float(l.line_total) for l in grn.lines))
    total = _money(subtotal + tax_total)
    bill = VendorBill(
        tenant_id=tenant_id,
        outlet_id=grn.outlet_id,
        vendor_id=grn.vendor_id,
        grn_id=grn.id,
        bill_number=f"VB-{uuid.uuid4().hex[:8].upper()}",
        status=VendorBillStatus.UNPAID,
        invoice_number=invoice_number,
        invoice_date=invoice_date,
        subtotal=subtotal,
        tax_total=_money(tax_total),
        grand_total=total,
        paid_amount=0.0,
        balance=total,
        notes=notes,
    )
    db.add(bill)
    await db.flush()
    return bill


# ─── Vendor payments ───────────────────────────────────────────────────────

async def record_payment(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    bill: VendorBill,
    payload: VendorPaymentCreate,
    *,
    approved_by: uuid.UUID | None = None,
) -> VendorPayment:
    """Pay a bill, allowing partial payments.

    Refuses to overpay: paying more than the balance is almost always a data
    entry error, and a negative balance would flip the vendor into being owed
    money by us, which is not what a payment is. Accumulates on paid_amount and
    only sets the bill PAID once the balance reaches zero.
    """
    current = _member(bill.status, VendorBillStatus)
    if current in (VendorBillStatus.PAID, VendorBillStatus.CANCELLED):
        raise PurchaseError(f"Bill is already {current.value}")

    balance = _money(bill.balance)
    amount = _money(payload.amount)
    if amount > balance:
        raise PurchaseError(
            f"Payment ₹{amount} exceeds the open balance ₹{balance}")

    payment = VendorPayment(
        tenant_id=tenant_id,
        bill_id=bill.id,
        vendor_id=bill.vendor_id,
        payment_number=f"VP-{uuid.uuid4().hex[:8].upper()}",
        status=PaymentStatus.PAID,
        mode=payload.mode,
        amount=amount,
        paid_date=payload.paid_date or _now().date(),
        reference=payload.reference,
        approved_by=approved_by,
        notes=payload.notes,
    )
    db.add(payment)

    paid = _money((float(bill.paid_amount) if bill.paid_amount else 0) + amount)
    bill.paid_amount = paid
    bill.balance = _money(total_for(bill) - paid)
    bill.status = (VendorBillStatus.PAID if bill.balance <= 0
                   else VendorBillStatus.PARTIALLY_PAID)
    await db.flush()
    return payment


def total_for(bill: VendorBill) -> float:
    """The amount payable on a bill, computed from its components.

    Derived rather than read so that subtotal or tax changes are reflected in
    the balance without a separate recompute step.
    """
    return _money((float(bill.subtotal) if bill.subtotal else 0)
                  + (float(bill.tax_total) if bill.tax_total else 0))
