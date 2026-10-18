"""Create every service's database and tables.

Usage:
    conda activate sales
    python scripts/bootstrap_schema.py                # all services
    python scripts/bootstrap_schema.py menu org       # only named services
    python scripts/bootstrap_schema.py --prune        # repair wrong schemas

``--prune`` drops tables a service does not own — the repair for a database
that was created with every service's tables in it. It never drops a table the
service owns, so that service's own data survives.

Idempotent without ``--prune``: ``CREATE TABLE`` only creates what is missing
and never drops or alters what exists, so running this against a populated
database leaves the data alone.

Why this exists as its own script: Postgres will not let you ``CREATE TABLE``
in a database that doesn't exist, and each service points at its own database.
This creates the databases first, then each service's own tables in it. See
``src/services/shared/schema_bootstrap.py`` for the details — including why a
naive ``create_all()`` creates every service's tables in every database.
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from src.config import get_settings  # noqa: E402
from src.services.shared.schema_bootstrap import (  # noqa: E402
    _report,
    bootstrap_all,
)


async def main(argv: list[str]) -> int:
    prune = "--prune" in argv
    names = [a for a in argv if not a.startswith("--")] or None
    if prune:
        print("!! --prune: dropping tables each service does not own")
    s = get_settings()
    print(f"Connecting to Postgres at {s.postgres_host}:{s.postgres_port} "
          f"as '{s.postgres_user}'")
    results = await bootstrap_all(
        user=s.postgres_user,
        password=s.postgres_password,
        host=s.postgres_host,
        port=s.postgres_port,
        only=names,
        prune=prune,
    )
    _report(results)
    return 1 if any("error" in r for r in results) else 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(levelname)-8s | %(name)s | %(message)s")
    raise SystemExit(asyncio.run(main(sys.argv[1:])))
