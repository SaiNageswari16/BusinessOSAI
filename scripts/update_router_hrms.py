import os

target = os.path.join("backend", "src", "api", "v1", "router.py")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

import_part = """from src.api.v1.erp.erp_system import router as erp_system_router
from src.api.v1.system_admin import router as system_admin_router"""

new_import_part = """from src.api.v1.erp.erp_system import router as erp_system_router
from src.api.v1.hrms.employees import router as hrms_employees_router
from src.api.v1.hrms.attendance import router as hrms_attendance_router
from src.api.v1.system_admin import router as system_admin_router"""

include_part = """api_router.include_router(erp_system_router)
api_router.include_router(system_admin_router)"""

new_include_part = """api_router.include_router(erp_system_router)
api_router.include_router(hrms_employees_router)
api_router.include_router(hrms_attendance_router)
api_router.include_router(system_admin_router)"""

if import_part.replace("\r\n", "\n") in content.replace("\r\n", "\n"):
    line_ending = "\r\n" if "\r\n" in content else "\n"
    content = content.replace(import_part.replace("\n", line_ending), new_import_part.replace("\n", line_ending))
    content = content.replace(include_part.replace("\n", line_ending), new_include_part.replace("\n", line_ending))
    with open(target, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    print("Updated router.py successfully")
else:
    # Just write the whole file since it's very short
    full_content = """from fastapi import APIRouter

from src.api.v1.auth import router as auth_router
from src.api.v1.erp.access_control import router as access_control_router
from src.api.v1.erp.audit import router as audit_router
from src.api.v1.erp.organization import router as organization_router
from src.api.v1.erp.financial import router as financial_router
from src.api.v1.erp.workflow import router as workflow_router
from src.api.v1.erp.master_data import router as master_data_router
from src.api.v1.erp.erp_system import router as erp_system_router
from src.api.v1.hrms.employees import router as hrms_employees_router
from src.api.v1.hrms.attendance import router as hrms_attendance_router
from src.api.v1.system_admin import router as system_admin_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(organization_router)
api_router.include_router(access_control_router)
api_router.include_router(audit_router)
api_router.include_router(financial_router)
api_router.include_router(workflow_router)
api_router.include_router(master_data_router)
api_router.include_router(erp_system_router)
api_router.include_router(hrms_employees_router)
api_router.include_router(hrms_attendance_router)
api_router.include_router(system_admin_router)
"""
    with open(target, "w", encoding="utf-8") as f:
        f.write(full_content)
    print("Rewrote router.py successfully")
