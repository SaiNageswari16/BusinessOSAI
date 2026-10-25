"""Organization service endpoints."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.event_bus.bus import Event, bus
from src.services.organization import service as svc
from src.services.organization.outbox import record_event
from src.services.organization.models import (
    CostCenter,
    EnterpriseBrand,
    FloorPlan,
    Outlet,
    RestaurantTable,
    RoyaltyAgreement,
    RoyaltySettlement,
    Section,
    TableStatus,
    Tenant,
    UnitOfMeasure,
)
from src.services.organization.schemas import (
    BrandCreate,
    BrandResponse,
    BrandUpdate,
    BulkDeleteResponse,
    CostCentreCreate,
    CostCentreResponse,
    CostCentreUpdate,
    FloorPlanResponse,
    FloorPlanUpdate,
    NamedFloorPlanCreate,
    NamedFloorPlanRestore,
    NamedFloorPlanResponse,
    OutletCreate,
    OutletResponse,
    OutletUpdate,
    RoyaltyAgreementCreate,
    RoyaltyAgreementResponse,
    RoyaltyAgreementUpdate,
    RoyaltySettleListResponse,
    RoyaltySettleRequest,
    RoyaltySettleResponse,
    SectionCreate,
    SectionResponse,
    SectionUpdate,
    TableBulkStatusUpdate,
    TableCreate,
    TableResponse,
    TableStatusUpdate,
    TableUpdate,
    TenantCreate,
    TenantResponse,
    TenantUpdate,
    UomCreate,
    UomResponse,
    UomUpdate,
)
from src.services.shared.identity import CurrentIdentity

router = APIRouter()


async def get_db(request: Request) -> AsyncSession:
    """One session per request, committed on success, rolled back on error."""
    session = request.app.state.db.session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


DbDep = Annotated[AsyncSession, Depends(get_db)]


def _ev(topic, tenant_id=None, outlet_id=None, data=None) -> Event:
    return Event(type=topic, tenant_id=tenant_id, outlet_id=outlet_id,
                 data=data or {}, source_service="organization")


async def _require_outlet(
    db: AsyncSession, identity, outlet_id: uuid.UUID, *, include_inactive: bool = False
) -> Outlet:
    """Fetch an outlet, scoped to the caller's tenant.

    Keeps a bad or foreign outlet_id from reaching the FK constraint as a 500 —
    the caller gets a clean 404 instead. Deactivated outlets are hidden unless
    the caller explicitly asks for them.
    """
    return await svc.get_outlet(
        db, identity.tenant_id, outlet_id, include_inactive=include_inactive
    )


# ─── Tenants ────────────────────────────────────────────────────────────────

@router.get("/tenants", response_model=list[TenantResponse], tags=["tenants"])
async def list_tenants(identity: CurrentIdentity, db: DbDep):
    rows = (await db.execute(
        select(Tenant).where(Tenant.id == identity.tenant_id)
    )).scalars().all()
    return rows


@router.post("/tenants", response_model=TenantResponse, status_code=status.HTTP_201_CREATED,
             tags=["tenants"])
async def create_tenant(
    payload: TenantCreate,
    identity: CurrentIdentity,
    db: DbDep,
):
    exists = await db.scalar(select(Tenant.id).where(Tenant.slug == payload.slug))
    if exists:
        raise HTTPException(status_code=409, detail=f"Slug '{payload.slug}' already exists")
    tenant = Tenant(
        name=payload.name,
        slug=payload.slug,
        contact_email=payload.contact_email,
        contact_phone=payload.contact_phone,
    )
    db.add(tenant)
    await db.flush()
    await bus.publish(_ev("tenant.created", tenant.id, data={"slug": tenant.slug}))
    return tenant


# ─── Brands (enterprise) ────────────────────────────────────────────────────

@router.get("/brands", response_model=list[BrandResponse], tags=["brands"])
async def list_brands(identity: CurrentIdentity, db: DbDep):
    stmt = select(EnterpriseBrand).where(
        EnterpriseBrand.tenant_id == identity.tenant_id,
        EnterpriseBrand.is_active.is_(True),
    ).order_by(EnterpriseBrand.name)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/brands", response_model=BrandResponse,
             status_code=status.HTTP_201_CREATED, tags=["brands"])
async def create_brand(payload: BrandCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:outlets")
    return await svc.create_brand(db, tenant_id=identity.tenant_id,
                                  data=payload.model_dump())


@router.put("/brands/{brand_id}", response_model=BrandResponse, tags=["brands"])
async def update_brand(
    brand_id: uuid.UUID, payload: BrandUpdate, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:outlets")
    brand = await db.scalar(
        select(EnterpriseBrand).where(
            EnterpriseBrand.id == brand_id, EnterpriseBrand.tenant_id == identity.tenant_id
        )
    )
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(brand, field, value)
    await db.flush()
    return brand


@router.delete("/brands/{brand_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["brands"])
async def deactivate_brand(brand_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:outlets")
    brand = await db.scalar(
        select(EnterpriseBrand).where(
            EnterpriseBrand.id == brand_id, EnterpriseBrand.tenant_id == identity.tenant_id
        )
    )
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    still_used = await db.scalar(
        select(Outlet.id).where(Outlet.brand_id == brand.id, Outlet.is_active.is_(True)).limit(1)
    )
    if still_used:
        raise HTTPException(
            status_code=409,
            detail="Brand is still assigned to active outlets — reassign them first",
        )
    brand.is_active = False


# ─── Outlets ────────────────────────────────────────────────────────────────

@router.get("/outlets", response_model=list[OutletResponse], tags=["outlets"])
async def list_outlets(
    identity: CurrentIdentity,
    db: DbDep,
    include_inactive: bool = False,
):
    stmt = select(Outlet).where(Outlet.tenant_id == identity.tenant_id)
    if not include_inactive:
        stmt = stmt.where(Outlet.is_active.is_(True))
    stmt = stmt.order_by(Outlet.name)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/outlets", response_model=OutletResponse, status_code=status.HTTP_201_CREATED,
             tags=["outlets"])
async def create_outlet(payload: OutletCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:outlets")
    outlet = await svc.create_outlet(
        db, tenant_id=identity.tenant_id, data=payload.model_dump()
    )
    await record_event(db, type="outlet.created", tenant_id=identity.tenant_id,
                       outlet_id=outlet.id,
                       data={"code": outlet.code, "name": outlet.name})
    return outlet


@router.get("/outlets/{outlet_id}", response_model=OutletResponse, tags=["outlets"])
async def get_outlet(
    outlet_id: uuid.UUID,
    identity: CurrentIdentity,
    db: DbDep,
    include_inactive: bool = False,
):
    return await _require_outlet(
        db, identity, outlet_id, include_inactive=include_inactive
    )


@router.put("/outlets/{outlet_id}", response_model=OutletResponse, tags=["outlets"])
async def update_outlet(
    outlet_id: uuid.UUID,
    payload: OutletUpdate,
    identity: CurrentIdentity,
    db: DbDep,
):
    identity.require("manage:outlets")
    # Updates may target a deactivated outlet — e.g. to reactivate it.
    outlet = await _require_outlet(db, identity, outlet_id, include_inactive=True)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(outlet, field, value)
    await db.flush()
    await record_event(db, type="outlet.updated", tenant_id=identity.tenant_id,
                       outlet_id=outlet.id)
    return outlet


@router.delete("/outlets/{outlet_id}", status_code=status.HTTP_204_NO_CONTENT,
               tags=["outlets"])
async def delete_outlet(outlet_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:outlets")
    # Deleting an already-deactivated outlet should be idempotent, so allow
    # inactive rows here rather than reporting a 404 for the second call.
    outlet = await _require_outlet(db, identity, outlet_id, include_inactive=True)
    outlet.is_active = False
    await db.flush()
    await record_event(db, type="outlet.deactivated", tenant_id=identity.tenant_id,
                       outlet_id=outlet.id)


# ─── Sections ───────────────────────────────────────────────────────────────

@router.get("/sections", response_model=list[SectionResponse], tags=["sections"])
async def list_sections(
    identity: CurrentIdentity,
    db: DbDep,
    outlet_id: uuid.UUID | None = None,
):
    stmt = select(Section).where(Section.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(Section.outlet_id == outlet_id)
    stmt = stmt.order_by(Section.sort_order, Section.name)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/sections", response_model=SectionResponse, status_code=status.HTTP_201_CREATED,
             tags=["sections"])
async def create_section(payload: SectionCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:outlets")
    outlet = await _require_outlet(db, identity, payload.outlet_id)
    section = await svc.create_section(db, outlet=outlet, data=payload.model_dump())
    return section


@router.put("/sections/{section_id}", response_model=SectionResponse, tags=["sections"])
async def update_section(
    section_id: uuid.UUID,
    payload: SectionUpdate,
    identity: CurrentIdentity,
    db: DbDep,
):
    identity.require("manage:outlets")
    section = await db.scalar(
        select(Section).where(
            Section.id == section_id, Section.tenant_id == identity.tenant_id
        )
    )
    if section is None:
        raise HTTPException(status_code=404, detail="Section not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(section, field, value)
    await db.flush()
    return section


@router.delete("/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT,
               tags=["sections"])
async def delete_section(
    section_id: uuid.UUID,
    identity: CurrentIdentity,
    db: DbDep,
    force: bool = False,
):
    """Delete a section. Refuses with 409 while tables still reference it,
    unless ``force=true`` (which unassigns them)."""
    identity.require("manage:outlets")
    section = await db.scalar(
        select(Section).where(
            Section.id == section_id, Section.tenant_id == identity.tenant_id
        )
    )
    if section is None:
        raise HTTPException(status_code=404, detail="Section not found")
    await svc.delete_section(db, section, force=force)


# ─── Tables ─────────────────────────────────────────────────────────────────

@router.get("/tables", response_model=list[TableResponse], tags=["tables"])
async def list_tables(
    identity: CurrentIdentity,
    db: DbDep,
    outlet_id: uuid.UUID | None = None,
    status_filter: str | None = None,
):
    stmt = select(RestaurantTable).where(
        RestaurantTable.tenant_id == identity.tenant_id
    )
    if outlet_id:
        stmt = stmt.where(RestaurantTable.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(RestaurantTable.status == status_filter)
    stmt = stmt.order_by(RestaurantTable.name)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/tables", response_model=TableResponse, status_code=status.HTTP_201_CREATED,
             tags=["tables"])
async def create_table(payload: TableCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:tables")
    target_outlet_id = (
        payload.outlet_id
        or identity.active_outlet_id
        or uuid.UUID("11111111-2222-3333-4444-555555555555")
    )
    outlet = await _require_outlet(db, identity, target_outlet_id)
    table = await svc.create_table(
        db, outlet=outlet, data=payload.model_dump(exclude={"outlet_id"})
    )
    return table


def _table_filter(identifier: str):
    try:
        uid = uuid.UUID(str(identifier))
        return (
            (RestaurantTable.id == uid)
            | (RestaurantTable.code == identifier)
            | (RestaurantTable.name == identifier)
        )
    except ValueError:
        return (RestaurantTable.code == identifier) | (RestaurantTable.name == identifier)


async def _get_table_or_404(
    db: AsyncSession, identity, table_id: str
) -> RestaurantTable:
    table = await db.scalar(
        select(RestaurantTable).where(
            _table_filter(table_id),
            RestaurantTable.tenant_id == identity.tenant_id,
        )
    )
    if table is None:
        raise HTTPException(status_code=404, detail="Table not found")
    return table


@router.get("/tables/{table_id}", response_model=TableResponse, tags=["tables"])
async def get_table(table_id: str, identity: CurrentIdentity, db: DbDep):
    return await _get_table_or_404(db, identity, table_id)


@router.put("/tables/{table_id}", response_model=TableResponse, tags=["tables"])
async def update_table(
    table_id: str,
    payload: TableUpdate,
    identity: CurrentIdentity,
    db: DbDep,
):
    identity.require("manage:tables")
    table = await _get_table_or_404(db, identity, table_id)
    old_status = table.status
    update_data = payload.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] is not None:
        raw_status = update_data.pop("status")
        table.status = svc._coerce_status(raw_status)
    for field, value in update_data.items():
        setattr(table, field, value)
    await db.flush()
    if table.status != old_status:
        await record_event(db, type="table.status.changed",
                           tenant_id=identity.tenant_id,
                           outlet_id=table.outlet_id,
                           data={
                               "table_id": str(table.id),
                               "from": str(getattr(old_status, "value", old_status)),
                               "to": str(getattr(table.status, "value", table.status)),
                           })
    return table


@router.delete("/tables/{table_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["tables"])
async def delete_table(table_id: str, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:tables")
    table = await _get_table_or_404(db, identity, table_id)
    await db.delete(table)


@router.put("/tables/{table_id}/status", response_model=TableResponse, tags=["tables"])
async def set_table_status(
    table_id: str,
    payload: TableStatusUpdate,
    identity: CurrentIdentity,
    db: DbDep,
):
    """Called by POS when a session opens or closes. Publishes an event so
    other services can react without polling this one."""
    table = await _get_table_or_404(db, identity, table_id)
    old = table.status
    table.status = svc._coerce_status(payload.status)
    await db.flush()
    if old != table.status:
        await record_event(db, type="table.status.changed",
                           tenant_id=identity.tenant_id,
                           outlet_id=table.outlet_id,
                           data={
                               "table_id": str(table.id),
                               "from": str(getattr(old, "value", old)),
                               "to": table.status.value,
                           })
    return table


@router.post("/tables/bulk-status", tags=["tables"],
             summary="Set status on many tables in one call")
async def bulk_table_status(
    payload: TableBulkStatusUpdate,
    identity: CurrentIdentity,
    db: DbDep,
):
    """The floor-manager's 'clear this whole section to free' case."""
    identity.require("manage:tables")
    result = await svc.bulk_set_table_status(
        db, identity.tenant_id, payload.table_ids, payload.status
    )
    return result


# ─── Floor plan ─────────────────────────────────────────────────────────────

@router.get("/outlets/{outlet_id}/floor-plan", response_model=FloorPlanResponse,
            tags=["tables"])
async def get_floor_plan(outlet_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    sections = list((await db.execute(
        select(Section).where(
            Section.outlet_id == outlet_id,
            Section.tenant_id == identity.tenant_id,
        )
    )).scalars().all())
    tables = list((await db.execute(
        select(RestaurantTable).where(
            RestaurantTable.outlet_id == outlet_id,
            RestaurantTable.tenant_id == identity.tenant_id,
        )
    )).scalars().all())
    return {"sections": sections, "tables": tables}


@router.put("/outlets/{outlet_id}/floor-plan", tags=["tables"])
async def update_floor_plan(
    outlet_id: uuid.UUID,
    payload: FloorPlanUpdate,
    identity: CurrentIdentity,
    db: DbDep,
):
    identity.require("manage:tables")
    updated = 0
    for entry in payload.tables:
        if not entry.id:
            continue
        table = await db.scalar(
            select(RestaurantTable).where(
                RestaurantTable.id == entry.id,
                RestaurantTable.outlet_id == outlet_id,
                RestaurantTable.tenant_id == identity.tenant_id,
            )
        )
        if table is None:
            continue
        for field in ("shape", "size_w", "size_h", "rotation", "label",
                      "position_x", "position_y", "section_id"):
            value = getattr(entry, field)
            if value is not None:
                setattr(table, field, value)
        updated += 1
    await db.flush()
    return {"detail": "Floor plan updated", "updated": updated}


# ─── Named floor plans (versioned snapshots) ──────────────────────────────

@router.get("/outlets/{outlet_id}/floor-plans",
            response_model=list[NamedFloorPlanResponse], tags=["tables"],
            summary="List saved floor-plan variants for an outlet")
async def list_floor_plans(outlet_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    stmt = select(FloorPlan).where(
        FloorPlan.outlet_id == outlet_id,
        FloorPlan.tenant_id == identity.tenant_id,
    ).order_by(FloorPlan.created_at.desc())
    return list((await db.execute(stmt)).scalars().all())


@router.post("/outlets/{outlet_id}/floor-plans",
             response_model=NamedFloorPlanResponse,
             status_code=status.HTTP_201_CREATED, tags=["tables"],
             summary="Snapshot the outlet's current layout under a name")
async def create_floor_plan(
    outlet_id: uuid.UUID,
    payload: NamedFloorPlanCreate,
    identity: CurrentIdentity,
    db: DbDep,
):
    identity.require("manage:tables")
    outlet = await _require_outlet(db, identity, outlet_id)
    plan = await svc.snapshot_floor_plan(db, outlet, name=payload.name)
    return plan


@router.post("/outlets/{outlet_id}/floor-plans/restore",
             tags=["tables"],
             summary="Write a saved floor plan's geometry back onto live tables")
async def restore_floor_plan(
    outlet_id: uuid.UUID,
    payload: NamedFloorPlanRestore,
    identity: CurrentIdentity,
    db: DbDep,
):
    identity.require("manage:tables")
    return await svc.restore_floor_plan(
        db, identity.tenant_id, payload.outlet_id, payload.floor_plan_id
    )


# ─── Cost centres ───────────────────────────────────────────────────────────

@router.post("/cost-centres", response_model=CostCentreResponse,
             status_code=status.HTTP_201_CREATED, tags=["cost-centres"])
async def create_cost_centre(
    payload: CostCentreCreate, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:organization")
    cc = CostCenter(
        tenant_id=identity.tenant_id,
        outlet_id=payload.outlet_id,
        name=payload.name,
        code=payload.code,
        center_type=payload.center_type,
    )
    db.add(cc)
    await db.flush()
    return cc


@router.get("/cost-centres", response_model=list[CostCentreResponse], tags=["cost-centres"])
async def list_cost_centres(
    identity: CurrentIdentity,
    db: DbDep,
    outlet_id: uuid.UUID | None = None,
):
    stmt = select(CostCenter).where(CostCenter.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(CostCenter.outlet_id == outlet_id)
    return list((await db.execute(stmt)).scalars().all())


@router.put("/cost-centres/{cost_centre_id}", response_model=CostCentreResponse,
            tags=["cost-centres"])
async def update_cost_centre(
    cost_centre_id: uuid.UUID,
    payload: CostCentreUpdate,
    identity: CurrentIdentity,
    db: DbDep,
):
    identity.require("manage:organization")
    cc = await db.scalar(
        select(CostCenter).where(
            CostCenter.id == cost_centre_id, CostCenter.tenant_id == identity.tenant_id
        )
    )
    if cc is None:
        raise HTTPException(status_code=404, detail="Cost centre not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(cc, field, value)
    await db.flush()
    return cc


@router.delete("/cost-centres/{cost_centre_id}", status_code=status.HTTP_204_NO_CONTENT,
               tags=["cost-centres"])
async def delete_cost_centre(
    cost_centre_id: uuid.UUID, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:organization")
    cc = await db.scalar(
        select(CostCenter).where(
            CostCenter.id == cost_centre_id, CostCenter.tenant_id == identity.tenant_id
        )
    )
    if cc is None:
        raise HTTPException(status_code=404, detail="Cost centre not found")
    cc.is_active = False


# ─── UoM ────────────────────────────────────────────────────────────────────

@router.post("/uom", response_model=UomResponse, status_code=status.HTTP_201_CREATED,
             tags=["uom"])
async def create_uom(payload: UomCreate, identity: CurrentIdentity, db: DbDep):
    clash = await db.scalar(
        select(UnitOfMeasure.id).where(
            UnitOfMeasure.tenant_id == identity.tenant_id,
            UnitOfMeasure.code == payload.code,
        )
    )
    if clash:
        raise HTTPException(409, detail=f"UoM '{payload.code}' already exists")
    uom = UnitOfMeasure(
        tenant_id=identity.tenant_id,
        name=payload.name,
        code=payload.code,
        uom_type=payload.uom_type,
        base_factor=payload.base_factor,
    )
    db.add(uom)
    await db.flush()
    return uom


@router.get("/uom", response_model=list[UomResponse], tags=["uom"])
async def list_uom(identity: CurrentIdentity, db: DbDep):
    return list((await db.execute(
        select(UnitOfMeasure).where(
            UnitOfMeasure.tenant_id == identity.tenant_id
        )
    )).scalars().all())


@router.put("/uom/{uom_id}", response_model=UomResponse, tags=["uom"])
async def update_uom(
    uom_id: uuid.UUID, payload: UomUpdate, identity: CurrentIdentity, db: DbDep
):
    uom = await db.scalar(
        select(UnitOfMeasure).where(
            UnitOfMeasure.id == uom_id, UnitOfMeasure.tenant_id == identity.tenant_id
        )
    )
    if uom is None:
        raise HTTPException(status_code=404, detail="UoM not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(uom, field, value)
    await db.flush()
    return uom


@router.delete("/uom/{uom_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["uom"])
async def delete_uom(uom_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    uom = await db.scalar(
        select(UnitOfMeasure).where(
            UnitOfMeasure.id == uom_id, UnitOfMeasure.tenant_id == identity.tenant_id
        )
    )
    if uom is None:
        raise HTTPException(status_code=404, detail="UoM not found")
    uom.is_active = False


# ─── Royalty (franchise) ────────────────────────────────────────────────────

@router.get("/royalty/agreements", response_model=list[RoyaltyAgreementResponse],
            tags=["royalty"])
async def list_royalty_agreements(
    identity: CurrentIdentity,
    db: DbDep,
    outlet_id: uuid.UUID | None = None,
):
    stmt = select(RoyaltyAgreement).where(
        RoyaltyAgreement.tenant_id == identity.tenant_id
    )
    if outlet_id:
        stmt = stmt.where(RoyaltyAgreement.outlet_id == outlet_id)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/royalty/agreements", response_model=RoyaltyAgreementResponse,
             status_code=status.HTTP_201_CREATED, tags=["royalty"],
             summary="Create a franchise royalty agreement (rate- or fixed-fee based)")
async def create_royalty_agreement(
    payload: RoyaltyAgreementCreate, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:outlets")
    return await svc.create_royalty_agreement(
        db, tenant_id=identity.tenant_id, data=payload.model_dump()
    )


@router.put("/royalty/agreements/{agreement_id}", response_model=RoyaltyAgreementResponse,
            tags=["royalty"])
async def update_royalty_agreement(
    agreement_id: uuid.UUID,
    payload: RoyaltyAgreementUpdate,
    identity: CurrentIdentity,
    db: DbDep,
):
    identity.require("manage:outlets")
    agreement = await db.scalar(
        select(RoyaltyAgreement).where(
            RoyaltyAgreement.id == agreement_id,
            RoyaltyAgreement.tenant_id == identity.tenant_id,
        )
    )
    if agreement is None:
        raise HTTPException(status_code=404, detail="Agreement not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(agreement, field, value)
    await db.flush()
    return agreement


@router.post("/royalty/settle", response_model=RoyaltySettleResponse, tags=["royalty"],
             summary="Record one royalty settlement against an active agreement")
async def settle_royalty(
    payload: RoyaltySettleRequest, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:outlets")
    settlement = await svc.settle_royalty(
        db,
        tenant_id=identity.tenant_id,
        agreement_id=payload.agreement_id,
        period_start=payload.period_start,
        period_end=payload.period_end,
        base_amount=payload.base_amount,
        notes=payload.notes,
    )
    return settlement


@router.get("/royalty/settlements", response_model=RoyaltySettleListResponse,
            tags=["royalty"])
async def list_royalty_settlements(
    identity: CurrentIdentity,
    db: DbDep,
    agreement_id: uuid.UUID | None = None,
):
    stmt = select(RoyaltySettlement).where(
        RoyaltySettlement.tenant_id == identity.tenant_id
    )
    if agreement_id:
        stmt = stmt.where(RoyaltySettlement.agreement_id == agreement_id)
    stmt = stmt.order_by(RoyaltySettlement.period_start.desc())
    rows = list((await db.execute(stmt)).scalars().all())
    return {"items": rows, "total": len(rows)}
