import os

target = os.path.join("backend", "src", "schemas", "erp.py")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

target_block = """class EmployeeResponse(ORMModel):
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
    updated_at: datetime"""

replacement_block = """class EmployeeResponse(ORMModel):
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
    temporary_password: str | None = None"""

if target_block in content:
    content = content.replace(target_block, replacement_block)
    with open(target, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(content)
    print("Updated EmployeeResponse schema successfully")
else:
    print("Could not find Target Block in schemas/erp.py")
