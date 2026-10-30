"""Transactional outbox for marketing events.

Every event this service would have published is instead written to the
``outbox_messages`` table *inside the same transaction* as the domain change.
A background relay polls for unpublished rows and pushes them to the event
bus. This guarantees:

  * no domain change is committed without its event (atomicity)
  * a crashed process doesn't lose events (rows survive the crash)
  * the relay can retry on transient bus failures (idempotent event_id)

The relay runs for the life of the marketing service and is started/stopped
in the service lifespan alongside the event bus.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.event_bus.bus import Event, bus
from src.services.marketing.models import OutboxMessage
from src.services.shared.service_db import ServiceDatabase

logger = logging.getLogger("marketing.outbox")

RELAY_POLL_SECONDS = 1.0
BATCH_SIZE = 50
MAX_RETRIES = 5


async def record_event(
    db: AsyncSession,
    *,
    type: str,
    data: dict,
    tenant_id: uuid.UUID | None = None,
    outlet_id: uuid.UUID | None = None,
    event_id: str | None = None,
) -> str:
    """Write an outbox row in the caller's open transaction.

    The caller is responsible for committing (or rolling back) — this function
    only ``flush``es so the row is visible to the commit and can be read back
    for its generated id. Returns the event_id (generated if not supplied).
    """
    eid = event_id or str(uuid.uuid4())
    row = OutboxMessage(
        event_id=eid,
        type=type,
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        data=data,
        source_service="marketing",
        status="pending",
    )
    db.add(row)
    await db.flush()
    return eid


class OutboxRelay:
    """Background task: drain the outbox table into the event bus."""

    def __init__(self, db: ServiceDatabase) -> None:
        self._db = db
        self._task: asyncio.Task | None = None
        self._stopped = False
        self._published = 0

    async def start(self) -> None:
        self._task = asyncio.create_task(self._run())
        logger.info("Outbox relay started")

    async def stop(self) -> None:
        self._stopped = True
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Outbox relay stopped (published=%d)", self._published)

    async def _run(self) -> None:
        while not self._stopped:
            try:
                await self._poll_once()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("Outbox relay poll failed: %s", exc)
            await asyncio.sleep(RELAY_POLL_SECONDS)

    async def _poll_once(self) -> int:
        async with self._db.session_factory() as session:
            rows = (await session.execute(
                select(OutboxMessage)
                .where(OutboxMessage.status == "pending")
                .order_by(OutboxMessage.created_at.asc())
                .limit(BATCH_SIZE)
                .with_for_update(skip_locked=True)
            )).scalars().all()

            published = 0
            for row in rows:
                event = Event(
                    type=row.type,
                    tenant_id=row.tenant_id,
                    outlet_id=row.outlet_id,
                    data=row.data or {},
                    event_id=row.event_id,
                    source_service=row.source_service,
                )
                try:
                    # Publish to the bus (fire-and-forget; the bus's own
                    # outage buffer handles Redis-down periods). The outbox
                    # row is the durable source of truth; a bus-side failure
                    # means we retry on the next poll until delivered.
                    await bus.publish(event, local=False)
                    row.status = "published"
                    row.published_at = datetime.utcnow()
                    row.retry_count = 0
                    published += 1
                    self._published += 1
                except Exception as exc:
                    row.retry_count = (row.retry_count or 0) + 1
                    row.last_error = str(exc)[:400]
                    if row.retry_count >= MAX_RETRIES:
                        row.status = "dead"
                        logger.error("Outbox event %s marked dead: %s", row.event_id, exc)
            await session.commit()
            return published
