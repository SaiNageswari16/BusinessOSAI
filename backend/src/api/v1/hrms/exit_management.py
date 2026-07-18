import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.session import get_db
from src.models import ExitResignation, ExitClearanceTask, ExitFinalSettlement, ExitExperienceLetter
from src.schemas.erp import (
    ExitResignationCreate, ExitResignationUpdate, ExitResignationResponse,
    ExitClearanceTaskCreate, ExitClearanceTaskUpdate, ExitClearanceTaskResponse,
    ExitFinalSettlementCreate, ExitFinalSettlementResponse,
    ExitExperienceLetterCreate, ExitExperienceLetterUpdate, ExitExperienceLetterResponse
)
from src.api.deps import CurrentUserContext, require_permission
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter(prefix="/hrms/exit", tags=["HRMS Exit Management"])

# ─── Resignations ─────────────────────────────────────────────────────

@router.get("/resignations", response_model=PaginatedResponse[ExitResignationResponse])
async def list_resignations(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    query = select(ExitResignation).where(ExitResignation.tenant_id == ctx.tenant_id)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(ExitResignation.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/resignations", response_model=ExitResignationResponse, status_code=status.HTTP_201_CREATED)
async def create_resignation(
    payload: ExitResignationCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    new_res = ExitResignation(
        tenant_id=ctx.tenant_id,
        employee_id=payload.employee_id,
        employee_name=payload.employee_name,
        department=payload.department,
        designation=payload.designation,
        last_working_day=payload.last_working_day,
        reason=payload.reason,
        status=payload.status
    )
    db.add(new_res)
    await db.commit()
    await db.refresh(new_res)
    return new_res


@router.patch("/resignations/{id}", response_model=ExitResignationResponse)
async def update_resignation(
    id: uuid.UUID,
    payload: ExitResignationUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    res = await db.get(ExitResignation, id)
    if not res or res.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Resignation request not found")

    old_status = res.status
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(res, k, v)

    # If the resignation is marked as Completed (relieved)
    if res.status == "Completed" and old_status != "Completed":
        from src.models import Employee
        from datetime import date
        
        from_date = date.today()
        if res.employee_id:
            emp = await db.get(Employee, res.employee_id)
            if emp:
                from_date = emp.date_of_joining
                emp.status = "Inactive"
        
        # Check if experience letter already exists
        letter_check = await db.scalar(
            select(ExitExperienceLetter).where(
                ExitExperienceLetter.tenant_id == ctx.tenant_id,
                ExitExperienceLetter.employee_id == res.employee_id
            )
        )
        if not letter_check:
            new_letter = ExitExperienceLetter(
                tenant_id=ctx.tenant_id,
                employee_id=res.employee_id,
                employee_name=res.employee_name,
                designation=res.designation or "Employee",
                from_date=from_date,
                to_date=res.last_working_day or date.today(),
                issued_on=date.today().strftime("%Y-%m-%d"),
                status="Pending Approval"
            )
            db.add(new_letter)

    await db.commit()
    await db.refresh(res)
    return res


# ─── Clearance Tasks ──────────────────────────────────────────────────

@router.get("/clearance", response_model=PaginatedResponse[ExitClearanceTaskResponse])
async def list_clearance_tasks(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    query = select(ExitClearanceTask).where(ExitClearanceTask.tenant_id == ctx.tenant_id)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(ExitClearanceTask.department.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/clearance", response_model=ExitClearanceTaskResponse, status_code=status.HTTP_201_CREATED)
async def create_clearance_task(
    payload: ExitClearanceTaskCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    new_task = ExitClearanceTask(
        tenant_id=ctx.tenant_id,
        employee_id=payload.employee_id,
        employee_name=payload.employee_name,
        department=payload.department,
        task=payload.task,
        status=payload.status,
        assigned_to=payload.assigned_to
    )
    db.add(new_task)
    await db.commit()
    await db.refresh(new_task)
    return new_task


@router.patch("/clearance/{id}", response_model=ExitClearanceTaskResponse)
async def update_clearance_task(
    id: uuid.UUID,
    payload: ExitClearanceTaskUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    task = await db.get(ExitClearanceTask, id)
    if not task or task.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Clearance task not found")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(task, k, v)

    await db.commit()
    await db.refresh(task)
    return task


# ─── Final Settlements ────────────────────────────────────────────────

@router.get("/settlements", response_model=PaginatedResponse[ExitFinalSettlementResponse])
async def list_settlements(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    query = select(ExitFinalSettlement).where(ExitFinalSettlement.tenant_id == ctx.tenant_id)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(ExitFinalSettlement.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/settlements", response_model=ExitFinalSettlementResponse, status_code=status.HTTP_201_CREATED)
async def create_settlement(
    payload: ExitFinalSettlementCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    new_set = ExitFinalSettlement(
        tenant_id=ctx.tenant_id,
        employee_id=payload.employee_id,
        employee_name=payload.employee_name,
        last_working_day=payload.last_working_day,
        components_json=payload.components_json
    )
    db.add(new_set)
    await db.commit()
    await db.refresh(new_set)
    return new_set


# ─── Experience Letters ───────────────────────────────────────────────

@router.get("/experience-letters", response_model=PaginatedResponse[ExitExperienceLetterResponse])
async def list_experience_letters(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    query = select(ExitExperienceLetter).where(ExitExperienceLetter.tenant_id == ctx.tenant_id)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(ExitExperienceLetter.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/experience-letters", response_model=ExitExperienceLetterResponse, status_code=status.HTTP_201_CREATED)
async def create_experience_letter(
    payload: ExitExperienceLetterCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    new_letter = ExitExperienceLetter(
        tenant_id=ctx.tenant_id,
        employee_id=payload.employee_id,
        employee_name=payload.employee_name,
        designation=payload.designation,
        from_date=payload.from_date,
        to_date=payload.to_date,
        issued_on=payload.issued_on,
        status=payload.status
    )
    db.add(new_letter)
    await db.commit()
    await db.refresh(new_letter)
    return new_letter


@router.patch("/experience-letters/{id}", response_model=ExitExperienceLetterResponse)
async def update_experience_letter(
    id: uuid.UUID,
    payload: ExitExperienceLetterUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    letter = await db.get(ExitExperienceLetter, id)
    if not letter or letter.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Experience letter record not found")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(letter, k, v)

    await db.commit()
    await db.refresh(letter)
    return letter
