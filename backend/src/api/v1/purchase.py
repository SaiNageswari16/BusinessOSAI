"""Procurement endpoints — vendors, PR → PO → GRN → vendor bill → payment.

The purchase flow is: raise a request from low stock → approve it → send a PO →
receive a GRN (which moves stock) → match the vendor bill → pay it.
"""
import uuid
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission, resolve_outlet_id
from src.database.session import get_db
from src.models import (
    GoodsReceiptNote,
    GoodsReceiptNoteLine,
    GRNStatus,
    InventoryItem,
    MovementType,
    POStatus,
    PRStatus,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseRequest,
    PurchaseRequestLine,
    Vendor,
    VendorBill,
    VendorBillLine,
    VendorBillStatus,
    VendorPayment,
    VendorType,
)
from src.schemas.purchase import (
    GRNCreate,
    GRNLineIn,
    GRNLineResponse,
    GRNResponse,
    POLineIn,
    POLineResponse,
    PRLineIn,
    PRLineResponse,
    PurchaseOrderCreate,
    PurchaseOrderResponse,
    PurchaseRequestCreate,
    PurchaseRequestResponse,
    VendorBillCreate,
    VendorBillLineIn,
    VendorBillLineResponse,
    VendorBillResponse,
    VendorCreate,
    VendorItemCreate,
    VendorItemResponse,
    VendorItemUpdate,
    VendorPaymentCreate,
    VendorPaymentResponse,
    VendorResponse,
    VendorUpdate,
)
from src.services import inventory_service
from src.services.kot_service import _status_value
from src.services.number_series import allocate_number

router = APIRouter(prefix="/purchase", tags=["Procurement"])

TWO_PLACES = Decimal("0.01")


def _d(value) -> Decimal:
    return Decimal("0") if value is None else Decimal(str(value))


def _money(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _get_po_for_ctx(
    db: AsyncSession, ctx: CurrentUserContext, po_id: uuid.UUID
) -> PurchaseOrder:
    po = (
        await db.execute(
            select(PurchaseOrder)
            .options(selectinload(PurchaseOrder.lines))
            .where(PurchaseOrder.id == po_id, PurchaseOrder.tenant_id == ctx.tenant_id)
        )
    ).scalars().first()
    if po is None:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    resolve_outlet_id(ctx, po.outlet_id)
    return po


# ─── Vendors ─────────────────────────────────────────────────────

@router.get("/vendors", response_model=list[VendorResponse])
async def list_vendors(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    search: str | None = None,
    include_inactive: bool = False,
):
    stmt = select(Vendor).where(Vendor.tenant_id == ctx.tenant_id)
    if not include_inactive:
        stmt = stmt.where(Vendor.is_active.is_(True))
    if search:
        stmt = stmt.where(
            Vendor.name.ilike(f"%{search}%") | Vendor.phone.ilike(f"%{search}%")
        )
    stmt = stmt.order_by(Vendor.name)
    return [VendorResponse.model_validate(v) for v in (await db.execute(stmt)).scalars().all()]


@router.post("/vendors", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
async def create_vendor(
    payload: VendorCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id, required=False)
    vendor = Vendor(
        tenant_id=ctx.tenant_id,
        code=await allocate_number(db, ctx.tenant_id, "vendor", payload.outlet_id),
        **payload.model_dump(),
    )
    db.add(vendor)
    await db.commit()
    await db.refresh(vendor)
    return VendorResponse.model_validate(vendor)


@router.get("/vendors/{vendor_id}", response_model=VendorResponse)
async def get_vendor(
    vendor_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    vendor = await db.scalar(
        select(Vendor).where(Vendor.id == vendor_id, Vendor.tenant_id == ctx.tenant_id)
    )
    if vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return VendorResponse.model_validate(vendor)


@router.put("/vendors/{vendor_id}", response_model=VendorResponse)
async def update_vendor(
    vendor_id: uuid.UUID,
    payload: VendorUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    vendor = await db.scalar(
        select(Vendor).where(Vendor.id == vendor_id, Vendor.tenant_id == ctx.tenant_id)
    )
    if vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(vendor, field, value)
    await db.commit()
    await db.refresh(vendor)
    return VendorResponse.model_validate(vendor)


@router.get("/vendors/{vendor_id}/items", response_model=list[VendorItemResponse])
async def list_vendor_items(
    vendor_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import VendorItem
    stmt = (
        select(VendorItem)
        .where(VendorItem.vendor_id == vendor_id, VendorItem.tenant_id == ctx.tenant_id)
        .order_by(VendorItem.created_at.desc())
    )
    return [
        VendorItemResponse.model_validate(vi)
        for vi in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/vendors/{vendor_id}/items", response_model=VendorItemResponse,
             status_code=status.HTTP_201_CREATED)
async def add_vendor_item(
    vendor_id: uuid.UUID,
    payload: VendorItemCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import VendorItem
    vendor = await db.scalar(
        select(Vendor).where(Vendor.id == vendor_id, Vendor.tenant_id == ctx.tenant_id)
    )
    if vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found")

    data = payload.model_dump()
    data.pop("vendor_id", None)
    vendor_item = VendorItem(tenant_id=ctx.tenant_id, vendor_id=vendor_id, **data)
    db.add(vendor_item)
    await db.commit()
    await db.refresh(vendor_item)
    return VendorItemResponse.model_validate(vendor_item)


@router.put("/vendor-items/{item_id}", response_model=VendorItemResponse)
async def update_vendor_item(
    item_id: uuid.UUID,
    payload: VendorItemUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import VendorItem
    vendor_item = await db.scalar(
        select(VendorItem).where(
            VendorItem.id == item_id, VendorItem.tenant_id == ctx.tenant_id
        )
    )
    if vendor_item is None:
        raise HTTPException(status_code=404, detail="Vendor item not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(vendor_item, field, value)
    await db.commit()
    await db.refresh(vendor_item)
    return VendorItemResponse.model_validate(vendor_item)


# ─── Purchase requests ───────────────────────────────────────────

@router.get("/requests", response_model=list[PurchaseRequestResponse])
async def list_purchase_requests(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    status_filter: str | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = (
        select(PurchaseRequest)
        .options(selectinload(PurchaseRequest.lines))
        .where(PurchaseRequest.tenant_id == ctx.tenant_id)
    )
    if outlet_id:
        stmt = stmt.where(PurchaseRequest.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(PurchaseRequest.status == status_filter)
    stmt = stmt.order_by(PurchaseRequest.created_at.desc())

    return [
        PurchaseRequestResponse.model_validate(pr)
        for pr in (await db.execute(stmt)).unique().scalars().all()
    ]


@router.post("/requests", response_model=PurchaseRequestResponse,
             status_code=status.HTTP_201_CREATED)
async def create_purchase_request(
    payload: PurchaseRequestCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id)
    pr = PurchaseRequest(
        tenant_id=ctx.tenant_id,
        outlet_id=payload.outlet_id,
        pr_number=await allocate_number(db, ctx.tenant_id, "purchase_request", payload.outlet_id),
        status=PRStatus.DRAFT,
        requested_by=ctx.user_id,
        notes=payload.notes,
    )
    db.add(pr)
    await db.flush()

    for line in payload.lines:
        db.add(PurchaseRequestLine(
            tenant_id=ctx.tenant_id,
            purchase_request_id=pr.id,
            **line.model_dump(),
        ))

    await db.commit()
    await db.refresh(pr)
    return PurchaseRequestResponse.model_validate(pr)


@router.post("/requests/{pr_id}/submit", response_model=PurchaseRequestResponse)
async def submit_purchase_request(
    pr_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    pr = await db.scalar(
        select(PurchaseRequest).where(
            PurchaseRequest.id == pr_id, PurchaseRequest.tenant_id == ctx.tenant_id
        )
    )
    if pr is None:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    resolve_outlet_id(ctx, pr.outlet_id)

    if _status_value(pr.status) != PRStatus.DRAFT.value:
        raise HTTPException(status_code=409, detail="This request has already been submitted")

    pr.status = PRStatus.SUBMITTED
    await db.commit()
    await db.refresh(pr)
    return PurchaseRequestResponse.model_validate(pr)


@router.post("/requests/{pr_id}/approve", response_model=PurchaseRequestResponse)
async def approve_purchase_request(
    pr_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("approve:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    pr = await db.scalar(
        select(PurchaseRequest).where(
            PurchaseRequest.id == pr_id, PurchaseRequest.tenant_id == ctx.tenant_id
        )
    )
    if pr is None:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    resolve_outlet_id(ctx, pr.outlet_id)

    if _status_value(pr.status) != PRStatus.SUBMITTED.value:
        raise HTTPException(
            status_code=409, detail="Only a submitted request can be approved"
        )
    if pr.requested_by == ctx.user_id:
        raise HTTPException(
            status_code=403, detail="You cannot approve your own purchase request"
        )

    pr.status = PRStatus.APPROVED
    pr.approved_by = ctx.user_id
    await db.commit()
    await db.refresh(pr)
    return PurchaseRequestResponse.model_validate(pr)


@router.post("/requests/{pr_id}/reject", response_model=PurchaseRequestResponse)
async def reject_purchase_request(
    pr_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("approve:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    reason: str | None = None,
):
    pr = await db.scalar(
        select(PurchaseRequest).where(
            PurchaseRequest.id == pr_id, PurchaseRequest.tenant_id == ctx.tenant_id
        )
    )
    if pr is None:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    resolve_outlet_id(ctx, pr.outlet_id)

    if _status_value(pr.status) != PRStatus.SUBMITTED.value:
        raise HTTPException(
            status_code=409, detail="Only a submitted request can be rejected"
        )

    pr.status = PRStatus.REJECTED
    if reason:
        pr.notes = ((pr.notes or "") + f"\n[REJECTED] {reason}").strip()
    await db.commit()
    await db.refresh(pr)
    return PurchaseRequestResponse.model_validate(pr)


@router.post("/requests/{pr_id}/convert", response_model=PurchaseOrderResponse,
             status_code=status.HTTP_201_CREATED)
async def convert_request_to_po(
    pr_id: uuid.UUID,
    vendor_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    expected_date: date | None = None,
):
    """Turn an approved request into a draft PO with the same lines."""
    pr = (
        await db.execute(
            select(PurchaseRequest)
            .options(selectinload(PurchaseRequest.lines))
            .where(
                PurchaseRequest.id == pr_id, PurchaseRequest.tenant_id == ctx.tenant_id
            )
        )
    ).scalars().first()
    if pr is None:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    resolve_outlet_id(ctx, pr.outlet_id)

    if _status_value(pr.status) != PRStatus.APPROVED.value:
        raise HTTPException(
            status_code=409, detail="Only an approved request can be converted to a PO"
        )

    vendor = await db.scalar(
        select(Vendor).where(Vendor.id == vendor_id, Vendor.tenant_id == ctx.tenant_id)
    )
    if vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found")

    po = PurchaseOrder(
        tenant_id=ctx.tenant_id,
        outlet_id=pr.outlet_id,
        vendor_id=vendor.id,
        po_number=await allocate_number(db, ctx.tenant_id, "purchase_order", pr.outlet_id),
        status=POStatus.DRAFT,
        order_date=date.today().isoformat(),
        expected_date=expected_date,
        created_by=ctx.user_id,
        notes=pr.notes,
    )
    db.add(po)
    await db.flush()

    subtotal = tax_total = Decimal("0")
    for line in pr.lines or []:
        item = await db.scalar(
            select(InventoryItem).where(InventoryItem.id == line.inventory_item_id)
        )
        unit_price = _d(item.standard_cost) if item else Decimal("0")
        line_total = _money(_d(line.qty) * unit_price)
        subtotal += line_total

        db.add(PurchaseOrderLine(
            tenant_id=ctx.tenant_id,
            purchase_order_id=po.id,
            inventory_item_id=line.inventory_item_id,
            qty=float(_d(line.qty)),
            uom_id=line.uom_id,
            unit_price=float(unit_price),
            tax_pct=0,
            tax_amount=0,
            line_total=float(line_total),
        ))

    po.subtotal = float(_money(subtotal))
    po.tax_total = 0
    po.grand_total = float(_money(subtotal + tax_total))

    pr.status = PRStatus.CONVERTED
    await db.commit()
    # refresh() doesn't populate relationships — re-fetch with lines loaded
    po_id = po.id
    po = (
        await db.execute(
            select(PurchaseOrder)
            .options(selectinload(PurchaseOrder.lines))
            .where(PurchaseOrder.id == po_id, PurchaseOrder.tenant_id == ctx.tenant_id)
        )
    ).scalar_one()
    return PurchaseOrderResponse.model_validate(po)


# ─── Purchase orders ─────────────────────────────────────────────

@router.get("/orders", response_model=list[PurchaseOrderResponse])
async def list_purchase_orders(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    vendor_id: uuid.UUID | None = None,
    status_filter: str | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = (
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .where(PurchaseOrder.tenant_id == ctx.tenant_id)
    )
    if outlet_id:
        stmt = stmt.where(PurchaseOrder.outlet_id == outlet_id)
    if vendor_id:
        stmt = stmt.where(PurchaseOrder.vendor_id == vendor_id)
    if status_filter:
        stmt = stmt.where(PurchaseOrder.status == status_filter)
    stmt = stmt.order_by(PurchaseOrder.created_at.desc())

    return [
        PurchaseOrderResponse.model_validate(po)
        for po in (await db.execute(stmt)).unique().scalars().all()
    ]


@router.post("/orders", response_model=PurchaseOrderResponse,
             status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    payload: PurchaseOrderCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id)
    vendor = await db.scalar(
        select(Vendor).where(
            Vendor.id == payload.vendor_id, Vendor.tenant_id == ctx.tenant_id
        )
    )
    if vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found")

    po = PurchaseOrder(
        tenant_id=ctx.tenant_id,
        outlet_id=payload.outlet_id,
        vendor_id=payload.vendor_id,
        po_number=await allocate_number(db, ctx.tenant_id, "purchase_order", payload.outlet_id),
        status=POStatus.DRAFT,
        order_date=date.today().isoformat(),
        expected_date=payload.expected_date,
        created_by=ctx.user_id,
        notes=payload.notes,
    )
    db.add(po)
    await db.flush()

    subtotal = tax_total = Decimal("0")
    for line in payload.lines:
        item = await db.scalar(
            select(InventoryItem).where(
                InventoryItem.id == line.inventory_item_id,
                InventoryItem.tenant_id == ctx.tenant_id,
            )
        )
        if item is None:
            raise HTTPException(
                status_code=400,
                detail=f"Inventory item {line.inventory_item_id} not found",
            )

        line_total = _money(_d(line.qty) * _d(line.unit_price))
        tax_amount = _money(line_total * _d(line.tax_pct) / Decimal("100"))
        subtotal += line_total
        tax_total += tax_amount

        db.add(PurchaseOrderLine(
            tenant_id=ctx.tenant_id,
            purchase_order_id=po.id,
            inventory_item_id=line.inventory_item_id,
            qty=float(_d(line.qty)),
            uom_id=line.uom_id or item.uom_id,
            unit_price=float(_d(line.unit_price)),
            tax_pct=float(_d(line.tax_pct)),
            tax_amount=float(tax_amount),
            line_total=float(line_total),
        ))

    po.subtotal = float(_money(subtotal))
    po.tax_total = float(_money(tax_total))
    po.grand_total = float(_money(subtotal + tax_total))

    await db.commit()
    # refresh() doesn't populate relationships — re-fetch with lines loaded
    po_id = po.id
    po = (
        await db.execute(
            select(PurchaseOrder)
            .options(selectinload(PurchaseOrder.lines))
            .where(PurchaseOrder.id == po_id, PurchaseOrder.tenant_id == ctx.tenant_id)
        )
    ).scalar_one()
    return PurchaseOrderResponse.model_validate(po)


@router.get("/orders/{po_id}", response_model=PurchaseOrderResponse)
async def get_purchase_order(
    po_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    po = await _get_po_for_ctx(db, ctx, po_id)
    return PurchaseOrderResponse.model_validate(po)


@router.post("/orders/{po_id}/send", response_model=PurchaseOrderResponse)
async def send_purchase_order(
    po_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    po = await _get_po_for_ctx(db, ctx, po_id)
    if _status_value(po.status) != POStatus.DRAFT.value:
        raise HTTPException(status_code=409, detail="This PO has already been sent")

    po.status = POStatus.SENT
    po.order_date = date.today().isoformat()
    await db.commit()
    # refresh() doesn't populate relationships — re-fetch with lines loaded
    po_id = po.id
    po = (
        await db.execute(
            select(PurchaseOrder)
            .options(selectinload(PurchaseOrder.lines))
            .where(PurchaseOrder.id == po_id, PurchaseOrder.tenant_id == ctx.tenant_id)
        )
    ).scalar_one()
    return PurchaseOrderResponse.model_validate(po)


@router.post("/orders/{po_id}/confirm", response_model=PurchaseOrderResponse)
async def confirm_purchase_order(
    po_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    po = await _get_po_for_ctx(db, ctx, po_id)
    if _status_value(po.status) != POStatus.SENT.value:
        raise HTTPException(status_code=409, detail="This PO has not been sent yet")

    po.status = POStatus.CONFIRMED
    await db.commit()
    # refresh() doesn't populate relationships — re-fetch with lines loaded
    po_id = po.id
    po = (
        await db.execute(
            select(PurchaseOrder)
            .options(selectinload(PurchaseOrder.lines))
            .where(PurchaseOrder.id == po_id, PurchaseOrder.tenant_id == ctx.tenant_id)
        )
    ).scalar_one()
    return PurchaseOrderResponse.model_validate(po)


@router.post("/orders/{po_id}/cancel", response_model=PurchaseOrderResponse)
async def cancel_purchase_order(
    po_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    reason: str | None = None,
):
    po = await _get_po_for_ctx(db, ctx, po_id)
    if _status_value(po.status) == POStatus.CANCELLED.value:
        raise HTTPException(status_code=409, detail="This PO is already cancelled")
    if _status_value(po.status) == POStatus.RECEIVED.value:
        raise HTTPException(
            status_code=409, detail="A fully received PO cannot be cancelled"
        )

    po.status = POStatus.CANCELLED
    if reason:
        po.notes = ((po.notes or "") + f"\n[CANCELLED] {reason}").strip()
    await db.commit()
    # refresh() doesn't populate relationships — re-fetch with lines loaded
    po_id = po.id
    po = (
        await db.execute(
            select(PurchaseOrder)
            .options(selectinload(PurchaseOrder.lines))
            .where(PurchaseOrder.id == po_id, PurchaseOrder.tenant_id == ctx.tenant_id)
        )
    ).scalar_one()
    return PurchaseOrderResponse.model_validate(po)


# ─── GRN ─────────────────────────────────────────────────────────

@router.get("/grn", response_model=list[GRNResponse])
async def list_grns(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    purchase_order_id: uuid.UUID | None = None,
    status_filter: str | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = (
        select(GoodsReceiptNote)
        .options(selectinload(GoodsReceiptNote.lines))
        .where(GoodsReceiptNote.tenant_id == ctx.tenant_id)
    )
    if outlet_id:
        stmt = stmt.where(GoodsReceiptNote.outlet_id == outlet_id)
    if purchase_order_id:
        stmt = stmt.where(GoodsReceiptNote.purchase_order_id == purchase_order_id)
    if status_filter:
        stmt = stmt.where(GoodsReceiptNote.status == status_filter)
    stmt = stmt.order_by(GoodsReceiptNote.created_at.desc())

    return [
        GRNResponse.model_validate(g)
        for g in (await db.execute(stmt)).unique().scalars().all()
    ]


@router.post("/grn", response_model=GRNResponse, status_code=status.HTTP_201_CREATED)
async def create_grn(
    payload: GRNCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Receive goods against a PO — stock moves in on QC pass."""
    resolve_outlet_id(ctx, payload.outlet_id)

    if payload.purchase_order_id:
        po = await _get_po_for_ctx(db, ctx, payload.purchase_order_id)
        if _status_value(po.status) in (POStatus.CANCELLED.value, POStatus.DRAFT.value):
            raise HTTPException(
                status_code=409,
                detail=f"Cannot receive goods against a {_status_value(po.status)} PO",
            )

    grn = GoodsReceiptNote(
        tenant_id=ctx.tenant_id,
        outlet_id=payload.outlet_id,
        purchase_order_id=payload.purchase_order_id,
        vendor_id=payload.vendor_id,
        grn_number=await allocate_number(db, ctx.tenant_id, "grn", payload.outlet_id),
        status=GRNStatus.DRAFT,
        received_date=payload.received_date or _now_iso(),
        received_by=ctx.user_id,
        invoice_number=payload.invoice_number,
        invoice_date=payload.invoice_date,
        qc_notes=payload.qc_notes,
        notes=payload.notes,
    )
    db.add(grn)
    await db.flush()

    for line in payload.lines:
        db.add(GoodsReceiptNoteLine(
            tenant_id=ctx.tenant_id,
            grn_id=grn.id,
            **line.model_dump(),
        ))

    await db.commit()
    # refresh() doesn't populate relationships — re-fetch with lines loaded
    grn_id = grn.id
    grn = (
        await db.execute(
            select(GRN)
            .options(selectinload(GRN.lines))
            .where(GRN.id == grn_id, GRN.tenant_id == ctx.tenant_id)
        )
    ).scalar_one()
    return GRNResponse.model_validate(grn)


@router.post("/grn/{grn_id}/receive", response_model=GRNResponse)
async def receive_grn(
    grn_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Post the GRN: accepted quantities become stock, PO lines are updated."""
    grn = (
        await db.execute(
            select(GoodsReceiptNote)
            .options(selectinload(GoodsReceiptNote.lines))
            .where(GoodsReceiptNote.id == grn_id, GoodsReceiptNote.tenant_id == ctx.tenant_id)
        )
    ).scalars().first()
    if grn is None:
        raise HTTPException(status_code=404, detail="GRN not found")
    resolve_outlet_id(ctx, grn.outlet_id)

    if _status_value(grn.status) != GRNStatus.DRAFT.value:
        raise HTTPException(status_code=409, detail="This GRN has already been received")

    for line in grn.lines or []:
        item = await db.scalar(
            select(InventoryItem).where(InventoryItem.id == line.inventory_item_id)
        )
        if item is None:
            raise HTTPException(
                status_code=400,
                detail=f"Inventory item {line.inventory_item_id} not found",
            )

        accepted = _d(line.accepted_qty) if _d(line.accepted_qty) > 0 else _d(line.received_qty)

        # Only what passed QC becomes stock; the rest is recorded as rejected
        if accepted > 0:
            await inventory_service._apply_movement(
                db,
                tenant_id=ctx.tenant_id,
                outlet_id=grn.outlet_id,
                inventory_item_id=line.inventory_item_id,
                location_id=item.default_location_id,
                movement_type=MovementType.PURCHASE,
                qty=accepted,
                unit_cost=_d(line.unit_price),
                reference_type="grn",
                reference_id=grn.grn_number,
                notes=f"Batch {line.batch_number}" if line.batch_number else None,
                created_by=ctx.user_id,
            )

        # Update the PO line's received quantity so partial receipts track
        if line.purchase_order_line_id:
            po_line = await db.scalar(
                select(PurchaseOrderLine).where(
                    PurchaseOrderLine.id == line.purchase_order_line_id
                )
            )
            if po_line is not None:
                po_line.received_qty = float(
                    _d(po_line.received_qty) + accepted
                )

    grn.status = GRNStatus.RECEIVED
    grn.received_date = grn.received_date or _now_iso()

    # Mark the PO partial or received based on how much arrived
    if grn.purchase_order_id:
        po = await _get_po_for_ctx(db, ctx, grn.purchase_order_id)
        fully_received = all(
            _d(line.received_qty) >= _d(line.qty) for line in po.lines or []
        )
        po.status = POStatus.RECEIVED if fully_received else POStatus.PARTIAL
        po.received_date = date.today().isoformat()

    await db.commit()
    # refresh() doesn't populate relationships — re-fetch with lines loaded
    grn_id = grn.id
    grn = (
        await db.execute(
            select(GRN)
            .options(selectinload(GRN.lines))
            .where(GRN.id == grn_id, GRN.tenant_id == ctx.tenant_id)
        )
    ).scalar_one()
    return GRNResponse.model_validate(grn)


@router.post("/grn/{grn_id}/qc", response_model=GRNResponse)
async def update_grn_qc(
    grn_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    status_filter: str,
    qc_notes: str | None = None,
):
    """QC verdict — pass or fail. A fail can still be received with zero accepted."""
    grn = await db.scalar(
        select(GoodsReceiptNote).where(
            GoodsReceiptNote.id == grn_id, GoodsReceiptNote.tenant_id == ctx.tenant_id
        )
    )
    if grn is None:
        raise HTTPException(status_code=404, detail="GRN not found")
    resolve_outlet_id(ctx, grn.outlet_id)

    if _status_value(grn.status) != GRNStatus.RECEIVED.value:
        raise HTTPException(status_code=409, detail="QC can only follow a receipt")

    if status_filter == "passed":
        grn.status = GRNStatus.QC_PASSED
    elif status_filter == "failed":
        grn.status = GRNStatus.QC_FAILED
    else:
        raise HTTPException(status_code=422, detail="status must be 'passed' or 'failed'")

    grn.qc_notes = qc_notes
    await db.commit()
    # refresh() doesn't populate relationships — re-fetch with lines loaded
    grn_id = grn.id
    grn = (
        await db.execute(
            select(GRN)
            .options(selectinload(GRN.lines))
            .where(GRN.id == grn_id, GRN.tenant_id == ctx.tenant_id)
        )
    ).scalar_one()
    return GRNResponse.model_validate(grn)


# ─── Vendor bills ────────────────────────────────────────────────

@router.get("/bills", response_model=list[VendorBillResponse])
async def list_vendor_bills(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    vendor_id: uuid.UUID | None = None,
    status_filter: str | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = (
        select(VendorBill)
        .options(selectinload(VendorBill.lines))
        .where(VendorBill.tenant_id == ctx.tenant_id)
    )
    if outlet_id:
        stmt = stmt.where(VendorBill.outlet_id == outlet_id)
    if vendor_id:
        stmt = stmt.where(VendorBill.vendor_id == vendor_id)
    if status_filter:
        stmt = stmt.where(VendorBill.status == status_filter)
    stmt = stmt.order_by(VendorBill.created_at.desc())

    return [
        VendorBillResponse.model_validate(b)
        for b in (await db.execute(stmt)).unique().scalars().all()
    ]


@router.post("/bills", response_model=VendorBillResponse,
             status_code=status.HTTP_201_CREATED)
async def create_vendor_bill(
    payload: VendorBillCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Enter a vendor invoice — usually matched against a GRN."""
    resolve_outlet_id(ctx, payload.outlet_id)
    vendor = await db.scalar(
        select(Vendor).where(
            Vendor.id == payload.vendor_id, Vendor.tenant_id == ctx.tenant_id
        )
    )
    if vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found")

    if payload.grn_id:
        grn = await db.scalar(
            select(GoodsReceiptNote).where(
                GoodsReceiptNote.id == payload.grn_id,
                GoodsReceiptNote.tenant_id == ctx.tenant_id,
            )
        )
        if grn is None:
            raise HTTPException(status_code=404, detail="GRN not found")

    bill = VendorBill(
        tenant_id=ctx.tenant_id,
        outlet_id=payload.outlet_id,
        vendor_id=payload.vendor_id,
        grn_id=payload.grn_id,
        bill_number=payload.bill_number
        or await allocate_number(db, ctx.tenant_id, "vendor_bill", payload.outlet_id),
        status=VendorBillStatus.UNPAID,
        bill_date=payload.bill_date or date.today().isoformat(),
        due_date=payload.due_date,
        notes=payload.notes,
    )
    db.add(bill)
    await db.flush()

    subtotal = tax_total = Decimal("0")
    for line in payload.lines:
        line_total = _money(_d(line.qty) * _d(line.unit_price))
        tax_amount = _money(line_total * _d(line.tax_pct) / Decimal("100"))
        subtotal += line_total
        tax_total += tax_amount

        db.add(VendorBillLine(
            tenant_id=ctx.tenant_id,
            vendor_bill_id=bill.id,
            **line.model_dump(),
            line_total=float(line_total),
        ))

    bill.subtotal = float(_money(subtotal))
    bill.tax_total = float(_money(tax_total))
    bill.grand_total = float(_money(subtotal + tax_total))
    bill.paid_amount = 0

    await db.commit()
    # refresh() doesn't populate relationships — re-fetch with lines loaded
    bill_id = bill.id
    bill = (
        await db.execute(
            select(VendorBill)
            .options(selectinload(VendorBill.lines))
            .where(VendorBill.id == bill_id, VendorBill.tenant_id == ctx.tenant_id)
        )
    ).scalar_one()
    return VendorBillResponse.model_validate(bill)


@router.get("/bills/{bill_id}", response_model=VendorBillResponse)
async def get_vendor_bill(
    bill_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    bill = (
        await db.execute(
            select(VendorBill)
            .options(selectinload(VendorBill.lines))
            .where(VendorBill.id == bill_id, VendorBill.tenant_id == ctx.tenant_id)
        )
    ).scalars().first()
    if bill is None:
        raise HTTPException(status_code=404, detail="Vendor bill not found")
    resolve_outlet_id(ctx, bill.outlet_id)
    return VendorBillResponse.model_validate(bill)


# ─── Vendor payments ─────────────────────────────────────────────

@router.post("/payments", response_model=VendorPaymentResponse,
             status_code=status.HTTP_201_CREATED)
async def pay_vendor_bill(
    payload: VendorPaymentCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Pay a vendor bill in full or in part."""
    resolve_outlet_id(ctx, payload.outlet_id)

    bill = None
    if payload.vendor_bill_id:
        bill = (
            await db.execute(
                select(VendorBill)
                .options(selectinload(VendorBill.payments))
                .where(
                    VendorBill.id == payload.vendor_bill_id,
                    VendorBill.tenant_id == ctx.tenant_id,
                )
            )
        ).scalars().first()
        if bill is None:
            raise HTTPException(status_code=404, detail="Vendor bill not found")
        resolve_outlet_id(ctx, bill.outlet_id)

        outstanding = _d(bill.grand_total) - _d(bill.paid_amount)
        if _d(payload.amount) > outstanding:
            raise HTTPException(
                status_code=400,
                detail=f"Payment exceeds the ₹{outstanding} outstanding",
            )

    payment = VendorPayment(
        tenant_id=ctx.tenant_id,
        outlet_id=payload.outlet_id,
        vendor_id=payload.vendor_id,
        vendor_bill_id=payload.vendor_bill_id,
        amount=float(_d(payload.amount)),
        method=payload.method,
        reference=payload.reference,
        paid_at=payload.paid_at or _now_iso(),
        paid_by=ctx.user_id,
    )
    db.add(payment)
    await db.flush()

    if bill is not None:
        bill.paid_amount = float(_d(bill.paid_amount) + _d(payload.amount))
        if _d(bill.paid_amount) >= _d(bill.grand_total):
            bill.status = VendorBillStatus.PAID
        elif _d(bill.paid_amount) > 0:
            bill.status = VendorBillStatus.PARTIALLY_PAID

    await db.commit()
    await db.refresh(payment)
    return VendorPaymentResponse.model_validate(payment)


@router.get("/payments", response_model=list[VendorPaymentResponse])
async def list_vendor_payments(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:purchase"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    vendor_id: uuid.UUID | None = None,
    limit: int = 200,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(VendorPayment).where(VendorPayment.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(VendorPayment.outlet_id == outlet_id)
    if vendor_id:
        stmt = stmt.where(VendorPayment.vendor_id == vendor_id)
    stmt = stmt.order_by(VendorPayment.created_at.desc()).limit(limit)
    return [
        VendorPaymentResponse.model_validate(p)
        for p in (await db.execute(stmt)).scalars().all()
    ]
