import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Date, Text, ForeignKey, JSON
from src.database import Base

class Employee(Base):
    __tablename__ = "hrms_employees"
    __table_args__ = {'extend_existing': True}

    id = Column(String, primary_key=True, default=lambda: f"emp_{uuid.uuid4().hex[:8]}")
    code = Column(String, nullable=False, unique=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=True, default="")
    email = Column(String, nullable=False, index=True)
    phone = Column(String, nullable=True, default="")
    designation = Column(String, nullable=False)
    department = Column(String, nullable=False)
    reporting_manager = Column(String, nullable=True, default="")
    joined_date = Column(Date, default=date.today)
    employment_type = Column(String, default="Full-Time")
    status = Column(String, default="Active")
    salary = Column(Float, default=0.0)
    avatar = Column(String, nullable=True, default="")
    gym_branch = Column(String, nullable=True, default="")
    address = Column(String, nullable=True, default="")
    emergency_contact = Column(String, nullable=True, default="")
    skills = Column(JSON, nullable=True, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

class Department(Base):
    __tablename__ = "hrms_departments"
    __table_args__ = {'extend_existing': True}

    id = Column(String, primary_key=True, default=lambda: f"dept_{uuid.uuid4().hex[:8]}")
    name = Column(String, nullable=False, unique=True)
    code = Column(String, nullable=False)
    description = Column(String, nullable=True, default="")
    head_name = Column(String, nullable=True, default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Designation(Base):
    __tablename__ = "hrms_designations"
    __table_args__ = {'extend_existing': True}

    id = Column(String, primary_key=True, default=lambda: f"desg_{uuid.uuid4().hex[:8]}")
    title = Column(String, nullable=False)
    department = Column(String, nullable=False)
    level = Column(String, nullable=True, default="")
    description = Column(String, nullable=True, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

class Team(Base):
    __tablename__ = "hrms_teams"
    __table_args__ = {'extend_existing': True}

    id = Column(String, primary_key=True, default=lambda: f"team_{uuid.uuid4().hex[:8]}")
    name = Column(String, nullable=False)
    department = Column(String, nullable=False)
    lead_name = Column(String, nullable=True, default="")
    description = Column(String, nullable=True, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

class EmployeeDocument(Base):
    __tablename__ = "hrms_documents"
    __table_args__ = {'extend_existing': True}

    id = Column(String, primary_key=True, default=lambda: f"doc_{uuid.uuid4().hex[:8]}")
    employee_id = Column(String, ForeignKey("hrms_employees.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    doc_type = Column(String, nullable=True, default="")
    file_url = Column(String, nullable=True, default="")
    file_size = Column(String, nullable=True, default="")
    status = Column(String, default="Pending")
    uploaded_at = Column(DateTime, default=datetime.utcnow)

class EmployeeAttendance(Base):
    __tablename__ = "hrms_attendance"
    __table_args__ = {'extend_existing': True}

    id = Column(String, primary_key=True, default=lambda: f"att_{uuid.uuid4().hex[:8]}")
    employee_id = Column(String, ForeignKey("hrms_employees.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, default=date.today)
    check_in = Column(String, nullable=True)
    check_out = Column(String, nullable=True)
    status = Column(String, default="Present")
    work_hours = Column(Float, default=0.0)
    device_id = Column(String, nullable=True, default="")
    notes = Column(String, nullable=True, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

class LeaveRequest(Base):
    __tablename__ = "hrms_leaves"
    __table_args__ = {'extend_existing': True}

    id = Column(String, primary_key=True, default=lambda: f"leave_{uuid.uuid4().hex[:8]}")
    employee_id = Column(String, ForeignKey("hrms_employees.id", ondelete="CASCADE"), nullable=False)
    leave_type = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days = Column(Integer, default=1)
    reason = Column(Text, nullable=True, default="")
    status = Column(String, default="Pending")
    approved_by = Column(String, nullable=True, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

class PayrollRecord(Base):
    __tablename__ = "hrms_payroll"
    __table_args__ = {'extend_existing': True}

    id = Column(String, primary_key=True, default=lambda: f"pay_{uuid.uuid4().hex[:8]}")
    employee_id = Column(String, ForeignKey("hrms_employees.id", ondelete="CASCADE"), nullable=False)
    month = Column(String, nullable=False)
    year = Column(Integer, default=lambda: datetime.utcnow().year)
    base_salary = Column(Float, default=0.0)
    allowances = Column(Float, default=0.0)
    deductions = Column(Float, default=0.0)
    net_salary = Column(Float, default=0.0)
    status = Column(String, default="Pending")
    payment_method = Column(String, nullable=True, default="")
    payment_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class RecruitmentJob(Base):
    __tablename__ = "hrms_recruitment_jobs"
    __table_args__ = {'extend_existing': True}

    id = Column(String, primary_key=True, default=lambda: f"job_{uuid.uuid4().hex[:8]}")
    title = Column(String, nullable=False)
    department = Column(String, nullable=False)
    openings = Column(Integer, default=1)
    job_type = Column(String, nullable=True, default="")
    experience = Column(String, nullable=True, default="")
    salary_range = Column(String, nullable=True, default="")
    status = Column(String, default="Open")
    posted_date = Column(Date, default=date.today)
    created_at = Column(DateTime, default=datetime.utcnow)

class JobApplicant(Base):
    __tablename__ = "hrms_recruitment_applicants"
    __table_args__ = {'extend_existing': True}

    id = Column(String, primary_key=True, default=lambda: f"app_{uuid.uuid4().hex[:8]}")
    job_id = Column(String, ForeignKey("hrms_recruitment_jobs.id", ondelete="CASCADE"), nullable=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True, default="")
    stage = Column(String, default="Applied")
    experience_years = Column(Float, default=0.0)
    rating = Column(Float, default=0.0)
    resume_url = Column(String, nullable=True, default="")
    applied_date = Column(Date, default=date.today)
    created_at = Column(DateTime, default=datetime.utcnow)

class EmployeePerformance(Base):
    __tablename__ = "hrms_performance"
    __table_args__ = {'extend_existing': True}

    id = Column(String, primary_key=True, default=lambda: f"perf_{uuid.uuid4().hex[:8]}")
    employee_id = Column(String, ForeignKey("hrms_employees.id", ondelete="CASCADE"), nullable=False)
    review_period = Column(String, nullable=False)
    score = Column(Float, default=0.0)
    kpi_ratings = Column(JSON, default=list)
    feedback = Column(Text, nullable=True, default="")
    reviewer = Column(String, nullable=True, default="")
    status = Column(String, default="Draft")
    created_at = Column(DateTime, default=datetime.utcnow)

class ExitRequest(Base):
    __tablename__ = "hrms_exit_requests"
    __table_args__ = {'extend_existing': True}

    id = Column(String, primary_key=True, default=lambda: f"exit_{uuid.uuid4().hex[:8]}")
    employee_id = Column(String, ForeignKey("hrms_employees.id", ondelete="CASCADE"), nullable=False)
    resignation_date = Column(Date, default=date.today)
    last_working_day = Column(Date, nullable=False)
    reason = Column(Text, nullable=True, default="")
    handover_status = Column(String, default="Pending")
    settlement_status = Column(String, default="Pending")
    status = Column(String, default="Submitted")
    created_at = Column(DateTime, default=datetime.utcnow)

class GeofenceScheme(Base):
    __tablename__ = "hrms_geofence_schemes"
    __table_args__ = {'extend_existing': True}

    id = Column(String, primary_key=True, default=lambda: f"scheme_{uuid.uuid4().hex[:8]}")
    name = Column(String, nullable=False, unique=True)
    branch_name = Column(String, nullable=True)
    gym_name = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    radius_meters = Column(Integer, nullable=True)
    strict_restriction = Column(Boolean, default=False)
    ip_whitelist = Column(String, nullable=True, default="")
    shift_start_time = Column(String, nullable=True)
    shift_end_time = Column(String, nullable=True)
    grace_period_mins = Column(Integer, default=0)
    min_half_day_hours = Column(Float, nullable=True)
    allowed_channels = Column(JSON, default=list)
    assigned_employee_ids = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


