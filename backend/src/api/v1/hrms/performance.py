import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.session import get_db
from src.models import PerformanceGoal, PerformanceKpi, PerformanceAppraisal, PerformanceIncentive
from src.schemas.erp import (
    PerformanceGoalCreate, PerformanceGoalUpdate, PerformanceGoalResponse,
    PerformanceKpiCreate, PerformanceKpiResponse,
    PerformanceAppraisalCreate, PerformanceAppraisalUpdate, PerformanceAppraisalResponse,
    PerformanceIncentiveCreate, PerformanceIncentiveResponse
)
from src.api.deps import CurrentUserContext, require_permission
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter()

# ─── Goals ────────────────────────────────────────────────────────────

@router.get("/goals", response_model=PaginatedResponse[PerformanceGoalResponse])
async def list_goals(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    employee_id: uuid.UUID | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    query = select(PerformanceGoal).where(PerformanceGoal.tenant_id == ctx.tenant_id)
    if employee_id:
        query = query.where(PerformanceGoal.employee_id == employee_id)
    if status:
        query = query.where(PerformanceGoal.status == status)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(PerformanceGoal.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/goals", response_model=PerformanceGoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    payload: PerformanceGoalCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    new_goal = PerformanceGoal(
        tenant_id=ctx.tenant_id,
        employee_id=payload.employee_id,
        employee_name=payload.employee_name,
        title=payload.title,
        description=payload.description,
        target_date=payload.target_date,
        weight=payload.weight,
        progress=payload.progress,
        status=payload.status,
    )
    db.add(new_goal)
    await db.commit()
    await db.refresh(new_goal)
    return new_goal


@router.patch("/goals/{id}", response_model=PerformanceGoalResponse)
async def update_goal(
    id: uuid.UUID,
    payload: PerformanceGoalUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    goal = await db.get(PerformanceGoal, id)
    if not goal or goal.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Goal not found")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(goal, k, v)

    await db.commit()
    await db.refresh(goal)
    return goal


# ─── KPIs ─────────────────────────────────────────────────────────────

@router.get("/kpis", response_model=PaginatedResponse[PerformanceKpiResponse])
async def list_kpis(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    query = select(PerformanceKpi).where(PerformanceKpi.tenant_id == ctx.tenant_id)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(PerformanceKpi.metric.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/kpis", response_model=PerformanceKpiResponse, status_code=status.HTTP_201_CREATED)
async def create_kpi(
    payload: PerformanceKpiCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    new_kpi = PerformanceKpi(
        tenant_id=ctx.tenant_id,
        metric=payload.metric,
        target=payload.target,
        current=payload.current,
        unit=payload.unit,
        achievement=payload.achievement,
    )
    db.add(new_kpi)
    await db.commit()
    await db.refresh(new_kpi)
    return new_kpi


# ─── Appraisals ───────────────────────────────────────────────────────

@router.get("/appraisals", response_model=PaginatedResponse[PerformanceAppraisalResponse])
async def list_appraisals(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    query = select(PerformanceAppraisal).where(PerformanceAppraisal.tenant_id == ctx.tenant_id)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(PerformanceAppraisal.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/appraisals", response_model=PerformanceAppraisalResponse, status_code=status.HTTP_201_CREATED)
async def create_appraisal(
    payload: PerformanceAppraisalCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    new_appraisal = PerformanceAppraisal(
        tenant_id=ctx.tenant_id,
        employee_id=payload.employee_id,
        employee_name=payload.employee_name,
        department=payload.department,
        period=payload.period,
        self_score=payload.self_score,
        manager_score=payload.manager_score,
        final_score=payload.final_score,
        rating=payload.rating,
        reviewer=payload.reviewer,
        status=payload.status,
    )
    db.add(new_appraisal)
    await db.commit()
    await db.refresh(new_appraisal)
    return new_appraisal


@router.patch("/appraisals/{id}", response_model=PerformanceAppraisalResponse)
async def update_appraisal(
    id: uuid.UUID,
    payload: PerformanceAppraisalUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    appraisal = await db.get(PerformanceAppraisal, id)
    if not appraisal or appraisal.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Appraisal not found")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(appraisal, k, v)

    await db.commit()
    await db.refresh(appraisal)
    return appraisal


# ─── Incentives ───────────────────────────────────────────────────────

@router.get("/incentives", response_model=PaginatedResponse[PerformanceIncentiveResponse])
async def list_incentives(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    query = select(PerformanceIncentive).where(PerformanceIncentive.tenant_id == ctx.tenant_id)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(PerformanceIncentive.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/incentives", response_model=PerformanceIncentiveResponse, status_code=status.HTTP_201_CREATED)
async def create_incentive(
    payload: PerformanceIncentiveCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    new_incentive = PerformanceIncentive(
        tenant_id=ctx.tenant_id,
        employee_name=payload.employee_name,
        department=payload.department,
        type=payload.type,
        basis=payload.basis,
        amount=payload.amount,
        status=payload.status,
    )
    db.add(new_incentive)
    await db.commit()
    await db.refresh(new_incentive)
    return new_incentive
