"""Notification schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from src.models.core import NotificationChannel, NotificationStatus


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class NotificationTemplateCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=100)
    event: str = Field(min_length=1, max_length=50)
    channel: NotificationChannel = NotificationChannel.WHATSAPP
    subject: str | None = Field(default=None, max_length=300)
    body: str = Field(min_length=1)
    variables: list[str] = Field(default_factory=list)
    is_active: bool = True


class NotificationTemplateUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    event: str | None = Field(default=None, max_length=50)
    channel: NotificationChannel | None = None
    subject: str | None = Field(default=None, max_length=300)
    body: str | None = None
    variables: list[str] | None = None
    is_active: bool | None = None


class NotificationTemplateResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    event: str
    channel: str
    subject: str | None
    body: str
    variables: list
    is_active: bool
    created_at: datetime


class NotificationLogResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    template_id: uuid.UUID | None
    event: str | None
    channel: str
    recipient: str
    payload: dict
    status: str
    provider: str | None
    provider_message_id: str | None
    error: str | None
    sent_at: datetime | None
    created_at: datetime


class BroadcastRequest(BaseModel):
    outlet_id: uuid.UUID | None = None
    channel: NotificationChannel = NotificationChannel.WHATSAPP
    event: str = Field(default="broadcast", max_length=50)
    subject: str | None = Field(default=None, max_length=300)
    body: str = Field(min_length=1)
    recipients: list[str] = Field(min_length=1)
    variables: dict = Field(default_factory=dict)


class BroadcastResponse(BaseModel):
    queued: int
    failed: int
    log_ids: list[uuid.UUID] = Field(default_factory=list)
