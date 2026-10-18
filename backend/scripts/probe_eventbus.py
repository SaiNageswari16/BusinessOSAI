"""Prove the event bus actually carries an event between two processes.

This is the check that "services are up" cannot substitute for. Each service
runs in its own process with its own ``bus`` singleton, and the bus only
shuttles events between processes when Redis is present — without it,
``publish()`` goes into an in-memory buffer that dies with the process, and
``bus.stats()["delivered_local"]`` would still say the send worked. A publish
and a subscribe in the *same* process always "passes" and proves nothing, so
this deliberately forks two processes:

  * a receiver child that subscribes to a unique topic and prints on receipt
  * this process, which publishes one event to that topic

If Redis is running the event arrives via the Redis Stream consumer group and
the probe reports DELIVERED. If Redis is down the receiver never gets it and
the probe times out with instructions.

    cd backend && python scripts/probe_eventbus.py

Exit code: 0 delivered, 1 not delivered, 2 Redis down.
"""
from __future__ import annotations

import asyncio
import os
import socket
import subprocess
import sys
import time
import uuid

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND)

RECEIVER = os.path.join(_BACKEND, "scripts", "_eventbus_receiver.py")
TIMEOUT = 12.0


def _redis_up() -> bool:
    with socket.socket() as s:
        s.settimeout(2.0)
        return s.connect_ex(("127.0.0.1", 6379)) == 0


def _publish(topic: str, payload: dict) -> dict:
    """Publish one event from this process and return the bus's own stats."""
    async def run() -> dict:
        from src.services.event_bus.bus import Event, bus

        # Distinct group: each service gets its own consumer group so it owns
        # its own read cursor. Two processes sharing one group would load-balance
        # the event between them and at most one would see it.
        await bus.configure("redis://localhost:6379/0", "eventbus-probe")
        await bus.start()
        # Give the consumer group a moment to be registered before publishing,
        # so a race between xgroup_create and xadd cannot eat the event.
        await asyncio.sleep(0.5)
        await bus.publish(Event(
            type=topic,
            data=payload,
            source_service="eventbus-probe",
        ))
        return bus.stats()

    return asyncio.run(run())


def main() -> int:
    print("=" * 72)
    print("Event bus cross-process probe")
    print("=" * 72)
    print(f"  redis 127.0.0.1:6379   {'UP' if _redis_up() else 'DOWN'}")

    if not _redis_up():
        print("\nRedis is not running. Cross-process events cannot be delivered")
        print("until it is — each service's bus is a separate singleton, and")
        print("without Redis an event stays in the publisher's memory and dies")
        print("with the process. The receiver below would wait forever.")
        print("\nStart it, then rerun this probe:")
        print("  netstat -ano | findstr 6379        # is anything listening?")
        print("  redis-server                       # if the binary exists")
        print("  redis-server --daemonize yes")
        print("  redis.windows-service --service-start   # Windows service")
        print("  choco install redis-mjackson        # then redis-server")
        return 2

    topic = f"probe.delivery.{uuid.uuid4().hex[:12]}"
    marker = uuid.uuid4().hex

    # The receiver imports src.services.event_bus.bus, so backend/ must be on
    # its sys.path. PYTHONPATH passes that without spawning a shell.
    env = dict(os.environ, PYTHONPATH=_BACKEND)
    child = subprocess.Popen(
        [sys.executable, RECEIVER, topic, marker, str(TIMEOUT)],
        cwd=_BACKEND, env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
        creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
    )
    try:
        stats = _publish(topic, {"marker": marker})
        print(f"\n  publisher  published={stats['published']} "
              f"redis={'up' if stats['redis'] == 'up' else 'DOWN'}")

        # The receiver exits 0 only after printing the marker it received, so
        # its exit code is the verdict. Waiting on it also means a receiver
        # that crashed on import fails fast instead of timing out.
        deadline = time.time() + TIMEOUT
        while time.time() < deadline and child.poll() is None:
            time.sleep(0.3)
        rc = child.poll()

        # Kill first, then drain: reading a still-running child's pipe can
        # block until its buffer fills.
        child.terminate()
        try:
            out, _ = child.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            child.kill()
            out, _ = child.communicate()

        print(f"\n  receiver output: {(out or '').strip() or '(none)'}")

        print("\n" + "=" * 72)
        if rc == 0:
            print("  DELIVERED — the event crossed the process boundary via Redis")
        else:
            print(f"  NOT DELIVERED — receiver exited {rc} without receiving it")
            print("  Redis answered on :6379 but delivery failed. If the receiver")
            print("  printed nothing, it failed before subscribing — check the")
            print("  REDIS_URL in backend/.env matches what is actually listening.")
        print("=" * 72)
        return 0 if rc == 0 else 1
    finally:
        if child.poll() is None:
            child.terminate()
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()


if __name__ == "__main__":
    sys.exit(main())
