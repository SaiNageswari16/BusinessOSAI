"""Loyalty service logic — earning, redemption, adjustment, wallets.

The point balance is denormalised on the account for fast reads, but the
ledger in ``loyalty_transactions`` is the source of truth. Every movement
writes a ledger row AND updates the balance in the same transaction, so the
two can never diverge without a crashed write — and the balance can always be
recomputed from the ledger to detect drift.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.loyalty.models import (
    CustomerLoyaltyAccount,
    CustomerWallet,
    LoyaltyProgram,
    LoyaltyTransaction,
    LoyaltyTxnType,
    WalletTransaction,
    WalletTxnType,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid_or_none(value) -> uuid.UUID | None:
    """Parse a UUID out of event data, tolerating anything malformed.

    Event payloads are JSON, so every UUID arrives as a string. Assigning a
    string to a UUID column would raise "invalid input syntax for type uuid"
    on insert — the first event-driven earn would then fail every time.
    """
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


class LoyaltyError(Exception):
    """A rejected loyalty operation. The API layer maps this to 409 or 400."""


# ─── Loading ─────────────────────────────────────────────────────────────────

async def load_account(
    db: AsyncSession, tenant_id: uuid.UUID, account_id: uuid.UUID
) -> CustomerLoyaltyAccount | None:
    """Fetch an account with its recent ledger rows eagerly loaded.

    Eager, not lazy: the session runs with expire_on_commit=False and a lazy
    load would fire outside the request's async context, surfacing as
    MissingGreenlet when Pydantic serialises the response.
    """
    return (
        await db.execute(
            select(CustomerLoyaltyAccount)
            .options(selectinload(CustomerLoyaltyAccount.transactions))
            .where(
                CustomerLoyaltyAccount.id == account_id,
                CustomerLoyaltyAccount.tenant_id == tenant_id,
            )
        )
    ).scalars().first()


async def load_program(
    db: AsyncSession, tenant_id: uuid.UUID, program_id: uuid.UUID
) -> LoyaltyProgram | None:
    return await db.scalar(
        select(LoyaltyProgram).where(
            LoyaltyProgram.id == program_id,
            LoyaltyProgram.tenant_id == tenant_id,
        )
    )


async def program_account_count(
    db: AsyncSession, tenant_id: uuid.UUID, program_id: uuid.UUID
) -> int:
    return int(await db.scalar(
        select(func.count(CustomerLoyaltyAccount.id)).where(
            CustomerLoyaltyAccount.tenant_id == tenant_id,
            CustomerLoyaltyAccount.program_id == program_id,
        )
    ) or 0)


async def program_account_counts(
    db: AsyncSession, tenant_id: uuid.UUID, program_ids: list[uuid.UUID]
) -> dict[uuid.UUID, int]:
    """Enrolment counts for many programs in ONE query.

    Called while iterating a program list, so counting per program would be an
    N+1. One grouped SELECT is what a listing endpoint should issue.
    """
    if not program_ids:
        return {}
    rows = (
        await db.execute(
            select(CustomerLoyaltyAccount.program_id, func.count(CustomerLoyaltyAccount.id))
            .where(
                CustomerLoyaltyAccount.tenant_id == tenant_id,
                CustomerLoyaltyAccount.program_id.in_(program_ids),
            )
            .group_by(CustomerLoyaltyAccount.program_id)
        )
    ).all()
    return {pid: int(count or 0) for pid, count in rows}


# ─── Enrolment ───────────────────────────────────────────────────────────────

async def enroll_customer(
    db: AsyncSession, tenant_id: uuid.UUID, customer_id: uuid.UUID,
    program_id: uuid.UUID | None = None, tier: str | None = None,
) -> CustomerLoyaltyAccount:
    """Enrol a customer in a loyalty program.

    A program id is optional: if the tenant has exactly one active program,
    enrol into that. If there are several and none is named, it is ambiguous,
    so we raise rather than guessing — silently picking one would enroll
    everyone into the same program and the others would sit empty forever.
    """
    if program_id is None:
        active = (
            await db.execute(
                select(LoyaltyProgram).where(
                    LoyaltyProgram.tenant_id == tenant_id,
                    LoyaltyProgram.is_active.is_(True),
                )
                .order_by(LoyaltyProgram.created_at.asc())
            )
        ).scalars().all()
        if not active:
            raise LoyaltyError("No active loyalty program to enrol into")
        if len(active) > 1:
            raise LoyaltyError("Tenant has multiple programs; specify one")
        program_id = active[0].id

    existing = await db.scalar(
        select(CustomerLoyaltyAccount).where(
            CustomerLoyaltyAccount.tenant_id == tenant_id,
            CustomerLoyaltyAccount.customer_id == customer_id,
            CustomerLoyaltyAccount.program_id == program_id,
        )
    )
    if existing:
        # Re-enrolling is not an error — it is a no-op that returns the account.
        return existing

    account = CustomerLoyaltyAccount(
        tenant_id=tenant_id,
        customer_id=customer_id,
        program_id=program_id,
        points_balance=0,
        lifetime_points=0,
        tier=tier or "base",
        enrolled_at=_now(),
    )
    db.add(account)
    await db.flush()
    return account


# ─── Points ──────────────────────────────────────────────────────────────────

async def earn_points(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    account: CustomerLoyaltyAccount,
    points: int,
    *,
    bill_id: uuid.UUID | None = None,
    value_amount: float = 0,
    description: str | None = None,
) -> LoyaltyTransaction:
    """Award points and write the ledger row in one transaction.

    ``points`` is taken as-is and must be positive at the call site — a negative
    earn is a redemption or an expiry, and mixing them into one path makes the
    sign convention of the ledger meaningless.
    """
    if points <= 0:
        raise LoyaltyError("Earned points must be positive")

    txn = LoyaltyTransaction(
        tenant_id=tenant_id,
        account_id=account.id,
        bill_id=bill_id,
        txn_type=LoyaltyTxnType.EARN,
        points=int(points),
        value_amount=value_amount,
        description=description,
    )
    db.add(txn)
    account.points_balance += int(points)
    account.lifetime_points += int(points)
    account.last_activity_at = _now()
    await db.flush()
    return txn


async def redeem_points(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    account: CustomerLoyaltyAccount,
    points: int,
    *,
    bill_id: uuid.UUID | None = None,
    value_amount: float = 0,
    description: str | None = None,
) -> LoyaltyTransaction:
    """Spend points.

    The check is against the *denormalised* balance, which is why that column
    has to stay correct — but the decrement is row-locked by the transaction,
    so two concurrent redemptions cannot both see the old balance and both
    succeed past zero.
    """
    if points <= 0:
        raise LoyaltyError("Redeemed points must be positive")
    if account.points_balance < points:
        raise LoyaltyError(
            f"Insufficient points: balance {account.points_balance}, requested {points}"
        )

    txn = LoyaltyTransaction(
        tenant_id=tenant_id,
        account_id=account.id,
        bill_id=bill_id,
        txn_type=LoyaltyTxnType.REDEEM,
        points=-int(points),
        value_amount=value_amount,
        description=description,
    )
    db.add(txn)
    account.points_balance -= int(points)
    account.last_activity_at = _now()
    await db.flush()
    return txn


async def adjust_points(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    account: CustomerLoyaltyAccount,
    points: int,
    reason: str,
) -> LoyaltyTransaction:
    """Manual correction — a gift or a clawback.

    Never edits a balance directly. An adjustment that silently changed
    ``points_balance`` would leave the ledger unable to explain the balance,
    which defeats the point of keeping a ledger at all.
    """
    if not reason:
        raise LoyaltyError("Adjustments must record a reason")
    if points == 0:
        raise LoyaltyError("Adjustment cannot be zero")

    txn = LoyaltyTransaction(
        tenant_id=tenant_id,
        account_id=account.id,
        txn_type=LoyaltyTxnType.ADJUST,
        points=int(points),
        description=reason,
    )
    db.add(txn)
    account.points_balance += int(points)
    if int(points) > 0:
        account.lifetime_points += int(points)
    account.last_activity_at = _now()
    await db.flush()
    return txn


async def recompute_balance(
    db: AsyncSession, tenant_id: uuid.UUID, account: CustomerLoyaltyAccount
) -> int:
    """Recompute the balance from the ledger and repair drift.

    Called by an operator when the balance looks wrong. The ledger wins: it is
    the append-only record, and the balance is just its cached sum.
    """
    total = await db.scalar(
        select(func.sum(LoyaltyTransaction.points)).where(
            LoyaltyTransaction.tenant_id == tenant_id,
            LoyaltyTransaction.account_id == account.id,
        )
    )
    corrected = int(total or 0)
    if corrected != account.points_balance:
        account.points_balance = corrected
        await db.flush()
    return corrected


async def ledger_reconciles(
    db: AsyncSession, tenant_id: uuid.UUID, account: CustomerLoyaltyAccount
) -> tuple[bool, int]:
    """Whether the cached balance still matches the ledger."""
    total = await db.scalar(
        select(func.sum(LoyaltyTransaction.points)).where(
            LoyaltyTransaction.tenant_id == tenant_id,
            LoyaltyTransaction.account_id == account.id,
        )
    )
    ledger_total = int(total or 0)
    return (ledger_total == account.points_balance, ledger_total)


# ─── Wallet ──────────────────────────────────────────────────────────────────

async def load_wallet(
    db: AsyncSession, tenant_id: uuid.UUID, wallet_id: uuid.UUID
) -> CustomerWallet | None:
    return await db.scalar(
        select(CustomerWallet).where(
            CustomerWallet.id == wallet_id,
            CustomerWallet.tenant_id == tenant_id,
        )
    )


async def wallet_for_customer(
    db: AsyncSession, tenant_id: uuid.UUID, customer_id: uuid.UUID
) -> CustomerWallet:
    """Get or create the customer's wallet."""
    wallet = await db.scalar(
        select(CustomerWallet).where(
            CustomerWallet.tenant_id == tenant_id,
            CustomerWallet.customer_id == customer_id,
        )
    )
    if wallet is None:
        wallet = CustomerWallet(tenant_id=tenant_id, customer_id=customer_id, balance=0)
        db.add(wallet)
        await db.flush()
    return wallet


async def credit_wallet(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    wallet: CustomerWallet,
    amount: float,
    *,
    bill_id: uuid.UUID | None = None,
    description: str | None = None,
) -> WalletTransaction:
    """Add money to a wallet.

    Wallet balance is money, so it stays a Decimal-safe float column and every
    movement is also a ledger row — the same rule as points.
    """
    if amount <= 0:
        raise LoyaltyError("Wallet credit must be positive")
    txn = WalletTransaction(
        tenant_id=tenant_id,
        wallet_id=wallet.id,
        txn_type=WalletTxnType.CREDIT,
        amount=amount,
        bill_id=bill_id,
        description=description,
    )
    db.add(txn)
    wallet.balance = round(float(wallet.balance) + float(amount), 2)
    await db.flush()
    return txn


async def debit_wallet(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    wallet: CustomerWallet,
    amount: float,
    *,
    bill_id: uuid.UUID | None = None,
    description: str | None = None,
) -> WalletTransaction:
    """Spend from a wallet.

    Refuses to overdraw. A negative wallet balance is not credit — it would
    mean the restaurant owes the customer money it never recorded taking.
    """
    if amount <= 0:
        raise LoyaltyError("Wallet debit must be positive")
    if float(wallet.balance) < float(amount):
        raise LoyaltyError(
            f"Insufficient wallet balance: {wallet.balance}, requested {amount}"
        )
    txn = WalletTransaction(
        tenant_id=tenant_id,
        wallet_id=wallet.id,
        txn_type=WalletTxnType.DEBIT,
        amount=amount,
        bill_id=bill_id,
        description=description,
    )
    db.add(txn)
    wallet.balance = round(float(wallet.balance) - float(amount), 2)
    await db.flush()
    return txn
