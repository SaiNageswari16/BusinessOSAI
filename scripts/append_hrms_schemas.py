import os

target = os.path.join("backend", "src", "schemas", "erp.py")

SCHEMAS_TO_APPEND = """

# ─── HRMS — Employee & Attendance Schemas ───────────────────────────

from datetime import date


class EmployeeBase(BaseModel):
    employee_code: str = Field(min_length=1, max_length=50)
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    phone: str | None = Field(None, max_length=50)
    date_of_birth: date | None = None
    date_of_joining: date
    employment_type: str = "Full-Time"  # Full-Time|Part-Time|Contract|Internship
    status: str = "Active"  # Active|On Leave|Inactive
    basic_salary: float | None = None
    company_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None
    designation_id: uuid.UUID | None = None
    manager_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    employee_code: str | None = None
    full_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    date_of_birth: date | None = None
    date_of_joining: date | None = None
    employment_type: str | None = None
    status: str | None = None
    basic_salary: float | None = None
    company_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None
    designation_id: uuid.UUID | None = None
    manager_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None


class EmployeeResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_code: str
    full_name: str
    email: str
    phone: str | None
    date_of_birth: date | None
    date_of_joining: date
    employment_type: str
    status: str
    basic_salary: float | None
    company_id: uuid.UUID | None
    branch_id: uuid.UUID | None
    department_id: uuid.UUID | None
    designation_id: uuid.UUID | None
    manager_id: uuid.UUID | None
    user_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class EmployeeBulkCreate(BaseModel):
    employees: list[EmployeeCreate]


class EmployeeDocumentCreate(BaseModel):
    document_name: str = Field(min_length=1, max_length=200)
    document_type: str = Field(min_length=1, max_length=100)  # Contract|ID Proof|NDA|compliance
    file_path: str = Field(min_length=1, max_length=500)
    expiry_date: date | None = None
    status: str = "Valid"


class EmployeeDocumentUpdate(BaseModel):
    document_name: str | None = None
    document_type: str | None = None
    file_path: str | None = None
    expiry_date: date | None = None
    status: str | None = None


class EmployeeDocumentResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    document_name: str
    document_type: str
    file_path: str
    upload_date: date
    expiry_date: date | None
    status: str
    created_at: datetime
    updated_at: datetime


class AttendanceRecordCreate(BaseModel):
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


class AttendanceRecordUpdate(BaseModel):
    check_in: datetime | None = None
    check_out: datetime | None = None
    hours_worked: float | None = None
    status: str | None = None
    method: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None


class AttendanceRecordResponse(ORMModel):
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
    created_at: datetime
    updated_at: datetime


class ClockInRequest(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None
    method: str = "Manual"


class ClockOutRequest(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None


class BiometricDeviceCreate(BaseModel):
    device_code: str = Field(min_length=1, max_length=50)
    location: str = Field(min_length=1, max_length=150)
    model: str = Field(min_length=1, max_length=100)
    enrolled_employees: int = 0
    status: str = "Online"


class BiometricDeviceUpdate(BaseModel):
    location: str | None = None
    model: str | None = None
    enrolled_employees: int | None = None
    status: str | None = None


class BiometricDeviceResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    device_code: str
    location: str
    model: str
    enrolled_employees: int
    last_sync: datetime | None
    status: str
    created_at: datetime
    updated_at: datetime


class FaceRecognitionLogCreate(BaseModel):
    employee_id: uuid.UUID | None = None
    confidence: float
    location: str
    action: str = "Check-In"
    status: str = "Verified"


class FaceRecognitionLogResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID | None
    employee_name: str | None = None
    timestamp: datetime
    confidence: float
    location: str
    action: str
    status: str
    created_at: datetime


class AttendanceCorrectionCreate(BaseModel):
    date: date
    original_status: str
    original_check_in: datetime | None = None
    original_check_out: datetime | None = None
    corrected_status: str
    corrected_check_in: datetime | None = None
    corrected_check_out: datetime | None = None
    reason: str


class AttendanceCorrectionResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    date: date
    original_status: str
    original_check_in: datetime | None
    original_check_out: datetime | None
    corrected_status: str
    corrected_check_in: datetime | None
    corrected_check_out: datetime | None
    reason: str
    status: str
    reviewed_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class CorrectionReviewRequest(BaseModel):
    status: str  # Approved|Rejected


class HrmsDashboardStats(BaseModel):
    total_employees: int
    active_employees: int
    on_leave: int
    new_joinees: int
    avg_attendance: float
    attrition_rate: float
"""

with open(target, "r", encoding="utf-8") as f:
    content = f.read()

line_ending = "\r\n" if "\r\n" in content else "\n"
SCHEMAS_TO_APPEND_FILE = SCHEMAS_TO_APPEND.replace("\n", line_ending)

# Append at the end of file
with open(target, "a", encoding="utf-8", newline="") as f:
    f.write(SCHEMAS_TO_APPEND_FILE)

print("Appended HRMS schemas successfully")
