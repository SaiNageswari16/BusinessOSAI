import os

target = os.path.join("backend", "src", "api", "v1", "hrms", "leaves.py")

leaves_router_code = """import uuid
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

    if employee_id:
        query = query.where(LeaveRequest.employee_id == employee_id)
    if status_filter:
        query = query.where(LeaveRequest.status == status_filter)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
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

    # Auto-seed mock leave requests & balances if table is completely empty
    if not items and page == 1:
        emp = await db.scalar(select(Employee).where(Employee.tenant_id == ctx.tenant_id))
        if emp:
            balances = [
                LeaveBalance(tenant_id=ctx.tenant_id, employee_id=emp.id, leave_type="Annual", total_days=18, used_days=4, balance=14),
                LeaveBalance(tenant_id=ctx.tenant_id, employee_id=emp.id, leave_type="Sick", total_days=12, used_days=1, balance=11),
                LeaveBalance(tenant_id=ctx.tenant_id, employee_id=emp.id, leave_type="Casual", total_days=6, used_days=2, balance=4),
            ]
            for bal in balances:
                db.add(bal)
            
            requests = [
                LeaveRequest(tenant_id=ctx.tenant_id, employee_id=emp.id, leave_type="Annual", from_date=date(2026, 7, 1), to_date=date(2026, 7, 5), days_requested=4, reason="Family trip", status="Approved", approved_by=ctx.user.id, approved_at=datetime.now(timezone.utc)),
                LeaveRequest(tenant_id=ctx.tenant_id, employee_id=emp.id, leave_type="Sick", from_date=date(2026, 7, 10), to_date=date(2026, 7, 10), days_requested=1, reason="Fever recovery", status="Approved", approved_by=ctx.user.id, approved_at=datetime.now(timezone.utc)),
                LeaveRequest(tenant_id=ctx.tenant_id, employee_id=emp.id, leave_type="Casual", from_date=date(2026, 7, 24), to_date=date(2026, 7, 25), days_requested=2, reason="Personal emergency", status="Pending"),
            ]
            for req in requests:
                db.add(req)
            await db.commit()

            result = await db.execute(query.order_by(LeaveRequest.from_date.desc(), Employee.full_name.asc()))
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
            total = len(items)

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
        select(Employee).where(Employee.user_id == ctx.user.id, Employee.tenant_id == ctx.tenant_id)
    )
    if not emp:
        emp = await db.scalar(select(Employee).where(Employee.tenant_id == ctx.tenant_id))
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
"""

with open(target, "w", encoding="utf-8", newline="\n") as f:
    f.write(leaves_router_code)

print("Recreated leaves.py router successfully")
