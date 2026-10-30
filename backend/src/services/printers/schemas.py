"""Printers service schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from src.services.printers.models import (
    Destination,
    DeviceKind,
    DeviceStatus,
    JobSourceType,
    JobStatus,
    PrinterHealth,
    PrinterType,
)


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Printers ────────────────────────────────────────────────────────────────

class PrinterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    outlet_id: uuid.UUID | None = None
    printer_type: PrinterType = PrinterType.THERMAL
    host: str = Field(default="", max_length=300)
    port: int = Field(default=9100, ge=1, le=65535)
    paper_width_mm: int | None = Field(default=None, ge=10, le=300)
    model: str | None = Field(default=None, max_length=200)
    default_destination: Destination | None = None
    notes: str | None = None


class PrinterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    outlet_id: uuid.UUID | None = None
    printer_type: PrinterType | None = None
    host: str | None = Field(default=None, max_length=300)
    port: int | None = Field(default=None, ge=1, le=65535)
    paper_width_mm: int | None = Field(default=None, ge=10, le=300)
    model: str | None = Field(default=None, max_length=200)
    default_destination: Destination | None = None
    active: bool | None = None
    health: PrinterHealth | None = None
    notes: str | None = None


class PrinterResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    printer_type: PrinterType
    host: str
    port: int
    paper_width_mm: int | None
    model: str | None
    default_destination: Destination | None
    active: bool
    last_seen_at: datetime | None
    health: PrinterHealth
    notes: str | None
    created_at: datetime


# ─── Devices ─────────────────────────────────────────────────────────────────

class DeviceCreate(BaseModel):
    device_code: str = Field(min_length=1, max_length=80)
    outlet_id: uuid.UUID | None = None
    device_kind: DeviceKind = DeviceKind.POS


class DeviceBind(BaseModel):
    printer_id: uuid.UUID | None = None


class DeviceResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    device_code: str
    device_kind: DeviceKind
    bound_printer_id: uuid.UUID | None
    status: DeviceStatus
    registered_at: datetime
    last_heartbeat_at: datetime | None
    created_at: datetime


# ─── Print jobs ──────────────────────────────────────────────────────────────

class PrintJobResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    printer_id: uuid.UUID | None
    source_type: JobSourceType
    source_ref: str
    destination: Destination
    status: JobStatus
    requested_at: datetime
    sent_at: datetime | None
    acked_at: datetime | None
    retry: int
    last_error: str | None


class JobRetryResponse(BaseModel):
    job_id: uuid.UUID
    status: JobStatus
    retry: int
