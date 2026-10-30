"""Production service endpoints.

Who may call what:
  * ``/processes``, ``/runs``, ``/plans`` read — ``view:production``
  * create / complete / cancel / import — ``manage:production``

Events:
  publishes  production.run.completed   (a completed run: raws out, goods in)
             production.po.requested    (raw requirements: purchase raises a PO)

Both are written to the outbox in the same transaction as the domain change,
then published locally; the relay is what delivers them to the inventory and
purchase services, which do the stock posting and PO creation there. Nothing
in this service touches another service's database.
"""
from __future__ import annotations

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.event_bus.bus import Event, bus
from src.services.production import outbox, service as svc
from src.services.production.models import RunStatus
from src.services.production.schemas import (
    ExcelImport,
    ExcelImportResult,
    PlanGenerate,
    PlanLineCreate,
    PlanLineResponse,
    ProcessCreate,
    ProcessResponse,
    ProcessUpdate,
    RunComplete,
    RunCreate,
    RunResponse,
)
from src.services.shared.identity import CurrentIdentity

logger = logging.getLogger("production.api")

router = APIRouter()


async def get_db(request: Request) -> AsyncSession:
    """One session per request, committed on success, rolled back on error."""
    session = request.app.state.db.session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


DbDep = Annotated[AsyncSession, Depends(get_db)]


def _outlet_scoped(identity, outlet_id: uuid.UUID | None) -> None:
    """Outlet-scoped screens must be inside the caller's outlet scope."""
    if outlet_id is not None and not identity.can_access_outlet(outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")


# ─── Process master ──────────────────────────────────────────────────────────


@router.get("/processes", response_model=list[ProcessResponse], tags=["production"])
async def list_processes(identity: CurrentIdentity, db: DbDep,
                        outlet_id: uuid.UUID | None = None,
                        active_only: bool = False):
    """The Production Master screen: every process and its raw lines."""
    identity.require("view:production")
    _outlet_scoped(identity, outlet_id)
    return await svc.list_processes(db, identity.tenant_id, outlet_id, active_only)


@router.post("/processes", response_model=ProcessResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["production"])
async def create_process(payload: ProcessCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:production")
    _outlet_scoped(identity, payload.outlet_id)
    return await svc.create_process(db, identity.tenant_id, payload)


@router.get("/processes/{process_id}", response_model=ProcessResponse,
            tags=["production"])
async def get_process(process_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:production")
    process = await svc.load_process(db, identity.tenant_id, process_id)
    if process is None:
        raise HTTPException(status_code=404, detail="Process not found")
    _outlet_scoped(identity, process.outlet_id)
    return process


@router.patch("/processes/{process_id}", response_model=ProcessResponse,
              tags=["production"])
async def update_process(process_id: uuid.UUID, payload: ProcessUpdate,
                         identity: CurrentIdentity, db: DbDep):
    identity.require("manage:production")
    process = await svc.load_process(db, identity.tenant_id, process_id)
    if process is None:
        raise HTTPException(status_code=404, detail="Process not found")
    if payload.outlet_id is not None:
        _outlet_scoped(identity, payload.outlet_id)
    return await svc.update_process(db, identity.tenant_id, process, payload)


@router.delete("/processes/{process_id}", status_code=http_status.HTTP_204_NO_CONTENT,
               tags=["production"])
async def delete_process(process_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    """Delete only masters no run has ever used; the rest are deactivated."""
    identity.require("manage:production")
    try:
        await svc.delete_process(db, identity.tenant_id, process_id)
    except svc.ProductionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


# ─── Runs ────────────────────────────────────────────────────────────────────


@router.get("/runs", response_model=list[RunResponse], tags=["production"])
async def list_runs(identity: CurrentIdentity, db: DbDep,
                    outlet_id: uuid.UUID | None = None,
                    status_filter: str | None = Query(default=None,
                                                     description=f"One of: "
                                                                 f"{', '.join(s.value for s in RunStatus)}")):
    identity.require("view:production")
    _outlet_scoped(identity, outlet_id)
    runs = await svc.list_runs(db, identity.tenant_id, outlet_id, status_filter)
    # RunResponse validates straight off the ORM rows: the status/source
    # columns are String-backed str-enums, so a plain value loads fine and
    # serialises to the same string a response would anyway.
    return [RunResponse.model_validate(run) for run in runs]


@router.post("/runs", response_model=RunResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["production"])
async def start_run(payload: RunCreate, identity: CurrentIdentity, db: DbDep):
    """Start a run: PLANNED -> STARTED. Only completion moves stock."""
    identity.require("manage:production")
    process = await svc.load_process(db, identity.tenant_id, payload.process_id)
    if process is None:
        raise HTTPException(status_code=404, detail="Process not found")
    outlet = payload.outlet_id or process.outlet_id
    _outlet_scoped(identity, outlet)
    try:
        run = await svc.start_run(
            db, identity.tenant_id, payload.process_id, payload.outlet_id,
            payload.planned_qty, payload.source, payload.notes,
        )
    except svc.ProductionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return run


@router.post("/runs/{run_id}/complete", response_model=RunResponse,
             tags=["production"])
async def complete_run(run_id: uuid.UUID, payload: RunComplete,
                       identity: CurrentIdentity, db: DbDep):
    """COMPLETED is the only moment stock moves.

    The outbox row (``production.run.completed``) is written in the SAME
    transaction as the status change, so a committed completion can never
    reach inventory without its movement payload. The local publish is the
    fast path; the relay is the durable one."""
    identity.require("manage:production")
    run = await svc.load_run(db, identity.tenant_id, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    _outlet_scoped(identity, run.outlet_id)
    process = await svc.load_process(db, identity.tenant_id, run.process_id)
    if process is None:
        raise HTTPException(status_code=404, detail="Process for this run no longer exists")
    try:
        await svc.complete_run(db, identity.tenant_id, run,
                               payload.output_qty_actual, payload.notes)
    except svc.ProductionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    event_data = svc.completion_event_payload(identity.tenant_id, run, process)
    event = Event(
        type="production.run.completed",
        tenant_id=identity.tenant_id,
        outlet_id=run.outlet_id,
        data=event_data,
        source_service="production",
    )
    await outbox.record_event(
        db,
        type=event.type,
        data=event.data,
        tenant_id=identity.tenant_id,
        outlet_id=run.outlet_id,
        event_id=event.event_id,
    )
    await db.commit()
    await bus.publish(event, local=True)
    return run


@router.post("/runs/{run_id}/cancel", response_model=RunResponse,
             tags=["production"])
async def cancel_run(run_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:production")
    run = await svc.load_run(db, identity.tenant_id, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    _outlet_scoped(identity, run.outlet_id)
    try:
        await svc.cancel_run(db, identity.tenant_id, run)
    except svc.ProductionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return run


@router.post("/runs/{run_id}/raise-po", response_model=dict,
             tags=["production"])
async def raise_po(run_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    """Emit the raw requirements of a run for the purchase service to turn
    into a PO. The purchase service owns the vendor decision — this route
    never calls it directly; the event is the boundary."""
    identity.require("manage:production")
    run = await svc.load_run(db, identity.tenant_id, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    _outlet_scoped(identity, run.outlet_id)
    process = await svc.load_process(db, identity.tenant_id, run.process_id)
    if process is None:
        raise HTTPException(status_code=404, detail="Process for this run no longer exists")

    event_data = svc.raise_po_payload(identity.tenant_id, run, process)
    event = Event(
        type="production.po.requested",
        tenant_id=identity.tenant_id,
        outlet_id=run.outlet_id,
        data=event_data,
        source_service="production",
    )
    await outbox.record_event(
        db,
        type=event.type,
        data=event.data,
        tenant_id=identity.tenant_id,
        outlet_id=run.outlet_id,
        event_id=event.event_id,
    )
    await db.commit()
    await bus.publish(event, local=True)
    return {"event": event.type, "event_id": event.event_id, **event_data}


# ─── Plans ───────────────────────────────────────────────────────────────────


@router.get("/plans", response_model=list[PlanLineResponse], tags=["production"])
async def list_plans(identity: CurrentIdentity, db: DbDep,
                     outlet_id: uuid.UUID | None = None,
                     status_filter: str | None = None):
    identity.require("view:production")
    _outlet_scoped(identity, outlet_id)
    return await svc.list_plan_lines(db, identity.tenant_id, outlet_id, status_filter)


@router.post("/plans", response_model=list[PlanLineResponse],
             status_code=http_status.HTTP_201_CREATED, tags=["production"])
async def create_plans(payload: PlanLineCreate, identity: CurrentIdentity, db: DbDep):
    """Bulk-create plan lines. Every line must reference a known process."""
    identity.require("manage:production")
    for entry in payload.lines:
        if await svc.load_process(db, identity.tenant_id, entry.process_id) is None:
            raise HTTPException(status_code=404,
                                detail=f"Process {entry.process_id} not found")
    lines = await svc.upsert_plan_lines(db, identity.tenant_id, payload.lines)
    return lines


@router.get("/plans/next", response_model=list[PlanLineResponse],
            tags=["production"])
async def next_plans(identity: CurrentIdentity, db: DbDep,
                     outlet_id: uuid.UUID | None = None):
    """Today + tomorrow: the execution board's window."""
    identity.require("view:production")
    _outlet_scoped(identity, outlet_id)
    return await svc.next_plan_lines(db, identity.tenant_id, outlet_id)


# ─── Excel import stand-in & plan generation ────────────────────────────────


@router.post("/runs/import-excel", response_model=ExcelImportResult,
             tags=["production"])
async def import_excel(payload: ExcelImport, identity: CurrentIdentity, db: DbDep):
    """Excel-import stand-in: JSON rows of (process_name, qty, target_date).

    Known process names become plan lines; unknown ones create the master
    (with the operator to define its recipe) and then a plan line under it.
    The result counts both so the UI can flag rows that became new masters."""
    identity.require("manage:production")
    _outlet_scoped(identity, payload.outlet_id)
    return await svc.import_excel(db, identity.tenant_id, payload.rows, payload.outlet_id)


@router.get("/plan/generate", response_model=list[PlanLineResponse],
            tags=["production"])
async def generate_plan(payload: PlanGenerate, identity: CurrentIdentity, db: DbDep,
                        outlet_id: uuid.UUID | None = None):
    """Demand hints (finished-good name + qty, e.g. a forecast) become plan
    lines on the target date. Hints that match no active process's output are
    skipped, not raised — a forecast for a product with no master yet is a
    signal to create the master, not a failure of the generation."""
    identity.require("manage:production")
    _outlet_scoped(identity, outlet_id)
    return await svc.generate_plan_from_hints(
        db, identity.tenant_id, payload.hints, payload.target_date, outlet_id
    )
