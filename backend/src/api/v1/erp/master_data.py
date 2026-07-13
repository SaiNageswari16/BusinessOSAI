"""
Master Data — Geography, Locations, Work Calendars, Tags/Labels
"""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission, require_any_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import (
    GeographyCountry,
    Location,
    WorkCalendar,
    Tag,
    EntityStatus,
)
from src.schemas.erp import (
    GeographyCountryCreate,
    GeographyCountryResponse,
    GeographyCountryUpdate,
    LocationCreate,
    LocationResponse,
    LocationUpdate,
    WorkCalendarCreate,
    WorkCalendarResponse,
    WorkCalendarUpdate,
    TagCreate,
    TagResponse,
    TagUpdate,
)
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter(prefix="/erp", tags=["Core ERP - Master Data"])


def _parse_status(value: str) -> EntityStatus:
    try:
        return EntityStatus(value.lower())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid status: {value}") from exc


# ─── Geography ────────────────────────────────────────────────────

@router.get("/geography", response_model=PaginatedResponse[GeographyCountryResponse])
async def list_geography(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = None,
):
    query = select(GeographyCountry).where(GeographyCountry.tenant_id == ctx.tenant_id)
    if search:
        query = query.where(
            GeographyCountry.name.ilike(f"%{search}%") | GeographyCountry.iso_code.ilike(f"%{search}%")
        )
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(GeographyCountry.name.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/geography", response_model=GeographyCountryResponse, status_code=status.HTTP_201_CREATED)
async def create_geography(
    payload: GeographyCountryCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    country = GeographyCountry(
        tenant_id=ctx.tenant_id,
        name=payload.name,
        iso_code=payload.iso_code.upper(),
        phone_code=payload.phone_code,
        currency_code=payload.currency_code,
        states=payload.states or [],
        status=_parse_status(payload.status),
    )
    db.add(country)
    await db.flush()
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="created", entity_type="geography_country", entity_id=country.id,
                          new_values=payload.model_dump(mode="json"),
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.commit()
    return country


@router.get("/geography/{country_id}", response_model=GeographyCountryResponse)
async def get_geography(
    country_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    country = await db.scalar(select(GeographyCountry).where(
        GeographyCountry.id == country_id, GeographyCountry.tenant_id == ctx.tenant_id
    ))
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")
    return country


@router.patch("/geography/{country_id}", response_model=GeographyCountryResponse)
async def update_geography(
    country_id: uuid.UUID,
    payload: GeographyCountryUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    country = await db.scalar(select(GeographyCountry).where(
        GeographyCountry.id == country_id, GeographyCountry.tenant_id == ctx.tenant_id
    ))
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")

    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates:
        updates["status"] = _parse_status(updates["status"])
    for key, value in updates.items():
        setattr(country, key, value)

    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="updated", entity_type="geography_country", entity_id=country.id,
                          new_values=updates,
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.commit()
    return country


@router.delete("/geography/{country_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_geography(
    country_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    country = await db.scalar(select(GeographyCountry).where(
        GeographyCountry.id == country_id, GeographyCountry.tenant_id == ctx.tenant_id
    ))
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="deleted", entity_type="geography_country", entity_id=country.id,
                          old_values={"name": country.name, "iso_code": country.iso_code},
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.delete(country)
    await db.commit()


# ─── Locations ────────────────────────────────────────────────────

@router.get("/locations", response_model=PaginatedResponse[LocationResponse])
async def list_locations(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    company_id: uuid.UUID | None = None,
    location_type: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    query = select(Location).where(Location.tenant_id == ctx.tenant_id)
    if company_id:
        query = query.where(Location.company_id == company_id)
    if location_type:
        query = query.where(Location.location_type == location_type)
    if search:
        query = query.where(Location.name.ilike(f"%{search}%") | Location.code.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(Location.name.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/locations", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    payload: LocationCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    loc = Location(
        tenant_id=ctx.tenant_id,
        company_id=payload.company_id,
        branch_id=payload.branch_id,
        code=payload.code,
        name=payload.name,
        location_type=payload.location_type,
        address=payload.address,
        city=payload.city,
        state=payload.state,
        country=payload.country,
        latitude=payload.latitude,
        longitude=payload.longitude,
        status=_parse_status(payload.status),
    )
    db.add(loc)
    await db.flush()
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="created", entity_type="location", entity_id=loc.id,
                          new_values=payload.model_dump(mode="json"),
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.commit()
    return loc


@router.get("/locations/{loc_id}", response_model=LocationResponse)
async def get_location(
    loc_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    loc = await db.scalar(select(Location).where(
        Location.id == loc_id, Location.tenant_id == ctx.tenant_id
    ))
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    return loc


@router.patch("/locations/{loc_id}", response_model=LocationResponse)
async def update_location(
    loc_id: uuid.UUID,
    payload: LocationUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    loc = await db.scalar(select(Location).where(
        Location.id == loc_id, Location.tenant_id == ctx.tenant_id
    ))
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates:
        updates["status"] = _parse_status(updates["status"])
    for key, value in updates.items():
        setattr(loc, key, value)

    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="updated", entity_type="location", entity_id=loc.id,
                          new_values=updates,
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.commit()
    return loc


@router.delete("/locations/{loc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    loc_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    loc = await db.scalar(select(Location).where(
        Location.id == loc_id, Location.tenant_id == ctx.tenant_id
    ))
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="deleted", entity_type="location", entity_id=loc.id,
                          old_values={"code": loc.code, "name": loc.name},
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.delete(loc)
    await db.commit()


# ─── Work Calendars ───────────────────────────────────────────────

@router.get("/work-calendars", response_model=PaginatedResponse[WorkCalendarResponse])
async def list_work_calendars(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    company_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    query = select(WorkCalendar).where(WorkCalendar.tenant_id == ctx.tenant_id)
    if company_id:
        query = query.where(WorkCalendar.company_id == company_id)
    if search:
        query = query.where(WorkCalendar.name.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(WorkCalendar.name.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/work-calendars", response_model=WorkCalendarResponse, status_code=status.HTTP_201_CREATED)
async def create_work_calendar(
    payload: WorkCalendarCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    cal = WorkCalendar(
        tenant_id=ctx.tenant_id,
        company_id=payload.company_id,
        name=payload.name,
        calendar_type=payload.calendar_type,
        working_days=payload.working_days or ["Mon", "Tue", "Wed", "Thu", "Fri"],
        shifts=payload.shifts or [],
        holidays=payload.holidays or [],
        is_default=payload.is_default,
        status=_parse_status(payload.status),
    )
    db.add(cal)
    await db.flush()
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="created", entity_type="work_calendar", entity_id=cal.id,
                          new_values=payload.model_dump(mode="json"),
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.commit()
    return cal


@router.get("/work-calendars/{cal_id}", response_model=WorkCalendarResponse)
async def get_work_calendar(
    cal_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    cal = await db.scalar(select(WorkCalendar).where(
        WorkCalendar.id == cal_id, WorkCalendar.tenant_id == ctx.tenant_id
    ))
    if not cal:
        raise HTTPException(status_code=404, detail="Work calendar not found")
    return cal


@router.patch("/work-calendars/{cal_id}", response_model=WorkCalendarResponse)
async def update_work_calendar(
    cal_id: uuid.UUID,
    payload: WorkCalendarUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    cal = await db.scalar(select(WorkCalendar).where(
        WorkCalendar.id == cal_id, WorkCalendar.tenant_id == ctx.tenant_id
    ))
    if not cal:
        raise HTTPException(status_code=404, detail="Work calendar not found")

    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates:
        updates["status"] = _parse_status(updates["status"])
    for key, value in updates.items():
        setattr(cal, key, value)

    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="updated", entity_type="work_calendar", entity_id=cal.id,
                          new_values=updates,
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.commit()
    return cal


@router.delete("/work-calendars/{cal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work_calendar(
    cal_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    cal = await db.scalar(select(WorkCalendar).where(
        WorkCalendar.id == cal_id, WorkCalendar.tenant_id == ctx.tenant_id
    ))
    if not cal:
        raise HTTPException(status_code=404, detail="Work calendar not found")
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="deleted", entity_type="work_calendar", entity_id=cal.id,
                          old_values={"name": cal.name},
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.delete(cal)
    await db.commit()


# ─── Tags ─────────────────────────────────────────────────────────

@router.get("/tags", response_model=PaginatedResponse[TagResponse])
async def list_tags(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    entity_type: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = None,
):
    query = select(Tag).where(Tag.tenant_id == ctx.tenant_id)
    if entity_type:
        query = query.where((Tag.entity_type == entity_type) | (Tag.entity_type == "any"))
    if search:
        query = query.where(Tag.name.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(Tag.name.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/tags", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    payload: TagCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tag = Tag(
        tenant_id=ctx.tenant_id,
        name=payload.name,
        entity_type=payload.entity_type,
        color=payload.color,
        description=payload.description,
        status=_parse_status(payload.status),
    )
    db.add(tag)
    await db.flush()
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="created", entity_type="tag", entity_id=tag.id,
                          new_values=payload.model_dump(mode="json"),
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.commit()
    return tag


@router.get("/tags/{tag_id}", response_model=TagResponse)
async def get_tag(
    tag_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tag = await db.scalar(select(Tag).where(
        Tag.id == tag_id, Tag.tenant_id == ctx.tenant_id
    ))
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return tag


@router.patch("/tags/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: uuid.UUID,
    payload: TagUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tag = await db.scalar(select(Tag).where(
        Tag.id == tag_id, Tag.tenant_id == ctx.tenant_id
    ))
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates:
        updates["status"] = _parse_status(updates["status"])
    for key, value in updates.items():
        setattr(tag, key, value)

    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="updated", entity_type="tag", entity_id=tag.id,
                          new_values=updates,
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.commit()
    return tag


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tag = await db.scalar(select(Tag).where(
        Tag.id == tag_id, Tag.tenant_id == ctx.tenant_id
    ))
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="erp",
                          action="deleted", entity_type="tag", entity_id=tag.id,
                          old_values={"name": tag.name},
                          ip_address=request.client.host if request.client else None,
                          user_agent=request.headers.get("user-agent"))
    await db.delete(tag)
    await db.commit()
