"""Billing service — order → bill, split tender, refunds, round-off.

Numbers follow Indian restaurant practice: item-level GST, service charge on
the discounted subtotal, then round the grand total to the nearest rupee.

All money is Decimal internally; the API serialises to float.
"""
import uuid
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models import (
    Bill,
    BillItem,
    BillPayment,
    BillStatus,
    Discount,
    DiscountType,
    KOT,
    KOTStatus,
    Order,
    OrderItem,
    OrderItemStatus,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    ServiceChargeConfig,
    Shift,
    TipConfig,
    CustomerWallet,
)
from src.models.loyalty import WalletTransaction, WalletTxnType
from src.schemas.billing import BillCreate, PaymentIn
from src.services.kot_service import _status_value
from src.services.number_series import allocate_number

TWO_PLACES = Decimal("0.01")
ONE_PLACE = Decimal("0.1")


def _d(value) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def _money(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _load_order(db: AsyncSession, tenant_id: uuid.UUID, order_id: uuid.UUID) -> Order:
    order = (
        await db.execute(
            select(Order)
            .options(
                selectinload(Order.items).selectinload(OrderItem.addons),
                selectinload(Order.table),
                selectinload(Order.bills),
            )
            .where(Order.id == order_id, Order.tenant_id == tenant_id)
        )
    ).scalars().first()
    if order is None:
        raise ValueError("Order not found")
    return order


async def _open_shift(db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID) -> Shift | None:
    return (
        await db.execute(
            select(Shift).where(
                Shift.tenant_id == tenant_id,
                Shift.outlet_id == outlet_id,
                Shift.status == "open",
            )
        )
    ).scalars().first()


async def _resolve_discount(
    db: AsyncSession, tenant_id: uuid.UUID, subtotal: Decimal, payload: BillCreate
) -> tuple[Decimal, uuid.UUID | None]:
    """Return (discount_amount, discount_id) for a code or explicit discount."""
    if payload.discount_id:
        discount = await db.scalar(
            select(Discount).where(
                Discount.id == payload.discount_id,
                Discount.tenant_id == tenant_id,
                Discount.is_active.is_(True),
            )
        )
        if discount is None:
            raise ValueError("That discount no longer exists")
        return _compute_discount(discount, subtotal), discount.id

    if payload.discount_code:
        discount = await db.scalar(
            select(Discount).where(
                Discount.tenant_id == tenant_id,
                Discount.code == payload.discount_code,
                Discount.is_active.is_(True),
            )
        )
        if discount is None:
            raise ValueError(f"Discount code '{payload.discount_code}' is not valid")
        return _compute_discount(discount, subtotal), discount.id

    return Decimal("0"), None


def _compute_discount(discount: Discount, subtotal: Decimal) -> Decimal:
    if _d(discount.min_order_value) > subtotal:
        raise ValueError(
            f"Order value is below the ₹{discount.min_order_value} minimum for this discount"
        )

    if discount.discount_type == DiscountType.PERCENT:
        amount = subtotal * _d(discount.value) / Decimal("100")
        cap = discount.max_discount_amount
        if cap is not None:
            amount = min(amount, _d(cap))
    elif discount.discount_type == DiscountType.FLAT:
        amount = _d(discount.value)
    elif discount.discount_type == DiscountType.BOGO:
        # Buy-one-get-one — value is applied on the cheapest eligible item,
        # which the caller has already priced; here we treat it as a flat value
        amount = _d(discount.value)
    else:
        amount = Decimal("0")

    amount = _money(min(amount, subtotal))
    discount.uses_count = int(discount.uses_count or 0) + 1
    return amount


async def _service_charge_pct(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID, explicit: float | None
) -> Decimal:
    if explicit is not None:
        return _d(explicit)

    config = (
        await db.execute(
            select(ServiceChargeConfig).where(
                ServiceChargeConfig.tenant_id == tenant_id,
                ServiceChargeConfig.is_active.is_(True),
                (ServiceChargeConfig.outlet_id == outlet_id)
                | (ServiceChargeConfig.outlet_id.is_(None)),
            )
        )
    ).scalars().first()

    if config is None:
        return Decimal("0")
    return _d(config.pct)


async def create_bill(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    payload: BillCreate,
    *,
    cashier_id: uuid.UUID | None = None,
) -> Bill:
    """Snapshot an order into a bill with GST split, service charge and round-off."""
    order = await _load_order(db, tenant_id, payload.order_id)
    resolve_status = _status_value(order.status)

    if resolve_status == OrderStatus.SETTLED.value:
        raise ValueError("This order is already settled")

    live_items = [
        i for i in order.items or []
        if _status_value(i.status) != OrderItemStatus.CANCELLED.value
    ]
    if not live_items:
        raise ValueError("There is nothing to bill — all items were cancelled")

    # Refuse to bill food that hasn't been served, unless the manager overrides
    unserved = [
        i for i in live_items
        if _status_value(i.status) not in (
            OrderItemStatus.SERVED.value,
            OrderItemStatus.CANCELLED.value,
        )
    ]
    if unserved and payload.tip < 0:
        raise ValueError("Some items have not been served yet")

    # Gross before discount — item lines plus their addons
    gross = Decimal("0")
    for item in live_items:
        gross += _d(item.unit_price) * Decimal(int(item.qty or 1))
        for addon in item.addons or []:
            gross += _d(addon.price) * Decimal(int(addon.qty or 1))
    gross = _money(gross)

    discount_amount, _discount_id = await _resolve_discount(
        db, tenant_id, gross, payload
    )

    taxable = _money(gross - discount_amount)
    if taxable < 0:
        taxable = Decimal("0")

    # Service charge on the discounted amount
    service_pct = await _service_charge_pct(
        db, tenant_id, order.outlet_id, payload.service_charge_pct
    )
    service_charge = _money(taxable * service_pct / Decimal("100"))

    bill_number = await allocate_number(db, tenant_id, "bill", order.outlet_id)
    shift = await _open_shift(db, tenant_id, order.outlet_id)

    bill = Bill(
        tenant_id=tenant_id,
        outlet_id=order.outlet_id,
        order_id=order.id,
        bill_number=bill_number,
        shift_id=shift.id if shift else None,
        cashier_id=cashier_id,
        waiter_id=order.waiter_id,
        customer_id=payload.customer_id or order.customer_id,
        customer_name=payload.customer_name or order.customer_name,
        customer_phone=payload.customer_phone or order.customer_phone,
        customer_gstin=payload.customer_gstin,
        covers=order.covers or 1,
        status=BillStatus.DRAFT,
        discount_total=discount_amount,
        service_charge=service_charge,
        service_charge_pct=service_pct,
        packaging_charge=_money(_d(payload.packaging_charge)),
        tip=_money(_d(payload.tip)),
    )
    db.add(bill)
    await db.flush()

    # Snapshot the order lines with their per-item tax split
    cgst_total = sgst_total = igst_total = cess_total = tax_total = Decimal("0")

    for item in live_items:
        item_gross = _d(item.unit_price) * Decimal(int(item.qty or 1))
        for addon in item.addons or []:
            item_gross += _d(addon.price) * Decimal(int(addon.qty or 1))

        item_discount = _d(item.discount_amount)
        # Cart-level discount is spread pro-rata across lines
        if discount_amount > 0 and gross > 0:
            item_discount += _money(
                item_gross * discount_amount / gross
            )

        item_taxable = _money(max(item_gross - item_discount, Decimal("0")))

        tax_code = item.tax_code
        cgst_pct = _d(tax_code.cgst_pct) if tax_code else Decimal("0")
        sgst_pct = _d(tax_code.sgst_pct) if tax_code else Decimal("0")
        igst_pct = _d(tax_code.igst_pct) if tax_code else Decimal("0")
        cess_pct = _d(tax_code.cess_pct) if tax_code else Decimal("0")

        cgst = _money(item_taxable * cgst_pct / Decimal("100"))
        sgst = _money(item_taxable * sgst_pct / Decimal("100"))
        igst = _money(item_taxable * igst_pct / Decimal("100"))
        cess = _money(item_taxable * cess_pct / Decimal("100"))
        line_tax = cgst + sgst + igst + cess

        cgst_total += cgst
        sgst_total += sgst
        igst_total += igst
        cess_total += cess
        tax_total += line_tax

        db.add(BillItem(
            tenant_id=tenant_id,
            bill_id=bill.id,
            order_item_id=item.id,
            menu_item_id=item.menu_item_id,
            name=item.item_name,
            variant_name=item.variant_name,
            qty=int(item.qty or 1),
            unit_price=_d(item.unit_price),
            discount_pct=item.discount_pct,
            discount_amount=_money(item_discount),
            tax_code_id=item.tax_code_id,
            hsn_code=tax_code.hsn_code if tax_code else None,
            tax_pct=(cgst_pct + sgst_pct + igst_pct + cess_pct) or None,
            cgst=cgst,
            sgst=sgst,
            igst=igst,
            cess=cess,
            line_total=_money(item_taxable + line_tax),
        ))

    bill.subtotal = _money(gross)
    bill.taxable_amount = taxable
    bill.tax_total = _money(tax_total)
    bill.cgst_total = _money(cgst_total)
    bill.sgst_total = _money(sgst_total)
    bill.igst_total = _money(igst_total)
    bill.cess_total = _money(cess_total)

    # Round-off to the nearest rupee (Indian practice)
    raw_total = (
        taxable + service_charge + _d(payload.packaging_charge)
        + _d(payload.tip) + tax_total
    )
    rounded = _money(raw_total)
    round_off = Decimal("0")
    if payload.apply_round_off:
        nearest = Decimal(int(rounded.to_integral_value(rounding=ROUND_HALF_UP)))
        round_off = nearest - rounded
        rounded = nearest

    bill.grand_total = rounded
    bill.round_off = round_off

    await db.flush()
    return bill


async def settle_bill(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    bill_id: uuid.UUID,
    payments: list[PaymentIn],
) -> Bill:
    """Record payments against a bill and mark it settled when fully paid."""
    bill = (
        await db.execute(
            select(Bill)
            .options(
                selectinload(Bill.payments),
                selectinload(Bill.order).selectinload(Order.items),
            )
            .where(Bill.id == bill_id, Bill.tenant_id == tenant_id)
        )
    ).scalars().first()
    if bill is None:
        raise ValueError("Bill not found")

    if _status_value(bill.status) == BillStatus.SETTLED.value:
        raise ValueError("This bill is already settled")
    if _status_value(bill.status) == BillStatus.VOID.value:
        raise ValueError("This bill was voided")

    already_paid = sum(_d(p.amount) for p in bill.payments or [] if _status_value(p.status) == PaymentStatus.SUCCESS.value)
    outstanding = _money(_d(bill.grand_total) - already_paid)

    incoming = _money(sum(_d(p.amount) for p in payments))
    if incoming <= 0:
        raise ValueError("Enter a payment amount")

    if incoming > outstanding:
        # Cash can overpay (change is due); anything else cannot
        cash_overpay = sum(
            _d(p.amount) for p in payments if p.method == PaymentMethod.CASH
        )
        if _money(incoming - outstanding) > cash_overpay:
            raise ValueError(
                f"Payment exceeds the balance by ₹{incoming - outstanding}"
            )

    shift = None
    if bill.shift_id is None:
        shift = await _open_shift(db, tenant_id, bill.outlet_id)

    for payment in payments:
        status_value = PaymentStatus.SUCCESS.value
        if payment.method == PaymentMethod.CREDIT:
            status_value = PaymentStatus.PENDING.value

        db.add(BillPayment(
            tenant_id=tenant_id,
            bill_id=bill.id,
            shift_id=bill.shift_id or (shift.id if shift else None),
            method=payment.method,
            amount=_money(_d(payment.amount)),
            reference=payment.reference,
            gateway=payment.gateway,
            gateway_txn_id=payment.gateway_txn_id,
            status=status_value,
            card_last4=payment.card_last4,
            card_type=payment.card_type,
            upi_vpa=payment.upi_vpa,
            idempotency_key=payment.idempotency_key,
        ))

    paid = sum(_d(p.amount) for p in (bill.payments or [])) + incoming
    bill.paid_amount = _money(paid)
    bill.change_amount = _money(max(paid - _d(bill.grand_total), Decimal("0")))

    if paid >= _d(bill.grand_total):
        bill.status = BillStatus.SETTLED
        bill.settled_at = _now_iso()

        # Mark the order settled, release its table, and close its tickets
        order = bill.order
        if order is not None:
            order.status = OrderStatus.SETTLED
            order.closed_at = _now_iso()
            await _release_table_for_order(db, tenant_id, order)
            await _close_open_kots(db, tenant_id, order.id)

    await db.flush()
    return bill


async def _release_table_for_order(
    db: AsyncSession, tenant_id: uuid.UUID, order: Order
) -> None:
    from src.models import TableSession, TableSessionStatus, TableStatus
    from src.models import RestaurantTable

    if order.table_id is None:
        return

    sessions = (
        await db.execute(
            select(TableSession).where(
                TableSession.order_id == order.id,
                TableSession.status == TableSessionStatus.ACTIVE,
            )
        )
    ).scalars().all()
    now = _now_iso()
    for session in sessions:
        session.status = TableSessionStatus.CLOSED
        session.ended_at = now

    table = await db.scalar(
        select(RestaurantTable).where(
            RestaurantTable.id == order.table_id,
            RestaurantTable.tenant_id == tenant_id,
        )
    )
    if table is not None:
        table.status = TableStatus.CLEANING


async def _close_open_kots(
    db: AsyncSession, tenant_id: uuid.UUID, order_id: uuid.UUID
) -> None:
    """Anything still on the kitchen board when the bill settles is served."""
    kots = (
        await db.execute(
            select(KOT)
            .options(selectinload(KOT.items))
            .where(
                KOT.tenant_id == tenant_id,
                KOT.order_id == order_id,
                KOT.status.not_in([KOTStatus.SERVED.value, KOTStatus.CANCELLED.value]),
            )
        )
    ).scalars().all()

    now = _now_iso()
    for kot in kots:
        kot.status = KOTStatus.SERVED
        kot.served_at = now
        for item in kot.items or []:
            if _status_value(item.status) not in ("served", "cancelled"):
                item.status = KOTStatus.SERVED.value


async def void_bill(
    db: AsyncSession, tenant_id: uuid.UUID, bill_id: uuid.UUID, reason: str
) -> Bill:
    """Cancel an unsettled bill (mispunch, wrong table)."""
    bill = await db.scalar(
        select(Bill).where(Bill.id == bill_id, Bill.tenant_id == tenant_id)
    )
    if bill is None:
        raise ValueError("Bill not found")

    if _status_value(bill.status) == BillStatus.SETTLED.value:
        raise ValueError("A settled bill cannot be voided — refund it instead")

    bill.status = BillStatus.VOID
    bill.void_reason = reason
    bill.settled_at = None
    await db.flush()
    return bill


async def refund_bill(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    bill_id: uuid.UUID,
    *,
    payment_id: uuid.UUID | None = None,
    amount: Decimal | None = None,
    reason: str | None = None,
    refunded_by: uuid.UUID | None = None,
) -> Bill:
    """Refund a settled bill in full or against one payment method."""
    bill = (
        await db.execute(
            select(Bill)
            .options(selectinload(Bill.payments))
            .where(Bill.id == bill_id, Bill.tenant_id == tenant_id)
        )
    ).scalars().first()
    if bill is None:
        raise ValueError("Bill not found")

    if _status_value(bill.status) != BillStatus.SETTLED.value:
        raise ValueError("Only a settled bill can be refunded")

    successful = [
        p for p in bill.payments or []
        if _status_value(p.status) == PaymentStatus.SUCCESS.value
    ]
    if not successful:
        raise ValueError("This bill has no refundable payments")

    already_refunded = sum(_d(p.refunded_amount) for p in successful)
    refundable = _money(sum(_d(p.amount) for p in successful) - already_refunded)

    if amount is None:
        amount = refundable
    else:
        amount = _money(_d(amount))

    if amount <= 0:
        raise ValueError("Refund amount must be positive")
    if amount > refundable:
        raise ValueError(
            f"Refund exceeds the refundable balance of ₹{refundable}"
        )

    # Walk payments oldest-first, refunding until the amount is consumed
    remaining = amount
    now = _now_iso()
    targets = [p for p in successful if p.id == payment_id] if payment_id else successful

    for payment in targets:
        if remaining <= 0:
            break
        available = _d(payment.amount) - _d(payment.refunded_amount)
        if available <= 0:
            continue
        take = min(remaining, available)
        payment.refunded_amount = _money(_d(payment.refunded_amount) + take)
        payment.refunded_at = now
        payment.status = (
            PaymentStatus.REFUNDED.value
            if _d(payment.refunded_amount) >= _d(payment.amount)
            else PaymentStatus.SUCCESS.value
        )
        remaining -= take

    if remaining > 0:
        raise ValueError("Refund could not be fully applied to the selected payment")

    total_refunded = sum(_d(p.refunded_amount) for p in bill.payments or [])
    if total_refunded >= _d(bill.grand_total):
        bill.status = BillStatus.REFUNDED

    await db.flush()
    return bill


async def apply_tip(
    db: AsyncSession, tenant_id: uuid.UUID, bill_id: uuid.UUID, tip: Decimal
) -> Bill:
    bill = await db.scalar(
        select(Bill).where(Bill.id == bill_id, Bill.tenant_id == tenant_id)
    )
    if bill is None:
        raise ValueError("Bill not found")

    bill.tip = _money(_d(tip))
    # The tip rides on the grand total
    bill.grand_total = _money(_d(bill.grand_total) - _d(bill.tip) + _d(tip))
    await db.flush()
    return bill


async def suggested_tips(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID, subtotal: Decimal
) -> list[Decimal]:
    config = (
        await db.execute(
            select(TipConfig).where(
                TipConfig.tenant_id == tenant_id,
                TipConfig.is_enabled.is_(True),
                (TipConfig.outlet_id == outlet_id) | (TipConfig.outlet_id.is_(None)),
            )
        )
    ).scalars().first()

    pcts = (config.suggested_pcts if config else None) or [0, 5, 10]
    return [
        _money(subtotal * _d(pct) / Decimal("100")) for pct in pcts
    ]


async def debit_wallet(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    customer_id: uuid.UUID,
    amount: Decimal,
    bill_id: uuid.UUID | None = None,
    description: str | None = None,
) -> Decimal:
    """Use stored wallet balance as a payment method."""
    wallet = (
        await db.execute(
            select(CustomerWallet).where(
                CustomerWallet.tenant_id == tenant_id,
                CustomerWallet.customer_id == customer_id,
                CustomerWallet.is_active.is_(True),
            )
        )
    ).scalars().first()
    if wallet is None:
        raise ValueError("This customer has no wallet")

    amount = _money(_d(amount))
    if _d(wallet.balance) < amount:
        raise ValueError(
            f"Wallet balance ₹{wallet.balance} is less than ₹{amount}"
        )

    wallet.balance = _money(_d(wallet.balance) - amount)
    db.add(WalletTransaction(
        tenant_id=tenant_id,
        wallet_id=wallet.id,
        bill_id=bill_id,
        txn_type=WalletTxnType.DEBIT,
        amount=amount,
        description=description or "Wallet payment",
    ))
    return wallet.balance
