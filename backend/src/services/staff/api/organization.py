"""Department, Designation, Team, and Work Calendar endpoints for HRMS."""
from __future__ import annotations

import uuid
from typing import Annotated, Sequence

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.staff.deps import (
    CurrentUserContext,
    PaginatedResponse,
    get_db,
    paginate,
    require_permission,
    write_audit_log,
)
from src.services.staff.models import (
    Department,
    Designation,
    Team,
    WorkCalendar,
)
from src.services.staff.schemas import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    DesignationCreate,
    DesignationResponse,
    DesignationUpdate,
    TeamCreate,
    TeamResponse,
    TeamUpdate,
    WorkCalendarCreate,
    WorkCalendarResponse,
    WorkCalendarUpdate,
)

router = APIRouter(tags=["HRMS - Organization"])

# ─── Departments ─────────────────────────────────────────────────────────────

@router.get("/departments", response_model=PaginatedResponse[DepartmentResponse])
async def list_departments(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    company_id: uuid.UUID | None = None,
    search: str | None = None,
):
    stmt = select(Department).where(Department.tenant_id == ctx.tenant_id)
    if company_id:
        stmt = stmt.where(Department.company_id == company_id)
    if search:
        stmt = stmt.where(Department.name.ilike(f"%{search}%"))
    
    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = (await db.scalars(stmt.order_by(Department.name.asc()).offset((page - 1) * page_size).limit(page_size))).all()
    return paginate([DepartmentResponse.model_validate(d) for d in items], total, page, page_size)


@router.post("/departments", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: DepartmentCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    dept = Department(
        tenant_id=ctx.tenant_id,
        **payload.model_dump(),
    )
    db.add(dept)
    await db.flush()
    return DepartmentResponse.model_validate(dept)


@router.get("/departments/{dept_id}", response_model=DepartmentResponse)
async def get_department(
    dept_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    dept = await db.scalar(select(Department).where(Department.id == dept_id, Department.tenant_id == ctx.tenant_id))
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return DepartmentResponse.model_validate(dept)


@router.patch("/departments/{dept_id}", response_model=DepartmentResponse)
async def update_department(
    dept_id: uuid.UUID,
    payload: DepartmentUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    dept = await db.scalar(select(Department).where(Department.id == dept_id, Department.tenant_id == ctx.tenant_id))
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(dept, k, v)
    await db.flush()
    return DepartmentResponse.model_validate(dept)


@router.delete("/departments/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    dept_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    dept = await db.scalar(select(Department).where(Department.id == dept_id, Department.tenant_id == ctx.tenant_id))
    if dept:
        await db.delete(dept)
        await db.flush()


# ─── Designations ────────────────────────────────────────────────────────────

@router.get("/designations", response_model=PaginatedResponse[DesignationResponse])
async def list_designations(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    company_id: uuid.UUID | None = None,
    department_id: uuid.UUID | None = None,
    search: str | None = None,
):
    stmt = select(Designation).where(Designation.tenant_id == ctx.tenant_id)
    if company_id:
        stmt = stmt.where(Designation.company_id == company_id)
    if department_id:
        stmt = stmt.where(Designation.department_id == department_id)
    if search:
        stmt = stmt.where(Designation.name.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = (await db.scalars(stmt.order_by(Designation.name.asc()).offset((page - 1) * page_size).limit(page_size))).all()
    return paginate([DesignationResponse.model_validate(d) for d in items], total, page, page_size)


@router.post("/designations", response_model=DesignationResponse, status_code=status.HTTP_201_CREATED)
async def create_designation(
    payload: DesignationCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    desig = Designation(
        tenant_id=ctx.tenant_id,
        **payload.model_dump(),
    )
    db.add(desig)
    await db.flush()
    return DesignationResponse.model_validate(desig)


@router.get("/designations/{desig_id}", response_model=DesignationResponse)
async def get_designation(
    desig_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    desig = await db.scalar(select(Designation).where(Designation.id == desig_id, Designation.tenant_id == ctx.tenant_id))
    if not desig:
        raise HTTPException(status_code=404, detail="Designation not found")
    return DesignationResponse.model_validate(desig)


@router.patch("/designations/{desig_id}", response_model=DesignationResponse)
async def update_designation(
    desig_id: uuid.UUID,
    payload: DesignationUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    desig = await db.scalar(select(Designation).where(Designation.id == desig_id, Designation.tenant_id == ctx.tenant_id))
    if not desig:
        raise HTTPException(status_code=404, detail="Designation not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(desig, k, v)
    await db.flush()
    return DesignationResponse.model_validate(desig)


@router.delete("/designations/{desig_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_designation(
    desig_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    desig = await db.scalar(select(Designation).where(Designation.id == desig_id, Designation.tenant_id == ctx.tenant_id))
    if desig:
        await db.delete(desig)
        await db.flush()


# ─── Teams ───────────────────────────────────────────────────────────────────

@router.get("/teams", response_model=PaginatedResponse[TeamResponse])
async def list_teams(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    department_id: uuid.UUID | None = None,
    company_id: uuid.UUID | None = None,
    search: str | None = None,
):
    stmt = select(Team).where(Team.tenant_id == ctx.tenant_id)
    if department_id:
        stmt = stmt.where(Team.department_id == department_id)
    if company_id:
        stmt = stmt.where(Team.company_id == company_id)
    if search:
        stmt = stmt.where(Team.name.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = (await db.scalars(stmt.order_by(Team.name.asc()).offset((page - 1) * page_size).limit(page_size))).all()
    return paginate([TeamResponse.model_validate(t) for t in items], total, page, page_size)


@router.post("/teams", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    payload: TeamCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    team = Team(
        tenant_id=ctx.tenant_id,
        **payload.model_dump(),
    )
    db.add(team)
    await db.flush()
    return TeamResponse.model_validate(team)


@router.get("/teams/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    team = await db.scalar(select(Team).where(Team.id == team_id, Team.tenant_id == ctx.tenant_id))
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return TeamResponse.model_validate(team)


@router.patch("/teams/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: uuid.UUID,
    payload: TeamUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    team = await db.scalar(select(Team).where(Team.id == team_id, Team.tenant_id == ctx.tenant_id))
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(team, k, v)
    await db.flush()
    return TeamResponse.model_validate(team)


@router.delete("/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    team = await db.scalar(select(Team).where(Team.id == team_id, Team.tenant_id == ctx.tenant_id))
    if team:
        await db.delete(team)
        await db.flush()


# ─── Work Calendars ──────────────────────────────────────────────────────────

@router.get("/work-calendars", response_model=list[WorkCalendarResponse])
async def list_work_calendars(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    stmt = select(WorkCalendar).where(WorkCalendar.tenant_id == ctx.tenant_id).order_by(WorkCalendar.name.asc())
    items = (await db.scalars(stmt)).all()
    return [WorkCalendarResponse.model_validate(c) for c in items]


@router.post("/work-calendars", response_model=WorkCalendarResponse, status_code=status.HTTP_201_CREATED)
async def create_work_calendar(
    payload: WorkCalendarCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    cal = WorkCalendar(
        tenant_id=ctx.tenant_id,
        **payload.model_dump(),
    )
    db.add(cal)
    await db.flush()
    return WorkCalendarResponse.model_validate(cal)
