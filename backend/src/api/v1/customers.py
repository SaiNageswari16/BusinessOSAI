"""Customer endpoints — profiles, visit history, phone lookup.

Customers are the join point between the POS and loyalty/wallet. `total_visits`
and `total_spent` are maintained as bills settle so the customer list stays
fast without aggregating every bill.
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission, resolve_outlet_id
from src.database.session import get_db
from src.models import Bill, BillStatus, Customer, CustomerWallet
from src.schemas.customers import (
    CustomerCreate,
    CustomerHistory,
    CustomerHistoryRow,
    CustomerResponse,
    CustomerUpdate,
)
from src.services.kot_service import _status_value
from src.utils.phone import clean_phone

router = APIRouter(prefix="/customers", tags=["Customers"])


def _d(value) -> Decimal:
    return Decimal("0") if value is None else Decimal(str(value))


@router.get("", response_model=list[CustomerResponse])
@router.get("/", response_model=list[CustomerResponse])
async def list_customers(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    search: str | None = None,
    tag: str | None = None,
    birthday_today: bool = False,
    limit: int = 200,
    offset: int = 0,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(Customer).where(Customer.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(Customer.outlet_id == outlet_id)
    if search:
        stmt = stmt.where(
            Customer.name.ilike(f"%{search}%") | Customer.phone.ilike(f"%{search}%")
        )
    if tag:
        stmt = stmt.where(Customer.tags.contains([tag]))
    if birthday_today:
        # Matches month-day regardless of year
        today = datetime.now(timezone.utc).date()
        stmt = stmt.where(
            func.to_char(Customer.birthday, "MM-DD") == today.strftime("%m-%d")
        )

    stmt = stmt.order_by(Customer.name).limit(limit).offset(offset)
    return [
        CustomerResponse.model_validate(c)
        for c in (await db.execute(stmt)).scalars().all()
    ]


@router.get("/lookup", response_model=CustomerResponse | None)
async def lookup_by_phone(
    phone: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """The POS calls this as the cashier types a phone number."""
    cleaned = clean_phone(phone)
    if len(cleaned) < 5:
        return None

    customer = await db.scalar(
        select(Customer).where(
            Customer.tenant_id == ctx.tenant_id, Customer.phone == cleaned
        )
    )
    if customer is None:
        return None
    if customer.outlet_id:
        resolve_outlet_id(ctx, customer.outlet_id)
    return CustomerResponse.model_validate(customer)


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id, required=False)

    phone = clean_phone(payload.phone)
    if len(phone) < 5:
        raise HTTPException(status_code=422, detail="Enter a valid phone number")

    # One profile per phone number per tenant
    clash = await db.scalar(
        select(Customer.id).where(
            Customer.tenant_id == ctx.tenant_id, Customer.phone == phone
        )
    )
    if clash:
        raise HTTPException(
            status_code=409,
            detail=f"A customer with {phone} already exists — use lookup instead",
        )

    customer = Customer(
        tenant_id=ctx.tenant_id,
        **payload.model_dump(exclude={"phone"}),
        phone=phone,
    )
    db.add(customer)
    await db.flush()

    # Everyone gets a wallet so stored credit works from the first bill
    db.add(CustomerWallet(tenant_id=ctx.tenant_id, customer_id=customer.id, balance=0))

    await db.commit()
    await db.refresh(customer)
    return CustomerResponse.model_validate(customer)


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    customer = await db.scalar(
        select(Customer).where(
            Customer.id == customer_id, Customer.tenant_id == ctx.tenant_id
        )
    )
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.outlet_id:
        resolve_outlet_id(ctx, customer.outlet_id)
    return CustomerResponse.model_validate(customer)


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: uuid.UUID,
    payload: CustomerUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    customer = await db.scalar(
        select(Customer).where(
            Customer.id == customer_id, Customer.tenant_id == ctx.tenant_id
        )
    )
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.outlet_id:
        resolve_outlet_id(ctx, customer.outlet_id)

    data = payload.model_dump(exclude_unset=True)
    if "phone" in data:
        phone = clean_phone(data.pop("phone"))
        if phone != customer.phone:
            clash = await db.scalar(
                select(Customer.id).where(
                    Customer.tenant_id == ctx.tenant_id,
                    Customer.phone == phone,
                    Customer.id != customer.id,
                )
            )
            if clash:
                raise HTTPException(
                    status_code=409, detail=f"{phone} belongs to another customer"
                )
        customer.phone = phone

    for field, value in data.items():
        setattr(customer, field, value)

    await db.commit()
    await db.refresh(customer)
    return CustomerResponse.model_validate(customer)


@router.get("/{customer_id}/history", response_model=CustomerHistory)
async def get_customer_history(
    customer_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
):
    """The 360° view: profile plus every bill, with the headline metrics."""
    customer = await db.scalar(
        select(Customer).where(
            Customer.id == customer_id, Customer.tenant_id == ctx.tenant_id
        )
    )
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.outlet_id:
        resolve_outlet_id(ctx, customer.outlet_id)

    bills = (
        await db.execute(
            select(Bill)
            .where(
                Bill.tenant_id == ctx.tenant_id,
                Bill.customer_id == customer.id,
                _status_value(Bill.status) != BillStatus.VOID.value,
            )
            .order_by(Bill.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()

    rows = [
        CustomerHistoryRow(
            bill_id=bill.id,
            bill_number=bill.bill_number,
            created_at=bill.created_at,
            grand_total=float(_d(bill.grand_total)),
            status=_status_value(bill.status),
            covers=int(bill.covers or 0),
        )
        for bill in bills
    ]

    # Headline metrics come from all settled bills, not just the returned page
    settled = (
        await db.execute(
            select(Bill).where(
                Bill.tenant_id == ctx.tenant_id,
                Bill.customer_id == customer.id,
                Bill.status == BillStatus.SETTLED,
            )
        )
    ).scalars().all()

    total_spent = sum((_d(b.grand_total) for b in settled), Decimal("0"))
    total_bills = len(settled)
    last_visit = (
        datetime.fromisoformat(settled[0].settled_at.replace("Z", "+00:00"))
        if settled and settled[0].settled_at
        else None
    )

    return CustomerHistory(
        customer=CustomerResponse.model_validate(customer),
        bills=rows,
        total_bills=total_bills,
        total_spent=float(total_spent),
        avg_ticket=float(total_spent / total_bills) if total_bills else 0,
        last_visit=last_visit,
    )


@router.post("/{customer_id}/tags", response_model=CustomerResponse)
async def add_tags(
    customer_id: uuid.UUID,
    tags: list[str],
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Append tags (VIP, allergic, corporate) without dropping existing ones."""
    customer = await db.scalar(
        select(Customer).where(
            Customer.id == customer_id, Customer.tenant_id == ctx.tenant_id
        )
    )
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.outlet_id:
        resolve_outlet_id(ctx, customer.outlet_id)

    existing = list(customer.tags or [])
    for tag in tags:
        cleaned = tag.strip().lower()
        if cleaned and cleaned not in existing:
            existing.append(cleaned)
    customer.tags = existing

    # flag_modified so the JSONB column is written back
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(customer, "tags")

    await db.commit()
    await db.refresh(customer)
    return CustomerResponse.model_validate(customer)


@router.delete("/{customer_id}/tags", response_model=CustomerResponse)
async def remove_tags(
    customer_id: uuid.UUID,
    tags: list[str],
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    customer = await db.scalar(
        select(Customer).where(
            Customer.id == customer_id, Customer.tenant_id == ctx.tenant_id
        )
    )
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.outlet_id:
        resolve_outlet_id(ctx, customer.outlet_id)

    to_remove = {t.strip().lower() for t in tags}
    customer.tags = [t for t in (customer.tags or []) if t not in to_remove]

    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(customer, "tags")

    await db.commit()
    await db.refresh(customer)
    return CustomerResponse.model_validate(customer)


@router.get("/birthdays/upcoming", response_model=list[CustomerResponse])
async def upcoming_birthdays(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = 7,
):
    """Marketing feed: birthdays and anniversaries in the next N days."""
    today = datetime.now(timezone.utc).date()

    customers = (
        await db.execute(
            select(Customer).where(
                Customer.tenant_id == ctx.tenant_id,
                Customer.birthday.is_not(None) | Customer.anniversary.is_not(None),
            )
        )
    ).scalars().all()

    matches = []
    for customer in customers:
        for field in (customer.birthday, customer.anniversary):
            if field is None:
                continue
            # This year's occurrence, rolling into next year if it has passed
            occurrence = field.replace(year=today.year)
            if occurrence < today:
                occurrence = occurrence.replace(year=today.year + 1)
            if 0 <= (occurrence - today).days <= days:
                matches.append(customer)
                break

    return [CustomerResponse.model_validate(c) for c in matches]
