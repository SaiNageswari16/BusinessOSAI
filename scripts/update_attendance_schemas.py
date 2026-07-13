import os

schema_file = os.path.join("backend", "src", "schemas", "erp.py")
with open(schema_file, "r", encoding="utf-8") as f:
    content = f.read()

target1 = """class AttendanceRecordCreate(BaseModel):
    employee_id: uuid.UUID
    date: date
    check_in: datetime | None = None
    check_out: datetime | None = None
    hours_worked: float | None = None
    status: str = "Present"  # Present|Absent|Late|Half Day|On Leave
    method: str = "Biometric"  # Biometric|GPS|Face|Manual
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None"""

replacement1 = """class AttendanceRecordCreate(BaseModel):
    employee_id: uuid.UUID
    date: date
    check_in: datetime | None = None
    check_out: datetime | None = None
    hours_worked: float | None = None
    status: str = "Present"  # Present|Absent|Late|Half Day|On Leave
    method: str = "Biometric"  # Biometric|GPS|Face|Manual
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None
    ip_address: str | None = None"""

target2 = """class AttendanceRecordResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    employee_code: str | None = None
    date: date
    check_in: datetime | None
    check_out: datetime | None
    hours_worked: float | None
    status: str
    method: str
    latitude: float | None
    longitude: float | None
    notes: str | None
    created_at: datetime"""

replacement2 = """class AttendanceRecordResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    employee_code: str | None = None
    date: date
    check_in: datetime | None
    check_out: datetime | None
    hours_worked: float | None
    status: str
    method: str
    latitude: float | None
    longitude: float | None
    notes: str | None
    ip_address: str | None = None
    created_at: datetime"""

line_ending = "\r\n" if "\r\n" in content else "\n"

content = content.replace(target1.replace("\n", line_ending), replacement1.replace("\n", line_ending))
content = content.replace(target2.replace("\n", line_ending), replacement2.replace("\n", line_ending))

with open(schema_file, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Updated schemas/erp.py successfully")
