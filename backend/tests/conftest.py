"""Shared pytest setup for microservice tests.

Two things every service-level test needs, in one place:

* **SQLite type shims** — the service's models declare Postgres-only column
  types (JSONB, UUID, Numeric) because that's what production runs. Tests
  build the schema against in-memory SQLite instead, which needs a
  compiler hook to render those types. ``_register_sqlite_type_shims`` is
  idempotent; call it once per test module before creating the schema.

* **Service-isolated schema creation** — each service's models register on
  a service-specific declarative base (``service_base("<name>")``, see
  ``shared/service_db.py``), so importing one service's models module is
  enough to get its own metadata without pulling in any other service's
  tables. ``_service_db("org", "src.services.organization.models")`` turns
  that into a ready-to-use SQLite engine + factory + table fixtures.

Import the service's models module *before* calling ``_service_db`` — that
import is what puts the tables on the service's metadata.
"""
from __future__ import annotations

import uuid as _uuid

from sqlalchemy.ext import compiler as _sql_compiler
from sqlalchemy.dialects.postgresql import JSONB as _JSONB
from sqlalchemy.dialects.postgresql import UUID as _UUID
from sqlalchemy import Numeric as _Numeric
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

import pytest_asyncio

_SHIMMED = False


def _register_sqlite_type_shims() -> None:
    """Teach the SQLite dialect to render Postgres-only column types.

    Without this, ``create_all`` on a service's metadata fails immediately
    on the first JSONB/UUID/Numeric column with "Compiler can't render
    element of type JSONB". The shims keep the production models unchanged
    and only affect how tests render their DDL.
    """
    global _SHIMMED
    if _SHIMMED:
        return

    @_sql_compiler.compiles(_UUID, "sqlite")
    def _uuid_sqlite(type_, compiler_, **kw):
        return "TEXT"

    @_sql_compiler.compiles(_JSONB, "sqlite")
    def _jsonb_sqlite(type_, compiler_, **kw):
        return "TEXT"

    @_sql_compiler.compiles(_Numeric, "sqlite")
    def _numeric_sqlite(type_, compiler_, **kw):
        return "REAL"

    _SHIMMED = True


def _service_db(service_name: str, models_module: str):
    """Return ``(engine, _tables_fixture, db_fixture)`` for one service's tests.

    ``_tables`` is an ``autouse`` async fixture that creates the service's own
    tables before each test and drops them after. ``db`` is an async fixture
    yielding a session bound to that engine. Both are ready to use in the
    test module that calls this at import time.
    """
    import importlib

    # Importing the models module is what registers its tables on the
    # service's own declarative base — do it before touching that base.
    importlib.import_module(models_module)

    _register_sqlite_type_shims()

    from src.services.shared.service_db import service_base

    metadata = service_base(service_name).metadata
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @pytest_asyncio.fixture(autouse=True)
    async def _tables():
        async with engine.begin() as conn:
            await conn.run_sync(metadata.create_all)
        yield
        async with engine.begin() as conn:
            await conn.run_sync(metadata.drop_all)

    @pytest_asyncio.fixture
    async def db():
        factory = async_sessionmaker(
            bind=engine, class_=AsyncSession, expire_on_commit=False
        )
        async with factory() as session:
            yield session

    return engine, _tables, db
