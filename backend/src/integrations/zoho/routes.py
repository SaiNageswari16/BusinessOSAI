from typing import Any, Dict
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, get_current_user_context
from src.database.session import get_db
from src.config import get_settings
from src.models import JobOpening, OrganizationIntegration
from src.integrations.zoho.auth import generate_state, verify_state
from src.integrations.zoho.services import ZohoRecruitmentService
from src.integrations.zoho.client import ZohoClient
from src.integrations.zoho.token_manager import ZohoTokenManager
from src.integrations.zoho.schemas import (
    ZohoStatusResponse,
    PublishJobRequest,
    PublishJobResponse,
    TestConnectionResponse
)
from src.integrations.zoho.exceptions import ZohoAPIException, ZohoOAuthException

router = APIRouter(prefix="/integrations/zoho", tags=["Integrations - Zoho Recruit"])
settings = get_settings()

@router.get("/connect")
async def connect_zoho(
    current_user: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Generates a signed state containing the organization_id (tenant_id)
    and redirects the user to the Zoho OAuth URL.
    """
    client_id = settings.zoho_client_id
    redirect_uri = settings.zoho_redirect_uri
    region = settings.zoho_region.upper()

    if not client_id or not redirect_uri:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Zoho client credentials are not configured on the server."
        )

    # Resolve authorization base url based on region
    zoho_region_domains = {
        "US": "accounts.zoho.com",
        "EU": "accounts.zoho.eu",
        "IN": "accounts.zoho.in",
        "AU": "accounts.zoho.com.au",
        "CN": "accounts.zoho.com.cn",
        "JP": "accounts.zoho.jp",
    }
    domain = zoho_region_domains.get(region, "accounts.zoho.com")

    # Generate signed state parameter containing organization_id
    state_token = generate_state(current_user.tenant_id)

    # Scopes matching prompt: ZohoRecruit.modules.ALL, ZohoRecruit.settings.ALL, ZohoRecruit.org.ALL
    scopes = "ZohoRecruit.modules.ALL,ZohoRecruit.settings.ALL,ZohoRecruit.org.ALL"
    auth_url = (
        f"https://{domain}/oauth/v2/auth?"
        f"scope={scopes}&"
        f"client_id={client_id}&"
        f"response_type=code&"
        f"access_type=offline&"
        f"redirect_uri={redirect_uri}&"
        f"state={state_token}&"
        f"prompt=consent"
    )

    return {"url": auth_url}


@router.get("/callback")
async def zoho_callback(
    code: str = Query(..., description="Authorization code returned by Zoho"),
    state: str = Query(..., description="Signed state token containing organization_id"),
    db: AsyncSession = Depends(get_db)
):
    """
    Handles the redirect from Zoho OAuth server.
    Validates state token, exchanges code for access/refresh tokens, and updates connection.
    """
    try:
        # 1. Verify signed state to protect against CSRF and fetch organization_id
        org_id = verify_state(state)
        
        # 2. Exchange authorization code for tokens
        service = ZohoRecruitmentService()
        await service.connect(db=db, organization_id=org_id, code=code)

        # 3. Redirect back to frontend settings page with success flag
        # Frontend settings page for recruitment integrations
        return RedirectResponse(
            url="http://localhost:8080/settings?tab=recruitment_integrations&zoho_status=success"
        )
    except ZohoOAuthException as e:
        # Redirect back to settings page with error flag
        return RedirectResponse(
            url=f"http://localhost:8080/settings?tab=recruitment_integrations&zoho_status=error&message={str(e)}"
        )


@router.get("/status", response_model=ZohoStatusResponse)
async def get_zoho_status(
    current_user: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Returns the current connection status of Zoho Recruit for the active organization."""
    integration = await ZohoTokenManager.get_integration(db, current_user.tenant_id)
    if not integration:
        return ZohoStatusResponse(connected=False)
    
    return ZohoStatusResponse(
        connected=integration.connected,
        organization_name=integration.organization_name,
        connected_at=integration.connected_at,
        last_sync=integration.last_sync
    )


@router.post("/jobs/publish", response_model=PublishJobResponse)
async def publish_job(
    payload: PublishJobRequest,
    current_user: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Publishes a local JobOpening to Zoho Recruit."""
    # Find job opening
    try:
        job_uuid = uuid.UUID(payload.job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job_id format.")

    job_stmt = select(JobOpening).where(
        JobOpening.id == job_uuid,
        JobOpening.tenant_id == current_user.tenant_id
    )
    job_res = await db.execute(job_stmt)
    job = job_res.scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="Job opening not found.")

    service = ZohoRecruitmentService()
    try:
        result = await service.publish_job(db, current_user.tenant_id, job)
        return PublishJobResponse(
            job_id=result["job_id"],
            provider_job_id=result["provider_job_id"],
            sync_status=result["sync_status"],
            last_synced=result["last_synced"]
        )
    except (ZohoOAuthException, ZohoAPIException) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/test", response_model=TestConnectionResponse)
async def test_connection(
    current_user: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Tests the connection to Zoho Recruit by refreshing tokens and listing job openings."""
    try:
        await ZohoTokenManager.get_access_token(db, current_user.tenant_id)
        client = ZohoClient(db, current_user.tenant_id)
        jobs = await client.list_jobs(limit=1)
        return TestConnectionResponse(
            success=True,
            message=f"Connection successfully verified. Zoho Recruit API is reachable ({len(jobs)} job openings returned)."
        )
    except Exception as e:
        return TestConnectionResponse(
            success=False,
            message=f"Connection test failed: {str(e)}"
        )


@router.delete("/disconnect")
async def disconnect_zoho(
    current_user: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Disconnects Zoho Recruit and deletes authorization credentials."""
    service = ZohoRecruitmentService()
    await service.disconnect(db, current_user.tenant_id)
    return {"message": "Zoho Recruit disconnected successfully."}


@router.post("/sync-from-zoho")
async def sync_jobs_from_zoho(
    current_user: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Pulls all active Job Openings from Zoho Recruit and upserts them into the
    local platform so existing Zoho JDs become visible in the HRMS dashboard.
    Returns a summary of created / updated / skipped jobs.
    """
    from sqlalchemy import select
    from src.integrations.zoho.mapper import ZohoMapper
    import uuid as _uuid
    from datetime import datetime, timezone

    try:
        client = ZohoClient(db, current_user.tenant_id)
        zoho_jobs = await client.list_jobs(limit=200)

        created = 0
        updated = 0

        for zj in zoho_jobs:
            provider_job_id = str(zj.get("id") or zj.get("ID") or "")
            if not provider_job_id:
                continue

            mapped = ZohoMapper.map_zoho_to_job_dict(zj)

            # Check if we already have this Zoho job locally
            existing_stmt = select(JobOpening).where(
                JobOpening.tenant_id == current_user.tenant_id,
                JobOpening.provider_job_id == provider_job_id,
                JobOpening.provider == "zoho"
            )
            result = await db.execute(existing_stmt)
            existing_job = result.scalars().first()

            if existing_job:
                # Update fields from Zoho
                existing_job.title = mapped["title"]
                existing_job.department = mapped["department"]
                existing_job.location = mapped["location"]
                existing_job.description = mapped["description"] or existing_job.description
                existing_job.openings = mapped["openings"]
                existing_job.experience = mapped["experience"]
                existing_job.type = mapped["type"]
                existing_job.status = mapped["status"]
                existing_job.last_synced = datetime.now(timezone.utc)
                updated += 1
            else:
                # Create new local job record from Zoho data
                new_job = JobOpening(
                    id=_uuid.uuid4(),
                    tenant_id=current_user.tenant_id,
                    title=mapped["title"],
                    department=mapped["department"],
                    location=mapped["location"],
                    description=mapped["description"] or f"Imported from Zoho Recruit (Job ID: {provider_job_id})",
                    openings=mapped["openings"],
                    experience=mapped["experience"],
                    type=mapped["type"],
                    status=mapped["status"],
                    criteria=mapped.get("criteria", ""),
                    portals=["Zoho Careers"],
                    threshold_score=70,
                    provider="zoho",
                    provider_job_id=provider_job_id,
                    sync_status="synced",
                    last_synced=datetime.now(timezone.utc)
                )
                db.add(new_job)
                created += 1

        await db.commit()
        return {
            "success": True,
            "message": f"Zoho sync complete: {created} imported, {updated} updated.",
            "created": created,
            "updated": updated,
            "total_from_zoho": len(zoho_jobs)
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Zoho sync failed: {str(e)}")

