import os

# 1. Append LeavePolicy and PayGrade models to backend/src/models/__init__.py
model_file = os.path.join("backend", "src", "models", "__init__.py")
with open(model_file, "r", encoding="utf-8") as f:
    model_content = f.read()

models_block = """
class LeavePolicy(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "leave_policies"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    leave_type: Mapped[str] = mapped_column(String(50), nullable=False)  # Annual|Sick|Casual|Maternity|Unpaid
    entitled_days: Mapped[int] = mapped_column(Integer, nullable=False)
    applicable_to: Mapped[str] = mapped_column(String(100), default="All")  # All | Department Name | Designation Name

class PayGrade(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "pay_grades"
    __table_args__ = (
        UniqueConstraint("tenant_id", "designation_id", name="uq_pay_grade_designation"),
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    designation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("designations.id", ondelete="CASCADE"), nullable=False)
    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    hra: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    other_allowances: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    pf_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    esi_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    tds_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)

    designation: Mapped["Designation"] = relationship()
"""

line_ending = "\r\n" if "\r\n" in model_content else "\n"
if "class LeavePolicy(" not in model_content:
    with open(model_file, "a", encoding="utf-8", newline="") as f:
        f.write(models_block.replace("\n", line_ending))


# 2. Append Pydantic schemas to backend/src/schemas/erp.py
schema_file = os.path.join("backend", "src", "schemas", "erp.py")
with open(schema_file, "r", encoding="utf-8") as f:
    schema_content = f.read()

schemas_block = """
class LeavePolicyCreate(BaseModel):
    name: str
    leave_type: str
    entitled_days: int
    applicable_to: str = "All"

class LeavePolicyResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    leave_type: str
    entitled_days: int
    applicable_to: str
    created_at: datetime
    updated_at: datetime

class PayGradeCreate(BaseModel):
    name: str
    designation_id: uuid.UUID
    basic_salary: float
    hra: float = 0.0
    other_allowances: float = 0.0
    pf_deduction: float = 0.0
    esi_deduction: float = 0.0
    tds_deduction: float = 0.0

class PayGradeResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    designation_id: uuid.UUID
    designation_name: str | None = None
    basic_salary: float
    hra: float
    other_allowances: float
    pf_deduction: float
    esi_deduction: float
    tds_deduction: float
    created_at: datetime
    updated_at: datetime
"""

if "class LeavePolicyCreate(" not in schema_content:
    with open(schema_file, "a", encoding="utf-8", newline="") as f:
        f.write(schemas_block.replace("\n", line_ending))


# 3. Add database tables leave_policies and pay_grades inside PostgreSQL
db_script = os.path.join("scripts", "update_db_schema_leaves_payroll.py")
with open(db_script, "r", encoding="utf-8") as f:
    db_script_content = f.read()

table_policies_sql = """    \"\"\"CREATE TABLE IF NOT EXISTS leave_policies (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        name VARCHAR(100) NOT NULL,
        leave_type VARCHAR(50) NOT NULL,
        entitled_days INTEGER NOT NULL,
        applicable_to VARCHAR(100) DEFAULT 'All',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );\"\"\",

    \"\"\"CREATE TABLE IF NOT EXISTS pay_grades (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        name VARCHAR(100) NOT NULL,
        designation_id UUID NOT NULL REFERENCES designations(id) ON DELETE CASCADE UNIQUE,
        basic_salary NUMERIC(12, 2) NOT NULL,
        hra NUMERIC(12, 2) DEFAULT 0,
        other_allowances NUMERIC(12, 2) DEFAULT 0,
        pf_deduction NUMERIC(12, 2) DEFAULT 0,
        esi_deduction NUMERIC(12, 2) DEFAULT 0,
        tds_deduction NUMERIC(12, 2) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );\"\"\","""

if "CREATE TABLE IF NOT EXISTS leave_policies" not in db_script_content:
    target_marker = "queries = ["
    db_script_content = db_script_content.replace(target_marker, f"{target_marker}\n{table_policies_sql}")
    with open(db_script, "w", encoding="utf-8", newline="\n") as f:
        f.write(db_script_content)

print("Appended LeavePolicy and PayGrade structures to backend and DB script successfully")
