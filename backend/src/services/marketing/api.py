"""Marketing service endpoints.

Who may call what:
  * campaign / banner / review reads — ``view:marketing``
  * create / patch / send / ingest — ``manage:marketing``

Events:
  subscribes  customer.created  (welcome-offer: append new-customer recipients)
               bill.paid        (repeat/all campaign trigger evaluation)
  publishes   marketing.campaign.sent

This service can never cross-read the customers DB — recipient lists arrive
via explicit pre-load (fetched from the customers service by the frontend)
or via event payloads.
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status as http_status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.event_bus.bus import Event, bus
from src.services.marketing import service as svc
from src.services.marketing.models import CampaignRecipient, CampaignStatus, status_value
from src.services.marketing.outbox import record_event
from src.services.marketing.schemas import (
    BannerAdCreate,
    BannerAdResponse,
    BannerAdUpdate,
    CampaignCreate,
    CampaignResponse,
    CampaignSendResponse,
    CampaignUpdate,
    CustomerIngestRequest,
    CustomerIngestResponse,
    RecipientResponse,
    RecipientsPreloadRequest,
    RecipientsPreloadResponse,
    ReviewIngestRequest,
    ReviewIngestResponse,
    ReviewReplyRequest,
    ReviewResponse,
    ReviewSummary,
)
from src.services.shared.identity import CurrentIdentity

router = APIRouter()


async def get_db(request: Request) -> AsyncSession:
    """One session per request, committed on success, rolled back on error."""
    session = request.app.state.db.session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


DbDep = Annotated[AsyncSession, Depends(get_db)]


def _ev(topic, tenant_id=None, outlet_id=None, data=None):
    return Event(type=topic, tenant_id=tenant_id, outlet_id=outlet_id,
                 data=data or {}, source_service="marketing")


def _check_outlet(identity, outlet_id: uuid.UUID | None) -> None:
    """Enforce outlet scoping where a route accepts an explicit outlet_id.

    ``None`` means tenant-wide — every identity may set a campaign or
    banner to no specific outlet. A non-None value is checked against the
    caller's outlet allow-list (an empty allow-list means unrestricted —
    see Identity.can_access_outlet).
    """
    if outlet_id is not None and not identity.can_access_outlet(outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")


# ─── Campaigns ───────────────────────────────────────────────────────────────

@router.get("/campaigns", response_model=list[CampaignResponse], tags=["marketing"])
async def list_campaigns(
    identity: CurrentIdentity,
    db: DbDep,
    status_filter: str | None = Query(default=None, alias="status"),
    outlet_id: uuid.UUID | None = None,
):
    identity.require("view:marketing")
    if outlet_id is not None:
        _check_outlet(identity, outlet_id)
    return await svc.list_campaigns(db, identity.tenant_id, status_filter, outlet_id)


@router.post("/campaigns", response_model=CampaignResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["marketing"])
async def create_campaign(payload: CampaignCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:marketing")
    if payload.outlet_id is not None:
        _check_outlet(identity, payload.outlet_id)
    try:
        campaign = await svc.create_campaign(
            db, identity.tenant_id,
            name=payload.name,
            channel=payload.channel,
            audience=payload.audience,
            message=payload.message,
            coupon_ref=payload.coupon_ref,
            schedule_at=payload.schedule_at,
            outlet_id=payload.outlet_id,
            created_by=identity.user_id,
            status=payload.status,
        )
    except svc.MarketingError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return campaign


@router.get("/campaigns/{campaign_id}", response_model=CampaignResponse,
            tags=["marketing"])
async def get_campaign(campaign_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:marketing")
    campaign = await svc.load_campaign(db, identity.tenant_id, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.patch("/campaigns/{campaign_id}", response_model=CampaignResponse,
               tags=["marketing"])
async def update_campaign(
    campaign_id: uuid.UUID, payload: CampaignUpdate,
    identity: CurrentIdentity, db: DbDep,
):
    """Apply a PATCH. Status moves DRAFT -> ACTIVE -> SENT -> ARCHIVED are
    validated against the state machine; content edits are frozen once the
    campaign is SENT. 409 on an illegal move, 404 on a missing campaign."""
    identity.require("manage:marketing")
    fields = payload.model_dump(exclude_unset=True)
    if "outlet_id" in fields and fields["outlet_id"] is not None:
        _check_outlet(identity, fields["outlet_id"])
    try:
        campaign = await svc.update_campaign(db, identity.tenant_id, campaign_id, fields)
    except svc.MarketingError as exc:
        detail = str(exc)
        code = 404 if "not found" in detail else 409
        raise HTTPException(status_code=code, detail=detail)
    return campaign


@router.get("/campaigns/{campaign_id}/recipients",
            response_model=list[RecipientResponse], tags=["marketing"])
async def list_recipients(
    campaign_id: uuid.UUID, identity: CurrentIdentity, db: DbDep,
    limit: int = Query(default=100, le=500),
):
    identity.require("view:marketing")
    campaign = await svc.load_campaign(db, identity.tenant_id, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    rows = (await db.execute(
        select(CampaignRecipient)
        .where(CampaignRecipient.campaign_id == campaign_id,
               CampaignRecipient.tenant_id == identity.tenant_id)
        .order_by(CampaignRecipient.created_at.asc())
        .limit(limit)
    )).scalars().all()
    return list(rows)


@router.post("/campaigns/{campaign_id}/recipients",
             response_model=RecipientsPreloadResponse, tags=["marketing"],
             status_code=http_status.HTTP_201_CREATED)
async def preload_recipients(
    campaign_id: uuid.UUID, payload: RecipientsPreloadRequest,
    identity: CurrentIdentity, db: DbDep,
):
    """Pre-load the recipient list. The frontend fetches these from the
    customers service API and posts them here — marketing never reads the
    customers DB. Duplicates are skipped, so a re-post of the same list is
    a no-op; the response says how many were actually added."""
    identity.require("manage:marketing")
    campaign = await svc.load_campaign(db, identity.tenant_id, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    try:
        added = await svc.add_recipients(
            db, identity.tenant_id, campaign,
            [r.model_dump() for r in payload.recipients],
        )
    except svc.MarketingError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    total = await db.scalar(
        select(func.count()).select_from(CampaignRecipient).where(
            CampaignRecipient.campaign_id == campaign_id
        )
    )
    return RecipientsPreloadResponse(
        campaign_id=campaign.id,
        added=added,
        total=int(total or 0),
    )


@router.post("/campaigns/{campaign_id}/send",
             response_model=CampaignSendResponse, tags=["marketing"])
async def send_campaign(
    campaign_id: uuid.UUID, identity: CurrentIdentity, db: DbDep,
):
    """Finalize and dispatch: mark SENT, stamp PENDING recipients SENT,
    roll up the count, emit the ``marketing.campaign.sent`` outbox event in
    the SAME transaction, then publish to the local bus.

    The outbox row and the domain change commit together — a crash between
    them cannot lose the event. The relay delivers cross-process; the
    local publish drives in-process consumers in this same process.
    """
    identity.require("manage:marketing")
    try:
        campaign, sent_count = await svc.send_campaign(
            db, identity.tenant_id, campaign_id
        )
    except svc.MarketingError as exc:
        detail = str(exc)
        code = 404 if "not found" in detail else 409
        raise HTTPException(status_code=code, detail=detail)

    event = _ev(
        "marketing.campaign.sent",
        identity.tenant_id,
        outlet_id=campaign.outlet_id,
        data={
            "campaign_id": str(campaign.id),
            "channel": campaign.channel,
            "recipients": campaign.sent_count,
            "sent_count": sent_count,
        },
    )
    await record_event(
        db,
        type=event.type,
        data=event.data,
        tenant_id=event.tenant_id,
        outlet_id=event.outlet_id,
        event_id=event.event_id,
    )
    await db.commit()
    await bus.publish(event, local=True)

    return CampaignSendResponse(
        campaign_id=campaign.id,
        status=status_value(campaign.status),
        sent_count=sent_count,
        recipients_finalized=campaign.sent_count,
    )


# ─── Customer ingest ─────────────────────────────────────────────────────────

@router.post("/customers/ingest", response_model=CustomerIngestResponse,
             tags=["marketing"])
async def ingest_customers(
    payload: CustomerIngestRequest, identity: CurrentIdentity, db: DbDep,
):
    """Accept a list of customers the marketing screen wants to target.

    This is the explicit, no-cross-DB path: the frontend (or another service)
    posts ``[{customer_id, name, phone, segment}]``. The customers service
    remains the source of truth; marketing keeps a working copy inside any
    ACTIVE campaign whose audience matches, so targeting does not depend on
    a live cross-service query.

    The list is appended as PENDING recipients on every ACTIVE campaign with
    an ``all`` / ``segment`` audience, keeping the campaign pipeline intact.
    A customer without any matching active campaign is acknowledged but not
    stored — the ingest endpoint exists to feed the campaign pipeline, not
    to build a second customer DB.
    """
    identity.require("manage:marketing")
    if not payload.customers:
        return CustomerIngestResponse(ingested=0)

    # Feed the campaign pipeline: append on matching ACTIVE campaigns.
    campaigns = await svc.list_campaigns(
        db, identity.tenant_id, status_filter=CampaignStatus.ACTIVE.value
    )
    added = 0
    for item in payload.customers:
        cust_id = item.customer_id
        for campaign in campaigns:
            aud_type = str((campaign.audience or {}).get("type") or "all")
            if aud_type in ("all", "segment"):
                try:
                    n = await svc.add_recipients(
                        db, identity.tenant_id, campaign,
                        [{"customer_id": cust_id, "name": item.name,
                        "phone": item.phone, "segment": item.segment}],
                    )
                    added += n
                except svc.MarketingError:
                    # A SENT campaign refuses new recipients — that is fine
                    # during ingest, the campaign simply won't get this
                    # customer. No need to fail the whole batch.
                    continue
    return CustomerIngestResponse(ingested=added)


# ─── Banner ads ──────────────────────────────────────────────────────────────

@router.get("/banners", response_model=list[BannerAdResponse], tags=["marketing"])
async def list_banners(
    identity: CurrentIdentity, db: DbDep,
    outlet_id: uuid.UUID | None = None,
    active: bool = Query(default=False),
):
    """Banner ads. With ``active=true`` this is the display path — only
    banners in their window and not off, ordered for the POS screen."""
    identity.require("view:marketing")
    if outlet_id is not None:
        _check_outlet(identity, outlet_id)
    return await svc.list_banners(db, identity.tenant_id, outlet_id, active_only=active)


@router.post("/banners", response_model=BannerAdResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["marketing"])
async def create_banner(payload: BannerAdCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:marketing")
    if payload.outlet_id is not None:
        _check_outlet(identity, payload.outlet_id)
    banner = await svc.create_banner(db, identity.tenant_id, payload.model_dump())
    return banner


@router.patch("/banners/{banner_id}", response_model=BannerAdResponse,
               tags=["marketing"])
async def update_banner(
    banner_id: uuid.UUID, payload: BannerAdUpdate,
    identity: CurrentIdentity, db: DbDep,
):
    identity.require("manage:marketing")
    fields = payload.model_dump(exclude_unset=True)
    if "outlet_id" in fields and fields["outlet_id"] is not None:
        _check_outlet(identity, fields["outlet_id"])
    try:
        banner = await svc.update_banner(db, identity.tenant_id, banner_id, fields)
    except svc.MarketingError as exc:
        detail = str(exc)
        code = 404 if "not found" in detail else 409
        raise HTTPException(status_code=code, detail=detail)
    return banner


# ─── Reviews / feedback ──────────────────────────────────────────────────────

@router.get("/reviews", response_model=list[ReviewResponse], tags=["marketing"])
async def list_reviews(
    identity: CurrentIdentity, db: DbDep,
    outlet_id: uuid.UUID | None = None,
    rating: int | None = Query(default=None, ge=1, le=5),
    unreplied: bool = Query(default=False),
    limit: int = Query(default=100, le=500),
):
    """Reviews for the feedback surface. ``unreplied=true`` is the "reply
    queue" view; ``rating`` filters by star count."""
    identity.require("view:marketing")
    if outlet_id is not None:
        _check_outlet(identity, outlet_id)
    rows = await svc.list_reviews(
        db, identity.tenant_id, outlet_id, rating, unreplied_only=unreplied,
    )
    return rows[:limit]


@router.get("/reviews/summary", response_model=ReviewSummary, tags=["marketing"])
async def review_summary(
    identity: CurrentIdentity, db: DbDep,
    outlet_id: uuid.UUID | None = None,
):
    """count / average rating / unreplied count for the dashboard tile."""
    identity.require("view:marketing")
    if outlet_id is not None:
        _check_outlet(identity, outlet_id)
    return await svc.review_summary(db, identity.tenant_id, outlet_id)


@router.post("/reviews", response_model=ReviewIngestResponse, tags=["marketing"])
async def ingest_reviews(
    payload: ReviewIngestRequest, identity: CurrentIdentity, db: DbDep,
):
    """Populate the marketing-side working copy from the customers service
    review stream. The source of truth stays with the customers service."""
    identity.require("manage:marketing")
    n = await svc.ingest_reviews(
        db, identity.tenant_id, [r.model_dump() for r in payload.reviews]
    )
    return ReviewIngestResponse(ingested=n)


@router.post("/reviews/{review_id}/reply", response_model=ReviewResponse,
             tags=["marketing"])
async def reply_review(
    review_id: uuid.UUID, payload: ReviewReplyRequest,
    identity: CurrentIdentity, db: DbDep,
):
    identity.require("manage:marketing")
    try:
        review = await svc.reply_to_review(
            db, identity.tenant_id, review_id, payload.reply_text
        )
    except svc.MarketingError as exc:
        detail = str(exc)
        code = 404 if "not found" in detail else 409
        raise HTTPException(status_code=code, detail=detail)
    return review
