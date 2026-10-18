"""Billing endpoints — bills, payments, refunds, tips, GST, discounts."""
import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission, resolve_outlet_id
from src.database.session import get_db
from src.models import (
    Bill,
    BillPayment,
    BillStatus,
    Discount,
    DiscountType,
    PaymentStatus,
    ServiceChargeConfig,
    TaxCode,
    TipConfig,
)
from src.schemas.billing import (
    BillCreate,
    BillItemResponse,
    BillPaymentResponse,
    BillRefundRequest,
    BillResponse,
    BillVoidRequest,
    CouponCreate,
    CouponResponse,
    CouponUpdate,
    DiscountCreate,
    DiscountResponse,
    DiscountUpdate,
    DiscountValidateRequest,
    DiscountValidateResponse,
    PaymentIn,
    ServiceChargeConfigUpdate,
    ServiceChargeConfigResponse,
    TaxCodeCreate,
    TaxCodeResponse,
    TaxCodeUpdate,
    TipConfigUpdate,
    TipConfigResponse,
)
from src.services import billing_service
from src.services.kot_service import _status_value

router = APIRouter(prefix="/billing", tags=["Billing"])

TWO_PLACES = Decimal("0.01")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _d(value) -> Decimal:
    return Decimal("0") if value is None else Decimal(str(value))


def _money(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES)


async def _get_bill_for_ctx(
    db: AsyncSession, ctx: CurrentUserContext, bill_id: uuid.UUID
) -> Bill:
    bill = (
        await db.execute(
            select(Bill)
            .options(selectinload(Bill.items), selectinload(Bill.payments))
            .where(Bill.id == bill_id, Bill.tenant_id == ctx.tenant_id)
        )
    ).scalars().first()
    if bill is None:
        raise HTTPException(status_code=404, detail="Bill not found")
    resolve_outlet_id(ctx, bill.outlet_id)
    return bill


# ─── Bills ───────────────────────────────────────────────────────

@router.get("/bills", response_model=list[BillResponse])
async def list_bills(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    shift_id: uuid.UUID | None = None,
    limit: int = 50,
    offset: int = 0,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(Bill).where(Bill.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(Bill.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(Bill.status == status_filter)
    if shift_id:
        stmt = stmt.where(Bill.shift_id == shift_id)
    if date_from:
        stmt = stmt.where(Bill.created_at >= date_from)
    if date_to:
        stmt = stmt.where(Bill.created_at <= date_to + "T23:59:59")
    stmt = stmt.order_by(Bill.created_at.desc()).limit(limit).offset(offset)

    bills = (await db.execute(stmt)).scalars().all()
    # Eager-load items and payments so the response serialises without lazy IO
    loaded = (
        await db.execute(
            select(Bill)
            .options(selectinload(Bill.items), selectinload(Bill.payments))
            .where(Bill.id.in_([b.id for b in bills]))
        )
    ).scalars().all()
    return [BillResponse.model_validate(b) for b in loaded]


@router.post("/bills", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
async def create_bill(
    payload: BillCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        bill = await billing_service.create_bill(
            db, ctx.tenant_id, payload, cashier_id=ctx.user_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    await db.refresh(bill, attribute_names=["items", "payments"])
    return BillResponse.model_validate(bill)


@router.get("/bills/{bill_id}", response_model=BillResponse)
async def get_bill(
    bill_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    bill = await _get_bill_for_ctx(db, ctx, bill_id)
    return BillResponse.model_validate(bill)


@router.get("/bills/{bill_id}/settlement", response_model=dict)
async def get_settlement(
    bill_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """The pay screen's running balance, broken down by tender."""
    bill = await _get_bill_for_ctx(db, ctx, bill_id)

    by_method: dict[str, float] = {}
    paid = Decimal("0")
    for payment in bill.payments or []:
        if _status_value(payment.status) != PaymentStatus.SUCCESS.value:
            continue
        key = _status_value(payment.method)
        amount = _d(payment.amount)
        by_method[key] = float(_d(by_method.get(key, 0)) + amount)
        paid += amount

    grand_total = _d(bill.grand_total)
    return {
        "bill_id": str(bill.id),
        "grand_total": float(grand_total),
        "paid_amount": float(paid),
        "balance": float(grand_total - paid),
        "change_amount": float(_d(bill.change_amount)),
        "by_method": by_method,
    }


@router.post("/bills/{bill_id}/settle", response_model=BillResponse)
async def settle_bill(
    bill_id: uuid.UUID,
    payload: dict,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("settle:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Take payment — send several payments in the `payments` list to split tender."""
    await _get_bill_for_ctx(db, ctx, bill_id)

    raw = payload.get("payments", []) if isinstance(payload, dict) else payload
    payments = [PaymentIn.model_validate(p) for p in raw]
    if not payments:
        raise HTTPException(status_code=422, detail="At least one payment is required")

    try:
        await billing_service.settle_bill(db, ctx.tenant_id, bill_id, payments)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    bill = await _get_bill_for_ctx(db, ctx, bill_id)
    return BillResponse.model_validate(bill)


@router.post("/bills/{bill_id}/void", response_model=BillResponse)
async def void_bill(
    bill_id: uuid.UUID,
    payload: BillVoidRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("void:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_bill_for_ctx(db, ctx, bill_id)
    try:
        await billing_service.void_bill(db, ctx.tenant_id, bill_id, payload.reason)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    bill = await _get_bill_for_ctx(db, ctx, bill_id)
    return BillResponse.model_validate(bill)


@router.post("/bills/{bill_id}/refund", response_model=BillResponse)
async def refund_bill(
    bill_id: uuid.UUID,
    payload: BillRefundRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("refund:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_bill_for_ctx(db, ctx, bill_id)
    try:
        await billing_service.refund_bill(
            db, ctx.tenant_id, bill_id,
            payment_id=payload.payment_id,
            amount=_d(payload.amount) if payload.amount is not None else None,
            reason=payload.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    bill = await _get_bill_for_ctx(db, ctx, bill_id)
    return BillResponse.model_validate(bill)


@router.put("/bills/{bill_id}/tip", response_model=BillResponse)
async def update_tip(
    bill_id: uuid.UUID,
    tip: float,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_bill_for_ctx(db, ctx, bill_id)
    try:
        await billing_service.apply_tip(db, ctx.tenant_id, bill_id, _d(tip))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.commit()
    bill = await _get_bill_for_ctx(db, ctx, bill_id)
    return BillResponse.model_validate(bill)


@router.get("/bills/{bill_id}/tip-suggestions", response_model=list[dict])
async def get_tip_suggestions(
    bill_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    bill = await _get_bill_for_ctx(db, ctx, bill_id)
    amounts = await billing_service.suggested_tips(
        db, ctx.tenant_id, bill.outlet_id, _d(bill.subtotal)
    )
    return [
        {"pct": pct, "amount": float(amount)}
        for pct, amount in zip([0, 5, 10], amounts)
    ]


@router.get("/bills/{bill_id}/payments", response_model=list[BillPaymentResponse])
async def list_payments(
    bill_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_bill_for_ctx(db, ctx, bill_id)
    stmt = select(BillPayment).where(
        BillPayment.bill_id == bill_id, BillPayment.tenant_id == ctx.tenant_id
    )
    return [
        BillPaymentResponse.model_validate(p)
        for p in (await db.execute(stmt)).scalars().all()
    ]


# ─── Tax codes ───────────────────────────────────────────────────

@router.get("/tax-codes", response_model=list[TaxCodeResponse])
async def list_tax_codes(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    include_inactive: bool = False,
):
    stmt = select(TaxCode).where(TaxCode.tenant_id == ctx.tenant_id)
    if not include_inactive:
        stmt = stmt.where(TaxCode.is_active.is_(True))
    stmt = stmt.order_by(TaxCode.code)
    return [
        TaxCodeResponse.model_validate(t) for t in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/tax-codes", response_model=TaxCodeResponse,
             status_code=status.HTTP_201_CREATED)
async def create_tax_code(
    payload: TaxCodeCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    clash = await db.scalar(
        select(TaxCode.id).where(
            TaxCode.tenant_id == ctx.tenant_id, TaxCode.code == payload.code
        )
    )
    if clash:
        raise HTTPException(status_code=409, detail=f"Tax code '{payload.code}' exists")

    tax_code = TaxCode(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(tax_code)
    await db.commit()
    await db.refresh(tax_code)
    return TaxCodeResponse.model_validate(tax_code)


@router.put("/tax-codes/{tax_code_id}", response_model=TaxCodeResponse)
async def update_tax_code(
    tax_code_id: uuid.UUID,
    payload: TaxCodeUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tax_code = await db.scalar(
        select(TaxCode).where(TaxCode.id == tax_code_id, TaxCode.tenant_id == ctx.tenant_id)
    )
    if tax_code is None:
        raise HTTPException(status_code=404, detail="Tax code not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tax_code, field, value)
    await db.commit()
    await db.refresh(tax_code)
    return TaxCodeResponse.model_validate(tax_code)


# ─── Discounts ───────────────────────────────────────────────────

@router.get("/discounts", response_model=list[DiscountResponse])
async def list_discounts(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    include_inactive: bool = False,
):
    stmt = select(Discount).where(Discount.tenant_id == ctx.tenant_id)
    if not include_inactive:
        stmt = stmt.where(Discount.is_active.is_(True))
    stmt = stmt.order_by(Discount.name)
    return [
        DiscountResponse.model_validate(d)
        for d in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/discounts", response_model=DiscountResponse,
             status_code=status.HTTP_201_CREATED)
async def create_discount(
    payload: DiscountCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:pricing_rules"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id, required=False)

    if payload.code:
        clash = await db.scalar(
            select(Discount.id).where(
                Discount.tenant_id == ctx.tenant_id, Discount.code == payload.code
            )
        )
        if clash:
            raise HTTPException(
                status_code=409, detail=f"Discount code '{payload.code}' already exists"
            )

    # code is NOT NULL in the DB but optional in the payload — derive one
    # from the name so omitting it doesn't blow up as a 500.
    data = payload.model_dump()
    if not data.get("code"):
        slug = re.sub(r"[^A-Z0-9]+", "-", data["name"].upper()).strip("-")
        data["code"] = (slug or "DISC")[:30]

    # The derived code can still collide (e.g. two "Smoke Discount" rules),
    # and a raw IntegrityError would surface as a 500 — suffix until free.
    base_code = data["code"]
    for suffix in range(1, 100):
        clash = await db.scalar(
            select(Discount.id).where(
                Discount.tenant_id == ctx.tenant_id, Discount.code == data["code"]
            )
        )
        if clash is None:
            break
        data["code"] = f"{base_code[:26]}-{suffix}"
    else:
        raise HTTPException(status_code=409, detail="Could not derive a unique discount code")

    discount = Discount(tenant_id=ctx.tenant_id, **data)
    db.add(discount)
    await db.commit()
    await db.refresh(discount)
    return DiscountResponse.model_validate(discount)


@router.put("/discounts/{discount_id}", response_model=DiscountResponse)
async def update_discount(
    discount_id: uuid.UUID,
    payload: DiscountUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:pricing_rules"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    discount = await db.scalar(
        select(Discount).where(
            Discount.id == discount_id, Discount.tenant_id == ctx.tenant_id
        )
    )
    if discount is None:
        raise HTTPException(status_code=404, detail="Discount not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(discount, field, value)
    await db.commit()
    await db.refresh(discount)
    return DiscountResponse.model_validate(discount)


@router.post("/discounts/validate", response_model=DiscountValidateResponse)
async def validate_discount(
    payload: DiscountValidateRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """The cashier types a code and sees the computed value before applying it."""
    discount = await db.scalar(
        select(Discount).where(
            Discount.tenant_id == ctx.tenant_id,
            Discount.code == payload.code,
            Discount.is_active.is_(True),
        )
    )
    if discount is None:
        return DiscountValidateResponse(
            valid=False, code=payload.code, reason="That code is not recognised"
        )

    today = datetime.now(timezone.utc).date().isoformat()
    if discount.valid_from and discount.valid_from > today:
        return DiscountValidateResponse(
            valid=False, code=payload.code,
            discount_id=discount.id,
            reason=f"This code starts on {discount.valid_from}",
        )
    if discount.valid_to and discount.valid_to < today:
        return DiscountValidateResponse(
            valid=False, code=payload.code,
            discount_id=discount.id,
            reason="This code has expired",
        )

    cart_total = _d(payload.cart_total)
    if _d(discount.min_order_value) > cart_total:
        return DiscountValidateResponse(
            valid=False, code=payload.code,
            discount_id=discount.id,
            reason=f"Spend at least ₹{discount.min_order_value} to use this code",
        )

    if discount.max_uses and int(discount.uses_count or 0) >= int(discount.max_uses):
        return DiscountValidateResponse(
            valid=False, code=payload.code,
            discount_id=discount.id,
            reason="This code has reached its usage limit",
        )

    # Compute what the code is worth on this cart
    if discount.discount_type == DiscountType.PERCENT:
        computed = cart_total * _d(discount.value) / Decimal("100")
        if discount.max_discount_amount:
            computed = min(computed, _d(discount.max_discount_amount))
    else:
        computed = min(_d(discount.value), cart_total)

    requires_approval = bool(
        discount.requires_approval_above
        and computed > _d(discount.requires_approval_above)
    )

    return DiscountValidateResponse(
        valid=True,
        code=payload.code,
        discount_id=discount.id,
        discount_type=_status_value(discount.discount_type),
        value=float(_d(discount.value)),
        computed_discount=float(_money(computed)),
        requires_approval=requires_approval,
    )


# ─── Coupons ─────────────────────────────────────────────────────

@router.get("/coupons", response_model=list[CouponResponse])
async def list_coupons(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    include_inactive: bool = False,
):
    from src.models import Coupon
    stmt = select(Coupon).where(Coupon.tenant_id == ctx.tenant_id)
    if not include_inactive:
        stmt = stmt.where(Coupon.is_active.is_(True))
    stmt = stmt.order_by(Coupon.code)
    return [
        CouponResponse.model_validate(c)
        for c in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/coupons", response_model=CouponResponse,
             status_code=status.HTTP_201_CREATED)
async def create_coupon(
    payload: CouponCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:pricing_rules"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Coupon
    resolve_outlet_id(ctx, payload.outlet_id, required=False)

    clash = await db.scalar(
        select(Coupon.id).where(
            Coupon.tenant_id == ctx.tenant_id, Coupon.code == payload.code
        )
    )
    if clash:
        raise HTTPException(status_code=409, detail=f"Coupon '{payload.code}' exists")

    coupon = Coupon(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)
    return CouponResponse.model_validate(coupon)


@router.put("/coupons/{coupon_id}", response_model=CouponResponse)
async def update_coupon(
    coupon_id: uuid.UUID,
    payload: CouponUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:pricing_rules"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Coupon
    coupon = await db.scalar(
        select(Coupon).where(Coupon.id == coupon_id, Coupon.tenant_id == ctx.tenant_id)
    )
    if coupon is None:
        raise HTTPException(status_code=404, detail="Coupon not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(coupon, field, value)
    await db.commit()
    await db.refresh(coupon)
    return CouponResponse.model_validate(coupon)


# ─── Service charge ──────────────────────────────────────────────

@router.get("/service-charge", response_model=list[ServiceChargeConfigResponse])
async def list_service_charge_configs(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    stmt = select(ServiceChargeConfig).where(
        ServiceChargeConfig.tenant_id == ctx.tenant_id
    )
    return [
        ServiceChargeConfigResponse.model_validate(c)
        for c in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/service-charge", response_model=ServiceChargeConfigResponse,
             status_code=status.HTTP_201_CREATED)
async def create_service_charge_config(
    payload: ServiceChargeConfigUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    config = ServiceChargeConfig(
        tenant_id=ctx.tenant_id, outlet_id=outlet_id, **payload.model_dump()
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return ServiceChargeConfigResponse.model_validate(config)


# ─── Tips ────────────────────────────────────────────────────────

@router.get("/tip-config", response_model=list[TipConfigResponse])
async def list_tip_configs(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    stmt = select(TipConfig).where(TipConfig.tenant_id == ctx.tenant_id)
    return [
        TipConfigResponse.model_validate(c)
        for c in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/tip-config", response_model=TipConfigResponse,
             status_code=status.HTTP_201_CREATED)
async def create_tip_config(
    payload: TipConfigUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:bills"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    config = TipConfig(
        tenant_id=ctx.tenant_id, outlet_id=outlet_id, **payload.model_dump()
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return TipConfigResponse.model_validate(config)
