"""Production service logic — processes, runs, plans.

The rules this module enforces:

1. Stock moves only on completion. A run that was started but abandoned has
   deducted nothing and added nothing — only ``complete_run`` produces the
   event payload the inventory service posts movements from.

2. Production never talks to inventory or purchase. It emits structured
   payloads; the consumers resolve names to their own items. A process line
   therefore carries a name snapshot next to its bare UUID.

3. Plan lines are targets, not commitments. Starting a run from a plan is the
   moment the target becomes work; the plan line's status follows.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.production.models import (
    ProductionPlanLine,
    ProductionProcess,
    ProductionProcessLine,
    ProductionRun,
    RunSource,
    RunStatus,
    status_value,
)
from src.services.production.schemas import (
    ExcelRowIn,
    PlanLineIn,
    ProcessCreate,
    ProcessUpdate,
)

FOUR_PLACES = 4


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _q(value) -> float:
    """Quantize a quantity to 4 decimals, the inventory-precision rule.

    Production quantities feed inventory movements directly, so they keep the
    same 4 places the stock ledger does — rounding to 2 here would leak a few
    hundredths of a gram per run into the ledger.
    """
    return round(float(value or 0), FOUR_PLACES)


class ProductionError(Exception):
    """A rejected production operation. The API maps this to 409 or 400."""


# ─── Processes ───────────────────────────────────────────────────────────────


async def load_process(db: AsyncSession, tenant_id: uuid.UUID,
                       process_id: uuid.UUID) -> ProductionProcess | None:
    """Load a process with its lines eager — a lazy load during Pydantic
    serialisation would raise MissingGreenlet."""
    return (
        await db.execute(
            select(ProductionProcess)
            .options(selectinload(ProductionProcess.lines))
            .where(
                ProductionProcess.id == process_id,
                ProductionProcess.tenant_id == tenant_id,
            )
        )
    ).scalars().first()


async def list_processes(db: AsyncSession, tenant_id: uuid.UUID,
                         outlet_id: uuid.UUID | None = None,
                         active_only: bool = False) -> list[ProductionProcess]:
    stmt = (
        select(ProductionProcess)
        .options(selectinload(ProductionProcess.lines))
        .where(ProductionProcess.tenant_id == tenant_id)
    )
    if outlet_id is not None:
        stmt = stmt.where(ProductionProcess.outlet_id == outlet_id)
    if active_only:
        stmt = stmt.where(ProductionProcess.is_active.is_(True))
    return list((await db.execute(stmt)).scalars().all())


async def create_process(db: AsyncSession, tenant_id: uuid.UUID,
                         payload: ProcessCreate) -> ProductionProcess:
    process = ProductionProcess(
        tenant_id=tenant_id,
        outlet_id=payload.outlet_id,
        name=payload.name,
        output_item=payload.output_item,
        output_item_name=payload.output_item_name,
        output_qty=_q(payload.output_qty),
        output_uom=payload.output_uom,
        is_active=payload.is_active,
    )
    db.add(process)
    await db.flush()
    for line in payload.lines:
        db.add(ProductionProcessLine(
            tenant_id=tenant_id,
            process_id=process.id,
            raw_item_id=line.raw_item_id,
            raw_item_name=line.raw_item_name,
            qty=_q(line.qty),
            uom=line.uom,
            loss_pct=line.loss_pct,
        ))
    await db.flush()
    # Re-read the graph eagerly: the response model serialises process.lines,
    # and a lazy load during that serialisation is the MissingGreenlet trap
    # (the same reason load_process eager-loads).
    return await load_process(db, tenant_id, process.id)


async def update_process(db: AsyncSession, tenant_id: uuid.UUID,
                          process: ProductionProcess,
                          payload: ProcessUpdate) -> ProductionProcess:
    data = payload.model_dump(exclude_unset=True, exclude={"lines"})
    for field, value in data.items():
        setattr(process, field, value)
    if payload.lines is not None:
        # Replace the whole line set (see schema docstring).
        for line in list(process.lines):
            await db.delete(line)
        await db.flush()
        for line in payload.lines:
            db.add(ProductionProcessLine(
                tenant_id=tenant_id,
                process_id=process.id,
                raw_item_id=line.raw_item_id,
                raw_item_name=line.raw_item_name,
                qty=_q(line.qty),
                uom=line.uom,
                loss_pct=line.loss_pct,
            ))
    await db.flush()
    return process


async def delete_process(db: AsyncSession, tenant_id: uuid.UUID,
                          process_id: uuid.UUID) -> None:
    """Delete a master only if no run has ever started from it.

    Runs are the audit trail of what was actually produced; deleting the
    master out from under them would orphan that trail. The cascade on the
    run table stops us here instead."""
    run_exists = await db.scalar(
        select(ProductionRun.id).where(
            ProductionRun.process_id == process_id,
            ProductionRun.tenant_id == tenant_id,
        ).limit(1)
    )
    if run_exists is not None:
        raise ProductionError(
            "Process has runs against it and cannot be deleted — deactivate it instead"
        )
    process = await load_process(db, tenant_id, process_id)
    if process is None:
        return
    await db.delete(process)
    await db.flush()


# ─── Runs ────────────────────────────────────────────────────────────────────


async def load_run(db: AsyncSession, tenant_id: uuid.UUID,
                   run_id: uuid.UUID) -> ProductionRun | None:
    return await db.scalar(
        select(ProductionRun).where(
            ProductionRun.id == run_id,
            ProductionRun.tenant_id == tenant_id,
        )
    )


async def list_runs(db: AsyncSession, tenant_id: uuid.UUID,
                    outlet_id: uuid.UUID | None = None,
                    status_filter: str | None = None) -> list[ProductionRun]:
    stmt = select(ProductionRun).where(ProductionRun.tenant_id == tenant_id)
    if outlet_id is not None:
        stmt = stmt.where(ProductionRun.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(ProductionRun.status == status_filter)
    stmt = stmt.order_by(ProductionRun.created_at.desc()).limit(500)
    return list((await db.execute(stmt)).scalars().all())


async def start_run(db: AsyncSession, tenant_id: uuid.UUID,
                    process_id: uuid.UUID,
                    outlet_id: uuid.UUID | None,
                    planned_qty: float,
                    source: RunSource,
                    notes: str | None) -> ProductionRun:
    """Start a run: PLANNED -> STARTED, timestamped.

    A run created from a plan line marks that line fulfilled — the target has
    become work, and leaving it "open" would double-count it in planning."""
    process = await load_process(db, tenant_id, process_id)
    if process is None:
        raise ProductionError("Process not found")
    # Born PLANNED, started in the same call: the lifecycle is honoured
    # (PLANNED -> STARTED) even though the two states never straddle a
    # transaction boundary here.
    run = ProductionRun(
        tenant_id=tenant_id,
        outlet_id=outlet_id or process.outlet_id,
        process_id=process.id,
        status=RunStatus.PLANNED,
        planned_qty=_q(planned_qty or process.output_qty),
        source=source,
        notes=notes,
    )
    db.add(run)
    await db.flush()
    run.status = RunStatus.STARTED
    run.started_at = _now()
    await db.flush()

    if source == RunSource.PLAN:
        plan_line = await db.scalar(
            select(ProductionPlanLine).where(
                ProductionPlanLine.tenant_id == tenant_id,
                ProductionPlanLine.process_id == process.id,
                ProductionPlanLine.status == "open",
            ).order_by(ProductionPlanLine.target_date.asc()).limit(1)
        )
        if plan_line is not None:
            plan_line.status = "fulfilled"
            await db.flush()
    return run


async def complete_run(db: AsyncSession, tenant_id: uuid.UUID,
                       run: ProductionRun,
                       output_qty_actual: float,
                       notes: str | None = None) -> ProductionRun:
    """COMPLETED is the moment stock changes. Only PLANNED/STARTED complete."""
    current = status_value(run.status)
    if current not in (status_value(RunStatus.PLANNED),
                       status_value(RunStatus.STARTED)):
        raise ProductionError(f"Run is {current}, not open for completion")
    run.status = RunStatus.COMPLETED
    run.output_qty_actual = _q(output_qty_actual)
    if notes:
        run.notes = notes
    run.completed_at = _now()
    await db.flush()
    return run


async def cancel_run(db: AsyncSession, tenant_id: uuid.UUID,
                     run: ProductionRun,
                     notes: str | None = None) -> ProductionRun:
    """Cancel out of any open state. Nothing was moved, so nothing is undone."""
    current = status_value(run.status)
    if current in (status_value(RunStatus.COMPLETED),
                   status_value(RunStatus.CANCELLED)):
        raise ProductionError(f"Run is {current}, a terminal state")
    run.status = RunStatus.CANCELLED
    if notes:
        run.notes = notes
    await db.flush()
    return run


def _effective_raw_qty(line: ProductionProcessLine) -> float:
    """A line's raw usage including its loss allowance.

    Loss is a percentage of the recipe qty on top of it — the store must have
    enough for both, or the next run starts from a deficit that shows up as a
    stockout mid-process."""
    qty = _q(line.qty)
    loss = float(line.loss_pct or 0)
    if loss > 0:
        qty = _q(qty * (1 + loss / 100))
    return qty


def completion_event_payload(tenant_id: uuid.UUID,
                             run: ProductionRun,
                             process: ProductionProcess) -> dict:
    """The pinned ``production.run.completed`` payload.

    Built inside the completion transaction so the outbox row and the status
    change commit together. Names (not ids alone) are what the consumers can
    act on: the inventory service resolves raw_deductions/output_items names
    against its own items and skips what it cannot resolve.
    """
    scale = 1.0
    output = _q(process.output_qty)
    planned = _q(run.planned_qty or process.output_qty)
    if output > 0 and planned > 0:
        # The run may have planned a different batch size than the master's
        # yield; raw requirements scale with it.
        scale = planned / output

    output_items = []
    if _q(run.output_qty_actual) > 0 and process.output_item_name:
        output_items.append({
            "item_id": str(process.output_item) if process.output_item else None,
            "name": process.output_item_name,
            "qty": _q(run.output_qty_actual),
            "uom": process.output_uom,
        })

    raw_deductions = []
    for line in sorted(process.lines or [], key=lambda l: str(l.id)):
        name = line.raw_item_name
        if not name:
            continue
        raw_deductions.append({
            "item_id": str(line.raw_item_id) if line.raw_item_id else None,
            "name": name,
            "qty": _q(_effective_raw_qty(line) * scale),
            "uom": line.uom,
        })

    return {
        "run_id": str(run.id),
        "process_id": str(run.process_id),
        "output_qty": _q(run.output_qty_actual or 0),
        "output_items": output_items,
        "raw_deductions": raw_deductions,
        "outlet_id": str(run.outlet_id) if run.outlet_id else None,
        "tenant_id": str(tenant_id),
    }


def raise_po_payload(tenant_id: uuid.UUID, run: ProductionRun,
                     process: ProductionProcess) -> dict:
    """The pinned ``production.po.requested`` payload.

    Raw requirements for the run, ready for the purchase service to map into a
    PO. The vendor is a procurement decision the purchase service makes — the
    payload deliberately carries none."""
    scale = 1.0
    output = _q(process.output_qty)
    planned = _q(run.planned_qty or process.output_qty)
    if output > 0 and planned > 0:
        scale = planned / output

    lines = []
    for line in sorted(process.lines or [], key=lambda l: str(l.id)):
        name = line.raw_item_name
        qty = _q(_effective_raw_qty(line) * scale)
        if not name or qty <= 0:
            continue
        lines.append({
            "item_id": str(line.raw_item_id) if line.raw_item_id else None,
            "name": name,
            "qty": qty,
            "uom": line.uom,
        })
    return {
        "run_id": str(run.id),
        "outlet_id": str(run.outlet_id) if run.outlet_id else None,
        "lines": lines,
    }


# ─── Plans ───────────────────────────────────────────────────────────────────


async def list_plan_lines(db: AsyncSession, tenant_id: uuid.UUID,
                          outlet_id: uuid.UUID | None = None,
                          status_filter: str | None = None) -> list[ProductionPlanLine]:
    stmt = select(ProductionPlanLine).where(
        ProductionPlanLine.tenant_id == tenant_id
    )
    if outlet_id is not None:
        stmt = stmt.where(ProductionPlanLine.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(ProductionPlanLine.status == status_filter)
    stmt = stmt.order_by(ProductionPlanLine.target_date.asc()).limit(500)
    return list((await db.execute(stmt)).scalars().all())


async def upsert_plan_lines(db: AsyncSession, tenant_id: uuid.UUID,
                            lines: list[PlanLineIn]) -> list[ProductionPlanLine]:
    """Bulk-create plan lines. Existing (process, outlet, date) rows with the
    same open status get their qty replaced rather than duplicated — a plan is
    "how much of X on day D", which is one target, not a ledger."""
    created: list[ProductionPlanLine] = []
    for entry in lines:
        # outlet_id may be None (outlet-agnostic plan). A bare == None
        # compiles to "outlet_id = NULL" which matches nothing in SQL, so the
        # null case needs an IS NULL clause — otherwise re-importing an
        # outlet-agnostic row duplicates the plan line instead of upserting.
        outlet_clause = (ProductionPlanLine.outlet_id.is_(None)
                         if entry.outlet_id is None
                         else ProductionPlanLine.outlet_id == entry.outlet_id)
        existing = await db.scalar(
            select(ProductionPlanLine).where(
                ProductionPlanLine.tenant_id == tenant_id,
                ProductionPlanLine.process_id == entry.process_id,
                outlet_clause,
                ProductionPlanLine.target_date == entry.target_date,
                ProductionPlanLine.status == "open",
            ).limit(1)
        )
        if existing is not None:
            existing.planned_qty = _q(existing.planned_qty + entry.planned_qty)
            created.append(existing)
            continue
        row = ProductionPlanLine(
            tenant_id=tenant_id,
            outlet_id=entry.outlet_id,
            process_id=entry.process_id,
            target_date=entry.target_date,
            planned_qty=_q(entry.planned_qty),
            status="open",
        )
        db.add(row)
        created.append(row)
    await db.flush()
    return created


async def next_plan_lines(db: AsyncSession, tenant_id: uuid.UUID,
                          outlet_id: uuid.UUID | None = None,
                          status_filter: str | None = None) -> list[ProductionPlanLine]:
    """Today + tomorrow — the execution board's window."""
    today = date.today()
    stmt = select(ProductionPlanLine).where(
        ProductionPlanLine.tenant_id == tenant_id,
        ProductionPlanLine.target_date.in_([today, today + timedelta(days=1)]),
    )
    if outlet_id is not None:
        stmt = stmt.where(ProductionPlanLine.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(ProductionPlanLine.status == status_filter)
    else:
        stmt = stmt.where(ProductionPlanLine.status == "open")
    stmt = stmt.order_by(
        ProductionPlanLine.target_date.asc(), ProductionPlanLine.created_at.asc()
    )
    return list((await db.execute(stmt)).scalars().all())


# ─── Excel import & plan generation ─────────────────────────────────────────


async def import_excel(db: AsyncSession, tenant_id: uuid.UUID,
                       rows: list[ExcelRowIn],
                       outlet_id: uuid.UUID | None) -> dict:
    """Spreadsheet stand-in: process names in, plan lines out.

    A row whose process name is new creates the master (output unknown, so a
    process with no lines — the operator defines the recipe afterwards); a
    row matching an existing active process for this outlet (or outlet-agnostic
    master) just adds a plan line. The result says which is which, so the UI
    can flag rows that silently became new masters."""
    existing = await list_processes(db, tenant_id, outlet_id=None)
    by_name: dict[str, ProductionProcess] = {}
    for p in existing:
        key = p.name.strip().lower()
        # First match wins; name collisions across outlets are the operator's
        # problem, but do not let one silently shadow another's master.
        by_name.setdefault(key, p)

    plan_entries: list[PlanLineIn] = []
    created = 0
    matched = 0
    skipped: list[str] = []

    for row in rows:
        key = row.process_name.strip().lower()
        process = by_name.get(key)
        target = row.target_date or date.today()
        if process is None:
            process = ProductionProcess(
                tenant_id=tenant_id,
                outlet_id=outlet_id,
                name=row.process_name.strip(),
                output_qty=0,
                is_active=True,
            )
            db.add(process)
            # The plan line that follows is keyed on the process's id, which
            # the UUID default only stamps at flush time — flush now so the
            # entry below carries a real id, not None.
            await db.flush()
            created += 1
            by_name[key] = process
        else:
            matched += 1
        plan_entries.append(PlanLineIn(
            process_id=process.id,
            outlet_id=outlet_id,
            target_date=target,
            planned_qty=row.planned_qty,
        ))

    if not plan_entries:
        return {"created": 0, "matched": 0, "skipped": skipped, "plan_line_ids": []}

    lines = await upsert_plan_lines(db, tenant_id, plan_entries)
    await db.flush()
    return {
        "created": created,
        "matched": matched,
        "skipped": skipped,
        "plan_line_ids": [l.id for l in lines],
    }


async def generate_plan_from_hints(db: AsyncSession, tenant_id: uuid.UUID,
                                   hints: list,
                                   target_date: date,
                                   outlet_id: uuid.UUID | None = None) -> list[ProductionPlanLine]:
    """Turn demand hints (finished-good name + qty) into plan lines.

    The hint's ``item_name`` is matched against a process's
    ``output_item_name``: that process, at the hinted quantity, is what the
    plan row becomes. Hints that match no active process are reported, not
    raised — a forecast for a product with no master yet is a signal, not a
    failure."""
    processes = await list_processes(db, tenant_id, outlet_id=None, active_only=True)
    by_output_name: dict[str, ProductionProcess] = {}
    for p in processes:
        if p.output_item_name:
            by_output_name.setdefault(p.output_item_name.strip().lower(), p)

    entries: list[PlanLineIn] = []
    seen: set[uuid.UUID] = set()
    for hint in hints:
        item_name = str(hint.item_name or "").strip()
        qty = _q(hint.qty)
        if not item_name or qty <= 0:
            continue
        process = by_output_name.get(item_name.lower())
        if process is None or process.id in seen:
            continue
        seen.add(process.id)
        entries.append(PlanLineIn(
            process_id=process.id,
            outlet_id=outlet_id,
            target_date=target_date,
            planned_qty=qty,
        ))
    return await upsert_plan_lines(db, tenant_id, entries)
