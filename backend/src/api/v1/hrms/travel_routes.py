"""
HRMS Field Operations & Live Travel Route Tracking Router.
Tracks continuous GPS shift breadcrumbs and provides route replay & analytics.
"""
import math
import uuid
import logging
from datetime import datetime, date, timezone, timedelta
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.session import get_db
from src.api.deps import CurrentUserContext, get_current_user_context, require_permission
from src.models import (
    Tenant,
    User,
    Employee,
    AttendanceRecord,
    EmployeeLocationTrail,
)
from src.schemas.erp import (
    LocationPingPayload,
    LocationPingBatchPayload,
    LocationTrailPoint,
    RouteStopItem,
    EmployeeRouteHistoryResponse,
    LiveFieldStaffItem,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/hrms/travel-routes", tags=["HRMS - Live Travel Routes"])


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points on the Earth in kilometers."""
    R = 6371.0088  # Earth's radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


async def _get_current_employee(db: AsyncSession, ctx: CurrentUserContext) -> Optional[Employee]:
    """Helper to resolve the current user's linked Employee record."""
    stmt = (
        select(Employee)
        .where(
            Employee.tenant_id == ctx.tenant_id,
            (Employee.user_id == ctx.user.id) | (Employee.email == ctx.user.email),
        )
        .limit(1)
    )
    res = await db.execute(stmt)
    return res.scalars().first()


# ─── 1. RECORD REAL-TIME GPS LOCATION PING (MOBILE / WEB) ───────────────────

@router.post("/ping", status_code=status.HTTP_201_CREATED)
async def record_location_ping(
    payload: LocationPingPayload,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Called periodically by mobile app / web browser while an employee is on active duty shift.
    Records GPS coordinate breadcrumbs for journey routemap visualization.
    """
    employee = await _get_current_employee(db, ctx)
    if not employee:
        raise HTTPException(status_code=400, detail="User account is not linked to an active Employee profile")

    now_utc = payload.recorded_at or datetime.now(timezone.utc)
    today_date = now_utc.date()

    # Link to today's active attendance shift if not explicitly provided
    attendance_id = payload.attendance_id
    if not attendance_id:
        att_stmt = (
            select(AttendanceRecord.id)
            .where(
                AttendanceRecord.tenant_id == ctx.tenant_id,
                AttendanceRecord.employee_id == employee.id,
                AttendanceRecord.date == today_date,
            )
            .limit(1)
        )
        att_res = await db.execute(att_stmt)
        attendance_id = att_res.scalar_one_or_none()

    trail = EmployeeLocationTrail(
        id=uuid.uuid4(),
        tenant_id=ctx.tenant_id,
        company_id=employee.company_id or ctx.active_company_id,
        employee_id=employee.id,
        attendance_id=attendance_id,
        latitude=float(payload.latitude),
        longitude=float(payload.longitude),
        accuracy=payload.accuracy,
        speed=payload.speed,
        heading=payload.heading,
        altitude=payload.altitude,
        activity_type=payload.activity_type or "traveling",
        location_name=payload.location_name,
        battery_level=payload.battery_level,
        is_mock=bool(payload.is_mock),
        recorded_at=now_utc,
    )
    db.add(trail)
    await db.commit()

    return {
        "success": True,
        "ping_id": trail.id,
        "recorded_at": trail.recorded_at.isoformat(),
        "employee_id": employee.id,
    }


# ─── 2. BATCH RECORD OFFLINE GPS PINGS (MOBILE SYNC) ────────────────────────

@router.post("/ping-batch", status_code=status.HTTP_201_CREATED)
async def record_location_ping_batch(
    payload: LocationPingBatchPayload,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Batch inserts GPS breadcrumbs buffered locally while offline on mobile devices.
    """
    employee = await _get_current_employee(db, ctx)
    if not employee:
        raise HTTPException(status_code=400, detail="User account is not linked to an active Employee profile")

    if not payload.pings:
        return {"success": True, "count": 0}

    now_utc = datetime.now(timezone.utc)
    today_date = now_utc.date()

    att_stmt = (
        select(AttendanceRecord.id)
        .where(
            AttendanceRecord.tenant_id == ctx.tenant_id,
            AttendanceRecord.employee_id == employee.id,
            AttendanceRecord.date == today_date,
        )
        .limit(1)
    )
    att_res = await db.execute(att_stmt)
    today_att_id = att_res.scalar_one_or_none()

    new_records = []
    for item in payload.pings:
        t_time = item.recorded_at or now_utc
        trail = EmployeeLocationTrail(
            id=uuid.uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=employee.company_id or ctx.active_company_id,
            employee_id=employee.id,
            attendance_id=item.attendance_id or today_att_id,
            latitude=float(item.latitude),
            longitude=float(item.longitude),
            accuracy=item.accuracy,
            speed=item.speed,
            heading=item.heading,
            altitude=item.altitude,
            activity_type=item.activity_type or "traveling",
            location_name=item.location_name,
            battery_level=item.battery_level,
            is_mock=bool(item.is_mock),
            recorded_at=t_time,
        )
        new_records.append(trail)

    db.add_all(new_records)
    await db.commit()

    return {"success": True, "count": len(new_records)}


# ─── 3. GET ROUTE MAP & SHIFT TRAVEL ANALYTICS ──────────────────────────────

@router.get("/history", response_model=EmployeeRouteHistoryResponse)
async def get_employee_route_history(
    employee_id: Optional[uuid.UUID] = Query(None, description="Target Employee ID. Defaults to current user if omitted."),
    date_str: Optional[str] = Query(None, description="Shift Date (YYYY-MM-DD). Defaults to today."),
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """
    Retrieves the complete chronological GPS route traveled by an employee during their shift.
    Computes total distance (KM), idle stops, transit vs stationary hours, and speeds.
    """
    # 1. Resolve Target Employee
    target_emp: Optional[Employee] = None
    if employee_id:
        emp_stmt = select(Employee).where(Employee.tenant_id == ctx.tenant_id, Employee.id == employee_id)
        target_emp = (await db.execute(emp_stmt)).scalars().first()
        if not target_emp:
            raise HTTPException(status_code=404, detail="Employee not found")
    else:
        target_emp = await _get_current_employee(db, ctx)
        if not target_emp:
            # Fallback: grab first active employee in this tenant for viewing
            target_emp = (await db.execute(select(Employee).where(Employee.tenant_id == ctx.tenant_id).limit(1))).scalars().first()
            if not target_emp:
                raise HTTPException(status_code=404, detail="No employee records available")

    # 2. Resolve Target Date Range (UTC boundaries for query)
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            target_date = datetime.now(timezone.utc).date()
    else:
        target_date = datetime.now(timezone.utc).date()

    start_dt = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=timezone.utc)
    end_dt = start_dt + timedelta(days=1)

    # 3. Fetch Attendance record for Shift Context
    att_stmt = select(AttendanceRecord).where(
        AttendanceRecord.tenant_id == ctx.tenant_id,
        AttendanceRecord.employee_id == target_emp.id,
        AttendanceRecord.date == target_date,
    ).limit(1)
    attendance_record = (await db.execute(att_stmt)).scalars().first()

    # 4. Fetch Chronological GPS Breadcrumbs
    trail_stmt = (
        select(EmployeeLocationTrail)
        .where(
            EmployeeLocationTrail.tenant_id == ctx.tenant_id,
            EmployeeLocationTrail.employee_id == target_emp.id,
            EmployeeLocationTrail.recorded_at >= start_dt,
            EmployeeLocationTrail.recorded_at < end_dt,
        )
        .order_by(EmployeeLocationTrail.recorded_at.asc())
    )
    raw_points = (await db.execute(trail_stmt)).scalars().all()

    # If no breadcrumbs yet but Attendance has punch coordinates, synthesize start/end points
    trail_points: list[LocationTrailPoint] = []
    if raw_points:
        for p in raw_points:
            trail_points.append(
                LocationTrailPoint(
                    id=p.id,
                    latitude=float(p.latitude),
                    longitude=float(p.longitude),
                    accuracy=p.accuracy,
                    speed=p.speed,
                    heading=p.heading,
                    altitude=p.altitude,
                    activity_type=p.activity_type,
                    location_name=p.location_name,
                    battery_level=p.battery_level,
                    is_mock=p.is_mock,
                    recorded_at=p.recorded_at,
                )
            )
    elif attendance_record and attendance_record.latitude and attendance_record.longitude:
        # Check-in point
        trail_points.append(
            LocationTrailPoint(
                id=uuid.uuid4(),
                latitude=float(attendance_record.latitude),
                longitude=float(attendance_record.longitude),
                activity_type="check_in",
                location_name="Clock-In Location",
                recorded_at=attendance_record.check_in or start_dt,
            )
        )
        if attendance_record.check_out:
            trail_points.append(
                LocationTrailPoint(
                    id=uuid.uuid4(),
                    latitude=float(attendance_record.latitude),
                    longitude=float(attendance_record.longitude),
                    activity_type="check_out",
                    location_name="Clock-Out Location",
                    recorded_at=attendance_record.check_out,
                )
            )

    # 5. Compute Route Analytics (Distance, Speed, Stops)
    total_dist_km = 0.0
    top_speed = 0.0
    speeds: list[float] = []
    stops: list[RouteStopItem] = []

    if len(trail_points) >= 2:
        current_stop_start = trail_points[0]
        current_stop_points = [trail_points[0]]

        for i in range(1, len(trail_points)):
            p1 = trail_points[i - 1]
            p2 = trail_points[i]

            step_dist = haversine_distance_km(p1.latitude, p1.longitude, p2.latitude, p2.longitude)
            total_dist_km += step_dist

            if p2.speed and p2.speed > 0:
                speeds.append(p2.speed)
                if p2.speed > top_speed:
                    top_speed = p2.speed

            # Stop Detection: if distance from anchor <= 0.035 km (35 meters)
            dist_from_anchor = haversine_distance_km(
                current_stop_start.latitude, current_stop_start.longitude,
                p2.latitude, p2.longitude
            )
            if dist_from_anchor <= 0.040:
                current_stop_points.append(p2)
            else:
                # Check if previous cluster was a stationary stop (>= 6 minutes)
                duration_sec = (current_stop_points[-1].recorded_at - current_stop_start.recorded_at).total_seconds()
                duration_min = duration_sec / 60.0
                if duration_min >= 6.0:
                    avg_lat = sum(pt.latitude for pt in current_stop_points) / len(current_stop_points)
                    avg_lon = sum(pt.longitude for pt in current_stop_points) / len(current_stop_points)
                    stops.append(
                        RouteStopItem(
                            latitude=avg_lat,
                            longitude=avg_lon,
                            location_name=current_stop_points[0].location_name or "Client Visit / Stationary Stop",
                            arrived_at=current_stop_start.recorded_at,
                            departed_at=current_stop_points[-1].recorded_at,
                            duration_minutes=round(duration_min, 1),
                        )
                    )
                current_stop_start = p2
                current_stop_points = [p2]

        # Check trailing stop cluster
        if len(current_stop_points) > 1:
            duration_sec = (current_stop_points[-1].recorded_at - current_stop_start.recorded_at).total_seconds()
            duration_min = duration_sec / 60.0
            if duration_min >= 6.0:
                avg_lat = sum(pt.latitude for pt in current_stop_points) / len(current_stop_points)
                avg_lon = sum(pt.longitude for pt in current_stop_points) / len(current_stop_points)
                stops.append(
                    RouteStopItem(
                        latitude=avg_lat,
                        longitude=avg_lon,
                        location_name=current_stop_points[0].location_name or "Client Visit / Stationary Stop",
                        arrived_at=current_stop_start.recorded_at,
                        departed_at=current_stop_points[-1].recorded_at,
                        duration_minutes=round(duration_min, 1),
                    )
                )

    # 6. Time and Speed Totals
    total_duration_hours = 0.0
    if len(trail_points) >= 2:
        total_sec = (trail_points[-1].recorded_at - trail_points[0].recorded_at).total_seconds()
        total_duration_hours = round(max(0.0, total_sec / 3600.0), 2)

    idle_minutes = sum(s.duration_minutes for s in stops)
    idle_time_hours = round(idle_minutes / 60.0, 2)
    moving_time_hours = max(0.0, round(total_duration_hours - idle_time_hours, 2))

    avg_speed = round(sum(speeds) / len(speeds), 1) if speeds else (round(total_dist_km / max(0.1, moving_time_hours), 1) if moving_time_hours > 0 else 0.0)

    # 7. Check-in / Check-out locations and Device Blackout Diagnostics
    check_in_loc = None
    check_out_loc = None
    last_known_loc = None
    last_ping_time = None
    last_lat = None
    last_lon = None
    last_battery = None
    device_health_status = "Active"
    disconnect_reason = None
    minutes_since_last_ping = None
    is_device_offline = False

    if trail_points:
        last_pt = trail_points[-1]
        last_ping_time = last_pt.recorded_at
        last_lat = last_pt.latitude
        last_lon = last_pt.longitude
        last_battery = last_pt.battery_level
        last_known_loc = last_pt.location_name or f"Lat: {last_pt.latitude:.4f}, Lon: {last_pt.longitude:.4f}"

        check_in_loc = trail_points[0].location_name or f"Lat: {trail_points[0].latitude:.4f}, Lon: {trail_points[0].longitude:.4f}"
        if attendance_record and attendance_record.check_out:
            check_out_loc = trail_points[-1].location_name or f"Lat: {trail_points[-1].latitude:.4f}, Lon: {trail_points[-1].longitude:.4f}"
            device_health_status = "Shift Completed"
            disconnect_reason = f"Shift concluded with authorized clock-out at {attendance_record.check_out.strftime('%H:%M:%S')}."
            is_device_offline = False
        else:
            # Active or Interrupted Shift Diagnostic
            now_utc = datetime.now(timezone.utc)
            delta_seconds = max(0.0, (now_utc - last_pt.recorded_at).total_seconds())
            mins_ago = int(delta_seconds / 60.0)
            minutes_since_last_ping = mins_ago

            if target_date == now_utc.date():
                if mins_ago <= 6:
                    device_health_status = "Online & Active"
                    disconnect_reason = "Device active and streaming real-time GPS pings."
                    is_device_offline = False
                elif last_battery is not None and last_battery <= 5:
                    device_health_status = "Battery Exhausted (Shutdown)"
                    disconnect_reason = f"Phone battery drained to {last_battery}% at {last_pt.recorded_at.strftime('%H:%M:%S')} ({mins_ago}m ago). Probable power-off due to dead battery."
                    is_device_offline = True
                else:
                    device_health_status = "Sudden Power-Off / Signal Drop"
                    bat_note = f"Battery was at {last_battery}% at last ping." if last_battery is not None else "Battery status unavailable."
                    disconnect_reason = f"No GPS pings received since {last_pt.recorded_at.strftime('%H:%M:%S')} ({mins_ago}m ago). {bat_note} Device was suddenly switched off, put into flight mode, or entered a no-reception dead zone."
                    is_device_offline = True
            else:
                device_health_status = "Historical Shift"
                disconnect_reason = f"Historical shift record on {target_date.isoformat()}."
                is_device_offline = False

    dept_name = None
    if hasattr(target_emp, "department") and target_emp.department and hasattr(target_emp.department, "name"):
        dept_name = target_emp.department.name
    elif hasattr(target_emp, "department_name"):
        dept_name = getattr(target_emp, "department_name", None)

    desig_name = None
    if hasattr(target_emp, "designation") and target_emp.designation and hasattr(target_emp.designation, "name"):
        desig_name = target_emp.designation.name
    elif hasattr(target_emp, "job_title"):
        desig_name = getattr(target_emp, "job_title", None)

    emp_name = getattr(target_emp, "full_name", None) or f"{getattr(target_emp, 'first_name', '')} {getattr(target_emp, 'last_name', '')}".strip() or "Employee"
    avatar = getattr(target_emp, "avatar_url", None) or getattr(target_emp, "photo_url", None)

    return EmployeeRouteHistoryResponse(
        employee_id=target_emp.id,
        employee_name=emp_name,
        employee_code=target_emp.employee_code,
        department=dept_name,
        designation=desig_name,
        avatar_url=avatar,
        phone=target_emp.phone,
        date=target_date.isoformat(),
        shift_status=attendance_record.status if attendance_record else ("Present" if trail_points else "No Shift Data"),
        check_in_time=attendance_record.check_in if attendance_record else (trail_points[0].recorded_at if trail_points else None),
        check_out_time=attendance_record.check_out if attendance_record else (trail_points[-1].recorded_at if len(trail_points) > 1 and attendance_record and attendance_record.check_out else None),
        check_in_location=check_in_loc,
        check_out_location=check_out_loc,
        total_distance_km=round(total_dist_km, 2),
        total_duration_hours=total_duration_hours,
        moving_time_hours=moving_time_hours,
        idle_time_hours=idle_time_hours,
        avg_speed_kmh=avg_speed,
        top_speed_kmh=round(top_speed, 1),
        points_count=len(trail_points),
        last_ping_time=last_ping_time,
        last_known_location=last_known_loc,
        last_latitude=last_lat,
        last_longitude=last_lon,
        last_battery_level=last_battery,
        device_health_status=device_health_status,
        disconnect_reason=disconnect_reason,
        minutes_since_last_ping=minutes_since_last_ping,
        is_device_offline=is_device_offline,
        trail_points=trail_points,
        stops=stops,
    )


# ─── 4. GET LIVE FLEET / ACTIVE FIELD STAFF RADAR ───────────────────────────

@router.get("/live-field-staff", response_model=List[LiveFieldStaffItem])
async def get_live_field_staff(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Returns all on-duty field employees currently clocked-in today with their real-time coordinates,
    battery levels, current speeds, and shift travel distance.
    """
    today_date = datetime.now(timezone.utc).date()
    now_utc = datetime.now(timezone.utc)
    start_today = datetime(today_date.year, today_date.month, today_date.day, 0, 0, 0, tzinfo=timezone.utc)
    six_minutes_ago = now_utc - timedelta(minutes=6)

    # 1. Query all employees of this tenant
    emp_stmt = select(Employee).where(Employee.tenant_id == ctx.tenant_id, Employee.status == "Active")
    employees = (await db.execute(emp_stmt)).scalars().all()
    if not employees:
        return []

    emp_ids = [e.id for e in employees]

    # 2. Get today's attendance records
    att_stmt = select(AttendanceRecord).where(
        AttendanceRecord.tenant_id == ctx.tenant_id,
        AttendanceRecord.employee_id.in_(emp_ids),
        AttendanceRecord.date == today_date,
    )
    attendances = {att.employee_id: att for att in (await db.execute(att_stmt)).scalars().all()}

    # 3. Query all location trails for today to get latest point + distance
    trail_stmt = (
        select(EmployeeLocationTrail)
        .where(
            EmployeeLocationTrail.tenant_id == ctx.tenant_id,
            EmployeeLocationTrail.employee_id.in_(emp_ids),
            EmployeeLocationTrail.recorded_at >= start_today,
        )
        .order_by(EmployeeLocationTrail.recorded_at.asc())
    )
    all_trails = (await db.execute(trail_stmt)).scalars().all()

    # Group trails by employee
    trails_by_emp: dict[uuid.UUID, list[EmployeeLocationTrail]] = {}
    for t in all_trails:
        trails_by_emp.setdefault(t.employee_id, []).append(t)

    results: list[LiveFieldStaffItem] = []

    for emp in employees:
        att = attendances.get(emp.id)
        emp_trail = trails_by_emp.get(emp.id, [])

        dept_name = None
        if hasattr(emp, "department") and emp.department and hasattr(emp.department, "name"):
            dept_name = emp.department.name
        elif hasattr(emp, "department_name"):
            dept_name = getattr(emp, "department_name", None)

        desig_name = None
        if hasattr(emp, "designation") and emp.designation and hasattr(emp.designation, "name"):
            desig_name = emp.designation.name
        elif hasattr(emp, "job_title"):
            desig_name = getattr(emp, "job_title", None)

        emp_name = getattr(emp, "full_name", None) or f"{getattr(emp, 'first_name', '')} {getattr(emp, 'last_name', '')}".strip() or "Employee"
        avatar = getattr(emp, "avatar_url", None) or getattr(emp, "photo_url", None)

        # If employee has trail points or has attendance coordinates
        if emp_trail:
            latest_pt = emp_trail[-1]
            # Calculate distance traveled today
            dist_km = 0.0
            for i in range(1, len(emp_trail)):
                dist_km += haversine_distance_km(
                    emp_trail[i - 1].latitude, emp_trail[i - 1].longitude,
                    emp_trail[i].latitude, emp_trail[i].longitude
                )

            mins_since = max(0, int((now_utc - latest_pt.recorded_at).total_seconds() / 60.0))
            is_online = latest_pt.recorded_at >= six_minutes_ago

            if is_online:
                health_status = "Online & Streaming"
                diag_reason = "Device active with continuous GPS streaming."
            elif latest_pt.battery_level is not None and latest_pt.battery_level <= 5:
                health_status = "Battery Exhausted (Shutdown)"
                diag_reason = f"Battery depleted ({latest_pt.battery_level}%) at {latest_pt.recorded_at.strftime('%H:%M:%S')}."
            else:
                health_status = "Sudden Power-Off / Signal Drop"
                bat_text = f"Battery was {latest_pt.battery_level}%." if latest_pt.battery_level is not None else ""
                diag_reason = f"No ping for {mins_since} mins (last seen at {latest_pt.recorded_at.strftime('%H:%M:%S')}). {bat_text}"

            results.append(
                LiveFieldStaffItem(
                    employee_id=emp.id,
                    employee_name=emp_name,
                    employee_code=emp.employee_code,
                    department=dept_name,
                    designation=desig_name,
                    avatar_url=avatar,
                    phone=emp.phone,
                    check_in_time=att.check_in if att else emp_trail[0].recorded_at,
                    current_latitude=float(latest_pt.latitude),
                    current_longitude=float(latest_pt.longitude),
                    current_location_name=latest_pt.location_name or f"Lat: {latest_pt.latitude:.4f}, Lon: {latest_pt.longitude:.4f}",
                    current_speed_kmh=latest_pt.speed,
                    battery_level=latest_pt.battery_level,
                    last_ping_time=latest_pt.recorded_at,
                    is_online=is_online,
                    minutes_since_ping=mins_since,
                    device_health_status=health_status,
                    disconnect_reason=diag_reason,
                    shift_distance_km=round(dist_km, 2),
                )
            )
        elif att and att.latitude and att.longitude:
            results.append(
                LiveFieldStaffItem(
                    employee_id=emp.id,
                    employee_name=emp_name,
                    employee_code=emp.employee_code,
                    department=dept_name,
                    designation=desig_name,
                    avatar_url=avatar,
                    phone=emp.phone,
                    check_in_time=att.check_in,
                    current_latitude=float(att.latitude),
                    current_longitude=float(att.longitude),
                    current_location_name="Base / Check-In Location",
                    current_speed_kmh=0.0,
                    battery_level=None,
                    last_ping_time=att.check_in or start_today,
                    is_online=False,
                    minutes_since_ping=max(0, int((now_utc - (att.check_in or start_today)).total_seconds() / 60.0)),
                    device_health_status="Offline / Initial Check-In Only",
                    disconnect_reason="Clocked in at stationary post with no subsequent travel pings.",
                    shift_distance_km=0.0,
                )
            )

    return results
