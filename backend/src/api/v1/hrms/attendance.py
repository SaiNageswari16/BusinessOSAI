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
    Company,
    Employee,
    AttendanceRecord,
    BiometricDevice,
    FaceRecognitionLog,
    AttendanceCorrection,
    AttendanceScheme,
    EmployeeAttendanceScheme,
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
    AttendanceSettingsSchema,
    AttendanceSchemeCreate,
    AttendanceSchemeUpdate,
    AttendanceSchemeResponse,
    AssignSchemeEmployeesRequest,
    MultiSchemeAssignRequest,
    EmployeeSchemeDetail,
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


async def _resolve_company_id(db: AsyncSession, tenant_id: uuid.UUID, company_id: uuid.UUID | None) -> uuid.UUID | None:
    """Safely resolves company_id to ensure it belongs to the tenant and is a valid Company record."""
    if company_id:
        existing = await db.scalar(
            select(Company.id).where(Company.id == company_id, Company.tenant_id == tenant_id)
        )
        if existing:
            return existing
    # Fallback to the first company in this tenant
    fallback = await db.scalar(
        select(Company.id).where(Company.tenant_id == tenant_id).order_by(Company.created_at.asc())
    )
    return fallback


# ─── Attendance Schemes & Multi-Scheme Management ───────────────────

@router.get("/attendance/schemes", response_model=list[AttendanceSchemeResponse])
async def list_attendance_schemes(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    scheme_q = select(AttendanceScheme).where(AttendanceScheme.tenant_id == ctx.tenant_id)
    if ctx.active_company_id:
        valid_cid = await _resolve_company_id(db, ctx.tenant_id, ctx.active_company_id)
        if valid_cid:
            scheme_q = scheme_q.where((AttendanceScheme.company_id == valid_cid) | (AttendanceScheme.company_id == None))
    
    schemes = (await db.scalars(scheme_q.order_by(AttendanceScheme.name.asc()))).all()

    # Fallback to Branch table if no dedicated attendance schemes created yet
    if not schemes:
        branch_q = select(Branch).where(Branch.tenant_id == ctx.tenant_id)
        if ctx.active_company_id:
            branch_q = branch_q.where((Branch.company_id == ctx.active_company_id) | (Branch.company_id == None))
        branches = (await db.scalars(branch_q.order_by(Branch.name.asc()))).all()
        if not branches:
            branches = (await db.scalars(select(Branch).where(Branch.tenant_id == ctx.tenant_id).order_by(Branch.name.asc()))).all()

        emp_res = (
            await db.execute(
                select(Employee.id, Employee.branch_id).where(
                    Employee.tenant_id == ctx.tenant_id,
                    Employee.status == "Active"
                )
            )
        ).all()
        emp_branch_map: dict[uuid.UUID, list[uuid.UUID]] = {}
        for eid, bid in emp_res:
            if bid:
                emp_branch_map.setdefault(bid, []).append(eid)

        legacy_schemes = []
        for b in branches:
            assigned = emp_branch_map.get(b.id, [])
            legacy_schemes.append(
                AttendanceSchemeResponse(
                    id=b.id,
                    company_id=b.company_id,
                    name=b.name,
                    code=b.code,
                    latitude=float(b.latitude) if b.latitude is not None else 17.372998,
                    longitude=float(b.longitude) if b.longitude is not None else 78.521062,
                    geofence_radius_meters=int(b.geofence_radius_meters) if b.geofence_radius_meters is not None else 50,
                    enforce_geofence=bool(b.enforce_geofence) if b.enforce_geofence is not None else True,
                    allowed_punch_methods=["GPS", "Biometric", "Face", "Web"],
                    shift_start_time="09:00",
                    shift_end_time="18:00",
                    grace_period_minutes=15,
                    half_day_hours=4.0,
                    full_day_hours=8.0,
                    overtime_allowed=True,
                    overtime_min_minutes=60,
                    working_days=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                    ip_whitelist="",
                    is_default=False,
                    status="Active",
                    assigned_employees_count=len(assigned),
                    assigned_employee_ids=assigned,
                )
            )
        return legacy_schemes

    # Load assignments from EmployeeAttendanceScheme
    response_list = []
    for s in schemes:
        assigned_emp_ids = (
            await db.scalars(
                select(EmployeeAttendanceScheme.employee_id).where(
                    EmployeeAttendanceScheme.scheme_id == s.id,
                    EmployeeAttendanceScheme.tenant_id == ctx.tenant_id
                )
            )
        ).all()
        response_list.append(
            AttendanceSchemeResponse(
                id=s.id,
                company_id=s.company_id,
                name=s.name,
                code=s.code,
                description=s.description,
                latitude=float(s.latitude) if s.latitude is not None else 17.372998,
                longitude=float(s.longitude) if s.longitude is not None else 78.521062,
                geofence_radius_meters=int(s.geofence_radius_meters) if s.geofence_radius_meters is not None else 50,
                enforce_geofence=bool(s.enforce_geofence) if s.enforce_geofence is not None else True,
                allowed_punch_methods=s.allowed_punch_methods or ["GPS", "Biometric", "Face", "Web"],
                shift_start_time=s.shift_start_time or "09:00",
                shift_end_time=s.shift_end_time or "18:00",
                grace_period_minutes=s.grace_period_minutes if s.grace_period_minutes is not None else 15,
                half_day_hours=float(s.half_day_hours) if s.half_day_hours is not None else 4.0,
                full_day_hours=float(s.full_day_hours) if s.full_day_hours is not None else 8.0,
                overtime_allowed=bool(s.overtime_allowed) if s.overtime_allowed is not None else True,
                overtime_min_minutes=s.overtime_min_minutes if s.overtime_min_minutes is not None else 60,
                working_days=s.working_days or ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                ip_whitelist=s.ip_whitelist or "",
                is_default=bool(s.is_default),
                status=s.status or "Active",
                assigned_employees_count=len(assigned_emp_ids),
                assigned_employee_ids=list(assigned_emp_ids),
            )
        )
    return response_list


@router.post("/attendance/schemes", response_model=AttendanceSchemeResponse, status_code=status.HTTP_201_CREATED)
async def create_attendance_scheme(
    payload: AttendanceSchemeCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    comp_id = await _resolve_company_id(db, ctx.tenant_id, payload.company_id or ctx.active_company_id)

    code = payload.code or payload.name[:6].upper().replace(" ", "")

    scheme = AttendanceScheme(
        tenant_id=ctx.tenant_id,
        company_id=comp_id,
        code=code,
        name=payload.name,
        description=payload.description,
        latitude=payload.latitude,
        longitude=payload.longitude,
        geofence_radius_meters=payload.geofence_radius_meters,
        enforce_geofence=payload.enforce_geofence,
        allowed_punch_methods=payload.allowed_punch_methods,
        shift_start_time=payload.shift_start_time,
        shift_end_time=payload.shift_end_time,
        grace_period_minutes=payload.grace_period_minutes,
        half_day_hours=payload.half_day_hours,
        full_day_hours=payload.full_day_hours,
        overtime_allowed=payload.overtime_allowed,
        overtime_min_minutes=payload.overtime_min_minutes,
        working_days=payload.working_days,
        ip_whitelist=payload.ip_whitelist or "",
        is_default=payload.is_default,
        status="Active",
    )
    db.add(scheme)
    await db.flush()

    # Create employee assignments
    if payload.assigned_employee_ids:
        for eid in payload.assigned_employee_ids:
            existing_mapping = await db.scalar(
                select(EmployeeAttendanceScheme).where(
                    EmployeeAttendanceScheme.scheme_id == scheme.id,
                    EmployeeAttendanceScheme.employee_id == eid
                )
            )
            if not existing_mapping:
                db.add(
                    EmployeeAttendanceScheme(
                        tenant_id=ctx.tenant_id,
                        employee_id=eid,
                        scheme_id=scheme.id,
                        is_primary=True,
                    )
                )
        await db.flush()

    await db.commit()
    await db.refresh(scheme)

    return AttendanceSchemeResponse(
        id=scheme.id,
        company_id=scheme.company_id,
        name=scheme.name,
        code=scheme.code,
        description=scheme.description,
        latitude=float(scheme.latitude) if scheme.latitude is not None else payload.latitude,
        longitude=float(scheme.longitude) if scheme.longitude is not None else payload.longitude,
        geofence_radius_meters=int(scheme.geofence_radius_meters) if scheme.geofence_radius_meters is not None else payload.geofence_radius_meters,
        enforce_geofence=bool(scheme.enforce_geofence) if scheme.enforce_geofence is not None else payload.enforce_geofence,
        allowed_punch_methods=scheme.allowed_punch_methods,
        shift_start_time=scheme.shift_start_time,
        shift_end_time=scheme.shift_end_time,
        grace_period_minutes=scheme.grace_period_minutes,
        half_day_hours=scheme.half_day_hours,
        full_day_hours=scheme.full_day_hours,
        overtime_allowed=scheme.overtime_allowed,
        overtime_min_minutes=scheme.overtime_min_minutes,
        working_days=scheme.working_days,
        ip_whitelist=scheme.ip_whitelist or "",
        is_default=scheme.is_default,
        status=scheme.status,
        assigned_employees_count=len(payload.assigned_employee_ids),
        assigned_employee_ids=payload.assigned_employee_ids,
    )


@router.get("/attendance/schemes/{scheme_id}", response_model=AttendanceSchemeResponse)
async def get_attendance_scheme(
    scheme_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    scheme = await db.scalar(
        select(AttendanceScheme).where(AttendanceScheme.id == scheme_id, AttendanceScheme.tenant_id == ctx.tenant_id)
    )
    if not scheme:
        # Fallback to Branch
        b = await db.scalar(select(Branch).where(Branch.id == scheme_id, Branch.tenant_id == ctx.tenant_id))
        if not b:
            raise HTTPException(status_code=404, detail="Attendance scheme not found")
        assigned = (await db.scalars(select(Employee.id).where(Employee.branch_id == b.id, Employee.tenant_id == ctx.tenant_id))).all()
        return AttendanceSchemeResponse(
            id=b.id,
            company_id=b.company_id,
            name=b.name,
            code=b.code,
            latitude=float(b.latitude) if b.latitude is not None else 17.372998,
            longitude=float(b.longitude) if b.longitude is not None else 78.521062,
            geofence_radius_meters=int(b.geofence_radius_meters) if b.geofence_radius_meters is not None else 50,
            enforce_geofence=bool(b.enforce_geofence) if b.enforce_geofence is not None else True,
            allowed_punch_methods=["GPS", "Biometric", "Face", "Web"],
            shift_start_time="09:00",
            shift_end_time="18:00",
            grace_period_minutes=15,
            half_day_hours=4.0,
            full_day_hours=8.0,
            overtime_allowed=True,
            overtime_min_minutes=60,
            working_days=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            ip_whitelist="",
            is_default=False,
            status="Active",
            assigned_employees_count=len(assigned),
            assigned_employee_ids=list(assigned),
        )

    assigned_emp_ids = (
        await db.scalars(
            select(EmployeeAttendanceScheme.employee_id).where(
                EmployeeAttendanceScheme.scheme_id == scheme.id,
                EmployeeAttendanceScheme.tenant_id == ctx.tenant_id
            )
        )
    ).all()

    return AttendanceSchemeResponse(
        id=scheme.id,
        company_id=scheme.company_id,
        name=scheme.name,
        code=scheme.code,
        description=scheme.description,
        latitude=float(scheme.latitude) if scheme.latitude is not None else 17.372998,
        longitude=float(scheme.longitude) if scheme.longitude is not None else 78.521062,
        geofence_radius_meters=int(scheme.geofence_radius_meters) if scheme.geofence_radius_meters is not None else 50,
        enforce_geofence=bool(scheme.enforce_geofence) if scheme.enforce_geofence is not None else True,
        allowed_punch_methods=scheme.allowed_punch_methods or ["GPS", "Biometric", "Face", "Web"],
        shift_start_time=scheme.shift_start_time or "09:00",
        shift_end_time=scheme.shift_end_time or "18:00",
        grace_period_minutes=scheme.grace_period_minutes if scheme.grace_period_minutes is not None else 15,
        half_day_hours=float(scheme.half_day_hours) if scheme.half_day_hours is not None else 4.0,
        full_day_hours=float(scheme.full_day_hours) if scheme.full_day_hours is not None else 8.0,
        overtime_allowed=bool(scheme.overtime_allowed) if scheme.overtime_allowed is not None else True,
        overtime_min_minutes=scheme.overtime_min_minutes if scheme.overtime_min_minutes is not None else 60,
        working_days=scheme.working_days or ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        ip_whitelist=scheme.ip_whitelist or "",
        is_default=bool(scheme.is_default),
        status=scheme.status or "Active",
        assigned_employees_count=len(assigned_emp_ids),
        assigned_employee_ids=list(assigned_emp_ids),
    )


@router.patch("/attendance/schemes/{scheme_id}", response_model=AttendanceSchemeResponse)
async def update_attendance_scheme(
    scheme_id: uuid.UUID,
    payload: AttendanceSchemeUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    scheme = await db.scalar(
        select(AttendanceScheme).where(AttendanceScheme.id == scheme_id, AttendanceScheme.tenant_id == ctx.tenant_id)
    )
    if not scheme:
        # Check if updating a legacy Branch
        branch = await db.scalar(select(Branch).where(Branch.id == scheme_id, Branch.tenant_id == ctx.tenant_id))
        if branch:
            if payload.name: branch.name = payload.name
            if payload.latitude is not None: branch.latitude = payload.latitude
            if payload.longitude is not None: branch.longitude = payload.longitude
            if payload.geofence_radius_meters is not None: branch.geofence_radius_meters = payload.geofence_radius_meters
            if payload.enforce_geofence is not None: branch.enforce_geofence = payload.enforce_geofence
            await db.commit()
            await db.refresh(branch)
            assigned = (await db.scalars(select(Employee.id).where(Employee.branch_id == branch.id, Employee.tenant_id == ctx.tenant_id))).all()
            return AttendanceSchemeResponse(
                id=branch.id,
                company_id=branch.company_id,
                name=branch.name,
                code=branch.code,
                latitude=float(branch.latitude) if branch.latitude is not None else 17.372998,
                longitude=float(branch.longitude) if branch.longitude is not None else 78.521062,
                geofence_radius_meters=int(branch.geofence_radius_meters) if branch.geofence_radius_meters is not None else 50,
                enforce_geofence=bool(branch.enforce_geofence) if branch.enforce_geofence is not None else True,
                allowed_punch_methods=["GPS", "Biometric", "Face", "Web"],
                shift_start_time=payload.shift_start_time or "09:00",
                shift_end_time=payload.shift_end_time or "18:00",
                grace_period_minutes=payload.grace_period_minutes or 15,
                half_day_hours=payload.half_day_hours or 4.0,
                full_day_hours=payload.full_day_hours or 8.0,
                overtime_allowed=True,
                overtime_min_minutes=60,
                working_days=payload.working_days or ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                ip_whitelist=payload.ip_whitelist or "",
                is_default=False,
                status="Active",
                assigned_employees_count=len(assigned),
                assigned_employee_ids=list(assigned),
            )
        raise HTTPException(status_code=404, detail="Attendance scheme not found")

    updates = payload.model_dump(exclude_unset=True, exclude={"assigned_employee_ids"})
    if "company_id" in updates:
        updates["company_id"] = await _resolve_company_id(db, ctx.tenant_id, updates["company_id"])
    for key, value in updates.items():
        setattr(scheme, key, value)

    if payload.assigned_employee_ids is not None:
        # Sync assignments
        await db.execute(
            delete(EmployeeAttendanceScheme).where(EmployeeAttendanceScheme.scheme_id == scheme.id)
        )
        for eid in payload.assigned_employee_ids:
            db.add(
                EmployeeAttendanceScheme(
                    tenant_id=ctx.tenant_id,
                    employee_id=eid,
                    scheme_id=scheme.id,
                    is_primary=True,
                )
            )

    await db.commit()
    await db.refresh(scheme)

    assigned_emp_ids = (
        await db.scalars(
            select(EmployeeAttendanceScheme.employee_id).where(
                EmployeeAttendanceScheme.scheme_id == scheme.id,
                EmployeeAttendanceScheme.tenant_id == ctx.tenant_id
            )
        )
    ).all()

    return AttendanceSchemeResponse(
        id=scheme.id,
        company_id=scheme.company_id,
        name=scheme.name,
        code=scheme.code,
        description=scheme.description,
        latitude=float(scheme.latitude) if scheme.latitude is not None else 17.372998,
        longitude=float(scheme.longitude) if scheme.longitude is not None else 78.521062,
        geofence_radius_meters=int(scheme.geofence_radius_meters) if scheme.geofence_radius_meters is not None else 50,
        enforce_geofence=bool(scheme.enforce_geofence) if scheme.enforce_geofence is not None else True,
        allowed_punch_methods=scheme.allowed_punch_methods or ["GPS", "Biometric", "Face", "Web"],
        shift_start_time=scheme.shift_start_time or "09:00",
        shift_end_time=scheme.shift_end_time or "18:00",
        grace_period_minutes=scheme.grace_period_minutes if scheme.grace_period_minutes is not None else 15,
        half_day_hours=float(scheme.half_day_hours) if scheme.half_day_hours is not None else 4.0,
        full_day_hours=float(scheme.full_day_hours) if scheme.full_day_hours is not None else 8.0,
        overtime_allowed=bool(scheme.overtime_allowed) if scheme.overtime_allowed is not None else True,
        overtime_min_minutes=scheme.overtime_min_minutes if scheme.overtime_min_minutes is not None else 60,
        working_days=scheme.working_days or ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        ip_whitelist=scheme.ip_whitelist or "",
        is_default=bool(scheme.is_default),
        status=scheme.status or "Active",
        assigned_employees_count=len(assigned_emp_ids),
        assigned_employee_ids=list(assigned_emp_ids),
    )


@router.delete("/attendance/schemes/{scheme_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attendance_scheme(
    scheme_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    scheme = await db.scalar(
        select(AttendanceScheme).where(AttendanceScheme.id == scheme_id, AttendanceScheme.tenant_id == ctx.tenant_id)
    )
    if not scheme:
        raise HTTPException(status_code=404, detail="Attendance scheme not found")

    await db.delete(scheme)
    await db.commit()


# ─── Multi-Scheme Employee Assignment Endpoints ──────────────────────

@router.post("/attendance/schemes/assign")
@router.post("/attendance/schemes/{scheme_id}/assign")
async def assign_employees_to_scheme(
    payload: MultiSchemeAssignRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    scheme_id: uuid.UUID | None = None,
):
    target_scheme_id = scheme_id or payload.scheme_id
    scheme = await db.scalar(
        select(AttendanceScheme).where(AttendanceScheme.id == target_scheme_id, AttendanceScheme.tenant_id == ctx.tenant_id)
    )
    if not scheme:
        # Fallback check on branch
        branch = await db.scalar(
            select(Branch).where(Branch.id == target_scheme_id, Branch.tenant_id == ctx.tenant_id)
        )
        if not branch:
            raise HTTPException(status_code=404, detail="Attendance scheme not found")
        
        # Legacy fallback
        assignments_list = payload.assignments or payload.employee_assignments
        eids = payload.employee_ids or [a.employee_id for a in assignments_list]
        for eid in eids:
            emp = await db.get(Employee, eid)
            if emp and emp.tenant_id == ctx.tenant_id:
                emp.branch_id = branch.id
                if payload.punch_method:
                    emp.punch_method = payload.punch_method
        await db.commit()
        return {
            "message": f"Successfully assigned {len(eids)} employee(s) to attendance scheme '{branch.name}'.",
            "scheme_id": branch.id,
            "scheme_name": branch.name,
            "assigned_count": len(eids)
        }

    # Process multi-scheme assignments
    count = 0
    assignments_list = payload.assignments or payload.employee_assignments
    if assignments_list:
        for item in assignments_list:
            mapping = await db.scalar(
                select(EmployeeAttendanceScheme).where(
                    EmployeeAttendanceScheme.scheme_id == scheme.id,
                    EmployeeAttendanceScheme.employee_id == item.employee_id
                )
            )
            if not mapping:
                mapping = EmployeeAttendanceScheme(
                    tenant_id=ctx.tenant_id,
                    employee_id=item.employee_id,
                    scheme_id=scheme.id,
                )
                db.add(mapping)
            mapping.is_primary = item.is_primary
            mapping.days_of_week = item.days_of_week
            mapping.effective_from = item.effective_from
            mapping.effective_to = item.effective_to
            count += 1
    elif payload.employee_ids:
        for eid in payload.employee_ids:
            mapping = await db.scalar(
                select(EmployeeAttendanceScheme).where(
                    EmployeeAttendanceScheme.scheme_id == scheme.id,
                    EmployeeAttendanceScheme.employee_id == eid
                )
            )
            if not mapping:
                mapping = EmployeeAttendanceScheme(
                    tenant_id=ctx.tenant_id,
                    employee_id=eid,
                    scheme_id=scheme.id,
                )
                db.add(mapping)
            mapping.is_primary = payload.is_primary
            mapping.days_of_week = payload.days_of_week
            count += 1

    await db.commit()
    return {
        "message": f"Successfully assigned {count} employee(s) to attendance scheme '{scheme.name}'.",
        "scheme_id": scheme.id,
        "scheme_name": scheme.name,
        "assigned_count": count
    }


@router.post("/attendance/schemes/{scheme_id}/unassign")
async def unassign_employee_from_scheme(
    scheme_id: uuid.UUID,
    payload: AssignSchemeEmployeesRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await db.execute(
        delete(EmployeeAttendanceScheme).where(
            EmployeeAttendanceScheme.scheme_id == scheme_id,
            EmployeeAttendanceScheme.employee_id.in_(payload.employee_ids),
            EmployeeAttendanceScheme.tenant_id == ctx.tenant_id
        )
    )
    await db.commit()
    return {"message": "Successfully unassigned selected employees from scheme."}


@router.get("/employees/{employee_id}/schemes", response_model=list[EmployeeSchemeDetail])
async def get_employee_assigned_schemes(
    employee_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    mappings = (
        await db.scalars(
            select(EmployeeAttendanceScheme).where(
                EmployeeAttendanceScheme.employee_id == employee_id,
                EmployeeAttendanceScheme.tenant_id == ctx.tenant_id
            )
        )
    ).all()

    details = []
    for m in mappings:
        scheme = await db.get(AttendanceScheme, m.scheme_id)
        if scheme:
            details.append(
                EmployeeSchemeDetail(
                    id=m.id,
                    scheme_id=scheme.id,
                    scheme_name=scheme.name,
                    scheme_code=scheme.code,
                    shift_start_time=scheme.shift_start_time or "09:00",
                    shift_end_time=scheme.shift_end_time or "18:00",
                    is_primary=m.is_primary,
                    days_of_week=m.days_of_week or [],
                    effective_from=m.effective_from,
                    effective_to=m.effective_to,
                )
            )
    return details


@router.get("/attendance/settings", response_model=AttendanceSettingsSchema)
async def get_attendance_settings(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    branch_id: uuid.UUID | None = None,
    employee_id: uuid.UUID | None = None,
):
    branch = None
    if branch_id:
        branch = await db.scalar(select(Branch).where(Branch.id == branch_id, Branch.tenant_id == ctx.tenant_id))
    
    if not branch and employee_id:
        emp = await db.scalar(select(Employee).where(Employee.id == employee_id, Employee.tenant_id == ctx.tenant_id))
        if emp and emp.branch_id:
            branch = await db.scalar(select(Branch).where(Branch.id == emp.branch_id, Branch.tenant_id == ctx.tenant_id))
            
    if not branch:
        # Check if current user is linked to an employee profile
        emp = await db.scalar(
            select(Employee).where(
                (Employee.user_id == ctx.user.id) | (Employee.email == ctx.user.email),
                Employee.tenant_id == ctx.tenant_id
            )
        )
        if emp and emp.branch_id:
            branch = await db.scalar(select(Branch).where(Branch.id == emp.branch_id, Branch.tenant_id == ctx.tenant_id))

    if not branch and ctx.active_company_id:
        branch = await db.scalar(
            select(Branch).where(Branch.company_id == ctx.active_company_id, Branch.tenant_id == ctx.tenant_id, Branch.latitude.isnot(None)).order_by(Branch.created_at.asc())
        )
    if not branch:
        branch = await db.scalar(
            select(Branch).where(Branch.tenant_id == ctx.tenant_id, Branch.latitude.isnot(None)).order_by(Branch.created_at.asc())
        )
    if not branch:
        branch = await db.scalar(
            select(Branch).where(Branch.tenant_id == ctx.tenant_id).order_by(Branch.created_at.asc())
        )

    if branch:
        assigned_emp_ids = (
            await db.scalars(
                select(Employee.id).where(Employee.tenant_id == ctx.tenant_id, Employee.branch_id == branch.id)
            )
        ).all()

        return AttendanceSettingsSchema(
            branch_id=branch.id,
            branch_name=branch.name,
            latitude=float(branch.latitude) if branch.latitude is not None else 17.372998,
            longitude=float(branch.longitude) if branch.longitude is not None else 78.521062,
            geofence_radius_meters=int(branch.geofence_radius_meters) if branch.geofence_radius_meters is not None else 50,
            enforce_geofence=bool(branch.enforce_geofence) if branch.enforce_geofence is not None else True,
            allowed_punch_methods=["GPS", "Biometric", "Face", "Web"],
            shift_start_time="09:00",
            shift_end_time="18:00",
            grace_period_minutes=15,
            half_day_hours=4.0,
            ip_whitelist="",
            assigned_employee_ids=list(assigned_emp_ids),
        )
    
    return AttendanceSettingsSchema()


@router.post("/attendance/settings", response_model=AttendanceSettingsSchema)
async def update_attendance_settings(
    payload: AttendanceSettingsSchema,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    branch = None
    if payload.branch_id:
        branch = await db.scalar(
            select(Branch).where(Branch.id == payload.branch_id, Branch.tenant_id == ctx.tenant_id)
        )
    if not branch and ctx.active_company_id:
        branch = await db.scalar(
            select(Branch).where(Branch.company_id == ctx.active_company_id, Branch.tenant_id == ctx.tenant_id)
        )
    if not branch:
        branch = await db.scalar(
            select(Branch).where(Branch.tenant_id == ctx.tenant_id).order_by(Branch.created_at.asc())
        )
    
    if not branch:
        comp_id = ctx.active_company_id
        if not comp_id:
            comp = await db.scalar(select(Company).where(Company.tenant_id == ctx.tenant_id))
            if comp:
                comp_id = comp.id
            else:
                raise HTTPException(status_code=400, detail="No Company found to associate branch settings")
        
        branch = Branch(
            tenant_id=ctx.tenant_id,
            company_id=comp_id,
            code="HQ",
            name=payload.branch_name or "Headquarters",
            latitude=payload.latitude,
            longitude=payload.longitude,
            geofence_radius_meters=payload.geofence_radius_meters,
            enforce_geofence=payload.enforce_geofence,
        )
        db.add(branch)
        await db.flush()
    else:
        if payload.branch_name:
            branch.name = payload.branch_name
        branch.latitude = payload.latitude
        branch.longitude = payload.longitude
        branch.geofence_radius_meters = payload.geofence_radius_meters
        branch.enforce_geofence = payload.enforce_geofence

    # If employee IDs are provided to assign to this scheme/branch
    if payload.assigned_employee_ids:
        for eid in payload.assigned_employee_ids:
            emp = await db.get(Employee, eid)
            if emp and emp.tenant_id == ctx.tenant_id:
                emp.branch_id = branch.id
        await db.flush()

    await db.commit()
    await db.refresh(branch)

    assigned_emp_ids = (
        await db.scalars(
            select(Employee.id).where(Employee.tenant_id == ctx.tenant_id, Employee.branch_id == branch.id)
        )
    ).all()

    return AttendanceSettingsSchema(
        branch_id=branch.id,
        branch_name=branch.name,
        latitude=float(branch.latitude) if branch.latitude is not None else 17.372998,
        longitude=float(branch.longitude) if branch.longitude is not None else 78.521062,
        geofence_radius_meters=int(branch.geofence_radius_meters) if branch.geofence_radius_meters is not None else 50,
        enforce_geofence=bool(branch.enforce_geofence) if branch.enforce_geofence is not None else True,
        allowed_punch_methods=payload.allowed_punch_methods or ["GPS", "Biometric", "Face", "Web"],
        shift_start_time=payload.shift_start_time or "09:00",
        shift_end_time=payload.shift_end_time or "18:00",
        grace_period_minutes=payload.grace_period_minutes or 15,
        half_day_hours=payload.half_day_hours or 4.0,
        ip_whitelist=payload.ip_whitelist or "",
        assigned_employee_ids=list(assigned_emp_ids),
    )


# ─── Attendance Stats & Overview ──────────────────────────────────

@router.get("/attendance/stats", response_model=HrmsDashboardStats)
async def get_attendance_stats(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    emp_base = select(Employee).where(Employee.tenant_id == ctx.tenant_id)
    if ctx.active_company_id:
        emp_base = emp_base.where((Employee.company_id == ctx.active_company_id) | (Employee.company_id == None))

    total_employees = await db.scalar(
        select(func.count()).select_from(emp_base.subquery())
    ) or 0
    active_employees = await db.scalar(
        select(func.count()).select_from(emp_base.where(Employee.status == "Active").subquery())
    ) or 0
    on_leave = await db.scalar(
        select(func.count()).select_from(emp_base.where(Employee.status == "On Leave").subquery())
    ) or 0
    today = date.today()
    thirty_days_ago = today - timedelta(days=30)
    new_joinees = await db.scalar(
        select(func.count()).select_from(emp_base.where(Employee.date_of_joining >= thirty_days_ago).subquery())
    ) or 0
    
    today_rec_q = select(AttendanceRecord).join(Employee, AttendanceRecord.employee_id == Employee.id).where(
        AttendanceRecord.tenant_id == ctx.tenant_id, AttendanceRecord.date == today
    )
    if ctx.active_company_id:
        today_rec_q = today_rec_q.where((Employee.company_id == ctx.active_company_id) | (Employee.company_id == None))
    today_records = await db.scalar(
        select(func.count()).select_from(today_rec_q.subquery())
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

    if ctx.active_company_id:
        query = query.where((Employee.company_id == ctx.active_company_id) | (Employee.company_id == None))

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

    resp = AttendanceRecordResponse(
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
    await db.commit()
    return resp


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
    if existing and existing.check_in is not None:
        raise HTTPException(status_code=400, detail="Already clocked in for today")

    # ─── Geofence & GPS Restriction Enforcement ───
    is_wfh = False
    if payload.notes and any(w in payload.notes.lower() for w in ("wfh", "remote", "home", "out-of-office")):
        is_wfh = True

    target_lat: float = 17.372998
    target_lng: float = 78.521062
    target_radius: int = 50
    target_location_name: str = "Authorized Workspace Branch"
    enforce_geofence: bool = True

    branch = None
    if emp.branch_id:
        branch = await db.scalar(
            select(Branch).where(Branch.id == emp.branch_id, Branch.tenant_id == ctx.tenant_id)
        )
    if not branch and ctx.active_company_id:
        branch = await db.scalar(
            select(Branch).where(
                Branch.company_id == ctx.active_company_id,
                Branch.tenant_id == ctx.tenant_id,
                Branch.latitude.isnot(None)
            ).order_by(Branch.created_at.asc())
        )
    if not branch:
        branch = await db.scalar(
            select(Branch).where(
                Branch.tenant_id == ctx.tenant_id,
                Branch.latitude.isnot(None)
            ).order_by(Branch.created_at.asc())
        )
    if not branch:
        branch = await db.scalar(
            select(Branch).where(Branch.tenant_id == ctx.tenant_id).order_by(Branch.created_at.asc())
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

    method_str = (payload.method or emp.punch_method or "Manual").upper()
    is_gps_punch = "GPS" in method_str or method_str == "OFFICE" or method_str == "MANUAL"

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
    if existing:
        att = existing
        att.check_in = now_tz
        att.status = "Present"
        att.method = payload.method or emp.punch_method or "GPS"
        att.latitude = payload.latitude
        att.longitude = payload.longitude
        att.is_geofence_verified = is_geofence_verified
        att.ip_address = request.client.host if request.client else None
        att.notes = final_notes
    else:
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
    resp = AttendanceRecordResponse(
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
        updated_at=att.updated_at or now_tz,
    )
    await db.commit()
    return resp


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
        att = AttendanceRecord(
            tenant_id=ctx.tenant_id,
            employee_id=emp.id,
            date=today,
            status="Present",
            method=emp.punch_method or "GPS",
        )
        db.add(att)

    now_tz = datetime.now(timezone.utc)
    if not att.check_in:
        att.check_in = now_tz
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
    resp = AttendanceRecordResponse(
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
        updated_at=att.updated_at or now_tz,
    )
    await db.commit()
    return resp


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
    return AttendanceCorrectionResponse(
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

    emp = await db.scalar(select(Employee).where(Employee.id == corr.employee_id))

    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
        action="reviewed", entity_type="attendance_correction", entity_id=corr.id,
        new_values={"status": payload.status},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    resp = AttendanceCorrectionResponse(
        id=corr.id,
        tenant_id=corr.tenant_id,
        employee_id=corr.employee_id,
        employee_name=emp.full_name if emp else None,
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
    await db.commit()
    return resp


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