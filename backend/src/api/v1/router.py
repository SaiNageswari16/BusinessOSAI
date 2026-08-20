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
from src.api.v1.pos import free_qty_rules as pos_free_qty_rules
from src.api.v1.hrms.recruitment import router as hrms_recruitment_router
from src.api.v1.hrms.performance import router as hrms_performance_router
from src.api.v1.hrms.learning import router as hrms_learning_router
from src.api.v1.hrms.exit_management import router as hrms_exit_router
from src.api.v1.hrms.intelligence import router as hrms_intelligence_router
from src.api.v1.system_admin import router as system_admin_router
from src.api.v1.crm import router as crm_router
from src.api.v1.workspace import router as workspace_router

from src.api.v1.inventory.product_master import router as inventory_product_master_router
from src.api.v1.inventory.master_catalog import router as inventory_master_catalog_router
from src.api.v1.inventory.product_attributes import router as inventory_attributes_router
from src.api.v1.inventory.product_variants import router as inventory_variants_router
from src.api.v1.inventory.product_bundles import router as inventory_bundles_router
from src.api.v1.inventory.product_kits import router as inventory_kits_router
from src.api.v1.inventory.product_images import router as inventory_images_router
from src.api.v1.inventory.identifiers import router as inventory_identifiers_router
from src.api.v1.inventory.intelligence import router as inventory_intelligence_router
from src.api.v1.inventory.traceability import router as inventory_traceability_router
from src.api.v1.inventory.warehouse_rules import router as inventory_warehouse_rules_router

# Warehouse Management
from src.api.v1.inventory.warehouses import router as inventory_warehouses_router

# Storefront & CRM Modules
from src.api.v1.storefront import router as storefront_router
from src.api.v1.crm_modules import (
    discounts_router,
    groups_router,
    loyalty_router,
    memberships_router,
    segments_router,
    wallet_router,
    whatsapp_automation_router,
)

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
api_router.include_router(pos_free_qty_rules.router)

api_router.include_router(system_admin_router)
api_router.include_router(crm_router)

# CRM Modules
api_router.include_router(discounts_router)
api_router.include_router(groups_router)
api_router.include_router(loyalty_router)
api_router.include_router(memberships_router)
api_router.include_router(segments_router)
api_router.include_router(wallet_router)
api_router.include_router(whatsapp_automation_router)

# Storefront
api_router.include_router(storefront_router)

# Workspace
api_router.include_router(workspace_router)

# POS (Point of Sale)
api_router.include_router(pos_products.router, prefix="/pos", tags=["POS - Products"])
api_router.include_router(pos_sessions.router, prefix="/pos", tags=["POS - Sessions"])
api_router.include_router(pos_transactions.router, prefix="/pos", tags=["POS - Transactions"])

from src.api.v1.inventory.barcode_scanner import router as barcode_scanner_router

# Inventory Module
api_router.include_router(barcode_scanner_router)
api_router.include_router(inventory_master_catalog_router)
api_router.include_router(inventory_product_master_router, prefix="/inventory", tags=["Inventory - Product Master"])
api_router.include_router(inventory_attributes_router, prefix="/inventory")
api_router.include_router(inventory_variants_router, prefix="/inventory")
api_router.include_router(inventory_bundles_router, prefix="/inventory")
api_router.include_router(inventory_kits_router, prefix="/inventory")
api_router.include_router(inventory_images_router, prefix="/inventory")
api_router.include_router(inventory_identifiers_router, prefix="/inventory", tags=["Inventory Identifiers"])
api_router.include_router(inventory_intelligence_router, prefix="/inventory", tags=["Inventory Intelligence"])
api_router.include_router(inventory_traceability_router, prefix="/inventory", tags=["Inventory Traceability"])
api_router.include_router(inventory_warehouse_rules_router, prefix="/inventory", tags=["Warehouse Rules"])

# Warehouse Management
api_router.include_router(inventory_warehouses_router, prefix="/inventory", tags=["Inventory - Warehouse Management"])

# Inventory Operations Routes
from src.api.v1.procurement import router as procurement_router
from src.api.v1.reports import router as reports_router

api_router.include_router(inventory_overview_router, prefix="/inventory/operations", tags=["Inventory Operations"])
api_router.include_router(inventory_grn_router, prefix="/inventory/grn", tags=["Inventory Operations - GRN"])
api_router.include_router(inventory_issue_router, prefix="/inventory/goods-issue", tags=["Inventory Operations - Goods Issue"])
api_router.include_router(inventory_movement_router, prefix="/inventory/movements", tags=["Inventory Operations - Movements"])
api_router.include_router(inventory_adjustment_router, prefix="/inventory/adjustments", tags=["Inventory Operations - Adjustments"])
api_router.include_router(inventory_cycle_counting_router, prefix="/inventory/cycle-counts", tags=["Inventory Operations - Cycle Counts"])
api_router.include_router(procurement_router, prefix="/inventory")
api_router.include_router(procurement_router, prefix="/erp")
api_router.include_router(reports_router)

# Recruitment integrations router
from src.integrations.zoho.routes import router as zoho_router
from src.api.v1.notifications import router as notifications_router

# ERP Accounting & Finance modules
from src.api.v1.erp.financial_reports import router as financial_reports_router
from src.api.v1.erp.accounting import router as accounting_router
from src.api.v1.erp.invoices import router as invoices_router
from src.api.v1.erp.bank import router as bank_router
from src.api.v1.erp.fixed_assets import router as fixed_assets_router
from src.api.v1.erp.vouchers import router as vouchers_router
from src.api.v1.erp.tax import router as tax_router
from src.api.v1.erp.budgets import router as budgets_router
from src.api.v1.erp.expense_claims import router as expense_claims_router

api_router.include_router(zoho_router)
api_router.include_router(notifications_router)

api_router.include_router(accounting_router)
api_router.include_router(invoices_router, tags=["Invoices & AR"])
api_router.include_router(bank_router)
api_router.include_router(fixed_assets_router)
api_router.include_router(vouchers_router)
api_router.include_router(tax_router)
api_router.include_router(budgets_router)
api_router.include_router(expense_claims_router)
api_router.include_router(financial_reports_router)


# Delivery Challan Module
from src.api.v1.erp.delivery_challan import router as delivery_challan_router
api_router.include_router(delivery_challan_router, prefix="/erp")

# E-Way Bill & GST Compliance Modules (Whitebooks GSP)
from src.api.v1.erp.eway_bill import router as eway_bill_router
from src.api.v1.erp.gst_filing import router as gst_filing_router
api_router.include_router(eway_bill_router, prefix="/erp")
api_router.include_router(gst_filing_router, prefix="/erp")

# LazyMonkeyAI Copilot
from src.api.v1.copilot import router as copilot_router
api_router.include_router(copilot_router)

# Utilities (Pincode lookup, geocoding)
from src.api.v1.utils import router as utils_router
api_router.include_router(utils_router)


# Universal Static / Uploaded Image Serving via API Prefix
from fastapi.responses import FileResponse
from fastapi import HTTPException
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[3]
UPLOAD_IMAGES_DIR = BACKEND_DIR / "upload_images"
IMAGES_DIR = BACKEND_DIR / "images"
STATIC_DIR = BACKEND_DIR / "static"

@api_router.get("/upload_images/{file_path:path}")
@api_router.get("/images/{file_path:path}")
async def serve_api_uploaded_image(file_path: str):
    candidates = [
        UPLOAD_IMAGES_DIR / file_path,
        IMAGES_DIR / file_path,
        STATIC_DIR / file_path,
        BACKEND_DIR / "src" / "images" / file_path,
    ]
    for p in candidates:
        if p.is_file():
            return FileResponse(str(p))
    raise HTTPException(status_code=404, detail=f"Image '{file_path}' not found")

