import os

target = os.path.join("backend", "src", "api", "v1", "router.py")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

import_block = """from src.api.v1.hrms.employees import router as hrms_employees_router
from src.api.v1.hrms.attendance import router as hrms_attendance_router
from src.api.v1.system_admin import router as system_admin_router"""

new_import_block = """from src.api.v1.hrms.employees import router as hrms_employees_router
from src.api.v1.hrms.attendance import router as hrms_attendance_router
from src.api.v1.hrms.leaves import router as hrms_leaves_router
from src.api.v1.hrms.payroll import router as hrms_payroll_router
from src.api.v1.system_admin import router as system_admin_router"""

router_block = """api_router.include_router(hrms_employees_router)
api_router.include_router(hrms_attendance_router)
api_router.include_router(system_admin_router)"""

new_router_block = """api_router.include_router(hrms_employees_router)
api_router.include_router(hrms_attendance_router)
api_router.include_router(hrms_leaves_router)
api_router.include_router(hrms_payroll_router)
api_router.include_router(system_admin_router)"""

line_ending = "\r\n" if "\r\n" in content else "\n"

content = content.replace(import_block.replace("\n", line_ending), new_import_block.replace("\n", line_ending))
content = content.replace(router_block.replace("\n", line_ending), new_router_block.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Successfully registered leaves and payroll routers in main router.py")
