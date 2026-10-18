"""Verify each service's schema is isolated to its own database.

Checks two things:

  1. **Metadata isolation** — two services' models must land in two separate
     registries. If they share one, a single ``create_all()`` emits every
     service's DDL into every database, which is how the org and menu databases
     each ended up with the same 18 tables.
  2. **Database contents** — every table actually present in a service's
     database must be one that service owns.

Usage:  python scripts/verify_schema.py
"""
from __future__ import annotations

import asyncio
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine  # noqa: E402

from src.config import get_settings  # noqa: E402
from src.services.shared.registry import all_services  # noqa: E402
from src.services.shared.schema_bootstrap import _service_tables  # noqa: E402
from src.services.shared.service_db import service_base  # noqa: E402

PROBLEMS: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}" + (f" — {detail}" if detail else ""))
    if not ok:
        PROBLEMS.append(label)


def check_metadata_isolation(owned: dict[str, list[str]]) -> None:
    print("\n1. Metadata isolation (no table in two services' registries)")
    print("-" * 70)
    owners: dict[str, list[str]] = {}
    for name, tables in owned.items():
        for t in tables:
            owners.setdefault(t, []).append(name)
    overlaps = {t: d for t, d in owners.items() if len(d) > 1}
    check("no table registered by two services", not overlaps,
          f"{len(overlaps)} overlapping: {overlaps}" if overlaps else
          f"{sum(len(v) for v in owned.values())} tables across "
          f"{len([k for k, v in owned.items() if v])} services")


async def check_database_contents(owned: dict[str, list[str]]) -> None:
    print("\n2. Database contents (each database holds only its own tables)")
    print("-" * 70)
    s = get_settings()
    base = (
        f"postgresql+asyncpg://{s.postgres_user}:{s.postgres_password}"
        f"@{s.postgres_host}:{s.postgres_port}"
    )
    for d in all_services():
        tables = owned.get(d.name) or []
        engine = create_async_engine(
            f"{base}/{d.db_name}", isolation_level="AUTOCOMMIT"
        )
        try:
            async with engine.connect() as conn:
                rows = await conn.execute(
                    text("SELECT tablename FROM pg_tables "
                         "WHERE schemaname = 'public'")
                )
                present = {r[0] for r in rows}
        except Exception as exc:  # noqa: BLE001
            check(f"{d.name}: database reachable", False, str(exc))
            await engine.dispose()
            continue
        await engine.dispose()

        if not tables:
            # Unimplemented service: an empty database is fine, a non-empty
            # one means something leaked into it.
            check(f"{d.name}: database empty (no models yet)", not present,
                  f"unexpected: {sorted(present)}" if present else "")
            continue

        foreign = sorted(present - set(tables))
        missing = sorted(set(tables) - present)
        check(f"{d.name}: no foreign tables", not foreign, str(foreign))
        check(f"{d.name}: all {len(tables)} own tables present", not missing,
              f"missing: {missing}" if missing else "")


async def main() -> int:
    print("Importing every service's models…")
    owned = _service_tables()
    for name, tables in sorted(owned.items()):
        mark = "no models" if not tables else f"{len(tables)} tables"
        print(f"  {name:14s} {mark}")

    check_metadata_isolation(owned)
    await check_database_contents(owned)

    print("\n" + "=" * 70)
    if PROBLEMS:
        print(f"{len(PROBLEMS)} problem(s):")
        for p in PROBLEMS:
            print(f"  - {p}")
        print("\nFix with:  python scripts/bootstrap_schema.py --prune")
        return 1
    print("OK — every service's schema is isolated to its own database.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
