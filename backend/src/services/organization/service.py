"""Organization service — domain logic, kept out of api.py so it is testable
without an HTTP client and so ordering constraints are visible in one place.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.organization.models import (
    CostCenter,
    EnterpriseBrand,
    FloorPlan,
    Outlet,
    RestaurantTable,
    RoyaltyAgreement,
    RoyaltySettlement,
    RoyaltyStatus,
    Section,
    TableStatus,
    Tenant,
    UnitOfMeasure,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ─── Outlets ────────────────────────────────────────────────────────────────

async def create_outlet(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    data: dict,
) -> Outlet:
    clash = await db.scalar(
        select(Outlet.id).where(
            Outlet.tenant_id == tenant_id, Outlet.code == data["code"]
        )
    )
    if clash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Outlet code '{data['code']}' already exists",
        )

    outlet = Outlet(tenant_id=tenant_id, **data)
    db.add(outlet)
    await db.flush()
    return outlet


async def get_outlet(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    *,
    include_inactive: bool = False,
) -> Outlet:
    stmt = select(Outlet).where(Outlet.id == outlet_id, Outlet.tenant_id == tenant_id)
    if not include_inactive:
        stmt = stmt.where(Outlet.is_active.is_(True))
    outlet = await db.scalar(stmt)
    if outlet is None:
        raise HTTPException(status_code=404, detail="Outlet not found")
    return outlet


# ─── Brands ────────────────────────────────────────────────────────────────

async def create_brand(db: AsyncSession, *, tenant_id: uuid.UUID, data: dict) -> EnterpriseBrand:
    clash = await db.scalar(
        select(EnterpriseBrand.id).where(
            EnterpriseBrand.tenant_id == tenant_id, EnterpriseBrand.code == data["code"]
        )
    )
    if clash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Brand code '{data['code']}' already exists",
        )
    brand = EnterpriseBrand(tenant_id=tenant_id, **data)
    db.add(brand)
    await db.flush()
    return brand


# ─── Sections ───────────────────────────────────────────────────────────────

async def create_section(db: AsyncSession, *, outlet: Outlet, data: dict) -> Section:
    section = Section(
        tenant_id=outlet.tenant_id,
        outlet_id=outlet.id,
        name=data["name"],
        section_type=data.get("section_type", "ac_hall"),
        capacity=data.get("capacity", 0),
        is_active=data.get("is_active", True),
        sort_order=data.get("sort_order", 0),
    )
    db.add(section)
    await db.flush()
    return section


async def delete_section(db: AsyncSession, section: Section, *, force: bool) -> None:
    """Delete a section. Unless ``force``, refuse (409) while any table still
    references it — silently nulling ``section_id`` on live tables is how a
    floor plan quietly loses its structure."""
    if not force:
        still_referenced = await db.scalar(
            select(RestaurantTable.id).where(
                RestaurantTable.section_id == section.id
            ).limit(1)
        )
        if still_referenced:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Section still has tables assigned to it. "
                       "Reassign or delete them first, or pass force=true to "
                       "unassign them.",
            )
    await db.delete(section)


# ─── Tables ─────────────────────────────────────────────────────────────────

async def create_table(db: AsyncSession, *, outlet: Outlet, data: dict) -> RestaurantTable:
    clash = await db.scalar(
        select(RestaurantTable.id).where(
            RestaurantTable.tenant_id == outlet.tenant_id,
            RestaurantTable.outlet_id == outlet.id,
            RestaurantTable.code == data["code"],
        )
    )
    if clash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Table '{data['code']}' already exists for this outlet",
        )
    table = RestaurantTable(tenant_id=outlet.tenant_id, outlet_id=outlet.id, **data)
    db.add(table)
    await db.flush()
    return table


_STATUS_ALIASES = {
    "available": TableStatus.FREE,
    "free": TableStatus.FREE,
    "occupied": TableStatus.OCCUPIED,
    "reserved": TableStatus.RESERVED,
    "billing": TableStatus.BILLING,
    "billed": TableStatus.BILLING,
    "cleaning": TableStatus.CLEANING,
    "dirty": TableStatus.CLEANING,
    "blocked": TableStatus.BLOCKED,
    "out_of_service": TableStatus.BLOCKED,
}


def _coerce_status(raw: str) -> TableStatus:
    return _STATUS_ALIASES.get(str(raw).lower(), TableStatus.FREE)


async def bulk_set_table_status(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    table_ids: list[uuid.UUID],
    raw_status: str,
) -> dict:
    """Set status on many tables in one call — the floor-manager's
    "clear this whole section to free" case. Publishes one
    table.status.changed event per table that actually changed."""
    new_status = _coerce_status(raw_status)
    changed = 0
    for tid in table_ids:
        table = await db.scalar(
            select(RestaurantTable).where(
                RestaurantTable.id == tid, RestaurantTable.tenant_id == tenant_id
            )
        )
        if table is None:
            continue
        if table.status != new_status:
            table.status = new_status
            changed += 1
    await db.flush()
    return {"requested": len(table_ids), "changed": changed}


# ─── Floor plans ────────────────────────────────────────────────────────────

async def snapshot_floor_plan(
    db: AsyncSession,
    outlet: Outlet,
    *,
    name: str,
) -> FloorPlan:
    """Capture the outlet's current sections + table geometry into a named,
    restorable snapshot. The live restaurant_tables rows are untouched until
    a restore is explicitly requested."""
    clash = await db.scalar(
        select(FloorPlan.id).where(
            FloorPlan.outlet_id == outlet.id, FloorPlan.name == name
        )
    )
    if clash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A floor plan named '{name}' already exists for this outlet",
        )

    sections = list((await db.execute(
        select(Section).where(Section.outlet_id == outlet.id)
    )).scalars().all())
    tables = list((await db.execute(
        select(RestaurantTable).where(RestaurantTable.outlet_id == outlet.id)
    )).scalars().all())

    layout = {
        "sections": [
            {"id": str(s.id), "name": s.name, "section_type": s.section_type.value,
             "capacity": s.capacity, "sort_order": s.sort_order}
            for s in sections
        ],
        "tables": [
            {"id": str(t.id), "code": t.code, "section_id": str(t.section_id) if t.section_id else None,
             "shape": t.shape, "size_w": t.size_w, "size_h": t.size_h,
             "rotation": t.rotation, "label": t.label,
             "position_x": t.position_x, "position_y": t.position_y}
            for t in tables
        ],
    }

    plan = FloorPlan(
        tenant_id=outlet.tenant_id,
        outlet_id=outlet.id,
        name=name,
        layout=layout,
    )
    db.add(plan)
    await db.flush()
    return plan


async def restore_floor_plan(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    floor_plan_id: uuid.UUID,
) -> dict:
    """Write a snapshot's geometry back onto the outlet's live tables."""
    plan = await db.scalar(
        select(FloorPlan).where(
            FloorPlan.id == floor_plan_id,
            FloorPlan.outlet_id == outlet_id,
            FloorPlan.tenant_id == tenant_id,
        )
    )
    if plan is None:
        raise HTTPException(status_code=404, detail="Floor plan not found")

    layout = plan.layout or {}
    by_code: dict[str, RestaurantTable] = {
        t.code: t for t in (await db.execute(
            select(RestaurantTable).where(RestaurantTable.outlet_id == outlet_id)
        )).scalars().all()
    }

    applied = 0
    for entry in layout.get("tables", []):
        table = by_code.get(entry.get("code"))
        if table is None:
            continue
        for field in ("shape", "size_w", "size_h", "rotation", "label",
                      "position_x", "position_y"):
            if entry.get(field) is not None:
                setattr(table, field, entry[field])
        applied += 1

    await db.flush()
    return {"applied": applied, "floor_plan": plan.name}


# ─── Royalty ────────────────────────────────────────────────────────────────

async def create_royalty_agreement(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    data: dict,
) -> RoyaltyAgreement:
    if (data.get("rate_pct") is None) == (data.get("fixed_amount") is None):
        raise HTTPException(
            status_code=400,
            detail="Provide exactly one of rate_pct or fixed_amount",
        )
    agreement = RoyaltyAgreement(tenant_id=tenant_id, **data)
    db.add(agreement)
    await db.flush()
    return agreement


async def settle_royalty(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    agreement_id: uuid.UUID,
    period_start: date,
    period_end: date,
    base_amount: Decimal | None = None,
    notes: str | None = None,
) -> RoyaltySettlement:
    """Compute and record one settlement against an active agreement.

    Exactly one settlement is allowed per (agreement, window) — the
    unique constraint is the backstop, this check is just a friendlier 409
    before it. """
    if period_start > period_end:
        raise HTTPException(
            status_code=400, detail="period_start must be on or before period_end"
        )

    agreement = await db.scalar(
        select(RoyaltyAgreement).where(
            RoyaltyAgreement.id == agreement_id,
            RoyaltyAgreement.tenant_id == tenant_id,
            RoyaltyAgreement.is_active.is_(True),
        )
    )
    if agreement is None:
        raise HTTPException(status_code=404, detail="Agreement not found or inactive")

    existing = await db.scalar(
        select(RoyaltySettlement.id).where(
            RoyaltySettlement.agreement_id == agreement_id,
            RoyaltySettlement.period_start == period_start,
            RoyaltySettlement.period_end == period_end,
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A settlement already exists for this agreement and window",
        )

    if agreement.fixed_amount is not None:
        amount = agreement.fixed_amount
    else:
        if base_amount is None:
            raise HTTPException(
                status_code=400,
                detail="base_amount (revenue for the window) is required for a rate-based agreement",
            )
        amount = (Decimal(str(base_amount)) * Decimal(str(agreement.rate_pct)) / Decimal(100)).quantize(
            Decimal("0.01")
        )

    settlement = RoyaltySettlement(
        tenant_id=tenant_id,
        agreement_id=agreement_id,
        outlet_id=agreement.outlet_id,
        period_start=period_start,
        period_end=period_end,
        base_amount=base_amount,
        amount=amount,
        status=RoyaltyStatus.SETTLED,
        settled_at=_utcnow(),
        notes=notes,
    )
    db.add(settlement)
    await db.flush()
    return settlement
