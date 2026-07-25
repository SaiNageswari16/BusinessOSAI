from typing import Any, Dict, List, Optional
import uuid
import requests
from sqlalchemy.ext.asyncio import AsyncSession
from src.integrations.zoho.token_manager import ZohoTokenManager
from src.integrations.zoho.exceptions import ZohoAPIException, ZohoOAuthException


class ZohoClient:
    """
    Reusable Zoho Recruit API Client.
    Automatically retrieves valid, decrypted access tokens from ZohoTokenManager.
    """
    def __init__(self, db: AsyncSession, organization_id: uuid.UUID):
        self.db = db
        self.organization_id = organization_id
        self._api_domain: Optional[str] = None

    async def _get_base_url(self) -> str:
        """Resolves the correct regional API domain (e.g. https://recruit.zoho.com/recruit/v2)."""
        if self._api_domain:
            return self._api_domain

        integration = await ZohoTokenManager.get_integration(self.db, self.organization_id)
        if not integration:
            raise ZohoOAuthException("Zoho Recruit is not connected for this organization.")

        # Strip trailing slash if present
        domain = (integration.api_domain or "https://recruit.zoho.com").rstrip("/")
        
        # Correct the domain to use recruit.zoho.* instead of www.zohoapis.*
        if "zohoapis.in" in domain or "zoho.in" in domain:
            domain = "https://recruit.zoho.in"
        elif "zohoapis.eu" in domain or "zoho.eu" in domain:
            domain = "https://recruit.zoho.eu"
        elif "zohoapis.com.au" in domain or "zoho.com.au" in domain:
            domain = "https://recruit.zoho.com.au"
        elif "zohoapis.com.cn" in domain or "zoho.com.cn" in domain:
            domain = "https://recruit.zoho.com.cn"
        elif "zohoapis.jp" in domain or "zoho.jp" in domain:
            domain = "https://recruit.zoho.jp"
        elif "zohoapis.com" in domain or "zoho.com" in domain:
            domain = "https://recruit.zoho.com"
            
        # Build V2 base path
        self._api_domain = f"{domain}/recruit/v2"
        return self._api_domain

    async def _get_headers(self) -> Dict[str, str]:
        token = await ZohoTokenManager.get_access_token(self.db, self.organization_id)
        return {
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json"
        }

    async def _request(self, method: str, path: str, **kwargs) -> Any:
        base_url = await self._get_base_url()
        url = f"{base_url}/{path.lstrip('/')}"
        headers = await self._get_headers()
        
        # Merge headers
        if "headers" in kwargs:
            kwargs["headers"].update(headers)
        else:
            kwargs["headers"] = headers

        try:
            res = requests.request(method, url, timeout=30, **kwargs)
            if res.status_code in (200, 201, 202):
                return res.json()
            elif res.status_code == 204:
                return None
            else:
                raise ZohoAPIException(
                    f"Zoho API returned status code {res.status_code}: {res.text}",
                    status_code=res.status_code,
                    response_body=res.text
                )
        except requests.RequestException as e:
            raise ZohoAPIException(f"Zoho HTTP request failed: {e}")

    # ── Job Openings ──────────────────────────────────────────────────────────

    async def create_job(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Creates a Job Opening in Zoho Recruit."""
        # Zoho expects data inside a "data" list field
        payload = {"data": [data]}
        res = await self._request("POST", "JobOpenings", json=payload)
        if not res or not res.get("data"):
            raise ZohoAPIException("Failed to create job: Zoho returned empty data.")
        return res["data"][0]

    async def update_job(self, provider_job_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Updates an existing Job Opening in Zoho Recruit."""
        payload = {"data": [{"id": provider_job_id, **data}]}
        res = await self._request("PUT", f"JobOpenings", json=payload)
        if not res or not res.get("data"):
            raise ZohoAPIException(f"Failed to update job {provider_job_id}: Zoho returned empty response.")
        return res["data"][0]

    async def delete_job(self, provider_job_id: str) -> None:
        """Deletes a Job Opening in Zoho Recruit."""
        await self._request("DELETE", f"JobOpenings/{provider_job_id}")

    async def get_job(self, provider_job_id: str) -> Dict[str, Any]:
        """Fetches a single Job Opening details."""
        res = await self._request("GET", f"JobOpenings/{provider_job_id}")
        if not res or not res.get("data"):
            raise ZohoAPIException(f"Job Opening {provider_job_id} not found.")
        return res["data"][0]

    async def list_jobs(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Lists Job Openings."""
        res = await self._request("GET", f"JobOpenings?per_page={limit}")
        return (res or {}).get("data") or []

    # ── Candidates ────────────────────────────────────────────────────────────

    async def create_candidate(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Creates a Candidate in Zoho Recruit."""
        payload = {"data": [data]}
        res = await self._request("POST", "Candidates", json=payload)
        if not res or not res.get("data"):
            raise ZohoAPIException("Failed to create candidate.")
        return res["data"][0]

    async def update_candidate(self, provider_candidate_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Updates a Candidate in Zoho Recruit."""
        payload = {"data": [{"id": provider_candidate_id, **data}]}
        res = await self._request("PUT", "Candidates", json=payload)
        if not res or not res.get("data"):
            raise ZohoAPIException("Failed to update candidate.")
        return res["data"][0]

    async def delete_candidate(self, provider_candidate_id: str) -> None:
        """Deletes a Candidate from Zoho Recruit."""
        await self._request("DELETE", f"Candidates/{provider_candidate_id}")

    async def list_candidates(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Lists Candidates."""
        res = await self._request("GET", f"Candidates?per_page={limit}")
        return (res or {}).get("data") or []

    async def upload_resume(self, provider_candidate_id: str, filename: str, file_content: bytes) -> Dict[str, Any]:
        """Uploads a candidate resume attachment to their candidate record."""
        # Zoho Recruit Attachment upload endpoint format:
        # POST /Candidates/{candidate_id}/Attachments
        path = f"Candidates/{provider_candidate_id}/Attachments"
        files = {
            "file": (filename, file_content, "application/pdf")
        }
        # Avoid application/json headers logic
        base_url = await self._get_base_url()
        url = f"{base_url}/{path}"
        headers = {
            "Authorization": f"Zoho-oauthtoken {await ZohoTokenManager.get_access_token(self.db, self.organization_id)}"
        }
        
        try:
            res = requests.post(url, headers=headers, files=files, timeout=45)
            if res.status_code in (200, 201):
                return res.json()
            else:
                raise ZohoAPIException(f"Failed to upload resume to candidate {provider_candidate_id}: {res.text}")
        except requests.RequestException as e:
            raise ZohoAPIException(f"Resume upload HTTP failed: {e}")
