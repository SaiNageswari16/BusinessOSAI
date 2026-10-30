"""Reports service API routes.

Events:
  subscribes bill.paid, kot.ready  (projections into the read models)

The projections are the point of this service: billing and kitchen own the
transactions, reports owns the numbers. Nothing here writes back to another
service's data — the read models are built from events alone.
"""
from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.event_bus.bus import Event, bus
from src.services.reports import service
from src.services.reports.models import KitchenPerformanceSummary
from src.services.reports.schemas import (
    DashboardSummaryResponse,
    GstReport,
    HourlySalesReport,
    ItemSalesReport,
    OpsReport,
    PnlReport,
    PurchaseReport,
    ReportDefinitionCreate,
    ReportDefinitionResponse,
    SalesSummaryReport,
    StockReport,
)
from src.services.shared.identity import CurrentIdentity

router = APIRouter()


async def get_db(request: Request) -> AsyncSession:
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
    from src.services.reports.main import db as _db

    return _db.session_factory()


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


# ─── Consumers ────────────────────────────────────────────────────────────────

@bus.on("bill.paid")
async def _on_bill_paid(event: Event) -> None:
    """Project a settled bill into the daily/hourly/item read models.

    The upsert is additive, so double-counting is the only real risk — the
    dedupe ledger (installed in this service's own database) is the
    authoritative gate in the consumer loop, and it runs before this handler.
    """
    data = event.data or {}
    tenant = _tenant(event)
    if tenant is None or not data.get("bill_id"):
        return
    outlet = _coerce_uuid(event.outlet_id) or _coerce_uuid(data.get("outlet_id"))
    if outlet is None:
        return

    db = _handler_db()
    try:
        await service.record_bill_paid_event(db, tenant, outlet, data)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    finally:
        await db.close()


@bus.on("kot.ready")
async def _on_kot_ready(event: Event) -> None:
    """Count ready KOT tickets per station per day for kitchen performance."""
    data = event.data or {}
    tenant = _tenant(event)
    if tenant is None:
        return
    outlet = _coerce_uuid(event.outlet_id) or _coerce_uuid(data.get("outlet_id"))
    station = _coerce_uuid(data.get("station_id"))
    if outlet is None or station is None:
        return

    today = date.today()
    db = _handler_db()
    try:
        row = await db.scalar(
            select(KitchenPerformanceSummary).where(
                KitchenPerformanceSummary.outlet_id == outlet,
                KitchenPerformanceSummary.summary_date == today,
                KitchenPerformanceSummary.station_id == station,
            )
        )
        if row is None:
            row = KitchenPerformanceSummary(
                tenant_id=tenant,
                outlet_id=outlet,
                summary_date=today,
                station_id=station,
                station_name="kitchen",
                tickets_count=0,
                avg_prep_time_minutes=0,
                delayed_tickets_count=0,
            )
            db.add(row)
            await db.flush()
        row.tickets_count += 1
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    finally:
        await db.close()


@router.get("/dashboard", response_model=DashboardSummaryResponse, tags=["dashboard"])
async def get_dashboard(
    identity: CurrentIdentity,
    db: DbDep,
    outlet_id: uuid.UUID = Query(...),
    for_date: date = Query(default_factory=date.today),
):
    identity.require("view:reports")
    identity.can_access_outlet(outlet_id)
    return await service.get_dashboard_summary(db, identity.tenant_id, outlet_id, for_date)


@router.get("/sales", response_model=SalesSummaryReport, tags=["sales"])
async def get_sales(
    identity: CurrentIdentity,
    db: DbDep,
    date_from: date = Query(...),
    date_to: date = Query(default_factory=date.today),
    outlet_id: uuid.UUID | None = None,
):
    identity.require("view:reports")
    if outlet_id:
        identity.can_access_outlet(outlet_id)
    return await service.get_sales_summary(db, identity.tenant_id, date_from, date_to, outlet_id)


@router.get("/hourly", response_model=HourlySalesReport, tags=["hourly"])
async def get_hourly(
    identity: CurrentIdentity,
    db: DbDep,
    summary_date: date = Query(default_factory=date.today),
    outlet_id: uuid.UUID | None = None,
):
    identity.require("view:reports")
    if outlet_id:
        identity.can_access_outlet(outlet_id)
    return await service.get_hourly_sales(db, identity.tenant_id, summary_date, outlet_id)


@router.get("/items", response_model=ItemSalesReport, tags=["items"])
async def get_items(
    identity: CurrentIdentity,
    db: DbDep,
    date_from: date = Query(...),
    date_to: date = Query(default_factory=date.today),
    outlet_id: uuid.UUID | None = None,
):
    identity.require("view:reports")
    if outlet_id:
        identity.can_access_outlet(outlet_id)
    return await service.get_item_sales(db, identity.tenant_id, date_from, date_to, outlet_id)


@router.post("/project/bill-paid", tags=["internal"])
async def project_bill_paid(
    identity: CurrentIdentity,
    db: DbDep,
    payload: dict,
    outlet_id: uuid.UUID = Query(...),
):
    """Direct projection endpoint for testing or synchronous ingestion."""
    identity.require("view:reports")
    identity.can_access_outlet(outlet_id)
    await service.record_bill_paid_event(db, identity.tenant_id, outlet_id, payload)
    return {"status": "projected"}


# ─── Stock / GST / purchase / P&L / custom reports ───────────────────────────
#
# All of these read reports' own projections and are empty-safe: a tenant or
# outlet with no matching data gets zero-filled rows, never a 500.

@router.get("/stock/current", response_model=StockReport, tags=["stock"])
async def current_stock(
    identity: CurrentIdentity,
    db: DbDep,
    outlet_id: uuid.UUID | None = None,
):
    """Valued current stock per item, projected from stock movements."""
    identity.require("view:reports")
    if outlet_id:
        identity.can_access_outlet(outlet_id)
    return await service.get_current_stock(db, identity.tenant_id, outlet_id)


@router.get("/gst", response_model=GstReport, tags=["gst"])
async def gst_report(
    identity: CurrentIdentity,
    db: DbDep,
    date_from: date = Query(...),
    date_to: date = Query(default_factory=date.today),
    outlet_id: uuid.UUID | None = None,
):
    """The CGST / SGST / IGST split for the range, from settled bills."""
    identity.require("view:reports")
    if outlet_id:
        identity.can_access_outlet(outlet_id)
    return await service.get_gst(db, identity.tenant_id, date_from, date_to, outlet_id)


@router.get("/purchase", response_model=PurchaseReport, tags=["purchase"])
async def purchase_report(
    identity: CurrentIdentity,
    db: DbDep,
    date_from: date = Query(...),
    date_to: date = Query(default_factory=date.today),
    outlet_id: uuid.UUID | None = None,
):
    """GRN received value beside vendor-bill owed value for the range."""
    identity.require("view:reports")
    if outlet_id:
        identity.can_access_outlet(outlet_id)
    return await service.get_purchase(db, identity.tenant_id, date_from, date_to, outlet_id)


@router.get("/pnl", response_model=PnlReport, tags=["pnl"])
async def pnl_report(
    identity: CurrentIdentity,
    db: DbDep,
    date_from: date = Query(...),
    date_to: date = Query(default_factory=date.today),
    outlet_id: uuid.UUID | None = None,
):
    """Revenue vs. cost of goods sold for the range."""
    identity.require("view:reports")
    if outlet_id:
        identity.can_access_outlet(outlet_id)
    return await service.get_pnl(db, identity.tenant_id, date_from, date_to, outlet_id)


@router.get("/ops", response_model=OpsReport, tags=["ops"])
async def ops_report(
    identity: CurrentIdentity,
    db: DbDep,
    date_from: date = Query(...),
    date_to: date = Query(default_factory=date.today),
    outlet_id: uuid.UUID | None = None,
):
    """Operational facts for the range: money out, deliveries, production, campaigns."""
    identity.require("view:reports")
    if outlet_id:
        identity.can_access_outlet(outlet_id)
    return await service.get_ops_report(db, identity.tenant_id, date_from, date_to, outlet_id)


@router.get("/custom", response_model=list[ReportDefinitionResponse], tags=["reports"])
async def list_custom_reports(identity: CurrentIdentity, db: DbDep):
    """This tenant's saved report definitions, newest first."""
    identity.require("view:reports")
    rows = await service.list_report_definitions(db, identity.tenant_id)
    return [ReportDefinitionResponse.model_validate(r) for r in rows]


@router.post("/custom", response_model=ReportDefinitionResponse,
             status_code=201, tags=["reports"])
async def save_custom_report(
    payload: ReportDefinitionCreate,
    identity: CurrentIdentity,
    db: DbDep,
):
    """Save a report definition to run (or export) later."""
    identity.require("view:reports")
    row = await service.create_report_definition(
        db, identity.tenant_id,
        name=payload.name,
        module=payload.module,
        metric=payload.metric,
        filters=payload.filters,
        created_by=identity.user_id,
    )
    return row


@router.get("/custom/{definition_id}/run", tags=["reports"],
            summary="Render a saved report definition against the projections")
async def run_custom_report(
    definition_id: uuid.UUID,
    identity: CurrentIdentity,
    db: DbDep,
):
    """Run one saved definition. An unknown metric type returns a structured
    ``unsupported`` result with empty rows, not an error — a saved report is
    readable even when its metric is ahead of the runner."""
    identity.require("view:reports")
    definition = await service.load_report_definition(
        db, identity.tenant_id, definition_id,
    )
    if definition is None:
        raise HTTPException(status_code=404, detail="Report definition not found")
    return await service.run_report_definition(db, identity.tenant_id, definition)
