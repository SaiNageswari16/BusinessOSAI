"""List the tables actually present in each service database.

Verifies the one-database-per-service boundary: each service's database should
contain only that service's tables. Anything shared between two services is a
leak.

Usage:  python scripts/list_tables.py
"""
from __future__ import annotations

import asyncio
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from src.config import get_settings  # noqa: E402
from src.services.shared.registry import all_services  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine  # noqa: E402


async def tables_in(engine, db_name: str) -> list[str]:
    async with engine.connect() as conn:
        rows = await conn.execute(
            text(
                "SELECT tablename FROM pg_tables "
                "WHERE schemaname = 'public' ORDER BY tablename"
            )
        )
        return [r[0] for r in rows]


async def main() -> int:
    s = get_settings()
    base = f"postgresql+asyncpg://{s.postgres_user}:{s.postgres_password}@{s.postgres_host}:{s.postgres_port}"

    owners: dict[str, list[str]] = {}   # table -> [databases it appears in]
    per_db: dict[str, list[str]] = {}

    for d in all_services():
        engine = create_async_engine(f"{base}/{d.db_name}")
        try:
            t = await tables_in(engine, d.db_name)
        except Exception as exc:  # noqa: BLE001
            t = [f"<error: {exc}>"]
        finally:
            await engine.dispose()
        per_db[d.name] = t
        for name in t:
            if not name.startswith("<"):
                owners.setdefault(name, []).append(d.name)

    print(f"\n{'service':16s} {'#':>3s}  tables")
    print("-" * 78)
    for name, t in per_db.items():
        shown = ", ".join(t[:5]) + (f" …(+{len(t)-5})" if len(t) > 5 else "")
        print(f"{name:16s} {len(t):>3d}  {shown}")

    leaks = {tbl: dbs for tbl, dbs in owners.items() if len(dbs) > 1}
    print("\n" + "=" * 78)
    if leaks:
        print(f"LEAK — {len(leaks)} table(s) present in more than one database:\n")
        for tbl, dbs in sorted(leaks.items()):
            print(f"  {tbl:32s} in {', '.join(dbs)}")
        return 1
    print("OK — no table appears in more than one service database.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
