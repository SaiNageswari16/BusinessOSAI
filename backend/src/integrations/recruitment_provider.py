import abc
import uuid
from typing import Any, Dict, List
from sqlalchemy.ext.asyncio import AsyncSession
from src.models import JobOpening, Applicant

class RecruitmentProvider(abc.ABC):
    """
    Common interface for external ATS / Job Board recruitment providers.
    All integrations (Zoho Recruit, LinkedIn, Indeed, etc.) must implement this interface.
    """

    @abc.abstractmethod
    async def connect(self, db: AsyncSession, organization_id: uuid.UUID, **kwargs) -> Any:
        """Connect/Authorize the integration."""
        pass

    @abc.abstractmethod
    async def disconnect(self, db: AsyncSession, organization_id: uuid.UUID) -> None:
        """Disconnect and delete the integration credentials."""
        pass

    @abc.abstractmethod
    async def publish_job(self, db: AsyncSession, organization_id: uuid.UUID, job: JobOpening) -> Dict[str, Any]:
        """Publish a local job opening to the external provider."""
        pass

    @abc.abstractmethod
    async def update_job(self, db: AsyncSession, organization_id: uuid.UUID, job: JobOpening) -> Dict[str, Any]:
        """Update an already published job opening on the external provider."""
        pass

    @abc.abstractmethod
    async def delete_job(self, db: AsyncSession, organization_id: uuid.UUID, job: JobOpening) -> None:
        """Remove/Delete a job opening from the external provider."""
        pass

    @abc.abstractmethod
    async def sync_jobs(self, db: AsyncSession, organization_id: uuid.UUID) -> List[Dict[str, Any]]:
        """Sync job listings from the external provider to our local database."""
        pass

    @abc.abstractmethod
    async def sync_candidates(self, db: AsyncSession, organization_id: uuid.UUID) -> List[Dict[str, Any]]:
        """Sync applicants/candidates from the external provider to our local database."""
        pass
