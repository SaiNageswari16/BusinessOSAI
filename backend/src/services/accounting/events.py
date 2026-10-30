"""Accounting event consumers — the automatic GL postings.

Before this module the accounting service *declared* its bus subscriptions in
the registry but had no handlers: ``bill.paid`` never posted a journal entry,
so the GL, trial balance and P&L were hand-keyed only. These consumers close
that gap. They are registered on the shared bus singleton at import time;
``main.py`` imports this module for that side effect.

House rules observed:
  * handlers get their own session from the service's module-level ``db``
    (never a request session — they run outside any request);
  * idempotency is structural (a guard query on reference_type/reference_id)
    ON TOP of the durable ``consumed_events`` ledger gate in the consumer
    loop — the ledger dedupes across restarts, the guard dedupes in the one
    path where it does not;
  * no cross-service FKs: account resolution is by code within THIS database;
  * a handler that cannot post (e.g. accounts not seeded) logs and moves on —
    one tenant's missing chart of accounts must not wedge the bus.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.accounting.models import (
    ChartOfAccount,
    JournalEntry,
    JournalEntryLine,
    JournalEntryStatus,
)
from src.services.event_bus.bus import Event, bus

logger = logging.getLogger("accounting.events")

# GL codes (see service.DEFAULT_ACCOUNTS): 1000 Cash in Hand, 1010 Bank,
# 1020 Accounts Receivable, 1030 Inventory Asset, 2000 AP, 2010/2020/2030
# CGST/SGST/IGST Payable, 4000 F&B Sales.
_ACCT = {
    "cash": "1000",
    "bank": "1010",
    "ar": "1020",
    "inventory": "1030",
    "ap": "2000",
    "cgst": "2010",
    "sgst": "2020",
    "igst": "2030",
    "sales": "4000",
    "service": "4010",
    "packaging": "4020",
    "tip": "4030",
    "cogs": "5000",
    "wastage": "5010",
}


def _handler_db() -> AsyncSession:
    """A session owned by an event handler, not by a request."""
    from src.services.accounting.main import db as _db

    return _db.session_factory()


def _coerce_uuid(value) -> uuid.UUID | None:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


def _tenant(event: Event) -> uuid.UUID | None:
    """The bus serialises tenant_id as a string across processes; accept both."""
    value = event.tenant_id
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


async def _acct(db: AsyncSession, tenant_id: uuid.UUID, code: str) -> ChartOfAccount | None:
    return await db.scalar(
        select(ChartOfAccount).where(
            ChartOfAccount.tenant_id == tenant_id,
            ChartOfAccount.code == code,
        )
    )


async def _already_posted(
    db: AsyncSession, tenant_id: uuid.UUID, ref_type: str, ref_id: str
) -> bool:
    """Structural idempotency: a journal with this (ref_type, ref_id) exists."""
    row = await db.scalar(
        select(JournalEntry.id).where(
            JournalEntry.tenant_id == tenant_id,
            JournalEntry.reference_type == ref_type,
            JournalEntry.reference_id == ref_id,
        ).limit(1)
    )
    return row is not None


async def _post(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID | None,
    *,
    reference_type: str,
    reference_id: str,
    narration: str,
    debits: list[tuple[str, float]],
    credits: list[tuple[str, float]],
) -> JournalEntry | None:
    """Build + post a balanced journal entry from (account_code, amount) pairs.

    The residual paise (round-off) is absorbed by the largest debit line, the
    standard practice, so an event whose totals disagree by a cent still posts.
    Returns None when the tenant has no chart of accounts yet (logged, not
    raised — the next event retries).
    """
    from src.services.accounting import service as svc

    debits = [(c, round(float(a), 2)) for c, a in debits if a and abs(a) > 0.004]
    credits = [(c, round(float(a), 2)) for c, a in credits if a and abs(a) > 0.004]
    if not debits or not credits:
        return None

    # Resolve codes to account rows; seed the default chart if the tenant is
    # new (idempotent).
    all_codes = [c for c, _ in debits] + [c for c, _ in credits]
    await svc.seed_default_accounts(db, tenant_id)
    rows = {
        code: await _acct(db, tenant_id, code) for code in dict.fromkeys(all_codes)
    }
    missing = [c for c, a in rows.items() if a is None]
    if missing:
        logger.warning(
            "Tenant %s has no GL accounts %s; skipping %s posting %s",
            tenant_id, missing, reference_type, reference_id,
        )
        return None

    total_d = round(sum(a for _, a in debits), 2)
    total_c = round(sum(a for _, a in credits), 2)
    diff = round(total_d - total_c, 2)
    if abs(diff) > 0.05:
        # Not a round-off — the event and the GL disagree materially. Do not
        # post an unbalanced entry; a human looks at it.
        logger.warning(
            "Refusing unbalanced %s posting for %s: debits %.2f vs credits %.2f",
            reference_type, reference_id, total_d, total_c,
        )
        return None
    # Absorb the residual into the largest debit line.
    if diff:
        idx = max(range(len(debits)), key=lambda i: debits[i][1])
        c, a = debits[idx]
        debits[idx] = (c, round(a + diff, 2))

    # entry_number is NOT NULL and part of a (tenant, entry_number) unique
    # constraint, so it must be generated like the manual path does.
    seq = await db.scalar(
        select(func.count(JournalEntry.id)).where(JournalEntry.tenant_id == tenant_id)
    ) or 0
    je = JournalEntry(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        entry_number=f"JE-{datetime.now().strftime('%y%m')}-{seq + 1:04d}-{reference_type}",
        reference_type=reference_type,
        reference_id=reference_id,
        narration=narration,
        status=JournalEntryStatus.POSTED,
        entry_date=date.today(),
    )
    db.add(je)
    await db.flush()
    for code, amount in debits:
        db.add(JournalEntryLine(
            tenant_id=tenant_id, journal_entry_id=je.id,
            account_id=rows[code].id, debit=amount, credit=0,
            description=narration,
        ))
    for code, amount in credits:
        db.add(JournalEntryLine(
            tenant_id=tenant_id, journal_entry_id=je.id,
            account_id=rows[code].id, debit=0, credit=amount,
        ))
    await db.flush()
    return je


def _f(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


# ─── Consumers ────────────────────────────────────────────────────────────────


@bus.on("bill.paid")
async def _on_bill_paid(event: Event) -> None:
    """Auto-post a sale to the GL: revenue + GST payables vs cash/bank/AR.

    Dr 1000 Cash (cash legs) / 1010 Bank (everything else) — or Dr 1020 AR
    when the bill is a credit sale —
    Cr 4000 Sales (food) + 4010 service charge + 4020 packaging +
    4030 tip + 2010/2020/2030 tax split.

    Every collected rupee must land in some revenue or payable account, or
    the entry is unbalanced and _post refuses it — which is how a single
    tipped bill silently breaks the whole auto-accounting chain. The bill
    collects subtotal + service + packaging + tip + tax (+ round-off), so
    each is credited to its own account; zero lines are dropped by _post.
    """
    data = event.data or {}
    tenant = _tenant(event)
    if tenant is None or not data.get("bill_id"):
        return
    outlet = _coerce_uuid(event.outlet_id) or _coerce_uuid(data.get("outlet_id"))

    credits = [
        # Round-off (the paise the bill rounds up/down by) is booked into
        # food sales — without it, a ₹0.48 round-up leaves the entry 0.48
        # short of the collected amount and _post refuses the whole entry.
        (_ACCT["sales"], _f(data.get("subtotal")) + _f(data.get("round_off"))),
        (_ACCT["service"], _f(data.get("service_charge"))),
        (_ACCT["packaging"], _f(data.get("packaging_charge"))),
        (_ACCT["tip"], _f(data.get("tip"))),
        (_ACCT["cgst"], _f(data.get("cgst_total"))),
        (_ACCT["sgst"], _f(data.get("sgst_total"))),
        (_ACCT["igst"], _f(data.get("igst_total") or data.get("cess_total"))),
    ]
    if data.get("is_credit_sale"):
        debits = [(_ACCT["ar"], _f(data.get("grand_total")))]
    else:
        cash = _f(data.get("cash_amount"))
        total = _f(data.get("paid_amount")) or _f(data.get("grand_total"))
        debits = [(_ACCT["cash"], cash), (_ACCT["bank"], round(total - cash, 2))]

    db = _handler_db()
    try:
        ref = f"{data.get('bill_number') or data.get('bill_id')}"
        if await _already_posted(db, tenant, "bill", str(data["bill_id"])):
            return
        je = await _post(
            db, tenant, outlet,
            reference_type="bill", reference_id=str(data["bill_id"]),
            narration=f"Sale {ref}: revenue + GST auto-posted from bill.paid",
            debits=debits, credits=credits,
        )
        await db.commit()
        if je:
            logger.info("bill.paid %s -> journal %s", data.get("bill_id"), je.id)
    except Exception:
        await db.rollback()
        logger.exception("accounting: bill.paid posting failed for %s", data.get("bill_id"))
    finally:
        await db.close()


@bus.on("bill.refunded")
async def _on_bill_refunded(event: Event) -> None:
    """Reverse a refund against revenue: Cr 4000 (refunded amount), Dr 1000/1010.

    Tax legs are not re-split (the original entry's payables stay as posted;
    a GSTR filing would reconcile the difference — kept deliberately simple
    and balanced)."""
    data = event.data or {}
    tenant = _tenant(event)
    if tenant is None or not data.get("bill_id"):
        return
    amount = _f(data.get("refund_amount"))
    if amount <= 0:
        return
    db = _handler_db()
    try:
        ref_id = f"{data.get('bill_id')}:{data.get('payment_id')}"
        if await _already_posted(db, tenant, "bill-refund", ref_id):
            return
        je = await _post(
            db, tenant, _coerce_uuid(event.outlet_id),
            reference_type="bill-refund", reference_id=ref_id,
            narration=f"Refund of bill {data.get('bill_number') or data.get('bill_id')}: {amount:.2f}",
            debits=[(_ACCT["cash"], amount)],
            credits=[(_ACCT["sales"], amount)],
        )
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("accounting: bill.refunded posting failed for %s", data.get("bill_id"))
    finally:
        await db.close()


@bus.on("payment.received")
async def _on_payment_received(event: Event) -> None:
    """Collecting a credit sale: Dr 1000/1010, Cr 1020 AR.

    Cash legs only — card collections settle through the acquiring bank and
    are already bank money from the GL's point of view (booking both would
    double the cash)."""
    data = event.data or {}
    tenant = _tenant(event)
    if tenant is None or not data.get("bill_id"):
        return
    cash = _f(data.get("cash_amount"))
    if cash <= 0:
        return
    db = _handler_db()
    try:
        # The bill is the stable domain reference: a redelivered event and a
        # re-settled same-cash-amount collection both land on the same
        # journal. (An earlier version stamped a per-event timestamp in the
        # reference, which made the guard below never fire and let every
        # redelivery post a second journal.)
        ref_id = str(data.get("bill_id"))
        if await _already_posted(db, tenant, "bill-payment", ref_id):
            return
        je = await _post(
            db, tenant, _coerce_uuid(event.outlet_id),
            reference_type="bill-payment", reference_id=ref_id,
            narration=f"Credit sale collected (bill {data.get('bill_number') or data.get('bill_id')}): cash {cash:.2f}",
            debits=[(_ACCT["cash"], cash)],
            credits=[(_ACCT["ar"], cash)],
        )
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("accounting: payment.received posting failed for %s", data.get("bill_id"))
    finally:
        await db.close()


@bus.on("grn.posted")
async def _on_grn_posted(event: Event) -> None:
    """Goods received on a PO: Dr 1030 Inventory Asset, Cr 2000 AP.

    The vendor bill's settlement (vendor-payments route) is where AP would
    clear to bank; we keep that manual for now."""
    data = event.data or {}
    tenant = _tenant(event)
    if tenant is None or not data.get("grn_id"):
        return
    amount = _f(data.get("amount"))
    if amount <= 0:
        return
    db = _handler_db()
    try:
        if await _already_posted(db, tenant, "grn", str(data["grn_id"])):
            return
        je = await _post(
            db, tenant, _coerce_uuid(event.outlet_id),
            reference_type="grn", reference_id=str(data["grn_id"]),
            narration=f"GRN {data.get('grn_number') or data.get('grn_id')} received: inventory + AP",
            debits=[(_ACCT["inventory"], amount)],
            credits=[(_ACCT["ap"], amount)],
        )
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("accounting: grn.posted posting failed for %s", data.get("grn_id"))
    finally:
        await db.close()


@bus.on("adjustment.approved")
async def _on_adjustment_approved(event: Event) -> None:
    """An approved stock adjustment moves value in/out of the inventory asset.

    Shrinkage (negative delta) → Dr 5000 COGS, Cr 1030; a correction
    upwards → the mirror. Skipped when the event carries no valuation —
    a zero-amount journal is rejected by the post guard anyway."""
    data = event.data or {}
    tenant = _tenant(event)
    if tenant is None or not data.get("adjustment_id"):
        return
    qty = _f(data.get("qty_delta"))
    value = _f(data.get("value"))
    if qty == 0 or value <= 0:
        return
    db = _handler_db()
    try:
        ref = f"{data.get('adjustment_id')}"
        if await _already_posted(db, tenant, "adjustment", ref):
            return
        if qty < 0:
            je = await _post(
                db, tenant, _coerce_uuid(event.outlet_id),
                reference_type="adjustment", reference_id=ref,
                narration=f"Stock shrinkage (adjustment {ref}): COGS + / inventory -",
                debits=[(_ACCT["cogs"], value)],
                credits=[(_ACCT["inventory"], value)],
            )
        else:
            je = await _post(
                db, tenant, _coerce_uuid(event.outlet_id),
                reference_type="adjustment", reference_id=ref,
                narration=f"Stock correction upwards (adjustment {ref}): inventory + / COGS -",
                debits=[(_ACCT["inventory"], value)],
                credits=[(_ACCT["cogs"], value)],
            )
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("accounting: adjustment.approved posting failed for %s", ref)
    finally:
        await db.close()


@bus.on("wastage.recorded")
async def _on_wastage_recorded(event: Event) -> None:
    """Wastage shrinks the inventory asset and hits the wastage expense line."""
    data = event.data or {}
    tenant = _tenant(event)
    if tenant is None or not data.get("wastage_id"):
        return
    value = _f(data.get("loss_amount"))
    if value <= 0:
        return
    db = _handler_db()
    try:
        ref = f"{data.get('wastage_id')}"
        if await _already_posted(db, tenant, "wastage", ref):
            return
        je = await _post(
            db, tenant, _coerce_uuid(event.outlet_id),
            reference_type="wastage", reference_id=ref,
            narration=f"Wastage ({data.get('reason') or 'unspecified'}): loss {value:.2f}",
            debits=[(_ACCT["wastage"], value)],
            credits=[(_ACCT["inventory"], value)],
        )
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("accounting: wastage.recorded posting failed for %s", ref)
    finally:
        await db.close()
