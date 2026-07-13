import os

# 1. Update backend/src/schemas/erp.py to add employee_id to ClockInRequest and ClockOutRequest
erp_schemas_file = os.path.join("backend", "src", "schemas", "erp.py")
with open(erp_schemas_file, "r", encoding="utf-8") as f:
    schema_content = f.read()

target_clockin = """class ClockInRequest(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None
    method: str = "Manual\""""

replacement_clockin = """class ClockInRequest(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None
    method: str = "Manual"
    employee_id: uuid.UUID | None = None"""

target_clockout = """class ClockOutRequest(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None"""

replacement_clockout = """class ClockOutRequest(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None
    employee_id: uuid.UUID | None = None"""

line_ending = "\r\n" if "\r\n" in schema_content else "\n"
schema_content = schema_content.replace(target_clockin.replace("\n", line_ending), replacement_clockin.replace("\n", line_ending))
schema_content = schema_content.replace(target_clockout.replace("\n", line_ending), replacement_clockout.replace("\n", line_ending))

with open(erp_schemas_file, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(schema_content)


# 2. Update backend/src/api/v1/hrms/attendance.py to support employee_id & DELETE /attendance/{id}
attendance_file = os.path.join("backend", "src", "api", "v1", "hrms", "attendance.py")
with open(attendance_file, "r", encoding="utf-8") as f:
    att_content = f.read()

# Replace employee lookup in clock_in
target_emp_lookup_in = """    # Find employee associated with this user
    emp = await db.scalar(
        select(Employee).where(Employee.user_id == ctx.user.id, Employee.tenant_id == ctx.tenant_id)
    )
    if not emp:
        # For simplicity, fallback or mock an employee if none is linked to the admin user
        # (This is useful in sandbox environments where the Admin doesn't have an Employee link)
        emp = await db.scalar(select(Employee).where(Employee.tenant_id == ctx.tenant_id))
        if not emp:
            raise HTTPException(status_code=400, detail="No Employee record linked to your user account")"""

replacement_emp_lookup_in = """    # Find employee associated
    emp_id = payload.employee_id
    if emp_id:
        emp = await db.get(Employee, emp_id)
    else:
        emp = await db.scalar(
            select(Employee).where(Employee.user_id == ctx.user.id, Employee.tenant_id == ctx.tenant_id)
        )
        if not emp:
            emp = await db.scalar(select(Employee).where(Employee.tenant_id == ctx.tenant_id))
    if not emp:
        raise HTTPException(status_code=400, detail="No Employee record linked or found")"""

# Replace employee lookup in clock_out
target_emp_lookup_out = """    # Find employee associated with this user
    emp = await db.scalar(
        select(Employee).where(Employee.user_id == ctx.user.id, Employee.tenant_id == ctx.tenant_id)
    )
    if not emp:
        emp = await db.scalar(select(Employee).where(Employee.tenant_id == ctx.tenant_id))
        if not emp:
            raise HTTPException(status_code=400, detail="No Employee record linked to your user account")"""

replacement_emp_lookup_out = """    # Find employee associated
    emp_id = payload.employee_id
    if emp_id:
        emp = await db.get(Employee, emp_id)
    else:
        emp = await db.scalar(
            select(Employee).where(Employee.user_id == ctx.user.id, Employee.tenant_id == ctx.tenant_id)
        )
        if not emp:
            emp = await db.scalar(select(Employee).where(Employee.tenant_id == ctx.tenant_id))
    if not emp:
        raise HTTPException(status_code=400, detail="No Employee record linked or found")"""

att_content = att_content.replace(target_emp_lookup_in.replace("\n", line_ending), replacement_emp_lookup_in.replace("\n", line_ending))
att_content = att_content.replace(target_emp_lookup_out.replace("\n", line_ending), replacement_emp_lookup_out.replace("\n", line_ending))

# Append DELETE endpoint at the end of attendance corrections or general section
delete_endpoint = """@router.delete("/attendance/{attendance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attendance_record(
    attendance_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    rec = await db.get(AttendanceRecord, attendance_id)
    if not rec or rec.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    await db.delete(rec)
    await db.commit()
    return None"""

att_content = att_content + "\n\n" + delete_endpoint.replace("\n", line_ending)

with open(attendance_file, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(att_content)


# 3. Update frontend/src/lib/api-client.ts to add delete method to attendanceApi
api_client_file = os.path.join("frontend", "src", "lib", "api-client.ts")
with open(api_client_file, "r", encoding="utf-8") as f:
    api_content = f.read()

target_api_line = """    request<AttendanceRecord>("POST", "/hrms/attendance/check-out", data),"""

replacement_api_line = """    request<AttendanceRecord>("POST", "/hrms/attendance/check-out", data),
  delete: (id: string) =>
    request<any>("DELETE", `/hrms/attendance/${id}`),"""

api_content = api_content.replace(target_api_line.replace("\n", line_ending), replacement_api_line.replace("\n", line_ending))

with open(api_client_file, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(api_content)

print("Updated backend Pydantic schemas, endpoints, and frontend api-client successfully")
