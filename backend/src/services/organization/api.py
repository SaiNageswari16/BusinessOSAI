"""Organization service endpoints."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.event_bus.bus import Event, bus
from src.services.organization.models import (
    CostCenter,
    Outlet,
    RestaurantTable,
    Section,
    TableStatus,
    Tenant,
    UnitOfMeasure,
)
from src.services.organization.schemas import (
    CostCentreCreate,
    CostCentreResponse,
    FloorPlanResponse,
    FloorPlanUpdate,
    OutletCreate,
    OutletResponse,
    OutletUpdate,
    SectionCreate,
    SectionResponse,
    SectionUpdate,
    TableCreate,
    TableResponse,
    TableStatusUpdate,
    TableUpdate,
    TenantCreate,
    TenantResponse,
    TenantUpdate,
    UomCreate,
    UomResponse,
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
    stmt = select(Outlet).where(
        Outlet.id == outlet_id, Outlet.tenant_id == identity.tenant_id
    )
    if not include_inactive:
        stmt = stmt.where(Outlet.is_active.is_(True))
    outlet = await db.scalar(stmt)
    if outlet is None:
        raise HTTPException(status_code=404, detail="Outlet not found")
    return outlet


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
    clash = await db.scalar(
        select(Outlet.id).where(
            Outlet.tenant_id == identity.tenant_id,
            Outlet.code == payload.code,
        )
    )
    if clash:
        raise HTTPException(status_code=409, detail=f"Outlet code '{payload.code}' already exists")

    outlet = Outlet(tenant_id=identity.tenant_id, **payload.model_dump())
    db.add(outlet)
    await db.flush()
    await bus.publish(_ev("outlet.created", identity.tenant_id, outlet_id=outlet.id,
                          data={"code": outlet.code, "name": outlet.name}))
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
    await bus.publish(_ev("outlet.updated", identity.tenant_id, outlet_id=outlet.id))
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
    await bus.publish(_ev("outlet.deactivated", identity.tenant_id, outlet_id=outlet.id))


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
    section = Section(
        tenant_id=outlet.tenant_id,
        outlet_id=outlet.id,
        name=payload.name,
        section_type=payload.section_type,
        capacity=payload.capacity,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    db.add(section)
    await db.flush()
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
async def delete_section(section_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:outlets")
    section = await db.scalar(
        select(Section).where(
            Section.id == section_id, Section.tenant_id == identity.tenant_id
        )
    )
    if section is None:
        raise HTTPException(status_code=404, detail="Section not found")
    await db.delete(section)


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
    target_outlet_id = payload.outlet_id or identity.active_outlet_id or uuid.UUID("11111111-2222-3333-4444-555555555555")
    outlet = await _require_outlet(db, identity, target_outlet_id)
    clash = await db.scalar(
        select(RestaurantTable.id).where(
            RestaurantTable.tenant_id == identity.tenant_id,
            RestaurantTable.outlet_id == target_outlet_id,
            RestaurantTable.code == payload.code,
        )
    )
    if clash:
        raise HTTPException(status_code=409, detail=f"Table '{payload.code}' already exists")

    table = RestaurantTable(
        tenant_id=outlet.tenant_id,
        outlet_id=outlet.id,
        section_id=payload.section_id,
        name=payload.name,
        code=payload.code,
        seats=payload.seats,
        shape=payload.shape,
        min_covers=payload.min_covers,
        max_covers=payload.max_covers,
        is_active=payload.is_active,
        position_x=payload.position_x,
        position_y=payload.position_y,
    )
    db.add(table)
    await db.flush()
    return table


def _table_filter(identifier: str, tenant_id: uuid.UUID):
    try:
        uid = uuid.UUID(str(identifier))
        return (RestaurantTable.id == uid) | (RestaurantTable.code == identifier) | (RestaurantTable.name == identifier)
    except ValueError:
        return (RestaurantTable.code == identifier) | (RestaurantTable.name == identifier)


@router.get("/tables/{table_id}", response_model=TableResponse, tags=["tables"])
async def get_table(table_id: str, identity: CurrentIdentity, db: DbDep):
    table = await db.scalar(
        select(RestaurantTable).where(
            _table_filter(table_id, identity.tenant_id),
            RestaurantTable.tenant_id == identity.tenant_id,
        )
    )
    if table is None:
        raise HTTPException(status_code=404, detail="Table not found")
    return table


@router.put("/tables/{table_id}", response_model=TableResponse, tags=["tables"])
async def update_table(
    table_id: str,
    payload: TableUpdate,
    identity: CurrentIdentity,
    db: DbDep,
):
    identity.require("manage:tables")
    table = await db.scalar(
        select(RestaurantTable).where(
            _table_filter(table_id, identity.tenant_id),
            RestaurantTable.tenant_id == identity.tenant_id,
        )
    )
    if table is None:
        raise HTTPException(status_code=404, detail="Table not found")
    old_status = table.status
    update_data = payload.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] is not None:
        raw_status = update_data.pop("status")
        status_map = {
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
        table.status = status_map.get(str(raw_status).lower(), TableStatus.FREE)
    for field, value in update_data.items():
        setattr(table, field, value)
    await db.flush()
    if table.status != old_status:
        await bus.publish(_ev(
            "table.status.changed", identity.tenant_id,
            outlet_id=table.outlet_id,
            data={
                "table_id": str(table.id),
                "from": str(getattr(old_status, "value", old_status)),
                "to": str(getattr(table.status, "value", table.status)),
            },
        ))
    return table


@router.delete("/tables/{table_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["tables"])
async def delete_table(table_id: str, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:tables")
    table = await db.scalar(
        select(RestaurantTable).where(
            _table_filter(table_id, identity.tenant_id),
            RestaurantTable.tenant_id == identity.tenant_id,
        )
    )
    if table is None:
        raise HTTPException(status_code=404, detail="Table not found")
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
    table = await db.scalar(
        select(RestaurantTable).where(
            _table_filter(table_id, identity.tenant_id),
            RestaurantTable.tenant_id == identity.tenant_id,
        )
    )
    if table is None:
        raise HTTPException(status_code=404, detail="Table not found")
    old = table.status
    status_map = {
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
    table.status = status_map.get(payload.status.lower(), TableStatus.FREE)
    await db.flush()
    if old != table.status:
        await bus.publish(_ev(
            "table.status.changed", identity.tenant_id,
            outlet_id=table.outlet_id,
            data={
                "table_id": str(table.id),
                "from": str(getattr(old, "value", old)),
                "to": table.status.value,
            },
        ))
    return table


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
        if entry.position_x is not None:
            table.position_x = entry.position_x
        if entry.position_y is not None:
            table.position_y = entry.position_y
        if entry.section_id is not None:
            table.section_id = entry.section_id
        updated += 1
    await db.flush()
    return {"detail": "Floor plan updated", "updated": updated}


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
        raise HTTPException(status_code=409, detail=f"UoM '{payload.code}' already exists")
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
