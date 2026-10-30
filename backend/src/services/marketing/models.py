"""Marketing service models — campaigns, recipients, banner ads, reviews.

Owns ``restaurantos_marketing``. Cross-service columns carry NO foreign key
(bare UUID snapshots, documented per column):

  * ``customer_id`` — customers service. The marketing DB never reads the
    customers DB; recipients and review rows are ingested from explicit
    lists the frontend fetched from the customers service, or from events
    the bus delivers. If a customer is ever deleted, the campaign history
    must still show who was addressed.
  * ``outlet_id``   — organization service.
  * ``coupon_ref``  on a campaign is a billing coupon code, reference only:
    the message carries it, billing validates it at the till. No cross-DB
    join exists or is allowed.

``CustomerReview`` is the marketing-side working copy (for surfacing and
reply tracking). The customers service remains the source of truth for
reviews; this table is populated through the ingest endpoint only.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.services.shared.service_db import service_base

# This service's own base, not the shared ServiceBase. See service_db.
ServiceBase = service_base("marketing")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CampaignChannel(str, enum.Enum):
    SMS = "SMS"
    WHATSAPP = "WHATSAPP"
    EMAIL = "EMAIL"


class CampaignStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    SENT = "SENT"
    ARCHIVED = "ARCHIVED"


class RecipientStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"
    OPT_OUT = "OPT_OUT"


# Status columns are ``String``, not ``Enum``: a value just assigned in
# Python is the enum member, but the same field loaded back from Postgres is
# a plain ``str``. Members subclass ``str``, so equality works either way;
# only ``.value`` is member-specific, and calling it on a loaded row raises
# AttributeError. Access through ``.value if isinstance(..., enum.Enum)``.
def status_value(value: object) -> str:
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


class Campaign(ServiceBase, TimestampMixin):
    """An outreach effort on one channel (SMS / WhatsApp / Email).

    ``audience`` is JSON: ``{"type": "all|segment|new|repeat", "criteria":
    {...}}``. ``new`` / ``repeat`` audiences drive the event consumers
    (``customer.created`` / ``bill.paid``) which append PENDING recipients
    while the campaign is ACTIVE; ``segment`` criteria are resolved by the
    frontend (which fetches lists from the customers service and posts them
    via the recipients endpoint). This service can never cross-read the
    customers DB.
    """

    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # Bare UUID: the outlet lives in the organization service.
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    channel: Mapped[str] = mapped_column(String(20), default=CampaignChannel.SMS, nullable=False)
    audience: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    # Billing coupon code, reference only — no cross-DB join, no FK.
    coupon_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    schedule_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default=CampaignStatus.DRAFT, nullable=False, index=True
    )
    sent_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # No ForeignKey on recipient rows is needed — campaign_id IS an FK within
    # this service's own database.
    recipients: Mapped[list["CampaignRecipient"]] = relationship(
        back_populates="campaign",
        primaryjoin="Campaign.id == CampaignRecipient.campaign_id",
        foreign_keys="CampaignRecipient.campaign_id",
        cascade="all, delete-orphan",
    )


class CampaignRecipient(ServiceBase, TimestampMixin):
    """One customer on one campaign. Append-mostly; status tracks delivery.

    ``unique (campaign_id, customer_id)`` is the structural idempotency guard
    for the event consumers: a redelivered ``customer.created`` / ``bill.paid``
    attempts the same insert and is a no-op.
    """

    __tablename__ = "campaign_recipients"
    __table_args__ = (
        UniqueConstraint(
            "campaign_id", "customer_id", name="uq_campaign_recipient"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # Bare UUID snapshot: the customer lives in the customers service.
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    customer_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    segment: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default=RecipientStatus.PENDING, nullable=False, index=True
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(String(500), nullable=True)

    campaign: Mapped["Campaign"] = relationship(
        back_populates="recipients",
        primaryjoin="CampaignRecipient.campaign_id == Campaign.id",
        foreign_keys="CampaignRecipient.campaign_id",
    )


class BannerAd(ServiceBase, TimestampMixin):
    """A banner ad slot on a POS screen. Optional time window; when the
    window has passed the endpoint filtering by active excludes it."""

    __tablename__ = "banner_ads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # Bare UUID: the outlet lives in the organization service.
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    start_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    end_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class CustomerReview(ServiceBase, TimestampMixin):
    """Marketing-side working copy of a customer review.

    The customers service owns the authoritative review records; this table
    exists to surface reviews for reply tracking. ``order_ref`` is a bare
    snapshot of the order/bill number the review was about — no FK, because
    orders live in the pos service.
    """

    __tablename__ = "customer_reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # Bare UUID: the outlet lives in the organization service.
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    # Bare UUID: the customer lives in the customers service.
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # Bare order/bill number snapshot from the pos/billing services.
    order_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_replied: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reply_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False, index=True
    )


class ConsumedEvent(ServiceBase, TimestampMixin):
    """Durable idempotency ledger — one row per event this service consumed.

    Written by the bus's consumer loop via the installed dedupe ledger
    (``src.services.event_bus.dedupe``), so a redelivered event whose
    event_id is already here is skipped even after a process restart. The
    in-memory dedupe gate in ``EventBus`` alone is not restart-safe; this
    table closes that gap.

    ``event_id`` is the primary key — a redelivery with the same event_id
    is a no-op insert (``ON CONFLICT DO NOTHING``), which is exactly the
    check-then-mark primitive the dedupe helper needs.
    """

    __tablename__ = "consumed_events"

    event_id: Mapped[str] = mapped_column(
        String(64), primary_key=True
    )
    type: Mapped[str] = mapped_column(
        String(120), nullable=False, default="", index=True
    )
    consumed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )


class OutboxMessage(ServiceBase, TimestampMixin):
    """Transactional outbox row — one per event this service would emit.

    Written in the same transaction as the domain change so the two commit
    or roll back together. A relay marks rows published or dead; pending rows
    are what the relay keeps picking up on crash-recovery. ``event_id`` is
    the bus dedupe key, so a re-delivered event is a no-op on the consumer
    side even if the relay over-publishes it.

    Status transitions: pending -> published (relay succeeded) / dead (retries
    exhausted).
    """

    __tablename__ = "outbox_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    event_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    type: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    source_service: Mapped[str] = mapped_column(String(50), default="marketing")
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
