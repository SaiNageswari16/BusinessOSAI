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
from pydantic import BaseModel, Field
from sqlalchemy import select, and_, func, desc, delete
from sqlalchemy.ext.asyncio import AsyncSession

import os
from src.services.staff.deps import get_db
from src.config import get_settings
from src.services.staff.deps import CurrentUserContext, get_current_user_context, require_permission
from src.services.staff.models import (
    Employee,
    AttendanceRecord,
    EmployeeLocationTrail,
    Department,
    Designation,
    SystemSetting,
)
from src.services.staff.schemas import (
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


@router.get("/config")
async def get_travel_routes_config(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Returns the resolved Google Maps configuration for the current organization.
    Order of precedence:
    1. Tenant/Org override from database (SystemSetting: google_maps_api_key)
    2. Platform-wide fallback from .env (GOOGLE_MAPS_API_KEY)
    """
    # 1. Check org setting in DB
    stmt = select(SystemSetting.value).where(
        SystemSetting.tenant_id == ctx.tenant_id,
        SystemSetting.key == "google_maps_api_key",
    ).limit(1)
    res = await db.execute(stmt)
    db_key = res.scalar_one_or_none()

    # 2. Check platform fallback from env
    app_settings = get_settings()
    env_key = getattr(app_settings, "google_maps_api_key", "") or os.getenv("GOOGLE_MAPS_API_KEY", "")

    effective_key = db_key or env_key or ""
    is_platform_default = not bool(db_key) and bool(env_key)

    return {
        "google_maps_api_key": effective_key,
        "is_custom_org_key": bool(db_key),
        "is_platform_default": is_platform_default,
        "has_key": bool(effective_key),
    }


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
    date: Optional[str] = Query(None, description="Shift Date alias (YYYY-MM-DD)"),
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
    effective_date_str = date or date_str
    if effective_date_str:
        try:
            target_date = datetime.strptime(effective_date_str, "%Y-%m-%d").date()
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
    if getattr(target_emp, "department_id", None):
        dept_name = await db.scalar(select(Department.name).where(Department.id == target_emp.department_id))
    elif hasattr(target_emp, "department_name"):
        dept_name = getattr(target_emp, "department_name", None)

    desig_name = None
    if getattr(target_emp, "designation_id", None):
        desig_name = await db.scalar(select(Designation.name).where(Designation.id == target_emp.designation_id))
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


class SimulateRoutePayload(BaseModel):
    employee_id: uuid.UUID
    date: Optional[str] = None
    date_str: Optional[str] = None
    base_lat: Optional[float] = None
    base_lon: Optional[float] = None
    city: Optional[str] = "Office Headquarters"


@router.post("/simulate-route")
async def simulate_employee_route(
    payload: SimulateRoutePayload,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Generates a realistic full-shift roadmap trail (22 GPS breadcrumbs with 4 realistic client halts)
    for a chosen employee on a target date. Allows immediate verification of map tracking and analytics.
    """
    emp_stmt = select(Employee).where(Employee.tenant_id == ctx.tenant_id, Employee.id == payload.employee_id)
    target_emp = (await db.execute(emp_stmt)).scalars().first()
    if not target_emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    effective_date_str = payload.date or payload.date_str
    if effective_date_str:
        try:
            target_date = datetime.strptime(effective_date_str, "%Y-%m-%d").date()
        except ValueError:
            target_date = datetime.now(timezone.utc).date()
    else:
        target_date = datetime.now(timezone.utc).date()

    start_dt = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=timezone.utc)
    end_dt = start_dt + timedelta(days=1)

    # 1. Base anchor coordinates
    base_lat = payload.base_lat
    base_lon = payload.base_lon
    if not base_lat or not base_lon:
        att_stmt = select(AttendanceRecord).where(
            AttendanceRecord.tenant_id == ctx.tenant_id,
            AttendanceRecord.employee_id == target_emp.id,
            AttendanceRecord.latitude.isnot(None),
        ).limit(1)
        prev_att = (await db.execute(att_stmt)).scalars().first()
        if prev_att and prev_att.latitude and prev_att.longitude:
            base_lat = float(prev_att.latitude)
            base_lon = float(prev_att.longitude)
        else:
            base_lat = 17.3850
            base_lon = 78.4867

    # 2. Clear old trails for this employee on this date to refresh cleanly
    del_stmt = delete(EmployeeLocationTrail).where(
        EmployeeLocationTrail.tenant_id == ctx.tenant_id,
        EmployeeLocationTrail.employee_id == target_emp.id,
        EmployeeLocationTrail.recorded_at >= start_dt,
        EmployeeLocationTrail.recorded_at < end_dt,
    )
    await db.execute(del_stmt)

    # 3. Create or update Attendance record for today
    att_today_stmt = select(AttendanceRecord).where(
        AttendanceRecord.tenant_id == ctx.tenant_id,
        AttendanceRecord.employee_id == target_emp.id,
        AttendanceRecord.date == target_date,
    ).limit(1)
    att_rec = (await db.execute(att_today_stmt)).scalars().first()
    clock_in_time = start_dt.replace(hour=9, minute=15)
    clock_out_time = start_dt.replace(hour=18, minute=5)

    if not att_rec:
        att_rec = AttendanceRecord(
            id=uuid.uuid4(),
            tenant_id=ctx.tenant_id,
            employee_id=target_emp.id,
            date=target_date,
            status="Present",
            check_in=clock_in_time,
            check_out=clock_out_time,
            hours_worked=8.8,
            method="GPS Mobile",
            latitude=base_lat,
            longitude=base_lon,
            is_geofence_verified=True,
            notes="Field simulated route",
        )
        db.add(att_rec)
        await db.flush()
    else:
        att_rec.check_in = clock_in_time
        att_rec.check_out = clock_out_time
        att_rec.hours_worked = 8.8
        att_rec.latitude = base_lat
        att_rec.longitude = base_lon
        att_rec.status = "Present"
        att_rec.method = "GPS Mobile"
        att_rec.is_geofence_verified = True

    # 4. Realistic shift trajectory sequence
    # Format: (d_lat, d_lon, minutes_offset, speed_kmh, activity, location_name, battery_percent)
    waypoints = [
        (0.0000, 0.0000, 0, 0.0, "stationary", "HQ Office (Shift Punch-In)", 98),
        (0.0052, 0.0068, 15, 34.0, "driving", "Main Arterial Expressway Link", 96),
        (0.0125, 0.0142, 28, 42.5, "driving", "Outer Ring Road Transit", 95),
        # Stop 1: Tech Park Client Site (45 mins)
        (0.0185, 0.0210, 42, 0.0, "stationary", "Client Site Alpha - Tech Solutions Ltd", 93),
        (0.0186, 0.0211, 62, 0.0, "stationary", "Client Site Alpha - Meeting Room A", 92),
        (0.0185, 0.0210, 87, 0.0, "stationary", "Client Site Alpha - Departure", 90),
        # Transit to Stop 2
        (0.0240, 0.0150, 102, 38.0, "driving", "Central Commercial Boulevard", 88),
        (0.0310, 0.0080, 118, 48.0, "driving", "Logistics Corridor", 86),
        # Stop 2: Retail Hub (50 mins)
        (0.0385, 0.0010, 134, 0.0, "stationary", "Retail Hub & Distributor Apex", 84),
        (0.0384, 0.0011, 158, 0.0, "stationary", "Retail Hub - Inventory Verification", 82),
        (0.0385, 0.0010, 184, 0.0, "stationary", "Retail Hub - Order Signoff", 80),
        # Transit to Lunch Stop
        (0.0290, -0.0080, 200, 31.0, "driving", "Metro Cross Avenue", 78),
        # Stop 3: Lunch & Rest Stop (40 mins)
        (0.0250, -0.0140, 215, 0.0, "stationary", "City Diner & Food Court (Rest Halt)", 76),
        (0.0251, -0.0139, 238, 0.0, "stationary", "City Diner - Rest Period", 74),
        (0.0250, -0.0140, 255, 0.0, "stationary", "Departure after Lunch Break", 72),
        # Transit to Stop 4
        (0.0140, -0.0210, 272, 45.0, "driving", "South Bypass Parkway", 69),
        # Stop 4: Warehouse Depot (60 mins)
        (0.0060, -0.0260, 292, 0.0, "stationary", "Regional Fulfillment Center & Warehouse", 66),
        (0.0061, -0.0259, 322, 0.0, "stationary", "Warehouse Dispatch & Verification", 63),
        (0.0060, -0.0260, 352, 0.0, "stationary", "Warehouse - Loading Complete", 60),
        # Return journey back to base
        (0.0020, -0.0130, 372, 39.0, "driving", "Highway Connecting Ramp", 57),
        (0.0005, -0.0040, 388, 28.0, "driving", "Approaching HQ Complex", 55),
        # Final Return to HQ
        (0.0000, 0.0000, 405, 0.0, "stationary", "HQ Office - Shift End & Clock-Out", 53),
    ]

    new_trails: list[EmployeeLocationTrail] = []
    for d_lat, d_lon, mins, spd, act, loc, bat in waypoints:
        pt_time = clock_in_time + timedelta(minutes=mins)
        trail = EmployeeLocationTrail(
            id=uuid.uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=target_emp.company_id,
            employee_id=target_emp.id,
            attendance_id=att_rec.id,
            latitude=round(base_lat + d_lat, 6),
            longitude=round(base_lon + d_lon, 6),
            accuracy=3.5,
            speed=spd,
            heading=45.0 if spd > 0 else 0.0,
            altitude=510.0,
            activity_type=act,
            location_name=loc,
            battery_level=bat,
            is_mock=True,
            recorded_at=pt_time,
        )
        new_trails.append(trail)

    db.add_all(new_trails)
    await db.commit()

    return {
        "success": True,
        "message": f"Successfully simulated realistic daily roadmap for {target_emp.full_name or 'Employee'}",
        "date": target_date.isoformat(),
        "points_created": len(new_trails),
        "employee_id": target_emp.id,
    }


@router.delete("/clear-route")
async def clear_employee_route(
    employee_id: uuid.UUID = Query(..., description="Target Employee ID"),
    date_str: Optional[str] = Query(None, description="Date to purge (YYYY-MM-DD)"),
    date: Optional[str] = Query(None, description="Date alias"),
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """
    Purges all GPS location trails for an employee on a target date.
    """
    effective_date_str = date or date_str
    if effective_date_str:
        try:
            target_date = datetime.strptime(effective_date_str, "%Y-%m-%d").date()
        except ValueError:
            target_date = datetime.now(timezone.utc).date()
    else:
        target_date = datetime.now(timezone.utc).date()

    start_dt = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=timezone.utc)
    end_dt = start_dt + timedelta(days=1)

    del_stmt = delete(EmployeeLocationTrail).where(
        EmployeeLocationTrail.tenant_id == ctx.tenant_id,
        EmployeeLocationTrail.employee_id == employee_id,
        EmployeeLocationTrail.recorded_at >= start_dt,
        EmployeeLocationTrail.recorded_at < end_dt,
    )
    result = await db.execute(del_stmt)
    await db.commit()

    return {
        "success": True,
        "deleted_count": result.rowcount,
        "employee_id": employee_id,
        "date": target_date.isoformat(),
    }


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

    # 1. Query all employees of this tenant with department/designation names
    emp_stmt = (
        select(
            Employee,
            Department.name.label("department_name"),
            Designation.name.label("designation_name"),
        )
        .select_from(Employee)
        .outerjoin(Department, Employee.department_id == Department.id)
        .outerjoin(Designation, Employee.designation_id == Designation.id)
        .where(Employee.tenant_id == ctx.tenant_id, Employee.status == "Active")
    )
    emp_rows = (await db.execute(emp_stmt)).all()
    if not emp_rows:
        return []

    emp_ids = [row[0].id for row in emp_rows]

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

    for row in emp_rows:
        emp = row[0]
        dept_name = row[1]
        desig_name = row[2]

        att = attendances.get(emp.id)
        emp_trail = trails_by_emp.get(emp.id, [])

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
