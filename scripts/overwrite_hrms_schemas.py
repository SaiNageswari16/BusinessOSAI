import os

target = os.path.join("backend", "src", "schemas", "erp.py")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

# Let's clean the previously appended schema section to keep it clean and replace it with matching fields
schemas_cutoff = content.find("# ─── HRMS — Leaves & Payroll Schemas ───────────────────────────────────")
if schemas_cutoff != -1:
    content = content[:schemas_cutoff]

schemas_block = """# ─── HRMS — Leaves & Payroll Schemas ───────────────────────────────────

class LeaveRequestCreate(BaseModel):
    leave_type: str  # Annual|Sick|Casual|Maternity|Unpaid
    from_date: date
    to_date: date
    days_requested: int
    reason: str | None = None


class LeaveRequestUpdate(BaseModel):
    status: str  # Approved|Rejected


class LeaveRequestResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    department: str | None = None
    leave_type: str
    from_date: date
    to_date: date
    days_requested: int
    reason: str | None
    status: str
    approved_by: uuid.UUID | None = None
    approved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class LeaveBalanceResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    leave_type: str
    total_days: int
    used_days: int
    balance: int


class SalaryStructureCreate(BaseModel):
    employee_id: uuid.UUID
    basic_salary: float
    hra: float = 0.0
    other_allowances: float = 0.0
    pf_deduction: float = 0.0
    esi_deduction: float = 0.0
    tds_deduction: float = 0.0
    other_deductions: float = 0.0


class SalaryStructureResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    designation: str | None = None
    department: str | None = None
    basic_salary: float
    hra: float
    other_allowances: float
    pf_deduction: float
    esi_deduction: float
    tds_deduction: float
    other_deductions: float
    net_salary: float
    created_at: datetime
    updated_at: datetime


class PayslipCreate(BaseModel):
    employee_id: uuid.UUID
    month: int
    year: int
    status: str = "Processing"


class PayslipResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    employee_code: str | None = None
    month: int
    year: int
    basic_salary: float
    hra: float
    other_allowances: float
    pf_deduction: float
    esi_deduction: float
    tds_deduction: float
    other_deductions: float
    gross_salary: float
    net_salary: float
    status: str
    pdf_url: str | None
    created_at: datetime
    updated_at: datetime
"""

line_ending = "\r\n" if "\r\n" in content else "\n"
content = content + schemas_block.replace("\n", line_ending)

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Updated Pydantic schemas successfully")
