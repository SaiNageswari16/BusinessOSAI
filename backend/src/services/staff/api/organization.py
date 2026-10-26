"""Department, Designation, Team, Work Calendar, and ERP Company/Branch
compatibility endpoints for HRMS.

``companies`` and ``branches`` do not exist as tables in the microservice
split — the tenant *is* the company, and outlets (owned by the organization
service) are the branches. The legacy frontend's ``/erp/companies`` and
``/erp/branches`` calls are served here as read-only compatibility aliases
so the HRMS UI keeps working without any frontend changes.
"""
from __future__ import annotations

import uuid
from typing import Annotated, Sequence

import httpx
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


# ─── ERP Company / Branch (read-only compatibility aliases) ─────────────────

def _erp_identity_headers(ctx: CurrentUserContext) -> dict[str, str]:
    """Forward the caller's identity to the organization service over the mesh."""
    return {
        "X-Identity-User-Id": str(ctx.user_id),
        "X-Identity-Tenant-Id": str(ctx.tenant_id),
        "X-Identity-Email": ctx.identity.email or "",
        "X-Identity-Full-Name": ctx.identity.full_name or "",
        "X-Identity-Permissions": ",".join(sorted(ctx.identity.permissions)),
        "X-Identity-Roles": ",".join(sorted(ctx.identity.roles)),
        "X-Identity-Is-Owner": "true" if ctx.identity.is_tenant_owner else "false",
        "X-Identity-Tenant-Slug": ctx.identity.tenant_slug or "",
    }


async def _outlets_for_tenant(ctx: CurrentUserContext) -> list[dict]:
    from src.services.shared.registry import base_url, get_descriptor

    descriptor = get_descriptor("organization")
    if descriptor is None:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                f"{base_url(descriptor)}/api/v1/organization/outlets",
                headers=_erp_identity_headers(ctx),
            )
        if res.status_code != 200:
            return []
        body = res.json()
        return body if isinstance(body, list) else []
    except Exception:
        return []


@router.get("/companies", response_model=PaginatedResponse[dict])
async def list_companies_compat(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    search: str | None = None,
):
    """The tenant is the company in the microservice split. Return a single-row
    view of the active tenant so the HRMS UI's company-scoped UI has data."""
    row = {
        "id": str(ctx.tenant_id),
        "tenant_id": str(ctx.tenant_id),
        "name": ctx.identity.tenant_slug or "My Workspace",
        "industry": None,
        "status": "active",
    }
    if search and search.lower() not in row["name"].lower():
        return paginate([], 0, page, page_size)
    return paginate([row], 1, page, page_size)


@router.get("/branches", response_model=PaginatedResponse[dict])
async def list_branches_compat(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    search: str | None = None,
    company_id: uuid.UUID | None = None,
):
    """Outlets in the organization service, exposed as branches for HRMS UI."""
    items = await _outlets_for_tenant(ctx)
    if search:
        items = [o for o in items if search.lower() in (o.get("name") or "").lower()]
    total = len(items)
    sliced = items[(page - 1) * page_size : page * page_size]
    # Normalize outlet field names to the Branch shape the frontend expects.
    normalized = [
        {
            "id": str(o.get("id") or ""),
            "tenant_id": str(ctx.tenant_id),
            "company_id": str(ctx.tenant_id),
            "code": o.get("code") or "",
            "name": o.get("name") or "",
            "address": o.get("address_line1"),
            "city": o.get("city"),
            "state": o.get("state"),
            "country": o.get("country") or "IN",
            "phone": o.get("phone"),
            "email": o.get("email"),
            "has_warehouse": False,
            "status": "active" if o.get("is_active", True) else "inactive",
        }
        for o in sliced
    ]
    return paginate(normalized, total, page, page_size)


# ─── ERP Roles (compat proxy → auth service, the role owner post-split) ─────
# The monolith kept roles in-house; in the microservice split they live in the
# auth service. The HRMS role picker / employee-role assignment calls
# /erp/roles, so this proxies to auth over the mesh (identity-forwarded) and
# reshapes auth's plain-list / RoleResponse into the frontend's
# PaginatedResponse<Role> contract.

def _role_to_frontend(r: dict, ctx: CurrentUserContext) -> dict:
    """Auth RoleResponse → frontend Role shape."""
    is_active = r.get("is_active", True)
    return {
        "id": str(r.get("id") or ""),
        "tenant_id": str(ctx.tenant_id),
        "name": r.get("name") or "",
        "slug": r.get("slug") or "",
        "description": r.get("description"),
        "permissions": r.get("permissions") or [],
        "is_system": r.get("is_system", False),
        "status": "active" if is_active else "inactive",
    }


async def _auth_request(
    ctx: CurrentUserContext,
    method: str,
    path: str,
    *,
    json_body: dict | None = None,
) -> tuple[int, object]:
    from src.services.shared.registry import base_url, get_descriptor

    descriptor = get_descriptor("auth")
    if descriptor is None:
        return 503, {}
    url = f"{base_url(descriptor)}/api/v1/auth{path}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.request(
                method, url, json=json_body, headers=_erp_identity_headers(ctx)
            )
            try:
                return res.status_code, res.json()
            except ValueError:
                return res.status_code, {}
    except Exception:
        return 503, {}


@router.get("/roles", response_model=PaginatedResponse[dict])
async def list_roles_compat(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    search: str | None = None,
):
    _code, body = await _auth_request(ctx, "GET", "/roles")
    rows = body if isinstance(body, list) else []
    items = [_role_to_frontend(r, ctx) for r in rows]
    if search:
        items = [i for i in items if search.lower() in (i.get("name") or "").lower()]
    total = len(items)
    sliced = items[(page - 1) * page_size : page * page_size]
    return paginate(sliced, total, page, page_size)


@router.get("/roles/{role_id}", response_model=PaginatedResponse[dict])
async def get_role_compat(
    role_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
):
    """auth has no GET /roles/{id}; synthesize a single row from the list."""
    _code, body = await _auth_request(ctx, "GET", "/roles")
    rows = body if isinstance(body, list) else []
    match = next((r for r in rows if str(r.get("id")) == str(role_id)), None)
    if match is None:
        raise HTTPException(status_code=404, detail="Role not found")
    return paginate([_role_to_frontend(match, ctx)], 1, page, page_size)


@router.post("/roles", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_role_compat(
    payload: dict,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:hrms"))],
):
    body = dict(payload)
    # auth requires a slug; derive one from the name when the UI omits it.
    if not body.get("slug") and body.get("name"):
        slug = "".join(ch if ch.isalnum() else "_" for ch in body["name"].lower()).strip("_")
        body["slug"] = slug or "custom_role"
    code, resp = await _auth_request(ctx, "POST", "/roles", json_body=body)
    if code in (200, 201):
        return _role_to_frontend(resp, ctx) if isinstance(resp, dict) else {}
    detail = resp.get("detail") if isinstance(resp, dict) else f"auth returned {code}"
    raise HTTPException(status_code=code, detail=detail)


@router.patch("/roles/{role_id}", response_model=dict)
async def update_role_compat(
    role_id: uuid.UUID,
    payload: dict,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:hrms"))],
):
    body = dict(payload)
    # The frontend Role uses `status`; auth expects `is_active`.
    if "status" in body and "is_active" not in body:
        body["is_active"] = str(body["status"]).lower() in ("active", "true", "1")
    body.pop("slug", None)  # slug is immutable on auth updates
    code, resp = await _auth_request(ctx, "PATCH", f"/roles/{role_id}", json_body=body)
    if code == 200:
        return _role_to_frontend(resp, ctx) if isinstance(resp, dict) else {}
    detail = resp.get("detail") if isinstance(resp, dict) else f"auth returned {code}"
    raise HTTPException(status_code=code, detail=detail)


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role_compat(
    role_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:hrms"))],
):
    code, _ = await _auth_request(ctx, "DELETE", f"/roles/{role_id}")
    if code == 204:
        return None
    raise HTTPException(status_code=code, detail=f"auth returned {code}")
