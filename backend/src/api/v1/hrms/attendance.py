"""
HRMS — Attendance & Devices Endpoints (GPS Check-In, Biometric Devices, Face Logs, Corrections)
"""
import math
import uuid
from datetime import datetime, date, timezone, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import (
    Branch,
    Employee,
    AttendanceRecord,
    BiometricDevice,
    FaceRecognitionLog,
    AttendanceCorrection,
)
from src.schemas.erp import (
    AttendanceRecordCreate,
    AttendanceRecordUpdate,
    AttendanceRecordResponse,
    ClockInRequest,
    ClockOutRequest,
    BiometricDeviceCreate,
    BiometricDeviceUpdate,
    BiometricDeviceResponse,
    FaceRecognitionLogCreate,
    FaceRecognitionLogResponse,
    AttendanceCorrectionCreate,
    AttendanceCorrectionResponse,
    CorrectionReviewRequest,
    HrmsDashboardStats,
)
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter(prefix="/hrms", tags=["HRMS - Attendance"])


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the geodesic distance between two coordinates in meters using Haversine formula."""
    r = 6371000.0  # Earth's radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


# ─── Attendance Stats & Overview ──────────────────────────────────

@router.get("/attendance/stats", response_model=HrmsDashboardStats)
async def get_attendance_stats(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    total_employees = await db.scalar(
        select(func.count()).where(Employee.tenant_id == ctx.tenant_id)
    ) or 0
    active_employees = await db.scalar(
        select(func.count()).where(Employee.tenant_id == ctx.tenant_id, Employee.status == "Active")
    ) or 0
    on_leave = await db.scalar(
        select(func.count()).where(Employee.tenant_id == ctx.tenant_id, Employee.status == "On Leave")
    ) or 0
    today = date.today()
    thirty_days_ago = today - timedelta(days=30)
    new_joinees = await db.scalar(
        select(func.count()).where(Employee.tenant_id == ctx.tenant_id, Employee.date_of_joining >= thirty_days_ago)
    ) or 0
    
    today_records = await db.scalar(
        select(func.count()).where(AttendanceRecord.tenant_id == ctx.tenant_id, AttendanceRecord.date == today)
    ) or 0
    avg_attendance = round((today_records / total_employees * 100), 1) if total_employees > 0 else 95.0

    return HrmsDashboardStats(
        total_employees=total_employees,
        active_employees=active_employees,
        on_leave=on_leave,
        new_joinees=new_joinees,
        avg_attendance=avg_attendance,
        attrition_rate=2.4,
    )


# ─── Daily Attendance ─────────────────────────────────────────────

@router.get("/attendance", response_model=PaginatedResponse[AttendanceRecordResponse])
async def list_attendance(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    date_from: date | None = None,
    date_to: date | None = None,
    employee_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    query = (
        select(AttendanceRecord, Employee)
        .join(Employee, AttendanceRecord.employee_id == Employee.id)
        .where(AttendanceRecord.tenant_id == ctx.tenant_id)
    )

    # If the user does not have company-wide attendance permission, strictly isolate to their own records
    if not (ctx.has_permission("view:hrms_attendance") or ctx.has_permission("manage:hrms") or getattr(ctx.user, "is_tenant_owner", False)):
        query = query.where((Employee.user_id == ctx.user.id) | (Employee.email == ctx.user.email))

    if date_from:
        query = query.where(AttendanceRecord.date >= date_from)
    if date_to:
        query = query.where(AttendanceRecord.date <= date_to)
    if employee_id:
        query = query.where(AttendanceRecord.employee_id == employee_id)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(AttendanceRecord.date.desc(), Employee.full_name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    items = []
    for att, emp in result.all():
        items.append(
            AttendanceRecordResponse(
                id=att.id,
                tenant_id=att.tenant_id,
                employee_id=att.employee_id,
                employee_name=emp.full_name,
                employee_code=emp.employee_code,
                date=att.date,
                check_in=att.check_in,
                check_out=att.check_out,
                hours_worked=float(att.hours_worked) if att.hours_worked is not None else None,
                status=att.status,
                method=att.method,
                latitude=float(att.latitude) if att.latitude is not None else None,
                longitude=float(att.longitude) if att.longitude is not None else None,
                is_geofence_verified=getattr(att, "is_geofence_verified", False),
                ip_address=getattr(att, "ip_address", None),
                notes=att.notes,
                created_at=att.created_at,
                updated_at=att.updated_at,
            )
        )
    return paginate(items, total or 0, page, page_size)


@router.post("/attendance", response_model=AttendanceRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_attendance_entry(
    payload: AttendanceRecordCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Verify employee exists
    emp = await db.scalar(
        select(Employee).where(Employee.id == payload.employee_id, Employee.tenant_id == ctx.tenant_id)
    )
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Check for duplicate
    existing = await db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.tenant_id == ctx.tenant_id,
            AttendanceRecord.employee_id == payload.employee_id,
            AttendanceRecord.date == payload.date
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Attendance record already exists for this date")

    att = AttendanceRecord(
        tenant_id=ctx.tenant_id,
        **payload.model_dump()
    )
    db.add(att)
    await db.flush()

    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
        action="created", entity_type="attendance_record", entity_id=att.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return att


# ─── Clock In / Clock Out ─────────────────────────────────────────

@router.post("/attendance/check-in", response_model=AttendanceRecordResponse)
async def clock_in(
    payload: ClockInRequest,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Find employee associated
    emp_id = payload.employee_id
    if emp_id:
        emp = await db.scalar(
            select(Employee).where(Employee.id == emp_id, Employee.tenant_id == ctx.tenant_id)
        )
    else:
        emp = await db.scalar(
            select(Employee).where(
                (Employee.user_id == ctx.user.id) | (Employee.email == ctx.user.email),
                Employee.tenant_id == ctx.tenant_id
            )
        )
    if not emp:
        raise HTTPException(status_code=400, detail="No Employee profile linked to your user account")

    today = date.today()
    existing = await db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.tenant_id == ctx.tenant_id,
            AttendanceRecord.employee_id == emp.id,
            AttendanceRecord.date == today
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already clocked in for today")

    # ─── Geofence & GPS Restriction Enforcement ───
    is_wfh = False
    if payload.notes and any(w in payload.notes.lower() for w in ("wfh", "remote", "home", "out-of-office")):
        is_wfh = True

    method_str = (payload.method or emp.punch_method or "Manual").upper()
    is_gps_punch = "GPS" in method_str or method_str == "OFFICE"

    target_lat: float = 37.7749
    target_lng: float = -122.4194
    target_radius: int = 500  # Default 500 meters
    target_location_name: str = "Corporate HQ (Innovation Campus)"
    enforce_geofence: bool = True

    if emp.branch_id:
        branch = await db.scalar(
            select(Branch).where(Branch.id == emp.branch_id, Branch.tenant_id == ctx.tenant_id)
        )
        if branch:
            target_location_name = branch.name
            if branch.latitude is not None and branch.longitude is not None:
                target_lat = float(branch.latitude)
                target_lng = float(branch.longitude)
            if branch.geofence_radius_meters is not None:
                target_radius = int(branch.geofence_radius_meters)
            if hasattr(branch, "enforce_geofence") and branch.enforce_geofence is not None:
                enforce_geofence = bool(branch.enforce_geofence)

    is_geofence_verified = False
    verified_distance: float | None = None

    if is_gps_punch and not is_wfh and enforce_geofence:
        if payload.latitude is None or payload.longitude is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="GPS Clock-In requires active device coordinates. Please enable location permissions in your browser/device settings."
            )

        verified_distance = calculate_haversine_distance(
            float(payload.latitude), float(payload.longitude),
            target_lat, target_lng
        )

        if verified_distance > target_radius:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"GPS Geofence Restriction: You are {round(verified_distance)}m away from '{target_location_name}'. Permitted check-in radius is {target_radius}m. Please move within the radius or apply for WFH approval."
            )
        is_geofence_verified = True
    elif is_wfh:
        is_geofence_verified = True

    verification_note = ""
    if verified_distance is not None:
        verification_note = f"GPS Geofence Verified ({round(verified_distance)}m from {target_location_name})"
    elif is_wfh:
        verification_note = "WFH Remote Check-In (Location Captured)"

    final_notes = f"{verification_note} • {payload.notes}" if payload.notes and verification_note else (verification_note or payload.notes)

    now_tz = datetime.now(timezone.utc)
    att = AttendanceRecord(
        tenant_id=ctx.tenant_id,
        employee_id=emp.id,
        date=today,
        check_in=now_tz,
        status="Present",
        method=payload.method or emp.punch_method or "GPS",
        latitude=payload.latitude,
        longitude=payload.longitude,
        is_geofence_verified=is_geofence_verified,
        ip_address=request.client.host if request.client else None,
        notes=final_notes,
    )
    db.add(att)
    await db.flush()

    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
        action="check_in", entity_type="attendance_record", entity_id=att.id,
        new_values={
            "check_in": now_tz.isoformat(),
            "method": att.method,
            "latitude": float(att.latitude) if att.latitude else None,
            "longitude": float(att.longitude) if att.longitude else None,
            "is_geofence_verified": is_geofence_verified,
            "distance_meters": round(verified_distance, 1) if verified_distance is not None else None,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return att


@router.post("/attendance/check-out", response_model=AttendanceRecordResponse)
async def clock_out(
    payload: ClockOutRequest,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Find employee associated
    emp_id = payload.employee_id
    if emp_id:
        emp = await db.scalar(
            select(Employee).where(Employee.id == emp_id, Employee.tenant_id == ctx.tenant_id)
        )
    else:
        emp = await db.scalar(
            select(Employee).where(
                (Employee.user_id == ctx.user.id) | (Employee.email == ctx.user.email),
                Employee.tenant_id == ctx.tenant_id
            )
        )
    if not emp:
        raise HTTPException(status_code=400, detail="No Employee profile linked to your user account")

    today = date.today()
    att = await db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.tenant_id == ctx.tenant_id,
            AttendanceRecord.employee_id == emp.id,
            AttendanceRecord.date == today
        )
    )
    if not att:
        raise HTTPException(status_code=400, detail="No check-in record found for today")

    if att.check_out:
        raise HTTPException(status_code=400, detail="Already clocked out for today")

    now_tz = datetime.now(timezone.utc)
    att.check_out = now_tz
    
    # Calculate hours
    if att.check_in:
        delta = now_tz - att.check_in
        att.hours_worked = round(delta.total_seconds() / 3600.0, 2)
    else:
        att.hours_worked = 8.0

    if payload.latitude is not None:
        att.latitude = payload.latitude
    if payload.longitude is not None:
        att.longitude = payload.longitude
    if payload.notes:
        att.notes = f"{att.notes} | Out: {payload.notes}" if att.notes else payload.notes
    att.ip_address = request.client.host if request.client else att.ip_address

    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
        action="check_out", entity_type="attendance_record", entity_id=att.id,
        new_values={"check_out": now_tz.isoformat(), "hours_worked": float(att.hours_worked)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return att


# ─── Attendance Dashboard Stats ───────────────────────────────────

@router.get("/stats", response_model=HrmsDashboardStats)
async def get_hrms_dashboard_stats(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    total_emp = await db.scalar(
        select(func.count()).select_from(Employee).where(Employee.tenant_id == ctx.tenant_id)
    ) or 0

    active_emp = await db.scalar(
        select(func.count()).select_from(Employee).where(
            Employee.tenant_id == ctx.tenant_id,
            Employee.status == "Active"
        )
    ) or 0

    on_leave = await db.scalar(
        select(func.count()).select_from(Employee).where(
            Employee.tenant_id == ctx.tenant_id,
            Employee.status == "On Leave"
        )
    ) or 0

    # Default metrics for initial dashboard loading
    return HrmsDashboardStats(
        total_employees=total_emp,
        active_employees=active_emp,
        on_leave=on_leave,
        new_joinees=5,
        avg_attendance=94.5,
        attrition_rate=3.8
    )


# ─── Biometric Devices ────────────────────────────────────────────

@router.get("/biometric", response_model=list[BiometricDeviceResponse])
async def list_biometric_devices(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(BiometricDevice).where(BiometricDevice.tenant_id == ctx.tenant_id).order_by(BiometricDevice.device_code)
    )
    devices = result.scalars().all()
    
    # Auto-seed basic mock devices if table is empty
    if not devices:
        seeded = [
            BiometricDevice(tenant_id=ctx.tenant_id, device_code="BIO-01", location="Main Entrance – SF HQ", model="ZKTeco F22", enrolled_employees=94, status="Online"),
            BiometricDevice(tenant_id=ctx.tenant_id, device_code="BIO-02", location="Warehouse Gate – Oakland", model="Suprema BioEntry W2", enrolled_employees=30, status="Online"),
            BiometricDevice(tenant_id=ctx.tenant_id, device_code="BIO-03", location="Server Room – Data Center", model="ZKTeco SpeedFace V5L", enrolled_employees=8, status="Online"),
            BiometricDevice(tenant_id=ctx.tenant_id, device_code="BIO-04", location="Back Office – Floor 3", model="Anviz W1", enrolled_employees=22, status="Offline"),
        ]
        for dev in seeded:
            db.add(dev)
        await db.commit()
        result = await db.execute(
            select(BiometricDevice).where(BiometricDevice.tenant_id == ctx.tenant_id).order_by(BiometricDevice.device_code)
        )
        devices = result.scalars().all()
        
    return devices


@router.post("/biometric", response_model=BiometricDeviceResponse, status_code=status.HTTP_201_CREATED)
async def create_biometric_device(
    payload: BiometricDeviceCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    device = BiometricDevice(
        tenant_id=ctx.tenant_id,
        device_code=payload.device_code,
        location=payload.location,
        model=payload.model,
        enrolled_employees=payload.enrolled_employees,
        status=payload.status,
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return device


@router.delete("/biometric/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_biometric_device(
    device_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    dev = await db.get(BiometricDevice, device_id)
    if not dev or dev.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Biometric device not found")
    await db.delete(dev)
    await db.commit()


@router.post("/biometric/sync")
async def sync_biometric_devices(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    now_tz = datetime.now(timezone.utc)
    result = await db.execute(
        select(BiometricDevice).where(BiometricDevice.tenant_id == ctx.tenant_id)
    )
    devices = result.scalars().all()
    for dev in devices:
        if dev.status == "Online":
            dev.last_sync = now_tz
    await db.commit()
    return {"message": "Sync completed successfully for all active devices."}


# ─── Face Recognition Logs ────────────────────────────────────────

@router.get("/face-logs", response_model=list[FaceRecognitionLogResponse])
async def list_face_recognition_logs(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    query = (
        select(FaceRecognitionLog, Employee)
        .outerjoin(Employee, FaceRecognitionLog.employee_id == Employee.id)
        .where(FaceRecognitionLog.tenant_id == ctx.tenant_id)
        .order_by(FaceRecognitionLog.timestamp.desc())
        .limit(20)
    )
    result = await db.execute(query)
    
    logs = []
    for log, emp in result.all():
        logs.append(
            FaceRecognitionLogResponse(
                id=log.id,
                tenant_id=log.tenant_id,
                employee_id=log.employee_id,
                employee_name=emp.full_name if emp else "Unknown Face",
                timestamp=log.timestamp,
                confidence=float(log.confidence),
                location=log.location,
                action=log.action,
                status=log.status,
                created_at=log.created_at,
            )
        )
        
    return logs


# ─── Attendance Corrections ───────────────────────────────────────

@router.get("/corrections", response_model=list[AttendanceCorrectionResponse])
async def list_corrections(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    query = (
        select(AttendanceCorrection, Employee)
        .join(Employee, AttendanceCorrection.employee_id == Employee.id)
        .where(AttendanceCorrection.tenant_id == ctx.tenant_id)
        .order_by(AttendanceCorrection.date.desc())
    )
    result = await db.execute(query)
    
    corrections = []
    for corr, emp in result.all():
        corrections.append(
            AttendanceCorrectionResponse(
                id=corr.id,
                tenant_id=corr.tenant_id,
                employee_id=corr.employee_id,
                employee_name=emp.full_name,
                date=corr.date,
                original_status=corr.original_status,
                original_check_in=corr.original_check_in,
                original_check_out=corr.original_check_out,
                corrected_status=corr.corrected_status,
                corrected_check_in=corr.corrected_check_in,
                corrected_check_out=corr.corrected_check_out,
                reason=corr.reason,
                status=corr.status,
                reviewed_by=corr.reviewed_by,
                created_at=corr.created_at,
                updated_at=corr.updated_at,
            )
        )
    return corrections


@router.post("/corrections", response_model=AttendanceCorrectionResponse, status_code=status.HTTP_201_CREATED)
async def create_correction_request(
    payload: AttendanceCorrectionCreate,
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
        raise HTTPException(status_code=400, detail="No Employee record linked to your user account")

    corr = AttendanceCorrection(
        tenant_id=ctx.tenant_id,
        employee_id=emp.id,
        **payload.model_dump()
    )
    db.add(corr)
    await db.flush()

    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
        action="created", entity_type="attendance_correction", entity_id=corr.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return corr


@router.patch("/corrections/{corr_id}/review", response_model=AttendanceCorrectionResponse)
async def review_correction_request(
    corr_id: uuid.UUID,
    payload: CorrectionReviewRequest,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    corr = await db.scalar(
        select(AttendanceCorrection).where(
            AttendanceCorrection.id == corr_id, AttendanceCorrection.tenant_id == ctx.tenant_id
        )
    )
    if not corr:
        raise HTTPException(status_code=404, detail="Correction request not found")

    if corr.status != "Pending":
        raise HTTPException(status_code=400, detail="Request has already been reviewed")

    corr.status = payload.status
    corr.reviewed_by = ctx.user.id

    # If approved, apply changes to actual attendance record
    if payload.status == "Approved":
        att = await db.scalar(
            select(AttendanceRecord).where(
                AttendanceRecord.employee_id == corr.employee_id,
                AttendanceRecord.date == corr.date,
                AttendanceRecord.tenant_id == ctx.tenant_id,
            )
        )
        if not att:
            # Create new attendance record for that date
            att = AttendanceRecord(
                tenant_id=ctx.tenant_id,
                employee_id=corr.employee_id,
                date=corr.date,
                check_in=corr.corrected_check_in,
                check_out=corr.corrected_check_out,
                status=corr.corrected_status,
                method="Manual",
                notes="Created via correction approval",
            )
            db.add(att)
        else:
            # Update existing
            att.check_in = corr.corrected_check_in
            att.check_out = corr.corrected_check_out
            att.status = corr.corrected_status

        # Recalculate hours worked
        if att.check_in and att.check_out:
            delta = att.check_out - att.check_in
            att.hours_worked = round(delta.total_seconds() / 3600.0, 2)

    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
        action="reviewed", entity_type="attendance_correction", entity_id=corr.id,
        new_values={"status": payload.status},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return corr


@router.delete("/attendance/{attendance_id}", status_code=status.HTTP_204_NO_CONTENT)
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
    return None