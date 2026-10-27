"""Customers service endpoints.

Who may call what:
  * read — ``view:customers``
  * write — ``manage:customers``

Events:
  subscribes bill.paid  (record the visit, update lifetime totals)
  publishes  customer.created, customer.updated, customer.deleted

``bill.paid`` is the one link that matters: customers owns the guest record and
lifetime totals, so both loyalty and reports read from it rather than each
recounting. Duplicate bills are ignored via a bill_id key.
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status as http_status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.customers import service as svc
from src.services.customers.models import (
    Customer,
    CustomerVisit,
    Feedback,
)
from src.services.customers.schemas import (
    CustomerCreate,
    CustomerResponse,
    CustomerUpdate,
    FeedbackCreate,
    FeedbackResponse,
    FeedbackSummary,
    FeedbackUpdate,
    PreferencesResponse,
    PreferencesUpdate,
    VisitResponse,
)
from src.services.customers.util import coerce_uuid
from src.services.event_bus.bus import Event, bus
from src.services.shared.identity import CurrentIdentity

router = APIRouter()


async def get_db(request: Request) -> AsyncSession:
    """One session per request, committed on success, rolled back on error."""
    session = request.app.state.db.session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


DbDep = Annotated[AsyncSession, Depends(get_db)]


def _handler_db() -> AsyncSession:
    """A session owned by an event handler, not by a request."""
    from src.services.customers.main import db as _db

    return _db.session_factory()


def _ev(topic, tenant_id=None, outlet_id=None, data=None):
    return Event(type=topic, tenant_id=tenant_id, outlet_id=outlet_id,
                 data=data or {}, source_service="customers")


def _tenant(event: Event) -> uuid.UUID | None:
    """Tenant id from an event, always as a UUID.

    The bus serialises tenant_id as a STRING (see ``Event.to_json``).
    Dispatched within one process a consumer receives the original UUID, but
    across processes it round-trips through Redis and ``Event.from_json``
    yields a bare str. Comparing a str against a UUID column returns zero rows
    rather than raising — the event is acked and silently dropped. Tolerate the
    string; everything downstream expects a UUID.
    """
    value = event.tenant_id
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


def _outbox(db: AsyncSession, event: Event) -> None:
    """Write the event to the outbox inside the current transaction.

    The outbox row is added to the same session that owns the domain change,
    so both commit or roll back together. The relay background task picks up
    pending rows and pushes them to the event bus.
    """
    from src.services.customers.models import OutboxMessage

    db.add(OutboxMessage(
        event_id=event.event_id,
        type=event.type,
        tenant_id=event.tenant_id,
        outlet_id=event.outlet_id,
        data=event.data,
        source_service=event.source_service,
        status="pending",
    ))


# ─── Consumers ────────────────────────────────────────────────────────────────

@bus.on("bill.paid")
async def _on_bill_paid(event: Event) -> None:
    """Record a settled bill as a visit and update lifetime totals.

    A guest must have a phone number on the bill to be recorded: linking a
    payment to an unknown customer would create phantom profiles. If the phone
    is new, create the guest first — a walk-in becomes a customer at their first
    payment, which is when the guest record should exist.

    Idempotency is delegated to ``record_visit``, which is keyed on bill_id:
    the bus delivers at-least-once, and a redelivered event would otherwise
    double-count a visit and lifetime spend.
    """
    data = event.data or {}
    tenant = _tenant(event)
    if tenant is None or not data.get("bill_id"):
        return
    bill_id = coerce_uuid(data.get("bill_id"))
    outlet = coerce_uuid(data.get("outlet_id"))
    if bill_id is None:
        return

    # Only a named guest can be attributed. A bill with no customer is a
    # walk-in that never shared a phone — there is no one to credit it to.
    customer_id = coerce_uuid(data.get("customer_id"))
    phone = data.get("phone") or data.get("customer_phone")
    if customer_id is None and not phone:
        return

    db = _handler_db()
    try:
        if customer_id is not None:
            customer = await svc.load_customer(db, tenant, customer_id)
            if customer is None:
                await db.rollback()
                return
        else:
            customer = await svc.get_or_create(db, tenant, phone, outlet_id=outlet)

        visit = await svc.record_visit(
            db, tenant, customer, data.get("grand_total") or 0,
            covers=int(data.get("covers") or 1),
            outlet_id=outlet, bill_id=bill_id,
        )
        event = _ev(
            "customer.updated", tenant, outlet,
            data={
                "customer_id": str(customer.id),
                "visit_id": str(visit.id),
                "total_visits": customer.total_visits,
                "total_spent": float(customer.total_spent),
            },
        )
        _outbox(db, event)
        await db.commit()
        await bus.publish(event, local=True)
    except Exception:
        await db.rollback()
        raise
    finally:
        await db.close()


# ─── Customers ───────────────────────────────────────────────────────────────

@router.get("/customers", response_model=list[CustomerResponse], tags=["customers"])
async def list_customers(identity: CurrentIdentity, db: DbDep,
                         outlet_id: uuid.UUID | None = None,
                         status_filter: str | None = None,
                         search: str | None = None,
                         limit: int = Query(default=100, le=500)):
    identity.require("view:customers")
    stmt = select(Customer).where(Customer.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(Customer.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(Customer.status == status_filter)
    # Search on name, phone, or email — the three things a clerk actually has.
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(Customer.name.ilike(pattern))
    stmt = stmt.order_by(Customer.total_spent.desc()).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


@router.get("/customers/phone/{phone}", response_model=CustomerResponse,
            tags=["customers"], summary="Find a guest by phone")
async def get_customer_by_phone(phone: str, identity: CurrentIdentity, db: DbDep):
    """The front-of-house lookup: a walk-in calls, the clerk enters the number.

    The phone is normalised before the query, so "+91 98765 43210" and
    "9876543210" resolve to the same guest.
    """
    identity.require("view:customers")
    customer = await svc.find_by_phone(db, identity.tenant_id, phone)
    if customer is None:
        raise HTTPException(status_code=404, detail="No customer with that phone")
    return customer


@router.post("/customers", response_model=CustomerResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["customers"])
async def create_customer(payload: CustomerCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:customers")
    existing = await svc.find_by_phone(db, identity.tenant_id, payload.phone)
    if existing is not None:
        # Refuse rather than merge: two different customers on one phone is
        # almost always a data error, and merging would erase one profile.
        raise HTTPException(
            status_code=409,
            detail="A customer with that phone number already exists",
        )
    customer = Customer(tenant_id=identity.tenant_id, **payload.model_dump())
    db.add(customer)
    await db.flush()
    event = _ev(
        "customer.created", identity.tenant_id, customer.outlet_id,
        data={"customer_id": str(customer.id), "phone": customer.phone},
    )
    _outbox(db, event)
    await db.commit()
    await bus.publish(event, local=True)
    return customer


@router.get("/customers/{customer_id}", response_model=CustomerResponse,
            tags=["customers"])
async def get_customer(customer_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:customers")
    customer = await svc.load_customer(db, identity.tenant_id, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.patch("/customers/{customer_id}", response_model=CustomerResponse,
              tags=["customers"])
async def update_customer(customer_id: uuid.UUID, payload: CustomerUpdate,
                          identity: CurrentIdentity, db: DbDep):
    identity.require("manage:customers")
    customer = await svc.load_customer(db, identity.tenant_id, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    await db.flush()
    return customer


@router.delete("/customers/{customer_id}", tags=["customers"],
                 summary="Delete a guest profile")
async def delete_customer(customer_id: uuid.UUID, identity: CurrentIdentity,
                           db: DbDep):
    """Remove a guest profile.

    A hard delete is only safe because the child rows (preferences, visits,
    feedback) cascade. The event is published so downstream services — loyalty
    in particular — know the guest is gone instead of continuing to credit a
    profile that no longer exists.
    """
    identity.require("manage:customers")
    customer = await svc.load_customer(db, identity.tenant_id, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    event = _ev(
        "customer.deleted", identity.tenant_id, customer.outlet_id,
        data={
            "customer_id": str(customer.id),
            "tenant_id": str(identity.tenant_id),
            "phone": customer.phone,
        },
    )
    _outbox(db, event)
    await db.delete(customer)
    await db.commit()
    await bus.publish(event, local=True)
    return {"status": "deleted", "deleted_id": str(customer_id)}


# ─── Preferences ─────────────────────────────────────────────────────────────

@router.get("/customers/{customer_id}/preferences", response_model=PreferencesResponse,
            tags=["preferences"])
async def get_preferences(customer_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:customers")
    customer = await svc.load_customer(db, identity.tenant_id, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return await svc.preferences_for(db, identity.tenant_id, customer)


@router.put("/customers/{customer_id}/preferences", response_model=PreferencesResponse,
            tags=["preferences"],
            summary="Set a guest's dining preferences and allergies")
async def put_preferences(customer_id: uuid.UUID, payload: PreferencesUpdate,
                          identity: CurrentIdentity, db: DbDep):
    """Update dietary needs and preferences.

    Allergies are recorded explicitly rather than inferred from past orders: a
    guest who has never ordered a cream dish may still need to be told not to
    be served one, so the list is a stated fact, not a guess from history.
    """
    identity.require("manage:customers")
    customer = await svc.load_customer(db, identity.tenant_id, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return await svc.update_preferences(
        db, identity.tenant_id, customer, **payload.model_dump(exclude_unset=True)
    )


# ─── Visits ──────────────────────────────────────────────────────────────────

@router.get("/customers/{customer_id}/visits", response_model=list[VisitResponse],
            tags=["visits"], summary="Visit history for a guest")
async def list_visits(customer_id: uuid.UUID, identity: CurrentIdentity, db: DbDep,
                      limit: int = Query(default=50, le=500)):
    identity.require("view:customers")
    customer = await svc.load_customer(db, identity.tenant_id, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    stmt = (
        select(CustomerVisit)
        .where(
            CustomerVisit.tenant_id == identity.tenant_id,
            CustomerVisit.customer_id == customer_id,
        )
        .order_by(CustomerVisit.visited_at.desc())
        .limit(limit)
    )
    return list((await db.execute(stmt)).scalars().all())


# ─── Feedback ────────────────────────────────────────────────────────────────

@router.post("/feedback", response_model=FeedbackResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["feedback"])
async def create_feedback(payload: FeedbackCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:customers")
    feedback = Feedback(tenant_id=identity.tenant_id, **payload.model_dump())
    db.add(feedback)
    await db.flush()
    return feedback


@router.get("/feedback", response_model=list[FeedbackResponse], tags=["feedback"])
async def list_feedback(identity: CurrentIdentity, db: DbDep,
                        outlet_id: uuid.UUID | None = None,
                        status_filter: str | None = None,
                        limit: int = Query(default=100, le=500)):
    identity.require("view:customers")
    stmt = select(Feedback).where(Feedback.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(Feedback.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(Feedback.status == status_filter)
    stmt = stmt.order_by(Feedback.created_at.desc()).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


@router.get("/feedback/summary", response_model=FeedbackSummary, tags=["feedback"])
async def feedback_summary(identity: CurrentIdentity, db: DbDep,
                           outlet_id: uuid.UUID | None = None):
    """Average ratings for the quality board."""
    identity.require("view:customers")
    return await svc.feedback_summary(db, identity.tenant_id, outlet_id)


@router.patch("/feedback/{feedback_id}", response_model=FeedbackResponse,
              tags=["feedback"], summary="Acknowledge or resolve feedback")
async def update_feedback(feedback_id: uuid.UUID, payload: FeedbackUpdate,
                          identity: CurrentIdentity, db: DbDep):
    identity.require("manage:customers")
    feedback = await db.scalar(
        select(Feedback).where(
            Feedback.id == feedback_id,
            Feedback.tenant_id == identity.tenant_id,
        )
    )
    if feedback is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(feedback, field, value)
    await db.flush()
    return feedback
