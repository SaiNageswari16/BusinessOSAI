"""Marketing service logic — campaigns, banners, reviews.

Pure business rules, no HTTP: every function raises ``MarketingError`` and
the API layer maps it to a status code. Tenant scoping is always explicit —
every query carries ``tenant_id``.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.marketing.models import (
    BannerAd,
    Campaign,
    CampaignRecipient,
    CampaignStatus,
    CustomerReview,
    RecipientStatus,
    status_value,
)


class MarketingError(Exception):
    """A rejected marketing operation. The API layer maps to 404/409/400."""


# Legal status moves: DRAFT → ACTIVE → SENT → ARCHIVED (plus DRAFT → ARCHIVED
# to drop an unused draft). Anything else is a 409 at the API layer.
_ALLOWED_STATUS_TRANSITIONS: dict[str, set[str]] = {
    CampaignStatus.DRAFT.value: {
        CampaignStatus.ACTIVE.value,
        CampaignStatus.ARCHIVED.value,
    },
    CampaignStatus.ACTIVE.value: {
        CampaignStatus.SENT.value,
        CampaignStatus.ARCHIVED.value,
    },
    CampaignStatus.SENT.value: {CampaignStatus.ARCHIVED.value},
    CampaignStatus.ARCHIVED.value: set(),
}

_AUDIENCE_TYPES = {"all", "segment", "new", "repeat"}


async def load_campaign(
    db: AsyncSession, tenant_id: uuid.UUID, campaign_id: uuid.UUID
) -> Campaign | None:
    return await db.scalar(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.tenant_id == tenant_id,
        )
    )


async def list_campaigns(
    db: AsyncSession, tenant_id: uuid.UUID,
    status_filter: str | None = None,
    outlet_id: uuid.UUID | None = None,
) -> list[Campaign]:
    stmt = select(Campaign).where(Campaign.tenant_id == tenant_id)
    if status_filter:
        stmt = stmt.where(Campaign.status == status_filter)
    if outlet_id is not None:
        stmt = stmt.where(Campaign.outlet_id == outlet_id)
    stmt = stmt.order_by(Campaign.created_at.desc())
    return list((await db.execute(stmt)).scalars().all())


def _validate_audience(audience: dict | None) -> None:
    """The audience type must be one marketing understands; unknown types
    would make the event consumers no-op silently, which looks like a bug.
    """
    if not audience:
        return
    aud_type = str(audience.get("type") or "all")
    if aud_type not in _AUDIENCE_TYPES:
        raise MarketingError(
            f"Unknown audience type '{aud_type}' "
            f"(expected one of: {', '.join(sorted(_AUDIENCE_TYPES))})"
        )


async def create_campaign(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    name: str,
    channel: str,
    audience: dict,
    message: str,
    coupon_ref: str | None,
    schedule_at: datetime | None,
    outlet_id: uuid.UUID | None,
    created_by: uuid.UUID | None,
    status: str = "DRAFT",
) -> Campaign:
    _validate_audience(audience)
    campaign = Campaign(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        name=name,
        channel=channel,
        audience=audience or {},
        message=message,
        coupon_ref=coupon_ref,
        schedule_at=schedule_at,
        status=status,
        created_by=created_by,
    )
    db.add(campaign)
    await db.flush()
    return campaign


def _check_status_move(current: str, target: str) -> None:
    allowed = _ALLOWED_STATUS_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise MarketingError(
            f"Illegal status transition '{current}' -> '{target}' "
            f"(allowed: {sorted(allowed) or 'none'})"
        )


async def update_campaign(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    campaign_id: uuid.UUID,
    fields: dict,
) -> Campaign:
    """Apply a PATCH. Edited fields must respect the status rules:

    * ``status`` — only a legal transition, and only before the campaign is
      SENT (once sent, the recipient list is frozen; ARCHIVED is the one
      post-SENT move).
    * editing name/message/audience while ACTIVE is allowed — the campaign
      is not yet dispatched; the recipients table is what gets frozen.
    """
    campaign = await load_campaign(db, tenant_id, campaign_id)
    if campaign is None:
        raise MarketingError("Campaign not found")

    new_status = fields.pop("status", None)
    if new_status is not None:
        _check_status_move(status_value(campaign.status), str(new_status))
        campaign.status = new_status
    if "audience" in fields and fields["audience"] is not None:
        _validate_audience(fields["audience"])

    # A sent campaign's content is frozen (recipients already dispatched);
    # only ARCHIVED/SENT moves are legal and they never edit content.
    if status_value(campaign.status) == CampaignStatus.SENT.value and fields:
        raise MarketingError("Cannot edit a SENT campaign's content")

    for field_name, value in fields.items():
        if value is not None or field_name in ("coupon_ref", "schedule_at",
                                               "outlet_id"):
            setattr(campaign, field_name, value)
    await db.flush()
    return campaign


async def add_recipients(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    campaign: Campaign,
    recipients: list,
) -> int:
    """Pre-load the recipient list. Duplicate (campaign, customer) pairs are
    skipped — the unique constraint makes this idempotent, which the event
    consumers rely on too. Only campaigns that have not been SENT may gain
    recipients."""
    if status_value(campaign.status) == CampaignStatus.SENT.value:
        raise MarketingError("Cannot add recipients to a SENT campaign")
    added = 0
    seen: set[uuid.UUID] = set()
    for item in recipients:
        raw = item.get("customer_id")
        cust_id = raw if isinstance(raw, uuid.UUID) else uuid.UUID(str(raw))
        if cust_id in seen:
            continue
        seen.add(cust_id)
        existing = await db.scalar(
            select(CampaignRecipient.id).where(
                CampaignRecipient.campaign_id == campaign.id,
                CampaignRecipient.customer_id == cust_id,
            )
        )
        if existing:
            continue
        db.add(CampaignRecipient(
            campaign_id=campaign.id,
            tenant_id=tenant_id,
            customer_id=cust_id,
            customer_name=str(item.get("name") or item.get("customer_name") or "Unknown"),
            customer_phone=item.get("phone") or item.get("customer_phone"),
            segment=item.get("segment"),
            status=RecipientStatus.PENDING,
        ))
        added += 1
    await db.flush()
    return added


async def send_campaign(db: AsyncSession, tenant_id: uuid.UUID, campaign_id: uuid.UUID) -> tuple[Campaign, int]:
    """Finalize a campaign for dispatch: mark SENT, stamp every PENDING
    recipient SENT, roll up the count. The caller emits the outbox event in
    the SAME transaction (see api.py) — this function only owns the state
    move, the API owns the commit, because the outbox row must land in the
    same txn as the domain change."""
    campaign = await load_campaign(db, tenant_id, campaign_id)
    if campaign is None:
        raise MarketingError("Campaign not found")
    current = status_value(campaign.status)
    # SENT may be issued from ACTIVE (normal) or re-asserted idempotently;
    # a DRAFT campaign cannot be "sent" until it is activated — nothing is
    # finalized on a draft.
    if current == CampaignStatus.DRAFT.value:
        raise MarketingError("Cannot send a DRAFT campaign — activate it first")
    if current != CampaignStatus.SENT.value:
        campaign.status = CampaignStatus.SENT

    rows = (await db.execute(
        select(CampaignRecipient).where(
            CampaignRecipient.campaign_id == campaign_id,
            CampaignRecipient.tenant_id == tenant_id,
            CampaignRecipient.status == RecipientStatus.PENDING,
        )
    )).scalars().all()
    for row in rows:
        row.status = RecipientStatus.SENT
        row.sent_at = row.sent_at or datetime.utcnow()
    # Sessions run with autoflush=False: the roll-up count below must see the
    # status changes just made, so flush them before querying — otherwise the
    # count is computed against the pre-update rows and stays 0.
    await db.flush()
    # Roll up the final count: everyone who is not opted out or failed.
    sent_count = int(await db.scalar(
        select(func.count(CampaignRecipient.id)).where(
            CampaignRecipient.campaign_id == campaign_id,
            CampaignRecipient.status == RecipientStatus.SENT,
        )
    ) or 0)
    campaign.sent_count = sent_count
    await db.flush()
    return campaign, sent_count


async def load_banner(
    db: AsyncSession, tenant_id: uuid.UUID, banner_id: uuid.UUID
) -> BannerAd | None:
    return await db.scalar(
        select(BannerAd).where(
            BannerAd.id == banner_id,
            BannerAd.tenant_id == tenant_id,
        )
    )


async def list_banners(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID | None = None,
    active_only: bool = False,
) -> list[BannerAd]:
    """Banner ads for an outlet. ``active_only`` is the display path: only
    banners that are currently in their window and not off. Outlet filter
    matches either this outlet's banners or tenant-wide ones (outlet_id NULL)
    — a banner with no outlet shows at every outlet of the tenant."""
    stmt = select(BannerAd).where(BannerAd.tenant_id == tenant_id)
    if outlet_id is not None:
        stmt = stmt.where(
            (BannerAd.outlet_id == outlet_id) | (BannerAd.outlet_id.is_(None))
        )
    if active_only:
        now = datetime.utcnow()
        stmt = stmt.where(
            BannerAd.is_active.is_(True),
            (BannerAd.start_at.is_(None)) | (BannerAd.start_at <= now),
            (BannerAd.end_at.is_(None)) | (BannerAd.end_at >= now),
        )
    stmt = stmt.order_by(BannerAd.display_order.asc(), BannerAd.created_at.asc())
    return list((await db.execute(stmt)).scalars().all())


async def create_banner(
    db: AsyncSession, tenant_id: uuid.UUID, fields: dict
) -> BannerAd:
    banner = BannerAd(tenant_id=tenant_id, **fields)
    db.add(banner)
    await db.flush()
    return banner


async def update_banner(
    db: AsyncSession, tenant_id: uuid.UUID, banner_id: uuid.UUID, fields: dict
) -> BannerAd:
    banner = await load_banner(db, tenant_id, banner_id)
    if banner is None:
        raise MarketingError("Banner not found")
    for field_name, value in fields.items():
        setattr(banner, field_name, value)
    await db.flush()
    return banner


# ─── Reviews ─────────────────────────────────────────────────────────────────

async def ingest_reviews(
    db: AsyncSession, tenant_id: uuid.UUID, reviews: list
) -> int:
    """Marketing-side working copies. Duplicate (tenant, customer, rating,
    comment, order_ref) within a reasonable window is not tracked — the
    customers service is the source of truth, this table is for surfacing,
    so re-ingest appends. The caller dedupes by customer_id+order_ref before
    calling if it wants idempotency; this path is the manual endpoint."""
    added = 0
    for item in reviews:
        db.add(CustomerReview(
            tenant_id=tenant_id,
            outlet_id=item.get("outlet_id"),
            customer_id=item["customer_id"],
            order_ref=item.get("order_ref"),
            rating=int(item["rating"]),
            comment=item.get("comment"),
        ))
        added += 1
    await db.flush()
    return added


async def list_reviews(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID | None = None,
    rating: int | None = None,
    unreplied_only: bool = False,
) -> list[CustomerReview]:
    stmt = select(CustomerReview).where(CustomerReview.tenant_id == tenant_id)
    if outlet_id is not None:
        stmt = stmt.where(CustomerReview.outlet_id == outlet_id)
    if rating is not None:
        stmt = stmt.where(CustomerReview.rating == rating)
    if unreplied_only:
        stmt = stmt.where(CustomerReview.is_replied.is_(False))
    stmt = stmt.order_by(CustomerReview.at.desc())
    return list((await db.execute(stmt)).scalars().all())


def _review_where(
    tenant_id: uuid.UUID, outlet_id: uuid.UUID | None, *extra
):
    cond = [CustomerReview.tenant_id == tenant_id]
    if outlet_id is not None:
        cond.append(CustomerReview.outlet_id == outlet_id)
    cond.extend(extra)
    return cond


async def review_summary(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID | None = None
) -> dict:
    """count / average rating / unreplied count."""
    count = int(await db.scalar(
        select(func.count(CustomerReview.id)).where(*_review_where(tenant_id, outlet_id))
    ) or 0)
    avg = await db.scalar(
        select(func.avg(CustomerReview.rating)).where(
            *_review_where(tenant_id, outlet_id)
        )
    )
    unreplied = int(await db.scalar(
        select(func.count(CustomerReview.id)).where(
            *_review_where(tenant_id, outlet_id, CustomerReview.is_replied.is_(False))
        )
    ) or 0)
    return {
        "count": count,
        "average_rating": round(float(avg), 2) if avg is not None else None,
        "unreplied": unreplied,
    }


async def reply_to_review(
    db: AsyncSession, tenant_id: uuid.UUID, review_id: uuid.UUID, reply_text: str
) -> CustomerReview:
    review = await db.scalar(
        select(CustomerReview).where(
            CustomerReview.id == review_id,
            CustomerReview.tenant_id == tenant_id,
        )
    )
    if review is None:
        raise MarketingError("Review not found")
    review.is_replied = True
    review.reply_text = reply_text
    await db.flush()
    return review


# ─── Event-consumer helpers ──────────────────────────────────────────────────

async def active_campaigns_for_audience(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    audience_type: str,
    outlet_id: uuid.UUID | None = None,
) -> list[Campaign]:
    """ACTIVE campaigns whose audience type matches ``audience_type``.

    ``new`` / ``repeat`` / ``all`` audiences all act while ACTIVE — a SENT
    campaign has already gone out; we do not re-add to it after dispatch.
    This is the guard the event consumers query before appending a PENDING
    recipient, so a tenant with no matching active campaign does no work on
    every event.

    When ``outlet_id`` is supplied, campaigns are further filtered to
    tenant-wide ones (``outlet_id IS NULL``) or the ones scoped to that
    outlet — a bill at outlet X should not trigger a campaign that only
    covers outlet Y.
    """
    stmt = select(Campaign).where(
        Campaign.tenant_id == tenant_id,
        Campaign.status == CampaignStatus.ACTIVE,
    )
    if outlet_id is not None:
        stmt = stmt.where(
            (Campaign.outlet_id.is_(None)) | (Campaign.outlet_id == outlet_id)
        )
    campaigns = (await db.execute(stmt)).scalars().all()
    out = []
    for campaign in campaigns:
        aud_type = str((campaign.audience or {}).get("type") or "all")
        if aud_type == audience_type:
            out.append(campaign)
    return out


async def recipient_exists(
    db: AsyncSession, campaign_id: uuid.UUID, customer_id: uuid.UUID
) -> bool:
    """The structural idempotency guard: the unique (campaign_id,
    customer_id) constraint is the source of truth, this query is just the
    cheap pre-check before the insert that would race a redelivery."""
    row = await db.scalar(
        select(CampaignRecipient.id).where(
            CampaignRecipient.campaign_id == campaign_id,
            CampaignRecipient.customer_id == customer_id,
        ).limit(1)
    )
    return row is not None


async def append_recipient(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    campaign: Campaign,
    customer_id: uuid.UUID,
    customer_name: str | None,
    customer_phone: str | None,
    segment: str | None = None,
) -> None:
    """Append a PENDING recipient if not already present (idempotent)."""
    if await recipient_exists(db, campaign.id, customer_id):
        return
    db.add(CampaignRecipient(
        campaign_id=campaign.id,
        tenant_id=tenant_id,
        customer_id=customer_id,
        customer_name=customer_name or "Unknown",
        customer_phone=customer_phone,
        segment=segment,
        status=RecipientStatus.PENDING,
    ))
