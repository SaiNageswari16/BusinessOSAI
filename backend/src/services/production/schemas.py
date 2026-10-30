"""Production service schemas — processes, runs, plans, excel import."""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from src.services.production.models import RunSource, RunStatus


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Process master ──────────────────────────────────────────────────────────


class ProcessLineIn(BaseModel):
    """One raw input. ``raw_item_id`` points at the inventory service.

    ``raw_item_name`` is a name snapshot: production cannot read inventory's
    database, so the consumer services resolve names inside their own data.
    """

    raw_item_id: uuid.UUID | None = None
    raw_item_name: str | None = Field(default=None, max_length=200)
    qty: float = Field(gt=0)
    uom: str | None = Field(default=None, max_length=30)
    loss_pct: float | None = Field(default=None, ge=0, le=100)


class ProcessCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    outlet_id: uuid.UUID | None = None
    output_item: uuid.UUID | None = None
    output_item_name: str | None = Field(default=None, max_length=200)
    output_qty: float = Field(ge=0, default=0)
    output_uom: str | None = Field(default=None, max_length=30)
    is_active: bool = True
    lines: list[ProcessLineIn] = Field(default_factory=list)


class ProcessUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    outlet_id: uuid.UUID | None = None
    output_item: uuid.UUID | None = None
    output_item_name: str | None = Field(default=None, max_length=200)
    output_qty: float | None = Field(default=None, ge=0)
    output_uom: str | None = Field(default=None, max_length=30)
    is_active: bool | None = None
    # Replacing the line set, not merging: a master edit is a redefinition of
    # the recipe, and a half-merged set of lines is just wrong.
    lines: list[ProcessLineIn] | None = None


class ProcessLineResponse(OrmModel):
    id: uuid.UUID
    raw_item_id: uuid.UUID | None
    raw_item_name: str | None
    qty: float
    uom: str | None
    loss_pct: float | None


class ProcessResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    output_item: uuid.UUID | None
    output_item_name: str | None
    output_qty: float
    output_uom: str | None
    is_active: bool
    created_at: datetime
    lines: list[ProcessLineResponse] = Field(default_factory=list)


# ─── Runs ────────────────────────────────────────────────────────────────────


class RunCreate(BaseModel):
    """Start a run: PLANNED -> STARTED (or fresh manual start)."""

    process_id: uuid.UUID
    outlet_id: uuid.UUID | None = None
    planned_qty: float = Field(ge=0, default=0)
    source: RunSource = RunSource.MANUAL
    notes: str | None = None


class RunComplete(BaseModel):
    output_qty_actual: float = Field(ge=0)
    notes: str | None = None


class RunResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    process_id: uuid.UUID
    status: RunStatus
    planned_qty: float
    output_qty_actual: float | None
    source: RunSource
    notes: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime


# ─── Plans ───────────────────────────────────────────────────────────────────


class PlanLineIn(BaseModel):
    process_id: uuid.UUID
    outlet_id: uuid.UUID | None = None
    target_date: date
    planned_qty: float = Field(gt=0)


class PlanLineCreate(BaseModel):
    """Bulk plan creation from a demand hint or a spreadsheet row."""

    lines: list[PlanLineIn] = Field(min_length=1)


class DemandHint(BaseModel):
    item_name: str = Field(min_length=1, max_length=200)
    qty: float = Field(gt=0)


class PlanGenerate(BaseModel):
    """Frontend/reports pass forecast numbers; this service turns them into
    plan lines. It deliberately reads nothing cross-service — a process whose
    output_item_name matches a hint is the link."""

    hints: list[DemandHint] = Field(min_length=1)
    target_date: date


class PlanLineResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    process_id: uuid.UUID
    target_date: date
    planned_qty: float
    status: str


# ─── Excel import stand-in ──────────────────────────────────────────────────


class ExcelRowIn(BaseModel):
    """One row of the spreadsheet: a process name and how much to plan."""

    process_name: str = Field(min_length=1, max_length=200)
    planned_qty: float = Field(gt=0)
    target_date: date | None = None


class ExcelImport(BaseModel):
    rows: list[ExcelRowIn] = Field(min_length=1)
    outlet_id: uuid.UUID | None = None


class ExcelImportResult(BaseModel):
    created: int
    matched: int
    skipped: list[str] = Field(default_factory=list)
    plan_line_ids: list[uuid.UUID] = Field(default_factory=list)
