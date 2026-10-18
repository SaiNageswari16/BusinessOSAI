"""Probe the whole platform: Redis, Postgres, every service, every DB.

One command answers "what is actually running?" without cross-referencing
run_services.py status against the logs:

    cd backend && python scripts/probe_infra.py

Reads the service registry rather than hardcoding ports, so it stays correct
as services are added. Each service is also classified as *implemented* (has a
real src/services/<name>/main.py) or *stub* (registered but not yet built), so
a down service is never misread as a broken one.

Exit code 0 only when Redis is up, every implemented service is listening, and
every expected database exists. Read-only: opens TCP sockets, GETs /health,
lists databases. Never mutates anything.
"""
from __future__ import annotations

import asyncio
import json
import os
import socket
import sys
import urllib.error
import urllib.request

# Backend root. This script sits in backend/scripts/, so it must add backend/
# to sys.path itself to import the src package — running it from backend/ does
# not do so automatically.
_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND)

from src.services.shared.registry import ServiceDescriptor, all_services  # noqa: E402

TIMEOUT = 2.0

# The gateway is deliberately not in the service registry — it routes to the
# others rather than being one of them. Declare it separately here.
_GATEWAY = ServiceDescriptor(
    name="gateway", port=8000, db_name="",
    description="edge", permissions=(),
)


def _services() -> list[ServiceDescriptor]:
    names = {s.name for s in all_services()}
    return ([_GATEWAY] if "gateway" not in names else []) + list(all_services())


def _implemented(svc: ServiceDescriptor) -> bool:
    """True if src/services/<name>/main.py exists — i.e. it is really built."""
    return bool(os.path.exists(
        os.path.join(os.path.dirname(os.path.abspath(__file__)),
                     "..", "src", "services", svc.name, "main.py")
    ))


def _port(host: str, port: int) -> bool:
    with socket.socket() as s:
        s.settimeout(TIMEOUT)
        return s.connect_ex((host, port)) == 0


def _health(url: str) -> tuple[int | None, dict]:
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, {}
    except Exception:
        return None, {}


async def _databases() -> set[str] | None:
    """All non-template databases, or None if Postgres is unreachable."""
    import asyncpg
    conn = await asyncpg.connect(
        host="127.0.0.1", port=5432, user="postgres", database="postgres"
    )
    try:
        rows = await conn.query(
            "SELECT datname FROM pg_database WHERE datistemplate = false"
        )
        return {r[0] for r in rows}
    finally:
        await conn.close()


def main() -> int:
    print("=" * 74)
    print("RestaurantOS infrastructure probe")
    print("=" * 74)

    redis_up = _port("127.0.0.1", 6379)
    pg_up = _port("127.0.0.1", 5432)
    print("\nInfrastructure")
    print(f"  redis    127.0.0.1:6379   {'UP' if redis_up else 'DOWN  (event bus runs in-process only)'}")
    print(f"  postgres 127.0.0.1:5432   {'UP' if pg_up else 'DOWN'}")

    services = _services()
    entries = []
    for svc in services:
        up = _port("127.0.0.1", svc.port)
        body = {}
        status = None
        if up:
            status, body = _health(f"http://127.0.0.1:{svc.port}/health")
        entries.append((svc, up, status, body))

    implemented = [e for e in entries if _implemented(e[0])]
    stubs = [e for e in entries if not _implemented(e[0])]

    print(f"\n{'service':<14}{'port':>6}  {'listen':<8}{'http':<6}{'db':<10}{'bus':<10}{'kind'}")
    print("-" * 74)
    live_impl = 0
    for svc, up, status, body in entries:
        kind = "built" if _implemented(svc) else "stub"
        if not up:
            print(f"{svc.name:<14}{svc.port:>6}  {'down':<8}{'-':<6}{'-':<10}{'-':<10}{kind}")
            continue
        live_impl += 1 if _implemented(svc) else 0
        ms = body.get("latency_ms")
        print(
            f"{svc.name:<14}{svc.port:>6}  {'up':<8}{str(status):<6}"
            f"{str(body.get('database', '?')):<10}{str(body.get('event_bus', '?')):<10}"
            f"{kind} {ms if ms is not None else ''}"
        )

    # ── databases ─────────────────────────────────────────────────────────
    print(f"\nDatabases (checking all {len(implemented)} built services, "
          f"live or not)")
    missing: list[str] = []
    if pg_up:
        names = asyncio.run(_databases()) or set()
        for svc, _up, _st, _bd in implemented:
            if not svc.db_name:
                continue
            present = svc.db_name in names
            print(f"  {svc.db_name:<28}{'exists' if present else 'MISSING'}")
            if not present:
                missing.append(svc.db_name)
        extra = sorted(
            n for n in names
            if n.startswith("restaurantos") and n not in {s.db_name for s, *_ in implemented}
        )
        if extra:
            print(f"  (other restaurantos DBs: {', '.join(extra)})")
    else:
        print("  skipped — postgres is down")

    print(f"\nBuilt: {len(implemented)}   Stubs (not yet implemented): {len(stubs)}")
    if stubs:
        print("  stubs: " + ", ".join(s.name for s, *_ in stubs))
    print(f"Listening: {live_impl}/{len(implemented)} built services")

    problems = []
    if not redis_up:
        problems.append("redis down — cross-service events are lost between processes")
    if not pg_up:
        problems.append("postgres down")
    down_impl = [s.name for s, up, *_ in implemented if not up]
    if down_impl:
        problems.append("built services not listening: " + ", ".join(down_impl))
    if missing:
        problems.append("missing databases: " + ", ".join(missing))

    print("=" * 74)
    if problems:
        for p in problems:
            print(f"  ! {p}")
        return 1
    print("  all clear")
    return 0


if __name__ == "__main__":
    sys.exit(main())
