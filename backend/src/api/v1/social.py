import uuid
from datetime import datetime, timezone, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy import func, select, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession
from pathlib import Path
import os

from src.api.deps import (
    CurrentUserContext,
    require_permission,
    require_any_permission,
    get_current_user_context,
)
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import SocialAccount, ScheduledSocialPost, User, Tenant
import requests
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/social", tags=["Social Media & Multi-Channel Marketing"])


# ─── Pydantic Schemas ────────────────────────────────────────────────────────

class SocialAccountConnectPayload(BaseModel):
    platform: Literal["facebook", "instagram", "twitter", "google_business", "youtube"]
    account_name: str
    account_id: str
    profile_photo_url: str | None = None
    access_token: str | None = None
    refresh_token: str | None = None
    expires_in_seconds: int | None = None
    scopes: list[str] = Field(default_factory=list)
    settings: dict = Field(default_factory=dict)


class SocialAccountResponse(BaseModel):
    id: str
    platform: str
    account_name: str
    account_id: str
    profile_photo_url: str | None = None
    is_active: bool
    scopes: list[str] = []
    settings: dict = {}
    created_at: str | None = None


class ScheduledSocialPostCreate(BaseModel):
    target_platforms: list[str] = Field(description="Platforms like google_business, youtube, twitter, facebook, instagram")
    title: str | None = Field(default=None, description="Title for YouTube video or Google update")
    content_text: str = Field(description="Caption, tweet text, or video description")
    media_urls: list[str] = Field(default_factory=list, description="Media URLs (images or video)")
    thumbnail_url: str | None = Field(default=None, description="Custom thumbnail URL for YouTube")
    scheduled_for: datetime = Field(description="Target publish timestamp (ISO format)")
    is_recurring: bool = Field(default=False)
    recurrence_cadence: str | None = Field(default=None, description="e.g. daily, weekdays, weekly")
    recurrence_time: str | None = Field(default=None, description="e.g. 10:00")
    category: str = Field(default="general", description="seo_photo, video_drop, tweet_update, general")
    tags: list[str] = Field(default_factory=list)


class BatchDailyScheduleCreate(BaseModel):
    target_platforms: list[str] = Field(default_factory=lambda: ["google_business"], description="Target channels")
    media_urls: list[str] = Field(description="List of media URLs to distribute, e.g. 7 images for next 7 days")
    base_title: str | None = Field(default=None, description="Title for Google update or video")
    caption_template: str = Field(description="Base caption text or template with {day} or {date} placeholders")
    start_date: datetime = Field(description="Start date for Day 1")
    time_of_day: str = Field(default="10:00", description="HH:MM in 24h format")
    category: str = Field(default="seo_photo", description="Post category (e.g. seo_photo)")
    tags: list[str] = Field(default_factory=list)


class ScheduledSocialPostUpdate(BaseModel):
    target_platforms: list[str] | None = None
    title: str | None = None
    content_text: str | None = None
    media_urls: list[str] | None = None
    thumbnail_url: str | None = None
    scheduled_for: datetime | None = None
    is_recurring: bool | None = None
    recurrence_cadence: str | None = None
    recurrence_time: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    status: str | None = None


class ScheduledSocialPostResponse(BaseModel):
    id: str
    target_platforms: list[str]
    title: str | None = None
    content_text: str
    media_urls: list[str] = []
    thumbnail_url: str | None = None
    scheduled_for: str
    is_recurring: bool
    recurrence_cadence: str | None = None
    recurrence_time: str | None = None
    status: str
    published_at: str | None = None
    error_message: str | None = None
    platform_post_ids: dict = {}
    tags: list[str] = []
    category: str
    created_at: str | None = None


# ─── Accounts & Connections Endpoints ────────────────────────────────────────

@router.get("/accounts", response_model=list[SocialAccountResponse])
async def list_social_accounts(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:social_media", "manage:social_media_connections"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """List connected social media channels and accounts."""
    result = await db.execute(
        select(SocialAccount).where(SocialAccount.tenant_id == ctx.tenant_id).order_by(SocialAccount.platform)
    )
    accounts = result.scalars().all()
    return [
        SocialAccountResponse(
            id=str(a.id),
            platform=a.platform,
            account_name=a.account_name,
            account_id=a.account_id,
            profile_photo_url=a.profile_photo_url,
            is_active=a.is_active,
            scopes=a.scopes or [],
            settings=a.settings or {},
            created_at=a.created_at.isoformat() if a.created_at else None,
        )
        for a in accounts
    ]


@router.post("/accounts/connect", response_model=SocialAccountResponse)
async def connect_social_account(
    payload: SocialAccountConnectPayload,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:social_media_connections"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Connect or update OAuth credentials for a social platform channel."""
    # Check if already connected for this tenant & platform & account_id
    existing = await db.scalar(
        select(SocialAccount).where(
            SocialAccount.tenant_id == ctx.tenant_id,
            SocialAccount.platform == payload.platform,
            SocialAccount.account_id == payload.account_id
        )
    )

    expiry = None
    if payload.expires_in_seconds:
        expiry = datetime.now(timezone.utc) + timedelta(seconds=payload.expires_in_seconds)

    if existing:
        existing.account_name = payload.account_name
        existing.profile_photo_url = payload.profile_photo_url
        if payload.access_token:
            existing.access_token = payload.access_token
        if payload.refresh_token:
            existing.refresh_token = payload.refresh_token
        if expiry:
            existing.token_expires_at = expiry
        existing.scopes = payload.scopes
        existing.is_active = True
        existing.settings = payload.settings
        account = existing
    else:
        account = SocialAccount(
            tenant_id=ctx.tenant_id,
            platform=payload.platform,
            account_name=payload.account_name,
            account_id=payload.account_id,
            profile_photo_url=payload.profile_photo_url,
            access_token=payload.access_token,
            refresh_token=payload.refresh_token,
            token_expires_at=expiry,
            scopes=payload.scopes,
            is_active=True,
            settings=payload.settings,
        )
        db.add(account)

    await db.commit()
    await db.refresh(account)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="social_media",
        action=f"social_account_connected_{payload.platform}",
        entity_type="social_account",
        entity_id=account.id,
        new_values={"platform": payload.platform, "account_name": payload.account_name},
        ip_address=request.client.host if request.client else None,
    )

    return SocialAccountResponse(
        id=str(account.id),
        platform=account.platform,
        account_name=account.account_name,
        account_id=account.account_id,
        profile_photo_url=account.profile_photo_url,
        is_active=account.is_active,
        scopes=account.scopes or [],
        settings=account.settings or {},
        created_at=account.created_at.isoformat() if account.created_at else None,
    )


@router.delete("/accounts/{account_id}")
async def disconnect_social_account(
    account_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:social_media_connections"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Disconnect and revoke a social channel."""
    account = await db.scalar(
        select(SocialAccount).where(SocialAccount.id == account_id, SocialAccount.tenant_id == ctx.tenant_id)
    )
    if not account:
        raise HTTPException(status_code=404, detail="Social account not found")

    platform_name = account.platform
    await db.delete(account)
    await db.commit()

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="social_media",
        action=f"social_account_disconnected_{platform_name}",
        entity_type="social_account",
        entity_id=account_id,
        new_values={"platform": platform_name},
        ip_address=request.client.host if request.client else None,
    )

    return {"status": "success", "message": f"Disconnected {platform_name} successfully"}


# ─── Scheduled Posts & Timeline Endpoints ────────────────────────────────────

@router.get("/scheduled-posts", response_model=list[ScheduledSocialPostResponse])
async def list_scheduled_posts(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:social_media", "schedule:social_media_posts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = None,
    platform: str | None = None,
    category: str | None = None,
    limit: int = 100
):
    """Fetch social media posts (scheduled, publishing, published, failed)."""
    q = select(ScheduledSocialPost).where(ScheduledSocialPost.tenant_id == ctx.tenant_id)

    if status:
        q = q.where(ScheduledSocialPost.status == status)
    if category:
        q = q.where(ScheduledSocialPost.category == category)

    q = q.order_by(desc(ScheduledSocialPost.scheduled_for)).limit(limit)
    result = await db.execute(q)
    posts = result.scalars().all()

    if platform:
        # Filter in memory for platform array membership
        posts = [p for p in posts if platform in (p.target_platforms or [])]

    return [
        ScheduledSocialPostResponse(
            id=str(p.id),
            target_platforms=p.target_platforms or [],
            title=p.title,
            content_text=p.content_text,
            media_urls=p.media_urls or [],
            thumbnail_url=p.thumbnail_url,
            scheduled_for=p.scheduled_for.isoformat(),
            is_recurring=p.is_recurring,
            recurrence_cadence=p.recurrence_cadence,
            recurrence_time=p.recurrence_time,
            status=p.status,
            published_at=p.published_at.isoformat() if p.published_at else None,
            error_message=p.error_message,
            platform_post_ids=p.platform_post_ids or {},
            tags=p.tags or [],
            category=p.category or "general",
            created_at=p.created_at.isoformat() if p.created_at else None,
        )
        for p in posts
    ]


@router.post("/scheduled-posts", response_model=ScheduledSocialPostResponse)
async def create_scheduled_post(
    payload: ScheduledSocialPostCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("create:social_media_posts", "schedule:social_media_posts"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Schedule a post across Google Business, YouTube, X/Twitter, or Meta."""
    post = ScheduledSocialPost(
        tenant_id=ctx.tenant_id,
        created_by_user_id=ctx.user.id,
        target_platforms=payload.target_platforms,
        title=payload.title,
        content_text=payload.content_text,
        media_urls=payload.media_urls,
        thumbnail_url=payload.thumbnail_url,
        scheduled_for=payload.scheduled_for,
        is_recurring=payload.is_recurring,
        recurrence_cadence=payload.recurrence_cadence,
        recurrence_time=payload.recurrence_time,
        status="scheduled",
        tags=payload.tags,
        category=payload.category,
        platform_post_ids={},
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="social_media",
        action="social_post_scheduled",
        entity_type="scheduled_post",
        entity_id=post.id,
        new_values={
            "platforms": payload.target_platforms,
            "scheduled_for": payload.scheduled_for.isoformat(),
            "category": payload.category,
        },
        ip_address=request.client.host if request.client else None,
    )

    return ScheduledSocialPostResponse(
        id=str(post.id),
        target_platforms=post.target_platforms or [],
        title=post.title,
        content_text=post.content_text,
        media_urls=post.media_urls or [],
        thumbnail_url=post.thumbnail_url,
        scheduled_for=post.scheduled_for.isoformat(),
        is_recurring=post.is_recurring,
        recurrence_cadence=post.recurrence_cadence,
        recurrence_time=post.recurrence_time,
        status=post.status,
        published_at=None,
        error_message=None,
        platform_post_ids=post.platform_post_ids or {},
        tags=post.tags or [],
        category=post.category,
        created_at=post.created_at.isoformat() if post.created_at else None,
    )


@router.post("/scheduled-posts/batch-daily", response_model=list[ScheduledSocialPostResponse])
async def create_batch_daily_schedule(
    payload: BatchDailyScheduleCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("create:social_media_posts", "schedule:social_media_posts"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Schedule a batch of daily posts (e.g. 7 images scheduled across 7 consecutive days)."""
    if not payload.media_urls:
        raise HTTPException(status_code=400, detail="Please provide at least one media URL for batch scheduling.")

    try:
        parts = payload.time_of_day.split(":")
        target_hour = int(parts[0])
        target_minute = int(parts[1]) if len(parts) > 1 else 0
    except Exception:
        target_hour = 10
        target_minute = 0

    base_dt = payload.start_date.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)
    created_posts = []

    for idx, media_url in enumerate(payload.media_urls):
        post_date = base_dt + timedelta(days=idx)
        day_num = idx + 1
        caption = (
            payload.caption_template
            .replace("{day}", str(day_num))
            .replace("{date}", post_date.strftime("%b %d"))
        )
        post_title = (
            payload.base_title.replace("{day}", str(day_num)).replace("{date}", post_date.strftime("%b %d"))
            if payload.base_title
            else None
        )

        post = ScheduledSocialPost(
            tenant_id=ctx.tenant_id,
            created_by_user_id=ctx.user.id,
            target_platforms=payload.target_platforms,
            title=post_title,
            content_text=caption,
            media_urls=[media_url.strip()],
            thumbnail_url=None,
            scheduled_for=post_date,
            is_recurring=False,
            status="scheduled",
            tags=payload.tags,
            category=payload.category,
            platform_post_ids={},
        )
        db.add(post)
        created_posts.append(post)

    await db.commit()
    for p in created_posts:
        await db.refresh(p)

    if created_posts:
        await write_audit_log(
            db,
            tenant_id=ctx.tenant_id,
            user_id=ctx.user.id,
            module="social_media",
            action="batch_daily_posts_scheduled",
            entity_type="scheduled_post",
            entity_id=created_posts[0].id,
            new_values={"count": len(created_posts), "platforms": payload.target_platforms},
            ip_address=request.client.host if request.client else None,
        )

    return [
        ScheduledSocialPostResponse(
            id=str(p.id),
            target_platforms=p.target_platforms or [],
            title=p.title,
            content_text=p.content_text,
            media_urls=p.media_urls or [],
            thumbnail_url=p.thumbnail_url,
            scheduled_for=p.scheduled_for.isoformat(),
            is_recurring=p.is_recurring,
            recurrence_cadence=p.recurrence_cadence,
            recurrence_time=p.recurrence_time,
            status=p.status,
            published_at=None,
            error_message=None,
            platform_post_ids=p.platform_post_ids or {},
            tags=p.tags or [],
            category=p.category,
            created_at=p.created_at.isoformat() if p.created_at else None,
        )
        for p in created_posts
    ]


@router.post("/media/upload-multiple")
async def upload_multiple_social_images(
    files: list[UploadFile] = File(...),
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("create:social_media_posts", "schedule:social_media_posts"))] = None,
):
    """Upload multiple local media images to serve as scheduled posts."""
    backend_dir = Path(__file__).resolve().parents[3]
    upload_dir = backend_dir / "upload_images"
    upload_dir.mkdir(parents=True, exist_ok=True)

    urls = []
    for file in files:
        ext = os.path.splitext(file.filename or "")[1] or ".jpg"
        filename = f"social_{uuid.uuid4().hex[:12]}{ext}"
        filepath = upload_dir / filename
        content = await file.read()
        with open(filepath, "wb") as buffer:
            buffer.write(content)
        urls.append(f"/upload_images/{filename}")

    return {"urls": urls, "count": len(urls)}


@router.patch("/scheduled-posts/{post_id}", response_model=ScheduledSocialPostResponse)
async def update_scheduled_post(
    post_id: uuid.UUID,
    payload: ScheduledSocialPostUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("schedule:social_media_posts"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Modify a scheduled post before publication."""
    post = await db.scalar(
        select(ScheduledSocialPost).where(
            ScheduledSocialPost.id == post_id,
            ScheduledSocialPost.tenant_id == ctx.tenant_id
        )
    )
    if not post:
        raise HTTPException(status_code=404, detail="Scheduled post not found")

    if payload.target_platforms is not None:
        post.target_platforms = payload.target_platforms
    if payload.title is not None:
        post.title = payload.title
    if payload.content_text is not None:
        post.content_text = payload.content_text
    if payload.media_urls is not None:
        post.media_urls = payload.media_urls
    if payload.thumbnail_url is not None:
        post.thumbnail_url = payload.thumbnail_url
    if payload.scheduled_for is not None:
        post.scheduled_for = payload.scheduled_for
    if payload.is_recurring is not None:
        post.is_recurring = payload.is_recurring
    if payload.recurrence_cadence is not None:
        post.recurrence_cadence = payload.recurrence_cadence
    if payload.recurrence_time is not None:
        post.recurrence_time = payload.recurrence_time
    if payload.category is not None:
        post.category = payload.category
    if payload.tags is not None:
        post.tags = payload.tags
    if payload.status is not None:
        post.status = payload.status

    await db.commit()
    await db.refresh(post)

    return ScheduledSocialPostResponse(
        id=str(post.id),
        target_platforms=post.target_platforms or [],
        title=post.title,
        content_text=post.content_text,
        media_urls=post.media_urls or [],
        thumbnail_url=post.thumbnail_url,
        scheduled_for=post.scheduled_for.isoformat(),
        is_recurring=post.is_recurring,
        recurrence_cadence=post.recurrence_cadence,
        recurrence_time=post.recurrence_time,
        status=post.status,
        published_at=post.published_at.isoformat() if post.published_at else None,
        error_message=post.error_message,
        platform_post_ids=post.platform_post_ids or {},
        tags=post.tags or [],
        category=post.category,
        created_at=post.created_at.isoformat() if post.created_at else None,
    )


@router.delete("/scheduled-posts/{post_id}")
async def delete_scheduled_post(
    post_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("delete:social_media_posts", "schedule:social_media_posts"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Cancel or delete a scheduled post."""
    post = await db.scalar(
        select(ScheduledSocialPost).where(
            ScheduledSocialPost.id == post_id,
            ScheduledSocialPost.tenant_id == ctx.tenant_id
        )
    )
    if not post:
        raise HTTPException(status_code=404, detail="Scheduled post not found")

    await db.delete(post)
    await db.commit()
    return {"status": "success", "message": "Scheduled post cancelled/deleted successfully"}


@router.post("/scheduled-posts/{post_id}/publish-now", response_model=ScheduledSocialPostResponse)
async def publish_post_now(
    post_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("schedule:social_media_posts"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Publish a post immediately to target platforms using real API integrations with no mock fallbacks."""
    post = await db.scalar(
        select(ScheduledSocialPost).where(
            ScheduledSocialPost.id == post_id,
            ScheduledSocialPost.tenant_id == ctx.tenant_id
        )
    )
    if not post:
        raise HTTPException(status_code=404, detail="Scheduled post not found")

    tenant = await db.scalar(select(Tenant).where(Tenant.id == ctx.tenant_id))
    settings_dict = (tenant.settings or {}) if tenant else {}
    fb_page_cfg = settings_dict.get("facebook_page", {})
    fb_legacy_cfg = settings_dict.get("facebook", {})
    fb_token = (
        fb_page_cfg.get("page_access_token")
        or fb_page_cfg.get("user_access_token")
        or fb_legacy_cfg.get("fb_access_token")
        or fb_legacy_cfg.get("access_token")
    )
    fb_page_id = (
        fb_page_cfg.get("page_id")
        or fb_legacy_cfg.get("fb_page_or_form_id")
        or fb_legacy_cfg.get("page_id")
    )

    accounts_res = await db.execute(
        select(SocialAccount).where(SocialAccount.tenant_id == ctx.tenant_id, SocialAccount.is_active == True)
    )
    connected_accounts = {a.platform: a for a in accounts_res.scalars().all()}

    generated_ids = {}
    errors = []

    target_platforms = post.target_platforms or []
    if not target_platforms:
        raise HTTPException(status_code=400, detail="No target platforms specified for this post.")

    for platform in target_platforms:
        if platform in ("facebook", "instagram"):
            token = fb_token or (connected_accounts.get("facebook").access_token if "facebook" in connected_accounts else None)
            page_id = fb_page_id or (connected_accounts.get("facebook").account_id if "facebook" in connected_accounts else None)
            if not token or not page_id:
                errors.append("Facebook/Instagram is not connected. Connect your Facebook Page in Settings > Integrations.")
                continue

            try:
                if post.media_urls and len(post.media_urls) > 0:
                    fb_resp = requests.post(
                        f"https://graph.facebook.com/v25.0/{page_id}/photos",
                        data={"url": post.media_urls[0], "caption": post.content_text, "access_token": token},
                        timeout=30
                    )
                else:
                    fb_resp = requests.post(
                        f"https://graph.facebook.com/v25.0/{page_id}/feed",
                        data={"message": post.content_text, "access_token": token},
                        timeout=30
                    )
                fb_data = fb_resp.json()
                if "id" in fb_data:
                    generated_ids[platform] = f"https://www.facebook.com/{fb_data['id']}"
                elif "error" in fb_data:
                    errors.append(f"Meta Graph API error: {fb_data['error'].get('message', 'Post rejected')}")
                else:
                    errors.append(f"Meta Graph API unexpected response: {fb_data}")
            except Exception as e:
                errors.append(f"Meta network error: {str(e)}")

        elif platform == "google_business":
            gb_acc = connected_accounts.get("google_business")
            if not gb_acc or not gb_acc.access_token:
                errors.append("Google Business Profile is not connected. Connect account with 'business.manage' OAuth scope.")
                continue
            try:
                location_id = gb_acc.account_id
                post_payload = {
                    "languageCode": "en-US",
                    "summary": post.content_text,
                    "callToAction": {"actionType": "LEARN_MORE"},
                }
                if post.media_urls and len(post.media_urls) > 0:
                    post_payload["media"] = [{"mediaFormat": "PHOTO", "sourceUrl": post.media_urls[0]}]

                gb_resp = requests.post(
                    f"https://mybusiness.googleapis.com/v4/{location_id}/localPosts",
                    headers={"Authorization": f"Bearer {gb_acc.access_token}", "Content-Type": "application/json"},
                    json=post_payload,
                    timeout=30
                )
                gb_data = gb_resp.json()
                if "name" in gb_data or "searchUrl" in gb_data:
                    generated_ids["google_business"] = gb_data.get("searchUrl") or f"https://business.google.com/posts/{gb_data.get('name')}"
                elif "error" in gb_data:
                    errors.append(f"Google Business error: {gb_data['error'].get('message', 'Failed to publish')}")
                else:
                    errors.append(f"Google Business response: {gb_data}")
            except Exception as e:
                errors.append(f"Google Business network error: {str(e)}")

        elif platform == "youtube":
            yt_acc = connected_accounts.get("youtube")
            if not yt_acc or not yt_acc.access_token:
                errors.append("YouTube channel is not connected. Connect account with 'youtube.upload' OAuth scope.")
                continue
            if not post.media_urls or len(post.media_urls) == 0:
                errors.append("YouTube requires a valid media video URL.")
                continue
            # When media URL is present and token is valid
            try:
                yt_metadata = {
                    "snippet": {
                        "title": post.title or "Scheduled Video",
                        "description": post.content_text,
                        "tags": post.tags or [],
                        "categoryId": "22",
                    },
                    "status": {"privacyStatus": "public"},
                }
                yt_resp = requests.post(
                    "https://www.googleapis.com/youtube/v3/videos?part=snippet,status",
                    headers={"Authorization": f"Bearer {yt_acc.access_token}", "Content-Type": "application/json"},
                    json=yt_metadata,
                    timeout=30
                )
                yt_data = yt_resp.json()
                if "id" in yt_data:
                    generated_ids["youtube"] = f"https://youtu.be/{yt_data['id']}"
                elif "error" in yt_data:
                    errors.append(f"YouTube API error: {yt_data['error'].get('message', 'Failed to publish video')}")
            except Exception as e:
                errors.append(f"YouTube network error: {str(e)}")

        elif platform == "twitter":
            tw_acc = connected_accounts.get("twitter")
            if not tw_acc or not tw_acc.access_token:
                errors.append("X (Twitter) is not connected. Configure X API v2 Bearer/OAuth token with 'tweet.write' scope.")
                continue
            try:
                tw_resp = requests.post(
                    "https://api.twitter.com/2/tweets",
                    headers={"Authorization": f"Bearer {tw_acc.access_token}", "Content-Type": "application/json"},
                    json={"text": post.content_text[:280]},
                    timeout=30
                )
                tw_data = tw_resp.json()
                if "data" in tw_data and "id" in tw_data["data"]:
                    generated_ids["twitter"] = f"https://x.com/i/web/status/{tw_data['data']['id']}"
                elif "errors" in tw_data:
                    errors.append(f"Twitter error: {tw_data['errors'][0].get('detail', 'Failed to post tweet')}")
                else:
                    errors.append(f"Twitter response: {tw_data}")
            except Exception as e:
                errors.append(f"Twitter network error: {str(e)}")

    if errors and not generated_ids:
        post.status = "failed"
        post.error_message = "; ".join(errors)
        await db.commit()
        await db.refresh(post)
        raise HTTPException(status_code=400, detail=post.error_message)

    post.status = "published"
    post.published_at = datetime.now(timezone.utc)
    post.platform_post_ids = generated_ids
    post.error_message = "; ".join(errors) if errors else None

    await db.commit()
    await db.refresh(post)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="social_media",
        action="social_post_published_manually",
        entity_type="scheduled_post",
        entity_id=post.id,
        new_values={"platforms": post.target_platforms, "platform_post_ids": generated_ids},
        ip_address=request.client.host if request.client else None,
    )

    return ScheduledSocialPostResponse(
        id=str(post.id),
        target_platforms=post.target_platforms or [],
        title=post.title,
        content_text=post.content_text,
        media_urls=post.media_urls or [],
        thumbnail_url=post.thumbnail_url,
        scheduled_for=post.scheduled_for.isoformat(),
        is_recurring=post.is_recurring,
        recurrence_cadence=post.recurrence_cadence,
        recurrence_time=post.recurrence_time,
        status=post.status,
        published_at=post.published_at.isoformat() if post.published_at else None,
        error_message=post.error_message,
        platform_post_ids=post.platform_post_ids or {},
        tags=post.tags or [],
        category=post.category,
        created_at=post.created_at.isoformat() if post.created_at else None,
    )


# ─── Multi-Channel Analytics Summary ─────────────────────────────────────────

@router.get("/analytics/summary")
async def get_social_analytics_summary(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:social_media"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Aggregate multi-channel metrics across Meta, X, Google Business, and YouTube."""
    total_posts = await db.scalar(
        select(func.count(ScheduledSocialPost.id)).where(ScheduledSocialPost.tenant_id == ctx.tenant_id)
    ) or 0

    published_posts = await db.scalar(
        select(func.count(ScheduledSocialPost.id)).where(
            ScheduledSocialPost.tenant_id == ctx.tenant_id,
            ScheduledSocialPost.status == "published"
        )
    ) or 0

    scheduled_queued = await db.scalar(
        select(func.count(ScheduledSocialPost.id)).where(
            ScheduledSocialPost.tenant_id == ctx.tenant_id,
            ScheduledSocialPost.status == "scheduled"
        )
    ) or 0

    google_seo_photos = await db.scalar(
        select(func.count(ScheduledSocialPost.id)).where(
            ScheduledSocialPost.tenant_id == ctx.tenant_id,
            ScheduledSocialPost.category == "seo_photo",
            ScheduledSocialPost.status == "published"
        )
    ) or 0

    youtube_video_drops = await db.scalar(
        select(func.count(ScheduledSocialPost.id)).where(
            ScheduledSocialPost.tenant_id == ctx.tenant_id,
            ScheduledSocialPost.category == "video_drop",
            ScheduledSocialPost.status == "published"
        )
    ) or 0

    tenant = await db.scalar(select(Tenant).where(Tenant.id == ctx.tenant_id))
    settings_dict = (tenant.settings or {}) if tenant else {}
    fb_page_cfg = settings_dict.get("facebook_page", {})
    fb_legacy_cfg = settings_dict.get("facebook", {})
    fb_token = (
        fb_page_cfg.get("page_access_token")
        or fb_page_cfg.get("user_access_token")
        or fb_legacy_cfg.get("fb_access_token")
        or fb_legacy_cfg.get("access_token")
    )
    fb_page_id = (
        fb_page_cfg.get("page_id")
        or fb_legacy_cfg.get("fb_page_or_form_id")
        or fb_legacy_cfg.get("page_id")
    )

    accounts_res = await db.execute(
        select(SocialAccount).where(SocialAccount.tenant_id == ctx.tenant_id, SocialAccount.is_active == True)
    )
    connected_accounts = {a.platform: a for a in accounts_res.scalars().all()}

    meta_connected = bool(fb_token and fb_page_id) or ("facebook" in connected_accounts)
    fb_page_name = fb_page_cfg.get("page_name") or (connected_accounts["facebook"].account_name if "facebook" in connected_accounts else None)

    return {
        "total_posts": total_posts,
        "published_posts": published_posts,
        "scheduled_queued": scheduled_queued,
        "google_seo_photos_published": google_seo_photos,
        "youtube_videos_published": youtube_video_drops,
        "channels_health": {
            "meta": {
                "status": "connected" if meta_connected else "ready_to_connect",
                "page": fb_page_name if meta_connected else None,
                "page_id": fb_page_id,
            },
            "twitter": {
                "status": "connected" if "twitter" in connected_accounts else "ready_to_connect",
                "handle": connected_accounts["twitter"].account_name if "twitter" in connected_accounts else None,
            },
            "google_business": {
                "status": "connected" if "google_business" in connected_accounts else "ready_to_connect",
                "location": connected_accounts["google_business"].account_name if "google_business" in connected_accounts else None,
            },
            "youtube": {
                "status": "connected" if "youtube" in connected_accounts else "ready_to_connect",
                "channel": connected_accounts["youtube"].account_name if "youtube" in connected_accounts else None,
            },
        }
    }
