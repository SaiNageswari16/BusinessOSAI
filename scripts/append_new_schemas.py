import os

target = os.path.join("backend", "src", "schemas", "erp.py")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

schemas_block = """
# ─── HRMS — Leaves & Payroll Schemas ───────────────────────────────────

class LeaveRequestCreate(BaseModel):
    leave_type: str  # Annual|Sick|Casual|Maternity|Unpaid
    start_date: date
    end_date: date
    days: int
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
    start_date: date
    end_date: date
    days: int
    reason: str | None
    status: str
    reviewed_by: uuid.UUID | None
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
    da: float = 0.0
    lta: float = 0.0
    other_allowances: float = 0.0
    pf: float = 0.0
    tds: float = 0.0
    professional_tax: float = 0.0


class SalaryStructureResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    designation: str | None = None
    department: str | None = None
    basic_salary: float
    hra: float
    da: float
    lta: float
    other_allowances: float
    pf: float
    tds: float
    professional_tax: float
    net_salary: float
    created_at: datetime
    updated_at: datetime


class PayslipCreate(BaseModel):
    employee_id: uuid.UUID
    pay_period: str
    status: str = "Processing"


class PayslipResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str | None = None
    employee_code: str | None = None
    pay_period: str
    basic_salary: float
    allowances: float
    deductions: float
    net_salary: float
    status: str
    pdf_url: str | None
    created_at: datetime
    updated_at: datetime
"""

line_ending = "\r\n" if "\r\n" in content else "\n"
schemas_block_file = schemas_block.replace("\n", line_ending)

with open(target, "a", encoding="utf-8", newline="") as f:
    f.write(schemas_block_file)

print("Appended Leave and Payroll Pydantic schemas successfully")
