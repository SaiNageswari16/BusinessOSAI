import uuid
from typing import Annotated, TypeVar

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission, require_any_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import EntityStatus
from src.schemas.erp import (
    BranchCreate,
    BranchResponse,
    BranchUpdate,
    BusinessUnitCreate,
    BusinessUnitResponse,
    BusinessUnitUpdate,
    CompanyCreate,
    CompanyResponse,
    CompanyUpdate,
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    DesignationCreate,
    DesignationResponse,
    DesignationUpdate,
    RegionCreate,
    RegionResponse,
    RegionUpdate,
    TeamCreate,
    TeamResponse,
    TeamUpdate,
    ZoneCreate,
    ZoneResponse,
    ZoneUpdate,
)
from src.utils.pagination import PaginatedResponse, PaginationParams, paginate

router = APIRouter(prefix="/erp", tags=["Core ERP"])

T = TypeVar("T")


def _parse_status(value: str) -> EntityStatus:
    try:
        return EntityStatus(value.lower())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid status: {value}") from exc


# ─── Companies ───────────────────────────────────────────────────

@router.get("/companies", response_model=PaginatedResponse[CompanyResponse])
async def list_companies(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    from src.models import Company

    query = select(Company).where(Company.tenant_id == ctx.tenant_id)
    if search:
        query = query.where(Company.name.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(Company.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/companies", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    payload: CompanyCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:companies"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Company, Tenant
    from sqlalchemy.orm.attributes import flag_modified

    data = payload.model_dump(exclude={"status"})
    if data.get("logo_initials"):
        data["logo_initials"] = data["logo_initials"][:5]
    
    # If primary GST is in gst_registrations and top-level gst_number is empty, auto-set top-level
    gst_regs = data.get("gst_registrations") or []
    if not data.get("gst_number") and gst_regs:
        primary_gst = next((r.get("gstin") for r in gst_regs if r.get("is_primary")), gst_regs[0].get("gstin"))
        if primary_gst:
            data["gst_number"] = primary_gst

    company = Company(tenant_id=ctx.tenant_id, status=_parse_status(payload.status), **data)
    db.add(company)
    await db.flush()

    # Sync GSP credentials to Tenant settings if provided
    gsp_creds = data.get("gsp_credentials")
    if gsp_creds and isinstance(gsp_creds, dict):
        tenant = await db.scalar(select(Tenant).where(Tenant.id == ctx.tenant_id))
        if tenant:
            t_settings = tenant.settings or {}
            t_settings["whitebooks_config"] = gsp_creds
            tenant.settings = t_settings
            flag_modified(tenant, "settings")

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="created",
        entity_type="company",
        entity_id=company.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return company


@router.get("/companies/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Company

    company = await db.scalar(
        select(Company).where(Company.id == company_id, Company.tenant_id == ctx.tenant_id)
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.patch("/companies/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: uuid.UUID,
    payload: CompanyUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:companies"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Company, Tenant
    from sqlalchemy.orm.attributes import flag_modified

    company = await db.scalar(
        select(Company).where(Company.id == company_id, Company.tenant_id == ctx.tenant_id)
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    old_values = {"name": company.name, "status": company.status.value}
    updates = payload.model_dump(exclude_unset=True)
    if "logo_initials" in updates and updates["logo_initials"] is not None:
        updates["logo_initials"] = updates["logo_initials"][:5]
    if "status" in updates and updates["status"] is not None:
        updates["status"] = _parse_status(updates["status"])

    # Auto sync primary GSTIN
    if "gst_registrations" in updates and updates["gst_registrations"] is not None:
        gst_regs = updates["gst_registrations"]
        if not updates.get("gst_number") and gst_regs:
            primary_gst = next((r.get("gstin") for r in gst_regs if r.get("is_primary")), gst_regs[0].get("gstin"))
            if primary_gst:
                updates["gst_number"] = primary_gst

    for key, value in updates.items():
        setattr(company, key, value)

    # Sync GSP credentials to Tenant settings if updated
    if "gsp_credentials" in updates and isinstance(updates["gsp_credentials"], dict):
        tenant = await db.scalar(select(Tenant).where(Tenant.id == ctx.tenant_id))
        if tenant:
            t_settings = tenant.settings or {}
            t_settings["whitebooks_config"] = updates["gsp_credentials"]
            tenant.settings = t_settings
            flag_modified(tenant, "settings")

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="updated",
        entity_type="company",
        entity_id=company.id,
        old_values=old_values,
        new_values=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return company


@router.post("/companies/test-gsp-connection")
async def test_company_gsp_connection(
    payload: dict,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Test live handshake with Whitebooks GSP / Government Gateway for EWB, GST, or EINV.
    """
    from src.services.whitebooks_service import whitebooks_service

    module = payload.get("module", "ewb")
    credentials = payload.get("credentials")
    res = await whitebooks_service.test_module_connection(module, credentials)
    return res


@router.post("/companies/test-smtp")
async def test_smtp_configuration(
    payload: dict,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Test outbound SMTP connection and send a verified test email.
    Accepts explicit credentials dict or company_id.
    """
    from src.utils.email import test_smtp_connection, resolve_email_config
    from src.models import Company

    recipient_email = payload.get("recipient_email") or ctx.user.email
    credentials = payload.get("credentials") or payload.get("email_settings")
    company_id = payload.get("company_id")

    if not credentials and company_id:
        c_uuid = uuid.UUID(str(company_id)) if not isinstance(company_id, uuid.UUID) else company_id
        company = await db.get(Company, c_uuid)
        if company and company.email_settings:
            credentials = company.email_settings

    if not credentials:
        # Fallback to resolved config
        cfg = await resolve_email_config(db=db, tenant_id=ctx.tenant_id, company_id=company_id)
        credentials = {
            "mail_server": cfg.mail_server,
            "mail_port": cfg.mail_port,
            "mail_username": cfg.mail_username,
            "mail_password": cfg.mail_password,
            "mail_from": cfg.mail_from,
            "sender_name": cfg.sender_name,
            "use_tls": cfg.use_tls,
            "use_ssl": cfg.use_ssl,
        }

    res = await test_smtp_connection(credentials, recipient_email)
    return res


@router.post("/companies/{company_id}/test-smtp")
async def test_company_saved_smtp(
    company_id: uuid.UUID,
    payload: dict,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Test outbound SMTP connection specifically for an existing company.
    """
    from src.utils.email import test_smtp_connection
    from src.models import Company

    company = await db.scalar(
        select(Company).where(Company.id == company_id, Company.tenant_id == ctx.tenant_id)
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    recipient_email = payload.get("recipient_email") or ctx.user.email
    credentials = payload.get("credentials") or company.email_settings

    if not credentials or not credentials.get("mail_server"):
        raise HTTPException(status_code=400, detail="Company has no outbound SMTP server configured")

    res = await test_smtp_connection(credentials, recipient_email)
    return res


@router.delete("/companies/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(
    company_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:companies"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Company

    company = await db.scalar(
        select(Company).where(Company.id == company_id, Company.tenant_id == ctx.tenant_id)
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="deleted",
        entity_type="company",
        entity_id=company.id,
        old_values={"name": company.name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.delete(company)


# ─── Branches ────────────────────────────────────────────────────

@router.get("/branches", response_model=PaginatedResponse[BranchResponse])
async def list_branches(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    company_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    from src.models import Branch

    query = select(Branch).where(Branch.tenant_id == ctx.tenant_id)
    if company_id:
        query = query.where(Branch.company_id == company_id)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(Branch.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/branches", response_model=BranchResponse, status_code=status.HTTP_201_CREATED)
async def create_branch(
    payload: BranchCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:branches"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Branch, Company

    company = await db.scalar(
        select(Company).where(Company.id == payload.company_id, Company.tenant_id == ctx.tenant_id)
    )
    if not company:
        raise HTTPException(status_code=400, detail="Invalid company_id for this tenant")

    data = payload.model_dump(exclude={"status"})
    branch = Branch(tenant_id=ctx.tenant_id, status=_parse_status(payload.status), **data)
    db.add(branch)
    await db.flush()

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="created",
        entity_type="branch",
        entity_id=branch.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return branch


@router.patch("/branches/{branch_id}", response_model=BranchResponse)
async def update_branch(
    branch_id: uuid.UUID,
    payload: BranchUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:branches"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Branch

    branch = await db.scalar(
        select(Branch).where(Branch.id == branch_id, Branch.tenant_id == ctx.tenant_id)
    )
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates:
        updates["status"] = _parse_status(updates["status"])
    for key, value in updates.items():
        setattr(branch, key, value)
    return branch


# ─── Departments ─────────────────────────────────────────────────

@router.get("/departments", response_model=PaginatedResponse[DepartmentResponse])
async def list_departments(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    company_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    from src.models import Department

    query = select(Department).where(Department.tenant_id == ctx.tenant_id)
    if company_id:
        query = query.where(Department.company_id == company_id)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(Department.name).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/departments", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: DepartmentCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:companies"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Department

    data = payload.model_dump(exclude={"status"})
    dept = Department(tenant_id=ctx.tenant_id, status=_parse_status(payload.status), **data)
    db.add(dept)
    await db.flush()
    return dept


# ─── Designations ────────────────────────────────────────────────

@router.get("/designations", response_model=PaginatedResponse[DesignationResponse])
async def list_designations(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    company_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    from src.models import Designation

    query = select(Designation).where(Designation.tenant_id == ctx.tenant_id)
    if company_id:
        query = query.where(Designation.company_id == company_id)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.order_by(Designation.name).offset((page - 1) * page_size).limit(page_size))
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/designations", response_model=DesignationResponse, status_code=status.HTTP_201_CREATED)
async def create_designation(
    payload: DesignationCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:companies"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Designation

    data = payload.model_dump(exclude={"status"})
    designation = Designation(tenant_id=ctx.tenant_id, status=_parse_status(payload.status), **data)
    db.add(designation)
    await db.flush()
    return designation


# ─── Regions ──────────────────────────────────────────────────────

@router.get("/regions", response_model=PaginatedResponse[RegionResponse])
async def list_regions(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    company_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    from src.models import Region

    query = select(Region).where(Region.tenant_id == ctx.tenant_id)
    if company_id:
        query = query.where(Region.company_id == company_id)
    if search:
        query = query.where(Region.name.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.order_by(Region.name).offset((page - 1) * page_size).limit(page_size))
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/regions", response_model=RegionResponse, status_code=status.HTTP_201_CREATED)
async def create_region(
    payload: RegionCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:companies"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Company, Region

    company = await db.scalar(
        select(Company).where(Company.id == payload.company_id, Company.tenant_id == ctx.tenant_id)
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    region = Region(
        tenant_id=ctx.tenant_id,
        company_id=payload.company_id,
        name=payload.name,
        code=payload.code,
        country=payload.country,
        manager_user_id=payload.manager_user_id,
        status=_parse_status(payload.status),
    )
    db.add(region)
    await db.flush()

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="created",
        entity_type="region",
        entity_id=region.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return region


@router.get("/regions/{region_id}", response_model=RegionResponse)
async def get_region(
    region_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Region

    region = await db.scalar(
        select(Region).where(Region.id == region_id, Region.tenant_id == ctx.tenant_id)
    )
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    return region


@router.patch("/regions/{region_id}", response_model=RegionResponse)
async def update_region(
    region_id: uuid.UUID,
    payload: RegionUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:companies"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Region

    region = await db.scalar(
        select(Region).where(Region.id == region_id, Region.tenant_id == ctx.tenant_id)
    )
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")

    old_values = {"name": region.name, "code": region.code}
    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates:
        updates["status"] = _parse_status(updates["status"])
    for key, value in updates.items():
        setattr(region, key, value)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="updated",
        entity_type="region",
        entity_id=region.id,
        old_values=old_values,
        new_values=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return region


@router.delete("/regions/{region_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_region(
    region_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:companies"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Region

    region = await db.scalar(
        select(Region).where(Region.id == region_id, Region.tenant_id == ctx.tenant_id)
    )
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="deleted",
        entity_type="region",
        entity_id=region.id,
        old_values={"name": region.name, "code": region.code},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.delete(region)
    await db.commit()


# ─── Zones ────────────────────────────────────────────────────────

@router.get("/zones", response_model=PaginatedResponse[ZoneResponse])
async def list_zones(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    region_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    from src.models import Zone

    query = select(Zone).where(Zone.tenant_id == ctx.tenant_id)
    if region_id:
        query = query.where(Zone.region_id == region_id)
    if search:
        query = query.where(Zone.name.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.order_by(Zone.name).offset((page - 1) * page_size).limit(page_size))
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/zones", response_model=ZoneResponse, status_code=status.HTTP_201_CREATED)
async def create_zone(
    payload: ZoneCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:companies"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Region, Zone

    region = await db.scalar(
        select(Region).where(Region.id == payload.region_id, Region.tenant_id == ctx.tenant_id)
    )
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")

    zone = Zone(
        tenant_id=ctx.tenant_id,
        region_id=payload.region_id,
        name=payload.name,
        manager_user_id=payload.manager_user_id,
        status=_parse_status(payload.status),
    )
    db.add(zone)
    await db.flush()

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="created",
        entity_type="zone",
        entity_id=zone.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return zone


@router.get("/zones/{zone_id}", response_model=ZoneResponse)
async def get_zone(
    zone_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Zone

    zone = await db.scalar(select(Zone).where(Zone.id == zone_id, Zone.tenant_id == ctx.tenant_id))
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    return zone


@router.patch("/zones/{zone_id}", response_model=ZoneResponse)
async def update_zone(
    zone_id: uuid.UUID,
    payload: ZoneUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:companies"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Zone

    zone = await db.scalar(select(Zone).where(Zone.id == zone_id, Zone.tenant_id == ctx.tenant_id))
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    old_values = {"name": zone.name}
    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates:
        updates["status"] = _parse_status(updates["status"])
    for key, value in updates.items():
        setattr(zone, key, value)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="updated",
        entity_type="zone",
        entity_id=zone.id,
        old_values=old_values,
        new_values=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return zone


@router.delete("/zones/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_zone(
    zone_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:companies"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Zone

    zone = await db.scalar(select(Zone).where(Zone.id == zone_id, Zone.tenant_id == ctx.tenant_id))
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="deleted",
        entity_type="zone",
        entity_id=zone.id,
        old_values={"name": zone.name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.delete(zone)
    await db.commit()


# ─── Teams ────────────────────────────────────────────────────────

@router.get("/teams", response_model=PaginatedResponse[TeamResponse])
async def list_teams(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    department_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    from src.models import Team

    query = select(Team).where(Team.tenant_id == ctx.tenant_id)
    if department_id:
        query = query.where(Team.department_id == department_id)
    if search:
        query = query.where(Team.name.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.order_by(Team.name).offset((page - 1) * page_size).limit(page_size))
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/teams", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    payload: TeamCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:companies"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Department, Team

    department = await db.scalar(
        select(Department).where(Department.id == payload.department_id, Department.tenant_id == ctx.tenant_id)
    )
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    team = Team(
        tenant_id=ctx.tenant_id,
        department_id=payload.department_id,
        branch_id=payload.branch_id,
        name=payload.name,
        lead_user_id=payload.lead_user_id,
        status=_parse_status(payload.status),
    )
    db.add(team)
    await db.flush()

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="created",
        entity_type="team",
        entity_id=team.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return team


@router.get("/teams/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Team

    team = await db.scalar(select(Team).where(Team.id == team_id, Team.tenant_id == ctx.tenant_id))
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


@router.patch("/teams/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: uuid.UUID,
    payload: TeamUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:companies"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Team

    team = await db.scalar(select(Team).where(Team.id == team_id, Team.tenant_id == ctx.tenant_id))
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    old_values = {"name": team.name}
    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates:
        updates["status"] = _parse_status(updates["status"])
    for key, value in updates.items():
        setattr(team, key, value)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="updated",
        entity_type="team",
        entity_id=team.id,
        old_values=old_values,
        new_values=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return team


@router.delete("/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:companies"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Team

    team = await db.scalar(select(Team).where(Team.id == team_id, Team.tenant_id == ctx.tenant_id))
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="deleted",
        entity_type="team",
        entity_id=team.id,
        old_values={"name": team.name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.delete(team)
    await db.commit()


# ─── Business Units ───────────────────────────────────────────────

@router.get("/business-units", response_model=PaginatedResponse[BusinessUnitResponse])
async def list_business_units(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    company_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    from src.models import BusinessUnit

    query = select(BusinessUnit).where(BusinessUnit.tenant_id == ctx.tenant_id)
    if company_id:
        query = query.where(BusinessUnit.company_id == company_id)
    if search:
        query = query.where(BusinessUnit.name.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.order_by(BusinessUnit.name).offset((page - 1) * page_size).limit(page_size))
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/business-units", response_model=BusinessUnitResponse, status_code=status.HTTP_201_CREATED)
async def create_business_unit(
    payload: BusinessUnitCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:companies"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import BusinessUnit, Company

    company = await db.scalar(
        select(Company).where(Company.id == payload.company_id, Company.tenant_id == ctx.tenant_id)
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    business_unit = BusinessUnit(
        tenant_id=ctx.tenant_id,
        company_id=payload.company_id,
        name=payload.name,
        head_user_id=payload.head_user_id,
        status=_parse_status(payload.status),
    )
    db.add(business_unit)
    await db.flush()

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="created",
        entity_type="business_unit",
        entity_id=business_unit.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return business_unit


@router.get("/business-units/{business_unit_id}", response_model=BusinessUnitResponse)
async def get_business_unit(
    business_unit_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import BusinessUnit

    business_unit = await db.scalar(
        select(BusinessUnit).where(BusinessUnit.id == business_unit_id, BusinessUnit.tenant_id == ctx.tenant_id)
    )
    if not business_unit:
        raise HTTPException(status_code=404, detail="Business unit not found")
    return business_unit


@router.patch("/business-units/{business_unit_id}", response_model=BusinessUnitResponse)
async def update_business_unit(
    business_unit_id: uuid.UUID,
    payload: BusinessUnitUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:companies"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import BusinessUnit

    business_unit = await db.scalar(
        select(BusinessUnit).where(BusinessUnit.id == business_unit_id, BusinessUnit.tenant_id == ctx.tenant_id)
    )
    if not business_unit:
        raise HTTPException(status_code=404, detail="Business unit not found")

    old_values = {"name": business_unit.name}
    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates:
        updates["status"] = _parse_status(updates["status"])
    for key, value in updates.items():
        setattr(business_unit, key, value)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="updated",
        entity_type="business_unit",
        entity_id=business_unit.id,
        old_values=old_values,
        new_values=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return business_unit


@router.delete("/business-units/{business_unit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_business_unit(
    business_unit_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:companies"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import BusinessUnit

    business_unit = await db.scalar(
        select(BusinessUnit).where(BusinessUnit.id == business_unit_id, BusinessUnit.tenant_id == ctx.tenant_id)
    )
    if not business_unit:
        raise HTTPException(status_code=404, detail="Business unit not found")

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="deleted",
        entity_type="business_unit",
        entity_id=business_unit.id,
        old_values={"name": business_unit.name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.delete(business_unit)
    await db.commit()
