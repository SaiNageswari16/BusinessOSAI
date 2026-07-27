"""Fixed Assets — Categories, Assets, Depreciation."""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models.erp import FixedAsset, FixedAssetCategory, FixedAssetDepreciation
from src.schemas.erp_accounting import (
    FixedAssetCategoryCreate,
    FixedAssetCategoryResponse,
    FixedAssetCategoryUpdate,
    FixedAssetCreate,
    FixedAssetDepreciationResponse,
    FixedAssetResponse,
    FixedAssetUpdate,
)
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter(prefix="/fixed-assets", tags=["Fixed Assets"])


# ─── Categories ────────────────────────────────────────────────

@router.get("/categories", response_model=list[FixedAssetCategoryResponse])
async def list_categories(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:fixed_assets"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(FixedAssetCategory)
        .where(FixedAssetCategory.tenant_id == ctx.tenant_id)
        .order_by(FixedAssetCategory.name)
    )
    return result.scalars().all()


@router.post(
    "/categories",
    response_model=FixedAssetCategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_category(
    payload: FixedAssetCategoryCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:fixed_assets"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    category = FixedAssetCategory(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(category)
    await db.flush()
    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="fixed_assets",
        action="fa_category_created",
        entity_type="fa_category",
        entity_id=category.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(category)
    return category


@router.patch("/categories/{category_id}", response_model=FixedAssetCategoryResponse)
async def update_category(
    category_id: uuid.UUID,
    payload: FixedAssetCategoryUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:fixed_assets"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    category = await db.scalar(
        select(FixedAssetCategory).where(
            FixedAssetCategory.id == category_id,
            FixedAssetCategory.tenant_id == ctx.tenant_id,
        )
    )
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(category, key, value)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="fixed_assets",
        action="fa_category_updated",
        entity_type="fa_category",
        entity_id=category.id,
        new_values=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(category)
    return category


# ─── Assets ────────────────────────────────────────────────────

@router.get("", response_model=PaginatedResponse[FixedAssetResponse])
async def list_assets(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:fixed_assets"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category_id: uuid.UUID | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = None,
):
    query = select(FixedAsset).where(FixedAsset.tenant_id == ctx.tenant_id)
    if category_id:
        query = query.where(FixedAsset.category_id == category_id)
    if status_filter:
        query = query.where(FixedAsset.status == status_filter)
    if search:
        query = query.where(
            FixedAsset.asset_number.ilike(f"%{search}%")
            | FixedAsset.name.ilike(f"%{search}%")
        )

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(FixedAsset.purchase_date.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.get("/{asset_id}", response_model=FixedAssetResponse)
async def get_asset(
    asset_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:fixed_assets"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    asset = await db.scalar(
        select(FixedAsset)
        .options(selectinload(FixedAsset.depreciation_runs))
        .where(FixedAsset.id == asset_id, FixedAsset.tenant_id == ctx.tenant_id)
    )
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.post(
    "",
    response_model=FixedAssetResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_asset(
    payload: FixedAssetCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:fixed_assets"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.utils.number_series import generate_number

    asset_number = await generate_number(db, ctx.tenant_id, "fa_asset", payload.company_id)

    asset = FixedAsset(
        tenant_id=ctx.tenant_id,
        asset_number=asset_number,
        net_book_value=payload.purchase_cost,
        accumulated_depreciation=0,
        **payload.model_dump(),
    )
    db.add(asset)
    await db.flush()

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="fixed_assets",
        action="fa_asset_created",
        entity_type="fa_asset",
        entity_id=asset.id,
        new_values={"asset_number": asset_number, "purchase_cost": str(payload.purchase_cost)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(asset)
    return asset


@router.patch("/{asset_id}", response_model=FixedAssetResponse)
async def update_asset(
    asset_id: uuid.UUID,
    payload: FixedAssetUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:fixed_assets"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    asset = await db.scalar(
        select(FixedAsset).where(
            FixedAsset.id == asset_id, FixedAsset.tenant_id == ctx.tenant_id
        )
    )
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(asset, key, value)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="fixed_assets",
        action="fa_asset_updated",
        entity_type="fa_asset",
        entity_id=asset.id,
        new_values=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(asset)
    return asset


# ─── Depreciation ──────────────────────────────────────────────

@router.post("/{asset_id}/depreciate", response_model=FixedAssetDepreciationResponse)
async def run_depreciation(
    asset_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:fixed_assets"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    period_start: str | None = None,
    period_end: str | None = None,
):
    asset = await db.scalar(
        select(FixedAsset).where(FixedAsset.id == asset_id, FixedAsset.tenant_id == ctx.tenant_id)
    )
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if asset.status != "active":
        raise HTTPException(status_code=400, detail="Only active assets can be depreciated")

    category = await db.scalar(
        select(FixedAssetCategory).where(FixedAssetCategory.id == asset.category_id)
    )
    if not category:
        raise HTTPException(status_code=400, detail="Asset has no category")

    monthly_rate = category.depreciation_method.value if hasattr(category.depreciation_method, 'value') else category.depreciation_method
    
    remaining_life_months = asset.useful_life_months
    depreciation_amount = 0.0
    
    if asset.depreciation_method == "straight_line":
        monthly_depr = (asset.purchase_cost - asset.salvage_value) / asset.useful_life_months
        depreciation_amount = round(monthly_depr, 2)
    elif asset.depreciation_method == "declining_balance":
        rate = 2 / asset.useful_life_months
        book_value = asset.net_book_value
        depreciation_amount = round(book_value * rate / 12, 2)
    else:
        depreciation_amount = 0.0

    if asset.net_book_value - depreciation_amount < asset.salvage_value:
        depreciation_amount = max(0, asset.net_book_value - asset.salvage_value)

    from datetime import date as dt_date

    dep_run = FixedAssetDepreciation(
        tenant_id=ctx.tenant_id,
        asset_id=asset.id,
        depreciation_date=dt_date.today(),
        period_start=dt_date.fromisoformat(period_start) if period_start else dt_date.today(),
        period_end=dt_date.fromisoformat(period_end) if period_end else dt_date.today(),
        depreciation_amount=depreciation_amount,
        accumulated_after=asset.accumulated_depreciation + depreciation_amount,
        net_book_value_after=asset.net_book_value - depreciation_amount,
    )
    db.add(dep_run)

    asset.accumulated_depreciation += depreciation_amount
    asset.net_book_value -= depreciation_amount

    if asset.net_book_value <= asset.salvage_value:
        asset.status = "scrapped"

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="fixed_assets",
        action="fa_depreciation_run",
        entity_type="fa_asset",
        entity_id=asset.id,
        new_values={"depreciation_amount": str(depreciation_amount)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(dep_run)
    return dep_run
