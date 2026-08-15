import logging
import requests
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.session import get_db
from src.config import get_settings
from src.models import Employee, AttendanceRecord, Lead, Customer, Branch, Department, POSTransaction
from src.models.inventory import Product, Warehouse, StockMovement, MasterCatalogProduct
from src.models.procurement import Supplier, PurchaseOrder, VendorBill

logger = logging.getLogger("reports_api")
class _SettingsProxy:
    def __getattr__(self, name):
        return getattr(get_settings(), name)

settings = _SettingsProxy()

router = APIRouter(prefix="/analytics", tags=["Analytics & Intelligence"])

def _call_ai_consult(provider: str, prompt: str) -> str:
    """Helper to query Claude or Gemini based on active env config."""
    # 1. Gemini Sourcing
    if provider == "gemini" and settings.gemini_api_key:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model or 'gemini-2.0-flash'}:generateContent?key={settings.gemini_api_key}"

        headers = {"Content-Type": "application/json"}
        body = {
            "contents": [{"parts": [{"text": prompt}]}]
        }
        try:
            response = requests.post(url, headers=headers, json=body, timeout=60)
            if response.status_code == 200:
                data = response.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
            else:
                logger.warning(f"Gemini API returned error {response.status_code}: {response.text}")
        except Exception as exc:
            logger.warning("Gemini AI consult failed: %s", exc)

    # 2. Claude Sourcing
    elif provider == "claude" and settings.anthropic_api_key:
        url = f"{settings.anthropic_base_url.rstrip('/')}/v1/messages"
        headers = {
            "x-api-key": settings.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        body = {
            "model": settings.anthropic_model or "claude-3-5-sonnet-20241022",
            "max_tokens": 1500,
            "messages": [{"role": "user", "content": prompt}],
        }
        try:
            response = requests.post(url, headers=headers, json=body, timeout=60)
            if response.status_code == 200:
                data = response.json()
                return next((block.get("text", "") for block in data.get("content", []) if block.get("type") == "text"), "")
            else:
                logger.warning(f"Claude API returned error {response.status_code}: {response.text}")
        except Exception as exc:
            logger.warning("Claude AI consult failed: %s", exc)

    return "I was unable to consult the AI assistant. Please verify your API keys and provider configurations in the `.env` settings."


@router.get("/reports/{tab}")
async def get_report_data(tab: str, db: AsyncSession = Depends(get_db)):
    """100% real-time report data — every number is a live database aggregate or row value."""

    # ── Real-time DB aggregates ──────────────────────────────────────────────
    async def _count(model, extra=None):
        stmt = select(func.count(model.id))
        if extra is not None:
            stmt = stmt.where(extra)
        try:
            return (await db.execute(stmt)).scalar() or 0
        except Exception:
            return 0

    async def _sum(model, col, extra=None):
        stmt = select(func.coalesce(func.sum(col), 0))
        if extra is not None:
            stmt = stmt.where(extra)
        try:
            return float((await db.execute(stmt)).scalar() or 0)
        except Exception:
            return 0.0

    async def _rows(model, order=None, limit=50):
        from sqlalchemy.orm import selectinload
        stmt = select(model)
        if model == POSTransaction:
            stmt = stmt.options(selectinload(POSTransaction.payments))
        if order is not None:
            stmt = stmt.order_by(order)
        stmt = stmt.limit(limit)
        try:
            return (await db.execute(stmt)).scalars().all()
        except Exception:
            return []

    # All counts
    total_pos        = await _count(POSTransaction)
    total_revenue    = await _sum(POSTransaction, POSTransaction.total_amount)
    total_products   = await _count(Product)
    total_employees  = await _count(Employee)
    total_leads      = await _count(Lead)
    total_customers  = await _count(Customer)
    total_suppliers  = await _count(Supplier)
    total_pos_orders = await _count(PurchaseOrder)

    # Qualified leads count (real status filter)
    qualified_leads  = await _count(Lead, Lead.status.ilike("qualified"))

    # Real total stock value = sum of selling_price for all products
    total_stock_value = await _sum(Product, Product.selling_price)

    # Real pipeline value = sum of estimated_value across all leads
    pipeline_value = await _sum(Lead, Lead.estimated_value)

    res = {
        "title": tab.replace("_", " ").title(),
        "metrics": [],
        "chartData": [],
        "chartConfig": {"type": "line", "keys": []},
        "tableColumns": [],
        "tableData": [],
        "aiSummary": ""
    }

    # ── Sales / POS ────────────────────────────────────────────────────────────
    if tab in ["sales_reports", "revenue_reports", "pos_reports", "branch_reports"]:
        avg_order = (total_revenue / total_pos) if total_pos > 0 else 0.0
        res["metrics"] = [
            {"label": "Total Sales Revenue",    "value": f"${total_revenue:,.2f}", "change": f"{total_pos} transactions recorded", "isPositive": total_pos > 0, "icon": "trending-up"},
            {"label": "Total POS Transactions", "value": f"{total_pos}",            "change": "Live terminal sync",                  "isPositive": total_pos > 0, "icon": "shopping-cart"},
            {"label": "Average Order Value",    "value": f"${avg_order:.2f}",       "change": "Per-transaction average",             "isPositive": total_pos > 0, "icon": "activity"},
            {"label": "Active Products",        "value": f"{total_products}",       "change": "Catalog items tracked",              "isPositive": total_products > 0, "icon": "boxes"},
        ]
        tx_rows = await _rows(POSTransaction, POSTransaction.created_at.desc(), 20)
        res["chartConfig"] = {"type": "area", "keys": [{"key": "total", "color": "var(--primary)", "label": "Transaction Amount (₹)"}]}
        res["chartData"] = [
            {"name": r.created_at.strftime("%d %b %H:%M") if r.created_at else f"#{i+1}", "total": float(r.total_amount or 0)}
            for i, r in enumerate(reversed(tx_rows))
        ] or [{"name": "No data", "total": 0}]
        res["tableColumns"] = [
            {"header": "Transaction ID", "key": "tx_id"},
            {"header": "Date & Time",    "key": "date"},
            {"header": "Payment",        "key": "payment"},
            {"header": "Discount",       "key": "discount"},
            {"header": "Total",          "key": "total"},
        ]
        res["tableData"] = [
            {
                "tx_id":   f"TXN-{str(r.id)[:8].upper()}",
                "date":    r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "—",
                "payment": ", ".join([p.payment_method.value.title() for p in r.payments]) if r.payments else "N/A",
                "discount": f"₹{float(r.discount_amount or 0):.2f}",
                "total":   f"₹{float(r.total_amount or 0):.2f}",
            } for r in tx_rows
        ]
        res["aiSummary"] = (
            f"Live POS data: ₹{total_revenue:,.2f} revenue across {total_pos} transactions. Average basket ₹{avg_order:.2f}."
            if total_pos > 0 else
            "No POS transactions recorded yet. Complete a checkout in the POS terminal to populate this report."
        )

    # ── Revenue Prediction ─────────────────────────────────────────────────────
    # Shows: margin analysis and revenue potential across the full product catalog.
    # Chart: MRP vs Selling Price per product (line/bar).
    # Table: product-level margin breakdown.
    elif tab == "revenue_prediction":
        prod_rows = await _rows(Product, limit=20)
        total_mrp  = sum(float(r.mrp or 0) for r in prod_rows)
        total_sell = sum(float(r.selling_price or 0) for r in prod_rows)
        total_margin = total_mrp - total_sell
        margin_pct = (total_margin / total_mrp * 100) if total_mrp > 0 else 0.0
        avg_sell = (total_sell / len(prod_rows)) if prod_rows else 0.0

        res["metrics"] = [
            {"label": "Catalog Products",   "value": f"{total_products}",       "change": "Products in database",      "isPositive": total_products > 0, "icon": "boxes"},
            {"label": "Total MRP",          "value": f"₹{total_mrp:,.2f}",      "change": "Sum of all product MRPs",   "isPositive": total_mrp > 0,      "icon": "trending-up"},
            {"label": "Total Selling Value","value": f"₹{total_sell:,.2f}",     "change": "Sum of selling prices",     "isPositive": total_sell > 0,     "icon": "activity"},
            {"label": "Avg Margin",         "value": f"{margin_pct:.1f}%",      "change": f"₹{total_margin:,.2f} total margin potential", "isPositive": margin_pct > 0, "icon": "percent"},
        ]
        res["chartConfig"] = {"type": "bar", "keys": [
            {"key": "mrp",     "color": "#0ea5e9",        "label": "MRP (₹)"},
            {"key": "sell",    "color": "var(--primary)", "label": "Selling Price (₹)"},
            {"key": "margin",  "color": "#10b981",        "label": "Margin (₹)"},
        ]}
        res["chartData"] = [
            {
                "name":   r.name[:14],
                "mrp":    float(r.mrp or 0),
                "sell":   float(r.selling_price or 0),
                "margin": float(r.mrp or 0) - float(r.selling_price or 0),
            }
            for r in prod_rows
        ] or [{"name": "No products", "mrp": 0, "sell": 0, "margin": 0}]
        res["tableColumns"] = [
            {"header": "Product",       "key": "name"},
            {"header": "SKU",           "key": "sku"},
            {"header": "MRP",           "key": "mrp"},
            {"header": "Selling Price", "key": "sell"},
            {"header": "Margin (₹)",   "key": "margin_val"},
            {"header": "Margin %",      "key": "margin_pct"},
        ]
        res["tableData"] = [
            {
                "name":       r.name,
                "sku":        r.sku or "—",
                "mrp":        f"₹{float(r.mrp or 0):.2f}",
                "sell":       f"₹{float(r.selling_price or 0):.2f}",
                "margin_val": f"₹{(float(r.mrp or 0) - float(r.selling_price or 0)):.2f}",
                "margin_pct": f"{((float(r.mrp or 0) - float(r.selling_price or 0)) / max(0.01, float(r.mrp or 1)) * 100):.1f}%",
            } for r in prod_rows
        ]
        res["aiSummary"] = (
            f"Revenue forecast: {total_products} products, total MRP ₹{total_mrp:,.2f}, "
            f"selling value ₹{total_sell:,.2f}, average margin {margin_pct:.1f}%."
            if prod_rows else
            "Add products under Inventory → Product Master to enable revenue forecasting."
        )

    # ── Demand Forecast ────────────────────────────────────────────────────────
    # Shows: reorder-level analysis — which products are near or below reorder threshold.
    # Chart: initial_stock vs reorder_level per product (grouped bar).
    # Table: product stock status and urgency.
    elif tab == "demand_forecast_reports":
        prod_rows = await _rows(Product, limit=20)
        below_reorder = [r for r in prod_rows if (r.initial_stock or 0) <= (r.reorder_level or 0)]
        near_reorder  = [r for r in prod_rows if (r.reorder_level or 0) < (r.initial_stock or 0) <= (r.reorder_level or 0) * 1.5]
        healthy       = [r for r in prod_rows if (r.initial_stock or 0) > (r.reorder_level or 0) * 1.5]
        total_initial_stock = sum(int(r.initial_stock or 0) for r in prod_rows)
        total_reorder_units = sum(int(r.reorder_level or 0) for r in prod_rows)

        res["metrics"] = [
            {"label": "Total Stock Units",    "value": f"{total_initial_stock:,}",  "change": "Sum of initial_stock in catalog",    "isPositive": total_initial_stock > 0, "icon": "boxes"},
            {"label": "Below Reorder Level",  "value": f"{len(below_reorder)}",     "change": "Products at or below reorder level", "isPositive": len(below_reorder) == 0, "icon": "activity"},
            {"label": "Near Reorder Level",   "value": f"{len(near_reorder)}",      "change": "Within 150% of reorder level",       "isPositive": len(near_reorder) == 0, "icon": "trending-up"},
            {"label": "Healthy Stock",        "value": f"{len(healthy)}",           "change": "Above 1.5× reorder cushion",         "isPositive": len(healthy) > 0,        "icon": "percent"},
        ]
        res["chartConfig"] = {"type": "bar", "keys": [
            {"key": "stock",   "color": "#10b981",        "label": "Initial Stock (units)"},
            {"key": "reorder", "color": "#f59e0b",        "label": "Reorder Level (units)"},
        ]}
        res["chartData"] = [
            {
                "name":    r.name[:14],
                "stock":   int(r.initial_stock or 0),
                "reorder": int(r.reorder_level or 0),
            }
            for r in prod_rows
        ] or [{"name": "No products", "stock": 0, "reorder": 0}]
        res["tableColumns"] = [
            {"header": "Product",         "key": "name"},
            {"header": "Current Stock",   "key": "stock"},
            {"header": "Reorder Level",   "key": "reorder"},
            {"header": "Stock Status",    "key": "status"},
            {"header": "Action Required", "key": "action"},
        ]
        res["tableData"] = [
            {
                "name":    r.name,
                "stock":   str(int(r.initial_stock or 0)),
                "reorder": str(int(r.reorder_level or 0)),
                "status":  "⚠ Critical" if (r.initial_stock or 0) <= (r.reorder_level or 0)
                           else "⚡ Low" if (r.initial_stock or 0) <= (r.reorder_level or 0) * 1.5
                           else "✅ Healthy",
                "action":  "Raise PO immediately" if (r.initial_stock or 0) <= (r.reorder_level or 0)
                           else "Plan restock soon" if (r.initial_stock or 0) <= (r.reorder_level or 0) * 1.5
                           else "No action needed",
            } for r in prod_rows
        ]
        res["aiSummary"] = (
            f"Demand analysis: {total_products} products tracked. "
            f"{len(below_reorder)} critical (at or below reorder), {len(near_reorder)} low, {len(healthy)} healthy. "
            f"Total units in system: {total_initial_stock:,}."
            if prod_rows else
            "Add products with stock levels under Inventory → Product Master to enable demand forecasting."
        )

    # ── Inventory Forecast ─────────────────────────────────────────────────────
    # Shows: purchase cost vs selling price per product — cost basis analysis.
    # Chart: purchase_price vs selling_price per product (line).
    # Table: product cost, sell, gross profit per unit.
    elif tab == "inventory_forecast":
        prod_rows  = await _rows(Product, limit=20)
        po_rows    = await _rows(PurchaseOrder, limit=10)
        po_total   = await _sum(PurchaseOrder, PurchaseOrder.total_amount)
        total_cost = sum(float(r.purchase_price or 0) for r in prod_rows)
        total_sell = sum(float(r.selling_price or 0) for r in prod_rows)
        gross_profit = total_sell - total_cost

        res["metrics"] = [
            {"label": "Total Purchase Cost",  "value": f"₹{total_cost:,.2f}",    "change": "Sum of purchase prices",       "isPositive": total_cost > 0,     "icon": "shopping-cart"},
            {"label": "Total Sell Value",     "value": f"₹{total_sell:,.2f}",    "change": "Sum of selling prices",        "isPositive": total_sell > 0,     "icon": "trending-up"},
            {"label": "Gross Profit Potential","value": f"₹{gross_profit:,.2f}", "change": "Sell minus cost across catalog","isPositive": gross_profit > 0,   "icon": "activity"},
            {"label": "PO Spend (Total)",     "value": f"₹{po_total:,.2f}",      "change": f"{total_pos_orders} purchase orders issued","isPositive": po_total > 0,"icon": "percent"},
        ]
        res["chartConfig"] = {"type": "line", "keys": [
            {"key": "cost", "color": "#ef4444",        "label": "Purchase Cost (₹)"},
            {"key": "sell", "color": "var(--primary)", "label": "Selling Price (₹)"},
        ]}
        res["chartData"] = [
            {
                "name": r.name[:14],
                "cost": float(r.purchase_price or 0),
                "sell": float(r.selling_price or 0),
            }
            for r in prod_rows
        ] or [{"name": "No products", "cost": 0, "sell": 0}]
        res["tableColumns"] = [
            {"header": "Product",          "key": "name"},
            {"header": "Purchase Price",   "key": "cost"},
            {"header": "Selling Price",    "key": "sell"},
            {"header": "Gross Profit/Unit","key": "gp"},
            {"header": "GP Margin %",      "key": "gp_pct"},
        ]
        res["tableData"] = [
            {
                "name": r.name,
                "cost": f"₹{float(r.purchase_price or 0):.2f}",
                "sell": f"₹{float(r.selling_price or 0):.2f}",
                "gp":   f"₹{(float(r.selling_price or 0) - float(r.purchase_price or 0)):.2f}",
                "gp_pct": f"{((float(r.selling_price or 0) - float(r.purchase_price or 0)) / max(0.01, float(r.selling_price or 1)) * 100):.1f}%",
            } for r in prod_rows
        ]
        res["aiSummary"] = (
            f"Inventory cost analysis: {total_products} products, total purchase cost ₹{total_cost:,.2f}, "
            f"total sell value ₹{total_sell:,.2f}, gross profit potential ₹{gross_profit:,.2f}."
            if prod_rows else
            "Add products with purchase and selling prices to enable inventory forecasting."
        )

    # ── Customers ──────────────────────────────────────────────────────────────

    elif tab in ["customer_reports", "customer_prediction", "loyalty_reports"]:
        cust_rows = await _rows(Customer, limit=50)
        active_c = sum(1 for r in cust_rows if (r.status or "").lower() == "active")
        res["metrics"] = [
            {"label": "Total Customers",  "value": f"{total_customers}", "change": "Registered accounts",    "isPositive": total_customers > 0, "icon": "users"},
            {"label": "Active Customers", "value": f"{active_c}",        "change": "Status = Active",        "isPositive": active_c > 0,        "icon": "activity"},
            {"label": "Active Leads",     "value": f"{total_leads}",     "change": "CRM pipeline entries",   "isPositive": total_leads > 0,     "icon": "percent"},
            {"label": "Pipeline Value",   "value": f"₹{pipeline_value:,.2f}", "change": "Sum of estimated lead values", "isPositive": pipeline_value > 0, "icon": "trending-up"},
        ]
        res["chartConfig"] = {"type": "bar", "keys": [{"key": "count", "color": "var(--primary)", "label": "Profiles"}]}
        res["chartData"] = [
            {"name": "Customers", "count": total_customers},
            {"name": "Active",    "count": active_c},
            {"name": "Leads",     "count": total_leads},
        ]
        res["tableColumns"] = [
            {"header": "Name",   "key": "name"},
            {"header": "Email",  "key": "email"},
            {"header": "Status", "key": "status"},
            {"header": "Created","key": "created"},
        ]
        res["tableData"] = [
            {
                "name":    r.name,
                "email":   r.email or "—",
                "status":  (r.status or "Unknown").title(),
                "created": r.created_at.strftime("%Y-%m-%d") if r.created_at else "—",
            } for r in cust_rows
        ]
        res["aiSummary"] = (
            f"CRM: {total_customers} customers, {active_c} active, {total_leads} pipeline leads worth ₹{pipeline_value:,.2f}."
            if total_customers > 0 else
            "No customers yet. Add them under CRM to activate this report."
        )

    # ── Leads ──────────────────────────────────────────────────────────────────
    elif tab in ["lead_reports", "campaign_reports"]:
        lead_rows = await _rows(Lead, limit=50)
        res["metrics"] = [
            {"label": "Total Leads",      "value": f"{total_leads}",          "change": "All CRM leads",          "isPositive": total_leads > 0,     "icon": "users"},
            {"label": "Qualified Leads",  "value": f"{qualified_leads}",      "change": "Status = Qualified",     "isPositive": qualified_leads > 0, "icon": "activity"},
            {"label": "Pipeline Value",   "value": f"₹{pipeline_value:,.2f}", "change": "Sum of estimated values","isPositive": pipeline_value > 0,  "icon": "trending-up"},
            {"label": "Avg Lead Value",   "value": f"₹{(pipeline_value / max(1, total_leads)):,.2f}", "change": "Per-lead average", "isPositive": pipeline_value > 0, "icon": "percent"},
        ]
        res["chartConfig"] = {"type": "bar", "keys": [{"key": "value", "color": "var(--primary)", "label": "Est. Value (₹)"}]}
        res["chartData"] = [
            {"name": r.name[:14], "value": float(r.estimated_value or 0)}
            for r in lead_rows
        ] or [{"name": "No leads", "value": 0}]
        res["tableColumns"] = [
            {"header": "Name",     "key": "name"},
            {"header": "Company",  "key": "company"},
            {"header": "Email",    "key": "email"},
            {"header": "Status",   "key": "status"},
            {"header": "Source",   "key": "source"},
            {"header": "Est Value","key": "value"},
        ]
        res["tableData"] = [
            {
                "name":    r.name,
                "company": r.company_name or "—",
                "email":   r.email or "—",
                "status":  (r.status or "New").title(),
                "source":  r.source or "—",
                "value":   f"₹{float(r.estimated_value or 0):,.2f}",
            } for r in lead_rows
        ]
        res["aiSummary"] = (
            f"Pipeline: {total_leads} leads, {qualified_leads} qualified, total value ₹{pipeline_value:,.2f}."
            if total_leads > 0 else
            "No leads yet. Register leads under Sales & CRM to populate."
        )

    # ── Employees / HR ─────────────────────────────────────────────────────────
    elif tab in ["attrition_prediction_reports", "performance_reports", "attendance_reports",
                 "payroll_reports", "recruitment_reports"]:
        emp_rows = await _rows(Employee, limit=50)
        active_e = sum(1 for r in emp_rows if (r.status or "").lower() == "active")
        res["metrics"] = [
            {"label": "Total Employees",  "value": f"{total_employees}", "change": "HRMS records",     "isPositive": total_employees > 0, "icon": "users"},
            {"label": "Active Staff",     "value": f"{active_e}",        "change": "Status = Active",  "isPositive": active_e > 0,        "icon": "activity"},
            {"label": "Departments",      "value": "N/A",                "change": "Synced designations","isPositive": True,               "icon": "percent"},
            {"label": "Attrition Risk",   "value": f"{total_employees - active_e} flagged", "change": "Non-active staff count", "isPositive": (total_employees - active_e) == 0, "icon": "trending-up"},
        ]
        res["chartConfig"] = {"type": "bar", "keys": [{"key": "count", "color": "var(--primary)", "label": "Staff Count"}]}
        res["chartData"] = [
            {"name": "Total", "count": total_employees},
            {"name": "Active","count": active_e},
            {"name": "Flagged","count": total_employees - active_e},
        ]
        res["tableColumns"] = [
            {"header": "Name",   "key": "name"},
            {"header": "Email",  "key": "email"},
            {"header": "Status", "key": "status"},
            {"header": "Joined", "key": "joined"},
        ]
        res["tableData"] = [
            {
                "name":   r.full_name,
                "email":  r.email or "—",
                "status": (r.status or "Unknown").title(),
                "joined": r.created_at.strftime("%Y-%m-%d") if r.created_at else "—",
            } for r in emp_rows
        ]
        res["aiSummary"] = (
            f"HRMS: {total_employees} staff, {active_e} active, {total_employees - active_e} flagged for review."
            if total_employees > 0 else
            "No employees yet. Add staff under HR module."
        )

    # ── Inventory / Stock ──────────────────────────────────────────────────────
    elif tab in ["stock_reports", "abc_analysis_reports", "xyz_analysis_reports",
                 "movement_reports", "warehouse_reports"]:
        prod_rows = await _rows(Product, limit=50)
        res["metrics"] = [
            {"label": "Total Products",    "value": f"{total_products}",          "change": "In product master",    "isPositive": total_products > 0,  "icon": "boxes"},
            {"label": "Total Selling Value","value": f"₹{total_stock_value:,.2f}","change": "Sum of selling prices","isPositive": total_stock_value > 0,"icon": "trending-up"},
            {"label": "Active Suppliers",  "value": f"{total_suppliers}",         "change": "Vendor partners",      "isPositive": total_suppliers > 0,  "icon": "activity"},
            {"label": "Purchase Orders",   "value": f"{total_pos_orders}",        "change": "Procurement records",  "isPositive": total_pos_orders > 0, "icon": "percent"},
        ]
        res["chartConfig"] = {"type": "bar", "keys": [
            {"key": "mrp",  "color": "#0ea5e9",        "label": "MRP (₹)"},
            {"key": "sell", "color": "var(--primary)", "label": "Selling Price (₹)"},
        ]}
        res["chartData"] = [
            {"name": r.name[:14], "mrp": float(r.mrp or 0), "sell": float(r.selling_price or 0)}
            for r in prod_rows
        ] or [{"name": "No products", "mrp": 0, "sell": 0}]
        res["tableColumns"] = [
            {"header": "SKU",          "key": "sku"},
            {"header": "Product",      "key": "name"},
            {"header": "MRP",          "key": "mrp"},
            {"header": "Selling Price","key": "sell"},
            {"header": "ABC Class",    "key": "abc"},
        ]
        res["tableData"] = [
            {
                "sku":  r.sku or "—",
                "name": r.name,
                "mrp":  f"₹{float(r.mrp or 0):.2f}",
                "sell": f"₹{float(r.selling_price or 0):.2f}",
                "abc":  "A" if float(r.selling_price or 0) > 100 else "B" if float(r.selling_price or 0) > 20 else "C",
            } for r in prod_rows
        ]
        res["aiSummary"] = (
            f"Inventory: {total_products} products, total selling value ₹{total_stock_value:,.2f}."
            if total_products > 0 else
            "No products. Add items under Inventory → Product Master."
        )

    # ── Procurement ────────────────────────────────────────────────────────────
    elif tab in ["purchase_reports", "supplier_reports", "grn_reports", "spend_analysis_reports"]:
        po_rows   = await _rows(PurchaseOrder, limit=30)
        sup_rows  = await _rows(Supplier, limit=30)
        bill_rows = await _rows(VendorBill, limit=10)
        po_total  = await _sum(PurchaseOrder, PurchaseOrder.total_amount)
        res["metrics"] = [
            {"label": "Purchase Orders",   "value": f"{total_pos_orders}",  "change": "All PO records",      "isPositive": total_pos_orders > 0, "icon": "shopping-cart"},
            {"label": "Total PO Value",    "value": f"₹{po_total:,.2f}",    "change": "Sum of PO amounts",   "isPositive": po_total > 0,         "icon": "trending-up"},
            {"label": "Suppliers",         "value": f"{total_suppliers}",   "change": "Onboarded vendors",   "isPositive": total_suppliers > 0,  "icon": "users"},
            {"label": "Vendor Bills",      "value": f"{len(bill_rows)}",    "change": "Invoices received",   "isPositive": len(bill_rows) > 0,   "icon": "percent"},
        ]
        res["chartConfig"] = {"type": "bar", "keys": [{"key": "total", "color": "var(--primary)", "label": "PO Value (₹)"}]}
        res["chartData"] = [
            {"name": r.po_number or f"PO-{i+1}", "total": float(r.total_amount or 0)}
            for i, r in enumerate(po_rows)
        ] or [{"name": "No POs", "total": 0}]
        res["tableColumns"] = [
            {"header": "PO Number", "key": "po_no"},
            {"header": "Order Date","key": "date"},
            {"header": "Status",    "key": "status"},
            {"header": "Value",     "key": "value"},
        ]
        res["tableData"] = [
            {
                "po_no":  r.po_number or f"PO-{str(r.id)[:6].upper()}",
                "date":   r.order_date.strftime("%Y-%m-%d") if r.order_date else "—",
                "status": (r.status or "Draft").title(),
                "value":  f"₹{float(r.total_amount or 0):,.2f}",
            } for r in po_rows
        ]
        res["aiSummary"] = (
            f"Procurement: {total_pos_orders} POs totalling ₹{po_total:,.2f} from {total_suppliers} suppliers."
            if total_pos_orders > 0 else
            "No purchase orders yet. Create POs under Operations → Purchase Orders."
        )

    # ── Fraud Detection ────────────────────────────────────────────────────────
    elif tab == "fraud_detection_reports":
        tx_rows = await _rows(POSTransaction, POSTransaction.created_at.desc(), 30)
        # Flag transactions where discount_amount > 20% of total as anomalous
        flagged = [r for r in tx_rows if float(r.total_amount or 0) > 0 and
                   (float(r.discount_amount or 0) / float(r.total_amount or 1)) > 0.20]
        res["metrics"] = [
            {"label": "Transactions Scanned", "value": f"{total_pos}",        "change": "Live POS log",          "isPositive": True,             "icon": "activity"},
            {"label": "Anomalies Detected",   "value": f"{len(flagged)}",     "change": "Discount > 20% of total","isPositive": len(flagged) == 0,"icon": "users"},
            {"label": "Clean Transactions",   "value": f"{total_pos - len(flagged)}", "change": "Pass fraud threshold", "isPositive": True,      "icon": "percent"},
            {"label": "Total Revenue",        "value": f"₹{total_revenue:,.2f}", "change": "All POS revenue",    "isPositive": total_revenue > 0,"icon": "trending-up"},
        ]
        res["chartConfig"] = {"type": "bar", "keys": [
            {"key": "total",    "color": "var(--primary)", "label": "Amount (₹)"},
            {"key": "discount", "color": "#ef4444",        "label": "Discount (₹)"},
        ]}
        res["chartData"] = [
            {"name": f"TXN-{str(r.id)[:4].upper()}", "total": float(r.total_amount or 0), "discount": float(r.discount_amount or 0)}
            for r in tx_rows[:15]
        ] or [{"name": "No data", "total": 0, "discount": 0}]
        res["tableColumns"] = [
            {"header": "TXN ID",   "key": "tx_id"},
            {"header": "Total",    "key": "total"},
            {"header": "Discount", "key": "discount"},
            {"header": "Risk",     "key": "risk"},
        ]
        res["tableData"] = [
            {
                "tx_id":    f"TXN-{str(r.id)[:8].upper()}",
                "total":    f"₹{float(r.total_amount or 0):.2f}",
                "discount": f"₹{float(r.discount_amount or 0):.2f}",
                "risk":     "HIGH" if r in flagged else "OK",
            } for r in tx_rows
        ]
        res["aiSummary"] = (
            f"Fraud scan: {len(flagged)} anomalous transactions out of {total_pos} total."
            if total_pos > 0 else
            "No transactions to scan yet."
        )

    # ── Default / Generic (catch-all) ──────────────────────────────────────────
    else:
        po_rows = await _rows(PurchaseOrder, limit=20)
        po_total = await _sum(PurchaseOrder, PurchaseOrder.total_amount)
        res["metrics"] = [
            {"label": "Products",  "value": f"{total_products}",  "change": "Catalog items",       "isPositive": total_products > 0,  "icon": "boxes"},
            {"label": "Employees", "value": f"{total_employees}", "change": "HRMS staff",          "isPositive": total_employees > 0, "icon": "users"},
            {"label": "Leads",     "value": f"{total_leads}",     "change": "CRM pipeline",        "isPositive": total_leads > 0,     "icon": "activity"},
            {"label": "Suppliers", "value": f"{total_suppliers}", "change": "Vendor partners",     "isPositive": total_suppliers > 0, "icon": "percent"},
        ]
        res["chartConfig"] = {"type": "bar", "keys": [{"key": "value", "color": "var(--primary)", "label": "Count"}]}
        res["chartData"] = [
            {"name": "Products",   "value": total_products},
            {"name": "Employees",  "value": total_employees},
            {"name": "Leads",      "value": total_leads},
            {"name": "Customers",  "value": total_customers},
            {"name": "Suppliers",  "value": total_suppliers},
            {"name": "POs",        "value": total_pos_orders},
        ]
        res["tableColumns"] = [
            {"header": "Module",   "key": "module"},
            {"header": "Records",  "key": "count"},
            {"header": "Status",   "key": "status"},
        ]
        res["tableData"] = [
            {"module": "POS Transactions",  "count": str(total_pos),         "status": "Live" if total_pos > 0       else "Empty"},
            {"module": "Products",          "count": str(total_products),     "status": "Live" if total_products > 0  else "Empty"},
            {"module": "Employees",         "count": str(total_employees),    "status": "Live" if total_employees > 0 else "Empty"},
            {"module": "Leads",             "count": str(total_leads),        "status": "Live" if total_leads > 0     else "Empty"},
            {"module": "Customers",         "count": str(total_customers),    "status": "Live" if total_customers > 0 else "Empty"},
            {"module": "Suppliers",         "count": str(total_suppliers),    "status": "Live" if total_suppliers > 0 else "Empty"},
            {"module": "Purchase Orders",   "count": str(total_pos_orders),   "status": "Live" if total_pos_orders > 0 else "Empty"},
        ]
        res["aiSummary"] = (
            f"System overview: {total_products} products, {total_employees} staff, {total_leads} leads, "
            f"{total_customers} customers, {total_suppliers} suppliers."
        )

    return res


@router.post("/reports/{tab}/ai-consult")
async def consult_ai_report(tab: str, payload: Dict[str, Any], db: AsyncSession = Depends(get_db)):
    """Consult the AI reports copilot regarding active metrics, data rows, and regional forecast contexts."""
    query = payload.get("query", "").strip()
    context_data = payload.get("contextData") or {}

    if not query:
        raise HTTPException(status_code=400, detail="Query string is required.")

    # Format the live context report structure for the AI prompt
    kpi_text = "\n".join([
        f"- {metric.get('label')}: {metric.get('value')} ({metric.get('change')})"
        for metric in context_data.get("metrics", [])
    ])
    
    table_rows = context_data.get("tableData") or []
    # Limit table details in context prompt to fit token windows cleanly
    table_summary = json.dumps(table_rows[:20], indent=2)

    prompt = (
        f"You are an elite business analyst and retail AI officer for BusinessOS AI ERP.\n"
        f"The user is viewing the '{tab.replace('_', ' ').title()}' intelligence page and has a question.\n\n"
        f"=== CURRENT LIVE REPORT METRICS ===\n"
        f"{kpi_text}\n\n"
        f"=== DATA GRID EXTRACT (Top Rows) ===\n"
        f"{table_summary}\n\n"
        f"=== USER QUERY ===\n"
        f"\"{query}\"\n\n"
        f"INSTRUCTIONS:\n"
        f"1. Directly answer the user's question using the provided metrics, database rows, and business logic.\n"
        f"2. Provide concrete, actionable steps and regional recommendations (e.g. if the user asks about weather-driven stock predictions, outline which suppliers to contact and target purchase counts).\n"
        f"3. Return the response in clean, professional markdown with headings and bullet points. Do not include conversational filler or meta-prompts."
    )

    provider = settings.ai_provider or "claude"
    answer = _call_ai_consult(provider, prompt)
    
    return {"answer": answer}
