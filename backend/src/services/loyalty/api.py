"""Loyalty service endpoints.

Who may call what:
  * ``/programs``, ``/accounts`` read — ``view:loyalty``
  * enrol / redeem / adjust — ``manage:loyalty``

Events:
  subscribes bill.paid  (earn points when a bill is settled)
             customer.created  (enrol new customers automatically)
  publishes  loyalty.points.earned, loyalty.points.redeemed

This consumes the ``bill.paid`` event the billing service publishes, so the
billing → loyalty link is end to end: billing settles, loyalty earns.
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status as http_status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.event_bus.bus import Event, bus
from src.services.loyalty import service as svc
from src.services.loyalty.models import (
    CustomerLoyaltyAccount,
    CustomerWallet,
    LoyaltyProgram,
)
from src.services.loyalty.schemas import (
    AccountEnroll,
    AccountResponse,
    AdjustRequest,
    LoyaltyProgramCreate,
    LoyaltyProgramResponse,
    LoyaltyProgramUpdate,
    LoyaltyTxnResponse,
    RedeemRequest,
    WalletCredit,
    WalletCreate,
    WalletResponse,
    WalletTxnResponse,
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
    from src.services.loyalty.main import db as _db

    return _db.session_factory()


def _ev(topic, tenant_id=None, outlet_id=None, data=None):
    return Event(type=topic, tenant_id=tenant_id, outlet_id=outlet_id,
                 data=data or {}, source_service="loyalty")


# ─── Consumers ────────────────────────────────────────────────────────────────

@bus.on("bill.paid")
async def _on_bill_paid(event: Event) -> None:
    """Earn points for a settled bill.

    Points come from ``grand_total``, converted at the program's rate. The
    earn is keyed on ``bill_id`` for idempotency: bus delivery is at-least-once,
    so a redelivered event must not credit the same bill twice. The check is
    against the ledger, which is why bill_id is stored on every transaction —
    a redelivered bill.paid finds its own ledger row and returns early.

    Do not call ``bus.mark_seen`` here; the consumer loop already gates by
    event_id.
    """
    data = event.data or {}
    tenant = _tenant(event)
    if tenant is None or not data.get("bill_id"):
        return
    bill_id = _coerce_uuid(data.get("bill_id"))
    if bill_id is None:
        return

    db = _handler_db()
    try:
        # Idempotency: one earn per bill. A redelivered event finds its own
        # ledger row and returns early. The ledger holds bill_id on every
        # transaction, which is what makes this check possible.
        from src.services.loyalty.models import LoyaltyTransaction
        credited = await db.scalar(
            select(LoyaltyTransaction.id).where(
                LoyaltyTransaction.tenant_id == tenant,
                LoyaltyTransaction.bill_id == bill_id,
            )
        )
        if credited:
            return

        grand_total = float(data.get("grand_total") or 0)
        if grand_total <= 0:
            return

        # Which customer? The bill payload carries customer_id.
        customer_id = _coerce_uuid(data.get("customer_id"))
        if customer_id is None:
            return

        accounts = (
            await db.execute(
                select(CustomerLoyaltyAccount).where(
                    CustomerLoyaltyAccount.tenant_id == tenant,
                    CustomerLoyaltyAccount.customer_id == customer_id,
                )
            )
        ).scalars().all()

        created = []
        for account in accounts:
            program = await svc.load_program(db, tenant, account.program_id)
            if program is None or not program.is_active:
                continue
            rate = float(program.points_per_currency) or 0
            if rate <= 0:
                continue
            points = int(grand_total * rate)
            if points <= 0:
                continue
            txn = await svc.earn_points(
                db, tenant, account, points,
                bill_id=bill_id, value_amount=grand_total,
                description=f"bill {data.get('bill_number') or bill_id}",
            )
            created.append(txn)

        await db.commit()
        for txn in created:
            await bus.publish(_ev(
                "loyalty.points.earned", tenant,
                data={
                    "account_id": str(txn.account_id),
                    "points": txn.points,
                    "bill_id": str(bill_id),
                },
            ))
    except Exception:
        await db.rollback()
        raise
    finally:
        await db.close()


@bus.on("customer.created")
async def _on_customer_created(event: Event) -> None:
    """Auto-enrol new customers into the tenant's single active program.

    Only when there is exactly one active program — enrolling into the wrong
    one of several is worse than not enrolling at all.
    """
    data = event.data or {}
    tenant = _tenant(event)
    if tenant is None or not data.get("customer_id"):
        return
    customer_id = _coerce_uuid(data.get("customer_id"))
    if customer_id is None:
        return
    db = _handler_db()
    try:
        await svc.enroll_customer(db, tenant, customer_id)
        await db.commit()
    except svc.LoyaltyError:
        # Ambiguous or no program: leave the customer unenrolled. Not an error
        # worth surfacing — enrolment can be triggered manually later.
        await db.rollback()
    except Exception:
        await db.rollback()
        raise
    finally:
        await db.close()


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

    The bus serialises tenant_id as a STRING (see ``Event.to_json``). Dispatched
    within one process a consumer receives the original UUID, but across
    processes it round-trips through Redis and ``Event.from_json`` yields a
    bare str. Comparing a str against a UUID column yields zero rows rather
    than an error — the event is consumed, acked, and silently dropped.
    Everything downstream expects a UUID, so tolerate the string form.
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


# ─── Programs ────────────────────────────────────────────────────────────────

@router.get("/programs", response_model=list[LoyaltyProgramResponse], tags=["loyalty"])
async def list_programs(identity: CurrentIdentity, db: DbDep):
    identity.require("view:loyalty")
    programs = list((await db.execute(
        select(LoyaltyProgram).where(LoyaltyProgram.tenant_id == identity.tenant_id)
    )).scalars().all())
    # One grouped query for counts; counting per program would be an N+1.
    counts = await svc.program_account_counts(
        db, identity.tenant_id, [p.id for p in programs]
    )
    return [
        LoyaltyProgramResponse.model_validate(p).model_copy(
            update={"account_count": counts.get(p.id, 0)}
        )
        for p in programs
    ]


@router.post("/programs", response_model=LoyaltyProgramResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["loyalty"])
async def create_program(payload: LoyaltyProgramCreate,
                         identity: CurrentIdentity, db: DbDep):
    identity.require("manage:loyalty")
    data = payload.model_dump()
    for extra in ("points_per_unit_spend", "redemption_value_per_point"):
        data.pop(extra, None)
    program = LoyaltyProgram(tenant_id=identity.tenant_id, **data)
    db.add(program)
    await db.flush()
    resp = LoyaltyProgramResponse.model_validate(program)
    return resp.model_copy(update={"account_count": 0})


@router.patch("/programs/{program_id}", response_model=LoyaltyProgramResponse,
              tags=["loyalty"])
async def update_program(program_id: uuid.UUID, payload: LoyaltyProgramUpdate,
                         identity: CurrentIdentity, db: DbDep):
    identity.require("manage:loyalty")
    program = await svc.load_program(db, identity.tenant_id, program_id)
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(program, field, value)
    await db.flush()
    resp = LoyaltyProgramResponse.model_validate(program)
    return resp.model_copy(update={
        "account_count": await svc.program_account_count(db, identity.tenant_id, program_id)
    })


# ─── Accounts ────────────────────────────────────────────────────────────────

@router.get("/accounts", response_model=list[AccountResponse], tags=["loyalty"])
async def list_accounts(identity: CurrentIdentity, db: DbDep,
                        customer_id: uuid.UUID | None = None,
                        limit: int = Query(default=100, le=500)):
    identity.require("view:loyalty")
    stmt = select(CustomerLoyaltyAccount).where(
        CustomerLoyaltyAccount.tenant_id == identity.tenant_id)
    if customer_id:
        stmt = stmt.where(CustomerLoyaltyAccount.customer_id == customer_id)
    stmt = stmt.order_by(CustomerLoyaltyAccount.points_balance.desc()).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/accounts/enrol", response_model=AccountResponse, tags=["loyalty"],
             status_code=http_status.HTTP_201_CREATED)
@router.post("/accounts", response_model=AccountResponse, tags=["loyalty"],
             status_code=http_status.HTTP_201_CREATED)
async def enroll(payload: AccountEnroll, identity: CurrentIdentity, db: DbDep):
    """Enrol a customer. Returns the account that now exists.

    ``enroll_customer`` returns the created-or-existing account directly, so
    there is no second lookup to get wrong — re-querying by customer alone
    would raise if the customer was already in more than one program.
    """
    identity.require("manage:loyalty")
    try:
        account = await svc.enroll_customer(
            db, identity.tenant_id, payload.customer_id,
            payload.program_id, payload.tier,
        )
    except svc.LoyaltyError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return await svc.load_account(db, identity.tenant_id, account.id)


@router.get("/accounts/{account_id}", response_model=AccountResponse, tags=["loyalty"])
async def get_account(account_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:loyalty")
    account = await svc.load_account(db, identity.tenant_id, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    # Return the account with its most recent ledger rows only. The model
    # relation loads all, so clip in the API rather than a second query.
    recent = sorted(account.transactions or [],
                    key=lambda t: t.created_at, reverse=True)[:10]
    account.recent_transactions = recent
    return account


@router.post("/accounts/{account_id}/redeem", response_model=LoyaltyTxnResponse,
             tags=["loyalty"])
async def redeem(account_id: uuid.UUID, payload: RedeemRequest,
                 identity: CurrentIdentity, db: DbDep):
    identity.require("manage:loyalty")
    account = await svc.load_account(db, identity.tenant_id, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    try:
        txn = await svc.redeem_points(
            db, identity.tenant_id, account, payload.points,
            bill_id=payload.bill_id, description=payload.description,
        )
    except svc.LoyaltyError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    await bus.publish(_ev(
        "loyalty.points.redeemed", identity.tenant_id,
        data={"account_id": str(account.id), "points": -txn.points,
              "bill_id": str(payload.bill_id) if payload.bill_id else None},
    ))
    return txn


@router.post("/accounts/{account_id}/adjust", response_model=LoyaltyTxnResponse,
             tags=["loyalty"])
async def adjust(account_id: uuid.UUID, payload: AdjustRequest,
                 identity: CurrentIdentity, db: DbDep):
    identity.require("manage:loyalty")
    account = await svc.load_account(db, identity.tenant_id, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    try:
        txn = await svc.adjust_points(db, identity.tenant_id, account,
                                      payload.points, payload.reason)
    except svc.LoyaltyError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return txn


@router.get("/accounts/{account_id}/transactions",
            response_model=list[LoyaltyTxnResponse], tags=["loyalty"])
async def list_account_txns(account_id: uuid.UUID, identity: CurrentIdentity,
                            db: DbDep,
                            limit: int = Query(default=50, le=500)):
    identity.require("view:loyalty")
    account = await svc.load_account(db, identity.tenant_id, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    txns = sorted(account.transactions or [],
                  key=lambda t: t.created_at, reverse=True)[:limit]
    return txns


@router.post("/accounts/{account_id}/recompute", response_model=dict, tags=["loyalty"])
async def recompute(account_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    """Repair a drifted balance from the ledger."""
    identity.require("manage:loyalty")
    account = await svc.load_account(db, identity.tenant_id, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    corrected = await svc.recompute_balance(db, identity.tenant_id, account)
    return {"points_balance": corrected}


@router.get("/accounts/{account_id}/reconcile", response_model=dict, tags=["loyalty"])
async def reconcile(account_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    """Check whether the cached balance matches the ledger."""
    identity.require("view:loyalty")
    account = await svc.load_account(db, identity.tenant_id, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    ok, ledger_total = await svc.ledger_reconciles(db, identity.tenant_id, account)
    return {"reconciles": ok, "balance": account.points_balance,
            "ledger_total": ledger_total}


# ─── Wallet ──────────────────────────────────────────────────────────────────

@router.get("/wallets", response_model=list[WalletResponse], tags=["wallet"])
async def list_wallets(identity: CurrentIdentity, db: DbDep):
    identity.require("view:loyalty")
    stmt = select(CustomerWallet).where(CustomerWallet.tenant_id == identity.tenant_id)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/wallets", response_model=WalletResponse,
             status_code=http_status.HTTP_201_CREATED, tags=["wallet"])
async def create_wallet(payload: WalletCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:loyalty")
    wallet = await svc.wallet_for_customer(db, identity.tenant_id, payload.customer_id)
    if payload.balance and not wallet.balance:
        wallet.balance = payload.balance
    return wallet


@router.post("/wallets/{wallet_id}/credit", response_model=WalletTxnResponse,
             tags=["wallet"])
async def credit_wallet(wallet_id: uuid.UUID, payload: WalletCredit,
                        identity: CurrentIdentity, db: DbDep):
    identity.require("manage:loyalty")
    wallet = await svc.load_wallet(db, identity.tenant_id, wallet_id)
    if wallet is None:
        raise HTTPException(status_code=404, detail="Wallet not found")
    try:
        txn = await svc.credit_wallet(db, identity.tenant_id, wallet, payload.amount,
                                      description=payload.description)
    except svc.LoyaltyError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return txn


@router.get("/wallets/{wallet_id}/transactions",
            response_model=list[WalletTxnResponse], tags=["wallet"])
async def list_wallet_txns(wallet_id: uuid.UUID, identity: CurrentIdentity,
                           db: DbDep,
                           limit: int = Query(default=50, le=500)):
    identity.require("view:loyalty")
    wallet = await svc.load_wallet(db, identity.tenant_id, wallet_id)
    if wallet is None:
        raise HTTPException(status_code=404, detail="Wallet not found")
    txns = sorted(wallet.transactions or [],
                  key=lambda t: t.created_at, reverse=True)[:limit]
    return txns
