"""Customers service schemas."""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.services.customers.models import (
    CustomerStatus,
    FeedbackSource,
    FeedbackStatus,
)
from src.services.customers.util import normalize_phone as _normalize_phone


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Customers ───────────────────────────────────────────────────────────────

class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=1, max_length=30)
    email: str | None = Field(default=None, max_length=200)
    address: str | None = None
    gstin: str | None = Field(default=None, max_length=20)
    birthday: date | None = None
    anniversary: date | None = None
    notes: str | None = None
    tags: list = Field(default_factory=list)
    status: CustomerStatus = CustomerStatus.ACTIVE
    dietary: dict = Field(default_factory=dict)
    outlet_id: uuid.UUID | None = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return _normalize_phone(v)


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=200)
    address: str | None = None
    notes: str | None = None
    tags: list | None = None
    status: CustomerStatus | None = None
    dietary: dict | None = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        return _normalize_phone(v) if v is not None else None


class CustomerResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    phone: str
    email: str | None
    address: str | None
    gstin: str | None
    birthday: date | None
    anniversary: date | None
    notes: str | None
    tags: list
    status: CustomerStatus
    dietary: dict
    total_visits: int
    total_spent: float
    last_visit_at: datetime | None
    created_at: datetime


# ─── Preferences ─────────────────────────────────────────────────────────────

class PreferencesUpdate(BaseModel):
    favourite_dishes: list | None = None
    allergies: list | None = None
    dislikes: list | None = None
    seating_preference: str | None = Field(default=None, max_length=100)
    special_instructions: str | None = None


class PreferencesResponse(OrmModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    favourite_dishes: list
    allergies: list
    dislikes: list
    seating_preference: str | None
    special_instructions: str | None
    updated_at: datetime


# ─── Visits ──────────────────────────────────────────────────────────────────

class VisitResponse(OrmModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    outlet_id: uuid.UUID | None
    bill_id: uuid.UUID | None
    order_id: uuid.UUID | None
    amount: float
    covers: int
    visited_at: datetime


# ─── Feedback ────────────────────────────────────────────────────────────────

class FeedbackCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    customer_id: uuid.UUID | None = None
    bill_id: uuid.UUID | None = None
    order_id: uuid.UUID | None = None
    rating_overall: int = Field(ge=1, le=5, default=5)
    rating_food: int | None = Field(default=None, ge=1, le=5)
    rating_service: int | None = Field(default=None, ge=1, le=5)
    rating_ambience: int | None = Field(default=None, ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)
    source: FeedbackSource = FeedbackSource.POS


class FeedbackResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    customer_id: uuid.UUID | None
    bill_id: uuid.UUID | None
    order_id: uuid.UUID | None
    rating_overall: int
    rating_food: int | None
    rating_service: int | None
    rating_ambience: int | None
    comment: str | None
    status: FeedbackStatus
    source: FeedbackSource
    created_at: datetime


class FeedbackUpdate(BaseModel):
    status: FeedbackStatus | None = None
    comment: str | None = Field(default=None, max_length=1000)


class FeedbackSummary(BaseModel):
    """Average ratings for the front-of-house quality board."""

    count: int
    average_overall: float
    average_food: float | None
    average_service: float | None
    average_ambience: float | None
