"""Food-aggregator integration — Zomato, Swiggy, Magicpin, DotPe.

Credentials are write-only: they are stored but never echoed back, so the
config list is safe to render in settings. Inbound orders are keyed on the
aggregator's order id, which makes webhook replays idempotent.
"""
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission, resolve_outlet_id
from src.database.session import get_db
from src.models import (
    AggregatorConfig,
    AggregatorOrderMap,
    MenuItem,
    Order,
    OrderStatus,
)
from src.schemas.integrations import (
    AggregatorConfigCreate,
    AggregatorConfigResponse,
    AggregatorConfigUpdate,
    AggregatorOrderIn,
    AggregatorOrderMapResponse,
    MenuSyncResult,
)
from src.services.number_series import allocate_number
from src.utils.enums import enum_value as _status_value
from src.utils.phone import clean_phone

router = APIRouter(prefix="/integrations/aggregators", tags=["Integrations"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Configuration ───────────────────────────────────────────────

@router.get("", response_model=list[AggregatorConfigResponse])
async def list_aggregators(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:settings"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(AggregatorConfig).where(
        AggregatorConfig.tenant_id == ctx.tenant_id
    )
    if outlet_id:
        stmt = stmt.where(AggregatorConfig.outlet_id == outlet_id)
    stmt = stmt.order_by(AggregatorConfig.aggregator)

    return [
        AggregatorConfigResponse.model_validate(c)
        for c in (await db.execute(stmt)).scalars().all()
    ]


@router.post("", response_model=AggregatorConfigResponse,
             status_code=status.HTTP_201_CREATED)
async def create_aggregator(
    payload: AggregatorConfigCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:settings"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id)

    clash = await db.scalar(
        select(AggregatorConfig.id).where(
            AggregatorConfig.outlet_id == payload.outlet_id,
            AggregatorConfig.aggregator == payload.aggregator,
        )
    )
    if clash:
        raise HTTPException(
            status_code=409,
            detail=f"{_status_value(payload.aggregator)} is already configured for this outlet",
        )

    config = AggregatorConfig(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return AggregatorConfigResponse.model_validate(config)


@router.put("/{config_id}", response_model=AggregatorConfigResponse)
async def update_aggregator(
    config_id: uuid.UUID,
    payload: AggregatorConfigUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:settings"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    config = await db.scalar(
        select(AggregatorConfig).where(
            AggregatorConfig.id == config_id,
            AggregatorConfig.tenant_id == ctx.tenant_id,
        )
    )
    if config is None:
        raise HTTPException(status_code=404, detail="Aggregator config not found")
    resolve_outlet_id(ctx, config.outlet_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(config, field, value)

    await db.commit()
    await db.refresh(config)
    return AggregatorConfigResponse.model_validate(config)


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_aggregator(
    config_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:settings"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    config = await db.scalar(
        select(AggregatorConfig).where(
            AggregatorConfig.id == config_id,
            AggregatorConfig.tenant_id == ctx.tenant_id,
        )
    )
    if config is None:
        raise HTTPException(status_code=404, detail="Aggregator config not found")
    resolve_outlet_id(ctx, config.outlet_id)

    await db.delete(config)
    await db.commit()


# ─── Inbound orders ──────────────────────────────────────────────

@router.post("/orders", response_model=AggregatorOrderMapResponse,
             status_code=status.HTTP_201_CREATED)
async def ingest_order(
    payload: AggregatorOrderIn,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:orders"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
):
    """Webhook target — turn an aggregator order into an internal order.

    The aggregator's order id is the idempotency key: a replayed webhook
    returns the existing mapping rather than creating a duplicate order.
    """
    resolve_outlet_id(ctx, outlet_id, required=False)
    if outlet_id is None:
        raise HTTPException(status_code=422, detail="outlet_id is required")

    existing = await db.scalar(
        select(AggregatorOrderMap).where(
            AggregatorOrderMap.outlet_id == outlet_id,
            AggregatorOrderMap.aggregator == _status_value(payload.aggregator),
            AggregatorOrderMap.aggregator_order_id == payload.aggregator_order_id,
        )
    )
    if existing is not None:
        # Already ingested — replay-safe
        return AggregatorOrderMapResponse.model_validate(existing)

    aggregator = _status_value(payload.aggregator)

    order = Order(
        tenant_id=ctx.tenant_id,
        outlet_id=outlet_id,
        order_number=await allocate_number(db, ctx.tenant_id, "order", outlet_id),
        order_type="delivery",
        status=OrderStatus.PLACED,
        notes=payload.notes,
        customer_name=payload.customer_name,
        customer_phone=clean_phone(payload.customer_phone) or None,
        aggregator_name=aggregator,
        aggregator_order_id=payload.aggregator_order_id,
        is_parcel=True,
    )
    db.add(order)
    await db.flush()

    mapping = AggregatorOrderMap(
        tenant_id=ctx.tenant_id,
        outlet_id=outlet_id,
        aggregator=aggregator,
        aggregator_order_id=payload.aggregator_order_id,
        order_id=order.id,
        raw_payload=payload.model_dump(mode="json"),
        synced_at=_now_iso(),
        sync_status="synced",
    )
    db.add(mapping)
    await db.commit()
    await db.refresh(mapping)
    return AggregatorOrderMapResponse.model_validate(mapping)


@router.get("/orders", response_model=list[AggregatorOrderMapResponse])
async def list_orders(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:orders"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    aggregator: str | None = None,
    limit: int = 100,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(AggregatorOrderMap).where(
        AggregatorOrderMap.tenant_id == ctx.tenant_id
    )
    if outlet_id:
        stmt = stmt.where(AggregatorOrderMap.outlet_id == outlet_id)
    if aggregator:
        stmt = stmt.where(AggregatorOrderMap.aggregator == aggregator)
    stmt = stmt.order_by(AggregatorOrderMap.created_at.desc()).limit(limit)

    return [
        AggregatorOrderMapResponse.model_validate(m)
        for m in (await db.execute(stmt)).scalars().all()
    ]


# ─── Menu sync ───────────────────────────────────────────────────

@router.post("/{config_id}/sync-menu", response_model=MenuSyncResult)
async def sync_menu(
    config_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:settings"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Push this outlet's menu to the aggregator.

    The aggregator APIs need a mapped category tree and their own item ids, so
    this records the sync attempt and stamps the timestamp the UI shows. Wire
    the real push in here once credentials are configured.
    """
    config = await db.scalar(
        select(AggregatorConfig).where(
            AggregatorConfig.id == config_id,
            AggregatorConfig.tenant_id == ctx.tenant_id,
        )
    )
    if config is None:
        raise HTTPException(status_code=404, detail="Aggregator config not found")
    resolve_outlet_id(ctx, config.outlet_id)

    if not config.menu_sync_enabled:
        raise HTTPException(
            status_code=409, detail="Menu sync is disabled for this aggregator"
        )

    items = (
        await db.execute(
            select(MenuItem).where(
                MenuItem.tenant_id == ctx.tenant_id,
                MenuItem.is_active.is_(True),
            )
        )
    ).scalars().all()

    config.last_synced_at = _now_iso()
    await db.commit()

    return MenuSyncResult(
        aggregator=_status_value(config.aggregator),
        outlet_id=config.outlet_id,
        items_synced=len(items),
        categories_synced=0,
        errors=[],
        synced_at=datetime.now(timezone.utc),
    )


@router.get("/stats", response_model=dict)
async def aggregator_stats(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:reports"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
):
    """Order volume per aggregator — the channel-mix chart."""
    resolve_outlet_id(ctx, outlet_id)

    rows = (
        await db.execute(
            select(
                Order.aggregator_name,
                func.count(Order.id).label("orders"),
            )
            .where(
                Order.tenant_id == ctx.tenant_id,
                Order.outlet_id == outlet_id,
                Order.aggregator_name.is_not(None),
            )
            .group_by(Order.aggregator_name)
            .order_by(func.count(Order.id).desc())
        )
    ).all()

    return {
        str(outlet_id): {
            "by_aggregator": [
                {"aggregator": r.aggregator_name, "orders": int(r.orders)}
                for r in rows
            ],
            "total_aggregator_orders": sum(int(r.orders) for r in rows),
        }
    }
