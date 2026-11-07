"""Auto-generated document / entry numbers based on NumberSeries config."""
import uuid
import datetime
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import NumberSeries, Company


async def _number_exists(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    candidate: str,
    is_receipt: bool,
    is_invoice: bool,
) -> int:
    """Check existence for a candidate document number (receipts or invoices)."""
    if is_receipt:
        from src.models import POSTransaction
        # pos_transactions.receipt_number has a UNIQUE constraint across the table.
        return await db.scalar(
            select(func.count()).select_from(POSTransaction).where(
                POSTransaction.receipt_number == candidate,
            )
        ) or 0
    if is_invoice:
        from src.models.erp import Invoice
        return await db.scalar(
            select(func.count()).select_from(Invoice).where(
                Invoice.tenant_id == tenant_id,
                Invoice.invoice_number == candidate,
            )
        ) or 0
    return 0


async def resolve_safe_next_sequence(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    module: str,
    prefix: str,
    requested_next: int = 1,
    padding: int = 4,
) -> tuple[int, str]:
    """Find the safe, non-colliding next sequence number and formatted string for a module & prefix."""
    import re
    clean_mod = module.lower()
    recent_rows: list[str] = []

    try:
        if "invoice" in clean_mod and "purchase" not in clean_mod:
            from src.models.erp import Invoice
            recent_rows = (await db.scalars(
                select(Invoice.invoice_number)
                .where(
                    Invoice.tenant_id == tenant_id,
                    Invoice.invoice_number.ilike(f"{prefix}%")
                )
                .order_by(Invoice.created_at.desc())
                .limit(200)
            )).all()
        elif "quot" in clean_mod:
            from src.models.erp import Invoice
            recent_rows = (await db.scalars(
                select(Invoice.invoice_number)
                .where(
                    Invoice.tenant_id == tenant_id,
                    Invoice.invoice_type.in_(["quotation", "quote"]),
                    Invoice.invoice_number.ilike(f"{prefix}%")
                )
                .order_by(Invoice.created_at.desc())
                .limit(200)
            )).all()
        elif "proforma" in clean_mod:
            from src.models.erp import Invoice
            recent_rows = (await db.scalars(
                select(Invoice.invoice_number)
                .where(
                    Invoice.tenant_id == tenant_id,
                    Invoice.invoice_type.in_(["proforma", "proforma_invoice"]),
                    Invoice.invoice_number.ilike(f"{prefix}%")
                )
                .order_by(Invoice.created_at.desc())
                .limit(200)
            )).all()
        elif "credit" in clean_mod:
            from src.models.erp import Invoice
            recent_rows = (await db.scalars(
                select(Invoice.invoice_number)
                .where(
                    Invoice.tenant_id == tenant_id,
                    Invoice.invoice_type.in_(["credit_note", "creditnote"]),
                    Invoice.invoice_number.ilike(f"{prefix}%")
                )
                .order_by(Invoice.created_at.desc())
                .limit(200)
            )).all()
        elif "debit" in clean_mod:
            from src.models.erp import Invoice
            recent_rows = (await db.scalars(
                select(Invoice.invoice_number)
                .where(
                    Invoice.tenant_id == tenant_id,
                    Invoice.invoice_type.in_(["debit_note", "debitnote"]),
                    Invoice.invoice_number.ilike(f"{prefix}%")
                )
                .order_by(Invoice.created_at.desc())
                .limit(200)
            )).all()
        elif "purchase_invoice" in clean_mod or "bill" in clean_mod:
            from src.models.procurement import VendorBill
            recent_rows = (await db.scalars(
                select(VendorBill.bill_number)
                .where(
                    VendorBill.tenant_id == tenant_id,
                    VendorBill.bill_number.ilike(f"{prefix}%")
                )
                .order_by(VendorBill.created_at.desc())
                .limit(200)
            )).all()
        elif "purchase_order" in clean_mod or "po" in clean_mod:
            from src.models.procurement import PurchaseOrder
            recent_rows = (await db.scalars(
                select(PurchaseOrder.po_number)
                .where(
                    PurchaseOrder.tenant_id == tenant_id,
                    PurchaseOrder.po_number.ilike(f"{prefix}%")
                )
                .order_by(PurchaseOrder.created_at.desc())
                .limit(200)
            )).all()
        elif "receipt" in clean_mod or "pos" in clean_mod:
            from src.models import POSTransaction
            recent_rows = (await db.scalars(
                select(POSTransaction.receipt_number)
                .where(
                    POSTransaction.receipt_number.ilike(f"{prefix}%")
                )
                .order_by(POSTransaction.created_at.desc())
                .limit(200)
            )).all()
    except Exception:
        recent_rows = []

    recent_val = 0
    if recent_rows:
        strict_pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$", re.IGNORECASE)
        strict_vals: list[int] = []
        for r_num in recent_rows:
            if not r_num:
                continue
            m = strict_pattern.match(str(r_num).strip())
            if m:
                try:
                    val = int(m.group(1))
                    if 0 < val < 100000000:
                        strict_vals.append(val)
                except ValueError:
                    pass
        if strict_vals:
            recent_val = max(strict_vals)
        else:
            # Fallback only if no rows match prefix + pure digits (e.g. legacy alphanumeric)
            for r_num in recent_rows[:10]:
                if not r_num:
                    continue
                suffix = str(r_num).strip()[len(prefix):]
                digits = re.findall(r'\d+', suffix)
                if digits:
                    try:
                        val = int(digits[-1])
                        if 0 < val < 100000000:
                            recent_val = max(recent_val, val)
                    except ValueError:
                        pass

    candidate_num = max(requested_next, recent_val + 1)

    # Collision loop: ensure candidate document number does not already exist
    is_receipt = "receipt" in clean_mod or "pos" in clean_mod
    is_invoice = "invoice" in clean_mod and "purchase" not in clean_mod

    for _ in range(500):
        cand_str = f"{prefix}{str(candidate_num).zfill(padding)}"
        exists = await _number_exists(db, tenant_id, cand_str, is_receipt, is_invoice)
        if not exists:
            return candidate_num, cand_str
        candidate_num += 1

    return candidate_num, f"{prefix}{str(candidate_num).zfill(padding)}"


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
    if clean in ["challan", "challans", "delivery_challan", "delivery_challans", "dc", "delivery_note"]:
        return ["delivery_challans", "delivery_challan", "challan", "challans", "Delivery Challan", "Delivery Challans", "dc"]
    if clean in ["credit_note", "credit_notes", "creditnote", "cn"]:
        return ["credit_notes", "credit_note", "Credit Note", "Credit Notes", "cn"]
    if clean in ["debit_note", "debit_notes", "debitnote", "dn"]:
        return ["debit_notes", "debit_note", "Debit Note", "Debit Notes", "dn"]
    if clean in ["purchase_order", "purchase_orders", "po"]:
        return ["purchase_orders", "purchase_order", "Purchase Order", "Purchase Orders", "po"]
    if clean in ["purchase_invoice", "purchase_invoices", "bill", "bills"]:
        return ["purchase_invoices", "purchase_invoice", "bills", "bill", "Purchase Invoice"]
    if clean in ["receipt", "receipts", "pos_receipt", "pos_receipts", "pos_transactions", "pos", "counter_receipt"]:
        return ["receipts", "receipt", "pos_receipts", "pos_receipt", "pos_transactions", "pos", "counter_receipt", "Receipts", "Receipt", "POS Receipt"]

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

    # 1. First try matching the exact company series
    series = None
    if valid_cid:
        series_company_query = (
            select(NumberSeries)
            .where(
                NumberSeries.tenant_id == tenant_id,
                NumberSeries.company_id == valid_cid,
                func.lower(NumberSeries.module_name).in_([a.lower() for a in aliases]),
                NumberSeries.status == "active",
            )
            .order_by(NumberSeries.updated_at.desc(), NumberSeries.created_at.desc())
            .with_for_update()
        )
        series = await db.scalar(series_company_query.limit(1))

    # 2. If no company-specific series found, search tenant-level active series
    if not series:
        series_tenant_query = (
            select(NumberSeries)
            .where(
                NumberSeries.tenant_id == tenant_id,
                func.lower(NumberSeries.module_name).in_([a.lower() for a in aliases]),
                NumberSeries.status == "active",
            )
            .order_by(NumberSeries.updated_at.desc(), NumberSeries.created_at.desc())
            .with_for_update()
        )
        series = await db.scalar(series_tenant_query.limit(1))

    if series:
        prefix = series.prefix or fallback_prefix or "INV-"
        padding = series.padding or 4
        safe_next, safe_str = await resolve_safe_next_sequence(
            db, tenant_id, module, prefix, requested_next=(series.current_number or 0) + 1, padding=padding
        )
        series.current_number = safe_next
        await db.flush()
        return safe_str

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
        elif "challan" in module.lower() or module.lower() == "dc":
            clean_prefix = "DC-"
        elif "purchase_invoice" in module.lower() or "bill" in module.lower():
            clean_prefix = "PINV-"
        elif "purchase_order" in module.lower() or module.lower() == "po":
            clean_prefix = "PO-"
        elif "purchase_request" in module.lower() or module.lower() == "pr":
            clean_prefix = "PR-"
        elif "receipt" in module.lower() or "pos" in module.lower():
            clean_prefix = "REC-"
        else:
            clean_prefix = "INV-"

    padding = 4 if "receipt" not in module.lower() else 5
    safe_next, safe_str = await resolve_safe_next_sequence(
        db, tenant_id, module, clean_prefix, requested_next=1, padding=padding
    )

    if valid_cid:
        try:
            async with db.begin_nested():
                new_series = NumberSeries(
                    tenant_id=tenant_id,
                    company_id=valid_cid,
                    module_name=aliases[0],
                    prefix=clean_prefix,
                    current_number=safe_next,
                    padding=padding,
                    status="active",
                )
                db.add(new_series)
                await db.flush()
                return safe_str
        except Exception:
            pass

    return safe_str


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

    series = None
    if valid_cid:
        series = await db.scalar(
            select(NumberSeries)
            .where(
                NumberSeries.tenant_id == tenant_id,
                NumberSeries.company_id == valid_cid,
                func.lower(NumberSeries.module_name).in_([a.lower() for a in aliases]),
                NumberSeries.status == "active",
            )
            .order_by(NumberSeries.updated_at.desc(), NumberSeries.created_at.desc())
            .limit(1)
        )

    if not series:
        series = await db.scalar(
            select(NumberSeries)
            .where(
                NumberSeries.tenant_id == tenant_id,
                func.lower(NumberSeries.module_name).in_([a.lower() for a in aliases]),
                NumberSeries.status == "active",
            )
            .order_by(NumberSeries.updated_at.desc(), NumberSeries.created_at.desc())
            .limit(1)
        )

    if series:
        prefix = series.prefix or fallback_prefix or "INV-"
        padding = series.padding or 4
        safe_next, formatted = await resolve_safe_next_sequence(
            db, tenant_id, module, prefix, requested_next=(series.current_number or 0) + 1, padding=padding
        )
        return {
            "series_id": str(series.id),
            "module_name": series.module_name,
            "prefix": prefix,
            "current_number": safe_next - 1,
            "next_number": safe_next,
            "padding": padding,
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
        elif "challan" in module.lower() or module.lower() == "dc":
            clean_prefix = "DC-"
        elif "purchase_invoice" in module.lower() or "bill" in module.lower():
            clean_prefix = "PINV-"
        elif "purchase_order" in module.lower() or module.lower() == "po":
            clean_prefix = "PO-"
        elif "purchase_request" in module.lower() or module.lower() == "pr":
            clean_prefix = "PR-"
        elif "receipt" in module.lower() or "pos" in module.lower():
            clean_prefix = "REC-"
        else:
            clean_prefix = "INV-"

    default_pad = 5 if ("receipt" in module.lower() or "pos" in module.lower()) else 4
    safe_next, formatted = await resolve_safe_next_sequence(
        db, tenant_id, module, clean_prefix, requested_next=1, padding=default_pad
    )
    return {
        "series_id": None,
        "module_name": module,
        "prefix": clean_prefix,
        "current_number": safe_next - 1,
        "next_number": safe_next,
        "padding": default_pad,
        "formatted_number": formatted,
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
    canonical_mod = aliases[0]
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

    all_series = (await db.execute(query)).scalars().all()
    last_digits_str = digits[-1]
    last_idx = document_number.rfind(last_digits_str)
    detected_prefix = document_number[:last_idx] if last_idx > 0 else None

    # Guard: if detected_prefix contains timestamped/random patterns (e.g. REC-031497-), do NOT overwrite
    if detected_prefix and re.search(r'\d{4,}[-_]', detected_prefix):
        return
    if num_val >= 100000000:
        return

    if all_series:
        for series in all_series:
            series.current_number = max(series.current_number or 0, num_val)
            if detected_prefix:
                series.prefix = detected_prefix
            if len(last_digits_str) > 1:
                series.padding = len(last_digits_str)
        try:
            async with db.begin_nested():
                await db.flush()
        except Exception:
            pass
    elif valid_cid:
        detected_pfx = detected_prefix or "INV-"
        detected_padding = len(last_digits_str) if (len(last_digits_str) > 1 and num_val < 50000) else 4
        clean_initial_num = num_val
        try:
            async with db.begin_nested():
                new_series = NumberSeries(
                    tenant_id=tenant_id,
                    company_id=valid_cid,
                    module_name=canonical_mod,
                    prefix=detected_pfx,
                    current_number=clean_initial_num,
                    padding=detected_padding,
                    status="active",
                )
                db.add(new_series)
                await db.flush()
        except Exception:
            pass

    # Dynamically advance Tenant.settings canonical_sequences so getSyncState reflects it for all users
    try:
        from src.models import Tenant
        from sqlalchemy.orm.attributes import flag_modified
        import copy
        tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
        if tenant:
            t_settings = copy.deepcopy(tenant.settings or {})
            canon = copy.deepcopy(t_settings.get("canonical_sequences") or {})
            cur_next = int(canon.get(canonical_mod, {}).get("next_number") or 1)
            canon[canonical_mod] = {
                "prefix": detected_prefix or canon.get(canonical_mod, {}).get("prefix") or "INV-",
                "next_number": max(cur_next, num_val + 1),
                "padding": len(last_digits_str) if len(last_digits_str) > 1 else canon.get(canonical_mod, {}).get("padding", 4),
            }
            t_settings["canonical_sequences"] = canon
            tenant.settings = t_settings
            flag_modified(tenant, "settings")
            await db.flush()
    except Exception:
        pass


async def hard_reset_module_series(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    module: str,
    prefix: str | None = None,
    current_number: int | None = None,
    padding: int | None = None,
    company_id: uuid.UUID | str | None = None,
) -> int:
    """Unconditionally hard-reset all NumberSeries rows for *module* across the tenant and bump sequence_reset_epoch."""
    import copy
    from sqlalchemy.orm.attributes import flag_modified
    from src.models import Tenant

    aliases = get_module_aliases(module)
    canonical_mod = aliases[0]
    valid_cid = await resolve_valid_company_id(db, tenant_id, company_id)

    all_rows = (
        await db.execute(
            select(NumberSeries).where(
                NumberSeries.tenant_id == tenant_id,
                func.lower(NumberSeries.module_name).in_([a.lower() for a in aliases]),
            )
        )
    ).scalars().all()

    final_prefix = prefix
    final_cur = current_number
    final_pad = padding

    if all_rows:
        for row in all_rows:
            if prefix is not None and str(prefix).strip() != "":
                row.prefix = str(prefix).strip()
            if current_number is not None:
                row.current_number = max(0, int(current_number))
            if padding is not None and int(padding) > 0:
                row.padding = int(padding)
            row.status = "active"
            final_prefix = final_prefix or row.prefix
            if final_cur is None:
                final_cur = row.current_number
            if final_pad is None:
                final_pad = row.padding
    elif valid_cid:
        default_pfx = prefix or ("PINV-" if "purchase_invoice" in canonical_mod else "PO-" if "purchase_order" in canonical_mod else "INV-")
        default_cur = max(0, int(current_number)) if current_number is not None else 0
        default_pad = int(padding) if (padding is not None and int(padding) > 0) else (5 if "receipt" in canonical_mod else 4)
        new_ns = NumberSeries(
            tenant_id=tenant_id,
            company_id=valid_cid,
            module_name=canonical_mod,
            prefix=default_pfx,
            current_number=default_cur,
            padding=default_pad,
            status="active",
        )
        db.add(new_ns)
        final_prefix = default_pfx
        final_cur = default_cur
        final_pad = default_pad

    epoch = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
    tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if tenant:
        t_settings = copy.deepcopy(tenant.settings or {})
        t_settings["sequence_reset_epoch"] = epoch
        canon_map = copy.deepcopy(t_settings.get("canonical_sequences") or {})
        prev_entry = canon_map.get(canonical_mod) or {}
        canon_map[canonical_mod] = {
            "prefix": final_prefix if final_prefix is not None else prev_entry.get("prefix", "INV-"),
            "next_number": (int(final_cur) + 1) if final_cur is not None else prev_entry.get("next_number", 1),
            "padding": int(final_pad) if final_pad is not None else prev_entry.get("padding", 4),
            "reset_epoch": epoch,
        }
        t_settings["canonical_sequences"] = canon_map

        # If purchase_invoices was reset, also keep purchase_invoice_settings in Tenant.settings unified
        if canonical_mod == "purchase_invoices":
            p_settings = copy.deepcopy(t_settings.get("purchase_invoice_settings") or {})
            if final_prefix:
                p_settings["prefix"] = final_prefix
            if final_cur is not None:
                p_settings["sequenceNumber"] = int(final_cur) + 1
            if final_pad is not None:
                p_settings["padding"] = int(final_pad)
            if isinstance(p_settings.get("companies"), dict):
                for cid_key, comp_cfg in p_settings["companies"].items():
                    if isinstance(comp_cfg, dict):
                        if final_prefix:
                            comp_cfg["prefix"] = final_prefix
                        if final_cur is not None:
                            comp_cfg["sequenceNumber"] = int(final_cur) + 1
                        if final_pad is not None:
                            comp_cfg["padding"] = int(final_pad)
            t_settings["purchase_invoice_settings"] = p_settings

        tenant.settings = t_settings
        flag_modified(tenant, "settings")

    await db.flush()
    return epoch


async def get_tenant_canonical_sequences(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID | str | None = None,
) -> dict:
    """Return the organization-wide authoritative sequence state and reset epoch for all modules."""
    from src.models import Tenant

    tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    t_settings = (tenant.settings or {}) if tenant else {}
    epoch = int(t_settings.get("sequence_reset_epoch") or 0)
    canon_map = t_settings.get("canonical_sequences") or {}

    rows = (
        await db.execute(
            select(NumberSeries)
            .where(
                NumberSeries.tenant_id == tenant_id,
                NumberSeries.status == "active",
            )
            .order_by(NumberSeries.updated_at.asc(), NumberSeries.created_at.asc())
        )
    ).scalars().all()

    series_out: dict[str, dict] = {}
    for r in rows:
        aliases = get_module_aliases(r.module_name or "")
        c_mod = aliases[0]
        series_out[c_mod] = {
            "prefix": r.prefix,
            "next_number": int(r.current_number or 0) + 1,
            "padding": int(r.padding or 4),
        }

    # Overlay explicit canonical_sequences entries saved via hard_reset_module_series
    if isinstance(canon_map, dict):
        for c_mod, cfg in canon_map.items():
            if isinstance(cfg, dict):
                series_out[c_mod] = {
                    "prefix": cfg.get("prefix") or series_out.get(c_mod, {}).get("prefix") or "INV-",
                    "next_number": max(
                        int(series_out.get(c_mod, {}).get("next_number") or 1),
                        int(cfg.get("next_number") or 1)
                    ),
                    "padding": int(cfg.get("padding") or series_out.get(c_mod, {}).get("padding") or 4),
                }

    # Ensure default core modules exist in series_out
    core_modules = [
        ("invoices", "INV-", 4),
        ("quotations", "QT-", 4),
        ("proforma", "PI-", 4),
        ("delivery_challans", "DC-", 4),
        ("estimates", "EST-", 4),
        ("credit_notes", "CN-", 4),
        ("debit_notes", "DN-", 4),
        ("purchase_invoices", "PINV-", 4),
        ("purchase_orders", "PO-", 4),
        ("receipts", "REC-", 5),
    ]
    for c_mod, def_pfx, def_pad in core_modules:
        if c_mod not in series_out:
            series_out[c_mod] = {
                "prefix": def_pfx,
                "next_number": 1,
                "padding": def_pad,
            }

    # Ensure next_number is strictly non-colliding and safely advances past any existing database documents
    for c_mod in list(series_out.keys()):
        cfg = series_out[c_mod]
        pfx = cfg.get("prefix") or "INV-"
        req_next = int(cfg.get("next_number") or 1)
        pad = int(cfg.get("padding") or 4)

        safe_next, safe_str = await resolve_safe_next_sequence(
            db, tenant_id, c_mod, pfx, requested_next=req_next, padding=pad
        )
        series_out[c_mod]["next_number"] = safe_next

        # Auto-heal NumberSeries in database if it was lagging behind
        for r in rows:
            if get_module_aliases(r.module_name or "")[0] == c_mod and (r.current_number or 0) < (safe_next - 1):
                r.current_number = safe_next - 1
                try:
                    await db.flush()
                except Exception:
                    pass

    return {
        "sequence_reset_epoch": epoch,
        "series": series_out,
    }

