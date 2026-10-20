"""Sales Returns & Exchanges — Full CRUD with inventory restock."""
import logging
import uuid
from datetime import date, datetime
from typing import Annotated, Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy import func, select, or_, and_, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission, get_current_user_context
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import Customer, Product
from src.models.inventory import InventoryBatch, InventoryTransaction, TraceabilityEvent
from src.models.erp import Invoice, InvoiceLine, InvoiceReturn, InvoiceReturnLine, InvoicePayment
from src.utils.pagination import PaginatedResponse, paginate
from src.api.v1.erp.invoices import _bg_send_invoice_whatsapp, _bg_send_invoice_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sales-returns", tags=["Sales Returns & Exchanges"])


# ─── Schemas ────────────────────────────────────────────────────────────


class SalesReturnLineCreate(BaseModel):
    product_id: Optional[str] = None
    product_name: str
    sku: Optional[str] = None
    hsn_code: Optional[str] = None
    batch_number: Optional[str] = None
    quantity: float = Field(gt=0, description="Quantity being returned")
    unit_price: float = 0
    tax_rate: float = 0
    tax_amount: float = 0
    discount_amount: float = 0
    line_total: float = 0
    reason: str = "Customer Return"
    disposition: str = "restock"  # restock | damaged | inspection


class SalesReturnCreate(BaseModel):
    original_invoice_id: Optional[str] = None
    original_invoice_number: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_id: Optional[str] = None
    return_date: Optional[str] = None
    settlement_method: str = "cash"  # cash | upi | store_credit | credit_note | exchange
    reason: Optional[str] = None
    notes: Optional[str] = None
    items: List[SalesReturnLineCreate] = []


class ExchangeItemCreate(BaseModel):
    product_id: Optional[str] = None
    product_name: str
    quantity: float = Field(gt=0)
    unit_price: float = 0
    tax_rate: float = 0
    discount_amount: float = 0


class ExchangeCreate(BaseModel):
    original_invoice_id: Optional[str] = None
    original_invoice_number: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_id: Optional[str] = None
    return_items: List[SalesReturnLineCreate] = []
    exchange_items: List[ExchangeItemCreate] = []
    settlement_method: str = "cash"  # How to handle difference
    reason: Optional[str] = None
    notes: Optional[str] = None


class SalesReturnLineResponse(BaseModel):
    id: str
    product_id: Optional[str] = None
    product_name: str
    quantity: float
    unit_price: float
    line_total: float
    tax_amount: float

    class Config:
        from_attributes = True


class SalesReturnResponse(BaseModel):
    id: str
    return_number: str
    return_date: str
    original_invoice_number: Optional[str] = None
    customer_name: Optional[str] = None
    settlement_method: Optional[str] = None
    reason: Optional[str] = None
    total_amount: float
    status: str
    restocked_count: int = 0
    items: List[SalesReturnLineResponse] = []
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Helpers ────────────────────────────────────────────────────────────


async def _lookup_original_invoice(
    db: AsyncSession, tenant_id: uuid.UUID, invoice_id: str | None, invoice_number: str | None, company_id: uuid.UUID | None = None
) -> Invoice | None:
    """Find the original invoice by ID, ERP invoice number, or POS receipt reference number within workspace scope."""
    search_terms: list[str] = []
    if invoice_number and invoice_number.strip():
        search_terms.append(invoice_number.strip())
    if invoice_id and str(invoice_id).strip() and str(invoice_id).strip() not in search_terms:
        search_terms.append(str(invoice_id).strip())

    if not search_terms:
        return None

    # 1. First search by UUID if any term is a valid UUID
    for term in search_terms:
        try:
            inv_uuid = uuid.UUID(term)
            query = (
                select(Invoice)
                .options(selectinload(Invoice.lines))
                .where(Invoice.id == inv_uuid, Invoice.tenant_id == tenant_id)
            )
            if company_id:
                query = query.where(or_(Invoice.company_id == company_id, Invoice.company_id.is_(None)))
            inv = await db.scalar(query)
            if inv:
                return inv
        except (ValueError, AttributeError):
            pass

    # 2. Search Invoice by invoice_number OR reference_number (which stores REC-... counter receipt)
    for term in search_terms:
        query = (
            select(Invoice)
            .options(selectinload(Invoice.lines))
            .where(
                or_(
                    Invoice.invoice_number.ilike(term),
                    Invoice.reference_number.ilike(term),
                    Invoice.notes.ilike(f"%{term}%"),
                ),
                Invoice.tenant_id == tenant_id,
            )
        )
        if company_id:
            query = query.where(or_(Invoice.company_id == company_id, Invoice.company_id.is_(None)))
        inv = await db.scalar(query)
        if inv:
            return inv

    # 3. If term is a POS Receipt number (e.g. REC-...), check POSTransaction and its linked ERP invoice
    from src.models import POSTransaction
    for term in search_terms:
        try:
            pos_stmt = select(POSTransaction).where(
                or_(
                    POSTransaction.receipt_number.ilike(term),
                    POSTransaction.id == uuid.UUID(term) if len(term) == 36 else False,
                ),
                POSTransaction.tenant_id == tenant_id,
            )
            if company_id:
                pos_stmt = pos_stmt.where(or_(POSTransaction.company_id == company_id, POSTransaction.company_id.is_(None)))
            pos_tx = await db.scalar(pos_stmt)
            if pos_tx and pos_tx.receipt_number:
                linked_stmt = (
                    select(Invoice)
                    .options(selectinload(Invoice.lines))
                    .where(
                        or_(
                            Invoice.reference_number.ilike(pos_tx.receipt_number),
                            Invoice.notes.ilike(f"%{pos_tx.receipt_number}%"),
                        ),
                        Invoice.tenant_id == tenant_id,
                    )
                )
                if company_id:
                    linked_stmt = linked_stmt.where(or_(Invoice.company_id == company_id, Invoice.company_id.is_(None)))
                linked_inv = await db.scalar(linked_stmt)
                if linked_inv:
                    return linked_inv
        except Exception:
            pass

    return None


async def _restock_product(
    db: AsyncSession, tenant_id: uuid.UUID, product_id: uuid.UUID | None,
    product_name: str, sku: str | None, batch_number: str | None,
    qty: float, user_id: uuid.UUID | None, reference: str,
    company_id: uuid.UUID | None, disposition: str = "restock"
) -> bool:
    """Restock a single product into inventory. Returns True if restocked."""
    if disposition != "restock":
        return False

    prod = None
    if product_id:
        try:
            pid = uuid.UUID(str(product_id)) if isinstance(product_id, str) else product_id
            query = select(Product).where(Product.id == pid, Product.tenant_id == tenant_id).with_for_update()
            if company_id:
                query = query.where(or_(Product.company_id == company_id, Product.company_id.is_(None)))
            prod = await db.scalar(query)
        except Exception:
            pass

    if not prod and sku:
        query = select(Product).where(
            (Product.sku == sku) | (Product.barcode == sku),
            Product.tenant_id == tenant_id
        ).with_for_update()
        if company_id:
            query = query.where(or_(Product.company_id == company_id, Product.company_id.is_(None)))
        prod = await db.scalar(query)

    if not prod and product_name:
        query = select(Product).where(
            Product.name.ilike(product_name.strip()),
            Product.tenant_id == tenant_id
        ).with_for_update()
        if company_id:
            query = query.where(or_(Product.company_id == company_id, Product.company_id.is_(None)))
        prod = await db.scalar(query)

    if not prod:
        return False

    # Restore stock
    current_stk = prod.initial_stock if prod.initial_stock is not None else 0
    current_on_hand = prod.on_hand_stock if prod.on_hand_stock is not None else current_stk
    new_stk = int(current_stk + qty)
    new_on_hand = int(current_on_hand + qty)
    prod.initial_stock = new_stk
    prod.on_hand_stock = new_on_hand

    # Audit trail
    try:
        inv_tx = InventoryTransaction(
            tenant_id=tenant_id,
            product_id=prod.id,
            transaction_type="RETURN_RESTOCK",
            quantity=int(qty),
            before_on_hand=int(current_on_hand),
            after_on_hand=new_on_hand,
            before_reserved=int(prod.reserved_stock or 0),
            after_reserved=int(prod.reserved_stock or 0),
            reference_type="RETURN",
            reference_id=reference,
            user_id=user_id,
            notes=f"Sales return restock: +{int(qty)} units ({reference})",
        )
        db.add(inv_tx)
    except Exception as e:
        logger.warning(f"Return restock InventoryTransaction error: {e}")

    # Batch restock
    if batch_number:
        b_match = await db.scalar(
            select(InventoryBatch).where(
                InventoryBatch.batch_number == batch_number,
                InventoryBatch.product_id == prod.id,
                InventoryBatch.tenant_id == tenant_id
            ).with_for_update()
        )
        if b_match:
            b_match.remaining_quantity = int((b_match.remaining_quantity or 0) + qty)

            try:
                ev = TraceabilityEvent(
                    event_type="returned",
                    batch_id=b_match.id,
                    destination_location="Inventory — Sales Return Restock",
                    party_type="customer",
                    party_name="Sales Return",
                    reference_document=reference,
                    quantity=int(qty),
                    unit=b_match.uom or "Pcs",
                    notes=f"Sales return restock (Batch #{b_match.batch_number}) — {reference}",
                    event_at=datetime.utcnow(),
                    actor_user_id=user_id,
                    tenant_id=tenant_id,
                    company_id=company_id,
                )
                db.add(ev)
            except Exception as e:
                logger.warning(f"Return restock TraceabilityEvent error: {e}")

    return True


# ─── Endpoints ──────────────────────────────────────────────────────────


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_sales_return(
    payload: SalesReturnCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new Sales Return — restocks inventory and generates a Credit Note."""
    # Resolve active company / workspace
    from src.utils.number_series import generate_number, resolve_valid_company_id
    active_cid = await resolve_valid_company_id(db, ctx.tenant_id, ctx.active_company_id)

    # Lookup the original invoice (scoped to active company if set)
    original_invoice = await _lookup_original_invoice(
        db, ctx.tenant_id, payload.original_invoice_id, payload.original_invoice_number, company_id=active_cid
    )

    if not payload.items:
        raise HTTPException(status_code=400, detail="At least one return item is required.")

    # Determine customer info with complete contact details
    customer_name = payload.customer_name
    customer_phone = payload.customer_phone
    inv_number = payload.original_invoice_number or ""
    if original_invoice:
        customer_name = customer_name or original_invoice.customer_name or "Walk-in Customer"
        customer_phone = customer_phone or original_invoice.customer_phone
        inv_number = original_invoice.invoice_number

    cust_phone = (customer_phone or (original_invoice.customer_phone if original_invoice else None) or "").strip()
    cust_email = (original_invoice.customer_email if original_invoice else None)
    cust_gst = (original_invoice.customer_gstin if original_invoice else None)
    cust_billing_addr = (original_invoice.billing_address if original_invoice else None)
    cust_shipping_addr = (original_invoice.shipping_address if original_invoice else None)

    if payload.customer_id:
        try:
            cid_uuid = uuid.UUID(str(payload.customer_id))
            crm_cust = await db.scalar(select(Customer).where(Customer.id == cid_uuid))
            if crm_cust:
                if not cust_phone and crm_cust.phone:
                    cust_phone = crm_cust.phone.strip()
                if not cust_email and crm_cust.email:
                    cust_email = crm_cust.email.strip()
                if not cust_gst and getattr(crm_cust, "gst_number", None):
                    cust_gst = crm_cust.gst_number
                if not cust_billing_addr and getattr(crm_cust, "address", None):
                    cust_billing_addr = crm_cust.address
        except Exception:
            pass

    # Generate return number
    try:
        return_number = await generate_number(db, ctx.tenant_id, "sales_returns", active_cid, fallback_prefix="SR-")
    except Exception:
        count_q = select(func.count(InvoiceReturn.id)).where(InvoiceReturn.tenant_id == ctx.tenant_id)
        if active_cid:
            count_q = count_q.where(InvoiceReturn.company_id == active_cid)
        count = await db.scalar(count_q) or 0
        return_number = f"SR-{count + 1:05d}"

    # Parse return date
    return_date_val = date.today()
    if payload.return_date:
        try:
            return_date_val = date.fromisoformat(payload.return_date[:10])
        except Exception:
            pass

    # Calculate totals
    total_return_amount = 0.0
    restocked_count = 0

    # Create the InvoiceReturn record with company_id for workspace isolation
    return_company_id = active_cid or (original_invoice.company_id if original_invoice else None)
    invoice_return = InvoiceReturn(
        tenant_id=ctx.tenant_id,
        company_id=return_company_id,
        invoice_id=original_invoice.id if original_invoice else None,
        return_number=return_number,
        return_date=return_date_val,
        reason=payload.reason or "Customer Return",
        total_amount=0,
        status="processed",
    )
    # If no original invoice, we need to handle the FK — set it to None if nullable, otherwise raise
    if not original_invoice:
        # Check if invoice_id is nullable
        try:
            invoice_return.invoice_id = None
        except Exception:
            raise HTTPException(status_code=400, detail="Original invoice is required for sales returns.")

    db.add(invoice_return)
    await db.flush()

    for item in payload.items:
        line_total = float(item.line_total or (item.quantity * item.unit_price - item.discount_amount))
        tax_amount = float(item.tax_amount or (line_total * item.tax_rate / 100.0 if item.tax_rate else 0))
        total_return_amount += line_total

        product_id_val = None
        if item.product_id:
            try:
                product_id_val = uuid.UUID(str(item.product_id))
            except Exception:
                pass

        return_line = InvoiceReturnLine(
            invoice_return_id=invoice_return.id,
            product_id=product_id_val,
            product_name=item.product_name,
            quantity=item.quantity,
            unit_price=item.unit_price,
            line_total=round(line_total, 2),
            tax_amount=round(tax_amount, 2),
        )
        db.add(return_line)

        # Restock inventory for items marked as "restock"
        if item.disposition == "restock":
            restocked = await _restock_product(
                db=db,
                tenant_id=ctx.tenant_id,
                product_id=product_id_val,
                product_name=item.product_name,
                sku=item.sku,
                batch_number=item.batch_number,
                qty=item.quantity,
                user_id=ctx.user.id if hasattr(ctx, "user") and ctx.user else None,
                reference=f"SR-{return_number}",
                company_id=active_cid,
                disposition=item.disposition,
            )
            if restocked:
                restocked_count += 1

    invoice_return.total_amount = round(total_return_amount, 2)

    # Update original invoice status in AR register
    if original_invoice:
        orig_total = float(original_invoice.total_amount or 0.0)
        prior_returns = await db.scalar(
            select(func.coalesce(func.sum(InvoiceReturn.total_amount), 0.0)).where(
                InvoiceReturn.invoice_id == original_invoice.id,
                InvoiceReturn.id != invoice_return.id,
                InvoiceReturn.tenant_id == ctx.tenant_id,
            )
        ) or 0.0
        cumulative_return = float(prior_returns) + total_return_amount
        if cumulative_return >= (orig_total - 0.05) and orig_total > 0:
            original_invoice.status = "returned"
        else:
            original_invoice.status = "partially_returned"
        note_append = f"[Sales Return #{return_number} on {return_date_val}: ₹{total_return_amount:,.2f} returned]"
        original_invoice.notes = f"{original_invoice.notes or ''}\n{note_append}".strip()

    # Generate a Credit Note invoice for the return amount (Standard GST/Accounting practice)
    credit_note = None
    if total_return_amount > 0:
        try:
            cn_number = await generate_number(db, ctx.tenant_id, "credit_notes", active_cid, fallback_prefix="CN-")
        except Exception:
            cn_count = await db.scalar(
                select(func.count(Invoice.id)).where(
                    Invoice.tenant_id == ctx.tenant_id,
                    Invoice.invoice_type == "credit_note"
                )
            ) or 0
            cn_number = f"CN-{cn_count + 1:05d}"

        credit_note = Invoice(
            tenant_id=ctx.tenant_id,
            company_id=active_cid,
            invoice_number=cn_number,
            invoice_type="credit_note",
            status="paid",
            customer_id=uuid.UUID(str(payload.customer_id)) if payload.customer_id else (original_invoice.customer_id if original_invoice else None),
            customer_name=customer_name or "Walk-in Customer",
            customer_phone=cust_phone or None,
            customer_email=cust_email or None,
            customer_gstin=cust_gst or None,
            billing_address=cust_billing_addr or None,
            shipping_address=cust_shipping_addr or None,
            invoice_date=return_date_val,
            due_date=return_date_val,
            currency_code="INR",
            subtotal=round(total_return_amount, 2),
            total_amount=round(total_return_amount, 2),
            amount_paid=round(total_return_amount, 2),
            balance_due=0,
            reference_number=return_number,
            notes=f"Credit Note for Sales Return #{return_number} against Invoice #{inv_number} (Settlement: {payload.settlement_method.upper()})",
        )
        db.add(credit_note)
        await db.flush()

        # Add credit note lines
        for idx, item in enumerate(payload.items):
            line_total = float(item.line_total or (item.quantity * item.unit_price - item.discount_amount))
            cn_line = InvoiceLine(
                invoice_id=credit_note.id,
                line_number=idx + 1,
                product_id=uuid.UUID(str(item.product_id)) if item.product_id else None,
                product_name=item.product_name,
                quantity=item.quantity,
                unit_price=item.unit_price,
                discount_amount=item.discount_amount,
                taxable_amount=round(line_total, 2),
                tax_rate=item.tax_rate,
                line_total=round(line_total, 2),
            )
            db.add(cn_line)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="accounting",
        action="sales_return_created",
        entity_type="sales_return",
        entity_id=invoice_return.id,
        new_values={
            "return_number": return_number,
            "original_invoice": inv_number,
            "total_amount": str(round(total_return_amount, 2)),
            "restocked_count": restocked_count,
            "settlement_method": payload.settlement_method,
            "credit_note_number": credit_note.invoice_number if credit_note else None,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()

    # Automatically dispatch Credit Note via WhatsApp and Email to the exact customer
    if credit_note:
        if cust_phone:
            background_tasks.add_task(_bg_send_invoice_whatsapp, credit_note.id, ctx.tenant_id, cust_phone)
        if cust_email:
            background_tasks.add_task(_bg_send_invoice_email, credit_note.id, ctx.tenant_id, cust_email)

    return {
        "id": str(invoice_return.id),
        "return_number": return_number,
        "return_date": return_date_val.isoformat(),
        "original_invoice_number": inv_number,
        "customer_name": customer_name,
        "settlement_method": payload.settlement_method,
        "reason": payload.reason,
        "total_amount": round(total_return_amount, 2),
        "status": "processed",
        "restocked_count": restocked_count,
        "credit_note_id": str(credit_note.id) if credit_note else None,
        "credit_note_number": credit_note.invoice_number if credit_note else None,
        "debit_note_number": None,
        "message": f"Sales Return {return_number} processed. {restocked_count} item(s) restocked. Linked Credit Note: {credit_note.invoice_number if credit_note else 'N/A'}.",
    }


@router.get("")
async def list_sales_returns(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    search: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    company_id: uuid.UUID | None = None,
):
    """List all sales returns strictly filtered by active organization / workspace."""
    target_company_id = company_id or ctx.active_company_id

    query = (
        select(InvoiceReturn)
        .where(InvoiceReturn.tenant_id == ctx.tenant_id)
        .options(selectinload(InvoiceReturn.lines))
    )

    if target_company_id:
        query = query.where(
            or_(
                InvoiceReturn.company_id == target_company_id,
                and_(
                    InvoiceReturn.company_id.is_(None),
                    InvoiceReturn.invoice.has(Invoice.company_id == target_company_id),
                ),
            )
        )

    if search:
        query = query.where(
            InvoiceReturn.return_number.ilike(f"%{search}%")
            | InvoiceReturn.reason.ilike(f"%{search}%")
        )
    if date_from:
        query = query.where(InvoiceReturn.return_date >= date_from)
    if date_to:
        query = query.where(InvoiceReturn.return_date <= date_to)

    try:
        total = await db.scalar(select(func.count()).select_from(query.subquery()))
        query = query.order_by(InvoiceReturn.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        returns = result.scalars().all()
    except Exception as exc:
        err_str = str(exc).lower()
        if "company_id" in err_str and ("ar_invoice_returns" in err_str or "undefinedcolumn" in err_str):
            logger.warning("ar_invoice_returns.company_id column missing. Auto-adding column...")
            await db.rollback()
            try:
                await db.execute(text("ALTER TABLE ar_invoice_returns ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;"))
                await db.commit()
                total = await db.scalar(select(func.count()).select_from(query.subquery()))
                result = await db.execute(query)
                returns = result.scalars().all()
            except Exception:
                return paginate([], 0, page, page_size)
        else:
            raise

    items = []
    for r in returns:
        # Lookup original invoice number
        inv_num = ""
        if r.invoice_id:
            inv = await db.scalar(select(Invoice.invoice_number).where(Invoice.id == r.invoice_id))
            inv_num = inv or ""

        # Lookup linked Credit Note / Debit Note within tenant/company
        cn_doc_q = select(Invoice.invoice_number).where(
            Invoice.tenant_id == ctx.tenant_id,
            Invoice.reference_number == r.return_number,
            Invoice.invoice_type == "credit_note",
        )
        if target_company_id:
            cn_doc_q = cn_doc_q.where(or_(Invoice.company_id == target_company_id, Invoice.company_id.is_(None)))
        cn_doc = await db.scalar(cn_doc_q.limit(1))

        dn_doc_q = select(Invoice.invoice_number).where(
            Invoice.tenant_id == ctx.tenant_id,
            Invoice.reference_number == r.return_number,
            Invoice.invoice_type == "debit_note",
        )
        if target_company_id:
            dn_doc_q = dn_doc_q.where(or_(Invoice.company_id == target_company_id, Invoice.company_id.is_(None)))
        dn_doc = await db.scalar(dn_doc_q.limit(1))

        items.append({
            "id": str(r.id),
            "company_id": str(r.company_id) if r.company_id else None,
            "return_number": r.return_number,
            "return_date": r.return_date.isoformat() if r.return_date else "",
            "original_invoice_number": inv_num,
            "credit_note_number": cn_doc,
            "debit_note_number": dn_doc,
            "reason": r.reason,
            "total_amount": float(r.total_amount or 0),
            "status": r.status or "processed",
            "items_count": len(r.lines) if r.lines else 0,
            "items": [
                {
                    "id": str(line.id),
                    "product_id": str(line.product_id) if line.product_id else None,
                    "product_name": line.product_name,
                    "quantity": float(line.quantity),
                    "unit_price": float(line.unit_price),
                    "line_total": float(line.line_total),
                    "tax_amount": float(line.tax_amount or 0),
                }
                for line in (r.lines or [])
            ],
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return paginate(items, total or 0, page, page_size)


@router.get("/{return_id}")
async def get_sales_return(
    return_id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a single sales return by ID or return number."""
    ret = None
    try:
        ret_uuid = uuid.UUID(str(return_id))
        ret = await db.scalar(
            select(InvoiceReturn)
            .options(selectinload(InvoiceReturn.lines))
            .where(InvoiceReturn.id == ret_uuid, InvoiceReturn.tenant_id == ctx.tenant_id)
        )
    except (ValueError, AttributeError):
        pass

    if not ret:
        ret = await db.scalar(
            select(InvoiceReturn)
            .options(selectinload(InvoiceReturn.lines))
            .where(
                InvoiceReturn.return_number.ilike(str(return_id).strip()),
                InvoiceReturn.tenant_id == ctx.tenant_id,
            )
        )

    if not ret:
        raise HTTPException(status_code=404, detail="Sales return not found")

    if ctx.active_company_id and ret.company_id and ret.company_id != ctx.active_company_id:
        raise HTTPException(status_code=404, detail="Sales return not found in active organization")

    inv_num = ""
    if ret.invoice_id:
        inv = await db.scalar(select(Invoice.invoice_number).where(Invoice.id == ret.invoice_id))
        inv_num = inv or ""

    cn_doc = await db.scalar(
        select(Invoice.invoice_number).where(
            Invoice.tenant_id == ctx.tenant_id,
            Invoice.reference_number == ret.return_number,
            Invoice.invoice_type == "credit_note",
        ).limit(1)
    )
    dn_doc = await db.scalar(
        select(Invoice.invoice_number).where(
            Invoice.tenant_id == ctx.tenant_id,
            Invoice.reference_number == ret.return_number,
            Invoice.invoice_type == "debit_note",
        ).limit(1)
    )

    return {
        "id": str(ret.id),
        "return_number": ret.return_number,
        "return_date": ret.return_date.isoformat() if ret.return_date else "",
        "original_invoice_number": inv_num,
        "credit_note_number": cn_doc,
        "debit_note_number": dn_doc,
        "reason": ret.reason,
        "total_amount": float(ret.total_amount or 0),
        "status": ret.status or "processed",
        "items": [
            {
                "id": str(line.id),
                "product_id": str(line.product_id) if line.product_id else None,
                "product_name": line.product_name,
                "quantity": float(line.quantity),
                "unit_price": float(line.unit_price),
                "line_total": float(line.line_total),
                "tax_amount": float(line.tax_amount or 0),
            }
            for line in (ret.lines or [])
        ],
        "created_at": ret.created_at.isoformat() if ret.created_at else None,
    }


@router.get("/invoice/{invoice_id_or_number}")
async def get_invoice_for_return(
    invoice_id_or_number: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Look up an invoice or POS receipt by ID or number for processing a return. Returns invoice details with real line items."""
    clean_term = invoice_id_or_number.strip()
    invoice = await _lookup_original_invoice(db, ctx.tenant_id, clean_term, clean_term, company_id=ctx.active_company_id)

    if invoice:
        is_thermal_bill = (
            str(invoice.reference_number or "").startswith("REC-")
            or invoice.print_template_id == "thermal"
            or invoice.template_id == "thermal"
            or "pos" in (invoice.notes or "").lower()
        )
        total_tax = float(invoice.cgst_amount or 0) + float(invoice.sgst_amount or 0) + float(invoice.igst_amount or 0)
        return {
            "id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "receipt_number": invoice.reference_number,
            "display_number": invoice.reference_number if is_thermal_bill and invoice.reference_number else invoice.invoice_number,
            "print_mode": "thermal" if is_thermal_bill else "a4",
            "invoice_date": invoice.invoice_date.isoformat() if invoice.invoice_date else None,
            "customer_name": invoice.customer_name or "Walk-in Guest",
            "customer_phone": invoice.customer_phone or "",
            "customer_address": invoice.billing_address or "",
            "customer_id": str(invoice.customer_id) if invoice.customer_id else None,
            "customer_gstin": invoice.customer_gstin or "",
            "status": invoice.status,
            "subtotal": float(invoice.subtotal or 0),
            "tax_amount": total_tax,
            "total_amount": float(invoice.total_amount or 0),
            "items": [
                {
                    "product_id": str(line.product_id) if line.product_id else None,
                    "product_name": line.product_name or "Product",
                    "product_sku": line.product_sku or "",
                    "hsn_code": line.hsn_code or "",
                    "batch_number": line.batch_number,
                    "quantity": float(line.quantity),
                    "unit_price": float(line.unit_price),
                    "discount_amount": float(line.discount_amount or 0),
                    "tax_rate": float(line.tax_rate or 0),
                    "taxable_amount": float(line.taxable_amount or (line.unit_price * line.quantity)),
                    "line_total": float(line.line_total or (line.unit_price * line.quantity)),
                }
                for line in (invoice.lines or [])
            ],
        }

    # Standalone POS Transaction fallback if no ERP invoice exists
    from src.models import POSTransaction
    pos_stmt = select(POSTransaction).options(
        selectinload(POSTransaction.items),
        selectinload(POSTransaction.customer),
    ).where(
        or_(
            POSTransaction.receipt_number.ilike(clean_term),
            POSTransaction.id == uuid.UUID(clean_term) if len(clean_term) == 36 else False,
        ),
        POSTransaction.tenant_id == ctx.tenant_id,
    )
    if ctx.active_company_id:
        pos_stmt = pos_stmt.where(or_(POSTransaction.company_id == ctx.active_company_id, POSTransaction.company_id.is_(None)))
    pos_tx = await db.scalar(pos_stmt)
    if not pos_tx:
        raise HTTPException(status_code=404, detail="Invoice or Receipt not found")

    # Resolve product names from Product catalog for all items
    p_ids = [it.product_id for it in (pos_tx.items or []) if it.product_id]
    prod_map: dict[uuid.UUID, dict] = {}
    if p_ids:
        p_rows = (await db.execute(
            select(Product.id, Product.name, Product.sku, Product.hsn_code).where(
                Product.id.in_(p_ids),
                Product.tenant_id == ctx.tenant_id,
            )
        )).all()
        for r in p_rows:
            prod_map[r[0]] = {"name": r[1], "sku": r[2], "hsn_code": r[3]}

    cust_name = pos_tx.customer.name if pos_tx.customer else "Walk-in Guest"
    cust_phone = pos_tx.customer.phone if pos_tx.customer else ""
    cust_addr = pos_tx.customer.address if pos_tx.customer else ""
    cust_gst = pos_tx.customer.gst_number if pos_tx.customer else ""

    return {
        "id": str(pos_tx.id),
        "invoice_number": pos_tx.receipt_number,
        "receipt_number": pos_tx.receipt_number,
        "display_number": pos_tx.receipt_number,
        "print_mode": "thermal",
        "invoice_date": pos_tx.created_at.date().isoformat() if pos_tx.created_at else None,
        "customer_name": cust_name,
        "customer_phone": cust_phone,
        "customer_address": cust_addr,
        "customer_id": str(pos_tx.customer_id) if pos_tx.customer_id else None,
        "customer_gstin": cust_gst,
        "status": pos_tx.status,
        "subtotal": float(pos_tx.subtotal or 0),
        "tax_amount": float(pos_tx.tax_amount or 0),
        "total_amount": float(pos_tx.total_amount or 0),
        "items": [
            {
                "product_id": str(it.product_id) if it.product_id else None,
                "product_name": prod_map.get(it.product_id, {}).get("name") or "Store Product",
                "product_sku": prod_map.get(it.product_id, {}).get("sku") or "",
                "hsn_code": prod_map.get(it.product_id, {}).get("hsn_code") or "",
                "batch_number": None,
                "quantity": float(it.quantity or 1),
                "unit_price": float(it.unit_price or 0),
                "discount_amount": float(it.discount or 0),
                "tax_rate": 0,
                "taxable_amount": float(it.subtotal or (it.unit_price * it.quantity)),
                "line_total": float(it.subtotal or (it.unit_price * it.quantity)),
            }
            for it in (pos_tx.items or [])
        ],
    }


@router.post("/exchange", status_code=status.HTTP_201_CREATED)
async def process_exchange(
    payload: ExchangeCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Process a product exchange — return items + issue new items in a single transaction."""
    if not payload.return_items:
        raise HTTPException(status_code=400, detail="At least one return item is required for exchange.")
    if not payload.exchange_items:
        raise HTTPException(status_code=400, detail="At least one exchange item is required.")

    from src.utils.number_series import generate_number, resolve_valid_company_id
    active_cid = await resolve_valid_company_id(db, ctx.tenant_id, ctx.active_company_id)

    original_invoice = await _lookup_original_invoice(
        db, ctx.tenant_id, payload.original_invoice_id, payload.original_invoice_number, company_id=active_cid
    )

    customer_name = payload.customer_name
    customer_phone = payload.customer_phone
    inv_number = payload.original_invoice_number or ""
    if original_invoice:
        customer_name = customer_name or original_invoice.customer_name or "Walk-in Customer"
        customer_phone = customer_phone or original_invoice.customer_phone
        inv_number = original_invoice.invoice_number

    cust_phone = (customer_phone or (original_invoice.customer_phone if original_invoice else None) or "").strip()
    cust_email = (original_invoice.customer_email if original_invoice else None)
    cust_gst = (original_invoice.customer_gstin if original_invoice else None)
    cust_billing_addr = (original_invoice.billing_address if original_invoice else None)
    cust_shipping_addr = (original_invoice.shipping_address if original_invoice else None)

    if payload.customer_id:
        try:
            cid_uuid = uuid.UUID(str(payload.customer_id))
            crm_cust = await db.scalar(select(Customer).where(Customer.id == cid_uuid))
            if crm_cust:
                if not cust_phone and crm_cust.phone:
                    cust_phone = crm_cust.phone.strip()
                if not cust_email and crm_cust.email:
                    cust_email = crm_cust.email.strip()
                if not cust_gst and getattr(crm_cust, "gst_number", None):
                    cust_gst = crm_cust.gst_number
                if not cust_billing_addr and getattr(crm_cust, "address", None):
                    cust_billing_addr = crm_cust.address
        except Exception:
            pass

    # 1. Process Returns
    try:
        return_number = await generate_number(db, ctx.tenant_id, "sales_returns", active_cid, fallback_prefix="SR-")
    except Exception:
        count_q = select(func.count(InvoiceReturn.id)).where(InvoiceReturn.tenant_id == ctx.tenant_id)
        if active_cid:
            count_q = count_q.where(InvoiceReturn.company_id == active_cid)
        count = await db.scalar(count_q) or 0
        return_number = f"SR-{count + 1:05d}"

    return_total = 0.0
    restocked_count = 0

    return_company_id = active_cid or (original_invoice.company_id if original_invoice else None)
    invoice_return = InvoiceReturn(
        tenant_id=ctx.tenant_id,
        company_id=return_company_id,
        invoice_id=original_invoice.id if original_invoice else None,
        return_number=return_number,
        return_date=date.today(),
        reason=payload.reason or "Exchange",
        total_amount=0,
        status="exchanged",
    )
    if not original_invoice:
        try:
            invoice_return.invoice_id = None
        except Exception:
            raise HTTPException(status_code=400, detail="Original invoice is required for exchanges.")
    db.add(invoice_return)
    await db.flush()

    for item in payload.return_items:
        line_total = float(item.line_total or (item.quantity * item.unit_price - item.discount_amount))
        tax_amount = float(item.tax_amount or 0)
        return_total += line_total

        product_id_val = None
        if item.product_id:
            try:
                product_id_val = uuid.UUID(str(item.product_id))
            except Exception:
                pass

        return_line = InvoiceReturnLine(
            invoice_return_id=invoice_return.id,
            product_id=product_id_val,
            product_name=item.product_name,
            quantity=item.quantity,
            unit_price=item.unit_price,
            line_total=round(line_total, 2),
            tax_amount=round(tax_amount, 2),
        )
        db.add(return_line)

        # Restock returned items
        if item.disposition == "restock":
            restocked = await _restock_product(
                db=db,
                tenant_id=ctx.tenant_id,
                product_id=product_id_val,
                product_name=item.product_name,
                sku=item.sku,
                batch_number=item.batch_number,
                qty=item.quantity,
                user_id=ctx.user.id if hasattr(ctx, "user") and ctx.user else None,
                reference=f"EX-{return_number}",
                company_id=active_cid,
                disposition=item.disposition,
            )
            if restocked:
                restocked_count += 1

    invoice_return.total_amount = round(return_total, 2)

    if original_invoice:
        original_invoice.status = "exchanged"
        original_invoice.notes = f"{original_invoice.notes or ''}\n[Exchanged via Return #{return_number}: Value ₹{return_total:,.2f}]".strip()

    # 2. Create new Exchange Invoice for outgoing items
    try:
        exchange_inv_number = await generate_number(db, ctx.tenant_id, "invoices", active_cid, fallback_prefix="INV-")
    except Exception:
        inv_count = await db.scalar(
            select(func.count(Invoice.id)).where(Invoice.tenant_id == ctx.tenant_id)
        ) or 0
        exchange_inv_number = f"INV-{inv_count + 1:05d}"

    exchange_total = 0.0
    for item in payload.exchange_items:
        gross = item.quantity * item.unit_price - item.discount_amount
        tax = gross * (item.tax_rate / 100.0) if item.tax_rate else 0
        exchange_total += gross + tax

    difference = round(exchange_total - return_total, 2)
    amount_paid = max(0, difference)
    balance_due = max(0, difference)

    exchange_invoice = Invoice(
        tenant_id=ctx.tenant_id,
        company_id=active_cid,
        invoice_number=exchange_inv_number,
        invoice_type="tax_invoice",
        status="paid" if difference <= 0.01 else "draft",
        customer_id=uuid.UUID(str(payload.customer_id)) if payload.customer_id else (original_invoice.customer_id if original_invoice else None),
        customer_name=customer_name or "Walk-in Customer",
        customer_phone=cust_phone or None,
        customer_email=cust_email or None,
        customer_gstin=cust_gst or None,
        billing_address=cust_billing_addr or None,
        shipping_address=cust_shipping_addr or None,
        invoice_date=date.today(),
        due_date=date.today(),
        currency_code="INR",
        subtotal=round(exchange_total, 2),
        total_amount=round(exchange_total, 2),
        amount_paid=0,
        balance_due=round(max(0, difference), 2),
        reference_number=f"Exchange against {inv_number} (Return: {return_number})",
        notes=f"Exchange invoice — Returned items via {return_number}, new items issued. Difference: ₹{difference:,.2f}",
    )
    db.add(exchange_invoice)
    await db.flush()

    for idx, item in enumerate(payload.exchange_items):
        gross = item.quantity * item.unit_price - item.discount_amount
        tax = gross * (item.tax_rate / 100.0) if item.tax_rate else 0

        product_id_val = None
        if item.product_id:
            try:
                product_id_val = uuid.UUID(str(item.product_id))
            except Exception:
                pass

        ex_line = InvoiceLine(
            invoice_id=exchange_invoice.id,
            line_number=idx + 1,
            product_id=product_id_val,
            product_name=item.product_name,
            quantity=item.quantity,
            unit_price=item.unit_price,
            discount_amount=item.discount_amount,
            taxable_amount=round(gross, 2),
            tax_rate=item.tax_rate,
            line_total=round(gross + tax, 2),
        )
        db.add(ex_line)

        # Deduct stock for exchange items
        if product_id_val:
            try:
                prod = await db.scalar(
                    select(Product).where(Product.id == product_id_val, Product.tenant_id == ctx.tenant_id).with_for_update()
                )
                if prod:
                    current_stk = prod.initial_stock if prod.initial_stock is not None else 0
                    current_on_hand = prod.on_hand_stock if prod.on_hand_stock is not None else current_stk
                    prod.initial_stock = max(0, int(current_stk - item.quantity))
                    prod.on_hand_stock = max(0, int(current_on_hand - item.quantity))

                    inv_tx = InventoryTransaction(
                        tenant_id=ctx.tenant_id,
                        product_id=prod.id,
                        transaction_type="OFFLINE_SALE",
                        quantity=int(item.quantity),
                        before_on_hand=int(current_on_hand),
                        after_on_hand=int(prod.on_hand_stock),
                        before_reserved=int(prod.reserved_stock or 0),
                        after_reserved=int(prod.reserved_stock or 0),
                        reference_type="EXCHANGE",
                        reference_id=f"EX-{return_number}-{exchange_inv_number}",
                        user_id=ctx.user.id if hasattr(ctx, "user") and ctx.user else None,
                        notes=f"Exchange dispatch: -{int(item.quantity)} units ({exchange_inv_number})",
                    )
                    db.add(inv_tx)
            except Exception as e:
                logger.warning(f"Exchange stock deduction error: {e}")

    # 3. Generate linked Credit Note or Debit Note for exchange difference
    linked_cn = None
    linked_dn = None
    if difference < 0:
        # Store owes refund to customer -> Credit Note
        refund_amt = round(abs(difference), 2)
        try:
            cn_num = await generate_number(db, ctx.tenant_id, "credit_notes", active_cid, fallback_prefix="CN-")
        except Exception:
            cn_count = await db.scalar(
                select(func.count(Invoice.id)).where(
                    Invoice.tenant_id == ctx.tenant_id,
                    Invoice.invoice_type == "credit_note"
                )
            ) or 0
            cn_num = f"CN-{cn_count + 1:05d}"

        linked_cn = Invoice(
            tenant_id=ctx.tenant_id,
            company_id=active_cid,
            invoice_number=cn_num,
            invoice_type="credit_note",
            status="paid",
            customer_id=uuid.UUID(str(payload.customer_id)) if payload.customer_id else (original_invoice.customer_id if original_invoice else None),
            customer_name=customer_name or "Walk-in Customer",
            customer_phone=cust_phone or None,
            customer_email=cust_email or None,
            customer_gstin=cust_gst or None,
            billing_address=cust_billing_addr or None,
            shipping_address=cust_shipping_addr or None,
            invoice_date=date.today(),
            due_date=date.today(),
            currency_code="INR",
            subtotal=refund_amt,
            total_amount=refund_amt,
            amount_paid=refund_amt,
            balance_due=0,
            reference_number=return_number,
            notes=f"Credit Note for Exchange refund difference against Return #{return_number} (Invoice #{exchange_inv_number})",
        )
        db.add(linked_cn)
    elif difference > 0:
        # Customer owes extra difference -> Debit Note
        diff_amt = round(difference, 2)
        try:
            dn_num = await generate_number(db, ctx.tenant_id, "debit_notes", active_cid, fallback_prefix="DN-")
        except Exception:
            dn_count = await db.scalar(
                select(func.count(Invoice.id)).where(
                    Invoice.tenant_id == ctx.tenant_id,
                    Invoice.invoice_type == "debit_note"
                )
            ) or 0
            dn_num = f"DN-{dn_count + 1:05d}"

        linked_dn = Invoice(
            tenant_id=ctx.tenant_id,
            company_id=active_cid,
            invoice_number=dn_num,
            invoice_type="debit_note",
            status="paid",
            customer_id=uuid.UUID(str(payload.customer_id)) if payload.customer_id else (original_invoice.customer_id if original_invoice else None),
            customer_name=customer_name or "Walk-in Customer",
            customer_phone=cust_phone or None,
            customer_email=cust_email or None,
            customer_gstin=cust_gst or None,
            billing_address=cust_billing_addr or None,
            shipping_address=cust_shipping_addr or None,
            invoice_date=date.today(),
            due_date=date.today(),
            currency_code="INR",
            subtotal=diff_amt,
            total_amount=diff_amt,
            amount_paid=diff_amt,
            balance_due=0,
            reference_number=return_number,
            notes=f"Debit Note for Exchange supplementary difference against Return #{return_number} (Invoice #{exchange_inv_number})",
        )
        db.add(linked_dn)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="accounting",
        action="exchange_processed",
        entity_type="sales_return",
        entity_id=invoice_return.id,
        new_values={
            "return_number": return_number,
            "exchange_invoice_number": exchange_inv_number,
            "return_total": str(round(return_total, 2)),
            "exchange_total": str(round(exchange_total, 2)),
            "difference": str(difference),
            "credit_note_number": linked_cn.invoice_number if linked_cn else None,
            "debit_note_number": linked_dn.invoice_number if linked_dn else None,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()

    # Automatically dispatch Exchange documents (Credit Note or Exchange Invoice) via WhatsApp & Email
    if linked_cn:
        if cust_phone:
            background_tasks.add_task(_bg_send_invoice_whatsapp, linked_cn.id, ctx.tenant_id, cust_phone)
        if cust_email:
            background_tasks.add_task(_bg_send_invoice_email, linked_cn.id, ctx.tenant_id, cust_email)
    elif exchange_invoice:
        if cust_phone:
            background_tasks.add_task(_bg_send_invoice_whatsapp, exchange_invoice.id, ctx.tenant_id, cust_phone)
        if cust_email:
            background_tasks.add_task(_bg_send_invoice_email, exchange_invoice.id, ctx.tenant_id, cust_email)

    return {
        "return_number": return_number,
        "return_total": round(return_total, 2),
        "exchange_invoice_number": exchange_inv_number,
        "exchange_total": round(exchange_total, 2),
        "difference": difference,
        "restocked_count": restocked_count,
        "customer_name": customer_name,
        "status": "exchanged",
        "credit_note_number": linked_cn.invoice_number if linked_cn else None,
        "debit_note_number": linked_dn.invoice_number if linked_dn else None,
        "message": f"Exchange processed. Return {return_number} → New Invoice {exchange_inv_number}. "
                   f"Difference: ₹{difference:,.2f}. {restocked_count} items restocked.",
    }
