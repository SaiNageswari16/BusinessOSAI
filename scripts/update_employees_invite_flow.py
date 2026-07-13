import os

target = os.path.join("backend", "src", "api", "v1", "hrms", "employees.py")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

target_block = """@router.post("/employees", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    payload: EmployeeCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Check for existing code or email in tenant
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
            
            # Grant view:dashboard & view:hrms
            p_dash = await db.scalar(select(Permission).where(Permission.code == "view:dashboard"))
            p_hrms = await db.scalar(select(Permission).where(Permission.code == "view:hrms"))
            if p_dash:
                db.add(RolePermission(role_id=role.id, permission_id=p_dash.id))
            if p_hrms:
                db.add(RolePermission(role_id=role.id, permission_id=p_hrms.id))
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
    
    # Set the temporary password field in the schema object to present to UI
    response_obj = EmployeeResponse.model_validate(emp)
    if not existing_user:
        response_obj.temporary_password = temp_pass
    return response_obj"""

replacement_block = """@router.post("/employees", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    payload: EmployeeCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
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
            
            # Grant view:dashboard & view:hrms
            p_dash = await db.scalar(select(Permission).where(Permission.code == "view:dashboard"))
            p_hrms = await db.scalar(select(Permission).where(Permission.code == "view:hrms"))
            if p_dash:
                db.add(RolePermission(role_id=role.id, permission_id=p_dash.id))
            if p_hrms:
                db.add(RolePermission(role_id=role.id, permission_id=p_hrms.id))
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
                f"Hello {payload.full_name},\\n\\n"
                f"Your employee profile has been created and you have been granted access to the {settings.app_name} HRMS Portal.\\n\\n"
                f"Employee Code: {payload.employee_code}\\n"
                f"Temporary Password: {temp_pass}\\n"
                f"Login URL: {settings.frontend_url or 'http://localhost:8080'}\\n\\n"
                f"Please log in and update your password on your first login.\\n\\n"
                f"Best regards,\\nHR Department"
            )
        )
    except Exception as email_err:
        print(f"Simulation: Invite email could not be sent to {payload.email}: {email_err}")

    # Set the temporary password field in the schema object to present to UI
    response_obj = EmployeeResponse.model_validate(emp)
    if not existing_user:
        response_obj.temporary_password = temp_pass
    return response_obj"""

line_ending = "\r\n" if "\r\n" in content else "\n"

# Replace
content = content.replace(target_block.replace("\n", line_ending), replacement_block.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Updated employees.py successfully with auto-generation and email invitation triggers")
