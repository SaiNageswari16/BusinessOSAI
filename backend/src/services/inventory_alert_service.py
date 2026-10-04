"""
Inventory Alert Service — Multi-Tenant Automated Stock Alerting Engine

Handles:
1. Real-time Low-Stock Push & WhatsApp alerts upon sales/movements.
2. Dead Stock (>60/90 days idle) detection & alerts.
3. Batch Expiry warnings (<30 days).
4. Automated Daily/Weekly WhatsApp Digest summaries for store managers & org admins.
"""

import os
import re
import uuid
import logging
from datetime import datetime, timezone, timedelta, date
from typing import List, Dict, Any, Optional
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, desc, cast, Date
from sqlalchemy.orm import selectinload

from src.models import Tenant, Company, LiveNotification
from src.models.inventory import Product, ProductCategory, StockMovement, InventoryBatch
from src.utils.notifications import add_system_notification

logger = logging.getLogger(__name__)

_raw_gateway_url = os.getenv("WHATSAPP_GATEWAY_URL", "http://127.0.0.1:8005")
GATEWAY_URL = _raw_gateway_url.replace("localhost", "127.0.0.1")


async def get_active_whatsapp_session(
    db: Optional[AsyncSession] = None,
    tenant_id: Optional[uuid.UUID] = None,
) -> Optional[str]:
    """
    Return the session ID of the CONNECTED or AUTHENTICATED WhatsApp session.
    Strictly isolated per workspace/tenant when db and tenant_id are provided.
    """
    try:
        tenant_allowed_sessions = None
        if db is not None and tenant_id is not None:
            tenant = await db.get(Tenant, tenant_id)
            if tenant and tenant.settings:
                tenant_allowed_sessions = tenant.settings.get("whatsapp_web_sessions") or []

        async with httpx.AsyncClient(timeout=3.0) as http:
            resp = await http.get(f"{GATEWAY_URL}/sessions")
            if resp.status_code != 200:
                return None
            sessions = resp.json()

            # 1. Multi-tenant isolation: Check tenant's explicitly linked sessions
            if tenant_allowed_sessions is not None:
                for sid in tenant_allowed_sessions:
                    info = sessions.get(sid) or (sessions.get(sid[2:]) if sid.startswith("91") else sessions.get(f"91{sid}"))
                    if isinstance(info, dict) and info.get("status") in ("CONNECTED", "AUTHENTICATED"):
                        return sid
                return None

            # No tenant context or no tenant sessions configured
            return None
    except Exception as exc:
        logger.warning("[Inventory Alert] WhatsApp Gateway session check error: %s", exc)
    return None


async def send_whatsapp_alert_text(
    recipient_phone: str,
    message: str,
    db: Optional[AsyncSession] = None,
    tenant_id: Optional[uuid.UUID] = None,
) -> Dict[str, Any]:
    """
    Directly dispatches a formatted text notification to a recipient WhatsApp number.
    Ensures strict tenant session isolation.
    """
    if not recipient_phone:
        return {"success": False, "error": "No recipient phone number provided"}

    clean_phone = re.sub(r"[^0-9]", "", str(recipient_phone))
    if len(clean_phone) == 10:
        clean_phone = f"91{clean_phone}"

    session_id = await get_active_whatsapp_session(db=db, tenant_id=tenant_id)
    if not session_id:
        logger.info("[Inventory Alert] WhatsApp Gateway has no active session connected. Skipping WhatsApp dispatch.")
        return {"success": False, "error": "WhatsApp Gateway not connected"}

    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            resp = await http.post(
                f"{GATEWAY_URL}/sessions/{session_id}/chats/{clean_phone}/send",
                json={"message": message},
            )
            if resp.status_code in (200, 201):
                logger.info("[Inventory Alert] WhatsApp alert successfully sent to %s (session %s)", clean_phone, session_id)
                return {"success": True, "status": "SENT", "session_id": session_id}
            else:
                logger.warning("[Inventory Alert] Gateway rejected send (%s): %s", resp.status_code, resp.text)
                return {"success": False, "error": resp.text}
    except Exception as e:
        logger.error("[Inventory Alert] Failed sending WhatsApp text: %s", e)
        return {"success": False, "error": str(e)}


async def get_tenant_alert_config(db: AsyncSession, tenant_id: uuid.UUID) -> Dict[str, Any]:
    """Retrieves tenant notification settings specifically for inventory alerts."""
    tenant = await db.get(Tenant, tenant_id)
    default_cfg = {
        "low_stock_push": True,
        "low_stock_whatsapp": True,
        "dead_stock_push": True,
        "dead_stock_whatsapp": True,
        "dead_stock_days": 90,
        "expiry_alerts": True,
        "expiry_days_threshold": 30,
        "manager_whatsapp": "",
        "auto_digest_enabled": True,
    }
    if not tenant or not tenant.settings:
        return default_cfg
    
    inv_alerts = tenant.settings.get("inventory_alerts", {})
    default_cfg.update(inv_alerts)
    return default_cfg


async def check_and_notify_low_stock(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    company_id: Optional[uuid.UUID],
    product_ids: List[int | uuid.UUID | str],
) -> List[Dict[str, Any]]:
    """
    Checks specific products to determine if they fell below reorder_level.
    Triggers In-App Live Push and WhatsApp alerts if thresholds are breached.
    """
    if not product_ids:
        return []

    cfg = await get_tenant_alert_config(db, tenant_id)

    # Cast / query products
    valid_pids = []
    for pid in product_ids:
        if isinstance(pid, uuid.UUID):
            valid_pids.append(pid)
        elif isinstance(pid, str):
            try:
                valid_pids.append(uuid.UUID(pid))
            except Exception:
                try:
                    valid_pids.append(int(pid))
                except Exception:
                    pass
        elif isinstance(pid, int):
            valid_pids.append(pid)

    if not valid_pids:
        return []

    q = (
        select(Product)
        .options(selectinload(Product.category), selectinload(Product.uom))
        .where(
            Product.tenant_id == tenant_id,
            Product.id.in_(valid_pids),
        )
    )
    result = await db.execute(q)
    products = result.scalars().all()

    triggered = []
    for p in products:
        current_stock = int(p.initial_stock or p.on_hand_stock or 0)
        reorder_lvl = int(p.reorder_level or 0)

        # Trigger if current stock is at or below reorder level
        if current_stock <= reorder_lvl:
            triggered.append({
                "id": str(p.id),
                "name": p.name,
                "sku": p.sku or "N/A",
                "current_stock": current_stock,
                "reorder_level": reorder_lvl,
                "is_zero": current_stock <= 0,
            })

    if not triggered:
        return []

    # 1. In-App Live Push Notifications
    if cfg.get("low_stock_push", True):
        for item in triggered:
            urgency = "🚨 OUT OF STOCK" if item["is_zero"] else "⚠️ LOW STOCK ALERT"
            title = f"{urgency}: {item['name']}"
            body = f"Product '{item['name']}' (SKU: {item['sku']}) has only {item['current_stock']} units remaining (Reorder Threshold: {item['reorder_level']})."
            await add_system_notification(
                db=db,
                tenant_id=tenant_id,
                title=title,
                body=body,
                category="inventory",
            )

    # 2. WhatsApp Alert
    if cfg.get("low_stock_whatsapp", True) and cfg.get("manager_whatsapp"):
        recipient = cfg["manager_whatsapp"]
        lines = [
            "⚠️ *BusinessOS Inventory — Low Stock Alert*",
            f"📅 *Time:* {datetime.now(timezone.utc).strftime('%d %b %Y, %I:%M %p')}",
            "",
            "The following item(s) have fallen below minimum reorder thresholds:",
        ]
        for idx, item in enumerate(triggered[:5], 1):
            status = "🔴 *Out of Stock*" if item["is_zero"] else "🟡 *Low Stock*"
            lines.append(f"{idx}. *{item['name']}* (SKU: {item['sku']})")
            lines.append(f"   • Remaining: *{item['current_stock']} units* (Min Reorder: {item['reorder_level']}) [{status}]")
        
        if len(triggered) > 5:
            lines.append(f"\n...and {len(triggered) - 5} more items.")

        lines.extend([
            "",
            "👉 *Action Required:* Please review procurement or issue a Purchase Order.",
        ])

        wa_msg = "\n".join(lines)
        await send_whatsapp_alert_text(recipient, wa_msg, db=db, tenant_id=tenant_id)

    return triggered


async def generate_inventory_alert_signals(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    company_id: Optional[uuid.UUID] = None,
    dead_stock_days: int = 90,
    expiry_days_threshold: int = 30,
) -> Dict[str, Any]:
    """
    Computes comprehensive inventory alert status:
    - Low stock / Stockouts
    - Dead stock (No movement in >= dead_stock_days)
    - Expiring batches
    """
    now = datetime.now(timezone.utc)
    since_date = now - timedelta(days=dead_stock_days)

    # 1. Products list
    prod_q = (
        select(Product)
        .options(selectinload(Product.category), selectinload(Product.uom))
        .where(Product.tenant_id == tenant_id)
    )
    if company_id:
        prod_q = prod_q.where(or_(Product.company_id == company_id, Product.company_id == None))
    products = (await db.execute(prod_q)).scalars().all()

    # 2. Low stock calculation
    low_stock_items = []
    stockout_items = []
    for p in products:
        stk = int(p.initial_stock or p.on_hand_stock or 0)
        reorder = int(p.reorder_level or 0)
        cost_price = float(getattr(p, "purchase_price", 0) or getattr(p, "selling_price", 0) or getattr(p, "mrp", 0) or 0.0)
        
        cat_name = "General"
        if getattr(p, "category", None) is not None:
            cat_name = getattr(p.category, "name", "General")
        elif getattr(p, "category_name", None):
            cat_name = getattr(p, "category_name", "General")

        unit_name = "pcs"
        if getattr(p, "uom", None) is not None:
            unit_name = getattr(p.uom, "name", "pcs")
        elif getattr(p, "unit", None):
            unit_name = getattr(p, "unit", "pcs")

        if stk <= 0:
            stockout_items.append({
                "id": str(p.id),
                "name": p.name,
                "sku": p.sku or "N/A",
                "stock": stk,
                "reorder_level": reorder,
                "cost_price": cost_price,
                "category": cat_name or "General",
                "unit": unit_name or "pcs",
            })
        elif reorder > 0 and stk <= reorder:
            low_stock_items.append({
                "id": str(p.id),
                "name": p.name,
                "sku": p.sku or "N/A",
                "stock": stk,
                "reorder_level": reorder,
                "cost_price": cost_price,
                "category": cat_name or "General",
                "unit": unit_name or "pcs",
            })

    # 3. Dead stock detection (products with stock > 0 but no StockMovement in last N days)
    recent_movement_q = (
        select(StockMovement.product_id)
        .where(
            StockMovement.tenant_id == tenant_id,
            StockMovement.created_at >= since_date,
        )
        .distinct()
    )
    active_pids = set((await db.execute(recent_movement_q)).scalars().all())

    dead_stock_items = []
    total_dead_capital = 0.0
    for p in products:
        stk = int(p.initial_stock or p.on_hand_stock or 0)
        cost = float(getattr(p, "purchase_price", 0) or getattr(p, "selling_price", 0) or getattr(p, "mrp", 0) or 0.0)
        if stk > 0 and p.id not in active_pids:
            locked_val = stk * cost
            total_dead_capital += locked_val
            
            cat_name = "General"
            if getattr(p, "category", None) is not None:
                cat_name = getattr(p.category, "name", "General")

            dead_stock_items.append({
                "id": str(p.id),
                "name": p.name,
                "sku": p.sku or "N/A",
                "stock": stk,
                "cost_price": cost,
                "locked_capital": locked_val,
                "category": cat_name or "General",
            })

    dead_stock_items.sort(key=lambda x: x["locked_capital"], reverse=True)

    # 4. Expiring batches
    expiry_limit_date = now.date() + timedelta(days=expiry_days_threshold)
    batch_q = (
        select(InventoryBatch)
        .where(
            InventoryBatch.tenant_id == tenant_id,
            InventoryBatch.remaining_quantity > 0,
            InventoryBatch.expiry_date.is_not(None),
            cast(InventoryBatch.expiry_date, Date) <= expiry_limit_date,
        )
        .order_by(InventoryBatch.expiry_date.asc())
        .limit(20)
    )
    expiring_batches_raw = (await db.execute(batch_q)).scalars().all()
    expiring_batches = []
    for b in expiring_batches_raw:
        exp_d: Optional[date] = None
        if b.expiry_date:
            if isinstance(b.expiry_date, datetime):
                exp_d = b.expiry_date.date()
            elif isinstance(b.expiry_date, date):
                exp_d = b.expiry_date
            else:
                try:
                    exp_d = datetime.fromisoformat(str(b.expiry_date)).date()
                except Exception:
                    exp_d = None

        days_left = (exp_d - now.date()).days if exp_d else 0
        expiring_batches.append({
            "id": str(b.id),
            "batch_number": b.batch_number or "N/A",
            "product_id": str(b.product_id) if b.product_id else "",
            "remaining_quantity": float(b.remaining_quantity or 0),
            "expiry_date": str(exp_d) if exp_d else (str(b.expiry_date) if b.expiry_date else ""),
            "days_left": days_left,
        })

    return {
        "summary": {
            "total_products": len(products),
            "stockout_count": len(stockout_items),
            "low_stock_count": len(low_stock_items),
            "dead_stock_count": len(dead_stock_items),
            "dead_capital_amount": total_dead_capital,
            "expiring_batches_count": len(expiring_batches),
        },
        "stockout_items": stockout_items[:20],
        "low_stock_items": low_stock_items[:20],
        "dead_stock_items": dead_stock_items[:20],
        "expiring_batches": expiring_batches,
    }


async def dispatch_inventory_alert_digest(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    company_id: Optional[uuid.UUID] = None,
    target_phone: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Builds and sends a full multi-signal Inventory Alert Digest via In-App Notification and WhatsApp.
    """
    cfg = await get_tenant_alert_config(db, tenant_id)
    recipient = target_phone or cfg.get("manager_whatsapp")

    signals = await generate_inventory_alert_signals(
        db=db,
        tenant_id=tenant_id,
        company_id=company_id,
        dead_stock_days=int(cfg.get("dead_stock_days", 90)),
        expiry_days_threshold=int(cfg.get("expiry_days_threshold", 30)),
    )

    summary = signals["summary"]
    total_alerts = summary["stockout_count"] + summary["low_stock_count"] + summary["dead_stock_count"] + summary["expiring_batches_count"]

    # 1. In-App Notification
    digest_title = f"📦 Inventory Health Digest: {total_alerts} Actionable Alerts"
    digest_body = (
        f"Critical summary: {summary['stockout_count']} Stockouts, {summary['low_stock_count']} Low Stock items, "
        f"{summary['dead_stock_count']} Dead Stock items (₹{summary['dead_capital_amount']:,.0f} locked), "
        f"and {summary['expiring_batches_count']} expiring batches."
    )
    await add_system_notification(
        db=db,
        tenant_id=tenant_id,
        title=digest_title,
        body=digest_body,
        category="inventory",
    )

    # 2. WhatsApp Digest Dispatch
    wa_result = {"success": False, "status": "SKIPPED", "message": "No WhatsApp number configured"}
    if recipient:
        lines = [
            "📊 *BusinessOS AI — Inventory Health & Stock Digest*",
            f"📅 *Date:* {datetime.now(timezone.utc).strftime('%d %b %Y, %I:%M %p')}",
            "━━━━━━━━━━━━━━━━━━━━━━",
        ]

        # Stockouts & Low Stock
        if summary["stockout_count"] > 0 or summary["low_stock_count"] > 0:
            lines.append(f"\n🚨 *REORDER & STOCKOUT ALERTS ({summary['stockout_count'] + summary['low_stock_count']} Items):*")
            for item in signals["stockout_items"][:4]:
                lines.append(f"  ❌ *{item['name']}* (SKU: {item['sku']}) — *0 {item['unit']}* (Reorder: {item['reorder_level']})")
            for item in signals["low_stock_items"][:4]:
                lines.append(f"  ⚠️ *{item['name']}* (SKU: {item['sku']}) — *{item['stock']} {item['unit']} left* (Reorder: {item['reorder_level']})")

        # Dead Stock
        if summary["dead_stock_count"] > 0:
            lines.append(f"\n⏳ *DEAD STOCK (> {cfg.get('dead_stock_days', 90)} Days Idle):*")
            lines.append(f"  • *{summary['dead_stock_count']} Products* with *₹{summary['dead_capital_amount']:,.2f}* locked capital.")
            for item in signals["dead_stock_items"][:3]:
                lines.append(f"  • {item['name']}: {item['stock']} units (₹{item['locked_capital']:,.0f} idle)")

        # Expiring Batches
        if summary["expiring_batches_count"] > 0:
            lines.append(f"\n⏰ *BATCHES EXPIRING SOON (< {cfg.get('expiry_days_threshold', 30)} Days):*")
            for b in signals["expiring_batches"][:3]:
                lines.append(f"  • Batch #{b['batch_number']}: {b['remaining_quantity']} qty expires in *{b['days_left']} days*")

        lines.extend([
            "\n━━━━━━━━━━━━━━━━━━━━━━",
            "🔗 *Open Inventory Studio:* https://app.businessos.ai/inventory",
            "⚡ Generated automatically by BusinessOS AI Alert Engine",
        ])

        wa_text = "\n".join(lines)
        wa_result = await send_whatsapp_alert_text(recipient, wa_text, db=db, tenant_id=tenant_id)

    return {
        "success": True,
        "signals": signals,
        "whatsapp_delivery": wa_result,
    }
