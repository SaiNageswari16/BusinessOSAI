"""Loyalty, wallet and gift card schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Programs ────────────────────────────────────────────────────

class LoyaltyProgramUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    points_per_currency: float = Field(default=1, ge=0)
    redemption_value: float = Field(default=0.01, ge=0)
    min_redemption_points: int = Field(default=0, ge=0)
    expiry_days: int | None = Field(default=None, ge=0)
    tiers: list[dict] = Field(default_factory=list)
    is_active: bool = True


class LoyaltyProgramResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    description: str | None
    points_per_currency: float
    redemption_value: float
    min_redemption_points: int
    expiry_days: int | None
    tiers: list
    is_active: bool
    created_at: datetime


# ─── Accounts ────────────────────────────────────────────────────

class LoyaltyEnrollRequest(BaseModel):
    customer_id: uuid.UUID
    program_id: uuid.UUID | None = None


class LoyaltyAccountResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    customer_id: uuid.UUID
    program_id: uuid.UUID
    points_balance: int
    lifetime_points: int
    tier: str | None
    enrolled_at: str | None
    last_activity_at: str | None


class LoyaltyTransactionResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    account_id: uuid.UUID
    bill_id: uuid.UUID | None
    txn_type: str
    points: int
    value_amount: float
    description: str | None
    created_at: datetime


class LoyaltyRedeemRequest(BaseModel):
    customer_id: uuid.UUID
    points: int = Field(gt=0)
    bill_id: uuid.UUID | None = None


class LoyaltyRedeemResponse(BaseModel):
    points_redeemed: int
    value_amount: float
    points_balance: int


class LoyaltyEarnRequest(BaseModel):
    customer_id: uuid.UUID
    bill_id: uuid.UUID
    amount: float = Field(gt=0)


class LoyaltyAdjustRequest(BaseModel):
    customer_id: uuid.UUID
    points: int = Field(description="Signed — positive to credit, negative to debit")
    description: str = Field(min_length=1, max_length=300)


# ─── Wallets ─────────────────────────────────────────────────────

class WalletResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    customer_id: uuid.UUID
    balance: float
    is_active: bool


class WalletTransactionResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    wallet_id: uuid.UUID
    bill_id: uuid.UUID | None
    txn_type: str
    amount: float
    description: str | None
    created_at: datetime


class WalletTopupRequest(BaseModel):
    customer_id: uuid.UUID
    amount: float = Field(gt=0)
    description: str | None = Field(default=None, max_length=300)


class WalletDebitRequest(BaseModel):
    customer_id: uuid.UUID
    amount: float = Field(gt=0)
    bill_id: uuid.UUID | None = None
    description: str | None = Field(default=None, max_length=300)


# ─── Gift cards ──────────────────────────────────────────────────

class GiftCardCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    initial_value: float = Field(gt=0)
    issued_to: str | None = Field(default=None, max_length=200)
    expires_at: str | None = Field(default=None, max_length=50)
    pin: str | None = Field(default=None, min_length=4, max_length=20)


class GiftCardResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    card_number: str
    initial_value: float
    balance: float
    status: str
    issued_to: str | None
    issued_at: str | None
    expires_at: str | None


class GiftCardRedeemRequest(BaseModel):
    amount: float = Field(gt=0)
    bill_id: uuid.UUID | None = None
    pin: str | None = Field(default=None, max_length=20)


class GiftCardRedeemResponse(BaseModel):
    card_number: str
    amount_redeemed: float
    balance: float
