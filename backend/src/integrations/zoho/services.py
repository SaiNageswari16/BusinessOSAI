from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid
import requests
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.models import JobOpening, Applicant, OrganizationIntegration
from src.integrations.recruitment_provider import RecruitmentProvider
from src.integrations.zoho.client import ZohoClient
from src.integrations.zoho.mapper import ZohoMapper
from src.integrations.zoho.token_manager import ZohoTokenManager
from src.integrations.zoho.exceptions import ZohoOAuthException, ZohoAPIException

settings = get_settings()

class ZohoRecruitmentService(RecruitmentProvider):
    """
    Service layer implementing the unified RecruitmentProvider interface for Zoho Recruit.
    Handles OAuth code exchanges, publishing, and candidate syncs.
    """

    async def connect(self, db: AsyncSession, organization_id: uuid.UUID, **kwargs) -> Any:
        """
        Exchanges the authorization code for access and refresh tokens,
        retrieves organization details, and saves integration status.
        """
        code = kwargs.get("code")
        if not code:
            raise ZohoOAuthException("Authorization code is required for connection.")

        region = settings.zoho_region.upper()
        zoho_region_domains = {
            "US": "accounts.zoho.com",
            "EU": "accounts.zoho.eu",
            "IN": "accounts.zoho.in",
            "AU": "accounts.zoho.com.au",
            "CN": "accounts.zoho.com.cn",
            "JP": "accounts.zoho.jp",
        }
        domain = zoho_region_domains.get(region, "accounts.zoho.com")

        # 1. Exchange Code
        url = f"https://{domain}/oauth/v2/token"
        payload = {
            "code": code,
            "client_id": settings.zoho_client_id,
            "client_secret": settings.zoho_client_secret,
            "redirect_uri": settings.zoho_redirect_uri,
            "grant_type": "authorization_code",
        }

        try:
            res = requests.post(url, data=payload, timeout=15)
            if res.status_code != 200:
                raise ZohoOAuthException(f"Failed token exchange: status {res.status_code}")
            
            data = res.json()
            if "error" in data:
                raise ZohoOAuthException(f"Zoho authorization error: {data.get('error')}")

            access_token = data["access_token"]
            refresh_token = data["refresh_token"]
            expires_in = data.get("expires_in", 3600)
            api_domain = data.get("api_domain", "https://recruit.zoho.com")

            # 2. Store tokens temporarily so ZohoClient works
            await ZohoTokenManager.store_tokens(
                db=db,
                organization_id=organization_id,
                access_token=access_token,
                refresh_token=refresh_token,
                expires_in=expires_in,
                api_domain=api_domain
            )

            # 3. Retrieve Org Name using Zoho Recruit Org API
            org_name = "Zoho Recruit Portal"
            try:
                client = ZohoClient(db, organization_id)
                # Fetch org metadata
                org_info = await client._request("GET", "org")
                if org_info and "org" in org_info:
                    org_data = org_info["org"]
                    if isinstance(org_data, list) and len(org_data) > 0:
                        org_name = org_data[0].get("company_name") or org_name
                    elif isinstance(org_data, dict):
                        org_name = org_data.get("company_name") or org_name
            except Exception:
                # Silently ignore org detail failures; connection shouldn't break
                pass

            # Update org name
            integration = await ZohoTokenManager.get_integration(db, organization_id)
            if integration:
                integration.organization_name = org_name
                await db.commit()

            return integration

        except Exception as e:
            if not isinstance(e, ZohoOAuthException):
                raise ZohoOAuthException(f"OAuth connection failed: {e}")
            raise

    async def disconnect(self, db: AsyncSession, organization_id: uuid.UUID) -> None:
        """Removes the stored integration tokens and marks it as disconnected."""
        integration = await ZohoTokenManager.get_integration(db, organization_id)
        if integration:
            integration.connected = False
            integration.access_token = None
            integration.refresh_token = None
            integration.token_expiry = None
            await db.commit()

    async def publish_job(self, db: AsyncSession, organization_id: uuid.UUID, job: JobOpening) -> Dict[str, Any]:
        """Maps and publishes a JobOpening to Zoho Recruit."""
        client = ZohoClient(db, organization_id)
        payload = ZohoMapper.map_job_to_zoho(job)
        
        # 1. Fetch Clients dynamically to bind to the Job Opening (mandatory lookup check)
        try:
            clients_res = await client._request("GET", "Clients")
            if clients_res and "data" in clients_res and clients_res["data"]:
                first_client = clients_res["data"][0]
                client_id = first_client.get("id")
                if client_id:
                    payload["Client_Name"] = {"id": client_id}
        except Exception as ce:
            print(f"[Zoho Publish] Optional Client_Name lookup extraction bypassed: {ce}")

        # 2. Add Target_Date (30 days from now) to satisfy mandatory date settings
        from datetime import timedelta
        target_dt = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")
        payload["Target_Date"] = target_dt

        # Publish
        res = await client.create_job(payload)
        
        # Update local database fields
        job.provider = "zoho"
        job.provider_job_id = res.get("id") or res.get("details", {}).get("id")
        
        # Verify we actually got a provider ID to avoid downstream Pydantic crashes
        if not job.provider_job_id:
            raise ZohoAPIException(f"Zoho API returned success but no record ID was found in the response details. Response: {res}")
            
        job.sync_status = "synced"
        job.last_synced = datetime.now(timezone.utc)
        await db.commit()

        return {
            "job_id": str(job.id),
            "provider_job_id": job.provider_job_id,
            "sync_status": job.sync_status,
            "last_synced": job.last_synced
        }

    async def update_job(self, db: AsyncSession, organization_id: uuid.UUID, job: JobOpening) -> Dict[str, Any]:
        """Updates a published JobOpening details on Zoho Recruit."""
        if not job.provider_job_id or job.provider != "zoho":
            raise ZohoAPIException("This job opening is not currently published on Zoho Recruit.")

        client = ZohoClient(db, organization_id)
        payload = ZohoMapper.map_job_to_zoho(job)
        
        res = await client.update_job(job.provider_job_id, payload)
        
        job.sync_status = "synced"
        job.last_synced = datetime.now(timezone.utc)
        await db.commit()

        return {
            "job_id": str(job.id),
            "provider_job_id": job.provider_job_id,
            "sync_status": job.sync_status,
            "last_synced": job.last_synced
        }

    async def delete_job(self, db: AsyncSession, organization_id: uuid.UUID, job: JobOpening) -> None:
        """Removes a published job opening from Zoho Recruit and resets local metadata."""
        if job.provider_job_id and job.provider == "zoho":
            client = ZohoClient(db, organization_id)
            try:
                await client.delete_job(job.provider_job_id)
            except Exception:
                # If deleted on provider already, ignore error
                pass
        
        job.provider = None
        job.provider_job_id = None
        job.sync_status = None
        job.last_synced = None
        await db.commit()

    async def sync_jobs(self, db: AsyncSession, organization_id: uuid.UUID) -> List[Dict[str, Any]]:
        """Placeholder for sync jobs - can be extended to sync back-updates."""
        return []

    async def sync_candidates(self, db: AsyncSession, organization_id: uuid.UUID) -> List[Dict[str, Any]]:
        """
        Pulls Candidates from Zoho Recruit, matches them to our local JobOpenings via their assigned Job ID,
        and saves new candidates/applicants to the database.
        """
        client = ZohoClient(db, organization_id)
        zoho_candidates = await client.list_candidates()
        
        synced_results = []
        for cand in zoho_candidates:
            # Map candidate details
            cand_dict = ZohoMapper.map_zoho_to_applicant_dict(cand)
            cand_id = cand.get("id")
            
            # Zoho associated job relationship details
            # e.g., associated jobs in Zoho are listed inside cand.get("Associated_Job_Openings") or job_id list
            # Fallback: check if we can locate a matching Job ID
            # For this simple sync, we can link them to the first open job or match by job title if present
            job_obj = cand.get("Job_Opening")
            target_job_id = None
            
            # Find matching local job opening
            if job_obj and isinstance(job_obj, dict):
                zoho_job_id = job_obj.get("id")
                # Look up local job with this provider_job_id
                from sqlalchemy import select
                stmt = select(JobOpening).where(
                    JobOpening.provider == "zoho",
                    JobOpening.provider_job_id == zoho_job_id,
                    JobOpening.tenant_id == organization_id
                )
                res = await db.execute(stmt)
                local_job = res.scalar_one_or_none()
                if local_job:
                    target_job_id = local_job.id
            
            if not target_job_id:
                # Fallback: link to the most recently created job for the tenant
                from sqlalchemy import select
                stmt = select(JobOpening).where(JobOpening.tenant_id == organization_id).order_by(JobOpening.created_at.desc()).limit(1)
                res = await db.execute(stmt)
                local_job = res.scalar_one_or_none()
                if local_job:
                    target_job_id = local_job.id

            if not target_job_id:
                # No jobs exist to link applicant to
                continue

            # Check if applicant is already synced
            from sqlalchemy import select
            stmt = select(Applicant).where(
                Applicant.provider_candidate_id == cand_id,
                Applicant.tenant_id == organization_id
            )
            res = await db.execute(stmt)
            existing_applicant = res.scalar_one_or_none()

            if not existing_applicant:
                # Create local applicant
                new_applicant = Applicant(
                    tenant_id=organization_id,
                    name=cand_dict["name"],
                    email=cand_dict["email"],
                    job_id=target_job_id,
                    job_title=local_job.title,
                    experience=cand_dict["experience"],
                    stage=cand_dict["stage"],
                    source=cand_dict["source"],
                    provider_candidate_id=cand_id,
                    sync_status="synced"
                )
                db.add(new_applicant)
                synced_results.append({"name": cand_dict["name"], "status": "created"})
            else:
                # Update status
                existing_applicant.stage = cand_dict["stage"]
                synced_results.append({"name": cand_dict["name"], "status": "updated"})

        # Update last sync timestamp on integration
        integration = await ZohoTokenManager.get_integration(db, organization_id)
        if integration:
            integration.last_sync = datetime.now(timezone.utc)
            
        await db.commit()
        return synced_results
