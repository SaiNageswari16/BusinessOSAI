"""Staff & HRMS API router collection."""
from __future__ import annotations

from fastapi import APIRouter

from src.services.staff.api.employees import router as employees_router
from src.services.staff.api.attendance import router as attendance_router
from src.services.staff.api.leaves import router as leaves_router
from src.services.staff.api.payroll import router as payroll_router
from src.services.staff.api.recruitment import router as recruitment_router
from src.services.staff.api.performance import router as performance_router
from src.services.staff.api.learning import router as learning_router
from src.services.staff.api.exit_management import router as exit_router
from src.services.staff.api.intelligence import router as intelligence_router
from src.services.staff.api.travel_routes import router as travel_routes_router
from src.services.staff.api.organization import router as organization_router
from src.services.staff.api.tips import router as tips_router

# ─── Canonical HRMS API Router (Mounted at /api/v1) ─────────────────────────
# Matches the monolithic endpoints exactly:
# /hrms/employees, /hrms/attendance, /hrms/leaves, /hrms/payroll,
# /hrms/recruitment, /hrms/performance, /hrms/learning, /hrms/exit,
# /hrms/intelligence, /hrms/travel-routes, /erp/departments, etc.

hrms_api_router = APIRouter()

hrms_api_router.include_router(employees_router)
hrms_api_router.include_router(attendance_router)
hrms_api_router.include_router(leaves_router)
hrms_api_router.include_router(payroll_router)
hrms_api_router.include_router(recruitment_router)
hrms_api_router.include_router(performance_router, prefix="/hrms/performance", tags=["HRMS Performance"])
hrms_api_router.include_router(learning_router, prefix="/hrms/learning", tags=["HRMS Learning"])
hrms_api_router.include_router(intelligence_router, prefix="/hrms/intelligence", tags=["HRMS Intelligence"])
hrms_api_router.include_router(travel_routes_router)
hrms_api_router.include_router(exit_router)

# Organization endpoints mounted under both /erp and /hrms
hrms_api_router.include_router(organization_router, prefix="/erp")
hrms_api_router.include_router(organization_router, prefix="/hrms")

# Tips and tip pools
hrms_api_router.include_router(tips_router, prefix="/staff")
hrms_api_router.include_router(tips_router, prefix="/hrms")

# ─── Staff Service Root Router (for build_service default mounting) ───────────
router = APIRouter()
router.include_router(tips_router)
router.include_router(organization_router)
router.include_router(employees_router)
router.include_router(attendance_router)

__all__ = [
    "router",
    "hrms_api_router",
    "employees_router",
    "attendance_router",
    "leaves_router",
    "payroll_router",
    "recruitment_router",
    "performance_router",
    "learning_router",
    "exit_router",
    "intelligence_router",
    "travel_routes_router",
    "organization_router",
    "tips_router",
]
