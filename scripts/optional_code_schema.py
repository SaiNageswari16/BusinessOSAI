import os

target = os.path.join("backend", "src", "schemas", "erp.py")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

target_block = """class EmployeeBase(BaseModel):
    employee_code: str = Field(min_length=1, max_length=50)"""

replacement_block = """class EmployeeBase(BaseModel):
    employee_code: str | None = Field(None, max_length=50)"""

if target_block in content:
    content = content.replace(target_block, replacement_block)
    with open(target, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(content)
    print("Updated EmployeeBase schema to make employee_code optional in Pydantic")
else:
    print("Could not find Target Block in schemas/erp.py")
