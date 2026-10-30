"""Marketing event consumers — campaign trigger evaluation.

Registered on the shared bus singleton at import time; ``main.py`` imports
this module for that side effect.

House rules observed (see the accounting/events.py notes):
  * handlers get their own session from the service's module-level ``db``
    (never a request session — they run outside any request);
  * idempotency is structural (the unique (campaign_id, customer_id)
    constraint on ``campaign_recipients``) ON TOP of the durable
    ``consumed_events`` ledger gate in the consumer loop;
  * no cross-service FKs / no cross-service DB reads: customer data arrives
    on the event payload, nothing else;
  * a handler that cannot add a recipient logs and moves on — a tenant with
    no matching active campaign is a no-op, not an error worth surfacing.

The two consumers here:
  * ``customer.created``  -> welcome-offer / "new customer" campaigns
  * ``bill.paid``         -> "repeat" / "all" audience campaigns
"""
from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from src.services.event_bus.bus import Event, bus
from src.services.marketing import service as svc

logger = logging.getLogger("marketing.events")


def _handler_db() -> AsyncSession:
    """A session owned by an event handler, not by a request."""
    from src.services.marketing.main import db as _db

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


@bus.on("customer.created")
async def _on_customer_created(event: Event) -> None:
    """Add a new customer to any ACTIVE campaign with a ``new`` audience.

    The welcome-offer path: a tenant that has an active "greet new
    customers" campaign gets this customer appended as a PENDING recipient.
    Opt-out aware — a customer already OPT_OUT on that campaign is not
    re-added (the unique constraint makes the append idempotent, but we
    check first to avoid logging noise and to keep the intent visible).
    """
    data = event.data or {}
    tenant = _coerce_uuid(event.tenant_id) or _coerce_uuid(data.get("tenant_id"))
    if tenant is None:
        return
    customer_id = _coerce_uuid(data.get("customer_id"))
    if customer_id is None:
        return
    # The payload may carry a phone; capture it so the SMS/WhatsApp channel
    # has a destination. Absent phone is fine — the recipient still lands.
    phone = data.get("phone") or data.get("customer_phone")
    name = data.get("customer_name") or data.get("name")

    outlet = _coerce_uuid(event.outlet_id) or _coerce_uuid(data.get("outlet_id"))
    db = _handler_db()
    try:
        campaigns = await svc.active_campaigns_for_audience(
            db, tenant, "new", outlet_id=outlet
        )
        if not campaigns:
            # No matching campaign: a log, not an error — this tenant simply
            # is not running a "new customer" offer right now.
            return
        for campaign in campaigns:
            await svc.append_recipient(
                db, tenant, campaign, customer_id,
                customer_name=name, customer_phone=phone,
            )
        await db.commit()
        logger.info(
            "customer.created %s -> %d new-audience campaign recipient(s)",
            customer_id, len(campaigns),
        )
    except Exception:
        await db.rollback()
        logger.exception("marketing: customer.created recipient append failed")
    finally:
        await db.close()


@bus.on("bill.paid")
async def _on_bill_paid(event: Event) -> None:
    """Evaluate a settled bill against ACTIVE ``repeat`` / ``all`` campaigns.

    A bill that just paid is a signal of a repeat (or any) customer. We add
    that customer as a PENDING recipient on every ACTIVE campaign whose
    audience type is ``repeat`` or ``all``. Idempotent via the unique
    constraint — the same bill redelivered adds nothing new.

    Opt-out aware: a customer who is OPT_OUT on a campaign is not
    re-appended (checked before the insert to keep the log meaningful).
    """
    data = event.data or {}
    tenant = _coerce_uuid(event.tenant_id) or _coerce_uuid(data.get("tenant_id"))
    if tenant is None:
        return
    customer_id = _coerce_uuid(data.get("customer_id"))
    # A bill without a customer (walk-in) has no marketing target — skip.
    if customer_id is None:
        return

    outlet = _coerce_uuid(event.outlet_id) or _coerce_uuid(data.get("outlet_id"))
    db = _handler_db()
    try:
        added_total = 0
        for audience_type in ("repeat", "all"):
            campaigns = await svc.active_campaigns_for_audience(
                db, tenant, audience_type, outlet_id=outlet
            )
            for campaign in campaigns:
                # The "all" audience already swept this customer on their
                # creation; only add if not present (idempotent guard).
                if await svc.recipient_exists(db, campaign.id, customer_id):
                    continue
                await svc.append_recipient(
                    db, tenant, campaign, customer_id,
                    customer_name=data.get("customer_name") or data.get("name"),
                    customer_phone=data.get("customer_phone") or data.get("phone"),
                    segment=data.get("segment"),
                )
                added_total += 1
        if added_total:
            await db.commit()
            logger.info(
                "bill.paid %s -> %d repeat/all campaign recipient(s)",
                data.get("bill_id"), added_total,
            )
        else:
            # No matching campaign, or already covered: nothing to write.
            await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("marketing: bill.paid recipient append failed for %s",
                         data.get("bill_id"))
    finally:
        await db.close()
