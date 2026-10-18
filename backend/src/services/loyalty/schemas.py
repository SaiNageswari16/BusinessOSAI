"""Loyalty service schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.services.loyalty.models import (
    LoyaltyTxnType,
    WalletTxnType,
)


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Programs ────────────────────────────────────────────────────────────────

class LoyaltyProgramCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    points_per_currency: float = Field(ge=0, default=1)
    points_per_unit_spend: float | None = None
    redemption_value: float = Field(ge=0, default=1)
    redemption_value_per_point: float | None = None
    min_redemption_points: int = Field(ge=0, default=100)
    expiry_days: int | None = Field(default=None, ge=1)
    tiers: list = Field(default_factory=list)
    outlet_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _coerce_rates(self) -> "LoyaltyProgramCreate":
        if self.points_per_unit_spend is not None:
            self.points_per_currency = self.points_per_unit_spend
        if self.redemption_value_per_point is not None:
            self.redemption_value = self.redemption_value_per_point
        return self


class LoyaltyProgramUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    points_per_currency: float | None = Field(default=None, ge=0)
    redemption_value: float | None = Field(default=None, ge=0)
    min_redemption_points: int | None = Field(default=None, ge=0)
    expiry_days: int | None = Field(default=None, ge=1)
    tiers: list | None = None
    is_active: bool | None = None


class LoyaltyProgramResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    description: str | None
    points_per_currency: float
    redemption_value: float
    min_redemption_points: int
    expiry_days: int | None
    tiers: list
    is_active: bool
    account_count: int = 0
    created_at: datetime


# ─── Accounts ────────────────────────────────────────────────────────────────

class AccountEnroll(BaseModel):
    customer_id: uuid.UUID
    program_id: uuid.UUID | None = None
    tier: str | None = Field(default=None, max_length=50)


class AccountResponse(OrmModel):
    """Account plus the last few movements. ``recent_transactions`` is a list of
    ORM rows passed straight through — they are eagerly loaded by the caller,
    never lazy, or serialisation would raise MissingGreenlet."""

    id: uuid.UUID
    customer_id: uuid.UUID
    program_id: uuid.UUID
    points_balance: int
    lifetime_points: int
    tier: str
    enrolled_at: datetime | None
    last_activity_at: datetime | None
    created_at: datetime
    recent_transactions: list["LoyaltyTxnResponse"] = Field(default_factory=list)


class LoyaltyTxnResponse(OrmModel):
    id: uuid.UUID
    account_id: uuid.UUID
    bill_id: uuid.UUID | None
    txn_type: LoyaltyTxnType
    points: int
    value_amount: float
    description: str | None
    created_at: datetime


class RedeemRequest(BaseModel):
    """Redeem points for value. Points are validated against the balance."""

    points: int = Field(ge=1)
    bill_id: uuid.UUID | None = None
    description: str | None = Field(default=None, max_length=300)


class AdjustRequest(BaseModel):
    """Manual correction. Recorded as its own ledger row, never a balance edit."""

    points: int
    reason: str = Field(min_length=1, max_length=300)


# ─── Wallet ─────────────────────────────────────────────────────────────────

class WalletCreate(BaseModel):
    customer_id: uuid.UUID
    balance: float = Field(ge=0, default=0)


class WalletResponse(OrmModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    balance: float
    is_active: bool
    created_at: datetime


class WalletTxnResponse(OrmModel):
    id: uuid.UUID
    wallet_id: uuid.UUID
    txn_type: WalletTxnType
    amount: float
    bill_id: uuid.UUID | None
    description: str | None
    created_at: datetime


class WalletCredit(BaseModel):
    amount: float = Field(gt=0)
    description: str | None = Field(default=None, max_length=300)
