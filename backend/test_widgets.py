import asyncio
from src.database.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date, String, desc
from datetime import date, datetime, timedelta
from src.models import (
    PurchaseRequest, ExpenseClaim, LeaveRequest, Warehouse, Product, 
    InventoryBatch, GoodsIssue, InvoiceReturn, PurchaseOrder,
    Branch, ActivityLog, LiveNotification, Interview, User
)
from src.models.erp import ExpenseStatus
import hashlib

async def test_queries():
    async for db in get_db():
        today = date.today()
        
        pr_count = await db.scalar(select(func.count(PurchaseRequest.id))) or 0
        exp_pend = await db.scalar(select(func.count(ExpenseClaim.id)).where(cast(ExpenseClaim.status, String) == 'PENDING')) or 0
        leave_pend = await db.scalar(select(func.count(LeaveRequest.id)).where(cast(LeaveRequest.status, String) == 'PENDING')) or 0
        pending_approvals = exp_pend + leave_pend
        warehouse_count = await db.scalar(select(func.count(Warehouse.id))) or 0
        low_stock = await db.scalar(select(func.count(Product.id)).where(Product.initial_stock < Product.reorder_level)) or 0
        thirty_days_later = today + timedelta(days=30)
        expiring = await db.scalar(select(func.count(InventoryBatch.id)).where(cast(InventoryBatch.expiry_date, Date) <= thirty_days_later)) or 0
        delivery_status = await db.scalar(select(func.count(GoodsIssue.id))) or 0
        open_returns = await db.scalar(select(func.count(InvoiceReturn.id)).where(cast(InvoiceReturn.status, String) == 'PENDING')) or 0
        prod_orders = await db.scalar(select(func.count(PurchaseOrder.id))) or 0
        
        operationsWidgets = [
            {'label': 'Purchase Requests', 'value': str(pr_count), 'trend': '12 awaiting approval', 'status': 'normal'},
            {'label': 'Pending Approvals', 'value': str(pending_approvals), 'trend': 'Across departments', 'status': 'normal'},
            {'label': 'Warehouse Capacity', 'value': str(warehouse_count), 'trend': 'Active facilities', 'status': 'normal'},
            {'label': 'Low Stock Items', 'value': str(low_stock), 'trend': 'Items below threshold', 'status': 'critical' if low_stock > 0 else 'normal'},
            {'label': 'Expiring Products', 'value': str(expiring), 'trend': 'Within 30 days', 'status': 'warning' if expiring > 0 else 'normal'},
            {'label': 'Delivery Status', 'value': str(delivery_status), 'trend': 'Active issues', 'status': 'normal'},
            {'label': 'Open Returns', 'value': str(open_returns), 'trend': 'Require review', 'status': 'warning' if open_returns > 0 else 'normal'},
            {'label': 'Production Orders', 'value': str(prod_orders), 'trend': 'Active POs', 'status': 'normal'}
        ]
        
        print('Ops done')
        
        branches = (await db.execute(select(Branch))).scalars().all()
        branchPerformance = []
        for b in branches:
            seed = int(hashlib.md5(str(b.id).encode()).hexdigest(), 16)
            rev = (seed % 1000) + 100
            prof = int(rev * ((seed % 30 + 10) / 100))
            branchPerformance.append({'name': b.name, 'revenue': rev, 'profit': prof})
        
        if not branchPerformance:
            branchPerformance = [{'name': 'HQ', 'revenue': 800, 'profit': 200}]
            
        print('Branch done')
        
        low_stock_prods = (await db.execute(
            select(Product.name, Product.sku, Product.initial_stock).where(Product.initial_stock < Product.reorder_level).order_by(Product.initial_stock.asc()).limit(3)
        )).all()
        
        inventoryAlerts = []
        for name, sku, stock in low_stock_prods:
            inventoryAlerts.append({
                'item': name,
                'sku': sku,
                'qty': int(stock or 0),
                'status': 'Critical' if (stock or 0) == 0 else 'Warn'
            })
            
        print('Inventory done')
            
        recent_q = select(ActivityLog, User.full_name).join(User, User.id == ActivityLog.user_id, isouter=True).order_by(desc(ActivityLog.created_at)).limit(6)
        recent_logs = (await db.execute(recent_q)).all()
        recentActivity = []
        for log, user_name in recent_logs:
            recentActivity.append({
                'id': log.id,
                'who': user_name or 'System',
                'action': log.action or 'updated record',
                'target': log.module or 'System',
                'time': 'recently',
                'type': 'info'
            })
            
        print('Activity done')
            
        notifs = (await db.execute(
            select(LiveNotification).order_by(desc(LiveNotification.created_at)).limit(5)
        )).scalars().all()
        notifications = []
        for n in notifs:
            notifications.append({
                'id': n.id,
                'title': n.title,
                'body': n.body or '',
                'time': 'recently',
                'tone': n.category or 'info',
                'unread': n.unread
            })
            
        print('Notif done')
        
        interviews = (await db.execute(
            select(Interview).where(cast(Interview.date, Date) >= today).order_by(cast(Interview.date, Date).asc()).limit(3)
        )).scalars().all()
        
        calendarEvents = []
        for i in interviews:
            calendarEvents.append({
                'title': f"Interview: {i.job_title}",
                'desc': i.candidate or 'Candidate',
                'day': i.date.strftime('%a') if i.date else 'Soon',
                'time': i.time or ''
            })
            
        print('Events done')
        
        print('ALL SUCCESS')

asyncio.run(test_queries())
