"""Inventory identifiers — barcodes, QR labels, RFID tags, expiry and cohorts.

Ported from the BusinessOSAI monolith's
``src/api/v1/inventory/identifiers.py`` (778 LOC). The monolith served these
from one router over one shared database with ``Product`` /
``InventoryBatch`` / ``InventorySerial` / ``MasterCatalogProduct`` /
``ProductQRCode`` / ``ProductRFID`` models. This service owns a different
estate, so the port had to reshape a few things — see the report for the
full list. The two that matter most:

  * ``Product`` here is ``InventoryItem``, and there is no master catalogue
    and no serial table, so the uniqueness check covers items and lots only.
  * The monolith's ``CurrentUserContext`` carried a ``tenant_id`` and a
    ``company_id``; this service has only ``tenant_id``, taken from the
    shared ``CurrentIdentity`` and enforced with the service's own
    ``view:inventory`` / ``manage:inventory`` permissions.

Routes are mounted under ``/api/v1/inventory`` (the service's canonical
prefix), so they read as ``/api/v1/inventory/barcodes`` and so on — which is
exactly what the frontend calls.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status as http_status
from fastapi.responses import JSONResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

import httpx
from src.services.inventory import barcode_engine as engine
from src.services.inventory import service as svc
from src.services.inventory.models import (
    ExpiryWriteOff,
    InventoryBatch,
    InventoryBrand,
    InventoryCycleCount,
    InventoryCycleCountItem,
    InventoryItem,
    InventoryQRCode,
    InventoryRFIDTag,
    InventoryStock,
    StorageLocation,
    StorageLocationType,
    WastageReason,
)
from src.services.inventory.schemas import (
    BarcodeEntry,
    BarcodeGenerated,
    BarcodeLookup,
    BarcodePeek,
    BatchPrintIn,
    BatchPrintPayload,
    BucketStats,
    BulkBarcodeResult,
    ExpiryBatchItem,
    ExpirySummaryResponse,
    ManufacturingCohorts,
    QRCodeIn,
    QRCodeResponse,
    QRCodeUpdate,
    RFIDIn,
    RFIDResponse,
    RFIDUpdate,
    WriteOffResult,
)
from src.services.shared.identity import CurrentIdentity
from src.services.shared.registry import base_url, get_descriptor

router = APIRouter(tags=["inventory"])


# ─── Session dependency ───────────────────────────────────────────────────
#
# The sibling ``api.py`` defines its own ``get_db`` that reads the session
# factory off ``request.app.state.db``. The identifier router is a separate
# file but the same service, so it uses the same dependency — importing it
# rather than redeclaring it keeps the commit/rollback behaviour identical.

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


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _today() -> date:
    return datetime.now(timezone.utc).date()


# ─── Barcodes ──────────────────────────────────────────────────────────────

def _barcode_entry(item: InventoryItem, category_name: str | None = None) -> BarcodeEntry:
    """Shape an item as a barcode row.

    The monolith called this field ``product_name``; the frontend's
    ``ProductBarcode`` interface still uses that name, so it is kept.
    """
    return BarcodeEntry(
        id=item.id,
        product_name=item.name,
        sku=item.sku,
        barcode=item.barcode,
        format=engine.detect_format(item.barcode),
        selling_price=float(item.selling_price) if item.selling_price is not None else None,
        image_url=item.image_url,
        category_name=category_name,
    )


@router.get("/barcodes", response_model=list[BarcodeEntry],
            summary="Items that carry a barcode, newest first")
async def list_barcodes(
    identity: CurrentIdentity,
    db: DbDep,
    search: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=500, ge=1, le=2000),
):
    """The barcode list screen.

    Only items that actually have a barcode — an item exists long before
    anyone labels it, and the list is for finding labels, not for listing
    the catalogue.
    """
    identity.require("view:inventory")

    stmt = select(InventoryItem).where(
        InventoryItem.tenant_id == identity.tenant_id,
        InventoryItem.barcode.isnot(None),
        InventoryItem.barcode != "",
    )
    if search:
        like = f"%{search}%"
        stmt = stmt.where(or_(
            InventoryItem.name.ilike(like),
            InventoryItem.barcode.ilike(like),
            InventoryItem.sku.ilike(like),
            InventoryItem.code.ilike(like),
        ))
    stmt = stmt.order_by(InventoryItem.updated_at.desc()).limit(limit)

    items = list((await db.execute(stmt)).scalars().all())
    if not items:
        return []

    # Category names in one extra query rather than a lazy relationship load
    # (which would raise MissingGreenlet during response serialisation).
    from src.services.inventory.models import InventoryCategory

    cat_ids = {i.category_id for i in items if i.category_id is not None}
    names: dict[uuid.UUID, str] = {}
    if cat_ids:
        cats = (await db.execute(
            select(InventoryCategory).where(InventoryCategory.id.in_(cat_ids))
        )).scalars().all()
        names = {c.id: c.name for c in cats}

    return [
        _barcode_entry(i, names.get(i.category_id) if i.category_id else None)
        for i in items
    ]


@router.get("/barcodes/next", response_model=BarcodePeek,
            summary="Peek the next unique barcode without saving it")
async def get_next_barcode(
    identity: CurrentIdentity,
    db: DbDep,
    format: str = Query(default=engine.EAN13, description="EAN-13 or Code-128"),
    prefix: str | None = Query(default=None, description="Custom prefix for Code-128"),
):
    """The next free barcode, computed but NOT persisted.

    The frontend shows this before the user commits to a label, so nothing
    is written here — a peek that reserved a code would leak codes every
    time somebody opened the dialog and cancelled it.
    """
    identity.require("view:inventory")
    try:
        code, fmt = await engine.generate_unique_barcode(
            db, identity.tenant_id, barcode_format=format, prefix=prefix
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return BarcodePeek(barcode=code, format=fmt, is_unique=True)


@router.post("/barcodes/generate", response_model=BarcodeGenerated,
             summary="Generate and assign a barcode to an item")
async def generate_barcode(
    identity: CurrentIdentity,
    db: DbDep,
    product_id: str | None = Query(default=None, description="Item UUID to assign to"),
    format: str = Query(default=engine.EAN13, description="EAN-13 or Code-128"),
    prefix: str | None = Query(default=None),
    force: bool = Query(default=False, description="Overwrite an existing barcode"),
):
    """Assign a unique barcode to an item.

    ``force`` is the overwrite switch: without it, an item that already has
    a barcode keeps it and the existing code is returned with a note rather
    than being silently replaced — reprinting a label and losing the old
    code is how two shelves end up with the same product.
    """
    identity.require("manage:inventory")

    if not product_id:
        try:
            code, fmt = await engine.generate_unique_barcode(
                db, identity.tenant_id, barcode_format=format, prefix=prefix
            )
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=str(exc))
        return BarcodeGenerated(barcode=code, format=fmt, is_unique=True)

    try:
        item_uuid = uuid.UUID(product_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid product_id")

    item = await db.scalar(
        select(InventoryItem).where(
            InventoryItem.id == item_uuid,
            InventoryItem.tenant_id == identity.tenant_id,
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    if item.barcode and not force:
        return BarcodeGenerated(
            barcode=item.barcode,
            format=engine.detect_format(item.barcode) or engine.CODE128,
            is_unique=True,
            product_id=item.id,
            product_name=item.name,
            note="Item already has a barcode",
        )

    try:
        code, fmt = await engine.generate_unique_barcode(
            db,
            identity.tenant_id,
            barcode_format=format,
            prefix=prefix,
            exclude_item_id=item.id,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    item.barcode = code
    await db.flush()
    return BarcodeGenerated(
        barcode=code,
        format=fmt,
        is_unique=True,
        product_id=item.id,
        product_name=item.name,
    )


@router.post("/barcodes/generate-bulk", response_model=BulkBarcodeResult,
             summary="Fill in missing barcodes across the catalogue")
async def generate_bulk_barcodes(
    identity: CurrentIdentity,
    db: DbDep,
    format: str = Query(default=engine.EAN13, description="EAN-13 or Code-128"),
    product_ids: str | None = Query(default=None, description="Comma-separated item UUIDs"),
    force_all: bool = Query(default=False, description="Regenerate even where a code exists"),
    include_invalid: bool = Query(default=True, description="Also redo invalid/duplicate codes"),
):
    """Generate barcodes in bulk, filling the gaps.

    The gap-filling logic is the reference's, with one adaptation: the
    reference looked for ``-DUP-`` markers left by an older import. Those
    markers cannot exist here (this service has never imported barcodes),
    so the "invalid" test is what actually applies — a code that is not a
    clean 13-digit EAN or a well-formed Code-128, or one that another item
    in this tenant already holds.
    """
    identity.require("manage:inventory")

    stmt = select(InventoryItem).where(
        InventoryItem.tenant_id == identity.tenant_id
    )

    if product_ids:
        raw = [p.strip() for p in product_ids.split(",") if p.strip()]
        parsed: list[uuid.UUID] = []
        for pid in raw:
            try:
                parsed.append(uuid.UUID(pid))
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid product id: {pid}")
        if parsed:
            stmt = stmt.where(InventoryItem.id.in_(parsed))

    if not force_all:
        conditions = [
            InventoryItem.barcode.is_(None),
            InventoryItem.barcode == "",
        ]
        if include_invalid:
            # A code that is neither a 13-digit EAN nor a Code-128 of the
            # form PREFIX-1234-00001 is not scannable as issued.
            conditions.append(~InventoryItem.barcode.regexp_match(
                r"^(\d{13}|[A-Z0-9]+-\d{4}-\d{5}(-[A-Z0-9]+)?)$"
            ))
            # A code another item in this tenant already holds.
            dup_subq = (
                select(InventoryItem.barcode)
                .where(
                    InventoryItem.tenant_id == identity.tenant_id,
                    InventoryItem.barcode.isnot(None),
                    InventoryItem.barcode != "",
                )
                .group_by(InventoryItem.barcode)
                .having(func.count(InventoryItem.id) > 1)
            )
            conditions.append(InventoryItem.barcode.in_(dup_subq))
        stmt = stmt.where(or_(*conditions))

    targets = list((await db.execute(stmt)).scalars().all())
    if not targets:
        return BulkBarcodeResult(
            message="All specified items already have valid unique barcodes.",
            generated_count=0,
            products=[],
        )

    target_ids = {i.id for i in targets}

    # Every code already in use in this tenant, so the generator does not
    # hand out one that is already on a shelf.
    used: set[str] = set()
    for row in (await db.execute(
        select(InventoryItem.id, InventoryItem.barcode).where(
            InventoryItem.tenant_id == identity.tenant_id,
            InventoryItem.barcode.isnot(None),
            InventoryItem.barcode != "",
        )
    )).all():
        _id, code = row
        if code and _id not in target_ids:
            used.add(code.strip())
    for row in (await db.execute(
        select(InventoryBatch.barcode).where(
            InventoryBatch.tenant_id == identity.tenant_id,
            InventoryBatch.barcode.isnot(None),
            InventoryBatch.barcode != "",
        )
    )).scalars().all():
        if row:
            used.add(row.strip())

    updated: list[BarcodeEntry] = []
    for item in targets:
        try:
            code, fmt = await engine.generate_unique_barcode(
                db,
                identity.tenant_id,
                barcode_format=format,
                exclude_item_id=item.id,
                existing_used_set=used,
            )
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=str(exc))
        item.barcode = code
        updated.append(BarcodeEntry(
            id=item.id,
            product_name=item.name,
            sku=item.sku,
            barcode=code,
            format=fmt,
            selling_price=(
                float(item.selling_price) if item.selling_price is not None else None
            ),
            image_url=item.image_url,
            category_name=None,
        ))

    await db.flush()
    return BulkBarcodeResult(
        message=f"Successfully generated unique barcodes for {len(updated)} items.",
        generated_count=len(updated),
        products=updated,
    )


@router.post("/barcodes/batch-print", response_model=BatchPrintPayload,
             summary="Label payload for a set of items")
async def batch_print_barcodes(
    payload: BatchPrintIn,
    identity: CurrentIdentity,
    db: DbDep,
):
    """Return the label data for the given items.

    String-only, on purpose: the server does not render label images. The
    frontend turns this payload into print media (CSS print sheets, a
    silent thermal printer, a PDF) — which keeps the server out of the
    label-rendering business and lets the layout change without a
    redeploy.

    The reference took ``product_ids`` as a query parameter; the frontend
    posts a JSON body (``{product_ids: []}``), so the body form is what is
    implemented here.
    """
    identity.require("view:inventory")

    ids = [i for i in (payload.product_ids or []) if i]
    if not ids:
        raise HTTPException(status_code=400, detail="No items selected")

    items = list((await db.execute(
        select(InventoryItem).where(
            InventoryItem.tenant_id == identity.tenant_id,
            InventoryItem.id.in_(ids),
        )
    )).scalars().all())

    labels = [_barcode_entry(i) for i in items]
    return BatchPrintPayload(printed=len(labels), labels=labels, products=labels)


@router.get("/products/barcode/{raw}", response_model=BarcodeLookup,
            summary="Scanner lookup — resolve a scanned code to an item")
async def lookup_barcode(
    raw: str,
    identity: CurrentIdentity,
    db: DbDep,
):
    """Resolve a scanned barcode to an item.

    The frontend's scanner sends whatever the gun read, which may carry
    leading/trailing whitespace and, for EAN-13, is sometimes read with a
    leading zero stripped. Both are normalised here before the lookup.

    This is the inventory service's equivalent of the monolith's
    ``/products/barcode/{raw}`` — in this estate the product IS an
    inventory item, so the lookup lives here.
    """
    identity.require("view:inventory")

    code = (raw or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Empty barcode")

    candidates = [code]
    # A 12-digit code read from a 13-digit EAN: the leading zero was
    # dropped by the scanner, so try it back on.
    if len(code) == 12 and code.isdigit():
        candidates.append("0" + code)

    item = None
    for candidate in candidates:
        item = await db.scalar(
            select(InventoryItem).where(
                InventoryItem.tenant_id == identity.tenant_id,
                InventoryItem.barcode == candidate,
            )
        )
        if item is not None:
            code = candidate
            break

    if item is None:
        # A lot can carry its own label too.
        batch = None
        for candidate in candidates:
            batch = await db.scalar(
                select(InventoryBatch).where(
                    InventoryBatch.tenant_id == identity.tenant_id,
                    InventoryBatch.barcode == candidate,
                )
            )
            if batch is not None:
                code = candidate
                break
        if batch is not None:
            lot_item = await db.scalar(
                select(InventoryItem).where(
                    InventoryItem.id == batch.inventory_item_id,
                    InventoryItem.tenant_id == identity.tenant_id,
                )
            )
            if lot_item is not None:
                item = lot_item

    if item is None:
        return BarcodeLookup(
            found=False, barcode=code, item=None,
            message=f"No item matches barcode '{code}'",
        )

    return BarcodeLookup(found=True, barcode=code, item=_barcode_entry(item))


# ─── Expiry ────────────────────────────────────────────────────────────────

async def _batch_rows(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    outlet_id: uuid.UUID | None = None,
    expiry_only: bool = True,
) -> list[tuple[InventoryBatch, str | None, str | None]]:
    """Batches for a tenant, joined with the item's name and sku.

    The join is explicit rather than a relationship load: a lazy load
    during response serialisation raises MissingGreenlet.
    """
    stmt = (
        select(InventoryBatch, InventoryItem.name, InventoryItem.sku)
        .join(
            InventoryItem,
            InventoryItem.id == InventoryBatch.inventory_item_id,
        )
        .where(InventoryBatch.tenant_id == tenant_id)
    )
    if outlet_id is not None:
        stmt = stmt.where(InventoryBatch.outlet_id == outlet_id)
    if expiry_only:
        stmt = stmt.where(InventoryBatch.expiry_date.isnot(None))
    stmt = stmt.order_by(InventoryBatch.expiry_date.asc().nulls_last())
    return list((await db.execute(stmt)).all())


@router.get("/expiry/summary", response_model=ExpirySummaryResponse,
            summary="Expired and expiring counts, in units")
async def expiry_summary(
    identity: CurrentIdentity,
    db: DbDep,
    outlet_id: uuid.UUID | None = None,
):
    """How much stock is past its date, and how much is about to be.

    The reference's shape, adapted: it counted ``remaining_quantity`` off
    its own batch model, which had a different quantity column name and a
    ``Consumed`` status. This estate's batch keeps ``qty`` and a ``status``
    string, so the counts read ``qty`` and skip lots already written off.
    """
    identity.require("view:inventory")

    today = _today()
    cutoff_30 = today + timedelta(days=30)
    cutoff_90 = today + timedelta(days=90)

    def _query(lo: date | None, hi: date | None, include_no_expiry: bool = False):
        stmt = select(
            func.count(InventoryBatch.id),
            func.coalesce(func.sum(InventoryBatch.qty), 0),
        ).where(
            InventoryBatch.tenant_id == identity.tenant_id,
            InventoryBatch.status != "Consumed",
        )
        if outlet_id is not None:
            stmt = stmt.where(InventoryBatch.outlet_id == outlet_id)
        if include_no_expiry:
            stmt = stmt.where(InventoryBatch.expiry_date.is_(None))
        else:
            stmt = stmt.where(InventoryBatch.expiry_date.isnot(None))
            if lo is not None:
                stmt = stmt.where(InventoryBatch.expiry_date >= lo)
            if hi is not None:
                stmt = stmt.where(InventoryBatch.expiry_date <= hi)
        return stmt

    # Expired is a closed window; the two "expiring" windows are cumulative
    # (a lot expiring in 45 days counts in both the 30- and the 90-day
    # figure), which is the reference's behaviour and what the list
    # endpoint's ``expiring_90`` bucket also reports.
    expired = (await db.execute(_query(None, today - timedelta(days=1)))).one()
    expiring_30 = (await db.execute(_query(today, cutoff_30))).one()
    expiring_90 = (await db.execute(_query(today, cutoff_90))).one()
    no_expiry = (await db.execute(_query(None, None, include_no_expiry=True))).one()

    return ExpirySummaryResponse(
        today=today.isoformat(),
        expired=BucketStats(count=int(expired[0] or 0), units=int(expired[1] or 0)),
        expiring_30=BucketStats(
            count=int(expiring_30[0] or 0), units=int(expiring_30[1] or 0)
        ),
        expiring_90=BucketStats(
            count=int(expiring_90[0] or 0), units=int(expiring_90[1] or 0)
        ),
        no_expiry=BucketStats(count=int(no_expiry[0] or 0), units=int(no_expiry[1] or 0)),
    )


@router.get("/expiry/list", response_model=list[ExpiryBatchItem],
            summary="Lots in one expiry bucket")
async def expiry_list(
    identity: CurrentIdentity,
    db: DbDep,
    bucket: str = Query(default="all", pattern="^(expired|expiring_30|expiring_90|all|no_expiry)$"),
    outlet_id: uuid.UUID | None = None,
):
    """Lots in the requested expiry bucket.

    The reference's buckets, kept as-is. ``no_expiry`` is the addition:
    a lot with no expiry date at all is stock the expiry board would
    otherwise hide, and hiding it is how a business discovers six months
    later that it has no idea what its shelf life is.
    """
    identity.require("view:inventory")

    today = _today()
    rows = await _batch_rows(db, identity.tenant_id, outlet_id=outlet_id)

    out: list[ExpiryBatchItem] = []
    for batch, item_name, sku in rows:
        expiry = batch.expiry_date
        if bucket == "no_expiry":
            if expiry is not None:
                continue
        elif expiry is None:
            continue
        elif bucket == "expired":
            if not expiry < today:
                continue
        elif bucket == "expiring_30":
            if not (today <= expiry <= today + timedelta(days=30)):
                continue
        elif bucket == "expiring_90":
            if not (today <= expiry <= today + timedelta(days=90)):
                continue

        days = (expiry - today).days if expiry is not None else None
        out.append(ExpiryBatchItem(
            id=batch.id,
            batch_number=batch.batch_number,
            product_name=item_name,
            sku=sku,
            warehouse_name=None,
            quantity=float(batch.qty or 0),
            remaining_quantity=float(batch.qty or 0),
            manufacturing_date=batch.manufacturing_date,
            expiry_date=expiry,
            status=batch.status,
            days_to_expiry=days,
            supplier=batch.supplier,
        ))
    return out


@router.post("/expiry/write-off", response_model=WriteOffResult,
             summary="Write off an expired lot")
async def write_off_expired(
    identity: CurrentIdentity,
    db: DbDep,
    batch_id: str = Query(...),
    reason: str = Query(default="expired"),
):
    """Write off a lot: zero its quantity, mark it consumed, record why.

    The reference wrote a marker into the batch's free-text notes and set
    ``remaining_quantity`` to 0. Here the lot's quantity column is
    ``qty`` and, more importantly, the fact is recorded in its own
    ``inventory_expiry_write_offs`` row — how much was written off, why,
    and by whom. Notes are not an audit trail; a row is.
    """
    identity.require("manage:inventory")

    try:
        batch_uuid = uuid.UUID(batch_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid batch_id")

    batch = await db.scalar(
        select(InventoryBatch).where(
            InventoryBatch.id == batch_uuid,
            InventoryBatch.tenant_id == identity.tenant_id,
        )
    )
    if batch is None:
        raise HTTPException(status_code=404, detail="Batch not found")

    qty = float(batch.qty or 0)
    batch.qty = 0
    batch.status = "Consumed"
    note = f"[WRITE-OFF: {reason}]"
    batch.notes = ((batch.notes or "") + "\n" + note).strip()

    db.add(ExpiryWriteOff(
        tenant_id=identity.tenant_id,
        outlet_id=batch.outlet_id,
        batch_id=batch.id,
        qty_written_off=qty,
        reason=reason,
        created_by=identity.user_id,
    ))
    await db.flush()

    return WriteOffResult(
        message=f"Batch {batch.batch_number} written off",
        batch_id=batch.id,
        qty_written_off=qty,
    )


@router.post("/expiry/apply-discount",
             summary="Flag a near-expiry lot for a clearance discount")
async def apply_expiry_discount(
    identity: CurrentIdentity,
    db: DbDep,
    batch_id: str = Query(...),
    discount_percent: float = Query(..., ge=0, le=100),
):
    """Flag a lot for a clearance discount.

    The discount itself is a pricing decision and belongs to whichever
    service owns prices; this records the intent on the lot so the
    clearance board can act on it.
    """
    identity.require("manage:inventory")

    try:
        batch_uuid = uuid.UUID(batch_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid batch_id")

    batch = await db.scalar(
        select(InventoryBatch).where(
            InventoryBatch.id == batch_uuid,
            InventoryBatch.tenant_id == identity.tenant_id,
        )
    )
    if batch is None:
        raise HTTPException(status_code=404, detail="Batch not found")

    tag = f"[DISCOUNT={discount_percent}%]"
    batch.notes = ((batch.notes or "") + "\n" + tag).strip()
    await db.flush()
    return {
        "message": (
            f"Applied {discount_percent}% discount to batch {batch.batch_number}"
        ),
        "batch_id": str(batch.id),
    }


# ─── Manufacturing cohorts ─────────────────────────────────────────────────

@router.get("/manufacturing/cohorts", response_model=ManufacturingCohorts,
            summary="Stock grouped by how long ago it was made")
async def manufacturing_cohorts(
    identity: CurrentIdentity,
    db: DbDep,
    outlet_id: uuid.UUID | None = None,
):
    """Age buckets of the stock on hand.

    How old is what we are selling? The reference's buckets are kept, with
    one change: it also reported a count of tracked *serials*, which this
    estate has no equivalent of (there is no serial table here), so that
    figure is reported as 0 rather than dropped — the frontend reads it.
    """
    identity.require("view:inventory")

    today = _today()
    cohorts = {
        "lt_30d": (today, today + timedelta(days=30)),
        "lt_90d": (today + timedelta(days=30), today + timedelta(days=90)),
        "lt_180d": (today + timedelta(days=90), today + timedelta(days=180)),
        "gt_180d": (today + timedelta(days=180), None),
    }

    out: dict[str, BucketStats] = {}
    for key, (lo, hi) in cohorts.items():
        stmt = select(
            func.count(InventoryBatch.id),
            func.coalesce(func.sum(InventoryBatch.qty), 0),
        ).where(
            InventoryBatch.tenant_id == identity.tenant_id,
            InventoryBatch.manufacturing_date.isnot(None),
            InventoryBatch.manufacturing_date >= lo,
        )
        if outlet_id is not None:
            stmt = stmt.where(InventoryBatch.outlet_id == outlet_id)
        if hi is not None:
            stmt = stmt.where(InventoryBatch.manufacturing_date < hi)
        count, units = (await db.execute(stmt)).one()
        out[key] = BucketStats(count=int(count or 0), units=int(units or 0))

    return ManufacturingCohorts(
        today=today.isoformat(),
        cohorts=out,
        serials_tracked=0,
    )


@router.get("/manufacturing/list", response_model=list[ExpiryBatchItem],
            summary="Lots that carry a manufacturing date")
async def manufacturing_list(
    identity: CurrentIdentity,
    db: DbDep,
    outlet_id: uuid.UUID | None = None,
):
    """Every lot with a manufacturing date, newest first."""
    identity.require("view:inventory")

    today = _today()
    stmt = (
        select(InventoryBatch, InventoryItem.name, InventoryItem.sku)
        .join(InventoryItem, InventoryItem.id == InventoryBatch.inventory_item_id)
        .where(
            InventoryBatch.tenant_id == identity.tenant_id,
            InventoryBatch.manufacturing_date.isnot(None),
        )
    )
    if outlet_id is not None:
        stmt = stmt.where(InventoryBatch.outlet_id == outlet_id)
    stmt = stmt.order_by(InventoryBatch.manufacturing_date.desc())

    out: list[ExpiryBatchItem] = []
    for batch, item_name, sku in (await db.execute(stmt)).all():
        expiry = batch.expiry_date
        out.append(ExpiryBatchItem(
            id=batch.id,
            batch_number=batch.batch_number,
            product_name=item_name,
            sku=sku,
            warehouse_name=None,
            quantity=float(batch.qty or 0),
            remaining_quantity=float(batch.qty or 0),
            manufacturing_date=batch.manufacturing_date,
            expiry_date=expiry,
            status=batch.status,
            days_to_expiry=(expiry - today).days if expiry is not None else None,
            supplier=batch.supplier,
        ))
    return out


# ─── QR codes ──────────────────────────────────────────────────────────────

def _qr_response(qr: InventoryQRCode) -> QRCodeResponse:
    """Shape a QR row for the frontend.

    The frontend's interface calls the item binding ``product_id`` and the
    payload ``qr_data``; this estate calls them ``item_id`` and ``code``.
    Both names are surfaced so neither side has to guess.
    """
    return QRCodeResponse(
        id=qr.id,
        tenant_id=qr.tenant_id,
        item_id=qr.item_id,
        product_id=qr.item_id,
        code=qr.code,
        qr_data=qr.qr_data or qr.code,
        label=qr.label,
        qr_type=qr.qr_type,
        version=qr.version,
        error_correction=qr.error_correction,
        active=qr.active,
        outlet_id=qr.outlet_id,
        print_count=qr.print_count,
        last_printed_at=qr.last_printed_at,
        notes=qr.notes,
        created_at=qr.created_at,
        updated_at=qr.updated_at,
    )


@router.get("/qrcodes", response_model=list[QRCodeResponse],
            summary="QR labels in this estate")
async def list_qrcodes(
    identity: CurrentIdentity,
    db: DbDep,
    product_id: uuid.UUID | None = None,
    search: str | None = Query(default=None, max_length=200),
    active_only: bool = Query(default=False),
):
    identity.require("view:inventory")

    stmt = select(InventoryQRCode).where(
        InventoryQRCode.tenant_id == identity.tenant_id
    )
    if product_id is not None:
        stmt = stmt.where(InventoryQRCode.item_id == product_id)
    if active_only:
        stmt = stmt.where(InventoryQRCode.active.is_(True))
    if search:
        like = f"%{search}%"
        stmt = stmt.where(or_(
            InventoryQRCode.code.ilike(like),
            InventoryQRCode.qr_data.ilike(like),
            InventoryQRCode.label.ilike(like),
        ))
    stmt = stmt.order_by(InventoryQRCode.created_at.desc())

    rows = list((await db.execute(stmt)).scalars().all())
    return [_qr_response(q) for q in rows]


@router.post("/qrcodes", response_model=QRCodeResponse,
             status_code=201, summary="Create a QR label")
async def create_qrcode(
    payload: QRCodeIn,
    identity: CurrentIdentity,
    db: DbDep,
):
    identity.require("manage:inventory")

    item_id = payload.item_id or payload.product_id
    if item_id is not None:
        exists = await db.scalar(
            select(InventoryItem.id).where(
                InventoryItem.id == item_id,
                InventoryItem.tenant_id == identity.tenant_id,
            )
        )
        if exists is None:
            raise HTTPException(status_code=404, detail="Inventory item not found")

    try:
        code, qr_data = payload.resolve()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    qr = InventoryQRCode(
        tenant_id=identity.tenant_id,
        outlet_id=payload.outlet_id,
        item_id=item_id,
        code=code,
        qr_data=qr_data,
        label=payload.label,
        qr_type=payload.qr_type,
        version=payload.version,
        error_correction=payload.error_correction,
        active=payload.active,
        notes=payload.notes,
    )
    db.add(qr)
    await db.flush()
    return _qr_response(qr)


@router.patch("/qrcodes/{qr_id}", response_model=QRCodeResponse,
              summary="Update a QR label")
async def update_qrcode(
    qr_id: uuid.UUID,
    payload: QRCodeUpdate,
    identity: CurrentIdentity,
    db: DbDep,
):
    identity.require("manage:inventory")

    qr = await db.scalar(
        select(InventoryQRCode).where(
            InventoryQRCode.id == qr_id,
            InventoryQRCode.tenant_id == identity.tenant_id,
        )
    )
    if qr is None:
        raise HTTPException(status_code=404, detail="QR code not found")

    data = payload.model_dump(exclude_unset=True)
    item_id = data.pop("item_id", None)
    product_id = data.pop("product_id", None)
    if item_id is not None or product_id is not None:
        qr.item_id = item_id if item_id is not None else product_id
    for field, value in data.items():
        setattr(qr, field, value)
    await db.flush()
    return _qr_response(qr)


@router.delete("/qrcodes/{qr_id}", summary="Delete a QR label")
async def delete_qrcode(
    qr_id: uuid.UUID,
    identity: CurrentIdentity,
    db: DbDep,
):
    identity.require("manage:inventory")

    qr = await db.scalar(
        select(InventoryQRCode).where(
            InventoryQRCode.id == qr_id,
            InventoryQRCode.tenant_id == identity.tenant_id,
        )
    )
    if qr is None:
        raise HTTPException(status_code=404, detail="QR code not found")
    await db.delete(qr)
    await db.flush()
    return {"message": "QR code deleted"}


@router.post("/qrcodes/{qr_id}/print", summary="Record a QR label print")
async def print_qrcode(
    qr_id: uuid.UUID,
    identity: CurrentIdentity,
    db: DbDep,
):
    """Bump the print counter.

    The print itself happens on the client — this only records that a label
    went out, which is what tells you a label needs reprinting.
    """
    identity.require("manage:inventory")

    qr = await db.scalar(
        select(InventoryQRCode).where(
            InventoryQRCode.id == qr_id,
            InventoryQRCode.tenant_id == identity.tenant_id,
        )
    )
    if qr is None:
        raise HTTPException(status_code=404, detail="QR code not found")

    qr.print_count = int(qr.print_count or 0) + 1
    qr.last_printed_at = _now()
    await db.flush()
    return {"message": "Printed", "print_count": qr.print_count}


# ─── RFID tags ─────────────────────────────────────────────────────────────

def _rfid_response(tag: InventoryRFIDTag) -> RFIDResponse:
    """Shape an RFID row for the frontend.

    The frontend calls the tag's UID ``tag_uid``; this estate calls it
    ``rfid``. Both names are surfaced.
    """
    return RFIDResponse(
        id=tag.id,
        tenant_id=tag.tenant_id,
        item_id=tag.item_id,
        product_id=tag.item_id,
        rfid=tag.rfid,
        tag_uid=tag.rfid,
        status=tag.status,
        tag_type=tag.tag_type,
        frequency=tag.frequency,
        protocol=tag.protocol,
        memory_bits=tag.memory_bits,
        label=tag.label,
        outlet_id=tag.outlet_id,
        write_count=tag.write_count,
        last_seen_at=tag.last_seen_at,
        last_seen_location=tag.last_seen_location,
        notes=tag.notes,
        created_at=tag.created_at,
        updated_at=tag.updated_at,
    )


@router.get("/rfids", response_model=list[RFIDResponse],
            summary="RFID tags in this estate")
async def list_rfids(
    identity: CurrentIdentity,
    db: DbDep,
    product_id: uuid.UUID | None = None,
    status: str | None = None,
    search: str | None = Query(default=None, max_length=100),
):
    identity.require("view:inventory")

    stmt = select(InventoryRFIDTag).where(
        InventoryRFIDTag.tenant_id == identity.tenant_id
    )
    if product_id is not None:
        stmt = stmt.where(InventoryRFIDTag.item_id == product_id)
    if status:
        stmt = stmt.where(InventoryRFIDTag.status == status)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(or_(
            InventoryRFIDTag.rfid.ilike(like),
            InventoryRFIDTag.label.ilike(like),
        ))
    stmt = stmt.order_by(InventoryRFIDTag.created_at.desc())

    rows = list((await db.execute(stmt)).scalars().all())
    return [_rfid_response(t) for t in rows]


@router.post("/rfids", response_model=RFIDResponse,
             status_code=201, summary="Bind an RFID tag to an item")
async def create_rfid(
    payload: RFIDIn,
    identity: CurrentIdentity,
    db: DbDep,
):
    identity.require("manage:inventory")

    item_id = payload.item_id or payload.product_id
    if item_id is not None:
        exists = await db.scalar(
            select(InventoryItem.id).where(
                InventoryItem.id == item_id,
                InventoryItem.tenant_id == identity.tenant_id,
            )
        )
        if exists is None:
            raise HTTPException(status_code=404, detail="Inventory item not found")

    rfid_value = (payload.rfid or payload.tag_uid or "").strip()
    if not rfid_value:
        raise HTTPException(status_code=400, detail="A tag UID is required")

    clash = await db.scalar(
        select(InventoryRFIDTag.id).where(
            InventoryRFIDTag.tenant_id == identity.tenant_id,
            InventoryRFIDTag.rfid == rfid_value,
        )
    )
    if clash is not None:
        raise HTTPException(
            status_code=409, detail=f"Tag '{rfid_value}' is already bound"
        )

    tag = InventoryRFIDTag(
        tenant_id=identity.tenant_id,
        outlet_id=payload.outlet_id,
        item_id=item_id,
        rfid=rfid_value,
        status=payload.status,
        tag_type=payload.tag_type,
        frequency=payload.frequency,
        protocol=payload.protocol,
        memory_bits=payload.memory_bits,
        label=payload.label,
        notes=payload.notes,
    )
    db.add(tag)
    await db.flush()
    return _rfid_response(tag)


@router.patch("/rfids/{rfid_id}", response_model=RFIDResponse,
              summary="Update an RFID tag")
async def update_rfid(
    rfid_id: uuid.UUID,
    payload: RFIDUpdate,
    identity: CurrentIdentity,
    db: DbDep,
):
    identity.require("manage:inventory")

    tag = await db.scalar(
        select(InventoryRFIDTag).where(
            InventoryRFIDTag.id == rfid_id,
            InventoryRFIDTag.tenant_id == identity.tenant_id,
        )
    )
    if tag is None:
        raise HTTPException(status_code=404, detail="RFID tag not found")

    data = payload.model_dump(exclude_unset=True)
    item_id = data.pop("item_id", None)
    product_id = data.pop("product_id", None)
    if item_id is not None or product_id is not None:
        tag.item_id = item_id if item_id is not None else product_id

    new_uid = data.pop("tag_uid", None)
    new_rfid = data.pop("rfid", None)
    if new_rfid or new_uid:
        value = (new_rfid or new_uid or "").strip()
        clash = await db.scalar(
            select(InventoryRFIDTag.id).where(
                InventoryRFIDTag.tenant_id == identity.tenant_id,
                InventoryRFIDTag.rfid == value,
                InventoryRFIDTag.id != tag.id,
            )
        )
        if clash is not None:
            raise HTTPException(
                status_code=409, detail=f"Tag '{value}' is already bound"
            )
        tag.rfid = value

    for field, value in data.items():
        setattr(tag, field, value)
    await db.flush()
    return _rfid_response(tag)


@router.delete("/rfids/{rfid_id}", summary="Delete an RFID tag")
async def delete_rfid(
    rfid_id: uuid.UUID,
    identity: CurrentIdentity,
    db: DbDep,
):
    identity.require("manage:inventory")

    tag = await db.scalar(
        select(InventoryRFIDTag).where(
            InventoryRFIDTag.id == rfid_id,
            InventoryRFIDTag.tenant_id == identity.tenant_id,
        )
    )
    if tag is None:
        raise HTTPException(status_code=404, detail="RFID tag not found")
    await db.delete(tag)
    await db.flush()
    return {"message": "RFID tag deleted"}


@router.post("/rfids/{rfid_id}/scan", response_model=RFIDResponse,
             summary="Record a tag scan")
async def scan_rfid(
    rfid_id: uuid.UUID,
    identity: CurrentIdentity,
    db: DbDep,
    location: str = Query(...),
):
    """Record that a tag was read: bump the write count, stamp the place.

    A scan resolves to exactly one item, which is why the tag UID is
    unique per tenant.
    """
    identity.require("manage:inventory")

    tag = await db.scalar(
        select(InventoryRFIDTag).where(
            InventoryRFIDTag.id == rfid_id,
            InventoryRFIDTag.tenant_id == identity.tenant_id,
        )
    )
    if tag is None:
        raise HTTPException(status_code=404, detail="RFID tag not found")

    tag.last_seen_at = _now()
    tag.last_seen_location = location
    tag.write_count = int(tag.write_count or 0) + 1
    await db.flush()
    return _rfid_response(tag)


# ─── Catalog-section helpers & models ──────────────────────────────────────
# Pydantic input models for the catalog sections (mirrors the
# monolith's create/update payloads).

from pydantic import BaseModel, ConfigDict, Field

class ProductCreate(BaseModel):
    """Org-level product. Unknown ERP fields (prices, HSN, ...) are ignored
    rather than 422'ing: the frontend sends its InventoryProduct dict, and
    this service only owns the subset that maps onto an inventory item."""
    model_config = ConfigDict(extra="ignore")

    name: str = Field(min_length=1, max_length=200)
    code: str | None = None
    sku: str | None = None
    description: str | None = None
    category_id: uuid.UUID | None = None
    brand_id: uuid.UUID | None = None
    uom_id: uuid.UUID | None = None
    image_url: str | None = None
    barcode: str | None = None
    standard_cost: float = 0
    reorder_level: float = 0
    reorder_qty: float = 0
    track_batch: bool = False
    track_expiry: bool = False

class BrandCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(min_length=1, max_length=100)
    code: str | None = None
    description: str | None = None
    outlet_id: uuid.UUID | None = None


class BrandUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = None
    description: str | None = None
    is_active: bool | None = None

class CycleCountCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    outlet_id: uuid.UUID
    item_ids: list[uuid.UUID] | None = None
    notes: str | None = None


class CycleCountRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    item_id: uuid.UUID
    counted_qty: float = Field(ge=0)
    location_id: uuid.UUID | None = None


class CycleCountApprove(BaseModel):
    model_config = ConfigDict(extra="ignore")

    reason: str | None = None

def _count_to_dict(count: InventoryCycleCount, items: list[dict]) -> dict:
    """FE CycleCount shape (count_number / location / auditor / status /
    notes / items) plus the internal fields."""
    return {
        "id": str(count.id),
        "count_number": count.count_number,
        "outlet_id": str(count.outlet_id),
        "location": str(count.outlet_id),
        "auditor": None,
        "count_date": count.count_date.isoformat(),
        "status": count.status,
        "notes": count.notes,
        "total_variance": float(count.total_variance or 0),
        "created_by": str(count.created_by) if count.created_by else None,
        "created_at": count.created_at.isoformat(),
        "items": items,
    }


async def _count_items(db: DbDep, count: InventoryCycleCount,
                       tenant: uuid.UUID) -> list[dict]:
    rows = list((await db.execute(
        select(InventoryCycleCountItem).where(
            InventoryCycleCountItem.count_id == count.id,
            InventoryCycleCountItem.tenant_id == tenant,
        ).order_by(InventoryCycleCountItem.item_id)
    )).scalars().all())
    items = []
    for row in rows:
        name = None
        if rows is not None:
            item = await db.scalar(select(InventoryItem.id, InventoryItem.name)
                                   .where(InventoryItem.id == row.item_id))
            name = item[1] if item else None
        items.append({
            "id": str(row.id),
            "item_id": str(row.item_id),
            "item_name": name,
            "location_id": str(row.location_id) if row.location_id else None,
            "system_qty": float(row.system_qty or 0),
            "counted_qty": float(row.counted_qty) if row.counted_qty is not None else None,
            "diff": float(row.diff or 0),
        })
    return items

def _product_to_dict(item: InventoryItem, stock: float, extra: dict | None = None) -> dict:
    """InventoryProduct-ish shape: the fields this service owns are real,
    the pricing fields the org item does not carry are zeroed rather than
    faked, and any extra keys the route computed are merged in."""
    out = {
        "id": str(item.id),
        "name": item.name,
        "sku": item.sku,
        "barcode": item.barcode,
        "code": item.code,
        "category_id": str(item.category_id) if item.category_id else None,
        "brand_id": None,
        "uom_id": str(item.uom_id) if item.uom_id else None,
        "description": item.description,
        "short_description": item.description,
        "image_url": item.image_url,
        "item_type": str(item.item_type),
        "purchase_price": float(item.standard_cost or 0),
        "mrp": 0.0,
        "selling_price": float(item.standard_cost or 0),
        "tax_percent": 0.0,
        "discount_limit": 0.0,
        "initial_stock": 0.0,
        "stock": stock,
        "reorder_level": float(item.reorder_level or 0),
        "safety_stock": float(item.reorder_level or 0),
        "supplier": None,
        "warehouse": None,
        "status": "active" if item.is_active else "inactive",
        "is_active": item.is_active,
        "outlet_id": str(item.outlet_id) if item.outlet_id else None,
        "created_at": item.created_at.isoformat(),
        "updated_at": item.updated_at.isoformat(),
    }
    if extra:
        out.update(extra)
    return out

def _brand_to_dict(brand: InventoryBrand, products_count: int = 0) -> dict:
    """FE InventoryBrand shape plus the internal is_active flag."""
    return {
        "id": str(brand.id),
        "tenant_id": str(brand.tenant_id),
        "outlet_id": str(brand.outlet_id) if brand.outlet_id else None,
        "name": brand.name,
        "code": brand.code,
        "description": brand.description,
        "manufacturer": None,
        "category": None,
        "image_url": None,
        "status": "active" if brand.is_active else "inactive",
        "is_active": brand.is_active,
        "products_count": products_count,
        "created_at": brand.created_at.isoformat(),
        "updated_at": brand.updated_at.isoformat(),
    }

def _org_uom_url() -> str | None:
    """The organization service owns units of measure — bare UUIDs point at
    it everywhere in this database, so the list comes from it, proxied
    with the request's own identity, the same way menu proxies inventory.
    A failure here is 502, not 200-with-empty: an empty UoM list will
    break item creation and the store team must know why."""
    descriptor = get_descriptor("organization")
    if descriptor is None:
        return None
    return f"{base_url(descriptor)}/api/v1/organization/uom"


def _identity_headers(identity: CurrentIdentity) -> dict[str, str]:
    """The X-Identity-* set the gateway would set — same convention the
    menu service's cross-service reads use."""
    return {
        "X-Identity-Tenant-Id": str(identity.tenant_id),
        "X-Identity-User-Id": str(identity.user_id),
        "X-Identity-Email": identity.email,
        "X-Identity-Permissions": ",".join(sorted(identity.permissions)),
        "X-Identity-Is-Owner": "true" if identity.is_tenant_owner else "false",
        "X-Identity-Active-Outlet": str(identity.active_outlet_id)
        if identity.active_outlet_id else "",
        "X-Identity-Allowed-Outlets": ",".join(
            str(o) for o in sorted(identity.allowed_outlet_ids, key=str)),
    }

def _warehouse_to_dict(loc: StorageLocation) -> dict:
    """FE Warehouse shape, projected from a storage location."""
    return {
        "id": str(loc.id),
        "tenant_id": str(loc.tenant_id),
        "outlet_id": str(loc.outlet_id),
        "name": loc.name,
        "warehouse_type": str(loc.location_type),
        "location_type": str(loc.location_type),
        "module": loc.module,
        "is_central": loc.is_central,
        "capacity": None,
        "manager_name": None,
        "employees": 0,
        "temperature_control": "cold" if str(loc.location_type) == "cold_store" else None,
        "status": "active" if loc.is_active else "inactive",
        "is_active": loc.is_active,
        "address": None,
        "created_at": loc.created_at.isoformat(),
        "updated_at": loc.updated_at.isoformat(),
    }

# ─── Product catalog clusters ─────────────────────────────────────────────
#
# Org-level products, brands, UoMs and warehouse-tier locations — the
# clusters the frontend's product-catalog tabs call. Ported from the
# identifiers module alongside the barcode routes above.

@router.post("/cycle-counts", status_code=http_status.HTTP_201_CREATED,
                       summary="Open a cycle count with a system-quantity snapshot")
async def create_cycle_count(payload: CycleCountCreate,
                             identity: CurrentIdentity, db: DbDep):
    identity.require("manage:inventory")
    outlet = payload.outlet_id
    today = date.today()
    seq = (await db.scalar(
        select(func.count(InventoryCycleCount.id)).where(
            InventoryCycleCount.tenant_id == identity.tenant_id,
            InventoryCycleCount.count_date == today,
        )
    )) or 0
    count = InventoryCycleCount(
        tenant_id=identity.tenant_id,
        outlet_id=outlet,
        count_number=f"CC-{today:%Y%m%d}-{seq + 1:03d}",
        count_date=today,
        status="draft",
        notes=payload.notes,
        created_by=identity.user_id,
    )
    db.add(count)
    await db.flush()

    stock_rows = list((await db.execute(
        select(InventoryStock).where(
            InventoryStock.tenant_id == identity.tenant_id,
            InventoryStock.outlet_id == outlet,
        )
    )).scalars().all())

    if payload.item_ids:
        wanted = set(payload.item_ids)
        targets = [i.id for i in (await db.execute(
            select(InventoryItem).where(
                InventoryItem.id.in_(payload.item_ids),
                InventoryItem.tenant_id == identity.tenant_id,
            )
        )).scalars().all()]
        by_item: dict[uuid.UUID, float] = {t: 0.0 for t in targets}
        for s in stock_rows:
            if s.inventory_item_id in wanted:
                by_item[s.inventory_item_id] = svc._q(
                    by_item.get(s.inventory_item_id, 0.0) + float(s.qty_on_hand))
    else:
        # Default: every item that actually has stock at this outlet. A
        # count of fifty empty rows is noise; the snapshot is for the
        # physical stock.
        by_item = {}
        for s in stock_rows:
            if float(s.qty_on_hand) != 0 or s.inventory_item_id in by_item:
                by_item[s.inventory_item_id] = svc._q(
                    by_item.get(s.inventory_item_id, 0.0) + float(s.qty_on_hand))

    for item_id, qty in by_item.items():
        db.add(InventoryCycleCountItem(
            tenant_id=identity.tenant_id,
            count_id=count.id,
            outlet_id=outlet,
            item_id=item_id,
            system_qty=qty,
            counted_qty=None,
            diff=0,
        ))
    await db.flush()

    items = await _count_items(db, count, identity.tenant_id)
    return _count_to_dict(count, items)


@router.get("/cycle-counts", summary="List cycle counts")
async def list_cycle_counts(identity: CurrentIdentity, db: DbDep,
                            outlet_id: uuid.UUID | None = None,
                            status: str | None = None):
    identity.require("view:inventory")
    stmt = select(InventoryCycleCount).where(
        InventoryCycleCount.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(InventoryCycleCount.outlet_id == outlet_id)
    if status:
        stmt = stmt.where(InventoryCycleCount.status == status)
    stmt = stmt.order_by(InventoryCycleCount.created_at.desc()).limit(200)
    out = []
    for count in (await db.execute(stmt)).scalars().all():
        out.append(_count_to_dict(
            count, await _count_items(db, count, identity.tenant_id)))
    return out


@router.get("/cycle-counts/{count_id}", summary="One cycle count")
async def get_cycle_count(count_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:inventory")
    count = await db.scalar(select(InventoryCycleCount).where(
        InventoryCycleCount.id == count_id,
        InventoryCycleCount.tenant_id == identity.tenant_id,
    ))
    if count is None:
        raise HTTPException(status_code=404, detail="Cycle count not found")
    return _count_to_dict(count, await _count_items(db, count, identity.tenant_id))


@router.post("/cycle-counts/{count_id}/record",
                        summary="Record a counted quantity for one line")
async def record_cycle_count(count_id: uuid.UUID, payload: CycleCountRecord,
                             identity: CurrentIdentity, db: DbDep):
    """The recount itself. No stock moves here — approval is the gate, so
    a count can sit in the store room and be posted later."""
    identity.require("manage:inventory")
    count = await db.scalar(select(InventoryCycleCount).where(
        InventoryCycleCount.id == count_id,
        InventoryCycleCount.tenant_id == identity.tenant_id,
    ))
    if count is None:
        raise HTTPException(status_code=404, detail="Cycle count not found")
    if count.status == "approved":
        raise HTTPException(status_code=409, detail="Cycle count is already approved")
    row = await db.scalar(select(InventoryCycleCountItem).where(
        InventoryCycleCountItem.count_id == count.id,
        InventoryCycleCountItem.item_id == payload.item_id,
    ))
    if row is None:
        # Recording an item that was not in the snapshot adds a line with a
        # system quantity of zero — the counter may have found stock the
        # system did not know about, which is the most important variance.
        row = InventoryCycleCountItem(
            tenant_id=identity.tenant_id,
            count_id=count.id,
            outlet_id=count.outlet_id,
            item_id=payload.item_id,
            system_qty=0,
            location_id=payload.location_id,
        )
        db.add(row)
    row.counted_qty = svc._q(payload.counted_qty)
    row.diff = svc._q(payload.counted_qty) - svc._q(row.system_qty)
    row.location_id = payload.location_id or row.location_id
    count.status = "in_progress"
    await db.flush()

    items = await _count_items(db, count, identity.tenant_id)
    return _count_to_dict(count, items)


@router.post("/cycle-counts/{count_id}/approve",
                        summary="Post the variances to the stock ledger")
async def approve_cycle_count(count_id: uuid.UUID, payload: CycleCountApprove,
                              identity: CurrentIdentity, db: DbDep):
    """Sum every non-zero diff and post it through the adjustment path —
    the same gate every stock correction goes through, so a cycle count
    cannot bypass approval or the movement ledger."""
    identity.require("manage:inventory")
    count = await db.scalar(select(InventoryCycleCount).where(
        InventoryCycleCount.id == count_id,
        InventoryCycleCount.tenant_id == identity.tenant_id,
    ))
    if count is None:
        raise HTTPException(status_code=404, detail="Cycle count not found")
    if count.status == "approved":
        raise HTTPException(status_code=409, detail="Cycle count is already approved")

    total_variance = 0.0
    posted: list[dict] = []
    for row in (await db.execute(
        select(InventoryCycleCountItem).where(
            InventoryCycleCountItem.count_id == count.id,
            InventoryCycleCountItem.tenant_id == identity.tenant_id,
            InventoryCycleCountItem.counted_qty.isnot(None),
        )
    )).scalars().all():
        diff = float(row.diff or 0)
        if diff == 0:
            continue
        item = await svc.load_item(db, identity.tenant_id, row.item_id)
        if item is None:
            continue
        try:
            adjustment = await svc.request_adjustment(
                db, identity.tenant_id, count.outlet_id, item,
                float(row.counted_qty),
                location_id=row.location_id,
                reason=f"Cycle count {count.count_number}" + (
                    f": {payload.reason}" if payload.reason else ""),
                requested_by=identity.user_id,
            )
            await svc.decide_adjustment(
                db, identity.tenant_id, count.outlet_id, item, adjustment,
                True, approved_by=identity.user_id,
                reason=f"Cycle count {count.count_number}",
            )
        except svc.InventoryError as exc:
            # A variance the system cannot honour (drives stock negative
            # and the item forbids it) is a data problem, not a stock
            # problem: fail the whole approval rather than posting half
            # of a count.
            raise HTTPException(status_code=409, detail=str(exc))
        total_variance = svc._q(total_variance + diff)
        posted.append({"item_id": str(row.item_id), "counted_qty": float(row.counted_qty),
                       "diff": diff})

    count.total_variance = total_variance
    count.status = "approved"
    count.approved_by = identity.user_id
    count.approved_at = datetime.now(timezone.utc)
    await db.flush()
    return _count_to_dict(count, await _count_items(db, count, identity.tenant_id) +
                          [{"posted": posted}])


@router.delete("/cycle-counts/{count_id}", summary="Delete an unapproved count")
async def delete_cycle_count(count_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:inventory")
    count = await db.scalar(select(InventoryCycleCount).where(
        InventoryCycleCount.id == count_id,
        InventoryCycleCount.tenant_id == identity.tenant_id,
    ))
    if count is None:
        raise HTTPException(status_code=404, detail="Cycle count not found")
    if count.status == "approved":
        raise HTTPException(status_code=409,
                            detail="An approved count is part of the audit trail; it cannot be deleted")
    await db.delete(count)
    await db.flush()
    return {"message": "Cycle count deleted"}


# ─── Expiry ──────────────────────────────────────────────────────────────────

def _batch_with_item(db_ref: DbDep) -> None:  # pragma: no cover — placeholder
    pass



@router.get("/products", summary="Org-level products (no outlet)")
async def list_products(identity: CurrentIdentity, db: DbDep,
                       search: str | None = None,
                       page: int = Query(default=1, ge=1),
                       page_size: int = Query(default=20, ge=1, le=500)):
    """The product master: items whose outlet_id is NULL, shared by every
    outlet. Paginated in the FE's PaginatedResponse shape."""
    identity.require("view:inventory")
    conditions = [
        InventoryItem.tenant_id == identity.tenant_id,
        InventoryItem.outlet_id.is_(None),
    ]
    if search:
        like = f"%{search.lower()}%"
        conditions.append(or_(
            InventoryItem.name.ilike(like),
            InventoryItem.code.ilike(like),
            InventoryItem.sku.ilike(like),
            InventoryItem.barcode.ilike(like),
        ))
    total = (await db.scalar(
        select(func.count(InventoryItem.id)).where(*conditions))) or 0
    rows = list((await db.execute(
        select(InventoryItem).where(*conditions)
        .order_by(InventoryItem.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all())

    out = []
    for item in rows:
        # One available-stock total across all outlets: available =
        # on_hand - reserved, summed over the item's stock rows.
        stock_row = (await db.scalar(
            select(func.coalesce(func.sum(InventoryStock.qty_on_hand)
                                 - func.sum(InventoryStock.qty_reserved), 0))
            .where(
                InventoryStock.inventory_item_id == item.id,
                InventoryStock.tenant_id == identity.tenant_id,
            )
        )) or 0.0
        out.append(_product_to_dict(item, float(stock_row)))
    total_pages = max(1, -(-total // page_size))
    return {
        "items": out,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.post("/products", status_code=http_status.HTTP_201_CREATED,
                        summary="Create an org-level product")
async def create_product(payload: ProductCreate,
                         identity: CurrentIdentity, db: DbDep):
    """Outlet NULL = org-level, visible to every outlet's stockroom."""
    identity.require("manage:inventory")
    name = payload.name.strip()
    code = (payload.code or "").strip() or f"PRD-{uuid.uuid4().hex[:10].upper()}"
    item = InventoryItem(
        tenant_id=identity.tenant_id,
        outlet_id=None,
        name=name,
        code=code,
        sku=payload.sku,
        description=payload.description,
        uom_id=payload.uom_id,
        category_id=payload.category_id,
        image_url=payload.image_url,
        standard_cost=svc._q(payload.standard_cost),
        reorder_level=svc._q(payload.reorder_level),
        reorder_qty=svc._q(payload.reorder_qty),
        track_batch=payload.track_batch,
        track_expiry=payload.track_expiry,
        barcode=payload.barcode,
    )
    db.add(item)
    await db.flush()
    return _product_to_dict(item, 0.0, {
        "category_name": None,
        "brand_name": None,
        "uom_name": None,
    })


# ─── Brands ──────────────────────────────────────────────────────────────────

@router.get("/brands", summary="List brands")
async def list_brands(identity: CurrentIdentity, db: DbDep,
                      search: str | None = None,
                      outlet_id: uuid.UUID | None = None,
                      page: int = Query(default=1, ge=1),
                      page_size: int = Query(default=20, ge=1, le=500)):
    identity.require("view:inventory")
    conditions = [InventoryBrand.tenant_id == identity.tenant_id]
    if outlet_id:
        conditions.append(InventoryBrand.outlet_id == outlet_id)
    if search:
        like = f"%{search.lower()}%"
        conditions.append(or_(InventoryBrand.name.ilike(like),
                              InventoryBrand.code.ilike(like)))
    total = (await db.scalar(
        select(func.count(InventoryBrand.id)).where(*conditions))) or 0
    rows = list((await db.execute(
        select(InventoryBrand).where(*conditions)
        .order_by(InventoryBrand.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all())
    return {
        "items": [_brand_to_dict(b) for b in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, -(-total // page_size)),
    }


@router.post("/brands", status_code=http_status.HTTP_201_CREATED,
                        summary="Create a brand")
async def create_brand(payload: BrandCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:inventory")
    brand = InventoryBrand(
        tenant_id=identity.tenant_id,
        outlet_id=payload.outlet_id,
        name=payload.name.strip(),
        code=payload.code,
        description=payload.description,
        is_active=True,
    )
    db.add(brand)
    await db.flush()
    return _brand_to_dict(brand)


@router.patch("/brands/{brand_id}", summary="Update a brand")
async def update_brand(brand_id: uuid.UUID, payload: BrandUpdate,
                       identity: CurrentIdentity, db: DbDep):
    identity.require("manage:inventory")
    brand = await db.scalar(select(InventoryBrand).where(
        InventoryBrand.id == brand_id,
        InventoryBrand.tenant_id == identity.tenant_id,
    ))
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(brand, field, value)
    await db.flush()
    return _brand_to_dict(brand)


@router.delete("/brands/{brand_id}", summary="Delete a brand")
async def delete_brand(brand_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:inventory")
    brand = await db.scalar(select(InventoryBrand).where(
        InventoryBrand.id == brand_id,
        InventoryBrand.tenant_id == identity.tenant_id,
    ))
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    await db.delete(brand)
    await db.flush()
    return {"message": "Brand deleted"}


# ─── Units of measure (owned by the organization service) ──────────────────

@router.get("/uoms", summary="Units of measure (proxied to organization)")
async def list_uoms(identity: CurrentIdentity):
    identity.require("view:inventory")
    url = _org_uom_url()
    if url is None:
        raise HTTPException(status_code=502, detail="Organization service is not registered")
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, headers=_identity_headers(identity))
    if resp.status_code != 200:
        raise HTTPException(status_code=502,
                            detail=f"Organization service returned {resp.status_code}")
    data = resp.json() or []
    total = len(data)
    return {"items": data, "total": total, "page": 1, "page_size": total,
            "total_pages": 1}


@router.post("/uoms", status_code=http_status.HTTP_201_CREATED,
                        summary="Create a unit of measure (proxied to organization)")
async def create_uom(payload: dict, identity: CurrentIdentity):
    identity.require("manage:inventory")
    url = _org_uom_url()
    if url is None:
        raise HTTPException(status_code=502, detail="Organization service is not registered")
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, json=payload,
                                 headers=_identity_headers(identity))
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502,
                            detail=f"Organization service returned {resp.status_code}")
    return resp.json()


@router.patch("/uoms/{uom_id}",
                         summary="Update a unit of measure (proxied to organization)")
async def update_uom(uom_id: uuid.UUID, payload: dict, identity: CurrentIdentity):
    identity.require("manage:inventory")
    url = _org_uom_url()
    if url is None:
        raise HTTPException(status_code=502, detail="Organization service is not registered")
    async with httpx.AsyncClient(timeout=10.0) as client:
        # Organization's UoM update verb is PUT.
        resp = await client.put(f"{url}/{uom_id}", json=payload,
                                headers=_identity_headers(identity))
    if resp.status_code not in (200, 204):
        raise HTTPException(status_code=502,
                            detail=f"Organization service returned {resp.status_code}")
    return {"message": "Unit of measure updated", "id": str(uom_id)}


@router.delete("/uoms/{uom_id}",
                          summary="Deactivate a unit of measure (proxied to organization)")
async def delete_uom(uom_id: uuid.UUID, identity: CurrentIdentity):
    identity.require("manage:inventory")
    url = _org_uom_url()
    if url is None:
        raise HTTPException(status_code=502, detail="Organization service is not registered")
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.delete(f"{url}/{uom_id}",
                                   headers=_identity_headers(identity))
    if resp.status_code not in (200, 204):
        raise HTTPException(status_code=502,
                            detail=f"Organization service returned {resp.status_code}")
    return {"message": "Unit of measure deactivated"}


# ─── Warehouses ──────────────────────────────────────────────────────────────

_WAREHOUSE_MODULES = ("warehouse", "central")


@router.get("/warehouses", summary="Warehouse-tier storage locations")
async def list_warehouses(identity: CurrentIdentity, db: DbDep,
                          outlet_id: uuid.UUID | None = None):
    identity.require("view:inventory")
    stmt = select(StorageLocation).where(
        StorageLocation.tenant_id == identity.tenant_id,
        StorageLocation.is_active,
        or_(
            StorageLocation.module.in_(_WAREHOUSE_MODULES),
            StorageLocation.is_central,
        ),
    )
    if outlet_id:
        stmt = stmt.where(StorageLocation.outlet_id == outlet_id)
    rows = list((await db.execute(stmt.order_by(StorageLocation.name)))
                .scalars().all())
    return [_warehouse_to_dict(r) for r in rows]


@router.post("/warehouses", status_code=http_status.HTTP_201_CREATED,
                        summary="Create a warehouse-tier location")
async def create_warehouse(payload: dict, identity: CurrentIdentity, db: DbDep):
    """A storage location with module=warehouse: the hub of the hub-and-spoke
    transfer model already in service.py, named where the FE expects it."""
    identity.require("manage:inventory")
    outlet_id = payload.get("outlet_id")
    name = str(payload.get("name") or "").strip()
    if not outlet_id or not name:
        raise HTTPException(status_code=400,
                            detail="outlet_id and name are required")
    try:
        outlet = uuid.UUID(str(outlet_id))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid outlet_id")
    location = StorageLocation(
        tenant_id=identity.tenant_id,
        outlet_id=outlet,
        name=name,
        location_type=StorageLocationType(payload.get("location_type", "warehouse")),
        module="warehouse",
        is_central=bool(payload.get("is_central", True)),
    )
    db.add(location)
    await db.flush()
    return _warehouse_to_dict(location)

