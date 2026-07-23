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
from src.api.v1.pos import products as pos_products
from src.api.v1.pos import sessions as pos_sessions
from src.api.v1.pos import transactions as pos_transactions
from src.api.v1.hrms.recruitment import router as hrms_recruitment_router
from src.api.v1.hrms.performance import router as hrms_performance_router
from src.api.v1.hrms.learning import router as hrms_learning_router
from src.api.v1.hrms.exit_management import router as hrms_exit_router
from src.api.v1.hrms.intelligence import router as hrms_intelligence_router
from src.api.v1.system_admin import router as system_admin_router
from src.api.v1.crm import router as crm_router

from src.api.v1.inventory.product_master import router as inventory_product_master_router
from src.api.v1.inventory.master_catalog import router as inventory_master_catalog_router
from src.api.v1.inventory.product_attributes import router as inventory_attributes_router
from src.api.v1.inventory.product_variants import router as inventory_variants_router
from src.api.v1.inventory.product_bundles import router as inventory_bundles_router
from src.api.v1.inventory.product_kits import router as inventory_kits_router
from src.api.v1.inventory.product_images import router as inventory_images_router

# Warehouse Management
from src.api.v1.inventory.warehouses import router as inventory_warehouses_router

# Inventory Operations
from src.api.v1.inventory.operations_overview import router as inventory_overview_router
from src.api.v1.inventory.goods_receipt import router as inventory_grn_router
from src.api.v1.inventory.goods_issue import router as inventory_issue_router
from src.api.v1.inventory.stock_movement import router as inventory_movement_router
from src.api.v1.inventory.stock_adjustment import router as inventory_adjustment_router
from src.api.v1.inventory.cycle_counting import router as inventory_cycle_counting_router

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
api_router.include_router(hrms_recruitment_router)
api_router.include_router(hrms_performance_router, prefix="/hrms/performance", tags=["HRMS Performance"])
api_router.include_router(hrms_learning_router, prefix="/hrms/learning", tags=["HRMS Learning"])
api_router.include_router(hrms_intelligence_router, prefix="/hrms/intelligence", tags=["HRMS Intelligence"])
api_router.include_router(hrms_exit_router)

# POS Module
api_router.include_router(pos_transactions.router, prefix="/pos")
api_router.include_router(pos_products.router, prefix="/pos")
api_router.include_router(pos_sessions.router, prefix="/pos")

api_router.include_router(system_admin_router)
api_router.include_router(crm_router)

# Inventory Module
api_router.include_router(inventory_master_catalog_router)
api_router.include_router(inventory_product_master_router, prefix="/inventory", tags=["Inventory - Product Master"])
api_router.include_router(inventory_attributes_router, prefix="/inventory")
api_router.include_router(inventory_variants_router, prefix="/inventory")
api_router.include_router(inventory_bundles_router, prefix="/inventory")
api_router.include_router(inventory_kits_router, prefix="/inventory")
api_router.include_router(inventory_images_router, prefix="/inventory")

# Warehouse Management
api_router.include_router(inventory_warehouses_router, prefix="/inventory", tags=["Inventory - Warehouse Management"])

# Inventory Operations Routes
api_router.include_router(inventory_overview_router, prefix="/inventory/operations", tags=["Inventory Operations"])
api_router.include_router(inventory_grn_router, prefix="/inventory/grn", tags=["Inventory Operations - GRN"])
api_router.include_router(inventory_issue_router, prefix="/inventory/goods-issue", tags=["Inventory Operations - Goods Issue"])
api_router.include_router(inventory_movement_router, prefix="/inventory/movements", tags=["Inventory Operations - Movements"])
api_router.include_router(inventory_adjustment_router, prefix="/inventory/adjustments", tags=["Inventory Operations - Adjustments"])
api_router.include_router(inventory_cycle_counting_router, prefix="/inventory/cycle-counts", tags=["Inventory Operations - Cycle Counts"])
