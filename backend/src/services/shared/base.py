"""Shared Pydantic base schemas — used by every microservice.

These carry NO service-specific fields. They cover only the universal
concepts: pagination, ordering, bulk-delete, and the standard error envelope.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field


# ─── Generic ────────────────────────────────────────────────────────────────

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int

    @classmethod
    def build(cls, items: list[T], total: int, page: int, page_size: int) -> PaginatedResponse[T]:
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=(total + page_size - 1) // page_size,
        )


class BulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID] = Field(min_length=1, max_length=500)


class BulkDeleteResponse(BaseModel):
    deleted: int
    errors: list[str] = Field(default_factory=list)


# ─── Standard error envelope ────────────────────────────────────────────────

# All microservices MUST return this envelope on 4xx/5xx so the gateway
# can distinguish a business error from an infrastructure error without
# parsing the body shape.
class ErrorDetail(BaseModel):
    code: str = Field(description="Machine-readable error code, e.g. OUTLET_NOT_FOUND")
    message: str
    field: str | None = None
    detail: Any = None


class ErrorEnvelope(BaseModel):
    error: ErrorDetail
    service: str = Field(description="Originating service name")
    request_id: str | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ─── Health ─────────────────────────────────────────────────────────────────

class ServiceHealth(BaseModel):
    service: str
    status: str  # "up" | "degraded" | "down"
    database: str  # "up" | "down"
    event_bus: str  # "up" | "degraded" | "down"
    latency_ms: float | None = None


class GatewayHealth(BaseModel):
    gateway: str
    version: str
    services: dict[str, ServiceHealth]
