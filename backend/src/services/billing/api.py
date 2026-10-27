"""Billing service endpoints.

Who may call what:
  * ``/bills`` read — ``view:bills``
  * create / settle — ``manage:bills``
  * void — ``manage:refunds``
  * payments — ``process:payments``

Events:
  subscribes order.placed (draft a bill as soon as an order is placed),
             order.status.changed, kot.item.status.changed
  publishes  bill.created, bill.paid, bill.refunded, payment.received

Cross-service effect, deliberately different from the monolith: settling a
bill no longer writes ``order.status`` or closes KOTs in another service's
database. It publishes ``bill.paid`` and pos and kitchen react. That is the
split working as intended.
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status as http_status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.billing import service as svc
from src.services.event_bus.bus import Event, bus
from src.services.billing.models import (
    Bill,
    BillItem,
    BillPayment,
    BillStatus,
    CashMovementType,
    Coupon,
    Discount,
    NumberCounter,
    ServiceChargeConfig,
    Shift,
    TaxCode,
    TipConfig,
    DiscountType,
    PaymentMethod,
)
from src.services.billing.schemas import (
    BillCreate,
    BillItemCreate,
    BillListResponse,
    BillResponse,
    BillUpdate,
    CouponCreate,
    CouponResponse,
    DiscountCreate,
    DiscountResponse,
    DiscountUpdate,
    CouponUpdate,
    PaymentCreate,
    PaymentResponse,
    RefundRequest,
    CashMovementIn,
    CashMovementResponse,
    ServiceChargeConfigCreate,
    ServiceChargeConfigResponse,
    SettleRequest,
    ShiftClose,
    ShiftOpen,
    ShiftResponse,
    TaxCodeCreate,
    TaxCodeResponse,
    TaxCodeUpdate,
    TipConfigCreate,
    TipConfigResponse,
    VoidRequest,
)
from src.services.shared.identity import CurrentIdentity

router = APIRouter()


async def get_db(request: Request) -> AsyncSession:
    """One session per request, committed on success, rolled back on error."""
    session = request.app.state.db.session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


DbDep = Annotated[AsyncSession, Depends(get_db)]


def _outbox(db: AsyncSession, event: Event) -> None:
    """Write the event to the outbox inside the current transaction.

    The outbox row is added to the same session that owns the bill change, so
    both commit or roll back together. The relay background task picks up
    pending rows and pushes them to the event bus. A crashed process leaves
    the row in the database; the relay on the next boot picks it up.
    """
    from src.services.billing.models import OutboxMessage

    db.add(OutboxMessage(
        event_id=event.event_id,
        type=event.type,
        tenant_id=event.tenant_id,
        outlet_id=event.outlet_id,
        data=event.data,
        source_service=event.source_service,
        status="pending",
    ))


def _handler_db() -> AsyncSession:
    """A session owned by an event handler, not by a request.

    An event may arrive at any point while the app is up, not only during a
    request, so a request-scoped session is unavailable here. The handler owns
    the session and rolls back on its own failure.
    """
    from src.services.billing.main import db as _db

    return _db.session_factory()


# ─── Consumers ────────────────────────────────────────────────────────────────

@bus.on("order.status.changed")
async def _on_order_status_changed(event: Event) -> None:
    """Cancel a draft bill whose order was cancelled at the POS.

    A bill that was never settled is only a promise. If the order it bills is
    cancelled, keeping the draft around would let someone settle food that was
    never served and never paid for. Already-settled bills are left alone:
    money has moved, and voiding a real transaction is a refund, not a delete.

    Do not call ``bus.mark_seen`` here — the consumer loop already gates by
    event_id, and a handler-side call would suppress events the bus never
    marked. Idempotency is instead structural: only DRAFT bills are voided,
    and voiding one that is already voided is rejected by the service layer.
    """
    data = event.data or {}
    tenant = _tenant(event)
    if tenant is None or not data.get("order_id"):
        return
    to = str(data.get("to") or "")
    if to != "cancelled":
        return
    order_id = _coerce_uuid(data["order_id"])
    if order_id is None:
        return

    db = _handler_db()
    try:
        from src.services.billing import service as svc
        bills = (
            await db.execute(
                select(Bill).where(
                    Bill.tenant_id == tenant,
                    Bill.order_id == order_id,
                    Bill.status == BillStatus.DRAFT,
                )
            )
        ).scalars().all()
        for bill in bills:
            try:
                await svc.void_bill(
                    db, tenant, bill,
                    f"order {data.get('order_number') or ''} cancelled".strip(),
                )
            except svc.BillingError:
                # Already void or settled — nothing to do.
                continue
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    finally:
        await db.close()


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


def _tenant(event: Event) -> uuid.UUID | None:
    """Tenant id from an event, always as a UUID.

    The bus serialises tenant_id as a STRING (see ``Event.to_json``). Dispatched
    within one process a consumer receives the original UUID, but across
    processes it round-trips through Redis and ``Event.from_json`` yields a
    bare str. Comparing a str against a UUID column yields zero rows rather
    than an error — the event is consumed, acked, and silently dropped — and
    assigning it to a UUID column raises "invalid input syntax for type uuid"
    on insert. Tolerate the string; everything downstream expects a UUID.
    """
    value = event.tenant_id
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


async def _resolve_outlet(identity: CurrentIdentity, outlet_id: uuid.UUID) -> None:
    """Validate this identity may act at this outlet.

    Outlets belong to the organization service, which billing cannot query.
    The ID is trusted and the tenant's outlet scope from the token is enforced
    instead. A wrong scope returns 403, not a silent cross-outlet write.
    """
    if not identity.can_access_outlet(outlet_id):
        raise HTTPException(status_code=403, detail=f"Not authorised for outlet {outlet_id}")


# ─── Bills ───────────────────────────────────────────────────────────────────

@router.get("/bills", response_model=list[BillListResponse], tags=["bills"])
async def list_bills(identity: CurrentIdentity, db: DbDep,
                     outlet_id: uuid.UUID | None = None,
                     status_filter: str | None = None,
                     cashier_id: uuid.UUID | None = None,
                     date_from: str | None = None,
                     date_to: str | None = None,
                     limit: int = Query(default=100, le=500),
                     offset: int = Query(default=0, ge=0)):
    """The day's bill register. Columns only, so a big register is one SELECT."""
    identity.require("view:bills")
    stmt = select(Bill).where(Bill.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(Bill.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(Bill.status == status_filter)
    if cashier_id:
        stmt = stmt.where(Bill.cashier_id == cashier_id)
    stmt = stmt.order_by(Bill.created_at.desc()).limit(limit).offset(offset)
    return list((await db.execute(stmt)).scalars().all())


@router.get("/bills/count", response_model=dict, tags=["bills"])
async def count_bills(identity: CurrentIdentity, db: DbDep,
                      outlet_id: uuid.UUID | None = None,
                      status_filter: str | None = None):
    identity.require("view:bills")
    counts = await svc.bill_counts(db, identity.tenant_id, outlet_id)
    return {"counts": counts, "total": sum(counts.values())}


@router.get("/bills/{bill_id}", response_model=BillResponse, tags=["bills"])
async def get_bill(bill_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:bills")
    bill = await svc.load_bill(db, identity.tenant_id, bill_id)
    if bill is None:
        raise HTTPException(status_code=404, detail="Bill not found")
    if not identity.can_access_outlet(bill.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    return bill


@router.post("/bills", response_model=BillResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["bills"],
             summary="Create a draft bill with itemised tax")
async def create_bill(payload: BillCreate, identity: CurrentIdentity, db: DbDep):
    """Draft a bill from snapshotted lines.

    Lines are not fetched from pos or menu — the caller passes what was sold.
    Billing records what was charged, and a later menu or order edit must not
    rewrite it.
    """
    identity.require("manage:bills")
    await _resolve_outlet(identity, payload.outlet_id)

    # build_bill appends items and flushes, but the bill object in memory has
    # not had its items relationship populated. Re-load it so the response
    # carries the line detail — and so nothing reads .items lazily during
    # serialisation, which would raise MissingGreenlet.
    bill = await svc.build_bill(
        db, identity.tenant_id,
        outlet_id=payload.outlet_id,
        order_id=payload.order_id,
        order_number=payload.order_number,
        lines=[i.model_dump() for i in payload.items],
        covers=payload.covers,
        service_charge_pct=payload.service_charge_pct or 0,
        packaging_charge=payload.packaging_charge,
        tip=payload.tip,
    )
    return await svc.load_bill(db, identity.tenant_id, bill.id)


@router.patch("/bills/{bill_id}", response_model=BillResponse, tags=["bills"])
async def update_bill(bill_id: uuid.UUID, payload: BillUpdate,
                      identity: CurrentIdentity, db: DbDep):
    identity.require("manage:bills")
    bill = await svc.load_bill(db, identity.tenant_id, bill_id)
    if bill is None:
        raise HTTPException(status_code=404, detail="Bill not found")
    if not identity.can_access_outlet(bill.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")

    if payload.void_reason is not None:
        await svc.void_bill(db, identity.tenant_id, bill, payload.void_reason)
    else:
        bill.service_charge_pct = payload.service_charge_pct
        bill.packaging_charge = payload.packaging_charge
        bill.tip = payload.tip
        await db.flush()
    return bill


@router.post("/bills/{bill_id}/settle", response_model=BillResponse, tags=["bills"],
             summary="Settle a bill across one or more tender legs")
async def settle_bill(bill_id: uuid.UUID, payload: SettleRequest,
                      identity: CurrentIdentity, db: DbDep):
    """Settle a bill, then tell the other services what changed.

    The event is written to the outbox in the same transaction as the bill
    change (atomic: no bill without its event), and a background relay task
    delivers it to the event bus. The bus still gets an immediate local
    dispatch for in-process handlers that want real-time reaction, but the
    cross-service delivery is guaranteed by the outbox, not by the bus.
    """
    identity.require("manage:bills")
    bill = await svc.load_bill(db, identity.tenant_id, bill_id)
    if bill is None:
        raise HTTPException(status_code=404, detail="Bill not found")
    if not identity.can_access_outlet(bill.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")

    try:
        await svc.settle_bill(
            db, identity.tenant_id, bill,
            payments=[p.model_dump(mode="json") for p in payload.payments],
            cashier_id=identity.user_id,
        )
    except svc.BillingError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    # Consumers read exactly these keys — the event payload is the contract.
    # Covers/lines/cash totals/ GST split used to be missing here, which left
    # the reports projection (covers, cash vs card split) and the accounting
    # auto-posting (tax payables, COGS) silently degraded.
    items = list(bill.items or [])
    # Refunded legs are excluded (refunds post a separate bill.refunded event).
    payments = [
        p for p in (bill.payments or [])
        if p.status in (PaymentStatus.SUCCESS, PaymentStatus.PENDING)
    ]
    cash_amount = sum(float(p.amount) for p in payments if p.method == PaymentMethod.CASH)
    event = Event(
        type="bill.paid" if status_value(bill.status) == BillStatus.SETTLED else "bill.created",
        tenant_id=identity.tenant_id,
        outlet_id=bill.outlet_id,
        data={
            "bill_id": str(bill.id),
            "bill_number": bill.bill_number,
            "order_id": str(bill.order_id) if bill.order_id else None,
            "order_number": bill.order_number,
            "status": status_value(bill.status),
            "subtotal": float(bill.subtotal),
            "tax_total": float(bill.tax_total),
            "cgst_total": float(bill.cgst_total or 0),
            "sgst_total": float(bill.sgst_total or 0),
            "igst_total": float(bill.igst_total or 0),
            "cess_total": float(bill.cess_total or 0),
            "service_charge": float(bill.service_charge),
            "grand_total": float(bill.grand_total),
            "paid_amount": float(bill.paid_amount),
            "change_amount": float(bill.change_amount),
            "is_credit_sale": bill.is_credit_sale,
            "covers": int(bill.covers or 1),
            "cash_amount": round(cash_amount, 2),
            "payment_method": status_value(payments[0].method) if payments else "cash",
            "cashier_id": str(bill.cashier_id) if bill.cashier_id else None,
            "waiter_id": str(bill.waiter_id) if bill.waiter_id else None,
            "customer_gstin": bill.customer_gstin,
            # The BOM-deduction consumer needs the dishes sold, not just the
            # totals — the menu service resolves recipes per menu_item_id.
            "lines": [
                {
                    "menu_item_id": str(i.menu_item_id) if i.menu_item_id else None,
                    "name": i.name,
                    "qty": int(i.qty),
                    "unit_price": float(i.unit_price),
                }
                for i in items
            ],
        },
        source_service="billing",
    )
    _outbox(db, event)
    await db.commit()

    # Immediate local dispatch for in-process handlers (real-time KOT, etc.)
    # The relay picks up the outbox row for cross-service delivery.
    await bus.publish(event, local=True)
    return bill


@router.post("/bills/{bill_id}/void", response_model=BillResponse, tags=["bills"])
async def void_bill(bill_id: uuid.UUID, payload: VoidRequest,
                    identity: CurrentIdentity, db: DbDep):
    identity.require("manage:refunds")
    bill = await svc.load_bill(db, identity.tenant_id, bill_id)
    if bill is None:
        raise HTTPException(status_code=404, detail="Bill not found")
    if not identity.can_access_outlet(bill.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    try:
        await svc.void_bill(db, identity.tenant_id, bill, payload.reason)
    except svc.BillingError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return bill


@router.post("/bills/{bill_id}/refunds", response_model=BillResponse, tags=["bills"])
async def refund_payment(bill_id: uuid.UUID, payload: RefundRequest,
                         identity: CurrentIdentity, db: DbDep):
    """Refund a payment, in full or part.

    Refunds publish ``bill.refunded`` separately from ``payment.received`` so
    the reports service can reverse revenue rather than just adding a negative
    payment. Money leaving must be a different event from money arriving.
    The outbox guarantees the event lands in the stream even if the process
    crashes between the DB commit and the bus publish.
    """
    identity.require("manage:refunds")
    bill = await svc.load_bill(db, identity.tenant_id, bill_id)
    if bill is None:
        raise HTTPException(status_code=404, detail="Bill not found")
    if not identity.can_access_outlet(bill.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    try:
        payment = await svc.refund_payment(
            db, identity.tenant_id, bill, payload.payment_id,
            payload.amount, payload.reason,
        )
    except svc.BillingError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    event = Event(
        type="bill.refunded",
        tenant_id=identity.tenant_id,
        outlet_id=bill.outlet_id,
        data={
            "bill_id": str(bill.id),
            "bill_number": bill.bill_number,
            "payment_id": str(payment.id),
            "method": status_value(payment.method),
            "refund_amount": float(payment.refunded_amount),
            "order_id": str(bill.order_id) if bill.order_id else None,
            "reason": payload.reason,
        },
        source_service="billing",
    )
    _outbox(db, event)
    await db.commit()
    await bus.publish(event, local=True)
    return bill


@router.get("/bills/{bill_id}/payments", response_model=list[PaymentResponse],
            tags=["bills"])
async def list_payments(bill_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:bills")
    bill = await svc.load_bill(db, identity.tenant_id, bill_id)
    if bill is None:
        raise HTTPException(status_code=404, detail="Bill not found")
    if not identity.can_access_outlet(bill.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    return list(bill.payments or [])


@router.get("/tax-codes", response_model=list[TaxCodeResponse], tags=["tax"])
async def list_tax_codes(identity: CurrentIdentity, db: DbDep,
                         outlet_id: uuid.UUID | None = None,
                         active_only: bool = True):
    identity.require("view:bills")
    stmt = select(TaxCode).where(TaxCode.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(TaxCode.outlet_id == outlet_id)
    if active_only:
        stmt = stmt.where(TaxCode.is_active.is_(True))
    stmt = stmt.order_by(TaxCode.name)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/tax-codes", response_model=TaxCodeResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["tax"])
async def create_tax_code(payload: TaxCodeCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:bills")
    if payload.outlet_id:
        await _resolve_outlet(identity, payload.outlet_id)
    tax_code = TaxCode(tenant_id=identity.tenant_id, **payload.model_dump())
    db.add(tax_code)
    await db.flush()
    return tax_code


@router.patch("/tax-codes/{tax_code_id}", response_model=TaxCodeResponse, tags=["tax"])
async def update_tax_code(tax_code_id: uuid.UUID, payload: TaxCodeUpdate,
                          identity: CurrentIdentity, db: DbDep):
    identity.require("manage:bills")
    tax_code = await db.scalar(
        select(TaxCode).where(TaxCode.id == tax_code_id,
                              TaxCode.tenant_id == identity.tenant_id)
    )
    if tax_code is None:
        raise HTTPException(status_code=404, detail="Tax code not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tax_code, field, value)
    await db.flush()
    return tax_code


@router.get("/discounts", response_model=list[DiscountResponse], tags=["discounts"])
async def list_discounts(identity: CurrentIdentity, db: DbDep,
                         outlet_id: uuid.UUID | None = None,
                         active_only: bool = True):
    identity.require("view:bills")
    stmt = select(Discount).where(Discount.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(Discount.outlet_id == outlet_id)
    if active_only:
        stmt = stmt.where(Discount.is_active.is_(True))
    stmt = stmt.order_by(Discount.name)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/discounts", response_model=DiscountResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["discounts"])
async def create_discount(payload: DiscountCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:bills")
    discount = Discount(tenant_id=identity.tenant_id, **payload.model_dump())
    db.add(discount)
    await db.flush()
    return discount


@router.get("/service-charges", response_model=list[ServiceChargeConfigResponse], tags=["charges"])
async def list_service_charges(identity: CurrentIdentity, db: DbDep,
                               outlet_id: uuid.UUID | None = None):
    identity.require("view:bills")
    stmt = select(ServiceChargeConfig).where(
        ServiceChargeConfig.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(ServiceChargeConfig.outlet_id == outlet_id)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/service-charges", response_model=ServiceChargeConfigResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["charges"])
async def create_service_charge(payload: ServiceChargeConfigCreate,
                                identity: CurrentIdentity, db: DbDep):
    identity.require("manage:bills")
    cfg = ServiceChargeConfig(tenant_id=identity.tenant_id, **payload.model_dump())
    db.add(cfg)
    await db.flush()
    return cfg


@router.get("/tip-configs", response_model=list[TipConfigResponse], tags=["charges"])
async def list_tip_configs(identity: CurrentIdentity, db: DbDep):
    identity.require("view:bills")
    stmt = select(TipConfig).where(TipConfig.tenant_id == identity.tenant_id)
    return list((await db.execute(stmt)).scalars().all())


@router.get("/coupons", response_model=list[CouponResponse], tags=["coupons"])
async def list_coupons(identity: CurrentIdentity, db: DbDep,
                       outlet_id: uuid.UUID | None = None,
                       active_only: bool = True):
    identity.require("view:bills")
    stmt = select(Coupon).where(Coupon.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(Coupon.outlet_id == outlet_id)
    if active_only:
        stmt = stmt.where(Coupon.is_active.is_(True))
    stmt = stmt.order_by(Coupon.code)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/coupons", response_model=CouponResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["coupons"])
async def create_coupon(payload: CouponCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:bills")
    coupon = Coupon(tenant_id=identity.tenant_id, **payload.model_dump())
    db.add(coupon)
    await db.flush()
    return coupon


def status_value(value: object) -> str:
    """Plain string for a status field, however it was obtained.

    Status columns are ``String``, not ``Enum``: a value just assigned in
    Python is the enum member, but the same field loaded back from Postgres is
    a plain ``str``. Only ``.value`` is member-specific, so calling it on a
    loaded row raises AttributeError.
    """
    import enum as _enum
    return value.value if isinstance(value, _enum.Enum) else str(value)


# ─── Shifts ─────────────────────────────────────────────────────────────────

@router.get("/shifts", response_model=list[ShiftResponse], tags=["shifts"])
async def list_shifts(identity: CurrentIdentity, db: DbDep,
                      outlet_id: uuid.UUID | None = None,
                      status_filter: str | None = None):
    identity.require("view:bills")
    stmt = select(Shift).where(Shift.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(Shift.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(Shift.status == status_filter)
    stmt = stmt.order_by(Shift.opened_at.desc().nullslast())
    return list((await db.execute(stmt)).scalars().all())


@router.post("/shifts/open", response_model=ShiftResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["shifts"],
             summary="Open a cashier shift with a register float")
async def open_shift(payload: ShiftOpen, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:bills")
    await _resolve_outlet(identity, payload.outlet_id)
    try:
        shift = await svc.open_shift(
            db, identity.tenant_id, payload.outlet_id,
            payload.user_id or identity.user_id,
            opening_cash=payload.opening_cash,
            shift_type=payload.shift_type,
            denominations=payload.denominations,
            notes=payload.notes,
        )
    except svc.BillingError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return await svc.load_shift(db, identity.tenant_id, shift.id)


@router.get("/shifts/{shift_id}", response_model=ShiftResponse, tags=["shifts"])
async def get_shift(shift_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:bills")
    shift = await svc.load_shift(db, identity.tenant_id, shift_id)
    if shift is None:
        raise HTTPException(status_code=404, detail="Shift not found")
    if not identity.can_access_outlet(shift.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    return shift


@router.post("/shifts/{shift_id}/cash", response_model=ShiftResponse,
             tags=["shifts"],
             summary="Record cash in or out of the drawer")
async def record_cash(shift_id: uuid.UUID, payload: CashMovementIn,
                      identity: CurrentIdentity, db: DbDep):
    """Record a drawer movement — paid in, paid out, drop, or pickup.

    Each is its own ledger row rather than a running total, so the closing
    reconciliation can explain where the money went instead of just where it is.
    """
    identity.require("manage:bills")
    shift = await svc.load_shift(db, identity.tenant_id, shift_id)
    if shift is None:
        raise HTTPException(status_code=404, detail="Shift not found")
    try:
        await svc.cash_movement(
            db, identity.tenant_id, shift, payload.movement_type,
            payload.amount, reason=payload.reason, created_by=identity.user_id,
        )
    except svc.BillingError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return await svc.load_shift(db, identity.tenant_id, shift_id)


@router.post("/shifts/{shift_id}/close", response_model=ShiftResponse,
             tags=["shifts"],
             summary="Close a shift and reconcile the drawer")
async def close_shift_endpoint(shift_id: uuid.UUID, payload: ShiftClose,
                               identity: CurrentIdentity, db: DbDep):
    """Close a shift.

    A non-zero discrepancy refuses to close until it is attributed to an
    approver — the guard against a cashier closing a drawer that is short and
    walking away. Passing ``approved_by`` acknowledges the difference was
    reviewed by someone other than the cashier.
    """
    identity.require("manage:bills")
    shift = await svc.load_shift(db, identity.tenant_id, shift_id)
    if shift is None:
        raise HTTPException(status_code=404, detail="Shift not found")
    try:
        await svc.close_shift(
            db, identity.tenant_id, shift, payload.closing_cash_actual,
            closed_by=identity.user_id,
            denominations=payload.denominations,
            discrepancy_reason=payload.discrepancy_reason,
            discrepancy_approved_by=payload.approved_by or identity.user_id,
        )
    except svc.BillingError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return await svc.load_shift(db, identity.tenant_id, shift_id)
