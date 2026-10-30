"""Marketing service schemas."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from src.services.marketing.models import (
    CampaignChannel,
    CampaignStatus,
    RecipientStatus,
)


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Campaigns ───────────────────────────────────────────────────────────────

class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    channel: str = Field(default="SMS", pattern=r"^(SMS|WHATSAPP|EMAIL)$")
    # {"type": "all" | "segment" | "new" | "repeat", "criteria": {...}}
    audience: dict[str, Any] = Field(default_factory=dict)
    message: str = Field(min_length=1, max_length=5000)
    # Billing coupon code, reference only — validated by billing at the till.
    coupon_ref: str | None = Field(default=None, max_length=100)
    schedule_at: datetime | None = None
    outlet_id: uuid.UUID | None = None
    status: str = Field(default="DRAFT", pattern=r"^(DRAFT|ACTIVE)$")


class CampaignUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    channel: str | None = Field(default=None, pattern=r"^(SMS|WHATSAPP|EMAIL)$")
    audience: dict[str, Any] | None = None
    message: str | None = Field(default=None, min_length=1, max_length=5000)
    coupon_ref: str | None = None
    schedule_at: datetime | None = None
    outlet_id: uuid.UUID | None = None
    # Status transitions: DRAFT → ACTIVE → SENT → ARCHIVED. The route layer
    # validates the move; here only legal target states are accepted, and
    # PATCH status is only permitted while the campaign has not been sent.
    status: str | None = Field(default=None, pattern=r"^(DRAFT|ACTIVE|ARCHIVED)$")


class RecipientIn(BaseModel):
    customer_id: uuid.UUID
    name: str = Field(min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=50)
    segment: str | None = Field(default=None, max_length=50)


class RecipientsPreloadRequest(BaseModel):
    """The frontend fetches these lists from the customers service API and
    posts them here — marketing never cross-reads the customers DB."""

    recipients: list[RecipientIn] = Field(default_factory=list)


class RecipientsPreloadResponse(BaseModel):
    """How many recipients were actually added (duplicates are skipped)."""

    campaign_id: uuid.UUID
    added: int
    total: int


class RecipientResponse(OrmModel):
    id: uuid.UUID
    campaign_id: uuid.UUID
    customer_id: uuid.UUID
    customer_name: str
    customer_phone: str | None
    segment: str | None
    status: RecipientStatus
    sent_at: datetime | None
    error: str | None
    created_at: datetime


class CampaignResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    channel: str
    audience: dict[str, Any]
    message: str
    coupon_ref: str | None
    schedule_at: datetime | None
    status: CampaignStatus
    sent_count: int
    created_by: uuid.UUID | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CampaignSendResponse(BaseModel):
    campaign_id: uuid.UUID
    status: str
    sent_count: int
    recipients_finalized: int


# ─── Customer ingest ─────────────────────────────────────────────────────────

class CustomerIngestItem(BaseModel):
    customer_id: uuid.UUID
    name: str | None = None
    phone: str | None = None
    segment: str | None = None


class CustomerIngestRequest(BaseModel):
    """Explicit lists in, no cross-DB: the customers service stays the
    source of truth, marketing keeps a working copy for targeting."""

    customers: list[CustomerIngestItem] = Field(default_factory=list)


class CustomerIngestResponse(BaseModel):
    ingested: int


# ─── Banner ads ──────────────────────────────────────────────────────────────

class BannerAdCreate(BaseModel):
    image_url: str = Field(min_length=1, max_length=500)
    title: str | None = Field(default=None, max_length=200)
    outlet_id: uuid.UUID | None = None
    is_active: bool = True
    display_order: int = 0
    start_at: datetime | None = None
    end_at: datetime | None = None


class BannerAdUpdate(BaseModel):
    image_url: str | None = Field(default=None, min_length=1, max_length=500)
    title: str | None = Field(default=None, max_length=200)
    outlet_id: uuid.UUID | None = None
    is_active: bool | None = None
    display_order: int | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None


class BannerAdResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    image_url: str
    title: str | None
    is_active: bool
    display_order: int
    start_at: datetime | None
    end_at: datetime | None
    created_at: datetime
    updated_at: datetime


# ─── Reviews ─────────────────────────────────────────────────────────────────

class ReviewIn(BaseModel):
    customer_id: uuid.UUID
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=5000)
    outlet_id: uuid.UUID | None = None
    order_ref: str | None = Field(default=None, max_length=100)


class ReviewIngestRequest(BaseModel):
    """Marketing-side working copy; the customers service owns the source of
    truth. Reviews land here for surfacing and reply tracking."""

    reviews: list[ReviewIn] = Field(default_factory=list)


class ReviewIngestResponse(BaseModel):
    ingested: int


class ReviewResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    customer_id: uuid.UUID
    order_ref: str | None
    rating: int
    comment: str | None
    is_replied: bool
    reply_text: str | None
    at: datetime
    created_at: datetime


class ReviewReplyRequest(BaseModel):
    reply_text: str = Field(min_length=1, max_length=5000)


class ReviewSummary(BaseModel):
    count: int
    average_rating: float | None
    unreplied: int


# ─── Audiences ───────────────────────────────────────────────────────────────

class AudienceTypes(BaseModel):
    """Allowed audience types, kept here as documentation; the model column
    is free-form JSON because ``criteria`` is open-ended."""

    types: list[str] = ["all", "segment", "new", "repeat"]


# ─── Channels ────────────────────────────────────────────────────────────────

class ChannelListResponse(BaseModel):
    channels: list[str] = [c.value for c in CampaignChannel]
