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


async def resolve_valid_company_id(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID | str | None = None,
    auto_create_if_missing: bool = True,
) -> uuid.UUID | None:
    """Ensure company_id actually exists in 'companies' table for this tenant, resolving or creating as needed."""
    parsed_cid = None
    if company_id:
        try:
            parsed_cid = uuid.UUID(str(company_id))
        except Exception:
            parsed_cid = None

    if parsed_cid:
        exists = await db.scalar(
            select(Company.id).where(Company.id == parsed_cid, Company.tenant_id == tenant_id)
        )
        if exists:
            return exists

    # Check for any existing company under this tenant
    first_comp = await db.scalar(
        select(Company.id)
        .where(Company.tenant_id == tenant_id)
        .order_by(Company.created_at.asc())
        .limit(1)
    )
    if first_comp:
        return first_comp

    if auto_create_if_missing:
        try:
            async with db.begin_nested():
                new_comp = Company(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    name="Main Organization",
                    legal_name="Main Organization",
                    country="India",
                    default_currency_code="INR",
                )
                db.add(new_comp)
                await db.flush()
                return new_comp.id
        except Exception:
            return await db.scalar(
                select(Company.id)
                .where(Company.tenant_id == tenant_id)
                .order_by(Company.created_at.asc())
                .limit(1)
            )

    return None


async def generate_number(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    module: str,
    company_id: uuid.UUID | str | None = None,
    fallback_prefix: str = "",
) -> str:
    """Return the next incremented number for *module* / *company_id*, strictly in sequential order."""
    aliases = get_module_aliases(module)
    valid_cid = await resolve_valid_company_id(db, tenant_id, company_id)

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
    if valid_cid:
        query = query.where(NumberSeries.company_id == valid_cid)

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
    if valid_cid:
        try:
            async with db.begin_nested():
                new_series = NumberSeries(
                    tenant_id=tenant_id,
                    company_id=valid_cid,
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
    company_id: uuid.UUID | str | None = None,
    fallback_prefix: str = "",
) -> dict:
    """Return the preview of the next number and series configuration without incrementing."""
    aliases = get_module_aliases(module)
    valid_cid = await resolve_valid_company_id(db, tenant_id, company_id, auto_create_if_missing=False)

    query = (
        select(NumberSeries)
        .where(
            NumberSeries.tenant_id == tenant_id,
            func.lower(NumberSeries.module_name).in_([a.lower() for a in aliases]),
            NumberSeries.status == "active",
        )
        .order_by(NumberSeries.created_at.asc())
    )
    if valid_cid:
        query = query.where(NumberSeries.company_id == valid_cid)

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


async def sync_series_from_document_number(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    module: str,
    document_number: str,
    company_id: uuid.UUID | str | None = None,
) -> None:
    """If a document was saved with an explicit number, ensure NumberSeries.current_number is at least that value."""
    if not document_number or not document_number.strip():
        return
    import re
    digits = re.findall(r'\d+', document_number)
    if not digits:
        return
    try:
        num_val = int(digits[-1])
        if num_val <= 0:
            return
    except Exception:
        return

    aliases = get_module_aliases(module)
    valid_cid = await resolve_valid_company_id(db, tenant_id, company_id)

    query = (
        select(NumberSeries)
        .where(
            NumberSeries.tenant_id == tenant_id,
            func.lower(NumberSeries.module_name).in_([a.lower() for a in aliases]),
            NumberSeries.status == "active",
        )
    )
    if valid_cid:
        query = query.where(NumberSeries.company_id == valid_cid)

    series = await db.scalar(query.limit(1))
    if series:
        if series.current_number >= 50000 and num_val < 50000:
            # Self-heal poisoned series caused by legacy epoch timestamp fallbacks
            series.current_number = num_val
        elif num_val < 50000 and num_val > series.current_number:
            series.current_number = num_val
        elif num_val >= 50000:
            # Ignore random legacy timestamps from updating sequence counter
            pass

        last_digits_str = digits[-1]
        last_idx = document_number.rfind(last_digits_str)
        if last_idx > 0:
            detected_prefix = document_number[:last_idx]
            if detected_prefix:
                series.prefix = detected_prefix
            if len(last_digits_str) > 1 and num_val < 50000:
                series.padding = len(last_digits_str)
        try:
            async with db.begin_nested():
                await db.flush()
        except Exception:
            pass
    elif valid_cid:
        last_digits_str = digits[-1]
        last_idx = document_number.rfind(last_digits_str)
        detected_prefix = document_number[:last_idx] if last_idx > 0 else "INV-"
        detected_padding = len(last_digits_str) if (len(last_digits_str) > 1 and num_val < 50000) else 4
        clean_initial_num = num_val if num_val < 50000 else 1
        try:
            async with db.begin_nested():
                new_series = NumberSeries(
                    tenant_id=tenant_id,
                    company_id=valid_cid,
                    module_name=aliases[0],
                    prefix=detected_prefix,
                    current_number=clean_initial_num,
                    padding=detected_padding,
                    status="active",
                )
                db.add(new_series)
                await db.flush()
        except Exception:
            pass
