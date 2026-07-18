import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.session import get_db
from src.models import LearningCourse, LearningCertificate, LearningAssessment
from src.schemas.erp import (
    LearningCourseCreate, LearningCourseResponse,
    LearningCertificateCreate, LearningCertificateResponse,
    LearningAssessmentCreate, LearningAssessmentResponse
)
from src.api.deps import CurrentUserContext, require_permission
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter()

# ─── Courses ──────────────────────────────────────────────────────────

@router.get("/courses", response_model=PaginatedResponse[LearningCourseResponse])
async def list_courses(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    query = select(LearningCourse).where(LearningCourse.tenant_id == ctx.tenant_id)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(LearningCourse.title.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/courses", response_model=LearningCourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    payload: LearningCourseCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    new_course = LearningCourse(
        tenant_id=ctx.tenant_id,
        title=payload.title,
        category=payload.category,
        instructor=payload.instructor,
        duration=payload.duration,
        enrolled=payload.enrolled,
        completion=payload.completion,
        status=payload.status,
    )
    db.add(new_course)
    await db.commit()
    await db.refresh(new_course)
    return new_course


# ─── Certificates ─────────────────────────────────────────────────────

@router.get("/certificates", response_model=PaginatedResponse[LearningCertificateResponse])
async def list_certificates(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    query = select(LearningCertificate).where(LearningCertificate.tenant_id == ctx.tenant_id)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(LearningCertificate.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/certificates", response_model=LearningCertificateResponse, status_code=status.HTTP_201_CREATED)
async def create_certificate(
    payload: LearningCertificateCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    new_cert = LearningCertificate(
        tenant_id=ctx.tenant_id,
        employee_name=payload.employee_name,
        cert_name=payload.cert_name,
        issuer=payload.issuer,
        issued_date=payload.issued_date,
        expiry_date=payload.expiry_date,
        status=payload.status,
    )
    db.add(new_cert)
    await db.commit()
    await db.refresh(new_cert)
    return new_cert


# ─── Assessments ──────────────────────────────────────────────────────

@router.get("/assessments", response_model=PaginatedResponse[LearningAssessmentResponse])
async def list_assessments(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    query = select(LearningAssessment).where(LearningAssessment.tenant_id == ctx.tenant_id)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(LearningAssessment.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/assessments", response_model=LearningAssessmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assessment(
    payload: LearningAssessmentCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    new_assess = LearningAssessment(
        tenant_id=ctx.tenant_id,
        title=payload.title,
        course_name=payload.course_name,
        due_date=payload.due_date,
        participants=payload.participants,
        avg_score=payload.avg_score,
        status=payload.status,
    )
    db.add(new_assess)
    await db.commit()
    await db.refresh(new_assess)
    return new_assess
