from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class ZohoStatusResponse(BaseModel):
    connected: bool
    organization_name: Optional[str] = None
    connected_at: Optional[datetime] = None
    last_sync: Optional[datetime] = None

class PublishJobRequest(BaseModel):
    job_id: str = Field(..., description="The local UUID of the JobOpening to publish")

class PublishJobResponse(BaseModel):
    job_id: str
    provider: str = "zoho"
    provider_job_id: str
    sync_status: str
    last_synced: datetime

class TestConnectionResponse(BaseModel):
    success: bool
    message: str
