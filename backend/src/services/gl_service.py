"""Shared General Ledger posting service.

Builds and posts balanced JournalEntry objects for ERP/POS document events so
that POS receipts, sales invoices, payments-in, sales returns/credit notes and
payment vouchers all land in the GL (and therefore in financial_reports, which
reads posted journal lines) — and that money movements into/out of bank
accounts create BankTransactions so bank reconciliation has input data.

Design rules (kept intentionally conservative so the business flow never breaks
because bookkeeping could not be resolved):
  * Every posting is best-effort: on failure we log and return None, the
    caller's transaction still commits.
  * We only post when the required Chart of Accounts entries exist for the
    tenant; if they don't, the post is skipped with a warning.
  * Journals are created already `posted` (system-generated), with
    base_currency_debit/credit set so GL reports pick them up.
"""
import logging
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.erp import (
    BankAccount,
    BankTransaction,
    ChartOfAccount,
    EntryStatus,
    EntryType,
    JournalEntry,
    JournalEntryLine,
    PaymentVoucher,
)

logger = logging.getLogger(__name__)


# ─── Account resolution ──────────────────────────────────────────────

async def resolve_account(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID | None,
    sub_types: tuple[str, ...],
    codes: tuple[str, ...] = (),
) -> Optional[ChartOfAccount]:
    """Find an active, postable COA account by sub-type (and optional code).

    Prefers company-specific accounts, then tenant-level (company_id IS NULL).
    Returns None when nothing matches — callers must treat that as
    "cannot post" and skip, not fail.
    """
    rows = (await db.execute(
        select(ChartOfAccount)
        .where(
            ChartOfAccount.tenant_id == tenant_id,
            ChartOfAccount.is_active == True,  # noqa: E712
            ChartOfAccount.allow_posting == True,  # noqa: E712
        )
        .order_by(ChartOfAccount.sort_order.asc())
    )).scalars().all()

    def _match(a: ChartOfAccount) -> bool:
        sub = a.account_sub_type
        sub_val = sub.value if hasattr(sub, "value") else (sub or "")
        if sub_val not in sub_types:
            return False
        if codes and a.code not in codes:
            return False
        return True

    company_rows = [a for a in rows if company_id and a.company_id == company_id]
    tenant_rows = [a for a in rows if a.company_id is None]
    for candidates in (company_rows, tenant_rows):
        for a in candidates:
            if _match(a):
                return a
    return None


# ─── Core journal posting ────────────────────────────────────────────

async def post_journal(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID | None,
    entry_type: EntryType,
    entry_date: date,
    reference: str,
    description: str,
    source_module: str,
    source_id: uuid.UUID | str | None,
    created_by: uuid.UUID | None,
    lines: list[dict],
    status: str = "posted",
) -> Optional[JournalEntry]:
    """Create a balanced, (optionally) posted JournalEntry. Returns None and logs
    when the entry is empty or unbalanced so the caller flow keeps working."""
    if not lines:
        return None

    # source_id is a UUID column — document references ("INV-39149", "SR-001")
    # must never be passed raw, or the flush aborts the whole request.
    sid: Optional[uuid.UUID] = None
    if source_id is not None:
        if isinstance(source_id, uuid.UUID):
            sid = source_id
        else:
            try:
                sid = uuid.UUID(str(source_id))
            except (ValueError, AttributeError):
                sid = None

    total_debit = round(sum(float(l.get("debit", 0)) for l in lines), 2)
    total_credit = round(sum(float(l.get("credit", 0)) for l in lines), 2)

    if total_debit <= 0.0 and total_credit <= 0.0:
        return None
    if abs(total_debit - total_credit) > 0.01:
        logger.warning(
            "GL post skipped (unbalanced) %s %s: debit=%.2f credit=%.2f",
            source_module, reference, total_debit, total_credit,
        )
        return None

    from src.utils.number_series import generate_number
    try:
        entry_number = await generate_number(db, tenant_id, "journal", company_id, fallback_prefix="JE-")
    except Exception:
        count = await db.scalar(
            select(func.count(JournalEntry.id)).where(JournalEntry.tenant_id == tenant_id)
        ) or 0
        entry_number = f"JE-{count + 1:06d}"

    now = datetime.now()
    # Contain the GL write in a SAVEPOINT so any GL-side failure (bad account id,
    # constraint, etc.) rolls back only the journal — never the caller's business
    # transaction (invoice, POS sale, voucher). This is what makes the posting
    # genuinely best-effort even when it happens inside the same session.
    try:
        async with db.begin_nested():
            entry = JournalEntry(
                tenant_id=tenant_id,
                company_id=company_id,
                entry_number=entry_number,
                entry_type=entry_type,
                status=status,
                entry_date=entry_date,
                reference=reference,
                description=description,
                total_debit=total_debit,
                total_credit=total_credit,
                currency_code="INR",
                exchange_rate=1,
                source_module=source_module,
                source_id=sid,
                created_by_user_id=created_by,
                posted_at=now if status == "posted" else None,
                posted_by_user_id=created_by if status == "posted" else None,
            )
            db.add(entry)
            await db.flush()

            for idx, line in enumerate(lines):
                jl = JournalEntryLine(
                    entry_id=entry.id,
                    account_id=line["account_id"],
                    cost_center_id=line.get("cost_center_id"),
                    description=line.get("description"),
                    debit=float(line.get("debit", 0)),
                    credit=float(line.get("credit", 0)),
                    currency_code="INR",
                    exchange_rate=1,
                    base_currency_debit=float(line.get("debit", 0)),
                    base_currency_credit=float(line.get("credit", 0)),
                    line_number=idx + 1,
                    sort_order=idx,
                )
                db.add(jl)
        return entry
    except Exception as sp_err:
        logger.warning("GL post failed inside savepoint %s %s: %s", source_module, reference, sp_err)
        return None


# ─── Bank transaction recording ──────────────────────────────────────

async def record_bank_transaction(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID | None,
    bank_account_id: uuid.UUID | None,
    amount: float,
    direction: str,  # "in" (money received) | "out" (money paid)
    transaction_date: date,
    description: str,
    reference_number: str | None = None,
    counterparty: str | None = None,
    journal_entry_id: uuid.UUID | None = None,
) -> Optional[BankTransaction]:
    """Create a BankTransaction and move the account's current_balance.

    Falls back to the company's default bank account when no specific one is
    supplied. Returns None when no bank account exists (nothing to book).
    """
    amount = round(abs(float(amount)), 2)
    if amount <= 0:
        return None

    account: Optional[BankAccount] = None
    if bank_account_id:
        account = await db.scalar(
            select(BankAccount).where(
                BankAccount.id == bank_account_id, BankAccount.tenant_id == tenant_id
            )
        )
    if account is None:
        account = await db.scalar(
            select(BankAccount).where(
                BankAccount.tenant_id == tenant_id,
                or_(
                    BankAccount.is_default == True,  # noqa: E712
                    (BankAccount.is_default == False) & (BankAccount.company_id == company_id),  # noqa: E712
                ),
            )
        )
    if account is None:
        account = await db.scalar(
            select(BankAccount).where(
                BankAccount.tenant_id == tenant_id,
                BankAccount.status.in_(["active"]),
            ).order_by(BankAccount.sort_order.asc() if hasattr(BankAccount, "sort_order") else BankAccount.id.asc())
        )
    if account is None:
        logger.info("GL: no bank account for tenant %s — skipping bank transaction", tenant_id)
        return None

    # The bank_transactions table is unique on (tenant, account, date, amount,
    # description) — e.g. two identical split payments on the same receipt.
    # If the exact movement is already booked, skip it (the balance already moved).
    existing = await db.scalar(
        select(BankTransaction.id).where(
            BankTransaction.tenant_id == tenant_id,
            BankTransaction.bank_account_id == account.id,
            BankTransaction.transaction_date == transaction_date,
            BankTransaction.amount == amount,
            BankTransaction.description == description,
        )
    )
    if existing:
        logger.info("GL: bank transaction already recorded for %s %s — skipping duplicate", account.name, description[:60])
        return None

    is_in = direction == "in"
    txn_type = "credit" if is_in else "debit"
    try:
        async with db.begin_nested():
            txn = BankTransaction(
                tenant_id=tenant_id,
                bank_account_id=account.id,
                transaction_date=transaction_date,
                description=description,
                reference_number=reference_number,
                counterparty=counterparty,
                transaction_type=txn_type,
                amount=amount,
                journal_entry_id=journal_entry_id,
                is_manual=False,
            )
            db.add(txn)
            current = float(account.current_balance or 0)
            account.current_balance = round(current + (amount if is_in else -amount), 2)
            await db.flush()
            txn.running_balance = account.current_balance
        return txn
    except Exception as sp_err:
        logger.warning("GL bank transaction failed inside savepoint (%s %s): %s", account.name, description[:60], sp_err)
        return None


# ─── Document-level postings ─────────────────────────────────────────

async def post_invoice_sale(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID | None,
    invoice,  # src.models.erp.Invoice
    created_by: uuid.UUID | None,
) -> Optional[JournalEntry]:
    """Post a sales invoice / POS receipt to the GL.

    Dr  Accounts Receivable (total)
    Cr  Sales Revenue (total − tax)
    Cr  GST Payable    (cgst + sgst + igst)
    """
    inv_type = str(getattr(invoice, "invoice_type", "tax_invoice") or "tax_invoice").lower()
    inv_status = str(getattr(invoice, "status", "") or "").lower()
    # Pro-forma / estimates are not real revenue; credit/debit notes are handled by
    # post_sale_refund / post_payment_out, not by a sales posting.
    if inv_type in ("proforma", "estimate", "quote", "credit_note", "debit_note") or inv_status in ("cancelled", "voided", "draft"):
        return None

    total = round(float(invoice.total_amount or 0), 2)
    if total <= 0:
        return None
    tax = round(
        float(invoice.cgst_amount or 0) + float(invoice.sgst_amount or 0) + float(invoice.igst_amount or 0),
        2,
    )
    revenue = round(total - tax, 2)

    ar = await resolve_account(db, tenant_id, company_id, ("receivable",))
    sales = await resolve_account(db, tenant_id, company_id, ("sales",))
    if not ar or not sales:
        logger.warning("GL: AR/Sales account missing for tenant %s — invoice %s not posted", tenant_id, invoice.invoice_number)
        return None

    lines = [
        {"account_id": ar.id, "debit": total, "credit": 0, "description": f"AR {invoice.invoice_number}"},
        {"account_id": sales.id, "debit": 0, "credit": revenue, "description": f"Sales {invoice.invoice_number}"},
    ]
    if tax > 0:
        gst = await resolve_account(db, tenant_id, company_id, ("tax",))
        if gst:
            lines.append({"account_id": gst.id, "debit": 0, "credit": tax, "description": f"GST {invoice.invoice_number}"})
        else:
            # No tax account: fold tax into revenue so the entry still balances.
            lines[1]["credit"] = total

    entry = await post_journal(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        entry_type=EntryType.SALES,
        entry_date=invoice.invoice_date,
        reference=invoice.invoice_number,
        description=f"Sales invoice {invoice.invoice_number} ({invoice.customer_name or 'Walk-in'})",
        source_module="pos" if str(getattr(invoice, "reference_number", "") or "").startswith("POS-") or "POS Terminal Bill" in str(getattr(invoice, "notes", "") or "") else "erp_invoice",
        source_id=invoice.id,
        created_by=created_by,
        lines=lines,
    )
    if entry and hasattr(invoice, "journal_entry_id"):
        invoice.journal_entry_id = entry.id
    return entry


async def post_sale_refund(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID | None,
    reference: str,
    total: float,
    tax: float,
    entry_date: date,
    created_by: uuid.UUID | None,
) -> Optional[JournalEntry]:
    """Reverse a sale (POS refund / sales return) at the revenue + tax level.

    Dr  Sales Revenue (total − tax)
    Dr  GST Payable   (tax)
    Cr  Accounts Receivable (total)
    """
    total = round(abs(float(total or 0)), 2)
    if total <= 0:
        return None
    tax = round(min(abs(float(tax or 0)), total), 2)
    revenue = round(total - tax, 2)

    ar = await resolve_account(db, tenant_id, company_id, ("receivable",))
    sales = await resolve_account(db, tenant_id, company_id, ("sales",))
    if not ar or not sales:
        logger.warning("GL: AR/Sales account missing for tenant %s — refund %s not posted", tenant_id, reference)
        return None

    lines = [
        {"account_id": sales.id, "debit": revenue, "credit": 0, "description": f"Sales return {reference}"},
        {"account_id": ar.id, "debit": 0, "credit": total, "description": f"AR reduction {reference}"},
    ]
    if tax > 0:
        gst = await resolve_account(db, tenant_id, company_id, ("tax",))
        if gst:
            lines.append({"account_id": gst.id, "debit": tax, "credit": 0, "description": f"GST reversal {reference}"})
        else:
            lines[0]["debit"] = total

    return await post_journal(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        entry_type=EntryType.CREDIT_NOTE,
        entry_date=entry_date,
        reference=reference,
        description=f"Sales return / credit note {reference}",
        source_module="sales_return",
        source_id=reference,
        created_by=created_by,
        lines=lines,
    )


async def post_payment_in(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID | None,
    payment_amount: float,
    payment_date: date,
    reference: str,
    description: str,
    payment_method: str = "cash",
    bank_account_id: uuid.UUID | None = None,
    counterparty: str | None = None,
    created_by: uuid.UUID | None = None,
) -> tuple[Optional[JournalEntry], Optional[BankTransaction]]:
    """Post a customer payment received (receipt voucher).

    Dr  Cash / Bank
    Cr  Accounts Receivable
    """
    amount = round(abs(float(payment_amount or 0)), 2)
    if amount <= 0:
        return None, None

    method = str(payment_method or "cash").lower()
    cash_first = method in ("cash", "upi", "cheque", "cheq")
    sub_types = ("cash", "bank") if cash_first else ("bank", "cash")
    cash_acct = await resolve_account(db, tenant_id, company_id, sub_types)
    ar = await resolve_account(db, tenant_id, company_id, ("receivable",))
    if not cash_acct or not ar:
        logger.warning("GL: Cash/AR account missing for tenant %s — payment %s not posted", tenant_id, reference)
        return None, None

    entry = await post_journal(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        entry_type=EntryType.RECEIPT,
        entry_date=payment_date,
        reference=reference,
        description=description,
        source_module="invoice_payment",
        source_id=reference,
        created_by=created_by,
        lines=[
            {"account_id": cash_acct.id, "debit": amount, "credit": 0, "description": description},
            {"account_id": ar.id, "debit": 0, "credit": amount, "description": f"AR settlement {reference}"},
        ],
    )

    bank_txn: Optional[BankTransaction] = None
    booked_to_bank = bool(bank_account_id or method in ("bank", "bank_transfer", "card", "credit_card", "online", "upi"))
    if booked_to_bank:
        bank_txn = await record_bank_transaction(
            db,
            tenant_id=tenant_id,
            company_id=company_id,
            bank_account_id=bank_account_id,
            amount=amount,
            direction="in",
            transaction_date=payment_date,
            description=description,
            reference_number=reference,
            counterparty=counterparty,
            journal_entry_id=entry.id if entry else None,
        )
    return entry, bank_txn


async def post_settlement_in(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID | None,
    amount_allocated: float,
    surplus: float = 0.0,
    payment_date: date,
    reference: str,
    description: str,
    payment_method: str = "cash",
    bank_account_id: uuid.UUID | None = None,
    counterparty: str | None = None,
    created_by: uuid.UUID | None = None,
) -> tuple[Optional[JournalEntry], Optional[BankTransaction]]:
    """Post a customer settlement: one money-receipt against the total received.

    Dr  Cash / Bank            (amount_allocated + surplus)
    Cr  Accounts Receivable    (amount_allocated)
    Cr  Customer Deposits/AR   (surplus — prefer a current-liability account when
        one exists, otherwise fold into AR so the entry stays balanced)

    The bank transaction (if booked) reflects the FULL amount received.
    """
    allocated = round(abs(float(amount_allocated or 0)), 2)
    surplus = round(abs(float(surplus or 0)), 2)
    total_in = round(allocated + surplus, 2)
    if total_in <= 0:
        return None, None

    method = str(payment_method or "cash").lower()
    cash_first = method in ("cash", "upi", "cheque", "cheq")
    sub_types = ("cash", "bank") if cash_first else ("bank", "cash")
    cash_acct = await resolve_account(db, tenant_id, company_id, sub_types)
    ar = await resolve_account(db, tenant_id, company_id, ("receivable",))
    if not cash_acct or not ar:
        logger.warning("GL: Cash/AR account missing for tenant %s — settlement %s not posted", tenant_id, reference)
        return None, None

    lines = [
        {"account_id": cash_acct.id, "debit": total_in, "credit": 0, "description": description},
    ]
    if allocated > 0:
        lines.append({"account_id": ar.id, "debit": 0, "credit": allocated, "description": f"AR settlement {reference}"})
    if surplus > 0:
        wallet_acct = await resolve_account(db, tenant_id, company_id, ("current_liability",))
        lines.append({
            "account_id": (wallet_acct or ar).id,
            "debit": 0,
            "credit": surplus,
            "description": f"Customer deposit/wallet surplus {reference}",
        })

    entry = await post_journal(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        entry_type=EntryType.RECEIPT,
        entry_date=payment_date,
        reference=reference,
        description=description,
        source_module="invoice_payment",
        source_id=reference,
        created_by=created_by,
        lines=lines,
    )

    booked_to_bank = bool(bank_account_id or method in ("bank", "bank_transfer", "card", "credit_card", "online", "upi"))
    bank_txn: Optional[BankTransaction] = None
    if booked_to_bank:
        bank_txn = await record_bank_transaction(
            db,
            tenant_id=tenant_id,
            company_id=company_id,
            bank_account_id=bank_account_id,
            amount=total_in,
            direction="in",
            transaction_date=payment_date,
            description=description,
            reference_number=reference,
            counterparty=counterparty,
            journal_entry_id=entry.id if entry else None,
        )
    return entry, bank_txn


async def post_sale_adjustment(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID | None,
    reference: str,
    amount: float,
    tax: float,
    entry_date: date,
    is_reversal: bool = False,
    description: str = "",
    created_by: uuid.UUID | None = None,
) -> Optional[JournalEntry]:
    """Post a revenue delta that is not a standalone invoice document.

    is_reversal=False (exchange new items / debit note):
        Dr  Accounts Receivable (amount)
        Cr  Sales Revenue (amount − tax)
        Cr  GST Payable   (tax)
    is_reversal=True (returned items / credit note content):
        Dr  Sales Revenue (amount − tax)
        Dr  GST Payable   (tax)
        Cr  Accounts Receivable (amount)
    """
    total = round(abs(float(amount or 0)), 2)
    if total <= 0:
        return None
    tax = round(min(abs(float(tax or 0)), total), 2)
    revenue = round(total - tax, 2)

    ar = await resolve_account(db, tenant_id, company_id, ("receivable",))
    sales = await resolve_account(db, tenant_id, company_id, ("sales",))
    if not ar or not sales:
        logger.warning("GL: AR/Sales account missing for tenant %s — %s not posted", tenant_id, reference)
        return None

    if is_reversal:
        lines = [
            {"account_id": sales.id, "debit": revenue, "credit": 0, "description": f"Sales reversal {reference}"},
            {"account_id": ar.id, "debit": 0, "credit": total, "description": f"AR reduction {reference}"},
        ]
        if tax > 0:
            gst = await resolve_account(db, tenant_id, company_id, ("tax",))
            if gst:
                lines.append({"account_id": gst.id, "debit": tax, "credit": 0, "description": f"GST reversal {reference}"})
            else:
                lines[0]["debit"] = total
        entry_type = EntryType.CREDIT_NOTE
    else:
        lines = [
            {"account_id": ar.id, "debit": total, "credit": 0, "description": f"AR {reference}"},
            {"account_id": sales.id, "debit": 0, "credit": revenue, "description": f"Sales {reference}"},
        ]
        if tax > 0:
            gst = await resolve_account(db, tenant_id, company_id, ("tax",))
            if gst:
                lines.append({"account_id": gst.id, "debit": 0, "credit": tax, "description": f"GST {reference}"})
            else:
                lines[1]["credit"] = total
        entry_type = EntryType.SALES

    return await post_journal(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        entry_type=entry_type,
        entry_date=entry_date,
        reference=reference,
        description=description or f"Revenue adjustment {reference}",
        source_module="sales_return",
        source_id=reference,
        created_by=created_by,
        lines=lines,
    )


async def post_refund_out(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID | None,
    amount: float,
    payment_date: date,
    reference: str,
    description: str,
    payment_method: str = "cash",
    bank_account_id: uuid.UUID | None = None,
    counterparty: str | None = None,
    created_by: uuid.UUID | None = None,
) -> tuple[Optional[JournalEntry], Optional[BankTransaction]]:
    """Customer refund paid out in cash/UPI/bank (the inverse of post_payment_in).

    Dr  Accounts Receivable   (the credit we owed the customer)
    Cr  Cash / Bank           (money leaving the business)
    """
    amount = round(abs(float(amount or 0)), 2)
    if amount <= 0:
        return None, None

    method = str(payment_method or "cash").lower()
    cash_first = method in ("cash", "cheque", "cheq", "cash_deposit")
    sub_types = ("cash", "bank") if cash_first else ("bank", "cash")
    cash_acct = await resolve_account(db, tenant_id, company_id, sub_types)
    ar = await resolve_account(db, tenant_id, company_id, ("receivable",))
    if not cash_acct or not ar:
        logger.warning("GL: Cash/AR account missing for tenant %s — refund %s not posted", tenant_id, reference)
        return None, None

    entry = await post_journal(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        entry_type=EntryType.PAYMENT,
        entry_date=payment_date,
        reference=reference,
        description=description,
        source_module="sales_return",
        source_id=reference,
        created_by=created_by,
        lines=[
            {"account_id": ar.id, "debit": amount, "credit": 0, "description": description},
            {"account_id": cash_acct.id, "debit": 0, "credit": amount, "description": f"Refund out {reference}"},
        ],
    )

    bank_txn: Optional[BankTransaction] = None
    if method in ("bank", "bank_transfer", "card", "credit_card", "online", "upi"):
        bank_txn = await record_bank_transaction(
            db,
            tenant_id=tenant_id,
            company_id=company_id,
            bank_account_id=bank_account_id,
            amount=amount,
            direction="out",
            transaction_date=payment_date,
            description=description,
            reference_number=reference,
            counterparty=counterparty,
            journal_entry_id=entry.id if entry else None,
        )
    return entry, bank_txn


async def post_payment_voucher(
    db: AsyncSession,
    *,
    voucher: PaymentVoucher,
    created_by: uuid.UUID | None,
) -> Optional[JournalEntry]:
    """Post a Payment/Receipt Voucher (explicit debits & credits on its lines).

    Voucher lines already carry account_id + line_type (debit/credit), so the
    journal mirrors them 1:1. Refuses to post an unbalanced voucher.
    """
    from src.models.erp import PaymentVoucherLine

    lines = []
    total_d = total_c = 0.0
    for ln in voucher.lines:
        amt = round(float(ln.amount or 0), 2)
        ltype = str(ln.line_type or "").lower()
        if ltype in ("credit", "cr"):
            lines.append({"account_id": ln.account_id, "debit": 0, "credit": amt,
                          "cost_center_id": ln.cost_center_id, "description": ln.description})
            total_c += amt
        else:
            lines.append({"account_id": ln.account_id, "debit": amt, "credit": 0,
                          "cost_center_id": ln.cost_center_id, "description": ln.description})
            total_d += amt

    if abs(total_d - total_c) > 0.01:
        raise ValueError(
            f"Voucher {voucher.voucher_number} is not balanced (debits {total_d:.2f} ≠ credits {total_c:.2f})"
        )
    if total_d <= 0:
        return None

    vtype = str(voucher.voucher_type or "payment").lower()
    entry_type = {
        "receipt": EntryType.RECEIPT,
        "payment": EntryType.PAYMENT,
        "contra": EntryType.CONTRA,
        "journal": EntryType.JOURNAL,
    }.get(vtype, EntryType.JOURNAL)

    direction = "out" if vtype in ("payment", "contra") else "in"

    entry = await post_journal(
        db,
        tenant_id=voucher.tenant_id,
        company_id=voucher.company_id,
        entry_type=entry_type,
        entry_date=voucher.voucher_date,
        reference=voucher.voucher_number,
        description=f"Voucher {voucher.voucher_number} — {voucher.payee_name}",
        source_module="payment_voucher",
        source_id=voucher.id,
        created_by=created_by,
        lines=lines,
    )

    if entry and voucher.bank_account_id:
        await record_bank_transaction(
            db,
            tenant_id=voucher.tenant_id,
            company_id=voucher.company_id,
            bank_account_id=voucher.bank_account_id,
            amount=total_d,
            direction=direction,
            transaction_date=voucher.voucher_date,
            description=f"Voucher {voucher.voucher_number} ({vtype}) {voucher.payee_name}",
            reference_number=voucher.reference_number,
            counterparty=voucher.payee_name,
            journal_entry_id=entry.id,
        )

    if entry:
        voucher.journal_entry_id = entry.id
        voucher.status = "posted"
        voucher.posted_at = datetime.now()
    return entry
