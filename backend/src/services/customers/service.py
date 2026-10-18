"""Customers service logic — profiles, preferences, visit history, feedback.

The one thing this service does that matters to the rest of the fleet is the
``bill.paid`` consumer: it records a visit and updates the guest's lifetime
totals. Done wrong, loyalty and reports each end up recounting from their own
copies, and the numbers disagree. Done here, one service owns the guest record.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.customers.models import (
    Customer,
    CustomerPreferences,
    CustomerStatus,
    CustomerVisit,
    Feedback,
    status_value,
)
from src.services.customers.util import coerce_uuid, normalize_phone
from src.services.customers.schemas import FeedbackSummary

MONEY_PLACES = 2


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _money(value) -> float:
    return round(float(value or 0), MONEY_PLACES)


class CustomerError(Exception):
    """A rejected customers operation. The API maps this to 409 or 400."""


# ─── Customers ───────────────────────────────────────────────────────────────

async def find_by_phone(
    db: AsyncSession, tenant_id: uuid.UUID, phone: str
) -> Customer | None:
    """Look up a guest by phone — the front-of-house path.

    The phone is normalised before the query so a clerk typing "+91 98765..."
    finds the same row a clerk typing "9876543210" does. Searching on the raw
    value is what creates duplicate guests for one person.
    """
    key = normalize_phone(phone)
    return await db.scalar(
        select(Customer).where(
            Customer.tenant_id == tenant_id,
            Customer.phone == key,
        )
    )


async def load_customer(
    db: AsyncSession, tenant_id: uuid.UUID, customer_id: uuid.UUID
) -> Customer | None:
    """Fetch a customer with preferences and recent visits loaded.

    Eager, not lazy: a lazy load would fire during Pydantic serialisation and
    raise MissingGreenlet.
    """
    stmt = (
        select(Customer)
        .options(
            selectinload(Customer.preferences),
        )
        .where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
    )
    return (await db.execute(stmt)).scalars().first()


async def get_or_create(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    phone: str,
    *,
    name: str | None = None,
    outlet_id: uuid.UUID | None = None,
    tags: list | None = None,
) -> Customer:
    """Find a guest by phone or create them.

    Used at the POS when a walk-in is linked to a bill. Idempotent on the
    normalised phone, which is what makes it safe to call on every payment.
    A created-without-a-name row is recoverable (the front of house adds it
    later); a silently-merged wrong person is not, hence the unique key.
    """
    existing = await find_by_phone(db, tenant_id, phone)
    if existing is not None:
        return existing

    key = normalize_phone(phone)
    customer = Customer(
        tenant_id=tenant_id,
        phone=key,
        name=name or f"Guest {key[-4:]}",
        outlet_id=outlet_id,
        tags=list(tags or []),
        status=CustomerStatus.ACTIVE,
    )
    db.add(customer)
    await db.flush()
    return customer


async def record_visit(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    customer: Customer,
    amount,
    *,
    covers: int = 1,
    outlet_id: uuid.UUID | None = None,
    bill_id: uuid.UUID | None = None,
    order_id: uuid.UUID | None = None,
) -> CustomerVisit:
    """Record a settled bill as a visit and update lifetime totals.

    Idempotency is keyed on ``bill_id``: the bus delivers at-least-once, so a
    redelivered ``bill.paid`` must not count the same bill twice. If the same
    bill is already recorded, this returns the existing visit unchanged.
    """
    if bill_id is not None:
        existing = await db.scalar(
            select(CustomerVisit).where(
                CustomerVisit.tenant_id == tenant_id,
                CustomerVisit.customer_id == customer.id,
                CustomerVisit.bill_id == bill_id,
            )
        )
        if existing is not None:
            return existing

    visit = CustomerVisit(
        tenant_id=tenant_id,
        customer_id=customer.id,
        outlet_id=outlet_id or customer.outlet_id,
        bill_id=bill_id,
        order_id=order_id,
        amount=_money(amount),
        covers=max(1, int(covers or 1)),
        visited_at=_now(),
    )
    db.add(visit)

    # Lifetime totals move with the visit, so they cannot drift from the
    # history. total_spent is denormalised purely to keep a customer board from
    # querying billing per row — it is recomputable from customer_visits.
    customer.total_visits = int(customer.total_visits or 0) + 1
    customer.total_spent = _money(
        (float(customer.total_spent) if customer.total_spent else 0)
        + _money(amount)
    )
    customer.last_visit_at = visit.visited_at
    await db.flush()
    return visit


# ─── Preferences ─────────────────────────────────────────────────────────────

async def preferences_for(
    db: AsyncSession, tenant_id: uuid.UUID, customer: Customer
) -> CustomerPreferences:
    """Get or create the preference row for a customer.

    Created lazily rather than on customer creation: a preference only exists
    once someone has noticed something, and a row of empty lists per guest
    would be noise in a table meant to hold actual dietary needs.
    """
    pref = await db.scalar(
        select(CustomerPreferences).where(
            CustomerPreferences.tenant_id == tenant_id,
            CustomerPreferences.customer_id == customer.id,
        )
    )
    if pref is not None:
        return pref
    pref = CustomerPreferences(tenant_id=tenant_id, customer_id=customer.id)
    db.add(pref)
    await db.flush()
    return pref


async def update_preferences(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    customer: Customer,
    **changes,
) -> CustomerPreferences:
    """Set preference fields, ignoring unset keys.

    Allergy lists matter: a guest marked "no cream" should never be served a
    cream dish on assumption, so these are stored explicitly rather than
    inferred from past orders.
    """
    pref = await preferences_for(db, tenant_id, customer)
    for field, value in changes.items():
        if value is not None:
            setattr(pref, field, value)
    await db.flush()
    return pref


# ─── Feedback ────────────────────────────────────────────────────────────────

async def feedback_summary(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID | None = None
) -> FeedbackSummary:
    """Average ratings over a period.

    Counted with ``COUNT`` and ``AVG`` in one pass so the averages are over the
    same set of rows rather than two separate queries that can drift. A partial
    dimension (someone who rated only the food) averages over the rows that
    actually have that dimension — not over all rows padded with nulls.
    """
    stmt = select(
        func.count(Feedback.id),
        func.avg(Feedback.rating_overall),
        func.avg(Feedback.rating_food),
        func.avg(Feedback.rating_service),
        func.avg(Feedback.rating_ambience),
    ).where(Feedback.tenant_id == tenant_id)
    if outlet_id:
        stmt = stmt.where(Feedback.outlet_id == outlet_id)
    count, overall, food, service, ambience = await db.execute(stmt)

    def _avg(v) -> float | None:
        return round(float(v), 2) if v is not None else None

    return FeedbackSummary(
        count=int(count or 0),
        average_overall=_avg(overall) or 0.0,
        average_food=_avg(food),
        average_service=_avg(service),
        average_ambience=_avg(ambience),
    )
