"""Transactional outbox for platform control-plane events.

Every module-lifecycle change (activate / suspend / archive / kill-switch)
writes an ``outbox_messages`` row *in the same transaction* as the state
change. A background relay polls pending rows and pushes them to the event
bus. This is the durable half of the gate-invalidation channel: the gateway
consumes ``platform.module.*`` events to evict cached gate decisions, and a
crash between the state commit and a direct bus publish no longer loses the
event.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.platform.models import OutboxMessage
from src.services.event_bus.bus import Event, bus
from src.services.shared.service_db import ServiceDatabase

logger = logging.getLogger("platform.outbox")

RELAY_POLL_SECONDS = 1.0
BATCH_SIZE = 50
MAX_RETRIES = 5


async def record_event(
    db: AsyncSession,
    *,
    type: str,
    data: dict,
    tenant_id: uuid.UUID | None = None,
    event_id: str | None = None,
) -> str:
    """Write an outbox row in the caller's open transaction.

    The caller commits (or rolls back) — this only flushes so the row
    survives the commit and the relay can read it back. Returns the event_id.
    """
    eid = event_id or str(uuid.uuid4())
    row = OutboxMessage(
        event_id=eid,
        type=type,
        tenant_id=tenant_id,
        data=data,
        source_service="platform",
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
                    data=row.data or {},
                    event_id=row.event_id,
                    source_service=row.source_service,
                )
                try:
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
