import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission, resolve_outlet_id
from src.database.session import get_db
from src.models import Outlet, RestaurantTable, Section, TableStatus, UnitOfMeasure
from src.schemas.core import (
    FloorPlanUpdate,
    OutletCreate,
    OutletResponse,
    OutletUpdate,
    SectionCreate,
    SectionResponse,
    TableCreate,
    TableResponse,
    TableStatusUpdate,
)
from src.services.number_series import ensure_series_for_outlet

router = APIRouter(prefix="/organization", tags=["Organization"])


# ─── Outlets ─────────────────────────────────────────────────────

@router.get("/outlets", response_model=list[OutletResponse])
async def list_outlets(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:outlets"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    stmt = select(Outlet).where(Outlet.tenant_id == ctx.tenant_id).order_by(Outlet.created_at)
    if ctx.allowed_outlet_ids and not ctx.is_tenant_owner:
        stmt = stmt.where(Outlet.id.in_(ctx.allowed_outlet_ids))
    return [OutletResponse.model_validate(o) for o in (await db.execute(stmt)).scalars().all()]


@router.post("/outlets", response_model=OutletResponse, status_code=status.HTTP_201_CREATED)
async def create_outlet(
    payload: OutletCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:outlets"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    code = payload.code.upper()
    exists = await db.scalar(
        select(Outlet.id).where(Outlet.tenant_id == ctx.tenant_id, Outlet.code == code)
    )
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Outlet code already exists")

    outlet = Outlet(tenant_id=ctx.tenant_id, **payload.model_dump(exclude={"code"}), code=code)
    db.add(outlet)
    await db.flush()

    await ensure_series_for_outlet(db, ctx.tenant_id, outlet.id)
    await db.commit()
    await db.refresh(outlet)
    return OutletResponse.model_validate(outlet)


@router.get("/outlets/{outlet_id}", response_model=OutletResponse)
async def get_outlet(
    outlet_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:outlets"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, outlet_id)
    outlet = await db.scalar(
        select(Outlet).where(Outlet.id == outlet_id, Outlet.tenant_id == ctx.tenant_id)
    )
    if outlet is None:
        raise HTTPException(status_code=404, detail="Outlet not found")
    return OutletResponse.model_validate(outlet)


@router.put("/outlets/{outlet_id}", response_model=OutletResponse)
async def update_outlet(
    outlet_id: uuid.UUID,
    payload: OutletUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:outlets"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, outlet_id)
    outlet = await db.scalar(
        select(Outlet).where(Outlet.id == outlet_id, Outlet.tenant_id == ctx.tenant_id)
    )
    if outlet is None:
        raise HTTPException(status_code=404, detail="Outlet not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(outlet, field, value)
    await db.commit()
    await db.refresh(outlet)
    return OutletResponse.model_validate(outlet)


# ─── Sections ────────────────────────────────────────────────────

@router.get("/outlets/{outlet_id}/sections", response_model=list[SectionResponse])
async def list_sections(
    outlet_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:tables"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, outlet_id)
    stmt = (
        select(Section)
        .where(Section.tenant_id == ctx.tenant_id, Section.outlet_id == outlet_id)
        .order_by(Section.sort_order)
    )
    return [SectionResponse.model_validate(s) for s in (await db.execute(stmt)).scalars().all()]


@router.post("/outlets/{outlet_id}/sections", response_model=SectionResponse,
             status_code=status.HTTP_201_CREATED)
async def create_section(
    outlet_id: uuid.UUID,
    payload: SectionCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:tables"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, outlet_id)
    outlet = await db.scalar(
        select(Outlet.id).where(Outlet.id == outlet_id, Outlet.tenant_id == ctx.tenant_id)
    )
    if outlet is None:
        raise HTTPException(status_code=404, detail="Outlet not found")

    section = Section(tenant_id=ctx.tenant_id, outlet_id=outlet_id, **payload.model_dump())
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return SectionResponse.model_validate(section)


# ─── Tables ──────────────────────────────────────────────────────

@router.get("/outlets/{outlet_id}/tables", response_model=list[TableResponse])
async def list_tables(
    outlet_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:tables"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, outlet_id)
    stmt = (
        select(RestaurantTable)
        .where(RestaurantTable.tenant_id == ctx.tenant_id, RestaurantTable.outlet_id == outlet_id)
        .order_by(RestaurantTable.code)
    )
    return [TableResponse.model_validate(t) for t in (await db.execute(stmt)).scalars().all()]


@router.post("/outlets/{outlet_id}/tables", response_model=TableResponse,
             status_code=status.HTTP_201_CREATED)
async def create_table(
    outlet_id: uuid.UUID,
    payload: TableCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:tables"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, outlet_id)
    outlet = await db.scalar(
        select(Outlet.id).where(Outlet.id == outlet_id, Outlet.tenant_id == ctx.tenant_id)
    )
    if outlet is None:
        raise HTTPException(status_code=404, detail="Outlet not found")

    if payload.section_id:
        section = await db.scalar(
            select(Section.id).where(
                Section.id == payload.section_id,
                Section.outlet_id == outlet_id,
                Section.tenant_id == ctx.tenant_id,
            )
        )
        if section is None:
            raise HTTPException(status_code=404, detail="Section not found")

    table = RestaurantTable(tenant_id=ctx.tenant_id, outlet_id=outlet_id, **payload.model_dump())
    db.add(table)
    await db.commit()
    await db.refresh(table)
    return TableResponse.model_validate(table)


@router.put("/tables/{table_id}/status", response_model=TableResponse)
async def update_table_status(
    table_id: uuid.UUID,
    payload: TableStatusUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:tables"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    table = await db.scalar(
        select(RestaurantTable).where(
            RestaurantTable.id == table_id, RestaurantTable.tenant_id == ctx.tenant_id
        )
    )
    if table is None:
        raise HTTPException(status_code=404, detail="Table not found")
    ctx.require_outlet_access(table.outlet_id)

    try:
        table.status = TableStatus(payload.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {payload.status}")

    await db.commit()
    await db.refresh(table)
    return TableResponse.model_validate(table)


@router.get("/outlets/{outlet_id}/floor-plan")
async def get_floor_plan(
    outlet_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:tables"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return all tables and sections for an outlet, including positional layout."""
    resolve_outlet_id(ctx, outlet_id)
    tables = (
        await db.execute(
            select(RestaurantTable).where(
                RestaurantTable.outlet_id == outlet_id,
                RestaurantTable.tenant_id == ctx.tenant_id,
            )
        )
    ).scalars().all()
    sections = (
        await db.execute(
            select(Section).where(
                Section.outlet_id == outlet_id,
                Section.tenant_id == ctx.tenant_id,
            )
        )
    ).scalars().all()
    return {
        "sections": [SectionResponse.model_validate(s) for s in sections],
        "tables": [TableResponse.model_validate(t) for t in tables],
    }


@router.put("/outlets/{outlet_id}/floor-plan")
async def update_floor_plan(
    outlet_id: uuid.UUID,
    payload: FloorPlanUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:tables"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, outlet_id)
    updated = 0
    for entry in payload.tables:
        table_id = entry.get("id")
        if not table_id:
            continue
        table = await db.scalar(
            select(RestaurantTable).where(
                RestaurantTable.id == table_id,
                RestaurantTable.outlet_id == outlet_id,
                RestaurantTable.tenant_id == ctx.tenant_id,
            )
        )
        if table is None:
            continue
        if "position_x" in entry:
            table.position_x = entry["position_x"]
        if "position_y" in entry:
            table.position_y = entry["position_y"]
        if "section_id" in entry:
            table.section_id = entry["section_id"]
        updated += 1

    await db.commit()
    return {"detail": "Floor plan updated", "updated": updated}


# ─── Units of measure ────────────────────────────────────────────

@router.get("/units")
async def list_units(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:master_data"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    stmt = select(UnitOfMeasure).where(UnitOfMeasure.tenant_id == ctx.tenant_id)
    units = (await db.execute(stmt)).scalars().all()
    return [
        {"id": str(u.id), "name": u.name, "code": u.code, "uom_type": u.uom_type,
         "base_factor": float(u.base_factor or 1), "is_active": u.is_active}
        for u in units
    ]
