import os

target = os.path.join("backend", "src", "api", "v1", "hrms", "attendance.py")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update list_attendance response map
old_list_map = """                latitude=float(att.latitude) if att.latitude is not None else None,
                longitude=float(att.longitude) if att.longitude is not None else None,
                notes=att.notes,
                created_at=att.created_at,
                updated_at=att.updated_at,
            )"""

new_list_map = """                latitude=float(att.latitude) if att.latitude is not None else None,
                longitude=float(att.longitude) if att.longitude is not None else None,
                notes=att.notes,
                ip_address=att.ip_address,
                created_at=att.created_at,
                updated_at=att.updated_at,
            )"""

# 2. Update clock_in function
old_clock_in = """    now_tz = datetime.now(timezone.utc)
    att = AttendanceRecord(
        tenant_id=ctx.tenant_id,
        employee_id=emp.id,
        date=today,
        check_in=now_tz,
        status="Present",
        method=payload.method,
        latitude=payload.latitude,
        longitude=payload.longitude,
        notes=payload.notes,
    )
    db.add(att)"""

new_clock_in = """    # GPS Geofence Restriction check
    if payload.method in ("GPS", "Office") and (not payload.notes or "WFH" not in payload.notes):
        office_lat, office_lng = 37.7749, -122.4194
        if payload.latitude is not None and payload.longitude is not None:
            import math
            lat1, lon1 = math.radians(payload.latitude), math.radians(payload.longitude)
            lat2, lon2 = math.radians(office_lat), math.radians(office_lng)
            dlat, dlon = lat2 - lat1, lon2 - lon1
            a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
            distance = 6371000 * c  # distance in meters
            
            if distance > 500:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"GPS check-in failed: You are {round(distance)}m away from the office. Permitted geofence limit is 500m. Please select WFH punch instead if working remotely."
                )

    now_tz = datetime.now(timezone.utc)
    att = AttendanceRecord(
        tenant_id=ctx.tenant_id,
        employee_id=emp.id,
        date=today,
        check_in=now_tz,
        status="Present",
        method=payload.method,
        latitude=payload.latitude,
        longitude=payload.longitude,
        notes=payload.notes,
        ip_address=request.client.host if request.client else None,
    )
    db.add(att)"""

# 3. Update clock_out lookup and IP capture
old_clock_out = """    today = date.today()
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

    att.latitude = payload.latitude or att.latitude
    att.longitude = payload.longitude or att.longitude
    att.notes = payload.notes or att.notes"""

new_clock_out = """    # Find the most recent check-in that doesn't have a check-out yet (robust date & night shifts support)
    att = await db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.tenant_id == ctx.tenant_id,
            AttendanceRecord.employee_id == emp.id,
            AttendanceRecord.check_out.is_(None)
        ).order_by(AttendanceRecord.date.desc(), AttendanceRecord.check_in.desc()).limit(1)
    )
    if not att:
        raise HTTPException(status_code=400, detail="No active check-in record found. Please clock-in first.")

    now_tz = datetime.now(timezone.utc)
    att.check_out = now_tz
    
    # Calculate hours
    if att.check_in:
        delta = now_tz - att.check_in
        att.hours_worked = round(delta.total_seconds() / 3600.0, 2)
    else:
        att.hours_worked = 8.0

    att.latitude = payload.latitude or att.latitude
    att.longitude = payload.longitude or att.longitude
    att.notes = payload.notes or att.notes
    att.ip_address = request.client.host if request.client else att.ip_address"""

line_ending = "\r\n" if "\r\n" in content else "\n"

content = content.replace(old_list_map.replace("\n", line_ending), new_list_map.replace("\n", line_ending))
content = content.replace(old_clock_in.replace("\n", line_ending), new_clock_in.replace("\n", line_ending))
content = content.replace(old_clock_out.replace("\n", line_ending), new_clock_out.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Updated api/v1/hrms/attendance.py successfully")
