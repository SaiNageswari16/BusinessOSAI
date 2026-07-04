import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import (
    FiscalYear,
    Currency,
    TaxConfiguration,
    PaymentTerm,
    CostCenter,
    NumberSeries,
    EntityStatus,
)
from src.schemas.erp import (
    FiscalYearCreate,
    FiscalYearResponse,
    FiscalYearUpdate,
    CurrencyCreate,
    CurrencyResponse,
    CurrencyUpdate,
    TaxConfigurationCreate,
    TaxConfigurationResponse,
    TaxConfigurationUpdate,
    PaymentTermCreate,
    PaymentTermResponse,
    PaymentTermUpdate,
    CostCenterCreate,
    CostCenterResponse,
    CostCenterUpdate,
    NumberSeriesCreate,
    NumberSeriesResponse,
    NumberSeriesUpdate,
)
from src.utils.pagination import PaginatedResponse, PaginationParams, paginate

router = APIRouter(prefix="/erp", tags=["Core ERP"])


def _parse_status(value: str) -> EntityStatus:
    try:
        return EntityStatus(value.lower())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid status: {value}") from exc


@router.get("/fiscal-years", response_model=PaginatedResponse[FiscalYearResponse])
async def list_fiscal_years(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    company_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    query = select(FiscalYear).where(FiscalYear.tenant_id == ctx.tenant_id)
    if company_id:
        query = query.where(FiscalYear.company_id == company_id)
    if search:
        query = query.where(FiscalYear.name.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(FiscalYear.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/fiscal-years", response_model=FiscalYearResponse, status_code=status.HTTP_201_CREATED)
async def create_fiscal_year(
    payload: FiscalYearCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = payload.model_dump()
    fy = FiscalYear(tenant_id=ctx.tenant_id, **data)
    db.add(fy)
    await db.flush()

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="created",
        entity_type="fiscal_year",
        entity_id=fy.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return fy


@router.get("/fiscal-years/{fy_id}", response_model=FiscalYearResponse)
async def get_fiscal_year(
    fy_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    fy = await db.scalar(select(FiscalYear).where(FiscalYear.id == fy_id, FiscalYear.tenant_id == ctx.tenant_id))
    if not fy:
        raise HTTPException(status_code=404, detail="Fiscal year not found")
    return fy


@router.patch("/fiscal-years/{fy_id}", response_model=FiscalYearResponse)
async def update_fiscal_year(
    fy_id: uuid.UUID,
    payload: FiscalYearUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    fy = await db.scalar(select(FiscalYear).where(FiscalYear.id == fy_id, FiscalYear.tenant_id == ctx.tenant_id))
    if not fy:
        raise HTTPException(status_code=404, detail="Fiscal year not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(fy, key, value)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="updated",
        entity_type="fiscal_year",
        entity_id=fy.id,
        old_values=None,
        new_values=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return fy


@router.delete("/fiscal-years/{fy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fiscal_year(
    fy_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    fy = await db.scalar(select(FiscalYear).where(FiscalYear.id == fy_id, FiscalYear.tenant_id == ctx.tenant_id))
    if not fy:
        raise HTTPException(status_code=404, detail="Fiscal year not found")

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="deleted",
        entity_type="fiscal_year",
        entity_id=fy.id,
        old_values={"name": fy.name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.delete(fy)


# --- Currencies -------------------------------------------------

@router.get("/currencies", response_model=PaginatedResponse[CurrencyResponse])
async def list_currencies(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    query = select(Currency).where(Currency.tenant_id == ctx.tenant_id)
    if search:
        query = query.where(Currency.code.ilike(f"%{search}%") | Currency.symbol.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(Currency.code.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/currencies", response_model=CurrencyResponse, status_code=status.HTTP_201_CREATED)
async def create_currency(
    payload: CurrencyCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = payload.model_dump()
    curr = Currency(tenant_id=ctx.tenant_id, **data)
    db.add(curr)
    await db.flush()

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="created",
        entity_type="currency",
        entity_id=curr.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return curr


@router.get("/currencies/{currency_id}", response_model=CurrencyResponse)
async def get_currency(
    currency_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    curr = await db.scalar(select(Currency).where(Currency.id == currency_id, Currency.tenant_id == ctx.tenant_id))
    if not curr:
        raise HTTPException(status_code=404, detail="Currency not found")
    return curr


@router.patch("/currencies/{currency_id}", response_model=CurrencyResponse)
async def update_currency(
    currency_id: uuid.UUID,
    payload: CurrencyUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    curr = await db.scalar(select(Currency).where(Currency.id == currency_id, Currency.tenant_id == ctx.tenant_id))
    if not curr:
        raise HTTPException(status_code=404, detail="Currency not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(curr, key, value)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="updated",
        entity_type="currency",
        entity_id=curr.id,
        old_values=None,
        new_values=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return curr


@router.delete("/currencies/{currency_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_currency(
    currency_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    curr = await db.scalar(select(Currency).where(Currency.id == currency_id, Currency.tenant_id == ctx.tenant_id))
    if not curr:
        raise HTTPException(status_code=404, detail="Currency not found")

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="deleted",
        entity_type="currency",
        entity_id=curr.id,
        old_values={"code": curr.code},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.delete(curr)


# --- Tax Configurations -----------------------------------------

@router.get("/tax-configurations", response_model=PaginatedResponse[TaxConfigurationResponse])
async def list_tax_configs(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    company_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    query = select(TaxConfiguration).where(TaxConfiguration.tenant_id == ctx.tenant_id)
    if company_id:
        query = query.where(TaxConfiguration.company_id == company_id)
    if search:
        query = query.where(TaxConfiguration.name.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(TaxConfiguration.name.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/tax-configurations", response_model=TaxConfigurationResponse, status_code=status.HTTP_201_CREATED)
async def create_tax_config(
    payload: TaxConfigurationCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = payload.model_dump()
    tconf = TaxConfiguration(tenant_id=ctx.tenant_id, **data)
    db.add(tconf)
    await db.flush()

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="created",
        entity_type="tax_configuration",
        entity_id=tconf.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return tconf


@router.get("/tax-configurations/{tc_id}", response_model=TaxConfigurationResponse)
async def get_tax_config(
    tc_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tconf = await db.scalar(select(TaxConfiguration).where(TaxConfiguration.id == tc_id, TaxConfiguration.tenant_id == ctx.tenant_id))
    if not tconf:
        raise HTTPException(status_code=404, detail="Tax configuration not found")
    return tconf


@router.patch("/tax-configurations/{tc_id}", response_model=TaxConfigurationResponse)
async def update_tax_config(
    tc_id: uuid.UUID,
    payload: TaxConfigurationUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tconf = await db.scalar(select(TaxConfiguration).where(TaxConfiguration.id == tc_id, TaxConfiguration.tenant_id == ctx.tenant_id))
    if not tconf:
        raise HTTPException(status_code=404, detail="Tax configuration not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(tconf, key, value)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="updated",
        entity_type="tax_configuration",
        entity_id=tconf.id,
        old_values=None,
        new_values=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return tconf


@router.delete("/tax-configurations/{tc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tax_config(
    tc_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tconf = await db.scalar(select(TaxConfiguration).where(TaxConfiguration.id == tc_id, TaxConfiguration.tenant_id == ctx.tenant_id))
    if not tconf:
        raise HTTPException(status_code=404, detail="Tax configuration not found")

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="deleted",
        entity_type="tax_configuration",
        entity_id=tconf.id,
        old_values={"name": tconf.name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.delete(tconf)


# --- Payment Terms, Cost Centers, Number Series can follow same pattern ---

@router.get("/payment-terms", response_model=PaginatedResponse[PaymentTermResponse])
async def list_payment_terms(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    query = select(PaymentTerm).where(PaymentTerm.tenant_id == ctx.tenant_id)
    if search:
        query = query.where(PaymentTerm.name.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(PaymentTerm.name.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/payment-terms", response_model=PaymentTermResponse, status_code=status.HTTP_201_CREATED)
async def create_payment_term(
    payload: PaymentTermCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = payload.model_dump()
    pt = PaymentTerm(tenant_id=ctx.tenant_id, **data)
    db.add(pt)
    await db.flush()

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="created",
        entity_type="payment_term",
        entity_id=pt.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return pt


@router.get("/payment-terms/{pt_id}", response_model=PaymentTermResponse)
async def get_payment_term(
    pt_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    pt = await db.scalar(select(PaymentTerm).where(PaymentTerm.id == pt_id, PaymentTerm.tenant_id == ctx.tenant_id))
    if not pt:
        raise HTTPException(status_code=404, detail="Payment term not found")
    return pt


@router.patch("/payment-terms/{pt_id}", response_model=PaymentTermResponse)
async def update_payment_term(
    pt_id: uuid.UUID,
    payload: PaymentTermUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    pt = await db.scalar(select(PaymentTerm).where(PaymentTerm.id == pt_id, PaymentTerm.tenant_id == ctx.tenant_id))
    if not pt:
        raise HTTPException(status_code=404, detail="Payment term not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(pt, key, value)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="updated",
        entity_type="payment_term",
        entity_id=pt.id,
        old_values=None,
        new_values=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return pt


@router.delete("/payment-terms/{pt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment_term(
    pt_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    pt = await db.scalar(select(PaymentTerm).where(PaymentTerm.id == pt_id, PaymentTerm.tenant_id == ctx.tenant_id))
    if not pt:
        raise HTTPException(status_code=404, detail="Payment term not found")

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="deleted",
        entity_type="payment_term",
        entity_id=pt.id,
        old_values={"name": pt.name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.delete(pt)


# --- Cost Centers ------------------------------------------------

@router.get("/cost-centers", response_model=PaginatedResponse[CostCenterResponse])
async def list_cost_centers(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    department_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    query = select(CostCenter).where(CostCenter.tenant_id == ctx.tenant_id)
    if department_id:
        query = query.where(CostCenter.department_id == department_id)
    if search:
        query = query.where(CostCenter.name.ilike(f"%{search}%") | CostCenter.code.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(CostCenter.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/cost-centers", response_model=CostCenterResponse, status_code=status.HTTP_201_CREATED)
async def create_cost_center(
    payload: CostCenterCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = payload.model_dump()
    cc = CostCenter(tenant_id=ctx.tenant_id, **data)
    db.add(cc)
    await db.flush()

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="created",
        entity_type="cost_center",
        entity_id=cc.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return cc


@router.get("/cost-centers/{cc_id}", response_model=CostCenterResponse)
async def get_cost_center(
    cc_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    cc = await db.scalar(select(CostCenter).where(CostCenter.id == cc_id, CostCenter.tenant_id == ctx.tenant_id))
    if not cc:
        raise HTTPException(status_code=404, detail="Cost center not found")
    return cc


@router.patch("/cost-centers/{cc_id}", response_model=CostCenterResponse)
async def update_cost_center(
    cc_id: uuid.UUID,
    payload: CostCenterUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    cc = await db.scalar(select(CostCenter).where(CostCenter.id == cc_id, CostCenter.tenant_id == ctx.tenant_id))
    if not cc:
        raise HTTPException(status_code=404, detail="Cost center not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(cc, key, value)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="updated",
        entity_type="cost_center",
        entity_id=cc.id,
        old_values=None,
        new_values=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return cc


@router.delete("/cost-centers/{cc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cost_center(
    cc_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    cc = await db.scalar(select(CostCenter).where(CostCenter.id == cc_id, CostCenter.tenant_id == ctx.tenant_id))
    if not cc:
        raise HTTPException(status_code=404, detail="Cost center not found")

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="deleted",
        entity_type="cost_center",
        entity_id=cc.id,
        old_values={"code": cc.code},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.delete(cc)


# --- Number Series -----------------------------------------------

@router.get("/number-series", response_model=PaginatedResponse[NumberSeriesResponse])
async def list_number_series(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    company_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    query = select(NumberSeries).where(NumberSeries.tenant_id == ctx.tenant_id)
    if company_id:
        query = query.where(NumberSeries.company_id == company_id)
    if search:
        query = query.where(NumberSeries.module_name.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(NumberSeries.module_name.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/number-series", response_model=NumberSeriesResponse, status_code=status.HTTP_201_CREATED)
async def create_number_series(
    payload: NumberSeriesCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = payload.model_dump()
    ns = NumberSeries(tenant_id=ctx.tenant_id, **data)
    db.add(ns)
    await db.flush()

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="created",
        entity_type="number_series",
        entity_id=ns.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return ns


@router.get("/number-series/{ns_id}", response_model=NumberSeriesResponse)
async def get_number_series(
    ns_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ns = await db.scalar(select(NumberSeries).where(NumberSeries.id == ns_id, NumberSeries.tenant_id == ctx.tenant_id))
    if not ns:
        raise HTTPException(status_code=404, detail="Number series not found")
    return ns


@router.patch("/number-series/{ns_id}", response_model=NumberSeriesResponse)
async def update_number_series(
    ns_id: uuid.UUID,
    payload: NumberSeriesUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ns = await db.scalar(select(NumberSeries).where(NumberSeries.id == ns_id, NumberSeries.tenant_id == ctx.tenant_id))
    if not ns:
        raise HTTPException(status_code=404, detail="Number series not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(ns, key, value)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="updated",
        entity_type="number_series",
        entity_id=ns.id,
        old_values=None,
        new_values=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return ns


@router.delete("/number-series/{ns_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_number_series(
    ns_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:financials"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ns = await db.scalar(select(NumberSeries).where(NumberSeries.id == ns_id, NumberSeries.tenant_id == ctx.tenant_id))
    if not ns:
        raise HTTPException(status_code=404, detail="Number series not found")

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="deleted",
        entity_type="number_series",
        entity_id=ns.id,
        old_values={"module_name": ns.module_name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.delete(ns)
