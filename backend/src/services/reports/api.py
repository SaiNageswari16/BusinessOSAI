"""Reports service API routes."""
from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.reports import service
from src.services.reports.schemas import (
    DashboardSummaryResponse,
    HourlySalesReport,
    ItemSalesReport,
    SalesSummaryReport,
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
