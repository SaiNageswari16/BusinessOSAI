import enum
import uuid

from sqlalchemy import (
    Boolean,
    Enum,
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

from src.database.base import (
    Base,
    TenantScopedMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    db_enum,
    enum_values,
)


# ─── Loyalty ─────────────────────────────────────────────────────

class LoyaltyProgram(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "loyalty_programs"

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    points_per_currency: Mapped[float] = mapped_column(Numeric(10, 4), default=1)
    redemption_value: Mapped[float] = mapped_column(Numeric(10, 4), default=1)
    min_redemption_points: Mapped[int] = mapped_column(Integer, default=100)
    expiry_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tiers: Mapped[list] = mapped_column(JSONB, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    accounts: Mapped[list["CustomerLoyaltyAccount"]] = relationship(
        back_populates="program", cascade="all, delete-orphan"
    )


class CustomerLoyaltyAccount(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "customer_loyalty_accounts"
    __table_args__ = (
        UniqueConstraint("customer_id", "program_id", name="uq_customer_program"),
    )

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("loyalty_programs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    points_balance: Mapped[int] = mapped_column(Integer, default=0)
    lifetime_points: Mapped[int] = mapped_column(Integer, default=0)
    tier: Mapped[str] = mapped_column(String(50), default="base")
    enrolled_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_activity_at: Mapped[str | None] = mapped_column(String(50), nullable=True)

    customer: Mapped["Customer"] = relationship(foreign_keys=[customer_id])
    program: Mapped["LoyaltyProgram"] = relationship(back_populates="accounts", foreign_keys=[program_id])
    transactions: Mapped[list["LoyaltyTransaction"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )


class LoyaltyTxnType(str, enum.Enum):
    EARN = "earn"
    REDEEM = "redeem"
    EXPIRE = "expire"
    ADJUST = "adjust"


class LoyaltyTransaction(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "loyalty_transactions"

    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customer_loyalty_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    bill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bills.id", ondelete="SET NULL"), nullable=True
    )
    txn_type: Mapped[LoyaltyTxnType] = mapped_column(
        db_enum(LoyaltyTxnType, name="loyalty_txn_type"), nullable=False
    )
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    value_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)

    account: Mapped["CustomerLoyaltyAccount"] = relationship(
        back_populates="transactions", foreign_keys=[account_id]
    )
    bill: Mapped["Bill | None"] = relationship(foreign_keys=[bill_id])


# ─── Wallet & gift cards ─────────────────────────────────────────

class CustomerWallet(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "customer_wallets"
    __table_args__ = (
        UniqueConstraint("customer_id", name="uq_customer_wallet"),
    )

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    balance: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    customer: Mapped["Customer"] = relationship(foreign_keys=[customer_id])
    transactions: Mapped[list["WalletTransaction"]] = relationship(
        back_populates="wallet", cascade="all, delete-orphan"
    )


class WalletTxnType(str, enum.Enum):
    CREDIT = "credit"
    DEBIT = "debit"


class WalletTransaction(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "wallet_transactions"

    wallet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customer_wallets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    bill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bills.id", ondelete="SET NULL"), nullable=True
    )
    txn_type: Mapped[WalletTxnType] = mapped_column(
        db_enum(WalletTxnType, name="wallet_txn_type"), nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)

    wallet: Mapped["CustomerWallet"] = relationship(back_populates="transactions", foreign_keys=[wallet_id])


class GiftCardStatus(str, enum.Enum):
    ACTIVE = "active"
    REDEEMED = "redeemed"
    EXPIRED = "expired"
    VOID = "void"


class GiftCard(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "gift_cards"
    __table_args__ = (
        UniqueConstraint("tenant_id", "card_number", name="uq_tenant_gift_card_number"),
    )

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True
    )
    card_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    pin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    initial_value: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    balance: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[GiftCardStatus] = mapped_column(
        db_enum(GiftCardStatus, name="gift_card_status"), default=GiftCardStatus.ACTIVE
    )
    issued_to: Mapped[str | None] = mapped_column(String(200), nullable=True)
    issued_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    expires_at: Mapped[str | None] = mapped_column(String(50), nullable=True)


# ─── Aggregator integration ──────────────────────────────────────

class AggregatorName(str, enum.Enum):
    ZOMATO = "zomato"
    SWIGGY = "swiggy"
    MAGICPIN = "magicpin"
    DOTPE = "dotpe"


class AggregatorConfig(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "aggregator_configs"
    __table_args__ = (
        UniqueConstraint("outlet_id", "aggregator", name="uq_outlet_aggregator"),
    )

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    aggregator: Mapped[AggregatorName] = mapped_column(
        db_enum(AggregatorName, name="aggregator_name"), nullable=False
    )
    api_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    api_secret: Mapped[str | None] = mapped_column(String(255), nullable=True)
    restaurant_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    auto_accept: Mapped[bool] = mapped_column(Boolean, default=False)
    menu_sync_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    last_synced_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)


class AggregatorOrderMap(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "aggregator_order_maps"
    __table_args__ = (
        UniqueConstraint("outlet_id", "aggregator", "aggregator_order_id", name="uq_aggregator_order"),
    )

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    aggregator: Mapped[str] = mapped_column(String(50), nullable=False)
    aggregator_order_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True
    )
    raw_payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    synced_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sync_status: Mapped[str] = mapped_column(String(30), default="pending")
