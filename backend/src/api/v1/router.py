from fastapi import APIRouter

from src.api.v1.auth import router as auth_router
from src.api.v1.organization import router as organization_router
from src.api.v1.menu import router as menu_router
from src.api.v1.dine_in import router as dine_in_router
from src.api.v1.kitchen import router as kitchen_router
from src.api.v1.billing import router as billing_router
from src.api.v1.shifts import router as shifts_router
from src.api.v1.inventory import router as inventory_router
from src.api.v1.purchase import router as purchase_router
from src.api.v1.staff import router as staff_router
from src.api.v1.customers import router as customers_router
from src.api.v1.loyalty import router as loyalty_router
from src.api.v1.accounting import router as accounting_router
from src.api.v1.reports import router as reports_router
from src.api.v1.notifications import router as notifications_router
from src.api.v1.integrations.aggregators import router as aggregators_router
from src.api.v1.integrations.printers import router as printers_router
from src.api.v1.ai.copilot import router as copilot_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(organization_router)
api_router.include_router(menu_router)
api_router.include_router(dine_in_router)
api_router.include_router(kitchen_router)
api_router.include_router(billing_router)
api_router.include_router(shifts_router)
api_router.include_router(inventory_router)
api_router.include_router(purchase_router)
api_router.include_router(staff_router)
api_router.include_router(customers_router)
api_router.include_router(loyalty_router)
api_router.include_router(accounting_router)
api_router.include_router(reports_router)
api_router.include_router(notifications_router)
api_router.include_router(aggregators_router)
api_router.include_router(printers_router)
api_router.include_router(copilot_router)
