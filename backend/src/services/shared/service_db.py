"""Service-local database — one database per microservice.

Each service points at its OWN database. Cross-service data is reached by
HTTP call through the gateway, never by a foreign key. This module provides
the engine/session factory each service uses, driven by that service's
descriptor.
"""
from __future__ import annotations

import logging
from collections.abc import AsyncGenerator

from sqlalchemy import MetaData, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, declarative_base

logger = logging.getLogger(__name__)


class ServiceBase(DeclarativeBase):
    """Fallback base for code that imports models without naming a service.

    Do **not** map tables onto this one directly. Everything mapped here lands
    in a single shared ``MetaData``, so a ``create_all()`` against it emits
    every service's DDL into whatever database it is pointed at — which is how
    the organization and menu databases each ended up with the same 18 tables.

    Use :func:`service_base` instead. It returns a base whose metadata belongs
    to one service alone, which is what actually enforces the boundary. This
    class exists only so that shared helpers have something to type against.
    """


_BASES: dict[str, type[DeclarativeBase]] = {}


def service_base(service_name: str) -> type[DeclarativeBase]:
    """Return this service's own declarative base, with its own registry.

    Both halves matter, and neither works by accident:

    * A fresh ``MetaData``. SQLAlchemy resolves ``metadata`` by attribute
      lookup on the class, so a plain subclass of an existing base *inherits*
      that base's ``MetaData`` — every service's tables would land in one
      shared registry, and a single ``create_all()`` would emit all of their
      DDL into whatever database it was pointed at. That inheritance is the
      bug this function exists to avoid.
    * A fresh ``registry``. Passing ``cls=ServiceBase`` to
      ``declarative_base`` keeps the parent's registry, so a model class gets
      a primary mapper twice and import fails with "already has a primary
      mapper defined".

    Bases are cached by name so two imports of the same service's models get
    the same base and therefore the same registry; two distinct bases would
    mean the second one's tables are invisible to ``create_all``.
    """
    if service_name not in _BASES:
        _BASES[service_name] = declarative_base(
            metadata=MetaData(),
            name=f"{service_name.title()}ServiceBase",
        )
    return _BASES[service_name]


def build_dsn(
    user: str,
    password: str,
    host: str,
    port: int,
    db_name: str,
) -> str:
    return f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{db_name}"


def create_service_engine(dsn: str, **kw) -> AsyncEngine:
    """One engine per service process. Pooled, pre-pinged, quiet."""
    return create_async_engine(
        dsn,
        echo=False,
        pool_pre_ping=True,
        pool_recycle=1800,
        pool_size=kw.get("pool_size", 10),
        max_overflow=kw.get("max_overflow", 20),
        pool_timeout=30,
    )


class ServiceDatabase:
    """Owns the engine and session factory for one service."""

    def __init__(self, service_name: str, dsn: str) -> None:
        self.service_name = service_name
        self.dsn = dsn
        self.engine: AsyncEngine = create_service_engine(dsn)
        self.session_factory = async_sessionmaker(
            bind=self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
            autocommit=False,
        )

    async def health(self) -> bool:
        try:
            async with self.engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            return True
        except Exception:
            return False

    async def create_all(self) -> None:
        """Create this service's own tables.

        Uses this service's metadata — not the shared ``ServiceBase`` one — so
        the DDL can never include another service's tables. Import the
        service's models module first (``src.services.<name>.models``); that's
        what registers the tables.

        The caller must import the models before calling this. Without them
        this service's metadata is empty and ``create_all`` is a no-op, which
        would silently leave the database without a schema.
        """
        metadata = service_base(self.service_name).metadata
        if not metadata.tables:
            logger.warning(
                "Service '%s' has no tables registered — did its models module "
                "get imported before create_all()?", self.service_name,
            )
        async with self.engine.begin() as conn:
            await conn.run_sync(metadata.create_all)

    async def dispose(self) -> None:
        await self.engine.dispose()

    def session(self) -> AsyncSession:
        return self.session_factory()


async def session_scope(db: ServiceDatabase) -> AsyncGenerator[AsyncSession, None]:
    """Transaction-per-request. Commits on success, rolls back on error."""
    async with db.session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
