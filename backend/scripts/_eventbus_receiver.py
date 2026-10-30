"""Receiver half of scripts/probe_eventbus.py.

Subscribes to one topic, waits for one event, prints the marker it received
and exits 0. Any other outcome — timeout, or a Redis/connection error before
we ever get the event — exits non-zero so the parent probe can treat the exit
code as the verdict.

Run only via probe_eventbus.py:

    python _eventbus_receiver.py <topic> <expected_marker> <timeout_seconds>
"""
from __future__ import annotations

import asyncio
import os
import sys
import time

_BACKEND_ENV = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")


def _load_backend_env() -> None:
    """Load backend/.env into os.environ (no override of real env vars).

    The probe runs as a bare script that never imports src.config, so the
    settings module's load_dotenv() never ran — without this, REDIS_URL
    silently falls back to the built-in default and can disagree with what
    the actual services use.
    """
    try:
        with open(_BACKEND_ENV, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key, value = key.strip(), value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
    except FileNotFoundError:
        pass


async def run(topic: str, marker: str, timeout: float) -> int:
    from src.services.event_bus.bus import bus

    received: list[str] = []

    async def handler(event):
        got = event.data.get("marker")
        received.append(got)

    bus.subscribe(topic, handler)
    # Its own group, not the publisher's: a shared group would let Redis hand
    # the event to whichever consumer polled first instead of delivering it
    # here.
    _load_backend_env()
    import os; bus.configure(os.environ.get("REDIS_URL", "redis://localhost:6379/0"), "eventbus-receiver")
    await bus.start()

    print(f"  receiver on '{topic}' — redis={'up' if bus.redis_available else 'DOWN'}")

    deadline = time.time() + timeout
    while time.time() < deadline and not received:
        await asyncio.sleep(0.2)

    await bus.stop()

    if received and received[0] == marker:
        print(f"  RECEIVED marker={received[0]}")
        return 0
    if received:
        print(f"  RECEIVED wrong marker={received[0]!r}, expected {marker!r}")
        return 1
    print("  NO EVENT after timeout")
    return 1


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(f"usage: {sys.argv[0]} <topic> <expected_marker> <timeout_seconds>")
        sys.exit(2)
    try:
        sys.exit(asyncio.run(run(sys.argv[1], sys.argv[2], float(sys.argv[3]))))
    except Exception as exc:  # noqa: BLE001
        # A failure before we subscribed is as interesting as a timeout, and
        # the parent cannot see it otherwise — it only sees the exit code.
        print(f"  RECV ERROR {type(exc).__name__}: {exc}")
        sys.exit(1)
