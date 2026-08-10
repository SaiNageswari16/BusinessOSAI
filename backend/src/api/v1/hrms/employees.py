"""
HRMS — Employee Management Endpoints (Single & Bulk Import, Profiles, Documents)
"""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

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

@router.get("/employees/me", response_model=EmployeeResponse)
async def get_my_employee_profile(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    emp = await db.scalar(
        select(Employee).where(Employee.user_id == ctx.user.id, Employee.tenant_id == ctx.tenant_id)
    )
    if not emp:
        emp = await db.scalar(select(Employee).where(Employee.tenant_id == ctx.tenant_id))
        if not emp:
            raise HTTPException(status_code=404, detail="Employee profile not found for this user account")
    return emp

@router.get("/employees", response_model=PaginatedResponse[EmployeeResponse])
async def list_employees(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    department_id: uuid.UUID | None = None,
    designation_id: uuid.UUID | None = None,
    status_filter: str | None = Query(None, alias="status"),
    role: str | None = Query(None, alias="role"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    query = select(Employee).where(Employee.tenant_id == ctx.tenant_id)
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
    result = await db.execute(
        query.order_by(Employee.employee_code.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/employees", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    payload: EmployeeCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:hrms_employees"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # 1. Auto-generate employee code if none is provided or matches "AUTO" / is empty
    if not payload.employee_code or payload.employee_code.strip() in ("", "AUTO"):
        count = await db.scalar(
            select(func.count()).select_from(Employee).where(Employee.tenant_id == ctx.tenant_id)
        )
        payload.employee_code = f"EMP-{(count or 0) + 1:04d}"

    # 2. Check for existing code or email in tenant
    code_exists = await db.scalar(
        select(Employee).where(Employee.tenant_id == ctx.tenant_id, Employee.employee_code == payload.employee_code)
    )
    if code_exists:
        raise HTTPException(status_code=400, detail="Employee code already exists for this workspace")

    email_exists = await db.scalar(
        select(Employee).where(Employee.tenant_id == ctx.tenant_id, Employee.email == payload.email)
    )
    if email_exists:
        raise HTTPException(status_code=400, detail="Employee email already exists for this workspace")

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
        
        # Ensure Employee role exists and assign it
        role = await db.scalar(
            select(Role).where(Role.tenant_id == ctx.tenant_id, Role.name == "Employee")
        )
        if not role:
            role = Role(
                tenant_id=ctx.tenant_id,
                name="Employee",
                description="Standard employee access to ESS and profile logs",
                is_system=False
            )
            db.add(role)
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
                    db.add(RolePermission(role_id=role.id, permission_id=perm_obj.id))
            await db.flush()
            
        db.add(UserRole(
            user_id=new_user.id,
            role_id=role.id,
            is_default=True,
            company_id=payload.company_id,
            branch_id=payload.branch_id
        ))
    else:
        linked_user_id = existing_user.id
        existing_user.employee_id = payload.employee_code

    emp = Employee(
        tenant_id=ctx.tenant_id,
        user_id=linked_user_id,
        **payload.model_dump(exclude={"user_id"})
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
    response_obj = EmployeeResponse.model_validate(emp)
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
    return emp


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
    for key, value in updates.items():
        setattr(emp, key, value)

    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
        action="updated", entity_type="employee", entity_id=emp.id,
        new_values=payload.model_dump(exclude_unset=True, mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return emp


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
    emp.sales_points = (emp.sales_points or 0.0) + points
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
    emp = await db.scalar(
        select(Employee).where(Employee.id == emp_id, Employee.tenant_id == ctx.tenant_id)
    )
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
        action="deleted", entity_type="employee", entity_id=emp.id,
        old_values={"name": emp.full_name, "code": emp.employee_code},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.delete(emp)
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
