import os

# 1. Update backend/src/api/v1/hrms/attendance.py to add POST /attendance/face-logs
attendance_file = os.path.join("backend", "src", "api", "v1", "hrms", "attendance.py")
with open(attendance_file, "r", encoding="utf-8") as f:
    content = f.read()

face_logs_post = """@router.post("/attendance/face-logs", response_model=FaceRecognitionLogResponse, status_code=status.HTTP_201_CREATED)
async def create_face_recognition_log(
    payload: FaceRecognitionLogCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    log = FaceRecognitionLog(
        tenant_id=ctx.tenant_id,
        employee_id=payload.employee_id,
        confidence=payload.confidence,
        location=payload.location or "Web Terminal",
        action=payload.action,
        status=payload.status or "Verified"
    )
    db.add(log)
    await db.flush()
    await db.commit()
    return log"""

# Insert before corrections endpoints
insertion_target = "# ─── Attendance Corrections ───────────────────────────────────────"
line_ending = "\r\n" if "\r\n" in content else "\n"
new_content = content.replace(insertion_target, f"{face_logs_post}\n\n\n{insertion_target}".replace("\n", line_ending))

with open(attendance_file, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(new_content)

# 2. Update frontend/src/lib/api-client.ts to add createFaceLog
api_client_file = os.path.join("frontend", "src", "lib", "api-client.ts")
with open(api_client_file, "r", encoding="utf-8") as f:
    api_content = f.read()

target_api_line = """  listFaceLogs: () =>
    request<FaceRecognitionLog[]>("GET", "/hrms/attendance/face-logs"),"""

replacement_api_line = """  listFaceLogs: () =>
    request<FaceRecognitionLog[]>("GET", "/hrms/attendance/face-logs"),
  createFaceLog: (data: Record<string, unknown>) =>
    request<any>("POST", "/hrms/attendance/face-logs", data),"""

api_content = api_content.replace(target_api_line.replace("\n", line_ending), replacement_api_line.replace("\n", line_ending))

with open(api_client_file, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(api_content)

print("Updated backend & frontend with face recognition log creation support successfully")
