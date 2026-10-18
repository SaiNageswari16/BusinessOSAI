"""One-off: seed the organization service's database from the legacy shared DB.

In the microservices split each service owns its own database. The legacy
monolith kept everything in ``restaurantos``. This copies the organization
slice (tenants, outlets, sections, tables, UoM, cost centres) across so the
new service has real data to serve.

Idempotent — safe to re-run. Existing rows are matched by id and skipped.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sqlalchemy import select  # noqa: E402

from src.config import get_settings  # noqa: E402
from src.services.organization import models as org  # noqa: E402
from src.services.shared.service_db import ServiceDatabase, service_base  # noqa: E402
from src.services.shared.registry import get_descriptor  # noqa: E402


async def seed() -> None:
    s = get_settings()

    legacy_dsn = (
        f"postgresql+asyncpg://{s.postgres_user}:{s.postgres_password}"
        f"@{s.postgres_host}:{s.postgres_port}/{s.postgres_db}"
    )
    legacy = ServiceDatabase("legacy", legacy_dsn)
    descriptor = get_descriptor("organization")
    org_dsn = (
        f"postgresql+asyncpg://{s.postgres_user}:{s.postgres_password}"
        f"@{s.postgres_host}:{s.postgres_port}/{descriptor.db_name}"
    )
    target = ServiceDatabase("organization", org_dsn)

    # Only the organization service's own tables.
    #
    # ``ServiceBase.metadata`` is shared across every service imported into
    # this process, and this script imports the legacy models too — so a bare
    # ``ServiceBase.metadata.create_all`` here creates the union of all
    # services' tables in the organization database. That is how the org and
    # menu databases each ended up with the same 18 tables. Each service's
    # models now register on its own base, so use that one.
    org_metadata = service_base("organization").metadata
    async with target.engine.begin() as conn:
        await conn.run_sync(org_metadata.create_all)

    # The legacy models live on a different DeclarativeBase; import them
    # through the legacy package so their metadata is registered there.
    from src.models import (
        CostCenter as LegacyCostCenter,
    )
    from src.models import (
        Outlet as LegacyOutlet,
    )
    from src.models import (
        RestaurantTable as LegacyTable,
    )
    from src.models import (
        Section as LegacySection,
    )
    from src.models import (
        Tenant as LegacyTenant,
    )
    from src.models import (
        UnitOfMeasure as LegacyUom,
    )

    pairs = [
        ("tenants", LegacyTenant, org.Tenant),
        ("outlets", LegacyOutlet, org.Outlet),
        ("sections", LegacySection, org.Section),
        ("tables", LegacyTable, org.RestaurantTable),
        ("cost_centers", LegacyCostCenter, org.CostCenter),
        ("units_of_measure", LegacyUom, org.UnitOfMeasure),
    ]

    async with legacy.session_factory() as src, target.session_factory() as dst:
        for label, legacy_model, org_model in pairs:
            rows = list((await src.execute(select(legacy_model))).scalars().all())
            if not rows:
                print(f"  {label:16s} 0 rows in legacy — nothing to copy")
                continue

            existing = {
                r for r in (
                    await dst.execute(select(org_model.id))
                ).scalars().all()
            }
            copied = 0
            for row in rows:
                if row.id in existing:
                    continue
                data = {
                    c.key: getattr(row, c.key)
                    for c in org_model.__table__.columns
                    if c.key != "id" and hasattr(row, c.key)
                }
                data["id"] = row.id
                dst.add(org_model(**data))
                copied += 1
            await dst.commit()
            print(f"  {label:16s} {copied} copied ({len(rows)} in legacy)")

    await legacy.dispose()
    await target.dispose()
    print("organization service seeded")


if __name__ == "__main__":
    asyncio.run(seed())
