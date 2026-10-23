"""Event bus — the ONLY way services talk to each other.

Design:
  * Redis Streams when available (durable, consumer groups, replayable).
  * An in-process asyncio queue when Redis is down — events are still
    delivered to local subscribers, but only buffered in memory. On Redis
    recovery the buffer flushes.
  * Every event carries ``tenant_id`` so consumers can filter. A consumer
    that crashes mid-handler is safe: the event is re-delivered after the
    ack timeout (at-least-once delivery, so handlers must be idempotent).

Events are plain dataclasses serialised to JSON — never a service's ORM
model, which would leak that service's schema to its peers.
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import time
import uuid
from dataclasses import asdict, dataclass, field, is_dataclass
from typing import Any, Awaitable, Callable

logger = logging.getLogger("event_bus")

STREAM_KEY = "ros:events"
CONSUMER_GROUP = "ros-workers"


def group_for(service_name: str) -> str:
    """A consumer group for one service.

    Every service MUST use its own group. A Redis Streams consumer group
    load-balances each message to a SINGLE consumer in the group, so one group
    shared by many services means an event goes to whichever service happens to
    be polling — and if that service does not subscribe to the topic, the event
    is acked and dropped with nobody noticing. That is a fan-out bus with
    fan-in delivery, and it fails silently.

    One group per service gives each service its own read cursor, so every
    service receives every event and applies its own subscription filters.
    """
    return f"ros-{service_name}"
MAX_STREAM_LEN = 100_000          # cap the stream, oldest events trimmed
ACK_TIMEOUT_MS = 60_000           # re-deliver unacked after 60s
POLL_BLOCK_MS = 200
INMEMORY_BUFFER = 10_000          # cap the Redis-outage buffer


@dataclass
class Event:
    """Envelope. ``type`` is the topic; ``data`` is the service-defined payload."""

    type: str
    tenant_id: uuid.UUID | str | None = None
    outlet_id: uuid.UUID | str | None = None
    data: dict[str, Any] = field(default_factory=dict)
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    occurred_at: float = field(default_factory=time.time)
    source_service: str = "unknown"
    # Set when replayed from the outage buffer, so consumers can detect dupes.
    replayed: bool = False

    def to_json(self) -> str:
        def _default(o: Any) -> Any:
            if isinstance(o, uuid.UUID):
                return str(o)
            if is_dataclass(o) and not isinstance(o, type):
                return asdict(o)
            return str(o)

        return json.dumps({
            "event_id": self.event_id,
            "type": self.type,
            "tenant_id": str(self.tenant_id) if self.tenant_id else None,
            "outlet_id": str(self.outlet_id) if self.outlet_id else None,
            "occurred_at": self.occurred_at,
            "source_service": self.source_service,
            "replayed": self.replayed,
            "data": self.data,
        }, default=_default)

    @classmethod
    def from_json(cls, raw: str | bytes) -> Event:
        if isinstance(raw, bytes):
            raw = raw.decode()
        d = json.loads(raw)
        return cls(
            type=d["type"],
            tenant_id=d.get("tenant_id"),
            outlet_id=d.get("outlet_id"),
            data=d.get("data") or {},
            event_id=d.get("event_id") or str(uuid.uuid4()),
            occurred_at=d.get("occurred_at") or time.time(),
            source_service=d.get("source_service", "unknown"),
            replayed=d.get("replayed", False),
        )


Handler = Callable[[Event], Awaitable[None]]


class EventBus:
    """Publish/subscribe across services, with an in-memory fallback."""

    def __init__(self) -> None:
        self._redis = None
        self._redis_url: str | None = None
        self._handlers: dict[str, list[Handler]] = {}
        self._seen: dict[str, float] = {}          # event_id -> ts (dedupe window)
        self._buffer: list[Event] = []             # events awaiting Redis
        self._buffer_lock = asyncio.Lock()
        self._consumer_task: asyncio.Task | None = None
        self._consumer_name = f"svc-{uuid.uuid4().hex[:8]}"
        self._group = CONSUMER_GROUP
        self._started = False
        self._published = 0
        self._delivered = 0
        self._dropped = 0

    # ── lifecycle ───────────────────────────────────────────────────────────

    def configure(self, redis_url: str | None, service_name: str | None = None) -> None:
        """Set the Redis URL and this service's own consumer group.

        ``service_name`` is how a service gets its own group. Pass it, or every
        service shares one group and events get load-balanced away instead of
        delivered — see ``group_for``.
        """
        self._redis_url = redis_url
        if service_name:
            self._group = group_for(service_name)

    @property
    def redis_available(self) -> bool:
        return self._redis is not None

    async def start(self) -> None:
        if self._started:
            return
        self._started = True
        await self._connect_redis()
        if self._redis is None:
            logger.warning(
                "Event bus running WITHOUT Redis — events delivered in-process only. "
                "Cross-service events will be lost until Redis is reachable."
            )
        else:
            await self._ensure_group()
            self._consumer_task = asyncio.create_task(self._consume_loop())

        # This task is what makes the degraded state recoverable, so it must
        # always run — including when Redis was down at boot. It retries the
        # connection, drains the outage buffer, and (re)starts the consumer
        # loop on recovery. Returning early here would leave a service that
        # boots before Redis comes up permanently unable to recover, no matter
        # how long Redis stays healthy afterwards.
        asyncio.create_task(self._flush_buffer())

    async def stop(self) -> None:
        self._started = False
        if self._consumer_task:
            self._consumer_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._consumer_task
        if self._redis is not None:
            with contextlib.suppress(Exception):
                await self._redis.aclose()
            self._redis = None

    async def _connect_redis(self) -> None:
        if not self._redis_url:
            return
        try:
            import redis.asyncio as aioredis
            client = aioredis.from_url(
                self._redis_url, decode_responses=True, socket_connect_timeout=2
            )
            await client.ping()
            self._redis = client
            logger.info("Event bus connected to Redis at %s", self._redis_url)
        except Exception as exc:
            logger.warning("Event bus could not reach Redis (%s) — degraded", exc)
            self._redis = None

    async def _ensure_group(self) -> None:
        if self._redis is None:
            return
        with contextlib.suppress(Exception):
            await self._redis.xgroup_create(
                STREAM_KEY, self._group, id="0", mkstream=True
            )

    # ── publishing ──────────────────────────────────────────────────────────

    async def publish(self, event: Event, *, local: bool = True) -> None:
        """Fire-and-forget. Never raises — a broken bus must not fail a sale.

        ``local=False`` is used only by the outage-buffer flush: those events
        already reached this process's handlers when they were first published,
        so re-dispatching them would fire every local handler twice. The event
        still needs to reach the STREAM, which is how peer processes get it.
        """
        self._published += 1
        if local:
            await self._dispatch_local(event)
            # Claim it so this process's own consumer loop knows it already
            # handled the event and does not deliver it a second time when it
            # reads the stream entry back. Peers have their own _seen, so they
            # still receive it.
            self.mark_seen(event.event_id)
        if self._redis is None:
            await self._enqueue_buffer(event)
            return
        try:
            await self._redis.xadd(
                STREAM_KEY,
                {"payload": event.to_json()},
                maxlen=MAX_STREAM_LEN,
                approximate=True,
            )
        except Exception as exc:
            logger.warning("Event bus publish failed, buffering: %s", exc)
            self._redis = None
            await self._enqueue_buffer(event)

    async def _enqueue_buffer(self, event: Event) -> None:
        async with self._buffer_lock:
            if len(self._buffer) >= INMEMORY_BUFFER:
                self._buffer.pop(0)
                self._dropped += 1
            self._buffer.append(event)

    async def _flush_buffer(self) -> None:
        """Periodically retry Redis and drain the outage buffer."""
        while self._started:
            await asyncio.sleep(5)
            if self._redis is not None:
                async with self._buffer_lock:
                    if not self._buffer:
                        continue
                    pending, self._buffer = self._buffer, []
                for ev in pending:
                    # local=False: these already reached this process's handlers
                    # when they were first published. Re-dispatching would fire
                    # every local handler twice — once live, once on recovery.
                    await self.publish(ev, local=False)
                logger.info("Event bus flushed %d buffered events", len(pending))
            else:
                await self._connect_redis()
                if self._redis is not None:
                    await self._ensure_group()
                    if self._consumer_task is None or self._consumer_task.done():
                        self._consumer_task = asyncio.create_task(self._consume_loop())

    # ── local dispatch (always runs, even without Redis) ────────────────────

    async def _dispatch_local(self, event: Event) -> None:
        # Dedupe deliberately does NOT live here. This method is called from
        # three places — publish(), the Redis consumer loop, and the
        # outage-buffer flush — and only ONE of them needs de-duplication:
        #
        #   * publish() dispatches synchronously to this process. Always fresh,
        #     never a dupe, and gating here would suppress the handler that a
        #     Redis-down process is the only consumer of.
        #   * the buffer flush re-publishes with local=False, so it never
        #     reaches this method at all.
        #   * the consumer loop reads from the shared stream, which can deliver
        #     the same entry twice — once live, again after an unacked redelivery.
        #     That is where the gate must go, and it is the only one of the three
        #     that can actually see a duplicate.
        #
        # Putting the gate here instead broke delivery for two reasons at once:
        # it suppressed the publisher's own first dispatch, and because the
        # buffer-flush event carries the SAME event_id as the one already
        # dispatched, an outage-buffered event was skipped here and never
        # re-queued to Redis at all — invisible dead-lettering.
        handlers = list(self._handlers.get(event.type, ()))
        handlers += list(self._handlers.get("*", ()))
        for h in handlers:
            try:
                await h(event)
                self._delivered += 1
            except Exception:
                logger.exception(
                    "Local handler failed for %s (event %s)",
                    event.type, event.event_id,
                )

    # ── redis consumption ───────────────────────────────────────────────────

    async def _consume_loop(self) -> None:
        while self._started and self._redis is not None:
            try:
                resp = await self._redis.xreadgroup(
                    self._group,
                    self._consumer_name,
                    {STREAM_KEY: ">"},
                    count=20,
                    block=POLL_BLOCK_MS,
                )
                for _stream, messages in resp or []:
                    for msg_id, fields in messages:
                        payload = fields.get("payload")
                        if payload:
                            event = Event.from_json(payload)
                            # The gate belongs here: this is the only path that
                            # can actually see a duplicate. publish() already
                            # claimed events this process sent, so reading its
                            # own entry back from the stream must not redeliver
                            # it. Peers' events are new to us and pass through.
                            #
                            # The in-memory _seen dict only survives for the
                            # life of this process. After a restart it is empty,
                            # so a Redis redelivery would pass it and fire
                            # handlers twice. The durable ledger (when installed
                            # by this service) is the authoritative gate; we
                            # consult it first, and also record in _seen so the
                            # fast in-process path still dedupes.
                            is_new = await self._durable_seen(event.event_id, event.type)
                            if is_new and self.mark_seen(event.event_id):
                                await self._dispatch_local(event)
                        with contextlib.suppress(Exception):
                            await self._redis.xack(STREAM_KEY, self._group, msg_id)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("Event bus consume loop error: %s", exc)
                await asyncio.sleep(2)
                await self._connect_redis()

    # ── subscription ────────────────────────────────────────────────────────

    def subscribe(self, topic: str, handler: Handler) -> None:
        self._handlers.setdefault(topic, []).append(handler)

    def on(self, *topics: str):
        """Decorator form: ``@bus.on("order.placed")``."""
        def wrap(fn: Handler) -> Handler:
            for t in topics:
                self.subscribe(t, fn)
            return fn
        return wrap

    # ── introspection ───────────────────────────────────────────────────────

    def stats(self) -> dict[str, Any]:
        return {
            "redis": "up" if self._redis is not None else "down",
            "published": self._published,
            "delivered_local": self._delivered,
            "buffered": len(self._buffer),
            "dropped": self._dropped,
            "topics": {t: len(h) for t, h in self._handlers.items()},
        }

    def mark_seen(self, event_id: str) -> bool:
        """Idempotency guard for at-least-once delivery. Returns True if new.

        In-memory only: this dict dies with the process, so it is a fast
        first-layer gate, not the authoritative one. The durable ledger
        (see ``_durable_seen``) is what makes dedupe survive a restart.
        """
        now = time.time()
        for eid in [k for k, ts in self._seen.items() if now - ts > 3600]:
            del self._seen[eid]
        if event_id in self._seen:
            return False
        self._seen[event_id] = now
        return True

    async def _durable_seen(self, event_id: str, event_type: str) -> bool:
        """Consult the service's durable ledger, if one is installed.

        Falls back to True (treat as new) when no ledger is installed or the
        ledger call fails, so a service that has not opted in — or a transient
        DB error — never blocks delivery. When installed, this is what makes
        dedupe survive a process restart: a redelivered event whose event_id
        is already in ``consumed_events`` returns False and is skipped.
        """
        from src.services.event_bus.dedupe import durable_seen
        return await durable_seen(event_id, event_type)


bus = EventBus()
