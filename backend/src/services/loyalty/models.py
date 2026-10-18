"""Loyalty service models — programs, accounts, point transactions, wallets.

Owns ``restaurantos_loyalty``. Cross-service columns carry NO foreign key:

  * ``customer_id`` — crm service
  * ``bill_id``     — billing service
  * ``outlet_id``   — organization service

``bill_id`` on a loyalty transaction is deliberately a bare UUID snapshot, not
a foreign key. Billing owns bills; if a bill were ever deleted, the loyalty
ledger must still show where the points came from. An audit trail is a record
of what happened, and it outlives the transaction it records.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.services.shared.service_db import service_base

# This service's own base, not the shared ServiceBase. See service_db.
ServiceBase = service_base("loyalty")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LoyaltyTxnType(str, enum.Enum):
    EARN = "earn"
    REDEEM = "redeem"
    EXPIRE = "expire"
    ADJUST = "adjust"


class WalletTxnType(str, enum.Enum):
    CREDIT = "credit"
    DEBIT = "debit"
    REFUND = "refund"
    ADJUST = "adjust"


def txn_value(value: object) -> str:
    """Plain string for a status field, however it was obtained.

    Status columns are ``String``, not ``Enum``: a value just assigned in
    Python is the enum member, but the same field loaded back from Postgres is
    a plain ``str``. Members subclass ``str``, so equality works either way —
    ``txn.txn_type != LoyaltyTxnType.EXPIRE`` is correct for both. Only
    ``.value`` is member-specific, and calling it on a loaded row raises
    AttributeError. This accessor is the one that always works.
    """
    return value.value if isinstance(value, enum.Enum) else str(value)


class TimestampMixin:
    """Timestamps set application-side, not by the DB.

    A server_default/onupdate function makes SQLAlchemy re-SELECT the row to
    learn the value. That lazy load lands outside the request's async context
    and fails as MissingGreenlet when Pydantic serialises the response, so the
    values are generated in Python instead.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )


class LoyaltyProgram(ServiceBase, TimestampMixin):
    __tablename__ = "loyalty_programs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # How many points per unit of currency spent, and what a point is worth.
    points_per_currency: Mapped[float] = mapped_column(Numeric(10, 4), default=1)
    redemption_value: Mapped[float] = mapped_column(Numeric(10, 4), default=1)
    min_redemption_points: Mapped[int] = mapped_column(Integer, default=100)
    expiry_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tiers: Mapped[list] = mapped_column(JSONB, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # No ForeignKey on program_id, so the join must be named explicitly or
    # SQLAlchemy raises at first query.
    accounts: Mapped[list["CustomerLoyaltyAccount"]] = relationship(
        back_populates="program",
        primaryjoin="LoyaltyProgram.id == CustomerLoyaltyAccount.program_id",
        foreign_keys="CustomerLoyaltyAccount.program_id",
        cascade="all, delete-orphan",
    )


class CustomerLoyaltyAccount(ServiceBase, TimestampMixin):
    __tablename__ = "customer_loyalty_accounts"
    __table_args__ = (
        UniqueConstraint("customer_id", "program_id", name="uq_loyalty_customer_program"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # Bare UUID: customers live in the crm service.
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("loyalty_programs.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    points_balance: Mapped[int] = mapped_column(Integer, default=0)
    lifetime_points: Mapped[int] = mapped_column(Integer, default=0)
    tier: Mapped[str] = mapped_column(String(50), default="base")
    enrolled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_activity_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    program: Mapped["LoyaltyProgram"] = relationship(
        back_populates="accounts",
        primaryjoin="CustomerLoyaltyAccount.program_id == LoyaltyProgram.id",
        foreign_keys="CustomerLoyaltyAccount.program_id",
    )
    transactions: Mapped[list["LoyaltyTransaction"]] = relationship(
        back_populates="account",
        primaryjoin="CustomerLoyaltyAccount.id == LoyaltyTransaction.account_id",
        foreign_keys="LoyaltyTransaction.account_id",
        cascade="all, delete-orphan",
    )


class LoyaltyTransaction(ServiceBase, TimestampMixin):
    """Append-only point ledger. One row per movement, never updated in place.

    ``points`` is signed: earns are positive, redemptions and expiries negative.
    The balance is therefore always the sum of this table, which means it can be
    recomputed from the ledger at any time to detect drift — something an
    in-place balance column cannot do.
    """

    __tablename__ = "loyalty_transactions"
    __table_args__ = (
        Index("ix_loyalty_txns_account", "account_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customer_loyalty_accounts.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # Bare UUID snapshot: the bill lives in the billing service.
    bill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    txn_type: Mapped[LoyaltyTxnType] = mapped_column(String(20), nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    value_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)

    account: Mapped["CustomerLoyaltyAccount"] = relationship(
        back_populates="transactions",
        primaryjoin="LoyaltyTransaction.account_id == CustomerLoyaltyAccount.id",
        foreign_keys="LoyaltyTransaction.account_id",
    )


class CustomerWallet(ServiceBase, TimestampMixin):
    """Prepaid balance, distinct from points.

    Points are a reward; a wallet holds real money the customer can spend.
    Keeping them separate means the ledger cannot silently convert a reward
    into a liability without going through an explicit debit.
    """

    __tablename__ = "customer_wallets"
    __table_args__ = (
        UniqueConstraint("customer_id", name="uq_loyalty_customer_wallet"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    balance: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    transactions: Mapped[list["WalletTransaction"]] = relationship(
        back_populates="wallet",
        primaryjoin="CustomerWallet.id == WalletTransaction.wallet_id",
        foreign_keys="WalletTransaction.wallet_id",
        cascade="all, delete-orphan",
    )


class WalletTransaction(ServiceBase, TimestampMixin):
    __tablename__ = "wallet_transactions"
    __table_args__ = (
        Index("ix_loyalty_wallet_txns_wallet", "wallet_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    wallet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customer_wallets.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    txn_type: Mapped[WalletTxnType] = mapped_column(String(20), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    bill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)

    wallet: Mapped["CustomerWallet"] = relationship(
        back_populates="transactions",
        primaryjoin="WalletTransaction.wallet_id == CustomerWallet.id",
        foreign_keys="WalletTransaction.wallet_id",
    )
