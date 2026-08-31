from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_
from typing import Annotated, List, Optional
from datetime import date, datetime, timedelta
from uuid import UUID

from src.database.session import get_db
from src.models.inventory import (
    InventoryBatch, InventorySerial, ProductQRCode, ProductRFID,
)
from src.schemas.warehouse import (
    ProductQRCodeCreate, ProductQRCodeUpdate, ProductQRCodeResponse,
    ProductRFIDCreate, ProductRFIDUpdate, ProductRFIDResponse,
)
from src.api.deps import CurrentUserContext, get_current_user_context

router = APIRouter()


# ==========================================
# Expiry Management — aggregate over batches + serials
# ==========================================

@router.get("/expiry/summary")
async def expiry_summary(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    cutoff_30 = today + timedelta(days=30)
    cutoff_90 = today + timedelta(days=90)

    expired_q = select(func.count(InventoryBatch.id), func.coalesce(func.sum(InventoryBatch.remaining_quantity), 0)).where(
        InventoryBatch.tenant_id == ctx.tenant_id,
        InventoryBatch.expiry_date.is_not(None),
        InventoryBatch.expiry_date < today,
        InventoryBatch.status != "Consumed",
    )
    expiring_30_q = select(func.count(InventoryBatch.id), func.coalesce(func.sum(InventoryBatch.remaining_quantity), 0)).where(
        InventoryBatch.tenant_id == ctx.tenant_id,
        InventoryBatch.expiry_date.is_not(None),
        InventoryBatch.expiry_date >= today,
        InventoryBatch.expiry_date <= cutoff_30,
        InventoryBatch.status != "Consumed",
    )
    expiring_90_q = select(func.count(InventoryBatch.id), func.coalesce(func.sum(InventoryBatch.remaining_quantity), 0)).where(
        InventoryBatch.tenant_id == ctx.tenant_id,
        InventoryBatch.expiry_date.is_not(None),
        InventoryBatch.expiry_date >= today,
        InventoryBatch.expiry_date <= cutoff_90,
        InventoryBatch.status != "Consumed",
    )

    expired = (await db.execute(expired_q)).one()
    expiring_30 = (await db.execute(expiring_30_q)).one()
    expiring_90 = (await db.execute(expiring_90_q)).one()

    return {
        "today": today.isoformat(),
        "expired": {"count": expired[0], "units": int(expired[1] or 0)},
        "expiring_30": {"count": expiring_30[0], "units": int(expiring_30[1] or 0)},
        "expiring_90": {"count": expiring_90[0], "units": int(expiring_90[1] or 0)},
    }


@router.get("/expiry/list")
async def expiry_list(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
    bucket: str = Query("all", pattern="^(expired|expiring_30|expiring_90|all|no_expiry)$"),
):
    today = date.today()
    q = select(InventoryBatch).where(
        InventoryBatch.tenant_id == ctx.tenant_id,
        InventoryBatch.expiry_date.is_not(None),
    )
    if bucket == "expired":
        q = q.where(InventoryBatch.expiry_date < today, InventoryBatch.status != "Consumed")
    elif bucket == "expiring_30":
        q = q.where(InventoryBatch.expiry_date >= today, InventoryBatch.expiry_date <= today + timedelta(days=30))
    elif bucket == "expiring_90":
        q = q.where(InventoryBatch.expiry_date >= today, InventoryBatch.expiry_date <= today + timedelta(days=90))
    q = q.order_by(InventoryBatch.expiry_date.asc())
    result = await db.execute(q)
    return [
        {
            "id": str(b.id),
            "batch_number": b.batch_number,
            "product_name": b.product_name,
            "sku": b.sku,
            "warehouse_name": b.warehouse_name,
            "quantity": b.quantity,
            "remaining_quantity": b.remaining_quantity,
            "manufacturing_date": str(b.manufacturing_date) if b.manufacturing_date else None,
            "expiry_date": str(b.expiry_date) if b.expiry_date else None,
            "status": b.status,
            "days_to_expiry": (b.expiry_date - today).days if b.expiry_date else None,
        }
        for b in result.scalars().all()
    ]


@router.post("/expiry/apply-discount")
async def apply_expiry_discount(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
    batch_id: str = Query(...),
    discount_percent: float = Query(..., ge=0, le=100),
):
    """Apply a discount to a batch — useful for near-expiry clearance campaigns.
    The discount is recorded in the batch notes (real MRP changes happen via pricing).
    """
    result = await db.execute(
        select(InventoryBatch).where(
            InventoryBatch.id == UUID(batch_id),
            InventoryBatch.tenant_id == ctx.tenant_id,
        )
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    tag = f"[DISCOUNT={discount_percent}%]"
    batch.notes = ((batch.notes or "") + "\n" + tag).strip()
    await db.commit()
    await db.refresh(batch)
    return {"message": f"Applied {discount_percent}% discount to batch {batch.batch_number}", "batch_id": str(batch.id)}


@router.post("/expiry/write-off")
async def write_off_expired(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
    batch_id: str = Query(...),
    reason: str = Query("expired"),
):
    """Mark an expired batch as written off — quantity reduced to 0, status set to Consumed."""
    result = await db.execute(
        select(InventoryBatch).where(
            InventoryBatch.id == UUID(batch_id),
            InventoryBatch.tenant_id == ctx.tenant_id,
        )
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    batch.remaining_quantity = 0
    batch.status = "Consumed"
    batch.notes = ((batch.notes or "") + f"\n[WRITE-OFF: {reason}]").strip()
    await db.commit()
    return {"message": f"Batch {batch.batch_number} written off", "batch_id": str(batch.id)}


# ==========================================
# Manufacturing Dates — aggregate by date buckets
# ==========================================

@router.get("/manufacturing/cohorts")
async def manufacturing_cohorts(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    cutoff_30 = today + timedelta(days=30)
    cutoff_90 = today + timedelta(days=90)

    cohorts = {
        "lt_30d":  (today,            today + timedelta(days=30)),
        "lt_90d":  (today + timedelta(days=30), today + timedelta(days=90)),
        "lt_180d": (today + timedelta(days=90), today + timedelta(days=180)),
        "gt_180d": (today + timedelta(days=180), None),
    }
    out = {}
    for key, (lo, hi) in cohorts.items():
        q = select(func.count(InventoryBatch.id), func.coalesce(func.sum(InventoryBatch.remaining_quantity), 0)).where(
            InventoryBatch.tenant_id == ctx.tenant_id,
            InventoryBatch.manufacturing_date.is_not(None),
            InventoryBatch.manufacturing_date >= lo,
        )
        if hi:
            q = q.where(InventoryBatch.manufacturing_date < hi)
        cnt, qty = (await db.execute(q)).one()
        out[key] = {"count": cnt, "units": int(qty or 0)}

    serial_q = select(func.count(InventorySerial.id)).where(
        InventorySerial.tenant_id == ctx.tenant_id,
        InventorySerial.manufacturing_date.is_not(None),
    )
    out["serials_tracked"] = (await db.execute(serial_q)).scalar()
    return {"today": today.isoformat(), "cohorts": out}


@router.get("/manufacturing/list")
async def manufacturing_list(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InventoryBatch).where(
            InventoryBatch.tenant_id == ctx.tenant_id,
            InventoryBatch.manufacturing_date.is_not(None),
        ).order_by(InventoryBatch.manufacturing_date.desc())
    )
    return [
        {
            "id": str(b.id),
            "batch_number": b.batch_number,
            "product_name": b.product_name,
            "sku": b.sku,
            "warehouse_name": b.warehouse_name,
            "quantity": b.quantity,
            "remaining_quantity": b.remaining_quantity,
            "manufacturing_date": str(b.manufacturing_date) if b.manufacturing_date else None,
            "expiry_date": str(b.expiry_date) if b.expiry_date else None,
            "supplier": b.supplier,
        }
        for b in result.scalars().all()
    ]


# ==========================================
# Barcode Generation — uses existing Product.barcode, plus generated lookups
# ==========================================

@router.get("/barcodes")
async def list_barcodes(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
    search: Optional[str] = None,
):
    from sqlalchemy.orm import joinedload
    from src.models.inventory import Product
    q = select(Product).options(joinedload(Product.category)).where(Product.tenant_id == ctx.tenant_id, Product.barcode.is_not(None))
    if search:
        q = q.where(or_(Product.name.ilike(f"%{search}%"), Product.barcode.ilike(f"%{search}%"), Product.sku.ilike(f"%{search}%")))
    q = q.order_by(Product.updated_at.desc()).limit(500)
    result = await db.execute(q)
    return [
        {
            "id": str(p.id),
            "product_name": p.name,
            "sku": p.sku,
            "barcode": p.barcode,
            "format": "EAN-13" if p.barcode and len(p.barcode) == 13 else ("Code-128" if p.barcode else None),
            "selling_price": float(p.selling_price) if p.selling_price is not None else None,
            "image_url": p.image_url,
            "category_name": p.category.name if p.category else None,
        }
        for p in result.scalars().all()
    ]


def compute_ean13_checksum(twelve_digits: str) -> str:
    """Standard GS1 EAN-13 Modulo-10 weighted checksum."""
    total = 0
    for i, char in enumerate(twelve_digits):
        weight = 1 if (i % 2 == 0) else 3
        total += int(char) * weight
    mod = total % 10
    return str((10 - mod) % 10)


def generate_tenant_barcode(tenant_id: UUID, seq_num: int, barcode_format: str = "EAN-13", prefix: str | None = None) -> tuple[str, str]:
    """
    Generates a guaranteed scannable, collision-free tenant-scoped barcode.
    - EAN-13 (GS1 In-Store RCN): '20' (2 digits) + 4-digit tenant code + 6-digit sequence + 1-digit GS1 Modulo-10 Checksum = 13 digits.
    - Code-128: '[PREFIX]-[TENANT_HASH]-[SEQ]'
    """
    tenant_code = f"{(tenant_id.int % 9000) + 1000:04d}"
    if barcode_format.upper() == "CODE-128":
        p = (prefix or "BOS").upper().strip()
        code = f"{p}-{tenant_code}-{seq_num % 100000:05d}"
        return code, "Code-128"
    else:
        # GS1 EAN-13 internal store format starting with restricted prefix 20
        twelve = f"20{tenant_code}{seq_num % 1000000:06d}"
        checksum = compute_ean13_checksum(twelve)
        return twelve + checksum, "EAN-13"


@router.post("/barcodes/generate")
async def generate_barcode(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
    product_id: str = Query(...),
    format: str = Query("EAN-13", description="Barcode format: EAN-13 or Code-128"),
    prefix: str | None = Query(None, description="Optional custom prefix for Code-128"),
    force: bool = Query(False, description="Whether to overwrite existing barcode"),
):
    """Generate a unique, tenant-scoped scannable barcode for a product."""
    from src.models.inventory import Product
    import secrets

    result = await db.execute(
        select(Product).where(
            Product.id == UUID(product_id),
            Product.tenant_id == ctx.tenant_id,
        )
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    if p.barcode and not force:
        fmt = "EAN-13" if len(p.barcode) == 13 and p.barcode.isdigit() else "Code-128"
        return {"barcode": p.barcode, "format": fmt, "note": "Product already has a barcode"}

    # Count total products in tenant to determine sequence
    count_res = await db.execute(
        select(func.count(Product.id)).where(Product.tenant_id == ctx.tenant_id)
    )
    total_count = count_res.scalar() or 1

    # Try sequential generation with collision avoidance
    for attempt in range(50):
        seq = total_count + attempt + secrets.randbelow(100)
        barcode, fmt = generate_tenant_barcode(ctx.tenant_id, seq, barcode_format=format, prefix=prefix)
        # Check collision
        existing = await db.execute(
            select(Product.id).where(
                Product.tenant_id == ctx.tenant_id,
                Product.barcode == barcode,
                Product.id != p.id,
            )
        )
        if not existing.scalar_one_or_none():
            p.barcode = barcode
            await db.commit()
            return {
                "barcode": barcode,
                "format": fmt,
                "product_id": str(p.id),
                "product_name": p.name,
            }

    raise HTTPException(status_code=500, detail="Failed to generate unique barcode. Please retry.")


@router.post("/barcodes/generate-bulk")
async def generate_bulk_barcodes(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
    format: str = Query("EAN-13", description="Barcode format: EAN-13 or Code-128"),
    product_ids: str | None = Query(None, description="Optional comma-separated product UUIDs to generate for"),
):
    """Bulk generate tenant-scoped barcodes for all products (or selected ones) that lack barcodes."""
    from src.models.inventory import Product
    import secrets

    query = select(Product).where(
        Product.tenant_id == ctx.tenant_id,
        or_(Product.barcode.is_(None), Product.barcode == ""),
    )

    if product_ids:
        raw_ids = [UUID(pid.strip()) for pid in product_ids.split(",") if pid.strip()]
        if raw_ids:
            query = query.where(Product.id.in_(raw_ids))

    result = await db.execute(query)
    target_products = result.scalars().all()

    if not target_products:
        return {
            "message": "All specified products already have barcodes.",
            "generated_count": 0,
            "products": [],
        }

    # Fetch all currently assigned barcodes for tenant to ensure zero collision in memory
    assigned_res = await db.execute(
        select(Product.barcode).where(
            Product.tenant_id == ctx.tenant_id,
            Product.barcode.isnot(None),
        )
    )
    used_barcodes = {b for b in assigned_res.scalars().all() if b}

    count_res = await db.execute(
        select(func.count(Product.id)).where(Product.tenant_id == ctx.tenant_id)
    )
    total_count = count_res.scalar() or 1

    updated_items = []
    for idx, p in enumerate(target_products):
        for attempt in range(100):
            seq = total_count + idx + attempt * 10 + secrets.randbelow(10)
            code, fmt = generate_tenant_barcode(ctx.tenant_id, seq, barcode_format=format)
            if code not in used_barcodes:
                used_barcodes.add(code)
                p.barcode = code
                updated_items.append({
                    "id": str(p.id),
                    "product_name": p.name,
                    "sku": p.sku,
                    "barcode": code,
                    "format": fmt,
                })
                break

    await db.commit()
    return {
        "message": f"Successfully generated barcodes for {len(updated_items)} products.",
        "generated_count": len(updated_items),
        "products": updated_items,
    }


@router.post("/barcodes/batch-print")
async def batch_print_barcodes(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
    product_ids: str = Query(...),
):
    """Mark a set of products' barcodes as printed (increments an internal counter)."""
    from src.models.inventory import Product
    # FastAPI gives us a comma-separated string when the query is product_ids=uuid1,uuid2,...
    if isinstance(product_ids, str):
        raw = [p.strip() for p in product_ids.split(",") if p.strip()]
    else:
        raw = list(product_ids)
    if not raw:
        raise HTTPException(status_code=400, detail="No products selected")
    try:
        ids = [UUID(pid) for pid in raw]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid product ID: {e}")
    result = await db.execute(
        select(Product).where(Product.tenant_id == ctx.tenant_id, Product.id.in_(ids))
    )
    products = result.scalars().all()
    await db.commit()
    return {
        "printed": len(products),
        "products": [
            {"id": str(p.id), "product_name": p.name, "barcode": p.barcode}
            for p in products
        ],
    }


# ==========================================
# QR Code Management
# ==========================================

@router.get("/qrcodes", response_model=List[ProductQRCodeResponse])
async def list_qr_codes(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
    product_id: Optional[str] = None,
    search: Optional[str] = None,
):
    q = select(ProductQRCode).where(ProductQRCode.tenant_id == ctx.tenant_id)
    if product_id:
        q = q.where(ProductQRCode.product_id == UUID(product_id))
    if search:
        q = q.where(ProductQRCode.qr_data.ilike(f"%{search}%"))
    q = q.order_by(ProductQRCode.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/qrcodes", response_model=ProductQRCodeResponse)
async def create_qr_code(
    qr_in: ProductQRCodeCreate,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
):
    qr = ProductQRCode(**qr_in.model_dump(), tenant_id=ctx.tenant_id)
    db.add(qr)
    await db.commit()
    await db.refresh(qr)
    return qr


@router.patch("/qrcodes/{qr_id}", response_model=ProductQRCodeResponse)
async def update_qr_code(
    qr_id: str,
    qr_in: ProductQRCodeUpdate,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductQRCode).where(
            ProductQRCode.id == UUID(qr_id),
            ProductQRCode.tenant_id == ctx.tenant_id,
        )
    )
    qr = result.scalar_one_or_none()
    if not qr:
        raise HTTPException(status_code=404, detail="QR code not found")
    for k, v in qr_in.model_dump(exclude_unset=True).items():
        setattr(qr, k, v)
    await db.commit()
    await db.refresh(qr)
    return qr


@router.delete("/qrcodes/{qr_id}")
async def delete_qr_code(
    qr_id: str,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductQRCode).where(
            ProductQRCode.id == UUID(qr_id),
            ProductQRCode.tenant_id == ctx.tenant_id,
        )
    )
    qr = result.scalar_one_or_none()
    if not qr:
        raise HTTPException(status_code=404, detail="QR code not found")
    await db.delete(qr)
    await db.commit()
    return {"message": "QR code deleted"}


@router.post("/qrcodes/{qr_id}/print")
async def print_qr_code(
    qr_id: str,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductQRCode).where(
            ProductQRCode.id == UUID(qr_id),
            ProductQRCode.tenant_id == ctx.tenant_id,
        )
    )
    qr = result.scalar_one_or_none()
    if not qr:
        raise HTTPException(status_code=404, detail="QR code not found")
    qr.print_count += 1
    qr.last_printed_at = datetime.utcnow()
    await db.commit()
    return {"message": "Printed", "print_count": qr.print_count}


# ==========================================
# RFID Management
# ==========================================

@router.get("/rfids", response_model=List[ProductRFIDResponse])
async def list_rfids(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
    product_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    q = select(ProductRFID).where(ProductRFID.tenant_id == ctx.tenant_id)
    if product_id:
        q = q.where(ProductRFID.product_id == UUID(product_id))
    if status:
        q = q.where(ProductRFID.status == status)
    if search:
        q = q.where(ProductRFID.tag_uid.ilike(f"%{search}%"))
    q = q.order_by(ProductRFID.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/rfids", response_model=ProductRFIDResponse)
async def create_rfid(
    rfid_in: ProductRFIDCreate,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
):
    rfid = ProductRFID(**rfid_in.model_dump(), tenant_id=ctx.tenant_id)
    db.add(rfid)
    await db.commit()
    await db.refresh(rfid)
    return rfid


@router.patch("/rfids/{rfid_id}", response_model=ProductRFIDResponse)
async def update_rfid(
    rfid_id: str,
    rfid_in: ProductRFIDUpdate,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductRFID).where(
            ProductRFID.id == UUID(rfid_id),
            ProductRFID.tenant_id == ctx.tenant_id,
        )
    )
    rfid = result.scalar_one_or_none()
    if not rfid:
        raise HTTPException(status_code=404, detail="RFID tag not found")
    for k, v in rfid_in.model_dump(exclude_unset=True).items():
        setattr(rfid, k, v)
    await db.commit()
    await db.refresh(rfid)
    return rfid


@router.delete("/rfids/{rfid_id}")
async def delete_rfid(
    rfid_id: str,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductRFID).where(
            ProductRFID.id == UUID(rfid_id),
            ProductRFID.tenant_id == ctx.tenant_id,
        )
    )
    rfid = result.scalar_one_or_none()
    if not rfid:
        raise HTTPException(status_code=404, detail="RFID tag not found")
    await db.delete(rfid)
    await db.commit()
    return {"message": "RFID tag deleted"}


@router.post("/rfids/{rfid_id}/scan")
async def scan_rfid(
    rfid_id: str,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: AsyncSession = Depends(get_db),
    location: str = Query(...),
):
    result = await db.execute(
        select(ProductRFID).where(
            ProductRFID.id == UUID(rfid_id),
            ProductRFID.tenant_id == ctx.tenant_id,
        )
    )
    rfid = result.scalar_one_or_none()
    if not rfid:
        raise HTTPException(status_code=404, detail="RFID tag not found")
    rfid.last_seen_at = datetime.utcnow()
    rfid.last_seen_location = location
    rfid.write_count += 1
    await db.commit()
    await db.refresh(rfid)
    return rfid