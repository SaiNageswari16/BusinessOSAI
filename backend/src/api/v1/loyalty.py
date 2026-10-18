"""Loyalty, wallet and gift card endpoints.

Points are an integer ledger: earning credits, redeeming debits. The balance is
recomputed from the transaction history on every mutation so it can never drift
from the ledger.
"""
import uuid
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission, resolve_outlet_id
from src.database.session import get_db
from src.models import (
    Bill,
    Customer,
    CustomerLoyaltyAccount,
    CustomerWallet,
    GiftCard,
    GiftCardStatus,
    LoyaltyProgram,
    LoyaltyTransaction,
    LoyaltyTxnType,
    WalletTransaction,
    WalletTxnType,
)
from src.schemas.loyalty import (
    GiftCardCreate,
    GiftCardRedeemRequest,
    GiftCardRedeemResponse,
    GiftCardResponse,
    LoyaltyAccountResponse,
    LoyaltyAdjustRequest,
    LoyaltyEarnRequest,
    LoyaltyEnrollRequest,
    LoyaltyProgramResponse,
    LoyaltyProgramUpdate,
    LoyaltyRedeemRequest,
    LoyaltyRedeemResponse,
    LoyaltyTransactionResponse,
    WalletDebitRequest,
    WalletResponse,
    WalletTopupRequest,
    WalletTransactionResponse,
)
from src.services.kot_service import _status_value
from src.services.number_series import allocate_number

router = APIRouter(prefix="/loyalty", tags=["Loyalty"])

TWO_PLACES = Decimal("0.01")


def _d(value) -> Decimal:
    return Decimal("0") if value is None else Decimal(str(value))


def _money(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _default_program(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID | None
) -> LoyaltyProgram | None:
    """The program that applies here — an outlet-specific one wins over a global."""
    stmt = select(LoyaltyProgram).where(
        LoyaltyProgram.tenant_id == tenant_id, LoyaltyProgram.is_active.is_(True)
    )
    if outlet_id:
        outlet_program = (
            await db.execute(stmt.where(LoyaltyProgram.outlet_id == outlet_id))
        ).scalars().first()
        if outlet_program:
            return outlet_program

    return (await db.execute(stmt.where(LoyaltyProgram.outlet_id.is_(None)))).scalars().first()


async def _get_account(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    customer_id: uuid.UUID,
    program_id: uuid.UUID,
) -> CustomerLoyaltyAccount:
    account = await db.scalar(
        select(CustomerLoyaltyAccount).where(
            CustomerLoyaltyAccount.customer_id == customer_id,
            CustomerLoyaltyAccount.program_id == program_id,
        )
    )
    if account is None:
        raise HTTPException(
            status_code=404,
            detail="Customer is not enrolled in a loyalty programme",
        )
    return account


async def _recompute_balance(
    db: AsyncSession, account: CustomerLoyaltyAccount
) -> None:
    """Balance = sum of every transaction. Earn and adjust-up add; redeem subtracts."""
    txns = (
        await db.execute(
            select(LoyaltyTransaction).where(
                LoyaltyTransaction.account_id == account.id
            )
        )
    ).scalars().all()

    balance = lifetime = 0
    for txn in txns:
        points = int(txn.points)
        if _status_value(txn.txn_type) in (
            LoyaltyTxnType.EARN.value,
            LoyaltyTxnType.ADJUST.value,
        ):
            balance += points
            if points > 0:
                lifetime += points
        elif _status_value(txn.txn_type) == LoyaltyTxnType.REDEEM.value:
            balance -= abs(points)
        elif _status_value(txn.txn_type) == LoyaltyTxnType.EXPIRE.value:
            balance -= abs(points)

    account.points_balance = balance
    account.lifetime_points = lifetime
    account.last_activity_at = _now_iso()


# ─── Programme ───────────────────────────────────────────────────

@router.get("/program", response_model=LoyaltyProgramResponse | None)
async def get_program(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    program = await _default_program(db, ctx.tenant_id, outlet_id)
    if program is None:
        return None
    return LoyaltyProgramResponse.model_validate(program)


@router.put("/program", response_model=LoyaltyProgramResponse)
async def update_program(
    payload: LoyaltyProgramUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
):
    """Update the programme in place, or create it if this outlet has none yet."""
    resolve_outlet_id(ctx, outlet_id, required=False)

    program = await _default_program(db, ctx.tenant_id, outlet_id)
    if program is None:
        program = LoyaltyProgram(
            tenant_id=ctx.tenant_id,
            outlet_id=outlet_id,
            name=payload.name,
            description=payload.description,
            points_per_currency=payload.points_per_currency,
            redemption_value=payload.redemption_value,
            min_redemption_points=payload.min_redemption_points,
            expiry_days=payload.expiry_days,
            tiers=payload.tiers,
            is_active=payload.is_active,
        )
        db.add(program)
    else:
        for field, value in payload.model_dump().items():
            setattr(program, field, value)

    await db.commit()
    await db.refresh(program)
    return LoyaltyProgramResponse.model_validate(program)


# ─── Enrolment & accounts ────────────────────────────────────────

@router.post("/enroll", response_model=LoyaltyAccountResponse,
             status_code=status.HTTP_201_CREATED)
async def enroll(
    payload: LoyaltyEnrollRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    customer = await db.scalar(
        select(Customer).where(
            Customer.id == payload.customer_id, Customer.tenant_id == ctx.tenant_id
        )
    )
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.outlet_id:
        resolve_outlet_id(ctx, customer.outlet_id)

    program = None
    if payload.program_id:
        program = await db.scalar(
            select(LoyaltyProgram).where(
                LoyaltyProgram.id == payload.program_id,
                LoyaltyProgram.tenant_id == ctx.tenant_id,
            )
        )
        if program is None:
            raise HTTPException(status_code=404, detail="Loyalty programme not found")
    else:
        program = await _default_program(db, ctx.tenant_id, customer.outlet_id)
        if program is None:
            raise HTTPException(
                status_code=409, detail="No active loyalty programme to enrol into"
            )

    existing = await db.scalar(
        select(CustomerLoyaltyAccount.id).where(
            CustomerLoyaltyAccount.customer_id == customer.id,
            CustomerLoyaltyAccount.program_id == program.id,
        )
    )
    if existing:
        raise HTTPException(
            status_code=409, detail="This customer is already enrolled"
        )

    account = CustomerLoyaltyAccount(
        tenant_id=ctx.tenant_id,
        customer_id=customer.id,
        program_id=program.id,
        points_balance=0,
        lifetime_points=0,
        tier="base",
        enrolled_at=_now_iso(),
        last_activity_at=_now_iso(),
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return LoyaltyAccountResponse.model_validate(account)


@router.get("/accounts/{customer_id}", response_model=LoyaltyAccountResponse | None)
async def get_account(
    customer_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    program_id: uuid.UUID | None = None,
):
    customer = await db.scalar(
        select(Customer).where(
            Customer.id == customer_id, Customer.tenant_id == ctx.tenant_id
        )
    )
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.outlet_id:
        resolve_outlet_id(ctx, customer.outlet_id)

    program = None
    if program_id:
        program = await db.scalar(
            select(LoyaltyProgram).where(LoyaltyProgram.id == program_id)
        )
    else:
        program = await _default_program(db, ctx.tenant_id, customer.outlet_id)

    if program is None:
        return None

    account = await _get_account(db, ctx.tenant_id, customer.id, program.id)
    return LoyaltyAccountResponse.model_validate(account)


@router.get("/transactions/{customer_id}", response_model=list[LoyaltyTransactionResponse])
async def list_transactions(
    customer_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 100,
):
    accounts = (
        await db.execute(
            select(CustomerLoyaltyAccount).where(
                CustomerLoyaltyAccount.customer_id == customer_id,
                CustomerLoyaltyAccount.tenant_id == ctx.tenant_id,
            )
        )
    ).scalars().all()

    if not accounts:
        return []

    stmt = (
        select(LoyaltyTransaction)
        .where(LoyaltyTransaction.account_id.in_([a.id for a in accounts]))
        .order_by(LoyaltyTransaction.created_at.desc())
        .limit(limit)
    )
    return [
        LoyaltyTransactionResponse.model_validate(t)
        for t in (await db.execute(stmt)).scalars().all()
    ]


# ─── Earn / redeem ───────────────────────────────────────────────

@router.post("/earn", response_model=LoyaltyAccountResponse)
async def earn_points(
    payload: LoyaltyEarnRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Award points for a settled bill — idempotent per bill."""
    bill = await db.scalar(
        select(Bill).where(Bill.id == payload.bill_id, Bill.tenant_id == ctx.tenant_id)
    )
    if bill is None:
        raise HTTPException(status_code=404, detail="Bill not found")
    resolve_outlet_id(ctx, bill.outlet_id)

    if _status_value(bill.status) != "settled":
        raise HTTPException(
            status_code=409, detail="Points can only be earned on a settled bill"
        )

    program = await _default_program(db, ctx.tenant_id, bill.outlet_id)
    if program is None:
        raise HTTPException(status_code=409, detail="No active loyalty programme")

    account = await db.scalar(
        select(CustomerLoyaltyAccount).where(
            CustomerLoyaltyAccount.customer_id == payload.customer_id,
            CustomerLoyaltyAccount.program_id == program.id,
        )
    )
    if account is None:
        # Auto-enrol on the first earn — no reason to make the cashier ask
        account = CustomerLoyaltyAccount(
            tenant_id=ctx.tenant_id,
            customer_id=payload.customer_id,
            program_id=program.id,
            tier="base",
            enrolled_at=_now_iso(),
        )
        db.add(account)
        await db.flush()

    # One award per bill
    already = await db.scalar(
        select(LoyaltyTransaction.id).where(
            LoyaltyTransaction.account_id == account.id,
            LoyaltyTransaction.bill_id == bill.id,
            LoyaltyTransaction.txn_type == LoyaltyTxnType.EARN,
        )
    )
    if already:
        raise HTTPException(
            status_code=409,
            detail=f"Points were already awarded for bill {bill.bill_number}",
        )

    amount = _d(payload.amount)
    points = int((amount * _d(program.points_per_currency)).to_integral_value())

    db.add(LoyaltyTransaction(
        tenant_id=ctx.tenant_id,
        account_id=account.id,
        bill_id=bill.id,
        txn_type=LoyaltyTxnType.EARN,
        points=points,
        value_amount=float(_money(amount)),
        description=f"Earned on {bill.bill_number}",
    ))
    await db.flush()
    await _recompute_balance(db, account)

    await db.commit()
    await db.refresh(account)
    return LoyaltyAccountResponse.model_validate(account)


@router.post("/redeem", response_model=LoyaltyRedeemResponse)
async def redeem_points(
    payload: LoyaltyRedeemRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Burn points for a cash value — the cashier applies it as a discount."""
    customer = await db.scalar(
        select(Customer).where(
            Customer.id == payload.customer_id, Customer.tenant_id == ctx.tenant_id
        )
    )
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.outlet_id:
        resolve_outlet_id(ctx, customer.outlet_id)

    if payload.bill_id:
        bill = await db.scalar(
            select(Bill).where(
                Bill.id == payload.bill_id, Bill.tenant_id == ctx.tenant_id
            )
        )
        if bill is None:
            raise HTTPException(status_code=404, detail="Bill not found")
        resolve_outlet_id(ctx, bill.outlet_id)

    program = await _default_program(db, ctx.tenant_id, customer.outlet_id)
    if program is None:
        raise HTTPException(status_code=409, detail="No active loyalty programme")

    account = await db.scalar(
        select(CustomerLoyaltyAccount).where(
            CustomerLoyaltyAccount.customer_id == customer.id,
            CustomerLoyaltyAccount.program_id == program.id,
        )
    )
    if account is None:
        raise HTTPException(status_code=404, detail="Customer is not enrolled")

    if payload.points < int(program.min_redemption_points or 0):
        raise HTTPException(
            status_code=400,
            detail=f"At least {program.min_redemption_points} points are needed to redeem",
        )
    if payload.points > int(account.points_balance or 0):
        raise HTTPException(
            status_code=400,
            detail=f"Only {account.points_balance} points available",
        )

    value = _money(_d(payload.points) * _d(program.redemption_value))

    db.add(LoyaltyTransaction(
        tenant_id=ctx.tenant_id,
        account_id=account.id,
        bill_id=payload.bill_id,
        txn_type=LoyaltyTxnType.REDEEM,
        points=payload.points,
        value_amount=float(value),
        description=f"Redeemed {payload.points} points",
    ))
    await db.flush()
    await _recompute_balance(db, account)

    await db.commit()
    await db.refresh(account)

    return LoyaltyRedeemResponse(
        points_redeemed=payload.points,
        value_amount=float(value),
        points_balance=int(account.points_balance or 0),
    )


@router.post("/adjust", response_model=LoyaltyAccountResponse)
async def adjust_points(
    payload: LoyaltyAdjustRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Manual correction — signed points, always with a reason."""
    if payload.points == 0:
        raise HTTPException(status_code=422, detail="Adjustment cannot be zero")

    customer = await db.scalar(
        select(Customer).where(
            Customer.id == payload.customer_id, Customer.tenant_id == ctx.tenant_id
        )
    )
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.outlet_id:
        resolve_outlet_id(ctx, customer.outlet_id)

    program = await _default_program(db, ctx.tenant_id, customer.outlet_id)
    if program is None:
        raise HTTPException(status_code=409, detail="No active loyalty programme")

    account = await db.scalar(
        select(CustomerLoyaltyAccount).where(
            CustomerLoyaltyAccount.customer_id == customer.id,
            CustomerLoyaltyAccount.program_id == program.id,
        )
    )
    if account is None:
        raise HTTPException(status_code=404, detail="Customer is not enrolled")

    # Never let a correction push the balance negative
    projected = int(account.points_balance or 0) + payload.points
    if projected < 0:
        raise HTTPException(
            status_code=400,
            detail=f"This would leave the balance at {projected} points",
        )

    db.add(LoyaltyTransaction(
        tenant_id=ctx.tenant_id,
        account_id=account.id,
        txn_type=LoyaltyTxnType.ADJUST,
        points=payload.points,
        value_amount=0,
        description=payload.description,
    ))
    await db.flush()
    await _recompute_balance(db, account)

    await db.commit()
    await db.refresh(account)
    return LoyaltyAccountResponse.model_validate(account)


# ─── Wallet ──────────────────────────────────────────────────────

async def _get_wallet(
    db: AsyncSession, tenant_id: uuid.UUID, customer_id: uuid.UUID
) -> CustomerWallet:
    wallet = await db.scalar(
        select(CustomerWallet).where(CustomerWallet.customer_id == customer_id)
    )
    if wallet is None:
        wallet = CustomerWallet(
            tenant_id=tenant_id, customer_id=customer_id, balance=0
        )
        db.add(wallet)
        await db.flush()
    return wallet


@router.get("/wallet/{customer_id}", response_model=WalletResponse)
async def get_wallet(
    customer_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    customer = await db.scalar(
        select(Customer).where(
            Customer.id == customer_id, Customer.tenant_id == ctx.tenant_id
        )
    )
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.outlet_id:
        resolve_outlet_id(ctx, customer.outlet_id)

    wallet = await _get_wallet(db, ctx.tenant_id, customer.id)
    return WalletResponse.model_validate(wallet)


@router.post("/wallet/topup", response_model=WalletResponse)
async def topup_wallet(
    payload: WalletTopupRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    customer = await db.scalar(
        select(Customer).where(
            Customer.id == payload.customer_id, Customer.tenant_id == ctx.tenant_id
        )
    )
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.outlet_id:
        resolve_outlet_id(ctx, customer.outlet_id)

    wallet = await _get_wallet(db, ctx.tenant_id, customer.id)

    wallet.balance = float(_money(_d(wallet.balance) + _d(payload.amount)))
    db.add(WalletTransaction(
        tenant_id=ctx.tenant_id,
        wallet_id=wallet.id,
        txn_type=WalletTxnType.CREDIT,
        amount=float(_money(_d(payload.amount))),
        description=payload.description or "Wallet top-up",
    ))

    await db.commit()
    await db.refresh(wallet)
    return WalletResponse.model_validate(wallet)


@router.post("/wallet/debit", response_model=WalletResponse)
async def debit_wallet(
    payload: WalletDebitRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Spend stored credit against a bill."""
    customer = await db.scalar(
        select(Customer).where(
            Customer.id == payload.customer_id, Customer.tenant_id == ctx.tenant_id
        )
    )
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.outlet_id:
        resolve_outlet_id(ctx, customer.outlet_id)

    if payload.bill_id:
        bill = await db.scalar(
            select(Bill).where(
                Bill.id == payload.bill_id, Bill.tenant_id == ctx.tenant_id
            )
        )
        if bill is None:
            raise HTTPException(status_code=404, detail="Bill not found")
        resolve_outlet_id(ctx, bill.outlet_id)

    wallet = await _get_wallet(db, ctx.tenant_id, customer.id)
    amount = _money(_d(payload.amount))

    if amount > _d(wallet.balance):
        raise HTTPException(
            status_code=400,
            detail=f"Wallet balance is only ₹{wallet.balance}",
        )

    wallet.balance = float(_money(_d(wallet.balance) - amount))
    db.add(WalletTransaction(
        tenant_id=ctx.tenant_id,
        wallet_id=wallet.id,
        bill_id=payload.bill_id,
        txn_type=WalletTxnType.DEBIT,
        amount=float(amount),
        description=payload.description or "Paid from wallet",
    ))

    await db.commit()
    await db.refresh(wallet)
    return WalletResponse.model_validate(wallet)


@router.get("/wallet/{customer_id}/transactions",
            response_model=list[WalletTransactionResponse])
async def list_wallet_transactions(
    customer_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 100,
):
    wallet = await db.scalar(
        select(CustomerWallet).where(CustomerWallet.customer_id == customer_id)
    )
    if wallet is None:
        return []

    stmt = (
        select(WalletTransaction)
        .where(WalletTransaction.wallet_id == wallet.id)
        .order_by(WalletTransaction.created_at.desc())
        .limit(limit)
    )
    return [
        WalletTransactionResponse.model_validate(t)
        for t in (await db.execute(stmt)).scalars().all()
    ]


# ─── Gift cards ──────────────────────────────────────────────────

@router.post("/gift-cards", response_model=GiftCardResponse,
             status_code=status.HTTP_201_CREATED)
async def create_gift_card(
    payload: GiftCardCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id, required=False)

    card_number = await allocate_number(db, ctx.tenant_id, "gift_card", payload.outlet_id)

    gift_card = GiftCard(
        tenant_id=ctx.tenant_id,
        outlet_id=payload.outlet_id,
        card_number=card_number,
        pin=payload.pin,
        initial_value=float(_money(_d(payload.initial_value))),
        balance=float(_money(_d(payload.initial_value))),
        status=GiftCardStatus.ACTIVE,
        issued_to=payload.issued_to,
        issued_at=_now_iso(),
        expires_at=payload.expires_at,
    )
    db.add(gift_card)
    await db.commit()
    await db.refresh(gift_card)
    return GiftCardResponse.model_validate(gift_card)


@router.get("/gift-cards", response_model=list[GiftCardResponse])
async def list_gift_cards(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    status_filter: str | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(GiftCard).where(GiftCard.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(GiftCard.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(GiftCard.status == status_filter)
    stmt = stmt.order_by(GiftCard.created_at.desc())
    return [
        GiftCardResponse.model_validate(g)
        for g in (await db.execute(stmt)).scalars().all()
    ]


@router.get("/gift-cards/{card_number}", response_model=GiftCardResponse)
async def get_gift_card(
    card_number: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Balance check at the counter — the cashier reads the number off the card."""
    gift_card = await db.scalar(
        select(GiftCard).where(
            GiftCard.tenant_id == ctx.tenant_id, GiftCard.card_number == card_number
        )
    )
    if gift_card is None:
        raise HTTPException(status_code=404, detail="Gift card not found")
    if gift_card.outlet_id:
        resolve_outlet_id(ctx, gift_card.outlet_id)
    return GiftCardResponse.model_validate(gift_card)


@router.post("/gift-cards/{card_number}/redeem", response_model=GiftCardRedeemResponse)
async def redeem_gift_card(
    card_number: str,
    payload: GiftCardRedeemRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    gift_card = await db.scalar(
        select(GiftCard).where(
            GiftCard.tenant_id == ctx.tenant_id, GiftCard.card_number == card_number
        )
    )
    if gift_card is None:
        raise HTTPException(status_code=404, detail="Gift card not found")
    if gift_card.outlet_id:
        resolve_outlet_id(ctx, gift_card.outlet_id)

    if _status_value(gift_card.status) != GiftCardStatus.ACTIVE.value:
        raise HTTPException(
            status_code=409, detail=f"This card is {_status_value(gift_card.status)}"
        )

    if gift_card.pin and gift_card.pin != payload.pin:
        raise HTTPException(status_code=403, detail="Incorrect PIN")

    if gift_card.expires_at and gift_card.expires_at < datetime.now(timezone.utc).isoformat():
        gift_card.status = GiftCardStatus.EXPIRED
        await db.commit()
        raise HTTPException(status_code=409, detail="This card has expired")

    amount = _money(_d(payload.amount))
    if amount > _d(gift_card.balance):
        raise HTTPException(
            status_code=400,
            detail=f"This card has only ₹{gift_card.balance} left",
        )

    gift_card.balance = float(_money(_d(gift_card.balance) - amount))
    if gift_card.balance <= 0:
        gift_card.status = GiftCardStatus.REDEEMED

    if payload.bill_id:
        bill = await db.scalar(
            select(Bill).where(
                Bill.id == payload.bill_id, Bill.tenant_id == ctx.tenant_id
            )
        )
        if bill is None:
            raise HTTPException(status_code=404, detail="Bill not found")

    await db.commit()
    await db.refresh(gift_card)

    return GiftCardRedeemResponse(
        card_number=gift_card.card_number,
        amount_redeemed=float(amount),
        balance=float(_d(gift_card.balance)),
    )
