"""Create each service's database and tables before the service boots.

Why this module exists
----------------------
``ServiceDatabase.create_all()`` emits ``CREATE TABLE`` — but nothing ever
called it, and Postgres will not let you ``CREATE TABLE`` inside a database
that does not exist. The net effect was that every service connected to an
empty cluster and every query failed with ``relation "..." does not exist``,
which the request middleware turned into a 500.

Two things are therefore needed, and this module does both:

  1. ``CREATE DATABASE`` — Postgres has no ``IF NOT EXISTS`` for it and refuses
     to run it inside a transaction, so this connects to the ``postgres``
     maintenance database and checks ``pg_database`` first.
  2. ``create_all()`` limited to *that service's* tables.

The isolation problem
---------------------
``ServiceBase`` used to be one shared ``DeclarativeBase``, which meant one
``metadata`` object, which meant importing two services' models into the same
process registered **both** services' tables in that single metadata. Calling
``create_all()`` then emitted DDL for every table it had ever seen — so the
menu database and the organization database each ended up with the same 18
tables, including each other's.

Each service's models now register on the base returned by
``service_base(<name>)``, which has its own metadata *and* its own mapper
registry, so the tables no longer mix. This module therefore creates each
service's tables from *that service's* metadata and nothing else. See the
docstring on ``service_base`` for why neither a shared base nor a plain
subclass of one can provide this isolation.
"""
from __future__ import annotations

import importlib
import logging

from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine

from src.services.shared.registry import ServiceDescriptor, all_services

logger = logging.getLogger(__name__)

# Connect to Postgres's built-in maintenance database — the only database that
# is guaranteed to exist, and the only one you can be connected to in order to
# create another.
_MAINTENANCE_DB = "postgres"


def _maint_dsn(user: str, password: str, host: str, port: int) -> str:
    return f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{_MAINTENANCE_DB}"


def _service_dsn(user: str, password: str, host: str, port: int, db_name: str) -> str:
    return f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{db_name}"


async def database_exists(
    user: str, password: str, host: str, port: int, db_name: str
) -> bool:
    """Is ``db_name`` present on this cluster?"""
    engine = create_async_engine(
        _maint_dsn(user, password, host, port), isolation_level="AUTOCOMMIT"
    )
    try:
        async with engine.connect() as conn:
            row = await conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": db_name}
            )
            return row.scalar() is not None
    finally:
        await engine.dispose()


async def create_database(
    user: str, password: str, host: str, port: int, db_name: str
) -> bool:
    """Create ``db_name``. Returns True if it created it, False if it already
    existed.

    AUTOCOMMIT matters: ``CREATE DATABASE`` is one of the few statements
    Postgres refuses to run inside a transaction block, and SQLAlchemy opens
    one implicitly on ``begin()``.
    """
    if await database_exists(user, password, host, port, db_name):
        return False

    # Quote the identifier — a db name with a hyphen would otherwise be a
    # syntax error. Names here are controlled, but the quoting is free.
    engine = create_async_engine(
        _maint_dsn(user, password, host, port), isolation_level="AUTOCOMMIT"
    )
    try:
        async with engine.connect() as conn:
            await conn.execute(text(f'CREATE DATABASE "{db_name}"'))
        logger.info("Created database %s", db_name)
        return True
    finally:
        await engine.dispose()


def _service_tables() -> dict[str, list[str]]:
    """Map service name -> the table names its own models module registers.

    Each service's ``models.py`` registers its tables on the ``ServiceBase``
    subclass returned by ``service_base(<name>)``, whose metadata belongs to
    that service alone — so importing several services' models into one
    process does not mix their tables. That is what keeps ``create_all`` from
    emitting another service's DDL.

    A service whose models module is missing or fails to import gets an empty
    list: a broken or unimplemented service must not stop the others from
    getting a schema.
    """
    owned: dict[str, list[str]] = {}
    for descriptor in all_services():
        try:
            importlib.import_module(f"src.services.{descriptor.name}.models")
        except ModuleNotFoundError:
            logger.info("Service '%s' has no models module yet", descriptor.name)
            owned[descriptor.name] = []
            continue
        except Exception as exc:  # noqa: BLE001
            logger.error("Could not import models for '%s': %s", descriptor.name, exc)
            owned[descriptor.name] = []
            continue
        from src.services.shared.service_db import service_base

        metadata = service_base(descriptor.name).metadata
        owned[descriptor.name] = sorted(metadata.tables.keys())
    return owned


async def create_tables(service_name: str, dsn: str, table_names: list[str]) -> int:
    """Create the named tables, ignoring ones that already exist.

    ``create_all`` handles ordering via the metadata's dependency graph, so
    rather than emitting individual CREATEs this restricts it to the tables
    named — which preserves that ordering. ``checkfirst`` keeps it idempotent.
    """
    from src.services.shared.service_db import service_base

    metadata = service_base(service_name).metadata
    targets = [metadata.tables[n] for n in table_names if n in metadata.tables]
    engine = create_async_engine(dsn)
    try:
        async with engine.begin() as conn:
            # Count what exists *before* creating, so the return value means
            # "how many were missing" rather than "how many exist".
            #
            # ``Inspector.has_table`` is the supported existence check — a
            # ``Table`` object has no ``exists()`` of its own. It needs the
            # schema name to look in; ``Table.schema`` is None for these, which
            # the inspector resolves to the connection's default schema.
            def _count_missing(sync_conn) -> int:
                inspector = inspect(sync_conn)
                return sum(
                    1 for t in targets if not inspector.has_table(t.name, t.schema)
                )

            before = await conn.run_sync(_count_missing)
            # create_all's ``tables=`` restricts the DDL to the named subset
            # while keeping the metadata's dependency ordering. Passing nothing
            # creates every table in the metadata — exactly the
            # cross-contamination this module exists to avoid.
            await conn.run_sync(metadata.create_all, tables=targets)
            return before
    finally:
        await engine.dispose()


async def bootstrap_service(
    descriptor: ServiceDescriptor,
    *,
    user: str,
    password: str,
    host: str,
    port: int,
    tables: list[str] | None = None,
) -> dict:
    """Ensure one service's database exists and holds its own tables."""
    name = descriptor.name
    result: dict = {
        "service": name,
        "database": descriptor.db_name,
        "db_created": False,
        "tables": [],
    }

    created = await create_database(user, password, host, port, descriptor.db_name)
    result["db_created"] = created

    if tables is None:
        tables = []
    if not tables:
        result["tables"] = None  # signals "no models" rather than "no tables"
        return result

    dsn = _service_dsn(user, password, host, port, descriptor.db_name)
    await create_tables(name, dsn, tables)
    result["tables"] = sorted(tables)
    return result


async def bootstrap_all(
    *,
    user: str,
    password: str,
    host: str,
    port: int,
    only: list[str] | None = None,
    prune: bool = False,
) -> list[dict]:
    """Create the databases and tables for every implemented service.

    ``prune=True`` also drops tables that a service does not own — the repair
    for a database created with the wrong tables. It never drops a table the
    service owns, so the service's own data survives.
    """
    owned = _service_tables()
    results: list[dict] = []
    for descriptor in all_services():
        if only and descriptor.name not in only:
            continue
        tables = owned.get(descriptor.name, [])
        dsn = _service_dsn(user, password, host, port, descriptor.db_name)
        result: dict = {
            "service": descriptor.name,
            "database": descriptor.db_name,
            "db_created": False,
            "tables": sorted(tables) if tables else None,
            "pruned": [],
        }
        try:
            result["db_created"] = await create_database(
                user, password, host, port, descriptor.db_name
            )
            if prune:
                result["pruned"] = await prune_foreign_tables(dsn, tables)
            if tables:
                await create_tables(descriptor.name, dsn, tables)
            results.append(result)
        except Exception as exc:  # noqa: BLE001
            # One service failing must not block the rest of the fleet.
            logger.error("Bootstrap failed for '%s': %s", descriptor.name, exc)
            results.append({"service": descriptor.name,
                            "database": descriptor.db_name,
                            "error": str(exc)})
    return results


async def prune_foreign_tables(dsn: str, owned: list[str]) -> list[str]:
    """Drop tables in this database that this service does not own.

    This is the repair for the cross-contamination described at the top of this
    module: a previous ``create_all()`` ran with every service's models
    imported, so each database received the union of all services' tables.

    It is deliberately targeted — it drops only tables that are NOT in
    ``owned``. Tables that belong to the service are never touched, so a
    database whose data is fine keeps its data. Tables belonging to a service
    that has not been implemented yet are left alone too: an empty table is
    harmless, whereas a service that later gains models would otherwise have
    them silently removed.
    """
    engine = create_async_engine(dsn, isolation_level="AUTOCOMMIT")
    try:
        async with engine.connect() as conn:
            rows = await conn.execute(
                text("SELECT tablename FROM pg_tables "
                     "WHERE schemaname = 'public'")
            )
            present = [r[0] for r in rows]
            owned_set = set(owned)
            foreign = [t for t in present if t not in owned_set]
            for name in foreign:
                # CASCADE: FK links between tables mean a dependent table has
                # to go with its parent.
                await conn.execute(text(f'DROP TABLE IF EXISTS "{name}" CASCADE'))
                logger.info("Dropped foreign table %s", name)
            return foreign
    finally:
        await engine.dispose()


async def drop_all_tables(dsn: str) -> int:
    """Drop every table in ``public``. Used only by ``reset=True``."""
    engine = create_async_engine(dsn, isolation_level="AUTOCOMMIT")
    try:
        async with engine.connect() as conn:
            rows = await conn.execute(
                text("SELECT tablename FROM pg_tables "
                     "WHERE schemaname = 'public'")
            )
            names = [r[0] for r in rows]
            if not names:
                return 0
            # CASCADE handles FK links between them; DROP ... IF EXISTS keeps
            # it idempotent if two tables reference each other.
            for n in names:
                await conn.execute(text(f'DROP TABLE IF EXISTS "{n}" CASCADE'))
            return len(names)
    finally:
        await engine.dispose()


def _report(results: list[dict]) -> None:
    print(f"\n{'service':16s} {'database':32s} {'db':8s} {'tables':>6s} pruned")
    print("-" * 82)
    for r in results:
        if "error" in r:
            print(f"{r['service']:16s} {r['database']:32s} {'FAILED':8s} {r['error']}")
            continue
        tables = r.get("tables")
        if tables is None:
            count, detail = "—", "no models yet"
        else:
            count = str(len(tables))
            detail = ", ".join(tables[:6]) + ("…" if len(tables) > 6 else "")
        db_state = "created" if r["db_created"] else "exists"
        pruned = r.get("pruned") or []
        pruned_str = f"{len(pruned)}" if pruned else ""
        print(f"{r['service']:16s} {r['database']:32s} {db_state:8s} {count:>6s} {pruned_str:>7s}  {detail}")
