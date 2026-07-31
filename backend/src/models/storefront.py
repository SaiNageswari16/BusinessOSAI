import uuid
from sqlalchemy import String, Numeric, Integer, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

class StorefrontWallet(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "storefront_wallets"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True, nullable=False)
    balance: Mapped[float] = mapped_column(Numeric(18, 2), default=0.0)
    osai_coins: Mapped[int] = mapped_column(Integer, default=0)
    membership_tier: Mapped[str] = mapped_column(String(50), default="Standard")
    card_last_four: Mapped[str] = mapped_column(String(4), nullable=True)

class StorefrontWalletTransaction(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "storefront_wallet_transactions"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), default="Top Up")
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    is_positive: Mapped[bool] = mapped_column(Boolean, default=True)

class StorefrontJourney(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "storefront_journeys"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=True)
    icon_type: Mapped[str] = mapped_column(String(50), default="plane")
    action_url: Mapped[str] = mapped_column(String(255), nullable=False)

class StorefrontNotification(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "storefront_notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(String(1000), nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="system")
    action_url: Mapped[str] = mapped_column(String(255), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
