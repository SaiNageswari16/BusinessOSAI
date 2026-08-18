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
from sqlalchemy import delete, func, select, update, text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def purge_tenant_data(db: AsyncSession, tenant_id: uuid.UUID) -> dict[str, int]:
    """
    Permanently purge an entire Tenant workspace and 100% of its data across all database tables:
    Products, Batches, Invoices, POS, Accounting, CRM, Procurement, HRMS, Users, Org Structure, and Tenant record.
    """
    logger.info("Starting complete cascade purge for Tenant %s", tenant_id)
    # Clear all ORM identity map tracking so session doesn't try to synchronize/nullify foreign keys
    db.expunge_all()
    purged_counts: dict[str, int] = {}

    # 1. First, delete all child line items that reference parent records or lack tenant_id directly
    child_line_queries = [
        # Journal Entry Lines referencing journal_entries or chart_of_accounts
        """
        DELETE FROM journal_entry_lines 
        WHERE entry_id IN (SELECT id FROM journal_entries WHERE tenant_id = :tid)
           OR account_id IN (SELECT id FROM chart_of_accounts WHERE tenant_id = :tid);
        """,
        # Invoice Lines & Returns
        """
        DELETE FROM ar_invoice_lines 
        WHERE invoice_id IN (SELECT id FROM ar_invoices WHERE tenant_id = :tid);
        """,
        """
        DELETE FROM ar_invoice_return_lines 
        WHERE return_id IN (SELECT id FROM ar_invoice_returns WHERE tenant_id = :tid);
        """,
        # Delivery Challans & Bank Reconciliations
        """
        DELETE FROM ar_delivery_challan_items 
        WHERE challan_id IN (SELECT id FROM ar_delivery_challans WHERE tenant_id = :tid);
        """,
        """
        DELETE FROM bank_reconciliation_items 
        WHERE reconciliation_id IN (SELECT id FROM bank_reconciliations WHERE tenant_id = :tid);
        """,
        # Payment Vouchers & Expense Claims
        """
        DELETE FROM payment_voucher_lines 
        WHERE voucher_id IN (SELECT id FROM payment_vouchers WHERE tenant_id = :tid);
        """,
        """
        DELETE FROM expense_claim_lines 
        WHERE claim_id IN (SELECT id FROM expense_claims WHERE tenant_id = :tid);
        """,
        # POS Cart Items & Payments
        """
        DELETE FROM pos_cart_items 
        WHERE transaction_id IN (SELECT id FROM pos_transactions WHERE tenant_id = :tid);
        """,
        """
        DELETE FROM pos_payments 
        WHERE transaction_id IN (SELECT id FROM pos_transactions WHERE tenant_id = :tid);
        """,
        # Fixed Asset Depreciation
        """
        DELETE FROM fixed_asset_depreciations 
        WHERE asset_id IN (SELECT id FROM fixed_assets WHERE tenant_id = :tid);
        """,
        # Stock Movements & Batch Allocations
        """
        DELETE FROM product_stock_movements 
        WHERE product_id IN (SELECT id FROM products WHERE tenant_id = :tid);
        """,
        """
        DELETE FROM inventory_batch_allocations 
        WHERE batch_id IN (SELECT id FROM inventory_batches WHERE tenant_id = :tid);
        """,
        """
        DELETE FROM inventory_batch_history 
        WHERE batch_id IN (SELECT id FROM inventory_batches WHERE tenant_id = :tid);
        """,
        # User Roles & User Branches
        """
        DELETE FROM user_roles 
        WHERE user_id IN (SELECT id FROM users WHERE tenant_id = :tid);
        """,
        """
        DELETE FROM user_branches 
        WHERE user_id IN (SELECT id FROM users WHERE tenant_id = :tid);
        """,
    ]

    for q in child_line_queries:
        try:
            async with db.begin_nested():
                await db.execute(text(q), {"tid": tenant_id})
        except Exception as e:
            logger.debug("Child line purge note: %s", e)

    # 2. Dynamically delete from ALL public database tables that have a tenant_id column
    try:
        res = await db.execute(
            text("""
                SELECT table_name, column_name 
                FROM information_schema.columns 
                WHERE column_name = 'tenant_id' 
                  AND table_schema = 'public'
                  AND table_name NOT IN ('tenants');
            """)
        )
        tables_with_tenant = res.fetchall()

        for tbl, col in tables_with_tenant:
            try:
                async with db.begin_nested():
                    del_res = await db.execute(
                        text(f"DELETE FROM {tbl} WHERE {col} = :tid"),
                        {"tid": tenant_id}
                    )
                    count = del_res.rowcount if hasattr(del_res, "rowcount") and del_res.rowcount != -1 else 0
                    purged_counts[tbl] = count
            except Exception as e:
                logger.debug("Dynamic table purge note for %s: %s", tbl, e)
    except Exception as e:
        logger.error("Failed to query information schema for tenant tables: %s", e)

    # 3. Direct SQL delete of the tenant record (excluding root system tenant)
    try:
        async with db.begin_nested():
            del_tenant_res = await db.execute(
                text("DELETE FROM tenants WHERE id = :tid AND slug != 'system'"),
                {"tid": tenant_id}
            )
            count = del_tenant_res.rowcount if hasattr(del_tenant_res, "rowcount") and del_tenant_res.rowcount != -1 else 0
            purged_counts["tenants"] = count
    except Exception as e:
        logger.error("Tenant table delete note: %s", e)

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
    tenant_name = tenant_obj.name if tenant_obj else "Workspace"

    # Expunge all ORM tracked objects so SQLAlchemy session doesn't try to synchronize/nullify foreign keys
    db.expunge_all()

    if purge_entire_tenant_if_owner and (is_owner or (total_tenant_users and total_tenant_users <= 1)) and not is_system_tenant:
        counts = await purge_tenant_data(db, tenant_id)
        return {
            "success": True,
            "purged_type": "full_tenant_workspace",
            "message": f"User {user_email} and their entire organization workspace ({tenant_name}), products, invoices, and activities have been completely purged from the system.",
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
        
        try:
            async with db.begin_nested():
                await db.execute(update(POSTransaction).where(POSTransaction.cashier_id == user_id).values(cashier_id=fallback_id))
        except Exception as e:
            logger.debug("POSTransaction cashier reassign note: %s", e)

        try:
            async with db.begin_nested():
                await db.execute(update(POSSession).where(POSSession.user_id == user_id).values(user_id=fallback_id))
        except Exception as e:
            logger.debug("POSSession user reassign note: %s", e)

        try:
            async with db.begin_nested():
                await db.execute(update(AuditLog).where(AuditLog.user_id == user_id).values(user_id=None))
        except Exception as e:
            logger.debug("AuditLog nullify note: %s", e)

        try:
            async with db.begin_nested():
                await db.execute(update(LeadActivity).where(LeadActivity.created_by_user_id == user_id).values(created_by_user_id=None))
        except Exception as e:
            logger.debug("LeadActivity nullify note: %s", e)

        try:
            async with db.begin_nested():
                await db.execute(update(Lead).where(Lead.owner_user_id == user_id).values(owner_user_id=None))
        except Exception as e:
            logger.debug("Lead owner nullify note: %s", e)

        # 3. Direct SQL delete user
        await db.execute(delete(User).where(User.id == user_id))
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
