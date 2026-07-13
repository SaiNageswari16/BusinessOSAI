from fastapi import APIRouter

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
from src.api.v1.hrms.leaves import router as hrms_leaves_router
from src.api.v1.hrms.payroll import router as hrms_payroll_router
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
api_router.include_router(hrms_leaves_router)
api_router.include_router(hrms_payroll_router)
api_router.include_router(system_admin_router)
