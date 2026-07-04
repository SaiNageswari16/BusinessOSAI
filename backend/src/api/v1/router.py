from fastapi import APIRouter

from src.api.v1.auth import router as auth_router
from src.api.v1.erp.access_control import router as access_control_router
from src.api.v1.erp.audit import router as audit_router
from src.api.v1.erp.organization import router as organization_router
from src.api.v1.erp.financial import router as financial_router
from src.api.v1.system_admin import router as system_admin_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(organization_router)
api_router.include_router(access_control_router)
api_router.include_router(audit_router)
api_router.include_router(financial_router)
api_router.include_router(system_admin_router)

