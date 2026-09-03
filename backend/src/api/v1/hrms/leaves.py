import uuid
from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import Employee, LeaveRequest, LeaveBalance, Department
from src.schemas.erp import (
    LeaveRequestCreate,
    LeaveRequestUpdate,
    LeaveRequestResponse,
    LeaveBalanceResponse,
)
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter(prefix="/hrms", tags=["HRMS - Leaves"])


@router.get("/leaves", response_model=PaginatedResponse[LeaveRequestResponse])
async def list_leave_requests(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    employee_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    query = (
        select(LeaveRequest, Employee, Department)
        .join(Employee, LeaveRequest.employee_id == Employee.id)
        .outerjoin(Department, Employee.department_id == Department.id)
        .where(LeaveRequest.tenant_id == ctx.tenant_id)
    )

    # If the user does not have company-wide leave viewing permissions, strictly isolate to their own leave requests
    if not (ctx.has_permission("view:hrms_leaves") or ctx.has_permission("manage:hrms") or getattr(ctx.user, "is_tenant_owner", False)):
        query = query.where((Employee.user_id == ctx.user.id) | (Employee.email == ctx.user.email))

    if employee_id:
        query = query.where(LeaveRequest.employee_id == employee_id)
    if status_filter:
        query = query.where(LeaveRequest.status == status_filter)

    count_query = (
        select(func.count(LeaveRequest.id))
        .join(Employee, LeaveRequest.employee_id == Employee.id)
        .where(LeaveRequest.tenant_id == ctx.tenant_id)
    )
    if not (ctx.has_permission("view:hrms_leaves") or ctx.has_permission("manage:hrms") or getattr(ctx.user, "is_tenant_owner", False)):
        count_query = count_query.where((Employee.user_id == ctx.user.id) | (Employee.email == ctx.user.email))
    if employee_id:
        count_query = count_query.where(LeaveRequest.employee_id == employee_id)
    if status_filter:
        count_query = count_query.where(LeaveRequest.status == status_filter)

    total = await db.scalar(count_query)
    result = await db.execute(
        query.order_by(LeaveRequest.from_date.desc(), Employee.full_name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    items = []
    for leave, emp, dept in result.all():
        items.append(
            LeaveRequestResponse(
                id=leave.id,
                tenant_id=leave.tenant_id,
                employee_id=leave.employee_id,
                employee_name=emp.full_name,
                department=dept.name if dept else "N/A",
                leave_type=leave.leave_type,
                from_date=leave.from_date,
                to_date=leave.to_date,
                days_requested=leave.days_requested,
                reason=leave.reason,
                status=leave.status,
                approved_by=leave.approved_by,
                approved_at=leave.approved_at,
                created_at=leave.created_at,
                updated_at=leave.updated_at,
            )
        )

    return paginate(items, total or 0, page, page_size)


@router.get("/leaves/balances", response_model=list[LeaveBalanceResponse])
async def get_leave_balances(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    employee_id: uuid.UUID | None = None,
):
    query = (
        select(LeaveBalance, Employee)
        .join(Employee, LeaveBalance.employee_id == Employee.id)
        .where(LeaveBalance.tenant_id == ctx.tenant_id)
    )
    if employee_id:
        query = query.where(LeaveBalance.employee_id == employee_id)

    result = await db.execute(query)
    
    balances = []
    for bal, emp in result.all():
        balances.append(
            LeaveBalanceResponse(
                id=bal.id,
                tenant_id=bal.tenant_id,
                employee_id=bal.employee_id,
                employee_name=emp.full_name,
                leave_type=bal.leave_type,
                total_days=bal.total_days,
                used_days=bal.used_days,
                balance=bal.balance,
            )
        )
    return balances


@router.post("/leaves", response_model=LeaveRequestResponse, status_code=status.HTTP_201_CREATED)
async def apply_leave(
    payload: LeaveRequestCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    emp = await db.scalar(
        select(Employee).where(
            (Employee.user_id == ctx.user.id) | (Employee.email == ctx.user.email),
            Employee.tenant_id == ctx.tenant_id
        )
    )
    if not emp:
        raise HTTPException(status_code=400, detail="No Employee profile linked to your user account")

    bal = await db.scalar(
        select(LeaveBalance).where(
            LeaveBalance.tenant_id == ctx.tenant_id,
            LeaveBalance.employee_id == emp.id,
            LeaveBalance.leave_type == payload.leave_type
        )
    )
    if not bal:
        bal = LeaveBalance(
            tenant_id=ctx.tenant_id,
            employee_id=emp.id,
            leave_type=payload.leave_type,
            total_days=15 if payload.leave_type != "Unpaid" else 0,
            used_days=0,
            balance=15 if payload.leave_type != "Unpaid" else 0
        )
        db.add(bal)
        await db.flush()

    if payload.leave_type != "Unpaid" and bal.balance < payload.days_requested:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient leave balance. Requested: {payload.days_requested} days, Available: {bal.balance} days."
        )

    leave = LeaveRequest(
        tenant_id=ctx.tenant_id,
        employee_id=emp.id,
        status="Pending",
        **payload.model_dump()
    )
    db.add(leave)
    await db.flush()

    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
        action="applied", entity_type="leave_request", entity_id=leave.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(leave)
    
    # Return mapping with name
    return LeaveRequestResponse(
        id=leave.id,
        tenant_id=leave.tenant_id,
        employee_id=leave.employee_id,
        employee_name=emp.full_name,
        leave_type=leave.leave_type,
        from_date=leave.from_date,
        to_date=leave.to_date,
        days_requested=leave.days_requested,
        reason=leave.reason,
        status=leave.status,
        approved_by=leave.approved_by,
        approved_at=leave.approved_at,
        created_at=leave.created_at,
        updated_at=leave.updated_at
    )


@router.patch("/leaves/{leave_id}/review", response_model=LeaveRequestResponse)
async def review_leave_request(
    leave_id: uuid.UUID,
    payload: LeaveRequestUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    leave = await db.scalar(
        select(LeaveRequest).where(LeaveRequest.id == leave_id, LeaveRequest.tenant_id == ctx.tenant_id)
    )
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if leave.status != "Pending":
        raise HTTPException(status_code=400, detail="Leave request has already been reviewed")

    leave.status = payload.status
    leave.approved_by = ctx.user.id
    leave.approved_at = datetime.now(timezone.utc)

    if payload.status == "Approved":
        bal = await db.scalar(
            select(LeaveBalance).where(
                LeaveBalance.tenant_id == ctx.tenant_id,
                LeaveBalance.employee_id == leave.employee_id,
                LeaveBalance.leave_type == leave.leave_type
            )
        )
        if bal:
            bal.used_days += leave.days_requested
            bal.balance = max(0, bal.total_days - bal.used_days)

    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
        action="reviewed", entity_type="leave_request", entity_id=leave.id,
        new_values={"status": payload.status},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(leave)
    
    emp = await db.scalar(select(Employee).where(Employee.id == leave.employee_id))
    return LeaveRequestResponse(
        id=leave.id,
        tenant_id=leave.tenant_id,
        employee_id=leave.employee_id,
        employee_name=emp.full_name if emp else "Employee",
        leave_type=leave.leave_type,
        from_date=leave.from_date,
        to_date=leave.to_date,
        days_requested=leave.days_requested,
        reason=leave.reason,
        status=leave.status,
        approved_by=leave.approved_by,
        approved_at=leave.approved_at,
        created_at=leave.created_at,
        updated_at=leave.updated_at
    )

# ─── Leave Policies Configuration ───────────────────────────────────

from src.models import LeavePolicy
from src.schemas.erp import LeavePolicyCreate, LeavePolicyResponse

@router.get("/leaves/policies", response_model=list[LeavePolicyResponse])
async def list_leave_policies(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(LeavePolicy).where(LeavePolicy.tenant_id == ctx.tenant_id).order_by(LeavePolicy.created_at.desc())
    )
    policies = result.scalars().all()
    
    # Auto-seed mock leave policies if empty
    if not policies:
        seed_policies = [
            LeavePolicy(tenant_id=ctx.tenant_id, name="Standard Annual Scheme", leave_type="Annual", entitled_days=18, applicable_to="All"),
            LeavePolicy(tenant_id=ctx.tenant_id, name="Sick Recovery Allowance", leave_type="Sick", entitled_days=12, applicable_to="All"),
            LeavePolicy(tenant_id=ctx.tenant_id, name="Casual Urgent Leave", leave_type="Casual", entitled_days=6, applicable_to="All"),
        ]
        for p in seed_policies:
            db.add(p)
        await db.commit()
        
        result = await db.execute(
            select(LeavePolicy).where(LeavePolicy.tenant_id == ctx.tenant_id).order_by(LeavePolicy.created_at.desc())
        )
        policies = result.scalars().all()

    return policies


@router.post("/leaves/policies", response_model=LeavePolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_leave_policy(
    payload: LeavePolicyCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    policy = LeavePolicy(
        tenant_id=ctx.tenant_id,
        **payload.model_dump()
    )
    db.add(policy)
    await db.flush()

    # Dynamically allocate this leave balance to all employees
    result_emps = await db.execute(select(Employee).where(Employee.tenant_id == ctx.tenant_id))
    emps = result_emps.scalars().all()
    for emp in emps:
        # Check if already exists
        existing = await db.scalar(
            select(LeaveBalance).where(
                LeaveBalance.tenant_id == ctx.tenant_id,
                LeaveBalance.employee_id == emp.id,
                LeaveBalance.leave_type == payload.leave_type
            )
        )
        if not existing:
            bal = LeaveBalance(
                tenant_id=ctx.tenant_id,
                employee_id=emp.id,
                leave_type=payload.leave_type,
                total_days=payload.entitled_days,
                used_days=0,
                balance=payload.entitled_days
            )
            db.add(bal)
            
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
        action="created_policy", entity_type="leave_policy", entity_id=policy.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(policy)
    return policy
