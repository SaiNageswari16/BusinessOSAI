"""Purchase service endpoints.

Who may call what:
  * read — ``view:purchase``
  * write — ``manage:purchase``

Events:
  subscribes stock.out, stock.low  (inventory runs low -> raise a purchase request)
  publishes  po.created, po.approved, grn.posted, vendor_bill.created

The important link is outbound: ``grn.posted`` is what tells inventory to add
the stock we just received. Without it a GRN is a document with no effect on
the store, and the inventory service would never learn that goods arrived.
"""
from __future__ import annotations

import logging
import uuid
from typing import Annotated

logger = logging.getLogger("purchase.api")

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status as http_status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.event_bus.bus import Event, bus
from src.services.purchase import service as svc
from src.services.purchase.service import _member, _money
from src.services.purchase.models import (
    GoodsReceiptNote,
    GRNStatus,
    PaymentStatus,
    VendorItem,
    POStatus,
    PRStatus,
    PurchaseOrder,
    PurchaseRequest,
    Vendor,
    VendorBill,
    VendorBillStatus,
)
from src.services.purchase.schemas import (
    GRNCreate,
    GRNResponse,
    POLineIn,
    PRDecision,
    PRLineIn,
    PurchaseOrderCreate,
    PurchaseOrderResponse,
    PurchaseRequestCreate,
    PurchaseRequestResponse,
    QCDecision,
    VendorBillCreate,
    VendorBillResponse,
    VendorCreate,
    VendorPaymentCreate,
    VendorPaymentResponse,
    VendorResponse,
    VendorUpdate,
)
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
    from src.services.purchase.main import db as _db

    return _db.session_factory()


def _ev(topic, tenant_id=None, outlet_id=None, data=None):
    return Event(type=topic, tenant_id=tenant_id, outlet_id=outlet_id,
                 data=data or {}, source_service="purchase")


def _coerce_uuid(value) -> uuid.UUID | None:
    """Parse a UUID from event data without raising on bad input."""
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


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
    pending rows and pushes them to the event bus. A crashed process leaves
    the row in the database; the relay on the next boot picks it up.
    """
    from src.services.purchase.models import OutboxMessage

    db.add(OutboxMessage(
        event_id=event.event_id,
        type=event.type,
        tenant_id=event.tenant_id,
        outlet_id=event.outlet_id,
        data=event.data,
        source_service=event.source_service,
        status="pending",
    ))


async def _publish(event: Event) -> None:
    """Publish an event that is already durable in the outbox.

    The outbox row is the source of truth, so a bus failure here is not a
    request failure — the relay retries the row on its next poll. Swallowing
    the error keeps a flaky bus from turning a committed purchase into a 500.
    """
    try:
        await bus.publish(event, local=True)
    except Exception as exc:  # pragma: no cover - bus failure path
        logger.warning("Event publish failed for %s: %s", event.type, exc)


# ─── Consumers ────────────────────────────────────────────────────────────────

@bus.on("stock.out", "stock.low")
async def _on_stock_low(event: Event) -> None:
    """Raise a purchase request when inventory signals it is running out.

    This is the top of the P2P chain: a stockout becomes a PR, which becomes a
    PO, which becomes a GRN. Nothing here auto-approves — an autonomous purchase
    of unknown quantity is how you end up with a walk-in refrigerator of
    vegetables you did not need.

    Idempotency: a stock.low for the same item with an open PR is not new work.
    Looking for an existing submitted/approved PR avoids piling up one request
    per redelivered event.
    """
    data = event.data or {}
    tenant = _tenant(event)
    if tenant is None or not data.get("inventory_item_id"):
        return
    item_id = _coerce_uuid(data.get("inventory_item_id"))
    outlet = _coerce_uuid(event.outlet_id) or _coerce_uuid(data.get("outlet_id"))
    if item_id is None or outlet is None:
        return

    db = _handler_db()
    try:
        open_pr = await db.scalar(
            select(PurchaseRequest).where(
                PurchaseRequest.tenant_id == tenant,
                PurchaseRequest.outlet_id == outlet,
                PurchaseRequest.status.in_([PRStatus.SUBMITTED, PRStatus.APPROVED]),
            )
        )
        if open_pr is None:
            # The reorder quantity the inventory service reports, or 1 if it
            # did not say. Must be positive — a zero-quantity line would fail
            # schema validation and abort the request before it is ever seen.
            qty = float(data.get("reorder_qty") or data.get("qty") or 0) or 1.0
            lines = [PRLineIn(inventory_item_id=item_id, qty=qty,
                              notes=data.get("notes"))]
            pr = await svc.create_request(
                db, tenant, outlet, lines,
                requested_by=_coerce_uuid(data.get("created_by")),
                notes=f"auto-raised from {event.type}",
            )
            await svc.set_pr_status(db, tenant, pr, PRStatus.SUBMITTED)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    finally:
        await db.close()


# ─── Vendors ────────────────────────────────────────────────────────────────

@router.get("/vendor-items/recommend", tags=["purchase"])
async def recommend_vendor_item(
    identity: CurrentIdentity, db: DbDep, inventory_item_id: uuid.UUID,
):
    """The vendor most suited to source one inventory item.

    The cheapest active VendorItem price wins (ties broken by the highest
    suggested qty). Returns the vendor + last price + suggested qty, so a
    restock flow can fill in ``vendor_id`` / ``unit_price`` / ``ordered_qty``.
    404 when no vendor carries the item.
    """
    identity.require("view:purchase")
    from src.services.purchase.models import VendorItem
    row = (await db.execute(
        select(VendorItem)
        .where(
            VendorItem.tenant_id == identity.tenant_id,
            VendorItem.inventory_item_id == inventory_item_id,
            VendorItem.is_active.is_(True),
        )
        .order_by(VendorItem.last_purchase_price.asc(),
                  VendorItem.suggested_qty.desc())
    )).scalars().first()
    if row is None:
        raise HTTPException(status_code=404, detail="No vendor carries this item")
    return {
        "vendor_id": str(row.vendor_id),
        "last_purchase_price": float(row.last_purchase_price or 0.0),
        "suggested_qty": float(row.suggested_qty or 0.0),
        "uom_id": str(row.uom_id) if row.uom_id else None,
    }


@router.get("/vendor-items", tags=["purchase"],
            summary="Active vendor-item rows for one or more inventory items")
async def list_vendor_items(
    identity: CurrentIdentity, db: DbDep,
    inventory_item_id: uuid.UUID | None = None,
    inventory_item_ids: str | None = Query(
        default=None,
        description="Comma-separated inventory item ids — bulk form used by the menu service's auto-PO flow.",
    ),
):
    """Vendor + price per inventory item (active rows only).

    The AI recipe reorder flow (menu service) needs, for each missing/low
    ingredient, a vendor that carries it plus the last agreed price. One
    bulk call over several items replaces a request per ingredient.
    ``inventory_item_id`` (single) and ``inventory_item_ids`` (bulk,
    comma-separated) are both accepted; the bulk form wins when both are set.
    """
    identity.require("view:purchase")
    if inventory_item_ids:
        ids = [s.strip() for s in inventory_item_ids.split(",") if s.strip()]
        parsed: list[uuid.UUID] = []
        for v in ids:
            try:
                parsed.append(uuid.UUID(v))
            except (ValueError, TypeError):
                continue
        if not parsed:
            return []
        stmt = select(VendorItem).where(
            VendorItem.tenant_id == identity.tenant_id,
            VendorItem.inventory_item_id.in_(parsed),
            VendorItem.is_active.is_(True),
        )
    elif inventory_item_id is not None:
        stmt = select(VendorItem).where(
            VendorItem.tenant_id == identity.tenant_id,
            VendorItem.inventory_item_id == inventory_item_id,
            VendorItem.is_active.is_(True),
        )
    else:
        stmt = select(VendorItem).where(
            VendorItem.tenant_id == identity.tenant_id,
            VendorItem.is_active.is_(True),
        )
    rows = (await db.execute(stmt)).scalars().all()
    out = []
    for r in rows:
        out.append({
            "id": str(r.id),
            "vendor_id": str(r.vendor_id),
            "inventory_item_id": str(r.inventory_item_id),
            "uom_id": str(r.uom_id) if r.uom_id else None,
            "last_purchase_price": float(r.last_purchase_price or 0.0),
            "suggested_qty": float(r.suggested_qty or 0.0),
        })
    return out


@router.get("/vendors", response_model=list[VendorResponse], tags=["purchase"])
async def list_vendors(identity: CurrentIdentity, db: DbDep,
                       active_only: bool = True,
                       is_active: bool | None = None,
                       limit: int = Query(default=0, ge=0, le=500)):
    identity.require("view:purchase")
    if is_active is not None:
        active_only = is_active
    stmt = select(Vendor).where(Vendor.tenant_id == identity.tenant_id)
    if active_only:
        stmt = stmt.where(Vendor.is_active.is_(True))
    stmt = stmt.order_by(Vendor.name)
    if limit:
        stmt = stmt.limit(limit)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/vendors", response_model=VendorResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["purchase"])
async def create_vendor(payload: VendorCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:purchase")
    vendor = Vendor(tenant_id=identity.tenant_id, **payload.model_dump())
    db.add(vendor)
    await db.flush()
    return vendor


# ─── Vendor items (a vendor's agreed price + suggested qty for one item) ───


class VendorItemCreate(BaseModel):
    vendor_id: uuid.UUID
    inventory_item_id: uuid.UUID
    uom_id: uuid.UUID | None = None
    last_purchase_price: float = Field(default=0, ge=0)
    suggested_qty: float = Field(default=0, ge=0)
    is_active: bool = True


class VendorItemPatch(BaseModel):
    last_purchase_price: float | None = Field(default=None, ge=0)
    suggested_qty: float | None = Field(default=None, ge=0)
    is_active: bool | None = None


class VendorItemResponse(BaseModel):
    id: uuid.UUID
    vendor_id: uuid.UUID
    inventory_item_id: uuid.UUID
    uom_id: uuid.UUID | None
    last_purchase_price: float
    suggested_qty: float
    is_active: bool


@router.post("/vendor-items", response_model=VendorItemResponse,
             status_code=http_status.HTTP_201_CREATED,
             tags=["purchase"],
             summary="Create (upsert) a vendor's price + suggested qty for an item")
async def create_vendor_item(payload: VendorItemCreate,
                             identity: CurrentIdentity, db: DbDep):
    """The auto-PO flow needs a VendorItem row per ingredient it orders: the
    vendor's last agreed price and suggested quantity. Upsert on
    (vendor, item) so re-running a seed or a restock doesn't duplicate the
    row."""
    identity.require("manage:purchase")
    vendor = await svc.load_vendor(db, identity.tenant_id, payload.vendor_id)
    if vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found")
    row = (await db.execute(
        select(VendorItem).where(
            VendorItem.tenant_id == identity.tenant_id,
            VendorItem.vendor_id == payload.vendor_id,
            VendorItem.inventory_item_id == payload.inventory_item_id,
        )
    )).scalars().first()
    if row is None:
        row = VendorItem(
            tenant_id=identity.tenant_id,
            vendor_id=payload.vendor_id,
            inventory_item_id=payload.inventory_item_id,
            uom_id=payload.uom_id,
        )
        db.add(row)
    row.last_purchase_price = payload.last_purchase_price
    row.suggested_qty = payload.suggested_qty
    row.is_active = payload.is_active
    await db.flush()
    return VendorItemResponse(
        id=row.id, vendor_id=row.vendor_id,
        inventory_item_id=row.inventory_item_id, uom_id=row.uom_id,
        last_purchase_price=float(row.last_purchase_price),
        suggested_qty=float(row.suggested_qty), is_active=bool(row.is_active),
    )


@router.patch("/vendor-items/{vendor_item_id}", response_model=VendorItemResponse,
              tags=["purchase"])
async def patch_vendor_item(vendor_item_id: uuid.UUID, payload: VendorItemPatch,
                           identity: CurrentIdentity, db: DbDep):
    """Update a vendor's agreed price / suggested qty for an item."""
    identity.require("manage:purchase")
    row = await db.scalar(
        select(VendorItem).where(
            VendorItem.id == vendor_item_id,
            VendorItem.tenant_id == identity.tenant_id,
        ))
    if row is None:
        raise HTTPException(status_code=404, detail="Vendor item not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    await db.flush()
    return VendorItemResponse(
        id=row.id, vendor_id=row.vendor_id,
        inventory_item_id=row.inventory_item_id, uom_id=row.uom_id,
        last_purchase_price=float(row.last_purchase_price),
        suggested_qty=float(row.suggested_qty), is_active=bool(row.is_active),
    )


@router.patch("/vendors/{vendor_id}", response_model=VendorResponse, tags=["purchase"])
async def update_vendor(vendor_id: uuid.UUID, payload: VendorUpdate,
                        identity: CurrentIdentity, db: DbDep):
    identity.require("manage:purchase")
    vendor = await db.scalar(
        select(Vendor).where(Vendor.id == vendor_id,
                             Vendor.tenant_id == identity.tenant_id))
    if vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(vendor, field, value)
    await db.flush()
    return vendor


# ─── Purchase requests ──────────────────────────────────────────────────────

@router.get("/purchase-requests", response_model=list[PurchaseRequestResponse],
            tags=["purchase"])
async def list_requests(identity: CurrentIdentity, db: DbDep,
                        status_filter: str | None = None,
                        limit: int = Query(default=100, le=500)):
    identity.require("view:purchase")
    stmt = select(PurchaseRequest).where(PurchaseRequest.tenant_id == identity.tenant_id)
    if status_filter:
        stmt = stmt.where(PurchaseRequest.status == status_filter)
    stmt = stmt.order_by(PurchaseRequest.created_at.desc()).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/purchase-requests", response_model=PurchaseRequestResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["purchase"])
async def create_request(payload: PurchaseRequestCreate,
                         identity: CurrentIdentity, db: DbDep):
    identity.require("manage:purchase")
    pr = await svc.create_request(
        db, identity.tenant_id, payload.outlet_id, payload.lines,
        requested_by=identity.user_id, notes=payload.notes,
    )
    # Return the ORM object with its lines eager-loaded: the response serializes
    # pr.lines, and the service layer's flush-only session no longer guarantees
    # a usable identity map, so a lazy load here would raise MissingGreenlet.
    return await svc.load_request(db, identity.tenant_id, pr.id)


@router.post("/purchase-requests/{pr_id}/decide",
             response_model=PurchaseRequestResponse, tags=["purchase"],
             summary="Approve or reject a purchase request")
async def decide_request(pr_id: uuid.UUID, payload: PRDecision,
                         identity: CurrentIdentity, db: DbDep):
    """Approving a PR is the commitment step; converting it later makes a PO.

    Rejecting leaves the stock gap unfilled but does not silently reorder —
    a rejected request stays visible so the gap is a known, deliberate choice.
    """
    identity.require("manage:purchase")
    pr = await svc.load_request(db, identity.tenant_id, pr_id)
    if pr is None:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    if pr.status != PRStatus.SUBMITTED:
        raise HTTPException(
            status_code=409,
            detail=f"Request is {pr.status.value if hasattr(pr.status, 'value') else pr.status}, not submitted",
        )
    status = PRStatus.APPROVED if payload.approve else PRStatus.REJECTED
    await svc.set_pr_status(db, identity.tenant_id, pr, status,
                            decided_by=identity.user_id, notes=payload.notes)
    if payload.approve:
        # Approval is the moment money is committed in principle, so it is
        # the moment the rest of the system needs to know. The outbox row
        # commits with the status change, so the event cannot be lost.
        event = _ev(
            "po.approved", identity.tenant_id, pr.outlet_id,
            data={
                "pr_id": str(pr.id),
                "pr_number": pr.pr_number,
                "tenant_id": str(identity.tenant_id),
                "outlet_id": str(pr.outlet_id) if pr.outlet_id else None,
                "approved_by": str(identity.user_id),
                "lines": [
                    {"inventory_item_id": str(l.inventory_item_id),
                     "qty": float(l.qty)}
                    for l in pr.lines
                ],
            },
        )
        _outbox(db, event)
        await db.commit()
        await _publish(event)
    return pr


@router.post("/purchase-requests/{pr_id}/convert",
             response_model=PurchaseOrderResponse, tags=["purchase"],
             summary="Convert an approved request into a purchase order")
async def convert_request(pr_id: uuid.UUID, vendor_id: uuid.UUID,
                          identity: CurrentIdentity, db: DbDep):
    """Turn an approved PR into a PO for a chosen vendor.

    The vendor is supplied here, not on the PR: a PR is what is needed, not
    from whom. Choosing the vendor is a procurement decision and belongs at
    order time, where price comparisons are still in scope.
    """
    identity.require("manage:purchase")
    pr = await svc.load_request(db, identity.tenant_id, pr_id)
    if pr is None:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    if pr.status != PRStatus.APPROVED:
        raise HTTPException(
            status_code=409,
            detail=f"Request is {pr.status.value if hasattr(pr.status, 'value') else pr.status}; only approved requests convert",
        )
    vendor = await svc.load_vendor(db, identity.tenant_id, vendor_id)
    if vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found")

    lines = [POLineIn(inventory_item_id=l.inventory_item_id, ordered_qty=float(l.qty))
             for l in pr.lines]
    po = await svc.create_order(db, identity.tenant_id, pr.outlet_id, vendor.id,
                                lines, pr_id=pr.id, created_by=identity.user_id,
                                notes=pr.notes)
    await svc.set_pr_status(db, identity.tenant_id, pr, PRStatus.CONVERTED,
                            notes=f"converted to {po.po_number}")
    return po


# ─── Purchase orders ────────────────────────────────────────────────────────

@router.get("/purchase-orders", response_model=list[PurchaseOrderResponse],
            tags=["purchase"])
async def list_orders(identity: CurrentIdentity, db: DbDep,
                      status_filter: str | None = None,
                      limit: int = Query(default=100, le=500)):
    identity.require("view:purchase")
    stmt = select(PurchaseOrder).where(PurchaseOrder.tenant_id == identity.tenant_id)
    if status_filter:
        stmt = stmt.where(PurchaseOrder.status == status_filter)
    stmt = stmt.order_by(PurchaseOrder.created_at.desc()).limit(limit)
    # Eager-load the lines so the response's lines: field serializes without
    # a lazy DB hop mid-request (MissingGreenlet in async SQLAlchemy).
    orders = (await db.execute(stmt.options(selectinload(PurchaseOrder.lines))))
    return list(orders.scalars().all())


@router.post("/purchase-orders", response_model=PurchaseOrderResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["purchase"])
async def create_order(payload: PurchaseOrderCreate,
                       identity: CurrentIdentity, db: DbDep):
    identity.require("manage:purchase")
    vendor = await svc.load_vendor(db, identity.tenant_id, payload.vendor_id)
    if vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found")
    po = await svc.create_order(
        db, identity.tenant_id, payload.outlet_id, vendor.id, payload.lines,
        pr_id=payload.pr_id, expected_date=payload.expected_date,
        notes=payload.notes, created_by=identity.user_id,
    )
    po = await svc.load_order(db, identity.tenant_id, po.id)
    event = _ev(
        "po.created", identity.tenant_id, payload.outlet_id,
        data={"po_id": str(po.id), "po_number": po.po_number,
              "vendor_id": str(vendor.id), "grand_total": float(po.grand_total)},
    )
    _outbox(db, event)
    await db.commit()
    # Immediate local dispatch for in-process handlers; the relay picks up the
    # outbox row for cross-service delivery.
    await bus.publish(event, local=True)
    return po


@router.post("/purchase-orders/{po_id}/send", response_model=PurchaseOrderResponse,
             tags=["purchase"], summary="Mark a PO as sent to the vendor")
async def send_order(po_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    """Sent is the point at which the vendor accepts the order.

    A draft PO is only an internal document; nothing is owed until it is sent
    and then confirmed. Tracking that boundary is what stops us paying for an
    order the vendor never agreed to.
    """
    identity.require("manage:purchase")
    po = await svc.load_order(db, identity.tenant_id, po_id)
    if po is None:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.status not in (POStatus.DRAFT,):
        raise HTTPException(
            status_code=409,
            detail=f"PO is {po.status.value if hasattr(po.status, 'value') else po.status}, not draft")
    await svc.set_po_status(db, identity.tenant_id, po, POStatus.SENT)
    return po


@router.post("/purchase-orders/{po_id}/cancel", response_model=PurchaseOrderResponse,
             tags=["purchase"])
async def cancel_order(po_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    """Cancel before any receipt — once goods arrive, cancel is too late."""
    identity.require("manage:purchase")
    po = await svc.load_order(db, identity.tenant_id, po_id)
    if po is None:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.status in (POStatus.RECEIVED, POStatus.CANCELLED):
        raise HTTPException(
            status_code=409, detail=f"Cannot cancel a PO that is {str(po.status)}")
    await svc.set_po_status(db, identity.tenant_id, po, POStatus.CANCELLED)
    return po


# ─── Goods receipt notes ────────────────────────────────────────────────────

@router.post("/grns/{grn_id}/cancel", response_model=GRNResponse, tags=["purchase"],
             summary="Cancel a GRN before QC — received goods that will not be kept")
async def cancel_grn(grn_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    """Only a DRAFT/RECEIVED GRN (pre-QC) can be cancelled — a QC-passed one
    has already posted stock and the bill cycle may have started, and
    silently undoing that is not a cancel, that is a ledger correction with
    its own, separate approval."""
    identity.require("manage:purchase")
    grn = await svc.load_grn(db, identity.tenant_id, grn_id)
    if grn is None:
        raise HTTPException(status_code=404, detail="GRN not found")
    await svc.set_grn_status(db, identity.tenant_id, grn, GRNStatus.CANCELLED,
                            notes="cancelled before QC")
    return grn


@router.get("/grns/{grn_id}/three-way-match", tags=["purchase"],
            summary="Check PO vs GRN vs bill amounts against a tolerance")
async def three_way_match(
    grn_id: uuid.UUID,
    identity: CurrentIdentity,
    db: DbDep,
    tolerance_pct: float = Query(default=0.0, ge=0, le=100,
                                 description="Variance tolerance, as a percentage of the PO line's expected amount"),
):
    """The "we only pay for what we actually got" check, run on demand —
    a procurement manager's review step before approving a bill that looks
    too large to be explained by the original order."""
    identity.require("manage:purchase")
    try:
        return await svc.three_way_match(
            db, identity.tenant_id, grn_id, tolerance_pct=tolerance_pct
        )
    except svc.PurchaseError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.get("/grns", response_model=list[GRNResponse], tags=["purchase"])
async def list_grns(identity: CurrentIdentity, db: DbDep,
                    status_filter: str | None = None,
                    limit: int = Query(default=100, le=500)):
    identity.require("view:purchase")
    stmt = select(GoodsReceiptNote).where(
        GoodsReceiptNote.tenant_id == identity.tenant_id)
    if status_filter:
        stmt = stmt.where(GoodsReceiptNote.status == status_filter)
    stmt = stmt.order_by(GoodsReceiptNote.created_at.desc()).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/grns", response_model=GRNResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["purchase"],
             summary="Record goods received against a purchase order")
async def create_grn(payload: GRNCreate, identity: CurrentIdentity, db: DbDep):
    """Receive goods.

    Accepted quantity is what enters the store; rejected is what does not. The
    distinction matters at billing time: rejected goods are never invoiced, so
    the split is captured at the receiving dock, not argued about later.
    """
    identity.require("manage:purchase")
    po = await svc.load_order(db, identity.tenant_id, payload.po_id)
    if po is None:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    grn = await svc.create_grn(
        db, identity.tenant_id, po, payload.lines,
        received_by=identity.user_id, received_date=payload.received_date,
        notes=payload.notes,
    )
    return grn


@router.post("/grns/{grn_id}/qc", response_model=GRNResponse, tags=["purchase"],
             summary="Pass or fail quality control on a received GRN")
async def qc_grn(grn_id: uuid.UUID, payload: QCDecision,
                 identity: CurrentIdentity, db: DbDep):
    """QC pass is the gate before ``grn.posted`` fires.

    Publishing on receipt rather than on QC pass would add bad stock to the
    store — including a dish that went out and was never eaten. So the stock
    event waits for QC, and the accounting entry follows the same rule.
    """
    identity.require("manage:purchase")
    grn = await svc.load_grn(db, identity.tenant_id, grn_id)
    if grn is None:
        raise HTTPException(status_code=404, detail="GRN not found")
    target = GRNStatus.QC_PASSED if payload.pass_ else GRNStatus.QC_FAILED
    await svc.set_grn_status(db, identity.tenant_id, grn, target, notes=payload.notes)

    if payload.pass_:
        accepted = sum(float(l.accepted_qty) for l in grn.lines)
        amount = sum(float(l.accepted_qty) * float(l.unit_price) for l in grn.lines)
        event = _ev(
            "grn.posted", identity.tenant_id, grn.outlet_id,
            data={
                "grn_id": str(grn.id),
                "grn_number": grn.grn_number,
                "po_id": str(grn.po_id),
                "vendor_id": str(grn.vendor_id),
                "inventory_item_ids": [str(l.inventory_item_id) for l in grn.lines],
                "accepted_qty": accepted,
                "amount": round(amount, 2),
                "lines": [
                    {"inventory_item_id": str(l.inventory_item_id),
                     "accepted_qty": float(l.accepted_qty),
                     "unit_price": float(l.unit_price),
                     "batch_number": l.batch_number}
                    for l in grn.lines
                ],
            },
        )
        _outbox(db, event)
        await db.commit()
        await bus.publish(event, local=True)
    return grn


# ─── Vendor bills & payments ────────────────────────────────────────────────

@router.get("/vendor-bills", response_model=list[VendorBillResponse],
            tags=["purchase"])
async def list_bills(identity: CurrentIdentity, db: DbDep,
                     status_filter: str | None = None,
                     limit: int = Query(default=100, le=500)):
    identity.require("view:purchase")
    stmt = select(VendorBill).where(VendorBill.tenant_id == identity.tenant_id)
    if status_filter:
        stmt = stmt.where(VendorBill.status == status_filter)
    stmt = stmt.order_by(VendorBill.created_at.desc()).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/vendor-bills", response_model=VendorBillResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["purchase"],
             summary="Raise a bill from a QC-passed GRN")
async def create_bill(payload: VendorBillCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:purchase")
    if payload.grn_id is None:
        raise HTTPException(
            status_code=400,
            detail="A bill must be sourced from a GRN so it matches accepted goods",
        )
    bill = await svc.create_bill_from_grn(
        db, identity.tenant_id, payload.grn_id,
        tax_total=payload.tax_total, invoice_number=payload.invoice_number,
        invoice_date=payload.invoice_date, notes=payload.notes,
    )
    event = _ev(
        "vendor_bill.created", identity.tenant_id, bill.outlet_id,
        data={"bill_id": str(bill.id), "bill_number": bill.bill_number,
              "vendor_id": str(bill.vendor_id),
              "grand_total": float(bill.grand_total)},
    )
    _outbox(db, event)
    await db.commit()
    await bus.publish(event, local=True)
    return bill


@router.post("/vendor-bills/{bill_id}/cancel", response_model=VendorBillResponse,
             tags=["purchase"],
             summary="Cancel a bill before payment — only DRAFT/UNPAID bills can be cancelled")
async def cancel_bill(bill_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    """A bill with even one payment on it is not cancellable, that is a
    reversal with its own approval — cancel only reaches the pre-payment
    states where nothing has moved money yet."""
    identity.require("manage:purchase")
    bill = await db.scalar(
        select(VendorBill).where(
            VendorBill.id == bill_id, VendorBill.tenant_id == identity.tenant_id))
    if bill is None:
        raise HTTPException(status_code=404, detail="Vendor bill not found")
    current = _member(bill.status, VendorBillStatus)
    if current not in (VendorBillStatus.DRAFT, VendorBillStatus.UNPAID):
        raise HTTPException(
            status_code=409,
            detail=f"A bill in {current.value} state cannot be cancelled")
    bill.status = VendorBillStatus.CANCELLED
    await db.flush()
    return bill


@router.post("/vendor-bills/{bill_id}/credit-note", response_model=VendorBillResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["purchase"],
             summary="Issue a credit note against a paid/partially-paid bill")
async def credit_note(
    bill_id: uuid.UUID,
    identity: CurrentIdentity,
    db: DbDep,
    amount: float = Query(..., gt=0, description="Credit amount, must not exceed the bill balance"),
    reason: str | None = Query(default=None, max_length=500),
):
    """A negative-amount bill against the same vendor — the correction path
    when a bill was over-issued or paid and money must come back. Linked to
    the original so the audit trail stays one document chain, not two
    unexplained numbers that happen to reference the same vendor."""
    identity.require("manage:purchase")
    bill = await db.scalar(
        select(VendorBill).where(
            VendorBill.id == bill_id, VendorBill.tenant_id == identity.tenant_id))
    if bill is None:
        raise HTTPException(status_code=404, detail="Vendor bill not found")
    if amount > float(bill.balance):
        raise HTTPException(
            status_code=400,
            detail=f"Credit note ₹{amount} exceeds the open balance ₹{bill.balance}")

    credit = VendorBill(
        tenant_id=identity.tenant_id,
        outlet_id=bill.outlet_id,
        vendor_id=bill.vendor_id,
        bill_number=f"CN-{uuid.uuid4().hex[:8].upper()}",
        status=VendorBillStatus.PAID,
        invoice_date=svc._now().date(),
        subtotal=0.0,
        tax_total=0.0,
        grand_total=-amount,
        paid_amount=amount,
        balance=0.0,
        notes=(reason or "credit note") + f" against bill {bill.bill_number}",
    )
    db.add(credit)
    bill.balance = _money(float(bill.balance) - amount)
    bill.paid_amount = _money(float(bill.paid_amount) + amount)
    if bill.balance <= 0:
        bill.status = VendorBillStatus.PAID
    else:
        bill.status = VendorBillStatus.PARTIALLY_PAID
    await db.flush()
    return credit


@router.post("/vendor-bills/{bill_id}/payments",
             response_model=VendorPaymentResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["purchase"],
             summary="Record a payment against a vendor bill")
async def create_payment(bill_id: uuid.UUID, payload: VendorPaymentCreate,
                         identity: CurrentIdentity, db: DbDep):
    """Pay a bill.

    Partial payments are allowed and accumulate on ``paid_amount``; the bill
    only reaches PAID when the balance hits zero. Paying more than the balance
    is refused — overpaying a vendor is usually a data entry error, not a gift.
    """
    identity.require("manage:purchase")
    bill = await db.scalar(
        select(VendorBill).where(
            VendorBill.id == bill_id, VendorBill.tenant_id == identity.tenant_id))
    if bill is None:
        raise HTTPException(status_code=404, detail="Vendor bill not found")
    try:
        payment = await svc.record_payment(
            db, identity.tenant_id, bill, payload, approved_by=identity.user_id)
    except svc.PurchaseError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return payment


@router.get("/vendor-bills/{bill_id}", response_model=VendorBillResponse,
            tags=["purchase"])
async def get_bill(bill_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:purchase")
    bill = await db.scalar(
        select(VendorBill).where(
            VendorBill.id == bill_id, VendorBill.tenant_id == identity.tenant_id))
    if bill is None:
        raise HTTPException(status_code=404, detail="Vendor bill not found")
    return bill
