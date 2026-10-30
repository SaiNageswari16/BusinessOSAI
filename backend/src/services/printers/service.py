"""Printers service logic — printer registry, device pairing, job queue.

Cross-service ids are bare UUID columns: an ``outlet_id`` here is never a
foreign key (outlets live in the organization service). A print job's payload
JSONB snapshots the source document so nothing about a KOT or bill is ever
fetched from another database.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.printers.models import (
    DeviceRegistration,
    Destination,
    DeviceStatus,
    JobSourceType,
    JobStatus,
    Printer,
    PrinterHealth,
    PrintJob,
    PrintLog,
)
from src.services.shared.service_db import ServiceDatabase

logger = logging.getLogger("printers.service")


class PrintersError(Exception):
    """A rejected printers operation. The API layer maps this to 409 or 400."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid_or_none(value) -> uuid.UUID | None:
    """Parse a UUID out of event data, tolerating anything malformed.

    Event payloads are JSON, so every UUID arrives as a string. Assigning a
    string to a UUID column would raise on insert — the first event-driven
    job would then fail every time.
    """
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


# ─── Printers ────────────────────────────────────────────────────────────────

async def list_printers(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    outlet_id: uuid.UUID | None = None,
    printer_type: str | None = None,
) -> list[Printer]:
    stmt = select(Printer).where(Printer.tenant_id == tenant_id)
    if outlet_id is not None:
        stmt = stmt.where(Printer.outlet_id == outlet_id)
    if printer_type is not None:
        stmt = stmt.where(Printer.printer_type == printer_type.upper())
    stmt = stmt.order_by(Printer.created_at.asc())
    return list((await db.execute(stmt)).scalars().all())


async def load_printer(
    db: AsyncSession, tenant_id: uuid.UUID, printer_id: uuid.UUID
) -> Printer | None:
    return await db.scalar(
        select(Printer).where(
            Printer.id == printer_id,
            Printer.tenant_id == tenant_id,
        )
    )


async def create_printer(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    data: dict,
) -> Printer:
    """Register a printer.

    The (tenant, outlet, name) unique constraint is the database-level
    backstop; a duplicate surfaces as an IntegrityError and maps to a
    PrintersError the API turns into a 409.
    """
    printer = Printer(tenant_id=tenant_id, **data)
    db.add(printer)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise PrintersError(
            "A printer with this name already exists for this outlet"
        )
    return printer


async def update_printer(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    printer: Printer,
    data: dict,
) -> Printer:
    for field, value in data.items():
        setattr(printer, field, value)
    await db.flush()
    return printer


async def deactivate_printer(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    printer: Printer,
) -> Printer:
    """Soft delete: a registered printer keeps its history and jobs.

    Flipping ``active=False`` stops the dispatcher resolving it as an outlet
    default, but past PrintJobs keep their ``printer_id`` and audit rows.
    """
    printer.active = False
    printer.health = PrinterHealth.UNKNOWN
    await db.flush()
    return printer


async def record_printer_heartbeat(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    printer: Printer,
) -> Printer:
    """Liveness ping from the printer: last seen + healthy, right now."""
    printer.last_seen_at = _now()
    printer.health = PrinterHealth.HEALTHY
    await db.flush()
    return printer


# ─── Devices ─────────────────────────────────────────────────────────────────

async def list_devices(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    outlet_id: uuid.UUID | None = None,
    kind: str | None = None,
    status: str | None = None,
) -> list[DeviceRegistration]:
    stmt = select(DeviceRegistration).where(DeviceRegistration.tenant_id == tenant_id)
    if outlet_id is not None:
        stmt = stmt.where(DeviceRegistration.outlet_id == outlet_id)
    if kind is not None:
        stmt = stmt.where(DeviceRegistration.device_kind == kind.upper())
    if status is not None:
        stmt = stmt.where(DeviceRegistration.status == status.upper())
    stmt = stmt.order_by(DeviceRegistration.registered_at.desc())
    return list((await db.execute(stmt)).scalars().all())


async def create_device(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    data: dict,
) -> DeviceRegistration:
    existing = await db.scalar(
        select(DeviceRegistration.id).where(
            DeviceRegistration.tenant_id == tenant_id,
            DeviceRegistration.device_code == data["device_code"],
        )
    )
    if existing:
        raise PrintersError(
            "A device with this code is already registered for this tenant"
        )
    device = DeviceRegistration(tenant_id=tenant_id, **data)
    db.add(device)
    await db.flush()
    return device


async def load_device_by_code(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    code: str,
) -> DeviceRegistration | None:
    return await db.scalar(
        select(DeviceRegistration).where(
            DeviceRegistration.tenant_id == tenant_id,
            DeviceRegistration.device_code == code,
        )
    )


async def bind_device(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    device: DeviceRegistration,
    printer: Printer | None,
) -> DeviceRegistration:
    """PENDING -> BOUND. A revoked pairing is terminal for this code."""
    if device.status == DeviceStatus.REVOKED:
        raise PrintersError("This device code has been revoked")
    device.bound_printer_id = printer.id if printer else None
    device.status = DeviceStatus.BOUND
    await db.flush()
    return device


async def revoke_device(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    device: DeviceRegistration,
) -> DeviceRegistration:
    device.status = DeviceStatus.REVOKED
    device.last_heartbeat_at = None
    await db.flush()
    return device


async def device_heartbeat(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    device: DeviceRegistration,
) -> DeviceRegistration:
    device.last_heartbeat_at = _now()
    await db.flush()
    return device


# ─── Jobs ────────────────────────────────────────────────────────────────────

async def load_job(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    job_id: uuid.UUID,
) -> PrintJob | None:
    return await db.scalar(
        select(PrintJob).where(
            PrintJob.id == job_id,
            PrintJob.tenant_id == tenant_id,
        )
    )


async def job_exists(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    source_type: JobSourceType | str,
    source_ref: str,
    destination: Destination | str,
    outlet_id: uuid.UUID | None = None,
) -> bool:
    """Idempotency guard: a job with the same source already queued-or-later.

    Every job status is QUEUED-or-later (there is no "un-queued" state), so
    ANY existing row with this key means the source document was already
    queued — a redelivered event must not queue it a second time.

    The durable consumed_events ledger in the consumer loop is layer 1; this
    structural guard is layer 2 for the one path where that misses (a
    redelivery that slips past the ledger, e.g. after a crash between
    handler-write and ledger-mark).
    """
    stmt = select(PrintJob.id).where(
        PrintJob.tenant_id == tenant_id,
        PrintJob.source_type == JobSourceType(source_type),
        PrintJob.source_ref == source_ref,
        PrintJob.destination == Destination(destination),
    )
    if outlet_id is not None:
        stmt = stmt.where(PrintJob.outlet_id == outlet_id)
    row = await db.scalar(stmt.limit(1))
    return row is not None


async def create_test_job(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    printer: Printer,
) -> PrintJob:
    """Queue a test receipt against the printer itself.

    ``TEST-{printer_id}`` is the source_ref, which makes test prints
    idempotent per printer: re-clicking the button finds the earlier
    attempt's history in the audit log, not a duplicated spool entry.
    """
    payload = {
        "printer_name": printer.name,
        "paper_width_mm": printer.paper_width_mm,
        "lines": [
            "PRINTERS — TEST PRINT",
            f"printer: {printer.name}",
            f"type: {printer.printer_type}",
        ],
    }
    job = PrintJob(
        tenant_id=tenant_id,
        outlet_id=printer.outlet_id,
        printer_id=printer.id,
        source_type=JobSourceType.TEST,
        source_ref=f"TEST-{printer.id}",
        destination=Destination.RECEIPT,
        status=JobStatus.QUEUED,
        requested_at=_now(),
        payload=payload,
    )
    db.add(job)
    await db.flush()
    return job


async def retry_job(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    job: PrintJob,
    max_retries: int = 3,
) -> PrintJob:
    """Re-queue a FAILED or stale QUEUED job; the 4th attempt expires it.

    Retrying keeps the audit honest: every re-attempt bumps ``retry`` and
    adds a PrintLog row, so the history shows how many times the spooler
    got its chance before we stop trying.
    """
    if job.status not in (JobStatus.QUEUED, JobStatus.FAILED):
        raise PrintersError(f"Job is {job.status.value}; only QUEUED or FAILED can retry")
    if job.retry >= max_retries:
        job.status = JobStatus.EXPIRED
        await db.flush()
        return job
    job.retry += 1
    job.status = JobStatus.QUEUED
    job.last_error = None
    await db.flush()
    return job


async def default_printer_for(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID | None,
    destination: Destination | str,
) -> Printer | None:
    """The outlet's active printer that owns this destination.

    A KOT lands on whichever active printer is registered for KDS at that
    outlet; a bill on the RECEIPT printer. Several such printers is an
    operator mis-configuration, so the oldest (first registered) wins.
    """
    return await db.scalar(
        select(Printer).where(
            Printer.tenant_id == tenant_id,
            Printer.outlet_id == outlet_id,
            Printer.default_destination == Destination(destination),
            Printer.active.is_(True),
        )
        .order_by(Printer.created_at.asc())
        .limit(1)
    )


def _log(db: AsyncSession, job: PrintJob, from_status: str, to_status: str,
         note: str | None = None) -> None:
    """One append-only audit row; the caller's transaction commits it."""
    db.add(PrintLog(
        print_job_id=job.id,
        at=_now(),
        from_status=from_status,
        to_status=to_status,
        note=note,
    ))


# ─── Dispatcher ──────────────────────────────────────────────────────────────

QUEUE_AGE_LIMIT = timedelta(minutes=10)


def dispatch_printer(printer: Printer, job: PrintJob) -> bool:
    """INTEGRATION HOOK: the seam where a physical spooler plugs in.

    This build ships with no printer hardware, so "send" means logging what
    would be spooled and reporting success. A real sender — raw-socket
    9100, ESC/POS byte stream for THERMAL, HTTP/KDS REST push for KDS, or a
    QR payload for the QR destination — replaces the body of this function
    and returns False (or raises) on a refused connection; the dispatcher
    below already treats a False as FAILED with a retryable history.

    The job's ``payload`` JSONB is the spool content: the printer never sees
    another service's schema, only what the producing event snapshotted.
    """
    lines = (job.payload or {}).get("lines") or [job.source_ref]
    logger.info(
        "WOULD DISPATCH: printer=%s (%s %s:%s) job=%s source=%s/%s "
        "dest=%s bytes~%d\n  %s",
        printer.name, printer.printer_type, printer.host, printer.port,
        job.id, job.source_type, job.source_ref, job.destination,
        sum(len(l) for l in lines),
        "\n  ".join(str(l) for l in lines),
    )
    # TODO(integration): replace this with a real ESC/POS / raw-socket /
    # KDS-REST sender keyed on printer.printer_type; return False on failure.
    return True


class Dispatcher:
    """Periodic task: drain QUEUED print jobs and 'send' them.

    Runs alongside the OutboxRelay in main.py's startup. Each poll row-locks
    at most 20 oldest QUEUED jobs (skip_locked so a second dispatcher, if
    ever run, would not double-send) and resolves each to a printer:

      1. explicit ``job.printer_id`` (the event named a printer);
      2. else the outlet's active printer whose ``default_destination``
         matches the job's destination.

    A job older than ``QUEUE_AGE_LIMIT`` is EXPIRED, not sent: spooling a
    KOT that fired half an hour ago just papers over a dead kitchen line.
    """

    POLL_SECONDS = 2.0
    BATCH_SIZE = 20

    def __init__(self, db: ServiceDatabase) -> None:
        self._db = db
        self._task: asyncio.Task | None = None
        self._stopped = False
        self._sent = 0

    async def start(self) -> None:
        self._task = asyncio.create_task(self._run())
        logger.info("Print dispatcher started")

    async def stop(self) -> None:
        self._stopped = True
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Print dispatcher stopped (sent=%d)", self._sent)

    async def _run(self) -> None:
        while not self._stopped:
            try:
                await self._poll_once()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("Print dispatcher poll failed: %s", exc)
            await asyncio.sleep(self.POLL_SECONDS)

    async def _poll_once(self) -> int:
        async with self._db.session_factory() as session:
            cutoff = _now() - QUEUE_AGE_LIMIT
            rows = (await session.execute(
                select(PrintJob)
                .where(PrintJob.status == JobStatus.QUEUED)
                .order_by(PrintJob.requested_at.asc())
                .limit(self.BATCH_SIZE)
                .with_for_update(skip_locked=True)
            )).scalars().all()

            sent = 0
            for job in rows:
                if job.requested_at and job.requested_at < cutoff:
                    job.status = JobStatus.EXPIRED
                    _log(session, job, "QUEUED", "EXPIRED",
                         "job older than 10 min; not spooled")
                    continue

                printer = None
                if job.printer_id is not None:
                    printer = await load_printer(session, job.tenant_id, job.printer_id)
                    if printer is not None and not printer.active:
                        printer = None  # deactivated: fall through to default
                if printer is None:
                    printer = await default_printer_for(
                        session, job.tenant_id, job.outlet_id, job.destination
                    )
                if printer is None:
                    job.status = JobStatus.FAILED
                    job.last_error = (
                        f"no active printer for destination {job.destination.value} "
                        f"at outlet {job.outlet_id}"
                    )
                    _log(session, job, "QUEUED", "FAILED", job.last_error)
                    continue

                if printer.health == PrinterHealth.UNREACHABLE:
                    job.status = JobStatus.FAILED
                    job.last_error = f"printer {printer.name} is UNREACHABLE"
                    _log(session, job, "QUEUED", "FAILED", job.last_error)
                    continue

                ok = dispatch_printer(printer, job)
                if ok:
                    job.status = JobStatus.SENT
                    job.sent_at = _now()
                    _log(session, job, "QUEUED", "SENT",
                         f"printer={printer.name} {printer.host}:{printer.port}")
                    sent += 1
                    self._sent += 1
                else:
                    job.status = JobStatus.FAILED
                    job.last_error = "spooler rejected the job"
                    _log(session, job, "QUEUED", "FAILED", job.last_error)

            # One commit for the whole batch: job state, audit rows and any
            # outbox rows written here move together.
            await session.commit()
            return sent
