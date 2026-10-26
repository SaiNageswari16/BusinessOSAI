"""Staff service schemas — Complete HRMS Data Transfer Objects."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from src.services.shared.base import PaginatedResponse
from src.services.staff.models import (
    AttendanceStatus,
    EmployeeRoleType,
    EmployeeStatus,
    EmploymentType,
    RosterStatus,
    ShiftType,
    TipDistributionStatus,
)


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Organization & Hierarchy Schemas ───────────────────────────────────────

class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    code: str = Field(min_length=1, max_length=50)
    outlet_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None
    head_user_id: uuid.UUID | None = None
    status: str = "active"


class DepartmentUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    outlet_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None
    head_user_id: uuid.UUID | None = None
    status: str | None = None


class DepartmentResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    parent_id: uuid.UUID | None
    name: str
    code: str
    head_user_id: uuid.UUID | None
    status: str
    created_at: datetime
    updated_at: datetime


class DesignationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    code: str = Field(min_length=1, max_length=50)
    department_id: uuid.UUID | None = None
    level: int = 1
    status: str = "active"


class DesignationUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    department_id: uuid.UUID | None = None
    level: int | None = None
    status: str | None = None


class DesignationResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    department_id: uuid.UUID | None
    name: str
    code: str
    level: int
    status: str
    created_at: datetime
    updated_at: datetime


class TeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    code: str = Field(min_length=1, max_length=50)
    department_id: uuid.UUID | None = None
    leader_id: uuid.UUID | None = None
    status: str = "active"


class TeamUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    department_id: uuid.UUID | None = None
    leader_id: uuid.UUID | None = None
    status: str | None = None


class TeamResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    department_id: uuid.UUID | None
    name: str
    code: str
    leader_id: uuid.UUID | None
    status: str
    created_at: datetime
    updated_at: datetime


class WorkCalendarCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    code: str = Field(min_length=1, max_length=50)
    year: int = 2026
    standard_hours_per_day: float = 8.0
    weekly_off_days: list[int] = Field(default_factory=list)
    holidays: list[dict] = Field(default_factory=list)
    is_default: bool = False
    status: str = "active"


class WorkCalendarUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    year: int | None = None
    standard_hours_per_day: float | None = None
    weekly_off_days: list[int] | None = None
    holidays: list[dict] | None = None
    is_default: bool | None = None
    status: str | None = None


class WorkCalendarResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    code: str
    year: int
    standard_hours_per_day: float
    weekly_off_days: list
    holidays: list
    is_default: bool
    status: str
    created_at: datetime
    updated_at: datetime


# ─── Employee Master Schemas ───────────────────────────────────────────────

class EmployeeCreate(BaseModel):
    employee_code: str = Field(min_length=1, max_length=50)
    name: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    date_of_birth: date | None = None
    date_of_joining: date = Field(default_factory=date.today)
    employment_type: str = "Permanent"
    status: str = "Active"

    role_type: EmployeeRoleType | None = None
    role: EmployeeRoleType | None = None
    user_id: uuid.UUID | None = None
    outlet_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None
    designation_id: uuid.UUID | None = None
    manager_id: uuid.UUID | None = None
    work_calendar_id: uuid.UUID | None = None

    base_salary: float = 0.0
    basic_salary: float | None = None
    hourly_rate: float | None = None
    sales_points: float = 0.0

    bank_name: str | None = None
    bank_account: str | None = None
    ifsc_code: str | None = None
    pan_number: str | None = None
    aadhar_number: str | None = None
    uan_number: str | None = None
    pf_number: str | None = None
    esi_number: str | None = None

    punch_method: str = "GPS"
    biometric_pin: str | None = None
    nfc_card_number: str | None = None
    face_photo: str | None = None
    face_photo_url: str | None = None
    face_descriptor: str | None = None

    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    emergency_contact_relation: str | None = None
    custom_attributes: dict = Field(default_factory=dict)

    @model_validator(mode="after")
    def _normalize(self) -> "EmployeeCreate":
        if not self.name:
            if self.full_name:
                self.name = self.full_name
            elif self.first_name or self.last_name:
                self.name = f"{self.first_name or ''} {self.last_name or ''}".strip()
            else:
                self.name = self.employee_code
        if not self.full_name:
            self.full_name = self.name
        if self.basic_salary is not None and self.base_salary == 0.0:
            self.base_salary = float(self.basic_salary)
        if self.branch_id and not self.outlet_id:
            self.outlet_id = self.branch_id
        if self.role_type is None and self.role is not None:
            self.role_type = self.role
        elif self.role_type is None:
            self.role_type = EmployeeRoleType.WAITER
        return self


class EmployeeUpdate(BaseModel):
    employee_code: str | None = None
    name: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    date_of_birth: date | None = None
    date_of_joining: date | None = None
    date_of_termination: date | None = None
    employment_type: str | None = None
    status: str | None = None
    role_type: EmployeeRoleType | None = None
    department_id: uuid.UUID | None = None
    designation_id: uuid.UUID | None = None
    manager_id: uuid.UUID | None = None
    work_calendar_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    outlet_id: uuid.UUID | None = None
    base_salary: float | None = None
    basic_salary: float | None = None
    hourly_rate: float | None = None
    sales_points: float | None = None
    bank_name: str | None = None
    bank_account: str | None = None
    ifsc_code: str | None = None
    pan_number: str | None = None
    aadhar_number: str | None = None
    uan_number: str | None = None
    pf_number: str | None = None
    esi_number: str | None = None
    punch_method: str | None = None
    biometric_pin: str | None = None
    nfc_card_number: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    emergency_contact_relation: str | None = None
    custom_attributes: dict | None = None


class EmployeeResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    user_id: uuid.UUID | None
    employee_code: str
    name: str
    full_name: str | None = None
    email: str | None
    phone: str | None
    department_id: uuid.UUID | None = None
    designation_id: uuid.UUID | None = None
    manager_id: uuid.UUID | None = None
    work_calendar_id: uuid.UUID | None = None
    role_type: str | None = None
    # The enrich step sets a display role name (designation or role_type).
    role_name: str | None = None
    department_name: str | None = None
    designation_name: str | None = None
    employment_type: str
    status: str
    date_of_birth: date | None = None
    date_of_joining: date
    date_of_termination: date | None = None
    base_salary: float = 0.0
    basic_salary: float | None = None
    hourly_rate: float | None = None
    sales_points: float = 0.0
    punch_method: str = "GPS"
    biometric_pin: str | None = None
    nfc_card_number: str | None = None
    bank_name: str | None = None
    bank_account: str | None = None
    ifsc_code: str | None = None
    pan_number: str | None = None
    aadhar_number: str | None = None
    uan_number: str | None = None
    pf_number: str | None = None
    esi_number: str | None = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="after")
    def _sync(self) -> "EmployeeResponse":
        if not self.full_name:
            self.full_name = self.name
        if self.basic_salary is None:
            self.basic_salary = self.base_salary
        return self


class EmployeeBulkCreate(BaseModel):
    employees: list[EmployeeCreate]


class EmployeeDocumentCreate(BaseModel):
    document_name: str = Field(min_length=1, max_length=200)
    document_type: str = Field(min_length=1, max_length=100)
    file_path: str = Field(min_length=1, max_length=500)
    expiry_date: date | None = None
    status: str = "Valid"


class EmployeeDocumentUpdate(BaseModel):
    document_name: str | None = None
    document_type: str | None = None
    file_path: str | None = None
    expiry_date: date | None = None
    status: str | None = None


class EmployeeDocumentResponse(OrmModel):
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


# ─── Attendance & Real-Time Tracking ────────────────────────────────────────

class AttendanceRecordCreate(BaseModel):
    employee_id: uuid.UUID
    date: date
    check_in: datetime | None = None
    check_out: datetime | None = None
    hours_worked: float | None = None
    regular_hours: float = 0.0
    overtime_hours: float = 0.0
    overtime_rate: float = 0.0
    overtime_amount: float = 0.0
    status: str = "Present"
    method: str = "Biometric"
    latitude: float | None = None
    longitude: float | None = None
    location_name: str | None = None
    is_weekoff: bool = False
    is_holiday: bool = False
    notes: str | None = None


class AttendanceRecordUpdate(BaseModel):
    check_in: datetime | None = None
    check_out: datetime | None = None
    hours_worked: float | None = None
    regular_hours: float | None = None
    overtime_hours: float | None = None
    overtime_rate: float | None = None
    overtime_amount: float | None = None
    status: str | None = None
    method: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    location_name: str | None = None
    is_weekoff: bool | None = None
    is_holiday: bool | None = None
    notes: str | None = None


class AttendanceRecordResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    employee_code: str | None = None
    date: date
    check_in: datetime | None
    check_out: datetime | None
    hours_worked: float | None
    regular_hours: float = 0.0
    overtime_hours: float = 0.0
    overtime_rate: float = 0.0
    overtime_amount: float = 0.0
    status: str
    method: str
    latitude: float | None
    longitude: float | None
    location_name: str | None = None
    is_weekoff: bool = False
    is_holiday: bool = False
    notes: str | None
    created_at: datetime
    updated_at: datetime


class AttendanceClockInRequest(BaseModel):
    employee_id: uuid.UUID
    outlet_id: uuid.UUID | None = None
    shift_id: uuid.UUID | None = None
    notes: str | None = None


class ClockIn(BaseModel):
    employee_id: uuid.UUID
    shift_id: uuid.UUID | None = None
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None
    method: str = "Manual"


class ClockOut(BaseModel):
    employee_id: uuid.UUID
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None


class AttendanceResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    employee_id: uuid.UUID
    date: date
    check_in: datetime | None
    check_out: datetime | None
    status: str


class AttendanceSchemeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    code: str = Field(min_length=1, max_length=50)
    shift_start_time: str = "09:00"
    shift_end_time: str = "18:00"
    grace_period_minutes: int = 15
    half_day_hours: float = 4.5
    full_day_hours: float = 8.0
    break_duration_minutes: int = 60
    is_overtime_allowed: bool = True
    overtime_multiplier: float = 1.5
    is_default: bool = False
    status: str = "active"


class AttendanceSchemeUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    shift_start_time: str | None = None
    shift_end_time: str | None = None
    grace_period_minutes: int | None = None
    half_day_hours: float | None = None
    full_day_hours: float | None = None
    break_duration_minutes: int | None = None
    is_overtime_allowed: bool | None = None
    overtime_multiplier: float | None = None
    is_default: bool | None = None
    status: str | None = None


class AttendanceSchemeResponse(OrmModel):
    """Fields exactly match what list/create attendance-scheme endpoints build
    — the monolith-compat geofence + punch-method + assignment-enrichment
    fields, not the older minimal column set."""
    id: uuid.UUID
    tenant_id: uuid.UUID | None = None
    company_id: uuid.UUID | None = None
    name: str
    code: str
    description: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    geofence_radius_meters: int | None = None
    enforce_geofence: bool | None = None
    allowed_punch_methods: list = []
    shift_start_time: str
    shift_end_time: str
    grace_period_minutes: int
    half_day_hours: float
    full_day_hours: float
    break_duration_minutes: int | None = None
    is_overtime_allowed: bool | None = None
    overtime_allowed: bool | None = None
    overtime_multiplier: float | None = None
    overtime_min_minutes: int | None = None
    working_days: list = []
    ip_whitelist: str | None = None
    is_default: bool
    status: str
    assigned_employees_count: int = 0
    assigned_employee_ids: list = []
    created_at: datetime | None = None
    updated_at: datetime | None = None


class EmployeeLocationTrailCreate(BaseModel):
    employee_id: uuid.UUID
    attendance_id: uuid.UUID | None = None
    latitude: float
    longitude: float
    accuracy: float | None = None
    speed: float | None = None
    heading: float | None = None
    altitude: float | None = None
    activity_type: str = "traveling"
    location_name: str | None = None
    battery_level: int | None = None
    is_mock: bool = False
    recorded_at: datetime = Field(default_factory=datetime.utcnow)


class EmployeeLocationTrailResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    attendance_id: uuid.UUID | None
    latitude: float
    longitude: float
    accuracy: float | None
    speed: float | None
    heading: float | None
    altitude: float | None
    activity_type: str
    location_name: str | None
    battery_level: int | None
    is_mock: bool
    recorded_at: datetime


class BiometricDeviceCreate(BaseModel):
    device_code: str = Field(min_length=1, max_length=50)
    location: str = Field(min_length=1, max_length=150)
    model: str = Field(min_length=1, max_length=100)
    ip_address: str | None = None
    port: int = 4370
    enrolled_employees: int = 0
    status: str = "Online"


class BiometricDeviceUpdate(BaseModel):
    location: str | None = None
    model: str | None = None
    ip_address: str | None = None
    port: int | None = None
    enrolled_employees: int | None = None
    status: str | None = None


class BiometricDeviceResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    device_code: str
    location: str
    model: str
    ip_address: str | None
    port: int
    enrolled_employees: int
    last_sync: datetime | None
    status: str
    created_at: datetime
    updated_at: datetime


class FaceRecognitionLogCreate(BaseModel):
    employee_id: uuid.UUID | None = None
    confidence: float = 95.0
    location: str
    action: str = "Check-In"
    status: str = "Verified"


class FaceRecognitionLogResponse(OrmModel):
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
    employee_id: uuid.UUID | None = None
    date: date
    original_status: str
    original_check_in: datetime | None = None
    original_check_out: datetime | None = None
    corrected_status: str
    corrected_check_in: datetime | None = None
    corrected_check_out: datetime | None = None
    reason: str


class AttendanceCorrectionResponse(OrmModel):
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


# ─── Leave Schemas ──────────────────────────────────────────────────────────

class LeavePolicyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    code: str | None = None
    leave_type: str = "Casual"
    entitled_days: int = 12
    carry_forward_days: int = 0
    applicable_to: str = "All"
    is_encashable: bool = False
    status: str = "active"

    @model_validator(mode="after")
    def _code(self) -> "LeavePolicyCreate":
        if not self.code:
            self.code = self.name.upper().replace(" ", "_")[:30]
        return self


class LeavePolicyUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    leave_type: str | None = None
    entitled_days: int | None = None
    carry_forward_days: int | None = None
    applicable_to: str | None = None
    is_encashable: bool | None = None
    status: str | None = None


class LeavePolicyResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    code: str
    leave_type: str
    entitled_days: int
    carry_forward_days: int
    applicable_to: str
    is_encashable: bool
    status: str
    created_at: datetime
    updated_at: datetime


class LeaveRequestCreate(BaseModel):
    employee_id: uuid.UUID | None = None
    leave_type: str = "Casual"
    from_date: date
    to_date: date
    days: float = 1.0
    reason: str


class LeaveRequestUpdate(BaseModel):
    status: str  # Approved|Rejected|Cancelled
    rejection_reason: str | None = None


class LeaveRequestResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    leave_type: str
    from_date: date
    to_date: date
    days: float
    reason: str
    status: str
    approved_by: uuid.UUID | None
    rejection_reason: str | None
    created_at: datetime
    updated_at: datetime


class LeaveBalanceCreate(BaseModel):
    employee_id: uuid.UUID
    leave_type: str
    year: int = 2026
    entitled: float = 12.0
    used: float = 0.0
    pending: float = 0.0
    balance: float = 12.0


class LeaveBalanceUpdate(BaseModel):
    entitled: float | None = None
    used: float | None = None
    pending: float | None = None
    balance: float | None = None


class LeaveBalanceResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    leave_type: str
    year: int
    entitled: float
    used: float
    pending: float
    balance: float
    created_at: datetime
    updated_at: datetime


# ─── Payroll Schemas ────────────────────────────────────────────────────────

class PayGradeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    min_salary: float = Field(ge=0)
    max_salary: float = Field(ge=0)
    currency: str = "INR"
    description: str | None = None
    status: str = "active"


class PayGradeUpdate(BaseModel):
    name: str | None = None
    min_salary: float | None = None
    max_salary: float | None = None
    currency: str | None = None
    description: str | None = None
    status: str | None = None


class PayGradeResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    min_salary: float
    max_salary: float
    currency: str
    description: str | None
    status: str
    created_at: datetime
    updated_at: datetime


class SalaryStructureCreate(BaseModel):
    employee_id: uuid.UUID
    ctc_annual: float = 0.0
    basic_monthly: float = 0.0
    hra_monthly: float = 0.0
    da_monthly: float = 0.0
    conveyance_monthly: float = 0.0
    special_allowance_monthly: float = 0.0
    gross_monthly: float = 0.0
    pf_employee_monthly: float = 0.0
    pf_employer_monthly: float = 0.0
    esi_employee_monthly: float = 0.0
    esi_employer_monthly: float = 0.0
    professional_tax_monthly: float = 0.0
    tds_monthly: float = 0.0
    total_deductions_monthly: float = 0.0
    net_monthly: float = 0.0
    effective_from: date = Field(default_factory=date.today)
    components_breakdown: dict = Field(default_factory=dict)


class SalaryStructureUpdate(BaseModel):
    ctc_annual: float | None = None
    basic_monthly: float | None = None
    hra_monthly: float | None = None
    da_monthly: float | None = None
    conveyance_monthly: float | None = None
    special_allowance_monthly: float | None = None
    gross_monthly: float | None = None
    pf_employee_monthly: float | None = None
    pf_employer_monthly: float | None = None
    esi_employee_monthly: float | None = None
    esi_employer_monthly: float | None = None
    professional_tax_monthly: float | None = None
    tds_monthly: float | None = None
    total_deductions_monthly: float | None = None
    net_monthly: float | None = None
    effective_from: date | None = None
    components_breakdown: dict | None = None


class SalaryStructureResponse(OrmModel):
    """Matches what the salary-structures endpoints build AND the frontend
    ``SalaryStructure`` type: the monolith per-employee components
    (basic/hra/other + pf/esi/tds deductions), enriched with the employee's
    display name + designation + department. The split's *_monthly column
    set is kept optional so the old shape still serializes if present."""
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    designation: str | None = None
    department: str | None = None
    basic_salary: float = 0.0
    hra: float = 0.0
    other_allowances: float = 0.0
    pf_deduction: float = 0.0
    esi_deduction: float = 0.0
    tds_deduction: float = 0.0
    other_deductions: float = 0.0
    net_salary: float | None = None
    # Legacy split column shape (optional — set only when present on the row).
    ctc_annual: float | None = None
    basic_monthly: float | None = None
    hra_monthly: float | None = None
    da_monthly: float | None = None
    conveyance_monthly: float | None = None
    special_allowance_monthly: float | None = None
    gross_monthly: float | None = None
    pf_employee_monthly: float | None = None
    pf_employer_monthly: float | None = None
    esi_employee_monthly: float | None = None
    esi_employer_monthly: float | None = None
    professional_tax_monthly: float | None = None
    tds_monthly: float | None = None
    total_deductions_monthly: float | None = None
    net_monthly: float | None = None
    effective_from: date | None = None
    components_breakdown: dict | None = None
    created_at: datetime
    updated_at: datetime


class PayslipTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    layout_schema: dict = Field(default_factory=dict)
    header_html: str | None = None
    footer_html: str | None = None
    is_default: bool = False
    is_active: bool = True


class PayslipTemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    layout_schema: dict | None = None
    header_html: str | None = None
    footer_html: str | None = None
    is_default: bool | None = None
    is_active: bool | None = None


class PayslipTemplateResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: str | None
    layout_schema: dict
    header_html: str | None
    footer_html: str | None
    is_default: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PayslipCreate(BaseModel):
    employee_id: uuid.UUID
    month: int
    year: int
    total_days_in_month: int = 30
    payable_days: float = 30.0
    loss_of_pay_days: float = 0.0
    overtime_hours: float = 0.0
    overtime_pay: float = 0.0
    basic_earned: float = 0.0
    hra_earned: float = 0.0
    da_earned: float = 0.0
    special_allowance_earned: float = 0.0
    bonuses_earned: float = 0.0
    commissions_earned: float = 0.0
    gross_earnings: float = 0.0
    pf_deduction: float = 0.0
    esi_deduction: float = 0.0
    professional_tax: float = 0.0
    tds_deduction: float = 0.0
    loan_deduction: float = 0.0
    advance_deduction: float = 0.0
    total_deductions: float = 0.0
    net_payable: float = 0.0
    payment_status: str = "Draft"
    paid_on: date | None = None


class PayslipUpdate(BaseModel):
    payment_status: str | None = None
    paid_on: date | None = None
    digital_signature: str | None = None


class PayslipResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    employee_code: str | None = None
    month: int
    year: int
    total_days_in_month: int
    payable_days: float
    loss_of_pay_days: float
    overtime_hours: float
    overtime_pay: float
    basic_earned: float
    hra_earned: float
    da_earned: float
    special_allowance_earned: float
    bonuses_earned: float
    commissions_earned: float
    gross_earnings: float
    pf_deduction: float
    esi_deduction: float
    professional_tax: float
    tds_deduction: float
    loan_deduction: float
    advance_deduction: float
    total_deductions: float
    net_payable: float
    payment_status: str
    paid_on: date | None
    pdf_url: str | None
    digital_signature: str | None
    created_at: datetime
    updated_at: datetime


class EmployeeLoanCreate(BaseModel):
    employee_id: uuid.UUID
    loan_amount: float
    interest_rate: float = 0.0
    total_repayable: float
    emi_monthly: float
    installments_total: int


class EmployeeLoanResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    loan_amount: float
    interest_rate: float
    total_repayable: float
    emi_monthly: float
    installments_total: int
    installments_paid: int
    outstanding_balance: float
    status: str
    created_at: datetime
    updated_at: datetime


class SalaryAdvanceCreate(BaseModel):
    employee_id: uuid.UUID
    amount: float
    recovery_month: int
    recovery_year: int
    reason: str


class SalaryAdvanceResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    amount: float
    recovery_month: int
    recovery_year: int
    reason: str
    status: str
    created_at: datetime
    updated_at: datetime


class EmployeeBonusCreate(BaseModel):
    employee_id: uuid.UUID
    bonus_name: str
    amount: float
    month: int
    year: int
    remarks: str | None = None


class EmployeeBonusResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    bonus_name: str
    amount: float
    month: int
    year: int
    remarks: str | None
    created_at: datetime
    updated_at: datetime


class SalesCommissionCreate(BaseModel):
    employee_id: uuid.UUID
    month: int
    year: int
    sales_total: float = 0.0
    commission_rate_pct: float = 0.0
    commission_earned: float = 0.0


class SalesCommissionResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    month: int
    year: int
    sales_total: float
    commission_rate_pct: float
    commission_earned: float
    is_settled: bool
    created_at: datetime
    updated_at: datetime


class CommissionSlabPlanCreate(BaseModel):
    plan_name: str
    slabs_json: list[dict] = Field(default_factory=list)
    status: str = "active"


class CommissionSlabPlanResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    plan_name: str
    slabs_json: list
    status: str
    created_at: datetime
    updated_at: datetime


# ─── Recruitment & ATS Schemas ──────────────────────────────────────────────

class JobOpeningCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    department_id: uuid.UUID | None = None
    designation_id: uuid.UUID | None = None
    positions_count: int = 1
    experience_required_years: float = 0.0
    min_salary: float | None = None
    max_salary: float | None = None
    job_description: str
    status: str = "Open"


class JobOpeningUpdate(BaseModel):
    title: str | None = None
    department_id: uuid.UUID | None = None
    designation_id: uuid.UUID | None = None
    positions_count: int | None = None
    experience_required_years: float | None = None
    min_salary: float | None = None
    max_salary: float | None = None
    job_description: str | None = None
    status: str | None = None


class JobOpeningResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    title: str
    department_id: uuid.UUID | None
    designation_id: uuid.UUID | None
    positions_count: int
    experience_required_years: float
    min_salary: float | None
    max_salary: float | None
    job_description: str
    status: str
    created_at: datetime
    updated_at: datetime


class ApplicantCreate(BaseModel):
    job_opening_id: uuid.UUID | None = None
    full_name: str = Field(min_length=1, max_length=200)
    email: str
    phone: str
    resume_path: str | None = None
    stage: str = "Applied"
    rating: float = 0.0
    current_ctc: float | None = None
    expected_ctc: float | None = None
    notice_period_days: int = 30
    notes: str | None = None


class ApplicantUpdate(BaseModel):
    job_opening_id: uuid.UUID | None = None
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    resume_path: str | None = None
    stage: str | None = None
    rating: float | None = None
    current_ctc: float | None = None
    expected_ctc: float | None = None
    notice_period_days: int | None = None
    notes: str | None = None


class ApplicantResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    job_opening_id: uuid.UUID | None
    full_name: str
    email: str
    phone: str
    resume_path: str | None
    stage: str
    rating: float
    current_ctc: float | None
    expected_ctc: float | None
    notice_period_days: int
    notes: str | None
    created_at: datetime
    updated_at: datetime


class InterviewCreate(BaseModel):
    """Monolith-compat payload: the interview dialog posts date/time strings
    (not a single timestamp) plus duration/type/mode. ``scheduled_at`` is
    optional — the handler fills it from date+time when it's omitted."""
    applicant_id: uuid.UUID
    interviewer_name: str = Field(min_length=1, max_length=150)
    round_name: str = "Technical Round 1"
    date: str | None = None
    time: str | None = None
    duration: int = 30
    type: str | None = None
    mode: str | None = None
    scheduled_at: datetime | None = None
    meeting_link: str | None = None
    feedback: str | None = None
    score: int | None = None
    status: str = "Scheduled"


class InterviewUpdate(BaseModel):
    interviewer_name: str | None = None
    round_name: str | None = None
    scheduled_at: datetime | None = None
    meeting_link: str | None = None
    feedback: str | None = None
    score: int | None = None
    status: str | None = None


class InterviewResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    applicant_id: uuid.UUID
    candidate: str | None = None
    job_title: str | None = None
    interviewer_name: str
    round_name: str
    scheduled_at: datetime | None = None
    date: str | None = None
    time: str | None = None
    duration: int = 30
    type: str | None = None
    mode: str | None = None
    meeting_link: str | None
    feedback: str | None
    score: int | None
    status: str
    created_at: datetime
    updated_at: datetime


class OfferLetterCreate(BaseModel):
    applicant_id: uuid.UUID | None = None
    candidate_name: str
    email: str
    designation: str
    department: str
    offered_ctc: float
    joining_date: date
    status: str = "Draft"
    pdf_url: str | None = None
    signature_token: str | None = None


class OfferLetterUpdate(BaseModel):
    candidate_name: str | None = None
    email: str | None = None
    designation: str | None = None
    department: str | None = None
    offered_ctc: float | None = None
    joining_date: date | None = None
    status: str | None = None
    pdf_url: str | None = None
    signature_token: str | None = None


class OfferLetterResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    applicant_id: uuid.UUID | None
    candidate_name: str
    email: str
    designation: str
    department: str
    offered_ctc: float
    joining_date: date
    status: str
    pdf_url: str | None
    signature_token: str | None
    created_at: datetime
    updated_at: datetime


class OnboardingTask(BaseModel):
    """One checklist task on a new-hire's onboarding record (frontend shape:
    {task, assignedTo, status})."""
    task: str
    assignedTo: str = ""
    status: str = "Pending"  # Pending | In Progress | Done


class OnboardingRecordCreate(BaseModel):
    """Monolith-compat create: track a new hire from applicant + a task
    checklist. `start_date` is the planned onboarding date; progress is
    derived from the tasks, not sent."""
    applicant_id: uuid.UUID
    start_date: date | None = None
    tasks: list[OnboardingTask] = []


class OnboardingRecordUpdate(BaseModel):
    tasks: list[OnboardingTask] | None = None
    status: str | None = None


class OnboardingRecordResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    applicant_id: uuid.UUID | None = None
    employee_id: uuid.UUID | None = None
    new_hire: str | None = None
    role: str | None = None
    start_date: date | None = None
    progress: int = 0
    tasks_json: list = []
    status: str = "Pending"
    created_at: datetime
    updated_at: datetime


OnboardingCreate = OnboardingRecordCreate
OnboardingUpdate = OnboardingRecordUpdate
OnboardingResponse = OnboardingRecordResponse



# ─── Performance & OKR Schemas ──────────────────────────────────────────────

class PerformanceGoalCreate(BaseModel):
    employee_id: uuid.UUID
    title: str
    description: str | None = None
    weightage_pct: float = 20.0
    target_value: str | None = None
    current_value: str | None = None
    progress_pct: float = 0.0
    due_date: date | None = None
    status: str = "In Progress"


class PerformanceGoalUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    weightage_pct: float | None = None
    target_value: str | None = None
    current_value: str | None = None
    progress_pct: float | None = None
    due_date: date | None = None
    status: str | None = None


class PerformanceGoalResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    title: str
    description: str | None
    weightage_pct: float
    target_value: str | None
    current_value: str | None
    progress_pct: float
    due_date: date | None
    status: str
    created_at: datetime
    updated_at: datetime


class PerformanceKpiCreate(BaseModel):
    employee_id: uuid.UUID
    kpi_name: str
    target: str
    achieved: str = "0"
    rating: float = 0.0


class PerformanceKpiUpdate(BaseModel):
    kpi_name: str | None = None
    target: str | None = None
    achieved: str | None = None
    rating: float | None = None


class PerformanceKpiResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    kpi_name: str
    target: str
    achieved: str
    rating: float
    created_at: datetime
    updated_at: datetime


class PerformanceAppraisalCreate(BaseModel):
    employee_id: uuid.UUID
    appraisal_cycle: str = "Q1-2026"
    self_score: float | None = None
    manager_score: float | None = None
    final_score: float | None = None
    manager_feedback: str | None = None
    status: str = "Draft"


class PerformanceAppraisalUpdate(BaseModel):
    self_score: float | None = None
    manager_score: float | None = None
    final_score: float | None = None
    manager_feedback: str | None = None
    status: str | None = None


class PerformanceAppraisalResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    appraisal_cycle: str
    self_score: float | None
    manager_score: float | None
    final_score: float | None
    manager_feedback: str | None
    status: str
    created_at: datetime
    updated_at: datetime


class PerformanceIncentiveCreate(BaseModel):
    employee_id: uuid.UUID
    amount: float
    period: str
    reason: str
    status: str = "Approved"


class PerformanceIncentiveResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    amount: float
    period: str
    reason: str
    status: str
    created_at: datetime
    updated_at: datetime


# ─── Learning Management (LMS) Schemas ──────────────────────────────────────

class LearningCourseCreate(BaseModel):
    title: str
    category: str = "General"
    duration_hours: float = 2.0
    instructor: str
    status: str = "Active"


class LearningCourseUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    duration_hours: float | None = None
    instructor: str | None = None
    status: str | None = None


class LearningCourseResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    title: str
    category: str
    duration_hours: float
    instructor: str
    enrolled_count: int
    rating: float
    status: str
    created_at: datetime
    updated_at: datetime


class LearningCertificateCreate(BaseModel):
    employee_id: uuid.UUID
    course_id: uuid.UUID
    certificate_code: str
    issue_date: date = Field(default_factory=date.today)
    expiry_date: date | None = None


class LearningCertificateResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    course_id: uuid.UUID
    certificate_code: str
    issue_date: date
    expiry_date: date | None
    created_at: datetime
    updated_at: datetime


class LearningAssessmentCreate(BaseModel):
    course_id: uuid.UUID
    employee_id: uuid.UUID
    score: float
    passed: bool = True


class LearningAssessmentResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    course_id: uuid.UUID
    employee_id: uuid.UUID
    score: float
    passed: bool
    attempted_at: datetime


# ─── Exit Management Schemas ────────────────────────────────────────────────

class ExitResignationCreate(BaseModel):
    employee_id: uuid.UUID | None = None
    employee_name: str | None = None
    department: str | None = None
    designation: str | None = None
    resign_date: date = Field(default_factory=date.today)
    last_working_day: date
    reason: str


class ExitResignationUpdate(BaseModel):
    last_working_day: date | None = None
    status: str | None = None  # Pending|Accepted|Rejected|Completed


class ExitResignationResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str
    department: str
    designation: str
    resign_date: date
    last_working_day: date
    reason: str
    status: str
    created_at: datetime
    updated_at: datetime


class ExitClearanceTaskCreate(BaseModel):
    employee_id: uuid.UUID
    employee_name: str
    department: str
    task: str
    status: str = "Pending"
    assigned_to: str


class ExitClearanceTaskUpdate(BaseModel):
    status: str | None = None
    assigned_to: str | None = None


class ExitClearanceTaskResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str
    department: str
    task: str
    status: str
    assigned_to: str
    created_at: datetime
    updated_at: datetime


class ExitFinalSettlementCreate(BaseModel):
    employee_id: uuid.UUID
    employee_name: str
    last_working_day: date
    components_json: list[dict] = Field(default_factory=list)
    net_payable: float = 0.0
    status: str = "Draft"


class ExitFinalSettlementUpdate(BaseModel):
    components_json: list[dict] | None = None
    net_payable: float | None = None
    status: str | None = None


class ExitFinalSettlementResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str
    last_working_day: date
    components_json: list
    net_payable: float
    status: str
    created_at: datetime
    updated_at: datetime


class ExitExperienceLetterCreate(BaseModel):
    employee_id: uuid.UUID
    employee_name: str
    designation: str
    from_date: date
    to_date: date
    issued_on: str = "-"
    status: str = "Pending"
    pdf_url: str | None = None


class ExitExperienceLetterUpdate(BaseModel):
    employee_name: str | None = None
    designation: str | None = None
    from_date: date | None = None
    to_date: date | None = None
    issued_on: str | None = None
    status: str | None = None
    pdf_url: str | None = None


class ExitExperienceLetterResponse(OrmModel):

    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str
    designation: str
    from_date: date
    to_date: date
    issued_on: str
    status: str
    pdf_url: str | None
    created_at: datetime
    updated_at: datetime


# ─── Legacy Staff & Tips Schemas (Preserved) ────────────────────────────────

class RosterCreate(BaseModel):
    employee_id: uuid.UUID
    shift_date: date
    shift_type: ShiftType = ShiftType.MORNING
    start_time: str | None = Field(default=None, max_length=10)
    end_time: str | None = Field(default=None, max_length=10)
    notes: str | None = None
    outlet_id: uuid.UUID | None = None


class RosterDecision(BaseModel):
    status: RosterStatus
    notes: str | None = None


class RosterResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    employee_id: uuid.UUID
    shift_date: date
    shift_type: ShiftType
    start_time: str | None
    end_time: str | None
    status: RosterStatus
    notes: str | None
    created_at: datetime


class TipRecord(BaseModel):
    amount: float = Field(gt=0)
    bill_id: uuid.UUID | None = None
    outlet_id: uuid.UUID | None = None


class TipResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    bill_id: uuid.UUID | None
    amount: float
    collected_at: datetime


class PoolProposal(BaseModel):
    period_start: date
    period_end: date
    outlet_id: uuid.UUID | None = None


class PoolDecision(BaseModel):
    decision: TipDistributionStatus = TipDistributionStatus.APPROVED


class TipPoolShareResponse(OrmModel):
    employee_id: uuid.UUID
    amount: float


class TipPoolResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    period_start: date
    period_end: date
    total_amount: float
    status: TipDistributionStatus
    shares: list[dict]
    created_at: datetime


class HrmsDashboardStats(BaseModel):
    total_employees: int
    active_employees: int
    on_leave: int
    new_joinees: int
    avg_attendance: float
    attrition_rate: float


class LocationPingPayload(BaseModel):
    latitude: float
    longitude: float
    accuracy: float | None = None
    speed: float | None = None  # km/h
    heading: float | None = None  # degrees 0-360
    altitude: float | None = None
    activity_type: str = "traveling"  # check_in | traveling | stop | client_visit | check_out
    location_name: str | None = None
    battery_level: int | None = None  # percentage 0-100
    is_mock: bool = False
    recorded_at: datetime | None = None
    attendance_id: uuid.UUID | None = None


class LocationPingBatchPayload(BaseModel):
    pings: list[LocationPingPayload] = []


class LocationTrailPoint(OrmModel):
    id: uuid.UUID
    latitude: float
    longitude: float
    accuracy: float | None = None
    speed: float | None = None
    heading: float | None = None
    altitude: float | None = None
    activity_type: str = "traveling"
    location_name: str | None = None
    battery_level: int | None = None
    is_mock: bool = False
    recorded_at: datetime


class RouteStopItem(BaseModel):
    latitude: float
    longitude: float
    location_name: str | None = None
    arrived_at: datetime
    departed_at: datetime
    duration_minutes: float


class EmployeeRouteHistoryResponse(BaseModel):
    employee_id: uuid.UUID
    employee_name: str
    employee_code: str | None = None
    department: str | None = None
    designation: str | None = None
    avatar_url: str | None = None
    phone: str | None = None
    date: str
    shift_status: str = "Present"
    check_in_time: datetime | None = None
    check_out_time: datetime | None = None
    check_in_location: str | None = None
    check_out_location: str | None = None
    total_distance_km: float = 0.0
    total_duration_hours: float = 0.0
    moving_time_hours: float = 0.0
    idle_time_hours: float = 0.0
    avg_speed_kmh: float = 0.0
    top_speed_kmh: float = 0.0
    points_count: int = 0
    # Device Power & Sudden Disconnect / Blackout Diagnostics
    last_ping_time: datetime | None = None
    last_known_location: str | None = None
    last_latitude: float | None = None
    last_longitude: float | None = None
    last_battery_level: int | None = None
    device_health_status: str = "Active"
    disconnect_reason: str | None = None
    minutes_since_last_ping: int | None = None
    is_device_offline: bool = False
    trail_points: list[LocationTrailPoint] = []
    stops: list[RouteStopItem] = []


class LiveFieldStaffItem(BaseModel):
    employee_id: uuid.UUID
    employee_name: str
    employee_code: str | None = None
    department: str | None = None
    designation: str | None = None
    avatar_url: str | None = None
    phone: str | None = None
    check_in_time: datetime | None = None
    current_latitude: float
    current_longitude: float
    current_location_name: str | None = None
    current_speed_kmh: float | None = None
    battery_level: int | None = None
    last_ping_time: datetime
    is_online: bool = True
    minutes_since_ping: int = 0
    device_health_status: str = "Active"
    disconnect_reason: str | None = None
    shift_distance_km: float = 0.0


class ClockInRequest(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None
    method: str = "Manual"
    employee_id: uuid.UUID | None = None


class ClockOutRequest(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None
    employee_id: uuid.UUID | None = None


class AttendanceSettingsSchema(BaseModel):
    branch_id: uuid.UUID | None = None
    branch_name: str | None = None
    latitude: float | None = 17.372998
    longitude: float | None = 78.521062
    geofence_radius_meters: int = 50
    enforce_geofence: bool = True
    allowed_punch_methods: list[str] = ["GPS", "Biometric", "Face", "Web"]
    shift_start_time: str = "09:00"
    shift_end_time: str = "18:00"
    grace_period_minutes: int = 15
    half_day_hours: float = 4.0
    ip_whitelist: str | None = ""
    assigned_employee_ids: list[uuid.UUID] = []


class AssignSchemeEmployeesRequest(BaseModel):
    scheme_id: uuid.UUID | None = None
    employee_ids: list[uuid.UUID] = []
    punch_method: str | None = None


class MultiSchemeAssignItem(BaseModel):
    employee_id: uuid.UUID
    is_primary: bool = True
    days_of_week: list[str] = []
    effective_from: date | None = None
    effective_to: date | None = None


class MultiSchemeAssignRequest(BaseModel):
    scheme_id: uuid.UUID | None = None
    assignments: list[MultiSchemeAssignItem] = []
    employee_assignments: list[MultiSchemeAssignItem] = []
    employee_ids: list[uuid.UUID] = []
    is_primary: bool = True
    days_of_week: list[str] = []
    punch_method: str | None = None


class EmployeeSchemeDetail(BaseModel):
    id: uuid.UUID
    scheme_id: uuid.UUID
    scheme_name: str
    scheme_code: str | None = None
    shift_start_time: str = "09:00"
    shift_end_time: str = "18:00"
    is_primary: bool = True
    days_of_week: list[str] = []
    effective_from: date | None = None
    effective_to: date | None = None


