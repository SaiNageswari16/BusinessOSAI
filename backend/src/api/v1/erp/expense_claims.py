"""Expense Claims — CRUD, approve, reject endpoints."""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models.erp import ExpenseClaim
from src.schemas.erp_accounting import ExpenseClaimCreate, ExpenseClaimResponse, ExpenseClaimUpdate
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter(prefix="/expense-claims", tags=["Expense Claims"])


@router.get("", response_model=PaginatedResponse[ExpenseClaimResponse])
async def list_expense_claims(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = None,
):
    query = select(ExpenseClaim).where(ExpenseClaim.tenant_id == ctx.tenant_id).options(selectinload(ExpenseClaim.lines))
    if status_filter:
        query = query.where(ExpenseClaim.status == status_filter)
    if search:
        query = query.where(ExpenseClaim.description.ilike(f"%{search}%"))
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
    return paginate(result.scalars().unique().all(), total or 0, page, page_size)


@router.get("/summary", response_model=dict)
async def get_expense_claims_summary(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    claims = (await db.execute(
        select(ExpenseClaim).where(ExpenseClaim.tenant_id == ctx.tenant_id).options(selectinload(ExpenseClaim.lines))
    )).scalars().unique().all()

    total_amount = sum(float(c.total_amount or 0) for c in claims)
    pending_claims = [c for c in claims if str(c.status).lower() in ("pending", "draft", "submitted")]
    approved_claims = [c for c in claims if str(c.status).lower() == "approved"]
    paid_claims = [c for c in claims if str(c.status).lower() == "paid"]
    rejected_claims = [c for c in claims if str(c.status).lower() == "rejected"]

    pending_amount = sum(float(c.total_amount or 0) for c in pending_claims)
    approved_amount = sum(float(c.total_amount or 0) for c in approved_claims)
    paid_amount = sum(float(c.total_amount or 0) for c in paid_claims)

    travel_amount = sum(
        sum(float(l.amount or 0) for l in c.lines if "travel" in (l.category or "").lower())
        for c in claims
    )
    office_amount = sum(
        sum(float(l.amount or 0) for l in c.lines if any(k in (l.category or "").lower() for k in ("office", "software", "tech", "supplies", "meals")))
        for c in claims
    )
    opex_amount = sum(
        sum(float(l.amount or 0) for l in c.lines if any(k in (l.category or "").lower() for k in ("rent", "utilities", "insurance", "maintenance", "operations", "opex")))
        for c in claims
    )

    return {
        "total_claims_count": len(claims),
        "total_amount": total_amount,
        "pending_count": len(pending_claims),
        "pending_amount": pending_amount,
        "approved_count": len(approved_claims),
        "approved_amount": approved_amount,
        "paid_count": len(paid_claims),
        "paid_amount": paid_amount,
        "rejected_count": len(rejected_claims),
        "travel_amount": travel_amount,
        "office_amount": office_amount,
        "opex_amount": opex_amount,
    }


@router.get("/{claim_id}", response_model=ExpenseClaimResponse)
async def get_expense_claim(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    claim_id: str,
):
    obj = await db.scalar(
        select(ExpenseClaim).where(ExpenseClaim.id == claim_id, ExpenseClaim.tenant_id == ctx.tenant_id).options(selectinload(ExpenseClaim.lines))
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    return obj


import os
import uuid
import base64
import aiofiles
from fastapi import File, UploadFile
from sqlalchemy import text

UPLOAD_DIR = os.path.join(os.getcwd(), "static", "uploads", "expense_receipts")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _save_base64_image_if_needed(val: str | None) -> str | None:
    """If val is a base64 data URI, decode and save to file to prevent db truncation and bloated payloads."""
    if not val or not isinstance(val, str):
        return val
    if val.startswith("data:image/") or val.startswith("data:application/pdf"):
        try:
            header, encoded = val.split(",", 1)
            ext = ".jpg"
            if "png" in header:
                ext = ".png"
            elif "pdf" in header:
                ext = ".pdf"
            elif "webp" in header:
                ext = ".webp"
            elif "gif" in header:
                ext = ".gif"
            filename = f"receipt_{uuid.uuid4().hex[:12]}_{int(date.today().strftime('%Y%m%d'))}{ext}"
            file_path = os.path.join(UPLOAD_DIR, filename)
            with open(file_path, "wb") as f:
                f.write(base64.b64decode(encoded))
            return f"/static/uploads/expense_receipts/{filename}"
        except Exception:
            return val
    return val


@router.post("/upload-receipt", response_model=dict)
async def upload_expense_receipt(
    file: UploadFile = File(...),
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:expense_claims"))] = None,
):
    """Upload photo proof / receipt file for expense claim."""
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".gif"]:
        ext = ".jpg"
    filename = f"receipt_{uuid.uuid4().hex[:12]}_{int(date.today().strftime('%Y%m%d'))}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    async with aiofiles.open(file_path, "wb") as out_file:
        content = await file.read()
        await out_file.write(content)
    file_url = f"/static/uploads/expense_receipts/{filename}"
    return {"url": file_url, "filename": filename}


@router.post("", response_model=ExpenseClaimResponse, status_code=status.HTTP_201_CREATED)
async def create_expense_claim(
    payload: ExpenseClaimCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Ensure column allows TEXT
    try:
        await db.execute(text("ALTER TABLE expense_claim_lines ALTER COLUMN receipt_url TYPE TEXT;"))
        await db.execute(text("ALTER TABLE expense_claims ADD COLUMN IF NOT EXISTS receipt_photo TEXT;"))
        await db.execute(text("ALTER TABLE expense_claims ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'Online UPI';"))
        await db.execute(text("ALTER TABLE expense_claim_lines ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'Online UPI';"))
    except Exception:
        pass

    data = payload.model_dump()
    lines_data = data.pop("lines", [])

    if not data.get("claim_number"):
        count = await db.scalar(
            select(func.count()).select_from(ExpenseClaim).where(ExpenseClaim.tenant_id == ctx.tenant_id)
        )
        seq = (count or 0) + 1
        data["claim_number"] = f"EXP-{date.today().year}-{seq:04d}"

    if not data.get("status"):
        data["status"] = "pending"

    # Save base64 photo if present
    if data.get("receipt_photo"):
        data["receipt_photo"] = _save_base64_image_if_needed(data["receipt_photo"])

    total_amount = sum(float(l.get("amount", 0)) for l in lines_data)
    data["total_amount"] = total_amount

    obj = ExpenseClaim(tenant_id=ctx.tenant_id, **data)
    db.add(obj)
    await db.flush()
    for line in lines_data:
        from src.models.erp import ExpenseClaimLine
        if line.get("receipt_url"):
            line["receipt_url"] = _save_base64_image_if_needed(line["receipt_url"])
        db.add(ExpenseClaimLine(claim_id=obj.id, **line))
    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="expense_claims",
        action="created",
        entity_type="expense_claim",
        entity_id=obj.id,
        new_values={"total_amount": str(obj.total_amount)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    obj = await db.scalar(
        select(ExpenseClaim).where(ExpenseClaim.id == obj.id, ExpenseClaim.tenant_id == ctx.tenant_id).options(selectinload(ExpenseClaim.lines))
    )
    return obj


@router.patch("/{claim_id}", response_model=ExpenseClaimResponse)
async def update_expense_claim(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    claim_id: str,
    payload: ExpenseClaimUpdate,
    request: Request,
):
    obj = await db.scalar(
        select(ExpenseClaim).where(ExpenseClaim.id == claim_id, ExpenseClaim.tenant_id == ctx.tenant_id).options(selectinload(ExpenseClaim.lines))
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    old = {k: getattr(obj, k) for k in ("status", "description", "rejection_reason")}
    update_data = payload.model_dump(exclude_unset=True)
    if update_data.get("receipt_photo"):
        update_data["receipt_photo"] = _save_base64_image_if_needed(update_data["receipt_photo"])
    lines_data = update_data.pop("lines", None)
    for k, v in update_data.items():
        setattr(obj, k, v)
    if lines_data is not None:
        from src.models.erp import ExpenseClaimLine
        obj.lines.clear()
        for line in lines_data:
            if line.get("receipt_url"):
                line["receipt_url"] = _save_base64_image_if_needed(line["receipt_url"])
            obj.lines.append(ExpenseClaimLine(claim_id=obj.id, **line))
        obj.total_amount = sum(float(l.get("amount", 0)) for l in lines_data)
    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="expense_claims",
        action="updated",
        entity_type="expense_claim",
        entity_id=obj.id,
        old_values=old,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(obj)
    return obj


@router.post("/{claim_id}/approve", response_model=dict)
async def approve_expense_claim(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("approve:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    claim_id: str,
    request: Request,
    note: str | None = None,
):
    obj = await db.scalar(select(ExpenseClaim).where(ExpenseClaim.id == claim_id, ExpenseClaim.tenant_id == ctx.tenant_id))
    if not obj:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    obj.status = "approved"
    obj.approved_by_user_id = ctx.user.id
    from datetime import datetime
    obj.approved_at = datetime.now()
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="expense_claims", action="approved", entity_type="expense_claim", entity_id=obj.id, ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    await db.commit()
    return {"message": "Expense claim approved"}


@router.post("/{claim_id}/reject", response_model=dict)
async def reject_expense_claim(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("approve:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    claim_id: str,
    request: Request,
    reason: str = "",
):
    obj = await db.scalar(select(ExpenseClaim).where(ExpenseClaim.id == claim_id, ExpenseClaim.tenant_id == ctx.tenant_id))
    if not obj:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    obj.status = "rejected"
    obj.rejection_reason = reason
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="expense_claims", action="rejected", entity_type="expense_claim", entity_id=obj.id, ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    await db.commit()
    return {"message": "Expense claim rejected"}


@router.post("/{claim_id}/pay", response_model=dict)
async def pay_expense_claim(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    claim_id: str,
    request: Request,
):
    obj = await db.scalar(select(ExpenseClaim).where(ExpenseClaim.id == claim_id, ExpenseClaim.tenant_id == ctx.tenant_id))
    if not obj:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    obj.status = "paid"
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="expense_claims", action="paid", entity_type="expense_claim", entity_id=obj.id, ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    await db.commit()
    return {"message": "Expense claim marked as paid"}


@router.post("/batch-approve", response_model=dict)
async def batch_approve_expense_claims(
    payload: dict,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("approve:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
):
    ids = payload.get("ids", [])
    if not ids:
        return {"message": "No claims specified", "count": 0}
    from datetime import datetime
    now = datetime.now()
    count = 0
    for cid in ids:
        obj = await db.scalar(select(ExpenseClaim).where(ExpenseClaim.id == cid, ExpenseClaim.tenant_id == ctx.tenant_id))
        if obj and str(obj.status).lower() in ("pending", "draft", "submitted"):
            obj.status = "approved"
            obj.approved_by_user_id = ctx.user.id
            obj.approved_at = now
            count += 1
    await db.commit()
    return {"message": f"Successfully approved {count} claims", "count": count}


@router.delete("/{claim_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense_claim(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:expense_claims"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    claim_id: str,
    request: Request,
):
    obj = await db.scalar(select(ExpenseClaim).where(ExpenseClaim.id == claim_id, ExpenseClaim.tenant_id == ctx.tenant_id))
    if not obj:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    await db.delete(obj)
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="expense_claims", action="deleted", entity_type="expense_claim", entity_id=claim_id, ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    await db.commit()
