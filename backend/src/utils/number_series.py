"""Auto-generated document / entry numbers based on NumberSeries config."""
import uuid
import datetime
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import NumberSeries, Company


def get_module_aliases(module: str) -> list[str]:
    """Map common module synonyms so 'invoice', 'invoices', 'tax_invoice' all match."""
    clean = module.strip().lower().replace("-", "_").replace(" ", "_")
    
    if clean in ["invoice", "invoices", "tax_invoice", "tax_invoices", "sales_invoice", "sales_invoices"]:
        return ["invoices", "invoice", "tax_invoice", "tax invoice", "sales invoice", "sales_invoice", "Invoice", "Invoices", "Tax Invoice"]
    if clean in ["quotation", "quotations", "quote", "quotes", "sales_quotation"]:
        return ["quotations", "quotation", "quote", "sales quotation", "sales_quotation", "Quotations", "Quotation"]
    if clean in ["estimate", "estimates", "estimate_non_gst", "non_gst"]:
        return ["estimates", "estimate", "estimate_non_gst", "non_gst", "Estimates", "Estimate"]
    if clean in ["proforma", "proforma_invoice", "proforma_invoices"]:
        return ["proforma", "proforma_invoice", "proforma invoices", "Proforma", "Proforma Invoice"]
    if clean in ["credit_note", "credit_notes", "creditnote", "cn"]:
        return ["credit_notes", "credit_note", "Credit Note", "Credit Notes", "cn"]
    if clean in ["debit_note", "debit_notes", "debitnote", "dn"]:
        return ["debit_notes", "debit_note", "Debit Note", "Debit Notes", "dn"]
    if clean in ["purchase_order", "purchase_orders", "po"]:
        return ["purchase_orders", "purchase_order", "Purchase Order", "Purchase Orders", "po"]
    if clean in ["purchase_invoice", "purchase_invoices", "bill", "bills"]:
        return ["purchase_invoices", "purchase_invoice", "bills", "bill", "Purchase Invoice"]

    return [module, clean, clean.replace("_", " "), clean.title()]


async def generate_number(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    module: str,
    company_id: uuid.UUID | None = None,
    fallback_prefix: str = "",
) -> str:
    """Return the next incremented number for *module* / *company_id*, strictly in sequential order."""
    aliases = get_module_aliases(module)

    # If company_id is not provided, resolve primary company for tenant
    if not company_id:
        comp = await db.scalar(
            select(Company.id)
            .where(Company.tenant_id == tenant_id)
            .order_by(Company.created_at.asc())
            .limit(1)
        )
        if comp:
            company_id = comp

    query = (
        select(NumberSeries)
        .where(
            NumberSeries.tenant_id == tenant_id,
            func.lower(NumberSeries.module_name).in_([a.lower() for a in aliases]),
            NumberSeries.status == "active",
        )
        .order_by(NumberSeries.created_at.asc())
        .with_for_update()
    )
    if company_id:
        query = query.where(NumberSeries.company_id == company_id)

    series = await db.scalar(query.limit(1))

    if series:
        series.current_number += 1
        prefix = series.prefix or fallback_prefix or "INV-"
        return f"{prefix}{str(series.current_number).zfill(series.padding)}"

    # Determine standard prefix
    clean_prefix = fallback_prefix
    if not clean_prefix:
        if "credit" in module.lower():
            clean_prefix = "CN-"
        elif "debit" in module.lower():
            clean_prefix = "DN-"
        elif "quot" in module.lower():
            clean_prefix = "QT-"
        elif "est" in module.lower():
            clean_prefix = "EST-"
        elif "prof" in module.lower():
            clean_prefix = "PI-"
        else:
            clean_prefix = "INV-"

    # If no number series found, auto-initialize a NumberSeries record for this org/module starting at 1
    if company_id:
        try:
            new_series = NumberSeries(
                tenant_id=tenant_id,
                company_id=company_id,
                module_name=aliases[0],
                prefix=clean_prefix,
                current_number=1,
                padding=5,
                status="active",
            )
            db.add(new_series)
            await db.flush()
            return f"{clean_prefix}{str(1).zfill(5)}"
        except Exception:
            pass

    return f"{clean_prefix}{str(1).zfill(5)}"


async def peek_next_number(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    module: str,
    company_id: uuid.UUID | None = None,
    fallback_prefix: str = "",
) -> dict:
    """Return the preview of the next number and series configuration without incrementing."""
    aliases = get_module_aliases(module)

    if not company_id:
        comp = await db.scalar(
            select(Company.id)
            .where(Company.tenant_id == tenant_id)
            .order_by(Company.created_at.asc())
            .limit(1)
        )
        if comp:
            company_id = comp

    query = (
        select(NumberSeries)
        .where(
            NumberSeries.tenant_id == tenant_id,
            func.lower(NumberSeries.module_name).in_([a.lower() for a in aliases]),
            NumberSeries.status == "active",
        )
        .order_by(NumberSeries.created_at.asc())
    )
    if company_id:
        query = query.where(NumberSeries.company_id == company_id)

    series = await db.scalar(query.limit(1))

    if series:
        next_val = series.current_number + 1
        prefix = series.prefix or fallback_prefix or "INV-"
        formatted = f"{prefix}{str(next_val).zfill(series.padding)}"
        return {
            "series_id": str(series.id),
            "module_name": series.module_name,
            "prefix": series.prefix,
            "current_number": series.current_number,
            "next_number": next_val,
            "padding": series.padding,
            "formatted_number": formatted,
            "configured": True,
        }

    clean_prefix = fallback_prefix
    if not clean_prefix:
        if "credit" in module.lower():
            clean_prefix = "CN-"
        elif "debit" in module.lower():
            clean_prefix = "DN-"
        elif "quot" in module.lower():
            clean_prefix = "QT-"
        elif "est" in module.lower():
            clean_prefix = "EST-"
        elif "prof" in module.lower():
            clean_prefix = "PI-"
        else:
            clean_prefix = "INV-"

    return {
        "series_id": None,
        "module_name": module,
        "prefix": clean_prefix,
        "current_number": 0,
        "next_number": 1,
        "padding": 5,
        "formatted_number": f"{clean_prefix}{str(1).zfill(5)}",
        "configured": False,
    }
