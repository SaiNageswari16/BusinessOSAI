import os

target = os.path.join("backend", "src", "api", "v1", "hrms", "employees.py")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

target_block = """# ─── Employees CRUD ───────────────────────────────────────────────"""

replacement_block = """# ─── Employees CRUD ───────────────────────────────────────────────

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
    return emp"""

if target_block in content:
    content = content.replace(target_block, replacement_block)
    with open(target, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(content)
    print("Added /employees/me endpoint successfully")
else:
    print("Could not find Target Block in employees.py")
