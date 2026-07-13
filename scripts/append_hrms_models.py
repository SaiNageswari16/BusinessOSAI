import os

target = os.path.join("backend", "src", "models", "__init__.py")

MODELS_TO_APPEND = """

# ─── HRMS — Employee & Attendance Models ───────────────────────────

class Employee(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "employees"
    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_code", name="uq_employees_tenant_code"),
        UniqueConstraint("tenant_id", "email", name="uq_employees_tenant_email"),
        UniqueConstraint("tenant_id", "user_id", name="uq_employees_tenant_user"),
    )

    employee_code: Mapped[str] = mapped_column(String(50), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    date_of_joining: Mapped[date] = mapped_column(Date, nullable=False)
    employment_type: Mapped[str] = mapped_column(String(50), default="Full-Time")  # Full-Time|Part-Time|Contract|Internship
    status: Mapped[str] = mapped_column(String(30), default="Active")  # Active|On Leave|Inactive
    basic_salary: Mapped[float | None] = mapped_column(Numeric(12, 2))
    
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"))
    branch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="SET NULL"))
    department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"))
    designation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("designations.id", ondelete="SET NULL"))
    manager_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    company: Mapped["Company | None"] = relationship()
    branch: Mapped["Branch | None"] = relationship()
    department: Mapped["Department | None"] = relationship()
    designation: Mapped["Designation | None"] = relationship()
    user: Mapped["User | None"] = relationship()


class EmployeeDocument(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "employee_documents"

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    document_name: Mapped[str] = mapped_column(String(200), nullable=False)
    document_type: Mapped[str] = mapped_column(String(100), nullable=False)  # Contract|ID Proof|NDA|compliance
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    upload_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    expiry_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(30), default="Valid")  # Valid|Expired

    employee: Mapped["Employee"] = relationship()


class AttendanceRecord(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_id", "date", name="uq_attendance_employee_date"),
    )

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    check_in: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    check_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    hours_worked: Mapped[float | None] = mapped_column(Numeric(5, 2))
    status: Mapped[str] = mapped_column(String(30), default="Present")  # Present|Absent|Late|Half Day|On Leave
    method: Mapped[str] = mapped_column(String(30), default="Biometric")  # Biometric|GPS|Face|Manual
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    notes: Mapped[str | None] = mapped_column(Text)

    employee: Mapped["Employee"] = relationship()


class BiometricDevice(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "biometric_devices"
    __table_args__ = (
        UniqueConstraint("tenant_id", "device_code", name="uq_biometric_device_code"),
    )

    device_code: Mapped[str] = mapped_column(String(50), nullable=False)
    location: Mapped[str] = mapped_column(String(150), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    enrolled_employees: Mapped[int] = mapped_column(Integer, default=0)
    last_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="Online")  # Online|Offline


class FaceRecognitionLog(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "face_recognition_logs"

    employee_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    confidence: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    location: Mapped[str] = mapped_column(String(150), nullable=False)
    action: Mapped[str] = mapped_column(String(30), default="Check-In")  # Check-In|Check-Out
    status: Mapped[str] = mapped_column(String(20), default="Verified")  # Verified|Failed

    employee: Mapped["Employee | None"] = relationship()


class AttendanceCorrection(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "attendance_corrections"

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    original_status: Mapped[str] = mapped_column(String(30), nullable=False)
    original_check_in: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    original_check_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    corrected_status: Mapped[str] = mapped_column(String(30), nullable=False)
    corrected_check_in: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    corrected_check_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="Pending")  # Pending|Approved|Rejected
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    employee: Mapped["Employee"] = relationship()
    reviewer: Mapped["User | None"] = relationship()
"""

with open(target, "r", encoding="utf-8") as f:
    content = f.read()

line_ending = "\r\n" if "\r\n" in content else "\n"
MODELS_TO_APPEND_FILE = MODELS_TO_APPEND.replace("\n", line_ending)

# Append at the end of file
with open(target, "a", encoding="utf-8", newline="") as f:
    f.write(MODELS_TO_APPEND_FILE)

print("Appended HRMS models successfully")
