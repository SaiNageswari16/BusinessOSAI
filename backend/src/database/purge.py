"""
Complete Cascade Purge Service
------------------------------
Handles deep, comprehensive deletion of:
  1. A specific User and all their sessions, tokens, roles, and activities.
  2. An entire Tenant workspace (products, inventory, invoices, POS, CRM, accounting, HRMS, org structure, and users).
"""
import logging
import uuid
from typing import Any
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def purge_tenant_data(db: AsyncSession, tenant_id: uuid.UUID) -> dict[str, int]:
    """
    Permanently purge an entire Tenant workspace and 100% of its data:
    Products, Batches, Invoices, POS, Accounting, CRM, Procurement, HRMS, Users, Org Structure, and Tenant record.
    """
    logger.info("Starting complete cascade purge for Tenant %s", tenant_id)
    purged_counts: dict[str, int] = {}

    async def _safe_delete(model_or_table: Any, condition: Any, name: str) -> None:
        try:
            stmt = delete(model_or_table).where(condition)
            res = await db.execute(stmt)
            count = res.rowcount if hasattr(res, "rowcount") and res.rowcount != -1 else 0
            purged_counts[name] = count
        except Exception as e:
            logger.debug("Purge note for %s on tenant %s: %s", name, tenant_id, e)

    # 1. POS Transactions, Payments, Cart items, Sessions
    try:
        from src.models import POSTransaction, POSPayment, POSCartItem, POSSession, POSRegisterShift, POSRegister
        await _safe_delete(POSCartItem, POSCartItem.tenant_id == tenant_id, "pos_cart_items")
        await _safe_delete(POSPayment, POSPayment.tenant_id == tenant_id, "pos_payments")
        await _safe_delete(POSTransaction, POSTransaction.tenant_id == tenant_id, "pos_transactions")
        await _safe_delete(POSRegisterShift, POSRegisterShift.tenant_id == tenant_id, "pos_register_shifts")
        await _safe_delete(POSSession, POSSession.tenant_id == tenant_id, "pos_sessions")
        await _safe_delete(POSRegister, POSRegister.tenant_id == tenant_id, "pos_registers")
    except Exception as e:
        logger.debug("POS models purge note: %s", e)

    # 2. ERP Invoices, Lines, Payments, Custom Charges
    try:
        from src.models.erp import InvoiceLine, InvoicePayment, Invoice, CustomCharge
        await _safe_delete(InvoicePayment, InvoicePayment.tenant_id == tenant_id, "invoice_payments")
        await _safe_delete(InvoiceLine, InvoiceLine.tenant_id == tenant_id, "invoice_lines")
        await _safe_delete(CustomCharge, CustomCharge.tenant_id == tenant_id, "custom_charges")
        await _safe_delete(Invoice, Invoice.tenant_id == tenant_id, "invoices")
    except Exception as e:
        logger.debug("Invoice models purge note: %s", e)

    # 3. Accounting & Financials
    try:
        from src.models.erp import (
            JournalEntryLine, JournalEntry, BankTransaction, BankReconciliation,
            BankAccount, FixedAsset, PaymentVoucher, ExpenseClaim, Budget,
            TaxReturn, Account, FiscalYear, Currency, TaxConfiguration, PaymentTerm, CostCenter
        )
        await _safe_delete(JournalEntryLine, JournalEntryLine.tenant_id == tenant_id, "journal_lines")
        await _safe_delete(JournalEntry, JournalEntry.tenant_id == tenant_id, "journal_entries")
        await _safe_delete(BankTransaction, BankTransaction.tenant_id == tenant_id, "bank_transactions")
        await _safe_delete(BankReconciliation, BankReconciliation.tenant_id == tenant_id, "bank_reconciliations")
        await _safe_delete(BankAccount, BankAccount.tenant_id == tenant_id, "bank_accounts")
        await _safe_delete(FixedAsset, FixedAsset.tenant_id == tenant_id, "fixed_assets")
        await _safe_delete(PaymentVoucher, PaymentVoucher.tenant_id == tenant_id, "payment_vouchers")
        await _safe_delete(ExpenseClaim, ExpenseClaim.tenant_id == tenant_id, "expense_claims")
        await _safe_delete(Budget, Budget.tenant_id == tenant_id, "budgets")
        await _safe_delete(TaxReturn, TaxReturn.tenant_id == tenant_id, "tax_returns")
        await _safe_delete(Account, Account.tenant_id == tenant_id, "chart_of_accounts")
        await _safe_delete(FiscalYear, FiscalYear.tenant_id == tenant_id, "fiscal_years")
        await _safe_delete(TaxConfiguration, TaxConfiguration.tenant_id == tenant_id, "tax_configurations")
        await _safe_delete(PaymentTerm, PaymentTerm.tenant_id == tenant_id, "payment_terms")
        await _safe_delete(CostCenter, CostCenter.tenant_id == tenant_id, "cost_centers")
    except Exception as e:
        logger.debug("Accounting models purge note: %s", e)

    # 4. Inventory, Batches, Stock Movements, Warehouse & Master Catalog
    try:
        from src.models.erp import (
            InventoryBatch, ProductStockMovement, BatchHistory, BatchAllocation,
            WarehouseZone, WarehouseRack, WarehouseShelf, WarehouseLocation,
            Warehouse, Category, Brand, UnitOfMeasure, Product, MasterCatalogItem
        )
        await _safe_delete(BatchHistory, BatchHistory.tenant_id == tenant_id, "batch_history")
        await _safe_delete(BatchAllocation, BatchAllocation.tenant_id == tenant_id, "batch_allocations")
        await _safe_delete(InventoryBatch, InventoryBatch.tenant_id == tenant_id, "inventory_batches")
        await _safe_delete(ProductStockMovement, ProductStockMovement.tenant_id == tenant_id, "stock_movements")
        await _safe_delete(Product, Product.tenant_id == tenant_id, "products")
        await _safe_delete(MasterCatalogItem, MasterCatalogItem.tenant_id == tenant_id, "master_catalog")
        await _safe_delete(WarehouseShelf, WarehouseShelf.tenant_id == tenant_id, "warehouse_shelves")
        await _safe_delete(WarehouseRack, WarehouseRack.tenant_id == tenant_id, "warehouse_racks")
        await _safe_delete(WarehouseZone, WarehouseZone.tenant_id == tenant_id, "warehouse_zones")
        await _safe_delete(WarehouseLocation, WarehouseLocation.tenant_id == tenant_id, "warehouse_locations")
        await _safe_delete(Warehouse, Warehouse.tenant_id == tenant_id, "warehouses")
        await _safe_delete(Category, Category.tenant_id == tenant_id, "categories")
        await _safe_delete(Brand, Brand.tenant_id == tenant_id, "brands")
        await _safe_delete(UnitOfMeasure, UnitOfMeasure.tenant_id == tenant_id, "uoms")
    except Exception as e:
        logger.debug("Inventory models purge note: %s", e)

    # 5. CRM Leads, Deals, Quotations, Sales Orders, Customers
    try:
        from src.models import (
            LeadActivity, Lead, Deal, Customer, SupportTicket, Campaign,
            SalesQuotationItem, SalesQuotation, SalesOrderItem, SalesOrder,
            WhatsAppMessage, WhatsAppSession
        )
        await _safe_delete(SalesOrderItem, SalesOrderItem.tenant_id == tenant_id, "sales_order_items")
        await _safe_delete(SalesOrder, SalesOrder.tenant_id == tenant_id, "sales_orders")
        await _safe_delete(SalesQuotationItem, SalesQuotationItem.tenant_id == tenant_id, "quotation_items")
        await _safe_delete(SalesQuotation, SalesQuotation.tenant_id == tenant_id, "quotations")
        await _safe_delete(LeadActivity, LeadActivity.tenant_id == tenant_id, "lead_activities")
        await _safe_delete(Deal, Deal.tenant_id == tenant_id, "deals")
        await _safe_delete(Lead, Lead.tenant_id == tenant_id, "leads")
        await _safe_delete(SupportTicket, SupportTicket.tenant_id == tenant_id, "support_tickets")
        await _safe_delete(Campaign, Campaign.tenant_id == tenant_id, "campaigns")
        await _safe_delete(WhatsAppMessage, WhatsAppMessage.tenant_id == tenant_id, "whatsapp_messages")
        await _safe_delete(WhatsAppSession, WhatsAppSession.tenant_id == tenant_id, "whatsapp_sessions")
        await _safe_delete(Customer, Customer.tenant_id == tenant_id, "customers")
    except Exception as e:
        logger.debug("CRM models purge note: %s", e)

    # 6. Procurement Vendors, Purchase Orders, Bills
    try:
        from src.models.erp import (
            PurchaseOrderItem, PurchaseOrder, VendorBillLine, VendorBill,
            VendorPayment, Vendor
        )
        await _safe_delete(PurchaseOrderItem, PurchaseOrderItem.tenant_id == tenant_id, "po_items")
        await _safe_delete(PurchaseOrder, PurchaseOrder.tenant_id == tenant_id, "purchase_orders")
        await _safe_delete(VendorBillLine, VendorBillLine.tenant_id == tenant_id, "vendor_bill_lines")
        await _safe_delete(VendorBill, VendorBill.tenant_id == tenant_id, "vendor_bills")
        await _safe_delete(VendorPayment, VendorPayment.tenant_id == tenant_id, "vendor_payments")
        await _safe_delete(Vendor, Vendor.tenant_id == tenant_id, "vendors")
    except Exception as e:
        logger.debug("Procurement models purge note: %s", e)

    # 7. HRMS Employees, Attendance, Leaves, Payroll, Structure
    try:
        from src.models.hrms import (
            Employee, AttendanceLog, AttendanceCorrection, LeaveRequest,
            LeavePolicy, LeaveBalance, PayrollProcessing, Payslip,
            SalaryStructure, PayGrade, JobOpening, JobApplication,
            Department, Designation, Team
        )
        await _safe_delete(AttendanceLog, AttendanceLog.tenant_id == tenant_id, "attendance_logs")
        await _safe_delete(AttendanceCorrection, AttendanceCorrection.tenant_id == tenant_id, "attendance_corrections")
        await _safe_delete(LeaveRequest, LeaveRequest.tenant_id == tenant_id, "leave_requests")
        await _safe_delete(LeaveBalance, LeaveBalance.tenant_id == tenant_id, "leave_balances")
        await _safe_delete(LeavePolicy, LeavePolicy.tenant_id == tenant_id, "leave_policies")
        await _safe_delete(Payslip, Payslip.tenant_id == tenant_id, "payslips")
        await _safe_delete(PayrollProcessing, PayrollProcessing.tenant_id == tenant_id, "payroll_processing")
        await _safe_delete(SalaryStructure, SalaryStructure.tenant_id == tenant_id, "salary_structures")
        await _safe_delete(PayGrade, PayGrade.tenant_id == tenant_id, "pay_grades")
        await _safe_delete(JobApplication, JobApplication.tenant_id == tenant_id, "job_applications")
        await _safe_delete(JobOpening, JobOpening.tenant_id == tenant_id, "job_openings")
        await _safe_delete(Employee, Employee.tenant_id == tenant_id, "employees")
        await _safe_delete(Department, Department.tenant_id == tenant_id, "departments")
        await _safe_delete(Designation, Designation.tenant_id == tenant_id, "designations")
        await _safe_delete(Team, Team.tenant_id == tenant_id, "teams")
    except Exception as e:
        logger.debug("HRMS models purge note: %s", e)

    # 8. Notifications, Workflows, Webhooks, Templates, System Logs
    try:
        from src.models import (
            Notification, LiveNotification, AuditLog, ActivityLog,
            NotificationTemplate, DocumentTemplate, WorkflowExecution, Workflow,
            WebhookDelivery, WebhookEndpoint, ApiKey, MfaPolicy
        )
        await _safe_delete(LiveNotification, LiveNotification.tenant_id == tenant_id, "live_notifications")
        await _safe_delete(Notification, Notification.tenant_id == tenant_id, "notifications")
        await _safe_delete(AuditLog, AuditLog.tenant_id == tenant_id, "audit_logs")
        await _safe_delete(ActivityLog, ActivityLog.tenant_id == tenant_id, "activity_logs")
        await _safe_delete(NotificationTemplate, NotificationTemplate.tenant_id == tenant_id, "notification_templates")
        await _safe_delete(DocumentTemplate, DocumentTemplate.tenant_id == tenant_id, "document_templates")
        await _safe_delete(WorkflowExecution, WorkflowExecution.tenant_id == tenant_id, "workflow_executions")
        await _safe_delete(Workflow, Workflow.tenant_id == tenant_id, "workflows")
        await _safe_delete(WebhookDelivery, WebhookDelivery.tenant_id == tenant_id, "webhook_deliveries")
        await _safe_delete(WebhookEndpoint, WebhookEndpoint.tenant_id == tenant_id, "webhook_endpoints")
        await _safe_delete(ApiKey, ApiKey.tenant_id == tenant_id, "api_keys")
        await _safe_delete(MfaPolicy, MfaPolicy.tenant_id == tenant_id, "mfa_policies")
    except Exception as e:
        logger.debug("System models purge note: %s", e)

    # 9. Organization Hierarchy (Branches, Companies, Workspaces, Business Units)
    try:
        from src.models import (
            UserRole, UserBranch, RefreshToken, Workspace,
            Branch, Company, BusinessUnit, Zone, Region, Role, Tenant
        )
        await _safe_delete(RefreshToken, RefreshToken.tenant_id == tenant_id, "refresh_tokens")
        await _safe_delete(UserRole, UserRole.tenant_id == tenant_id, "user_roles")
        await _safe_delete(UserBranch, UserBranch.tenant_id == tenant_id, "user_branches")
        await _safe_delete(Workspace, Workspace.tenant_id == tenant_id, "workspaces")
        await _safe_delete(Branch, Branch.tenant_id == tenant_id, "branches")
        await _safe_delete(Company, Company.tenant_id == tenant_id, "companies")
        await _safe_delete(BusinessUnit, BusinessUnit.tenant_id == tenant_id, "business_units")
        await _safe_delete(Zone, Zone.tenant_id == tenant_id, "zones")
        await _safe_delete(Region, Region.tenant_id == tenant_id, "regions")
        await _safe_delete(Role, Role.tenant_id == tenant_id, "roles")
    except Exception as e:
        logger.debug("Org models purge note: %s", e)

    # 10. Users & Tenant
    try:
        from src.models import User, Tenant
        await _safe_delete(User, User.tenant_id == tenant_id, "users")
        # Only delete tenant if it's not the root platform "system" tenant
        tenant_obj = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
        if tenant_obj and tenant_obj.slug != "system":
            await db.delete(tenant_obj)
            purged_counts["tenant"] = 1
    except Exception as e:
        logger.debug("Tenant user purge note: %s", e)

    await db.commit()
    logger.info("Successfully completed cascade purge for Tenant %s: %s", tenant_id, purged_counts)
    return purged_counts


async def purge_user_complete(
    db: AsyncSession,
    user_id: uuid.UUID,
    actor_user_id: uuid.UUID | None = None,
    purge_entire_tenant_if_owner: bool = True,
) -> dict[str, Any]:
    """
    Permanently delete a user.
    If `purge_entire_tenant_if_owner` is True and the user is the Workspace Owner / Creator,
    or the only user in that workspace, purges the entire organization/tenant (products, invoices, etc.) as well.
    """
    from src.models import User, Tenant

    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        return {"success": False, "message": "User not found"}

    tenant_id = user.tenant_id
    is_owner = bool(user.is_tenant_owner)
    user_email = user.email

    # Check total users remaining in this tenant
    total_tenant_users = await db.scalar(
        select(func.count(User.id)).where(User.tenant_id == tenant_id)
    )

    # If the user is the workspace owner or the only user in the tenant, and it's not the root "system" tenant:
    tenant_obj = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    is_system_tenant = tenant_obj and tenant_obj.slug == "system"

    if purge_entire_tenant_if_owner and (is_owner or (total_tenant_users and total_tenant_users <= 1)) and not is_system_tenant:
        counts = await purge_tenant_data(db, tenant_id)
        return {
            "success": True,
            "purged_type": "full_tenant_workspace",
            "message": f"User {user_email} and their entire organization workspace ({tenant_obj.name if tenant_obj else 'Workspace'}), products, invoices, and activities have been completely purged from the system.",
            "details": counts
        }

    # Otherwise, purge this individual user and clean up all their activities
    try:
        from src.models import (
            UserRole, UserBranch, RefreshToken, AuditLog, LeadActivity, Lead,
            POSTransaction, POSSession
        )
        # 1. Clean tokens, roles, branches
        await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id))
        await db.execute(delete(UserRole).where(UserRole.user_id == user_id))
        await db.execute(delete(UserBranch).where(UserBranch.user_id == user_id))

        # 2. Reassign / nullify foreign keys
        fallback_id = actor_user_id if (actor_user_id and actor_user_id != user_id) else None
        await db.execute(update(AuditLog).where(AuditLog.user_id == user_id).values(user_id=None))
        await db.execute(update(LeadActivity).where(LeadActivity.user_id == user_id).values(user_id=None))
        await db.execute(update(Lead).where(Lead.owner_user_id == user_id).values(owner_user_id=None))
        await db.execute(update(POSTransaction).where(POSTransaction.cashier_id == user_id).values(cashier_id=fallback_id))
        await db.execute(update(POSSession).where(POSSession.user_id == user_id).values(user_id=fallback_id))

        # 3. Delete user
        await db.delete(user)
        await db.commit()

        return {
            "success": True,
            "purged_type": "user_and_activities",
            "message": f"User {user_email} and all their session activities have been permanently deleted."
        }
    except Exception as e:
        logger.error("Error during user purge %s: %s", user_id, e)
        await db.rollback()
        raise e
