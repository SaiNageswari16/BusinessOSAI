"""
HRMS — Employee Management Endpoints (Single & Bulk Import, Profiles, Documents)
"""
import logging
import uuid
from decimal import Decimal
from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("hrms.employees")

from src.api.deps import CurrentUserContext, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import (
    Employee,
    EmployeeDocument,
    User,
    Role,
    RolePermission,
    UserRole,
    Permission,
    UserStatus,
    Department,
    Designation,
    Tenant,
)
from src.utils.security import hash_password
from src.schemas.erp import (
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeResponse,
    EmployeeBulkCreate,
    EmployeeDocumentCreate,
    EmployeeDocumentResponse,
)
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter(prefix="/hrms", tags=["HRMS - Employee Management"])


# ─── Employees CRUD ───────────────────────────────────────────────

async def _enrich_employees_with_roles(db: AsyncSession, employees: list[Employee], tenant_id: uuid.UUID) -> list[EmployeeResponse]:
    if not employees:
        return []
    
    user_ids = [e.user_id for e in employees if e.user_id]
    user_role_map = {}
    if user_ids:
        stmt = (
            select(UserRole.user_id, Role.id, Role.name)
            .join(Role, UserRole.role_id == Role.id)
            .where(UserRole.user_id.in_(user_ids))
        )
        res = await db.execute(stmt)
        for uid, rid, rname in res.all():
            user_role_map[uid] = (rid, rname)
            
    emails = [e.email.lower() for e in employees if not e.user_id and e.email]
    if emails:
        stmt = (
            select(User.email, Role.id, Role.name)
            .join(UserRole, User.id == UserRole.user_id)
            .join(Role, UserRole.role_id == Role.id)
            .where(User.tenant_id == tenant_id, func.lower(User.email).in_(emails))
        )
        res = await db.execute(stmt)
        for uemail, rid, rname in res.all():
            user_role_map[uemail.lower()] = (rid, rname)

    responses = []
    for emp in employees:
        resp = EmployeeResponse.model_validate(emp)
        if emp.user_id and emp.user_id in user_role_map:
            resp.role_id, resp.role_name = user_role_map[emp.user_id]
        elif emp.email and emp.email.lower() in user_role_map:
            resp.role_id, resp.role_name = user_role_map[emp.email.lower()]
        responses.append(resp)
    return responses


async def _enrich_single_employee_role(db: AsyncSession, emp: Employee, tenant_id: uuid.UUID) -> EmployeeResponse:
    res = await _enrich_employees_with_roles(db, [emp], tenant_id)
    return res[0]


@router.get("/employees/me", response_model=EmployeeResponse)
async def get_my_employee_profile(
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
        # Auto-create linked Employee profile for current authenticated user in this workspace
        count = await db.scalar(
            select(func.count()).select_from(Employee).where(Employee.tenant_id == ctx.tenant_id)
        ) or 0
        seq = str(count + 1).zfill(4)
        emp = Employee(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user.id,
            employee_code=f"EMP-{seq}",
            full_name=ctx.user.full_name or ctx.user.email.split("@")[0].capitalize(),
            email=ctx.user.email,
            phone=ctx.user.phone,
            date_of_joining=date.today(),
            employment_type="Full-Time",
            status="Active",
            sales_points=0.0,
        )
        db.add(emp)
        await db.commit()
        await db.refresh(emp)
    return await _enrich_single_employee_role(db, emp, ctx.tenant_id)

@router.get("/employees", response_model=PaginatedResponse[EmployeeResponse])
async def list_employees(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    department_id: uuid.UUID | None = None,
    designation_id: uuid.UUID | None = None,
    status_filter: str | None = Query(None, alias="status"),
    role: str | None = Query(None, alias="role"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    search: str | None = None,
):
    # Auto-link any workspace User belonging to this tenant who doesn't have an Employee profile yet
    try:
        users_without_emp = await db.scalars(
            select(User).where(
                User.tenant_id == ctx.tenant_id,
                ~User.id.in_(
                    select(Employee.user_id).where(
                        Employee.user_id.is_not(None),
                        Employee.tenant_id == ctx.tenant_id
                    )
                )
            )
        )
        unlinked_users = users_without_emp.all()
        if unlinked_users:
            emp_count = await db.scalar(
                select(func.count()).select_from(Employee).where(Employee.tenant_id == ctx.tenant_id)
            ) or 0
            for u in unlinked_users:
                # Check if employee with this email already exists
                existing_emp = await db.scalar(
                    select(Employee).where(
                        Employee.tenant_id == ctx.tenant_id,
                        func.lower(Employee.email) == func.lower(u.email)
                    )
                )
                if existing_emp:
                    if not existing_emp.user_id:
                        existing_emp.user_id = u.id
                else:
                    code_found = False
                    while not code_found:
                        emp_count += 1
                        candidate_code = f"EMP-{str(emp_count).zfill(4)}"
                        code_exists = await db.scalar(
                            select(Employee.id).where(
                                Employee.tenant_id == ctx.tenant_id,
                                Employee.employee_code == candidate_code
                            )
                        )
                        if not code_exists:
                            code_found = True
                            db.add(Employee(
                                tenant_id=ctx.tenant_id,
                                user_id=u.id,
                                employee_code=candidate_code,
                                full_name=u.full_name or u.email.split('@')[0].capitalize(),
                                email=u.email,
                                phone=u.phone,
                                date_of_joining=date.today(),
                                employment_type="Full-Time",
                                status="Active",
                                sales_points=0.0,
                            ))
            await db.commit()
    except Exception as sync_err:
        await db.rollback()
        import logging
        logging.getLogger("hrms.employees").warning(f"Auto-link user to employee skipped: {sync_err}")

    query = select(Employee).where(Employee.tenant_id == ctx.tenant_id)

    # If the user does not have company-wide employee viewing permissions, strictly isolate to their own profile
    user_id = getattr(ctx.user, "id", None)
    user_email = getattr(ctx.user, "email", None)
    if not (ctx.has_permission("view:hrms_employees") or ctx.has_permission("manage:hrms") or ctx.is_tenant_owner):
        query = query.where((Employee.user_id == user_id) | (Employee.email == user_email))

    if department_id:
        query = query.where(Employee.department_id == department_id)
    if designation_id:
        query = query.where(Employee.designation_id == designation_id)
    if status_filter:
        query = query.where(Employee.status.ilike(status_filter))
    if role:
        matching_user_ids = select(UserRole.user_id).join(Role, UserRole.role_id == Role.id).where(Role.name.ilike(f"%{role}%"))
        matching_dept_ids = select(Department.id).where(Department.name.ilike(f"%{role}%"))
        matching_desig_ids = select(Designation.id).where(Designation.name.ilike(f"%{role}%"))
        query = query.where(
            (Employee.user_id.in_(matching_user_ids))
            | (Employee.department_id.in_(matching_dept_ids))
            | (Employee.designation_id.in_(matching_desig_ids))
        )
    if search:
        query = query.where(
            Employee.full_name.ilike(f"%{search}%")
            | Employee.employee_code.ilike(f"%{search}%")
            | Employee.email.ilike(f"%{search}%")
        )

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    
    # If role filter produced 0 results, fallback to returning all active employees for this workspace
    if (total or 0) == 0 and role:
        query = select(Employee).where(Employee.tenant_id == ctx.tenant_id, Employee.status.ilike("Active"))
        total = await db.scalar(select(func.count()).select_from(query.subquery()))

    result = await db.execute(
        query.order_by(Employee.employee_code.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    raw_employees = result.scalars().all()
    items = await _enrich_employees_with_roles(db, raw_employees, ctx.tenant_id)
    return paginate(items, total or 0, page, page_size)


@router.post("/employees", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    payload: EmployeeCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:hrms_employees"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # 1. Normalize fields
    payload.email = payload.email.strip().lower()
    if payload.employee_code:
        payload.employee_code = payload.employee_code.strip()

    # 2. Auto-generate employee code if none is provided or matches "AUTO" / is empty
    if not payload.employee_code or payload.employee_code in ("", "AUTO", "auto"):
        count = await db.scalar(
            select(func.count()).select_from(Employee).where(Employee.tenant_id == ctx.tenant_id)
        ) or 0
        candidate_num = count + 1
        while True:
            candidate = f"EMP-{candidate_num:04d}"
            exists = await db.scalar(
                select(Employee.id).where(
                    Employee.tenant_id == ctx.tenant_id,
                    Employee.employee_code == candidate
                )
            )
            if not exists:
                payload.employee_code = candidate
                break
            candidate_num += 1

    # 3. Check for existing code or email in tenant
    code_exists = await db.scalar(
        select(Employee).where(
            Employee.tenant_id == ctx.tenant_id,
            func.lower(Employee.employee_code) == payload.employee_code.lower()
        )
    )
    if code_exists:
        raise HTTPException(status_code=400, detail=f"Employee code '{payload.employee_code}' already exists in this workspace.")

    email_exists = await db.scalar(
        select(Employee).where(
            Employee.tenant_id == ctx.tenant_id,
            func.lower(Employee.email) == payload.email
        )
    )
    if email_exists:
        raise HTTPException(status_code=400, detail=f"Employee with email '{payload.email}' already exists in this workspace.")

    # Generate temporary password for the employee user
    temp_pass = f"Welcome@{payload.employee_code.replace('-', '')}"
    
    # Auto-create User account linked to employee
    existing_user = await db.scalar(
        select(User).where(User.tenant_id == ctx.tenant_id, User.email == payload.email)
    )
    
    linked_user_id = None
    if not existing_user:
        new_user = User(
            tenant_id=ctx.tenant_id,
            email=payload.email,
            password_hash=hash_password(temp_pass),
            full_name=payload.full_name,
            phone=payload.phone,
            avatar_initials="".join([n[0] for n in payload.full_name.split() if n][:2]).upper(),
            status=UserStatus.ACTIVE,
            must_change_password=True,
            employee_id=payload.employee_code,
        )
        db.add(new_user)
        await db.flush()
        linked_user_id = new_user.id
        
        # Determine which role to assign (from payload or fallback to standard Employee role)
        selected_role = None
        if payload.role_id:
            selected_role = await db.scalar(
                select(Role).where(Role.tenant_id == ctx.tenant_id, Role.id == payload.role_id)
            )
        
        if not selected_role:
            # Ensure Employee role exists and assign it
            selected_role = await db.scalar(
                select(Role).where(Role.tenant_id == ctx.tenant_id, Role.name == "Employee")
            )
            if not selected_role:
                selected_role = Role(
                    tenant_id=ctx.tenant_id,
                    name="Employee",
                    description="Standard employee access to ESS and profile logs",
                    is_system=False
                )
                db.add(selected_role)
                await db.flush()
                
                # Grant view:dashboard, view:hrms & all ESS permissions
                ess_perm_codes = [
                    "view:dashboard", "view:hrms", 
                    "view:ess_attendance", "view:ess_leaves", 
                    "view:ess_payroll", "view:ess_documents", 
                    "view:ess_tasks_announcements"
                ]
                for code in ess_perm_codes:
                    perm_obj = await db.scalar(select(Permission).where(Permission.code == code))
                    if perm_obj:
                        db.add(RolePermission(role_id=selected_role.id, permission_id=perm_obj.id))
                await db.flush()
            
        db.add(UserRole(
            user_id=new_user.id,
            role_id=selected_role.id,
            is_default=True,
            company_id=payload.company_id,
            branch_id=payload.branch_id
        ))
    else:
        linked_user_id = existing_user.id
        existing_user.employee_id = payload.employee_code
        if payload.role_id:
            target_role = await db.scalar(
                select(Role).where(Role.tenant_id == ctx.tenant_id, Role.id == payload.role_id)
            )
            if target_role:
                user_role = await db.scalar(
                    select(UserRole).where(UserRole.user_id == existing_user.id)
                )
                if user_role:
                    user_role.role_id = target_role.id
                    user_role.company_id = payload.company_id or user_role.company_id
                    user_role.branch_id = payload.branch_id or user_role.branch_id
                else:
                    db.add(UserRole(
                        user_id=existing_user.id,
                        role_id=target_role.id,
                        is_default=True,
                        company_id=payload.company_id,
                        branch_id=payload.branch_id
                    ))

    emp_data = payload.model_dump(exclude={"user_id", "role_id", "role_name"})
    emp = Employee(
        tenant_id=ctx.tenant_id,
        user_id=linked_user_id,
        **emp_data
    )
    db.add(emp)
    await db.flush()

    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
        action="created", entity_type="employee", entity_id=emp.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    
    # Try sending email invitation
    try:
        from src.utils.email import send_email
        from src.config import get_settings
        settings = get_settings()
        await send_email(
            subject=f"Welcome to {settings.app_name} - HR Portal Login",
            recipients=[payload.email],
            text=(
                f"Hello {payload.full_name},\n\n"
                f"Your employee profile has been created and you have been granted access to the {settings.app_name} HRMS Portal.\n\n"
                f"Employee Code: {payload.employee_code}\n"
                f"Temporary Password: {temp_pass}\n"
                f"Login URL: {settings.frontend_url or 'http://localhost:8080'}\n\n"
                f"Please log in and update your password on your first login.\n\n"
                f"Best regards,\nHR Department"
            )
        )
    except Exception as email_err:
        print(f"Simulation: Invite email could not be sent to {payload.email}: {email_err}")

    # Set the temporary password field in the schema object to present to UI
    response_obj = await _enrich_single_employee_role(db, emp, ctx.tenant_id)
    if not existing_user:
        response_obj.temporary_password = temp_pass
    return response_obj


@router.post("/employees/bulk", status_code=status.HTTP_201_CREATED)
async def bulk_create_employees(
    payload: EmployeeBulkCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:hrms_employees"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    created_count = 0
    skipped_count = 0
    errors = []

    for index, item in enumerate(payload.employees):
        # Validation checks
        code_exists = await db.scalar(
            select(Employee).where(Employee.tenant_id == ctx.tenant_id, Employee.employee_code == item.employee_code)
        )
        if code_exists:
            errors.append(f"Row {index + 1}: Employee code '{item.employee_code}' already exists")
            skipped_count += 1
            continue

        email_exists = await db.scalar(
            select(Employee).where(Employee.tenant_id == ctx.tenant_id, Employee.email == item.email)
        )
        if email_exists:
            errors.append(f"Row {index + 1}: Email '{item.email}' already exists")
            skipped_count += 1
            continue

        emp = Employee(
            tenant_id=ctx.tenant_id,
            **item.model_dump()
        )
        db.add(emp)
        created_count += 1

    if created_count > 0:
        await db.flush()
        await write_audit_log(
            db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
            action="bulk_created", entity_type="employee", entity_id=None,
            new_values={"count": created_count},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        await db.commit()

    return {
        "message": f"Successfully imported {created_count} employees.",
        "created_count": created_count,
        "skipped_count": skipped_count,
        "errors": errors
    }


@router.get("/employees/{emp_id}", response_model=EmployeeResponse)
async def get_employee(
    emp_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    emp = await db.scalar(
        select(Employee).where(Employee.id == emp_id, Employee.tenant_id == ctx.tenant_id)
    )
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return await _enrich_single_employee_role(db, emp, ctx.tenant_id)


@router.patch("/employees/{emp_id}", response_model=EmployeeResponse)
async def update_employee(
    emp_id: uuid.UUID,
    payload: EmployeeUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:hrms_employees"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    emp = await db.scalar(
        select(Employee).where(Employee.id == emp_id, Employee.tenant_id == ctx.tenant_id)
    )
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    updates = payload.model_dump(exclude_unset=True)
    role_id_to_update = updates.pop("role_id", None)
    updates.pop("role_name", None)

    for key, value in updates.items():
        if hasattr(emp, key):
            setattr(emp, key, value)

    if role_id_to_update is not None:
        target_role = await db.scalar(
            select(Role).where(Role.tenant_id == ctx.tenant_id, Role.id == role_id_to_update)
        )
        if target_role:
            user = None
            if emp.user_id:
                user = await db.get(User, emp.user_id)
            if not user and emp.email:
                user = await db.scalar(
                    select(User).where(User.tenant_id == ctx.tenant_id, func.lower(User.email) == emp.email.lower())
                )
            if user:
                user_role = await db.scalar(
                    select(UserRole).where(UserRole.user_id == user.id)
                )
                if user_role:
                    user_role.role_id = target_role.id
                    user_role.company_id = emp.company_id or user_role.company_id
                    user_role.branch_id = emp.branch_id or user_role.branch_id
                else:
                    db.add(UserRole(
                        user_id=user.id,
                        role_id=target_role.id,
                        is_default=True,
                        company_id=emp.company_id,
                        branch_id=emp.branch_id
                    ))

    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
        action="updated", entity_type="employee", entity_id=emp.id,
        new_values=payload.model_dump(exclude_unset=True, mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(emp)
    return await _enrich_single_employee_role(db, emp, ctx.tenant_id)


@router.post("/employees/{emp_id}/add-points", response_model=EmployeeResponse)
async def add_employee_sales_points(
    emp_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    points: float = Query(..., ge=0),
):
    emp = await db.scalar(
        select(Employee).where(Employee.id == emp_id, Employee.tenant_id == ctx.tenant_id)
    )
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp.sales_points = (emp.sales_points or Decimal("0")) + Decimal(str(points))
    await db.commit()
    await db.refresh(emp)
    return emp


@router.delete("/employees/{emp_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(
    emp_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:hrms_employees"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from sqlalchemy import text

    emp = await db.scalar(
        select(Employee).where(Employee.id == emp_id, Employee.tenant_id == ctx.tenant_id)
    )
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    emp_name = emp.full_name
    emp_code = emp.employee_code
    emp_user_id = emp.user_id
    emp_email = emp.email

    # 1. Nullify references pointing to this employee across all tables
    nullify_emp_queries = [
        "UPDATE employees SET manager_id = NULL WHERE manager_id = :eid",
        "UPDATE fixed_assets SET custodian_id = NULL WHERE custodian_id = :eid",
        "UPDATE expense_claims SET employee_id = NULL WHERE employee_id = :eid",
        "UPDATE users SET employee_id = NULL WHERE employee_id = :code OR employee_id = :eid_str",
        "UPDATE face_recognition_logs SET employee_id = NULL WHERE employee_id = :eid",
        "UPDATE performance_goals SET employee_id = NULL WHERE employee_id = :eid",
        "UPDATE recruitment_offer_letters SET employee_id = NULL WHERE employee_id = :eid",
    ]
    for q in nullify_emp_queries:
        try:
            async with db.begin_nested():
                await db.execute(text(q), {"eid": emp_id, "code": emp_code, "eid_str": str(emp_id)})
        except Exception as e:
            logger.debug("Employee nullify note: %s", e)

    # 2. Cascade delete all child records tied to this employee across all HRMS models
    cascade_delete_queries = [
        "DELETE FROM employee_documents WHERE employee_id = :eid",
        "DELETE FROM attendance_records WHERE employee_id = :eid",
        "DELETE FROM attendance_corrections WHERE employee_id = :eid",
        "DELETE FROM face_recognition_logs WHERE employee_id = :eid",
        "DELETE FROM leave_requests WHERE employee_id = :eid",
        "DELETE FROM leave_balances WHERE employee_id = :eid",
        "DELETE FROM salary_structures WHERE employee_id = :eid",
        "DELETE FROM payslips WHERE employee_id = :eid",
        "DELETE FROM hrms_employee_loans WHERE employee_id = :eid",
        "DELETE FROM hrms_salary_advances WHERE employee_id = :eid",
        "DELETE FROM hrms_employee_bonuses WHERE employee_id = :eid",
        "DELETE FROM hrms_sales_commissions WHERE employee_id = :eid",
        "DELETE FROM recruitment_offer_letters WHERE employee_id = :eid",
        "DELETE FROM recruitment_onboardings WHERE applicant_id IN (SELECT id FROM recruitment_applicants WHERE email = :emp_email)",
        "DELETE FROM performance_appraisals WHERE employee_id = :eid",
        "DELETE FROM performance_goals WHERE employee_id = :eid",
        "DELETE FROM exit_resignations WHERE employee_id = :eid",
        "DELETE FROM exit_clearance_tasks WHERE employee_id = :eid",
        "DELETE FROM exit_final_settlements WHERE employee_id = :eid",
        "DELETE FROM exit_experience_letters WHERE employee_id = :eid",
        "DELETE FROM shift_assignments WHERE employee_id = :eid",
        "DELETE FROM loan_records WHERE employee_id = :eid",
        "DELETE FROM salary_advances WHERE employee_id = :eid",
        "DELETE FROM exit_requests WHERE employee_id = :eid",
        "DELETE FROM performance_reviews WHERE employee_id = :eid",
        "DELETE FROM hrms_onboardings WHERE employee_id = :eid",
        "DELETE FROM hrms_offers WHERE employee_id = :eid",
    ]
    for q in cascade_delete_queries:
        try:
            async with db.begin_nested():
                await db.execute(text(q), {"eid": emp_id, "emp_email": emp_email or ""})
        except Exception as e:
            logger.debug("Employee cascade delete query note: %s", e)

    # 3. Clean up linked user login if one exists for this employee
    target_user_id = emp_user_id
    if not target_user_id and emp_email:
        u = await db.scalar(
            select(User).where(User.tenant_id == ctx.tenant_id, func.lower(User.email) == emp_email.lower())
        )
        if u:
            target_user_id = u.id

    if target_user_id and target_user_id != ctx.user.id:
        try:
            async with db.begin_nested():
                await db.execute(text("UPDATE departments SET head_user_id = NULL WHERE head_user_id = :uid"), {"uid": target_user_id})
                await db.execute(text("UPDATE regions SET manager_user_id = NULL WHERE manager_user_id = :uid"), {"uid": target_user_id})
                await db.execute(text("UPDATE zones SET manager_user_id = NULL WHERE manager_user_id = :uid"), {"uid": target_user_id})
                await db.execute(text("UPDATE teams SET lead_user_id = NULL WHERE lead_user_id = :uid"), {"uid": target_user_id})
                await db.execute(text("UPDATE business_units SET head_user_id = NULL WHERE head_user_id = :uid"), {"uid": target_user_id})
                await db.execute(text("DELETE FROM user_roles WHERE user_id = :uid"), {"uid": target_user_id})
                await db.execute(text("UPDATE employees SET user_id = NULL WHERE id = :eid"), {"eid": emp_id})
                await db.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": target_user_id})
        except Exception as e:
            logger.debug("Linked user cleanup note: %s", e)

    # 4. Write audit log
    try:
        await write_audit_log(
            db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
            action="deleted", entity_type="employee", entity_id=emp.id,
            old_values={"name": emp_name, "code": emp_code},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except Exception as e:
        logger.debug("Audit log note: %s", e)

    # 5. Direct SQL delete the employee record
    await db.execute(text("DELETE FROM employees WHERE id = :eid"), {"eid": emp_id})
    await db.commit()


# ─── Employee Documents ───────────────────────────────────────────

@router.get("/employees/{emp_id}/documents", response_model=list[EmployeeDocumentResponse])
async def list_employee_documents(
    emp_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Verify employee exists for tenant
    emp = await db.scalar(
        select(Employee).where(Employee.id == emp_id, Employee.tenant_id == ctx.tenant_id)
    )
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    result = await db.execute(
        select(EmployeeDocument)
        .where(EmployeeDocument.employee_id == emp_id, EmployeeDocument.tenant_id == ctx.tenant_id)
        .order_by(EmployeeDocument.upload_date.desc())
    )
    return result.scalars().all()


@router.post("/employees/{emp_id}/documents", response_model=EmployeeDocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_employee_document(
    emp_id: uuid.UUID,
    payload: EmployeeDocumentCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:hrms_employees"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    emp = await db.scalar(
        select(Employee).where(Employee.id == emp_id, Employee.tenant_id == ctx.tenant_id)
    )
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    doc = EmployeeDocument(
        tenant_id=ctx.tenant_id,
        employee_id=emp_id,
        **payload.model_dump()
    )
    db.add(doc)
    await db.flush()

    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
        action="created", entity_type="employee_document", entity_id=doc.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return doc


# ─── vCard & Digital Business Card QR Generation ──────────────────────────

def _build_vcard_for_employee(emp: Employee, company_name: str = "LazyMonkey AI", department: str = "", designation: str = "") -> str:
    """Build standards-compliant vCard 3.0 string."""
    full_name = (emp.full_name or "Employee").strip()
    name_parts = full_name.split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""
    
    org_line = company_name
    if department:
        org_line += f";{department}"
        
    lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        f"N:{last_name};{first_name};;;",
        f"FN:{full_name}",
        f"ORG:{org_line}",
    ]
    if designation:
        lines.append(f"TITLE:{designation}")
    if department:
        lines.append(f"ROLE:{department}")
    if emp.phone:
        clean_phone = "".join(c for c in emp.phone if c.isdigit() or c in "+- ()")
        lines.append(f"TEL;TYPE=WORK,VOICE:{clean_phone}")
        lines.append(f"TEL;TYPE=CELL:{clean_phone}")
    if emp.email:
        lines.append(f"EMAIL;TYPE=WORK,INTERNET:{emp.email}")
    lines.append(f"NOTE:Employee Code: {emp.employee_code or 'EMP'} | Status: {emp.status or 'Active'}")
    lines.append("URL:https://lazymonkeyai.com")
    lines.append(f"REV:{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}")
    lines.append("END:VCARD")
    return "\r\n".join(lines)


def _generate_vcard_qr_data_url(vcard_text: str) -> str:
    """Generate high-resolution scannable QR Code as base64 Data URL."""
    try:
        import qrcode
        import io
        import base64
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=2,
        )
        qr.add_data(vcard_text)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#1E1B4B", back_color="#FFFFFF")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"
    except Exception as e:
        import logging
        logging.getLogger("HRMS_vCard").warning(f"QR generation failed: {e}")
        return ""


@router.get("/employees/{emp_id}/vcard")
async def get_employee_vcard_details(
    emp_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Retrieve full vCard 3.0 contact details and scannable QR Code for an employee."""
    emp = await db.scalar(
        select(Employee).where(Employee.id == emp_id, Employee.tenant_id == ctx.tenant_id)
    )
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    tenant = await db.scalar(select(Tenant).where(Tenant.id == ctx.tenant_id))
    company_name = tenant.name if tenant else "LazyMonkey AI"

    dept_name = ""
    if emp.department_id:
        dept = await db.scalar(select(Department).where(Department.id == emp.department_id))
        if dept:
            dept_name = dept.name

    desig_name = ""
    if emp.designation_id:
        desig = await db.scalar(select(Designation).where(Designation.id == emp.designation_id))
        if desig:
            desig_name = desig.name

    vcard_raw = _build_vcard_for_employee(emp, company_name, dept_name, desig_name)
    qr_data_url = _generate_vcard_qr_data_url(vcard_raw)
    safe_name = "".join(c for c in emp.full_name if c.isalnum() or c in (" ", "_")).replace(" ", "_")

    return {
        "employee_id": str(emp.id),
        "employee_code": emp.employee_code,
        "full_name": emp.full_name,
        "email": emp.email,
        "phone": emp.phone,
        "company_name": company_name,
        "department": dept_name,
        "designation": desig_name,
        "status": emp.status,
        "date_of_joining": str(emp.date_of_joining) if emp.date_of_joining else "",
        "vcard_raw": vcard_raw,
        "qr_code_data_url": qr_data_url,
        "filename": f"{emp.employee_code or 'EMP'}_{safe_name}.vcf",
    }


@router.get("/employees/{emp_id}/vcard/download")
async def download_employee_vcard(
    emp_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Download single employee vCard (.vcf) file for iPhone / Android / Outlook import."""
    from fastapi.responses import Response

    emp = await db.scalar(
        select(Employee).where(Employee.id == emp_id, Employee.tenant_id == ctx.tenant_id)
    )
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    tenant = await db.scalar(select(Tenant).where(Tenant.id == ctx.tenant_id))
    company_name = tenant.name if tenant else "LazyMonkey AI"

    dept_name = ""
    if emp.department_id:
        dept = await db.scalar(select(Department).where(Department.id == emp.department_id))
        if dept:
            dept_name = dept.name

    desig_name = ""
    if emp.designation_id:
        desig = await db.scalar(select(Designation).where(Designation.id == emp.designation_id))
        if desig:
            desig_name = desig.name

    vcard_raw = _build_vcard_for_employee(emp, company_name, dept_name, desig_name)
    safe_name = "".join(c for c in emp.full_name if c.isalnum() or c in (" ", "_")).replace(" ", "_")
    filename = f"{emp.employee_code or 'EMP'}_{safe_name}.vcf"

    return Response(
        content=vcard_raw.encode("utf-8"),
        media_type="text/vcard; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache"
        }
    )


@router.get("/employees/vcard/bulk-export")
async def export_all_employees_vcard(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Export all active employees of this organization as a single bulk address book .vcf file."""
    from fastapi.responses import Response

    result = await db.execute(
        select(Employee).where(Employee.tenant_id == ctx.tenant_id).order_by(Employee.employee_code.asc())
    )
    employees = result.scalars().all()
    if not employees:
        raise HTTPException(status_code=404, detail="No employees found in directory")

    tenant = await db.scalar(select(Tenant).where(Tenant.id == ctx.tenant_id))
    company_name = tenant.name if tenant else "LazyMonkey AI"

    # Pre-fetch departments & designations
    dept_res = await db.execute(select(Department).where(Department.tenant_id == ctx.tenant_id))
    dept_map = {d.id: d.name for d in dept_res.scalars().all()}

    desig_res = await db.execute(select(Designation).where(Designation.tenant_id == ctx.tenant_id))
    desig_map = {d.id: d.name for d in desig_res.scalars().all()}

    vcard_blocks = []
    for emp in employees:
        dept_name = dept_map.get(emp.department_id, "")
        desig_name = desig_map.get(emp.designation_id, "")
        vcard_blocks.append(_build_vcard_for_employee(emp, company_name, dept_name, desig_name))

    bulk_vcard = "\r\n\r\n".join(vcard_blocks)
    filename = f"{company_name.replace(' ', '_')}_Employees_Directory.vcf"

    return Response(
        content=bulk_vcard.encode("utf-8"),
        media_type="text/vcard; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache"
        }
    )
