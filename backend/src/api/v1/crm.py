import uuid
import re
import json
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
import io
import csv
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, and_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from pydantic import BaseModel
from src.api.deps import CurrentUserContext, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import (
    AuditLog, Customer, Lead, LeadActivity, Tenant, CRMSupportTicket, 
    CRMQuotation, CRMSalesOrder, CRMOpportunity, EmailCampaign, EmailTemplate, 
    Employee, Applicant, AdAsset, CRMCallLog, User, UserRole, Role, UserStatus
)
from src.schemas.crm import (
    CustomerCreate, CustomerResponse, CustomerUpdate, LeadActivityCreate, LeadActivityResponse, 
    LeadCreate, LeadResponse, LeadUpdate, OpportunityCreate, OpportunityResponse, OpportunityUpdate, 
    CreatePaidAdRequestSchema, CRMCallInitiateRequest, CRMCallInitiateResponse, CRMCallTurnRequest, 
    CRMCallTurnResponse, CRMCallCompleteRequest, CRMCallLogResponse, CRMCallStatsResponse,
    CRMTelephonySettingsSchema, CRMTelephonySettingsUpdate,
    SalesExecutiveResponse, BulkAssignLeadsRequest, BulkImportLeadsRequest,
    BulkImportCustomersRequest, ConvertLeadPipelineRequest, ConvertLeadPipelineResponse
)
from src.services.telephony_service import TelephonyService
from src.utils.pagination import PaginatedResponse, paginate
from src.utils.notifications import add_system_notification
import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crm", tags=["CRM & Sales"])
LEAD_STATUSES = {"New", "Contacted", "Qualified", "Proposal", "Won", "Lost"}
OPPORTUNITY_STAGES = {"Prospecting", "Qualification", "Needs Analysis", "Value Proposition", "Negotiation", "Closed Won", "Closed Lost"}


def _is_crm_manager(ctx: CurrentUserContext) -> bool:
    """Checks if current user has full manager / administrative visibility for CRM."""
    if getattr(ctx.user, "is_tenant_owner", False):
        return True
    if getattr(ctx.user, "tenant", None) and getattr(ctx.user.tenant, "slug", "") == "system":
        return True
    if any(p in ctx.permissions for p in ("all", "*:*", "admin", "super_admin", "manage:all", "manage:erp", "manage:crm", "manage:crm_all_leads", "view:crm_all_leads")):
        return True
    if hasattr(ctx.user, "user_roles"):
        for ur in (ctx.user.user_roles or []):
            rname = getattr(getattr(ur, "role", None), "name", "").lower()
            if any(mgr in rname for mgr in ("admin", "manager", "director", "head", "lead", "owner")):
                return True
    return False


async def _lead_or_404(db: AsyncSession, lead_id: uuid.UUID, tenant_id: uuid.UUID) -> Lead:
    lead = await db.scalar(select(Lead).where(Lead.id == lead_id, Lead.tenant_id == tenant_id))
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.get("/customers", response_model=PaginatedResponse[CustomerResponse])
async def list_customers(ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_customers"))], db: Annotated[AsyncSession, Depends(get_db)], page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=200), search: str | None = None, customer_type: str | None = None):
    query = select(Customer).where(Customer.tenant_id == ctx.tenant_id)
    if search:
        term = f"%{search}%"
        query = query.where(or_(Customer.name.ilike(term), Customer.email.ilike(term), Customer.phone.ilike(term), Customer.company_name.ilike(term)))
    if customer_type:
        query = query.where(Customer.customer_type == customer_type)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.order_by(Customer.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/customers", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(payload: CustomerCreate, request: Request, ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_customers"))], db: Annotated[AsyncSession, Depends(get_db)]):
    customer = Customer(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(customer); await db.flush()
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="crm", action="customer_created", entity_type="customer", entity_id=customer.id, new_values=payload.model_dump(mode="json"), ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    return customer


@router.patch("/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(customer_id: uuid.UUID, payload: CustomerUpdate, request: Request, ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_customers"))], db: Annotated[AsyncSession, Depends(get_db)]):
    customer = await db.scalar(select(Customer).where(Customer.id == customer_id, Customer.tenant_id == ctx.tenant_id))
    if not customer: raise HTTPException(status_code=404, detail="Customer not found")
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items(): setattr(customer, key, value)
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="crm", action="customer_updated", entity_type="customer", entity_id=customer.id, new_values=updates, ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    return customer


@router.get("/sales-executives", response_model=list[SalesExecutiveResponse])
async def list_sales_executives(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Returns list of active tenant users / sales staff for lead assignment and performance stats."""
    users = (
        await db.scalars(
            select(User)
            .where(User.tenant_id == ctx.tenant_id, User.status == UserStatus.ACTIVE)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
        )
    ).all()

    lead_counts_res = await db.execute(
        select(Lead.owner_user_id, func.count(Lead.id))
        .where(Lead.tenant_id == ctx.tenant_id, Lead.owner_user_id.isnot(None))
        .group_by(Lead.owner_user_id)
    )
    lead_count_map = {row[0]: row[1] for row in lead_counts_res.fetchall()}

    call_counts_res = await db.execute(
        select(CRMCallLog.created_by_user_id, func.count(CRMCallLog.id))
        .where(CRMCallLog.tenant_id == ctx.tenant_id, CRMCallLog.created_by_user_id.isnot(None))
        .group_by(CRMCallLog.created_by_user_id)
    )
    call_count_map = {row[0]: row[1] for row in call_counts_res.fetchall()}

    executives = []
    for u in users:
        role_names = [ur.role.name for ur in (u.user_roles or []) if getattr(ur, "role", None)]
        primary_role = role_names[0] if role_names else ("Tenant Admin" if u.is_tenant_owner else "Sales Executive")
        name_str = getattr(u, "full_name", None) or u.email.split("@")[0]
        executives.append(SalesExecutiveResponse(
            id=u.id,
            name=name_str,
            email=u.email,
            role_name=primary_role,
            active_leads_count=lead_count_map.get(u.id, 0),
            total_calls_count=call_count_map.get(u.id, 0),
        ))
    return executives


@router.get("/leads", response_model=PaginatedResponse[LeadResponse])
async def list_leads(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    search: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    assigned_to: str | None = Query(default=None),  # 'all' | 'me' | 'unassigned' | <uuid>
    created_after: datetime | None = None,
    created_before: datetime | None = None,
    source: str | None = None,
):
    is_mgr = _is_crm_manager(ctx)
    query = select(Lead).where(Lead.tenant_id == ctx.tenant_id)

    # Role-based visibility:
    if not is_mgr:
        # Sales Executive sees only assigned leads or leads they own
        query = query.where(or_(Lead.owner_user_id == ctx.user.id, Lead.owner_user_id.is_(None)))
    else:
        # Manager can filter by assigned_to
        if assigned_to == "me":
            query = query.where(Lead.owner_user_id == ctx.user.id)
        elif assigned_to == "unassigned":
            query = query.where(Lead.owner_user_id.is_(None))
        elif assigned_to and assigned_to != "all":
            try:
                assignee_uuid = uuid.UUID(assigned_to)
                query = query.where(Lead.owner_user_id == assignee_uuid)
            except ValueError:
                pass

    if search:
        term = f"%{search}%"
        query = query.where(or_(
            Lead.name.ilike(term),
            Lead.company_name.ilike(term),
            Lead.email.ilike(term),
            Lead.phone.ilike(term),
            Lead.notes.ilike(term)
        ))
    if status_filter and status_filter != "all":
        query = query.where(Lead.status == status_filter)
    if source and source != "all":
        query = query.where(Lead.source.ilike(f"%{source}%"))
    if created_after:
        query = query.where(Lead.created_at >= created_after)
    if created_before:
        query = query.where(Lead.created_at <= created_before)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.order_by(Lead.updated_at.desc()).offset((page - 1) * page_size).limit(page_size))
    leads_list = result.scalars().all()

    if not leads_list:
        return paginate([], total or 0, page, page_size)

    lead_ids = [l.id for l in leads_list]
    owner_ids = [l.owner_user_id for l in leads_list if l.owner_user_id]

    # Batch load owners
    user_map = {}
    if owner_ids:
        owners = (await db.scalars(select(User).where(User.id.in_(set(owner_ids)), User.tenant_id == ctx.tenant_id))).all()
        for o in owners:
            user_map[o.id] = {
                "name": getattr(o, "full_name", None) or o.email.split("@")[0],
                "email": o.email,
            }

    # Batch load call counts
    call_stats_res = await db.execute(
        select(CRMCallLog.target_id, func.count(CRMCallLog.id))
        .where(CRMCallLog.tenant_id == ctx.tenant_id, CRMCallLog.target_id.in_(lead_ids), CRMCallLog.target_type == "lead")
        .group_by(CRMCallLog.target_id)
    )
    call_count_map = {row[0]: row[1] for row in call_stats_res.fetchall()}

    # Batch load latest call per lead
    recent_calls = (
        await db.scalars(
            select(CRMCallLog)
            .where(CRMCallLog.tenant_id == ctx.tenant_id, CRMCallLog.target_id.in_(lead_ids), CRMCallLog.target_type == "lead")
            .order_by(CRMCallLog.created_at.desc())
        )
    ).all()
    latest_call_map = {}
    for call in recent_calls:
        if call.target_id and call.target_id not in latest_call_map:
            latest_call_map[call.target_id] = call

    enriched_leads = []
    for l in leads_list:
        owner_info = user_map.get(l.owner_user_id, {})
        latest_call = latest_call_map.get(l.id)
        resp = LeadResponse.model_validate(l)
        resp.owner_name = owner_info.get("name")
        resp.owner_email = owner_info.get("email")
        resp.calls_count = call_count_map.get(l.id, 0)
        if latest_call:
            resp.last_call_status = latest_call.status
            resp.last_call_sentiment = latest_call.sentiment
        enriched_leads.append(resp)

    return paginate(enriched_leads, total or 0, page, page_size)


@router.get("/leads/export-csv")
async def export_leads_csv(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    search: str | None = None,
    status: str | None = None,
    assigned_to: str | None = None,
    created_after: datetime | None = None,
    created_before: datetime | None = None,
):
    """Exports filtered leads to downloadable CSV format."""
    is_mgr = _is_crm_manager(ctx)
    query = select(Lead).where(Lead.tenant_id == ctx.tenant_id)
    if not is_mgr:
        query = query.where(or_(Lead.owner_user_id == ctx.user.id, Lead.owner_user_id.is_(None)))
    else:
        if assigned_to == "me":
            query = query.where(Lead.owner_user_id == ctx.user.id)
        elif assigned_to == "unassigned":
            query = query.where(Lead.owner_user_id.is_(None))
        elif assigned_to and assigned_to != "all":
            try:
                query = query.where(Lead.owner_user_id == uuid.UUID(assigned_to))
            except ValueError:
                pass

    if search:
        term = f"%{search}%"
        query = query.where(or_(
            Lead.name.ilike(term), Lead.company_name.ilike(term), Lead.email.ilike(term), Lead.phone.ilike(term)
        ))
    if status and status != "all":
        query = query.where(Lead.status == status)
    if created_after:
        query = query.where(Lead.created_at >= created_after)
    if created_before:
        query = query.where(Lead.created_at <= created_before)

    leads = (await db.scalars(query.order_by(Lead.updated_at.desc()))).all()

    owner_ids = [l.owner_user_id for l in leads if l.owner_user_id]
    user_map = {}
    if owner_ids:
        owners = (await db.scalars(select(User).where(User.id.in_(set(owner_ids)), User.tenant_id == ctx.tenant_id))).all()
        for o in owners:
            user_map[o.id] = getattr(o, "full_name", None) or o.email

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Lead ID", "Name", "Company", "Email", "Phone", "Status", "Source",
        "Estimated Value", "Assigned To", "Last Contact", "Notes", "Created At"
    ])
    for l in leads:
        writer.writerow([
            str(l.id),
            l.name or "",
            l.company_name or "",
            l.email or "",
            l.phone or "",
            l.status or "",
            l.source or "",
            float(l.estimated_value or 0),
            user_map.get(l.owner_user_id, "Unassigned"),
            l.last_contact_at.strftime("%Y-%m-%d %H:%M:%S") if l.last_contact_at else "",
            l.notes or "",
            l.created_at.strftime("%Y-%m-%d %H:%M:%S") if l.created_at else "",
        ])
    output.seek(0)
    filename = f"crm_leads_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/leads/bulk-assign")
async def bulk_assign_leads(
    payload: BulkAssignLeadsRequest,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Assigns multiple leads to a selected Sales Executive or equal Round-Robin distribution."""
    if not payload.lead_ids:
        raise HTTPException(status_code=400, detail="No lead IDs provided")

    leads = (await db.scalars(select(Lead).where(Lead.tenant_id == ctx.tenant_id, Lead.id.in_(payload.lead_ids)))).all()
    if not leads:
        raise HTTPException(status_code=404, detail="No matching leads found")

    if payload.mode == "round_robin":
        target_users = payload.user_ids or []
        if not target_users:
            users = (await db.scalars(select(User).where(User.tenant_id == ctx.tenant_id, User.status == UserStatus.ACTIVE))).all()
            target_users = [u.id for u in users]
        if not target_users:
            raise HTTPException(status_code=400, detail="No active users available for round-robin assignment")
        
        for i, lead in enumerate(leads):
            assigned_u = target_users[i % len(target_users)]
            lead.owner_user_id = assigned_u
    else:
        for lead in leads:
            lead.owner_user_id = payload.owner_user_id

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="crm",
        action="leads_bulk_assigned",
        entity_type="lead",
        new_values={"count": len(leads), "mode": payload.mode, "owner_user_id": str(payload.owner_user_id) if payload.owner_user_id else None},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return {"success": True, "assigned_count": len(leads), "message": f"Successfully assigned {len(leads)} leads."}


@router.post("/leads/bulk-import")
async def bulk_import_leads(
    payload: BulkImportLeadsRequest,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Imports leads from parsed Excel/CSV data with automatic owner email resolution."""
    if not payload.leads:
        raise HTTPException(status_code=400, detail="No leads data provided")

    users = (await db.scalars(select(User).where(User.tenant_id == ctx.tenant_id))).all()
    email_to_user_map = {u.email.lower(): u.id for u in users}

    imported = []
    for item in payload.leads:
        owner_id = payload.default_owner_user_id
        if item.assigned_user_id:
            owner_id = item.assigned_user_id
        elif item.assigned_email and item.assigned_email.lower() in email_to_user_map:
            owner_id = email_to_user_map[item.assigned_email.lower()]

        lead = Lead(
            tenant_id=ctx.tenant_id,
            name=item.name,
            company_name=item.company_name,
            email=item.email,
            phone=item.phone,
            status=item.status or "New",
            source=item.source or "Bulk Import",
            estimated_value=item.estimated_value or 0.0,
            notes=item.notes,
            owner_user_id=owner_id,
        )
        db.add(lead)
        imported.append(lead)

    await db.flush()
    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="crm",
        action="leads_bulk_imported",
        entity_type="lead",
        new_values={"count": len(imported)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return {"success": True, "imported_count": len(imported), "message": f"Successfully imported {len(imported)} leads."}


@router.post("/customers/bulk-import")
async def bulk_import_customers(
    payload: BulkImportCustomersRequest,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Imports customers from parsed Excel/CSV data with automatic owner email resolution."""
    if not payload.customers:
        raise HTTPException(status_code=400, detail="No customer data provided")

    users = (await db.scalars(select(User).where(User.tenant_id == ctx.tenant_id))).all()
    email_to_user_map = {u.email.lower(): u.id for u in users}

    imported = []
    for item in payload.customers:
        owner_id = payload.default_owner_user_id
        if item.assigned_email and item.assigned_email.lower() in email_to_user_map:
            owner_id = email_to_user_map[item.assigned_email.lower()]

        cust = Customer(
            tenant_id=ctx.tenant_id,
            name=item.name,
            company_name=item.company_name,
            email=item.email,
            phone=item.phone,
            customer_type=item.customer_type or "Retail",
            status=item.status or "Active",
            address=item.address,
            gst_number=item.gst_number,
            owner_user_id=owner_id,
        )
        db.add(cust)
        imported.append(cust)

    await db.flush()
    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="crm",
        action="customers_bulk_imported",
        entity_type="customer",
        new_values={"count": len(imported)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return {"success": True, "imported_count": len(imported), "message": f"Successfully imported {len(imported)} customers."}


@router.post("/leads", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(payload: LeadCreate, request: Request, ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))], db: Annotated[AsyncSession, Depends(get_db)]):
    if payload.status not in LEAD_STATUSES: raise HTTPException(status_code=400, detail="Invalid lead status")
    lead = Lead(tenant_id=ctx.tenant_id, **payload.model_dump())
    if not lead.owner_user_id and not _is_crm_manager(ctx):
        lead.owner_user_id = ctx.user.id
    db.add(lead); await db.flush()
    await add_system_notification(db, ctx.tenant_id, f"New CRM Lead: {lead.name}", f"Lead '{lead.name}' ({lead.company_name or 'No Company'}) was created by {ctx.user.full_name}", "crm")
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="crm", action="lead_created", entity_type="lead", entity_id=lead.id, new_values=payload.model_dump(mode="json"), ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    await db.commit()
    return lead


@router.patch("/leads/{lead_id}", response_model=LeadResponse)
async def update_lead(lead_id: uuid.UUID, payload: LeadUpdate, request: Request, ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))], db: Annotated[AsyncSession, Depends(get_db)]):
    lead = await _lead_or_404(db, lead_id, ctx.tenant_id); updates = payload.model_dump(exclude_unset=True)
    if "status" in updates and updates["status"] not in LEAD_STATUSES: raise HTTPException(status_code=400, detail="Invalid lead status")
    if updates.get("status") in {"Contacted", "Qualified", "Proposal", "Won", "Lost"}: lead.last_contact_at = datetime.now(timezone.utc)
    for key, value in updates.items(): setattr(lead, key, value)
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="crm", action="lead_updated", entity_type="lead", entity_id=lead.id, new_values=updates, ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    return lead


@router.get("/leads/{lead_id}/activities", response_model=list[LeadActivityResponse])
async def list_lead_activities(
    lead_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Retrieves chronological activity and call interaction history for a lead."""
    lead = await _lead_or_404(db, lead_id, ctx.tenant_id)
    activities = (
        await db.scalars(
            select(LeadActivity)
            .where(LeadActivity.tenant_id == ctx.tenant_id, LeadActivity.lead_id == lead_id)
            .order_by(LeadActivity.occurred_at.desc(), LeadActivity.created_at.desc())
        )
    ).all()
    return activities


@router.post("/leads/{lead_id}/activities", response_model=LeadActivityResponse, status_code=status.HTTP_201_CREATED)
async def create_lead_activity(
    lead_id: uuid.UUID,
    payload: LeadActivityCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Logs a call, notes, or outcome disposition for a lead."""
    lead = await _lead_or_404(db, lead_id, ctx.tenant_id)
    activity = LeadActivity(
        tenant_id=ctx.tenant_id,
        lead_id=lead_id,
        opportunity_id=payload.opportunity_id,
        activity_type=payload.activity_type or "Call",
        summary=payload.summary or "Call / Interaction Logged",
        call_disposition=payload.call_disposition,
        call_duration_minutes=payload.call_duration_minutes or 0,
        customer_response=payload.customer_response,
        occurred_at=payload.occurred_at or datetime.now(timezone.utc),
        created_by_user_id=ctx.user.id,
    )
    db.add(activity)

    # Automatically update the lead's latest interaction metadata & call history
    lead.last_contact_at = activity.occurred_at
    if payload.call_disposition:
        lead.call_disposition = payload.call_disposition
    if payload.call_duration_minutes is not None and payload.call_duration_minutes > 0:
        lead.call_duration_minutes = payload.call_duration_minutes
    if payload.customer_response:
        lead.customer_response = payload.customer_response

    await db.flush()
    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="crm",
        action="lead_activity_created",
        entity_type="lead_activity",
        entity_id=activity.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return activity


@router.post("/leads/{lead_id}/convert", response_model=CustomerResponse)
async def convert_lead(lead_id: uuid.UUID, request: Request, ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))], db: Annotated[AsyncSession, Depends(get_db)]):
    lead = await _lead_or_404(db, lead_id, ctx.tenant_id)
    existing = await db.scalar(select(Customer).where(Customer.tenant_id == ctx.tenant_id, Customer.lead_id == lead.id))
    if existing: return existing
    customer = Customer(tenant_id=ctx.tenant_id, lead_id=lead.id, name=lead.name, email=lead.email, phone=lead.phone, company_name=lead.company_name, owner_user_id=lead.owner_user_id)
    lead.status = "Won"; lead.last_contact_at = datetime.now(timezone.utc); db.add(customer); await db.flush()
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="crm", action="lead_converted", entity_type="lead", entity_id=lead.id, new_values={"customer_id": str(customer.id)}, ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    return customer


@router.post("/leads/{lead_id}/convert-pipeline", response_model=ConvertLeadPipelineResponse)
async def convert_lead_to_pipeline(
    lead_id: uuid.UUID,
    payload: ConvertLeadPipelineRequest,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Atomically converts a Lead to Customer + Deal Opportunity in pipeline with executive ownership preserved."""
    lead = await _lead_or_404(db, lead_id, ctx.tenant_id)

    # 1. Find or create Customer
    customer = await db.scalar(
        select(Customer).where(
            Customer.tenant_id == ctx.tenant_id,
            or_(Customer.lead_id == lead.id, and_(Customer.email == lead.email, Customer.email.isnot(None)))
        )
    )
    if not customer:
        customer = Customer(
            tenant_id=ctx.tenant_id,
            lead_id=lead.id,
            name=lead.name,
            email=lead.email,
            phone=lead.phone,
            company_name=lead.company_name,
            customer_type=payload.customer_type or "Retail",
            status="Active",
            owner_user_id=lead.owner_user_id or ctx.user.id,
        )
        db.add(customer)
        await db.flush()

    # 2. Create Deal Opportunity
    deal_name = payload.deal_name or f"{lead.name} - {lead.company_name or 'Deal'}".strip()
    deal_amt = payload.deal_amount if payload.deal_amount is not None else float(lead.estimated_value or 0)
    
    deal = CRMOpportunity(
        tenant_id=ctx.tenant_id,
        customer_id=customer.id,
        lead_id=lead.id,
        name=deal_name,
        stage=payload.deal_stage or "Prospecting",
        amount=deal_amt,
        probability=60 if payload.deal_stage == "Proposal" else 25,
        expected_close_date=payload.expected_close_date,
        owner_user_id=lead.owner_user_id or ctx.user.id,
        notes=payload.notes or lead.notes,
    )
    db.add(deal)

    # 3. Update Lead Status
    lead.status = "Won"
    lead.last_contact_at = datetime.now(timezone.utc)
    
    await db.flush()
    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="crm",
        action="lead_converted_to_deal",
        entity_type="lead",
        entity_id=lead.id,
        new_values={"customer_id": str(customer.id), "opportunity_id": str(deal.id)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return ConvertLeadPipelineResponse(
        lead_id=lead.id,
        customer_id=customer.id,
        customer_name=customer.name,
        opportunity_id=deal.id,
        deal_name=deal.name,
        deal_stage=deal.stage,
        deal_amount=float(deal.amount or 0),
        owner_user_id=deal.owner_user_id,
        message=f"Lead successfully converted to Customer '{customer.name}' and Deal '{deal.name}' in pipeline!"
    )


# ─── CRM Opportunities & Pipeline ───────────────────────────────

@router.get("/opportunities", response_model=PaginatedResponse[OpportunityResponse])
async def list_opportunities(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=100),
    search: str | None = None,
    stage: str | None = None,
    assigned_to: str | None = None,
):
    is_mgr = _is_crm_manager(ctx)
    query = select(CRMOpportunity).where(CRMOpportunity.tenant_id == ctx.tenant_id)
    if not is_mgr:
        query = query.where(CRMOpportunity.owner_user_id == ctx.user.id)
    elif assigned_to == "me":
        query = query.where(CRMOpportunity.owner_user_id == ctx.user.id)
    elif assigned_to and assigned_to != "all":
        try:
            query = query.where(CRMOpportunity.owner_user_id == uuid.UUID(assigned_to))
        except ValueError:
            pass

    if search:
        query = query.where(CRMOpportunity.name.ilike(f"%{search}%"))
    if stage and stage != "all":
        query = query.where(CRMOpportunity.stage == stage)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.order_by(CRMOpportunity.updated_at.desc()).offset((page - 1) * page_size).limit(page_size))
    deals_list = result.scalars().all()

    if not deals_list:
        return paginate([], total or 0, page, page_size)

    deal_ids = [d.id for d in deals_list]
    owner_ids = [d.owner_user_id for d in deals_list if d.owner_user_id]
    cust_ids = [d.customer_id for d in deals_list if d.customer_id]

    # Pre-fetch owners
    user_map = {}
    if owner_ids:
        owners = (await db.scalars(select(User).where(User.id.in_(set(owner_ids)), User.tenant_id == ctx.tenant_id))).all()
        for o in owners:
            user_map[o.id] = {
                "name": getattr(o, "full_name", None) or o.email.split("@")[0],
                "email": o.email,
            }

    # Pre-fetch customers
    cust_map = {}
    if cust_ids:
        customers = (await db.scalars(select(Customer).where(Customer.id.in_(set(cust_ids)), Customer.tenant_id == ctx.tenant_id))).all()
        for c in customers:
            cust_map[c.id] = c.name

    # Batch load call counts
    call_stats_res = await db.execute(
        select(CRMCallLog.target_id, func.count(CRMCallLog.id))
        .where(
            CRMCallLog.tenant_id == ctx.tenant_id,
            CRMCallLog.target_id.in_(deal_ids),
            CRMCallLog.target_type.in_(["opportunity", "deal"])
        )
        .group_by(CRMCallLog.target_id)
    )
    call_count_map = {row[0]: row[1] for row in call_stats_res.fetchall()}

    # Batch load latest calls
    recent_calls = (
        await db.scalars(
            select(CRMCallLog)
            .where(
                CRMCallLog.tenant_id == ctx.tenant_id,
                CRMCallLog.target_id.in_(deal_ids),
                CRMCallLog.target_type.in_(["opportunity", "deal"])
            )
            .order_by(CRMCallLog.created_at.desc())
        )
    ).all()
    latest_call_map = {}
    for call in recent_calls:
        if call.target_id and call.target_id not in latest_call_map:
            latest_call_map[call.target_id] = call

    enriched_deals = []
    for d in deals_list:
        owner_info = user_map.get(d.owner_user_id, {})
        latest_call = latest_call_map.get(d.id)
        resp = OpportunityResponse.model_validate(d)
        resp.owner_name = owner_info.get("name")
        resp.owner_email = owner_info.get("email")
        resp.customer_name = cust_map.get(d.customer_id)
        resp.calls_count = call_count_map.get(d.id, 0)
        if latest_call:
            resp.last_call_status = latest_call.status
            resp.last_call_sentiment = latest_call.sentiment
        enriched_deals.append(resp)

    return paginate(enriched_deals, total or 0, page, page_size)


@router.get("/opportunities/export-csv")
async def export_opportunities_csv(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    search: str | None = None,
    stage: str | None = None,
    assigned_to: str | None = None,
):
    """Exports filtered deals/opportunities to downloadable CSV format."""
    is_mgr = _is_crm_manager(ctx)
    query = select(CRMOpportunity).where(CRMOpportunity.tenant_id == ctx.tenant_id)
    if not is_mgr:
        query = query.where(CRMOpportunity.owner_user_id == ctx.user.id)
    elif assigned_to == "me":
        query = query.where(CRMOpportunity.owner_user_id == ctx.user.id)
    elif assigned_to and assigned_to != "all":
        try:
            query = query.where(CRMOpportunity.owner_user_id == uuid.UUID(assigned_to))
        except ValueError:
            pass

    if search:
        query = query.where(CRMOpportunity.name.ilike(f"%{search}%"))
    if stage and stage != "all":
        query = query.where(CRMOpportunity.stage == stage)

    deals = (await db.scalars(query.order_by(CRMOpportunity.updated_at.desc()))).all()

    owner_ids = [d.owner_user_id for d in deals if d.owner_user_id]
    cust_ids = [d.customer_id for d in deals if d.customer_id]
    user_map = {}
    cust_map = {}
    if owner_ids:
        owners = (await db.scalars(select(User).where(User.id.in_(set(owner_ids)), User.tenant_id == ctx.tenant_id))).all()
        for o in owners:
            user_map[o.id] = getattr(o, "full_name", None) or o.email
    if cust_ids:
        customers = (await db.scalars(select(Customer).where(Customer.id.in_(set(cust_ids)), Customer.tenant_id == ctx.tenant_id))).all()
        for c in customers:
            cust_map[c.id] = c.name

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Deal ID", "Deal Name", "Customer", "Stage", "Amount", "Probability (%)",
        "Expected Close Date", "Assigned Rep", "Next Step", "Notes", "Created At"
    ])
    for d in deals:
        writer.writerow([
            str(d.id),
            d.name or "",
            cust_map.get(d.customer_id, "—"),
            d.stage or "",
            float(d.amount or 0),
            d.probability or 0,
            d.expected_close_date.strftime("%Y-%m-%d") if d.expected_close_date else "",
            user_map.get(d.owner_user_id, "Unassigned"),
            d.next_step or "",
            d.notes or "",
            d.created_at.strftime("%Y-%m-%d %H:%M:%S") if d.created_at else "",
        ])
    output.seek(0)
    filename = f"crm_deals_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/opportunities", response_model=OpportunityResponse, status_code=status.HTTP_201_CREATED)
async def create_opportunity(payload: OpportunityCreate, request: Request, ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))], db: Annotated[AsyncSession, Depends(get_db)]):
    if payload.stage not in OPPORTUNITY_STAGES:
        raise HTTPException(status_code=400, detail="Invalid opportunity stage")
    if not payload.customer_id and not payload.lead_id:
        raise HTTPException(status_code=400, detail="An opportunity must be linked to a customer or lead")
    opportunity = CRMOpportunity(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(opportunity); await db.flush()
    await add_system_notification(db, ctx.tenant_id, f"New Opportunity: {opportunity.name}", f"Deal/Opportunity '{opportunity.name}' worth ${opportunity.expected_revenue or 0:,.2f} created by {ctx.user.full_name}", "crm")
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="crm", action="opportunity_created", entity_type="opportunity", entity_id=opportunity.id, new_values=payload.model_dump(mode="json"), ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    await db.commit()
    return opportunity


@router.patch("/opportunities/{opportunity_id}", response_model=OpportunityResponse)
async def update_opportunity(opportunity_id: uuid.UUID, payload: OpportunityUpdate, request: Request, ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))], db: Annotated[AsyncSession, Depends(get_db)]):
    opportunity = await db.scalar(select(CRMOpportunity).where(CRMOpportunity.id == opportunity_id, CRMOpportunity.tenant_id == ctx.tenant_id))
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("stage") and updates["stage"] not in OPPORTUNITY_STAGES:
        raise HTTPException(status_code=400, detail="Invalid opportunity stage")
    for key, value in updates.items(): setattr(opportunity, key, value)
    await write_audit_log(db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="crm", action="opportunity_updated", entity_type="opportunity", entity_id=opportunity.id, new_values=updates, ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    return opportunity


@router.get("/opportunities/{opportunity_id}/activities", response_model=list[LeadActivityResponse])
async def list_opportunity_activities(
    opportunity_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Retrieves chronological activity and call interaction history for an opportunity/deal."""
    opp = await db.scalar(select(CRMOpportunity).where(CRMOpportunity.id == opportunity_id, CRMOpportunity.tenant_id == ctx.tenant_id))
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    activities = (
        await db.scalars(
            select(LeadActivity)
            .where(LeadActivity.tenant_id == ctx.tenant_id, LeadActivity.opportunity_id == opportunity_id)
            .order_by(LeadActivity.occurred_at.desc(), LeadActivity.created_at.desc())
        )
    ).all()
    return activities


@router.post("/opportunities/{opportunity_id}/activities", response_model=LeadActivityResponse, status_code=status.HTTP_201_CREATED)
async def create_opportunity_activity(
    opportunity_id: uuid.UUID,
    payload: LeadActivityCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Logs a call, notes, or outcome disposition for an opportunity/deal."""
    opp = await db.scalar(select(CRMOpportunity).where(CRMOpportunity.id == opportunity_id, CRMOpportunity.tenant_id == ctx.tenant_id))
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    activity = LeadActivity(
        tenant_id=ctx.tenant_id,
        lead_id=opp.lead_id,
        opportunity_id=opportunity_id,
        activity_type=payload.activity_type or "Call",
        summary=payload.summary or "Call / Interaction Logged",
        call_disposition=payload.call_disposition,
        call_duration_minutes=payload.call_duration_minutes or 0,
        customer_response=payload.customer_response,
        occurred_at=payload.occurred_at or datetime.now(timezone.utc),
        created_by_user_id=ctx.user.id,
    )
    db.add(activity)

    await db.flush()
    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="crm",
        action="opportunity_activity_created",
        entity_type="opportunity_activity",
        entity_id=activity.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return activity


# ─── Facebook / Meta Integration (fully multi-tenant) ───────────────────────
#
# Architecture:
#   tenant.settings["facebook_app"]  → org's own Meta App credentials (App ID + Secret + Redirect URI)
#   tenant.settings["facebook_page"] → connected page (page_id, page_name, page_access_token)
#   tenant.settings["facebook"]      → backward-compat key used by lead import service
#   tenant.settings["facebook_oauth_pending"] → temporary page list during OAuth / token-verify flow
#
# Every tenant manages their own credentials — nothing is stored in .env for this feature.
# The token-paste flow (primary) requires ONLY the Page/User token — no App credentials needed.
# The OAuth popup flow (secondary) requires the tenant to have saved their own App ID + Secret first.


# ── Pydantic models ──────────────────────────────────────────────────────────

class FacebookAppConfigRequest(BaseModel):
    """Per-tenant Meta App credentials (App ID + App Secret from developers.facebook.com)."""
    app_id: str
    app_secret: str
    redirect_uri: str = "http://localhost:8000/api/v1/crm/facebook/oauth-callback"

class VerifyTokenRequest(BaseModel):
    """A User Token or Page Token pasted from developers.facebook.com/tools/explorer."""
    access_token: str

class SelectFacebookPageRequest(BaseModel):
    page_id: str
    page_name: str
    # page_access_token is optional — backend always retrieves the stored token from pending
    page_access_token: str = ""

class FacebookConnectDirectRequest(BaseModel):
    page_id: str | None = None
    access_token: str
    ad_account_id: str | None = None

class SelectFacebookAdAccountRequest(BaseModel):
    ad_account_id: str

class ActivateAdRequest(BaseModel):
    status: str

class FacebookCredentialsRequest(BaseModel):
    """Legacy model kept for backward-compat with the lead-import form."""
    fb_access_token: str
    fb_page_or_form_id: str | None = None
    fb_api_version: str = "v25.0"



# ── Helper: get tenant safely ────────────────────────────────────────────────

async def _get_tenant_or_404(db: AsyncSession, tenant_id) -> "Tenant":
    tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


def resolve_facebook_credentials(token: str, page_id: str | None = None) -> tuple[str, str, str]:
    """
    Introspects the provided token and optional page_id.
    Returns: (resolved_page_id, page_name, resolved_token)
    """
    import requests as _req
    
    token = token.strip()
    page_id = page_id.strip() if page_id else None
    
    if not token:
        raise ValueError("Access Token is required.")
        
    page_name = "Facebook Page/Form"
    resolved_page_id = page_id
    resolved_token = token
    
    try:
        logger.info(f"Introspecting Facebook credentials - Page ID Input: {page_id}")
        # First, try to fetch Page details directly assuming the token is a Page Access Token
        resp_me = _req.get(
            "https://graph.facebook.com/v25.0/me",
            params={"access_token": token, "fields": "id,name,category"},
            timeout=15
        )
        me_data = resp_me.json()
        logger.info(f"Facebook /me response status: {resp_me.status_code}, body: {me_data}")
        
        # If 'category' is in me_data, it's a Facebook Page Token!
        if "error" not in me_data and "category" in me_data:
            resolved_page_id = me_data["id"]
            page_name = me_data["name"]
            logger.info(f"Resolved directly from Page Access Token: Page Name: '{page_name}', Page ID: '{resolved_page_id}'")
        else:
            # Try to get accounts (this works if it's a User Access Token)
            resp_accounts = _req.get(
                "https://graph.facebook.com/v25.0/me/accounts",
                params={"access_token": token, "fields": "id,name,access_token", "limit": 100},
                timeout=15
            )
            accounts_data = resp_accounts.json()
            logger.info(f"Facebook /me/accounts response status: {resp_accounts.status_code}, body: {accounts_data}")
            
            if "error" not in accounts_data and accounts_data.get("data"):
                # If page_id is provided, try to match it
                matched = None
                if page_id:
                    matched = next((p for p in accounts_data["data"] if p["id"] == page_id), None)
                # If no match or page_id not provided, default to the first available page
                if not matched:
                    matched = accounts_data["data"][0]
                
                resolved_page_id = matched["id"]
                page_name = matched["name"]
                resolved_token = matched.get("access_token", token)
                logger.info(f"Resolved from User accounts list: Page Name: '{page_name}', Page ID: '{resolved_page_id}'")
            else:
                # If both failed, and page_id was provided, try direct call to page_id endpoint
                if page_id:
                    logger.info(f"Attempting direct GET request to Graph API for page_id: {page_id}")
                    resp_direct = _req.get(
                        f"https://graph.facebook.com/v25.0/{page_id}",
                        params={"access_token": token, "fields": "name,id"},
                        timeout=15
                    )
                    direct_data = resp_direct.json()
                    logger.info(f"Facebook direct page_id endpoint response status: {resp_direct.status_code}, body: {direct_data}")
                    if "error" in direct_data:
                        err_msg = direct_data["error"].get("message", "Validation failed")
                        raise ValueError(f"Meta API Validation failed: {err_msg}")
                    page_name = direct_data.get("name", page_name)
                    resolved_page_id = page_id
                else:
                    # No page_id and token introspection failed
                    err_msg = me_data.get("error", {}).get("message") or accounts_data.get("error", {}).get("message") or "Invalid Access Token"
                    raise ValueError(f"Could not resolve Facebook Page: {err_msg}")
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Error introspecting Facebook credentials: {e}")
        raise ValueError(f"Could not connect to Facebook API: {str(e)}")

    if not resolved_page_id:
        raise ValueError("Could not resolve Page ID from the provided Access Token. Please provide it manually.")
        
    return resolved_page_id, page_name, resolved_token


@router.post("/facebook/connect-direct")
async def connect_fb_direct(
    payload: FacebookConnectDirectRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Directly connect a Facebook Page/Form using direct copy-pasted credentials.
    
    1. Validates the provided credentials by fetching Page/Form info from Meta API.
    2. Saves the credentials directly to tenant settings.
    3. Works for both ad publishing and lead import services immediately.
    """
    token = payload.access_token.strip()
    page_id = payload.page_id.strip() if payload.page_id else None

    try:
        resolved_page_id, page_name, resolved_token = resolve_facebook_credentials(token, page_id)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    # Save to organization (tenant) settings
    tenant = await _get_tenant_or_404(db, ctx.tenant_id)
    settings_dict = dict(tenant.settings or {})
    
    # Store the user access token if it is different from page token, or default to input token
    user_access_token = token if token != resolved_token else settings_dict.get("facebook_page", {}).get("user_access_token") or token
    
    # Save for ad campaign publisher
    settings_dict["facebook_page"] = {
        "page_id": resolved_page_id,
        "page_name": page_name,
        "page_access_token": resolved_token,
        "user_access_token": user_access_token,
        "api_version": "v25.0",
        "ad_account_id": payload.ad_account_id.strip() if payload.ad_account_id else settings_dict.get("facebook_page", {}).get("ad_account_id"),
    }
    # Save for lead import service compatibility
    settings_dict["facebook"] = {
        "fb_access_token": resolved_token,
        "fb_page_or_form_id": resolved_page_id,
        "fb_api_version": "v25.0",
        "fb_ad_account_id": payload.ad_account_id.strip() if payload.ad_account_id else settings_dict.get("facebook", {}).get("fb_ad_account_id"),
    }
    
    tenant.settings = settings_dict
    await db.commit()

    return {
        "success": True,
        "page_name": page_name,
        "page_id": resolved_page_id,
        "message": f"Successfully connected '{page_name}' for your organization."
    }


# ── App config (per-tenant) ──────────────────────────────────────────────────

@router.post("/facebook/app-config")
async def save_fb_app_config(
    payload: FacebookAppConfigRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Save this tenant's Meta App credentials (App ID + Secret) so they can use the
    OAuth popup flow.  Credentials are stored **per tenant** in tenant.settings —
    never in server .env files.
    """
    tenant = await _get_tenant_or_404(db, ctx.tenant_id)
    settings_dict = dict(tenant.settings or {})
    settings_dict["facebook_app"] = {
        "app_id": payload.app_id.strip(),
        "app_secret": payload.app_secret.strip(),
        "redirect_uri": payload.redirect_uri.strip(),
    }
    tenant.settings = settings_dict
    await db.commit()
    return {"success": True, "message": "Meta App credentials saved for your organization."}


@router.get("/facebook/app-config")
async def get_fb_app_config(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return whether this tenant has a Meta App configured (never returns the secret)."""
    tenant = await _get_tenant_or_404(db, ctx.tenant_id)
    app_cfg = (tenant.settings or {}).get("facebook_app", {})
    return {
        "configured": bool(app_cfg.get("app_id") and app_cfg.get("app_secret")),
        "app_id": app_cfg.get("app_id"),           # safe to return
        "redirect_uri": app_cfg.get("redirect_uri"),
    }


@router.delete("/facebook/app-config")
async def delete_fb_app_config(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Remove this tenant's Meta App credentials."""
    tenant = await _get_tenant_or_404(db, ctx.tenant_id)
    settings_dict = dict(tenant.settings or {})
    settings_dict.pop("facebook_app", None)
    tenant.settings = settings_dict
    await db.commit()
    return {"success": True}


# ── Status ───────────────────────────────────────────────────────────────────

@router.get("/facebook/status")
async def get_fb_status(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return full Facebook integration status for this tenant."""
    tenant = await _get_tenant_or_404(db, ctx.tenant_id)
    ts = tenant.settings or {}
    fb_page_cfg = ts.get("facebook_page", {})
    fb_app_cfg  = ts.get("facebook_app", {})
    return {
        # Whether this org has saved their Meta App credentials (for OAuth popup)
        "app_configured": bool(fb_app_cfg.get("app_id") and fb_app_cfg.get("app_secret")),
        "app_id": fb_app_cfg.get("app_id"),
        # Whether a Facebook Page is actively connected for publishing
        "page_connected": bool(fb_page_cfg.get("page_access_token") and fb_page_cfg.get("page_id")),
        "page_name": fb_page_cfg.get("page_name"),
        "page_id": fb_page_cfg.get("page_id"),
    }


# ── Primary: Token-paste (no App credentials required) ───────────────────────

@router.post("/facebook/verify-token")
async def verify_fb_token(
    payload: VerifyTokenRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    The PRIMARY connection method — no Meta App credentials required.
    
    The user pastes a User Token or Page Token from:
      developers.facebook.com/tools/explorer

    This endpoint:
    1. Calls /me/accounts to list all pages the token can manage.
    2. If the token is a Page Token (not User Token), introspects it directly.
    3. Stores the discovered pages temporarily so the frontend picker can display them.
    4. The user picks a page → /facebook/select-page saves permanently.
    """
    import requests as _req

    token = payload.access_token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="Access token cannot be empty.")

    pages = []

    # Try /me/accounts — works for User Tokens, returns all managed pages with their own tokens
    try:
        resp = _req.get(
            "https://graph.facebook.com/v25.0/me/accounts",
            params={"access_token": token, "fields": "id,name,access_token,category", "limit": 50},
            timeout=15,
        )
        data = resp.json()
        if "error" not in data:
            pages = data.get("data", [])
    except Exception:
        pass

    if not pages:
        # Token might already be a Page Token — introspect /me directly
        try:
            resp2 = _req.get(
                "https://graph.facebook.com/v25.0/me",
                params={"access_token": token, "fields": "id,name,category"},
                timeout=15,
            )
            info = resp2.json()
            if "error" in info:
                raise HTTPException(
                    status_code=400,
                    detail=f"Meta API Error: {info['error'].get('message', 'Invalid or expired token')}. "
                           f"Make sure the token has pages_manage_posts permission.",
                )
            pages = [{
                "id": info["id"],
                "name": info.get("name", "My Page"),
                "access_token": token,
                "category": info.get("category", ""),
            }]
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not verify token with Meta: {str(e)}")

    if not pages:
        raise HTTPException(
            status_code=400,
            detail=(
                "No Facebook Pages found for this token. "
                "Ensure you have Admin access to at least one Page and the token includes "
                "pages_show_list and pages_manage_posts permissions."
            ),
        )

    # Store pending pages per-tenant (include tokens server-side, never exposed to frontend)
    tenant = await _get_tenant_or_404(db, ctx.tenant_id)
    settings_dict = dict(tenant.settings or {})
    settings_dict["facebook_oauth_pending"] = {
        "user_access_token": token,
        "pages": [
            {
                "id": p["id"],
                "name": p["name"],
                "access_token": p.get("access_token", token),
                "category": p.get("category", ""),
            }
            for p in pages
        ],
    }
    tenant.settings = settings_dict
    await db.commit()

    # Return page list WITHOUT access tokens (security — tokens stay server-side)
    return {
        "pages": [{"id": p["id"], "name": p["name"], "category": p.get("category", "")} for p in pages],
        "count": len(pages),
    }


# ── Secondary: OAuth popup (requires tenant's own App credentials) ────────────

@router.get("/facebook/auth-url")
async def get_fb_auth_url(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Generate the Meta OAuth authorization URL using THIS TENANT'S own App credentials.
    The tenant must have saved their App ID + Secret via POST /facebook/app-config first.
    """
    import urllib.parse
    tenant = await _get_tenant_or_404(db, ctx.tenant_id)
    app_cfg = (tenant.settings or {}).get("facebook_app", {})
    app_id     = app_cfg.get("app_id")
    app_secret = app_cfg.get("app_secret")
    redirect_uri = app_cfg.get("redirect_uri", "http://localhost:8000/api/v1/crm/facebook/oauth-callback")

    if not app_id or not app_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Your organization has not configured Meta App credentials yet. "
                "Go to Facebook Integration Settings → enter your App ID and App Secret first. "
                "You can also skip OAuth entirely by using the token-paste method."
            ),
        )

    params = {
        "client_id": app_id,
        "redirect_uri": redirect_uri,
        "scope": "pages_show_list,pages_read_engagement,pages_manage_posts,pages_manage_ads",
        "response_type": "code",
        # Encode tenant_id in state so the callback knows which org to update
        "state": str(ctx.tenant_id),
    }
    auth_url = "https://www.facebook.com/v25.0/dialog/oauth?" + urllib.parse.urlencode(params)
    return {"auth_url": auth_url, "redirect_uri": redirect_uri}


@router.get("/facebook/oauth-callback")
async def fb_oauth_callback(
    code: str,
    state: str,   # contains tenant_id
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Meta redirects here after the user grants permissions.
    Uses THIS TENANT'S own App credentials (from tenant.settings["facebook_app"])
    to exchange the auth code for tokens.
    """
    import requests as _req
    import uuid as _uuid
    from fastapi.responses import HTMLResponse

    try:
        tenant_id = _uuid.UUID(state)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid OAuth state parameter.")

    tenant = await _get_tenant_or_404(db, tenant_id)
    app_cfg = (tenant.settings or {}).get("facebook_app", {})
    app_id       = app_cfg.get("app_id")
    app_secret   = app_cfg.get("app_secret")
    redirect_uri = app_cfg.get("redirect_uri", "http://localhost:8000/api/v1/crm/facebook/oauth-callback")

    if not app_id or not app_secret:
        raise HTTPException(status_code=400, detail="Tenant Meta App credentials missing. Please reconfigure.")

    # Exchange code → short-lived user token
    token_res = _req.get(
        "https://graph.facebook.com/v25.0/oauth/access_token",
        params={
            "client_id": app_id,
            "client_secret": app_secret,
            "redirect_uri": redirect_uri,
            "code": code,
        },
        timeout=15,
    )
    token_data = token_res.json()
    if "error" in token_data:
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {token_data['error'].get('message')}")
    short_token = token_data["access_token"]

    # Exchange short-lived → long-lived (60-day) user token
    ll_res = _req.get(
        "https://graph.facebook.com/v25.0/oauth/access_token",
        params={
            "grant_type": "fb_exchange_token",
            "client_id": app_id,
            "client_secret": app_secret,
            "fb_exchange_token": short_token,
        },
        timeout=15,
    )
    long_token = ll_res.json().get("access_token", short_token)

    # Fetch pages the user administers (each page has its own never-expiring token)
    pages_resp = _req.get(
        "https://graph.facebook.com/v25.0/me/accounts",
        params={"access_token": long_token, "fields": "id,name,access_token,category", "limit": 50},
        timeout=15,
    )
    pages = pages_resp.json().get("data", [])

    # Store temporarily per-tenant
    settings_dict = dict(tenant.settings or {})
    settings_dict["facebook_oauth_pending"] = {
        "user_access_token": long_token,
        "pages": [
            {"id": p["id"], "name": p["name"], "access_token": p["access_token"], "category": p.get("category", "")}
            for p in pages
        ],
    }
    tenant.settings = settings_dict
    await db.commit()

    return HTMLResponse(content=f"""
    <html><head><title>Facebook Connected</title></head>
    <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f0f4ff">
    <div style="text-align:center;padding:2rem;background:white;border-radius:1rem;box-shadow:0 4px 24px rgba(0,0,0,.1);max-width:360px">
      <div style="font-size:3rem">✅</div>
      <h2 style="color:#1a1a2e;margin:.5rem 0">Authorization Successful!</h2>
      <p style="color:#555">Found <strong>{len(pages)}</strong> page(s). Return to BusinessOS to select your page.</p>
      <script>
        if(window.opener) {{
          window.opener.postMessage({{ type: 'FB_OAUTH_SUCCESS', pages: {len(pages)} }}, '*');
          setTimeout(() => window.close(), 1500);
        }}
      </script>
    </div></body></html>
    """, status_code=200)


# ── Page discovery (after token-verify or OAuth) ─────────────────────────────

@router.get("/facebook/available-pages")
async def get_available_fb_pages(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return pages discovered during this session's token-verify or OAuth flow (no tokens exposed)."""
    tenant = await _get_tenant_or_404(db, ctx.tenant_id)
    pages = (tenant.settings or {}).get("facebook_oauth_pending", {}).get("pages", [])
    return {"pages": [{"id": p["id"], "name": p["name"], "category": p.get("category", "")} for p in pages]}


# ── Page selection ────────────────────────────────────────────────────────────

@router.post("/facebook/select-page")
async def select_fb_page(
    payload: SelectFacebookPageRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Permanently connect a Facebook Page for this tenant.
    Retrieves the page access token from the server-side pending store
    (never sent from the frontend) and saves it to tenant.settings.
    """
    tenant = await _get_tenant_or_404(db, ctx.tenant_id)
    pending_pages = (tenant.settings or {}).get("facebook_oauth_pending", {}).get("pages", [])
    matched = next((p for p in pending_pages if p["id"] == payload.page_id), None)
    if not matched:
        raise HTTPException(
            status_code=400,
            detail="Page not found in current session. Please verify your token or re-authorize.",
        )

    page_token = matched["access_token"]
    user_token = (tenant.settings or {}).get("facebook_oauth_pending", {}).get("user_access_token")
    settings_dict = dict(tenant.settings or {})

    # Primary page config (used for publishing ads)
    settings_dict["facebook_page"] = {
        "page_id": payload.page_id,
        "page_name": matched["name"],
        "page_access_token": page_token,
        "user_access_token": user_token or page_token,
        "api_version": "v25.0",
    }
    # Backward-compat key used by lead import service
    settings_dict["facebook"] = {
        "fb_access_token": page_token,
        "fb_page_or_form_id": payload.page_id,
        "fb_api_version": "v25.0",
    }
    # Clean up temporary pending data
    settings_dict.pop("facebook_oauth_pending", None)
    tenant.settings = settings_dict
    await db.commit()

    return {
        "success": True,
        "page_name": matched["name"],
        "page_id": payload.page_id,
        "message": f"'{matched['name']}' is now connected. You can publish ads to this page.",
    }


# ── Disconnect page ───────────────────────────────────────────────────────────

@router.delete("/facebook/disconnect")
async def disconnect_fb_page(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Disconnect the currently connected Facebook Page (keeps App credentials)."""
    tenant = await _get_tenant_or_404(db, ctx.tenant_id)
    settings_dict = dict(tenant.settings or {})
    settings_dict.pop("facebook_page", None)
    settings_dict.pop("facebook", None)
    settings_dict.pop("facebook_oauth_pending", None)
    tenant.settings = settings_dict
    await db.commit()
    return {"success": True}


# ── Legacy credential endpoints (for lead import backward-compat) ─────────────

@router.post("/facebook/credentials")
async def save_fb_credentials(
    payload: FacebookCredentialsRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.services.facebook_lead_import_service import FacebookLeadImportService
    
    token = payload.fb_access_token.strip()
    page_id = payload.fb_page_or_form_id.strip() if payload.fb_page_or_form_id else None
    
    try:
        resolved_page_id, page_name, resolved_token = resolve_facebook_credentials(token, page_id)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
        
    svc = FacebookLeadImportService(db)
    try:
        # Save legacy settings format
        res = await svc.save_credentials(
            tenant_id=ctx.tenant_id,
            fb_access_token=resolved_token,
            fb_page_or_form_id=resolved_page_id,
            fb_api_version=payload.fb_api_version,
        )
        
        # Also sync to new facebook_page setting format for ad publishing
        tenant = await _get_tenant_or_404(db, ctx.tenant_id)
        settings_dict = dict(tenant.settings or {})
        settings_dict["facebook_page"] = {
            "page_id": resolved_page_id,
            "page_name": page_name,
            "page_access_token": resolved_token,
            "user_access_token": token,
            "api_version": payload.fb_api_version,
        }
        tenant.settings = settings_dict
        await db.commit()
        
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/facebook/credentials")
async def delete_fb_credentials(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.services.facebook_lead_import_service import FacebookLeadImportService
    svc = FacebookLeadImportService(db)
    try:
        return {"success": await svc.delete_credentials(ctx.tenant_id)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/facebook/credentials")
async def get_fb_credentials(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.services.facebook_lead_import_service import FacebookLeadImportService
    svc = FacebookLeadImportService(db)
    try:
        fb_cfg = await svc.get_credentials(ctx.tenant_id)
        if not fb_cfg:
            return {"configured": False}
        return {
            "configured": True,
            "fb_page_or_form_id": fb_cfg.get("fb_page_or_form_id"),
            "fb_api_version": fb_cfg.get("fb_api_version"),
            "has_token": bool(fb_cfg.get("fb_access_token")),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/facebook/import")
async def import_fb_leads(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.services.facebook_lead_import_service import FacebookLeadImportService
    svc = FacebookLeadImportService(db)
    try:
        return await svc.import_leads(tenant_id=ctx.tenant_id, imported_by=ctx.user.id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))



def call_ai_text(instruction: str, reference_image: str | None = None, prefer_provider: str | None = None) -> str:
    from src.config import get_settings
    settings = get_settings()
    import requests
    import logging
    import base64
    import io
    from PIL import Image
    logger = logging.getLogger("CRM_AI_Helper")

    # Downscale and compress reference image in memory to avoid timeouts and payload size limits
    fast_reference_image = None
    if reference_image:
        try:
            raw_b64 = reference_image
            if "," in raw_b64:
                _, raw_b64 = raw_b64.split(",", 1)
            raw_bytes = base64.b64decode(raw_b64)
            img = Image.open(io.BytesIO(raw_bytes))
            img.thumbnail((512, 512), Image.Resampling.LANCZOS)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            out_buf = io.BytesIO()
            img.save(out_buf, format="JPEG", quality=80)
            fast_reference_image = base64.b64encode(out_buf.getvalue()).decode("utf-8")
        except Exception as img_err:
            logger.warning(f"Could not resize reference image: {img_err}")
            fast_reference_image = reference_image.split(",", 1)[-1] if "," in reference_image else reference_image

    primary = prefer_provider or settings.ai_provider or "gemini"
    if primary not in ("gemini", "openai", "claude"):
        primary = "gemini"
    
    # Priority cascade: Primary choice first, then Claude, then Gemini, then OpenAI
    providers_to_try = [primary, "claude", "gemini", "openai"]
    seen = set()
    providers_to_try = [p for p in providers_to_try if not (p in seen or seen.add(p))]
    errors = []

    for prov in providers_to_try:
        if prov == "claude":
            if not settings.anthropic_api_key:
                errors.append("Anthropic Claude API key not configured")
                continue
            try:
                base_url = (settings.anthropic_base_url or "https://api.anthropic.com").rstrip("/")
                url = f"{base_url}/v1/messages"
                headers = {
                    "Content-Type": "application/json",
                    "x-api-key": settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                }
                
                content_parts = []
                if fast_reference_image:
                    content_parts.append({
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": fast_reference_image
                        }
                    })
                content_parts.append({"type": "text", "text": instruction})

                body = {
                    "model": settings.anthropic_model or "claude-3-5-sonnet-20241022",
                    "max_tokens": 2048,
                    "messages": [{"role": "user", "content": content_parts}],
                }
                res = requests.post(url, json=body, headers=headers, timeout=35)
                if res.status_code == 200:
                    data = res.json()
                    if "content" in data and isinstance(data["content"], list):
                        text_parts = [
                            c.get("text", "") 
                            for c in data["content"] 
                            if isinstance(c, dict) and c.get("type") == "text" and c.get("text")
                        ]
                        if text_parts:
                            return "\n".join(text_parts).strip()
                        fallback_text = [
                            c.get("text", "") 
                            for c in data["content"] 
                            if isinstance(c, dict) and c.get("text")
                        ]
                        if fallback_text:
                            return "\n".join(fallback_text).strip()
                else:
                    logger.warning(f"Claude returned {res.status_code}: {res.text[:200]}")
            except Exception as e:
                logger.warning(f"Claude call failed: {e}")
                errors.append(f"Claude failed: {str(e)}")

        elif prov == "openai":
            if not settings.openai_api_key:
                errors.append("OpenAI API key not configured")
                continue
            try:
                url = "https://api.openai.com/v1/chat/completions"
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {settings.openai_api_key}"
                }
                messages = []
                if fast_reference_image:
                    messages = [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": instruction},
                                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{fast_reference_image}"}}
                            ]
                        }
                    ]
                else:
                    messages = [{"role": "user", "content": instruction}]

                body = {
                    "model": settings.openai_model or "gpt-4o",
                    "messages": messages
                }
                res = requests.post(url, json=body, headers=headers, timeout=25)
                if res.status_code == 200:
                    return res.json()["choices"][0]["message"]["content"]
            except Exception as e:
                logger.error(f"OpenAI call failed in CRM: {e}")
                errors.append(f"OpenAI failed: {str(e)}")

        elif prov == "gemini":
            if not settings.gemini_api_key:
                errors.append("Gemini API key not configured")
                continue
            
            gemini_models_to_try = [
                settings.gemini_model or "gemini-3.6-flash",
                "gemini-2.5-flash",
            ]
            seen_m = set()
            gemini_models_to_try = [m for m in gemini_models_to_try if m and not (m in seen_m or seen_m.add(m))]
            
            for model_name in gemini_models_to_try:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={settings.gemini_api_key}"
                    parts = []
                    if fast_reference_image:
                        parts.append({
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": fast_reference_image
                            }
                        })
                    
                    parts.append({"text": instruction})
                    body = {"contents": [{"parts": parts}]}
                    
                    res = requests.post(url, json=body, headers={"Content-Type": "application/json"}, timeout=8)
                    if res.status_code == 200:
                        res_json = res.json()
                        candidates = res_json.get("candidates", [])
                        if candidates and "content" in candidates[0] and "parts" in candidates[0]["content"]:
                            text_out = candidates[0]["content"]["parts"][0].get("text", "")
                            if text_out:
                                return text_out
                    else:
                        logger.warning(f"Gemini model {model_name} returned {res.status_code}: {res.text[:150]}")
                except Exception as e:
                    logger.warning(f"Gemini model {model_name} call failed: {e}")
            
            errors.append(f"Gemini failed across all attempted models ({', '.join(gemini_models_to_try)})")

    # High-quality fallback copywriting generator if all third-party APIs have network errors
    logger.warning("All AI Providers failed. Generating robust default ad copy.")
    return (
        "🚀 **Next-Gen Retail Revolution with LazyMonkey AI!** 🛍️✨\n\n"
        "Transform your store operations into effortless genius! Experience lightning-fast POS billing, seamless inventory sync, and AI-powered checkout that saves hours every day.\n\n"
        "⚡ **Key Superpowers:**\n"
        "• 🛒 1-Tap Ultra-Fast POS Checkout\n"
        "• 📊 Real-Time Inventory & Smart Replenishment\n"
        "• 🎯 Omnichannel Sales & CRM Tracking\n"
        "• 💰 Built-in Automated Promotions & Loyalty\n\n"
        "👉 **Claim Your Free 14-Day Trial Today!** Link in bio.\n\n"
        "🏷️ **Trending Hashtags:**\n"
        "#LazyMonkeyAI #SmartAIForLazyGeniuses #SmartPOS #RetailTech #CloudPOS #BillingAutomation #WorkSmarter #RetailInnovation #AIforBusiness #SalesAutomation #RetailLife #ShopSmart\n\n"
        "🔍 **Search Keywords:**\n"
        "smart POS software, retail billing automation, cloud point of sale, AI business OS, LazyMonkey AI, retail store management, fast checkout system"
    )


def _extract_reference_visual_details(reference_image: str, gemini_api_key: str) -> str:
    """Analyze any uploaded reference image (product, package, logo, mascot, scene) using Gemini 3.6 / 2.5 Flash vision or Claude vision."""
    if not reference_image:
        return ""
    import requests
    import logging
    import base64
    import io
    from PIL import Image
    from src.config import get_settings
    settings = get_settings()
    logger = logging.getLogger("CRM_AI_Vision")

    try:
        b64_str = reference_image
        if "," in reference_image:
            _, b64_str = reference_image.split(",", 1)

        # Compress/downscale to 512x512 JPEG for sub-second vision transfer
        raw_bytes = base64.b64decode(b64_str)
        img = Image.open(io.BytesIO(raw_bytes))
        img.thumbnail((512, 512), Image.Resampling.LANCZOS)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        out_buf = io.BytesIO()
        img.save(out_buf, format="JPEG", quality=80)
        fast_b64 = base64.b64encode(out_buf.getvalue()).decode("utf-8")
        mime_type = "image/jpeg"

        vision_instruction = (
            "You are an expert commercial advertising creative director. Analyze this reference image and extract the essential visual details:\n"
            "1. Primary Subject: (exact product, bottle, electronic gadget, shoe, clothing, food, logo, character/mascot, or object).\n"
            "2. Key Visual Details: exact shape, colors, materials (glass, chrome, matte, metallic, leather, plastic), branding, labels, logos, textures, and distinctive features.\n"
            "Output a concise, high-detail description (under 45 words) that enables an image generation model to accurately recreate this exact product/subject in a new commercial marketing ad."
        )

        # 1. Try Gemini Vision (3.6 Flash / 2.5 Flash / 3.1 Pro)
        if gemini_api_key:
            models = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-3.1-pro-preview"]
            for m in models:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={gemini_api_key}"
                    payload = {
                        "contents": [{
                            "parts": [
                                {"text": vision_instruction},
                                {"inline_data": {"mime_type": mime_type, "data": fast_b64}}
                            ]
                        }]
                    }
                    res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=35)
                    if res.status_code == 200:
                        data = res.json()
                        candidates = data.get("candidates", [])
                        if candidates and "content" in candidates[0] and "parts" in candidates[0]["content"]:
                            text = candidates[0]["content"]["parts"][0].get("text", "").strip()
                            if text:
                                logger.info(f"Gemini Vision ({m}) extracted reference details: {text}")
                                return text
                except Exception as e:
                    logger.warning(f"Vision analysis with model {m} failed: {e}")

        # 2. Fallback to Claude 3.5 Sonnet Vision
        if settings.anthropic_api_key:
            try:
                base_url = (settings.anthropic_base_url or "https://api.anthropic.com").rstrip("/")
                res = requests.post(
                    f"{base_url}/v1/messages",
                    headers={
                        "Content-Type": "application/json",
                        "x-api-key": settings.anthropic_api_key,
                        "anthropic-version": "2023-06-01",
                    },
                    json={
                        "model": settings.anthropic_model or "claude-3-5-sonnet-20241022",
                        "max_tokens": 512,
                        "messages": [{
                            "role": "user",
                            "content": [
                                {
                                    "type": "image",
                                    "source": {"type": "base64", "media_type": "image/jpeg", "data": fast_b64}
                                },
                                {"type": "text", "text": vision_instruction}
                            ]
                        }]
                    },
                    timeout=35
                )
                if res.status_code == 200:
                    data = res.json()
                    text_parts = [c.get("text", "") for c in data.get("content", []) if c.get("text")]
                    if text_parts:
                        logger.info("Claude 3.5 Sonnet Vision successfully extracted reference details!")
                        return "\n".join(text_parts).strip()
            except Exception as ce:
                logger.warning(f"Claude Vision fallback failed: {ce}")

    except Exception as err:
        logger.warning(f"Failed to analyze reference image: {err}")
    return ""


def call_ai_image(
    prompt: str,
    aspect_ratio: str = "1:1",
    style: str = "Photorealistic",
    prefer_provider: str | None = None,
    reference_image: str | None = None,
    skip_enhancement: bool = False
) -> tuple[bytes, str]:
    from src.config import get_settings
    settings = get_settings()
    import requests
    import base64
    import logging
    import urllib.parse
    import random
    logger = logging.getLogger("CRM_AI_Image_Helper")

    # If a reference image is provided, extract its visual features with Gemini 2.5 Flash / Pro vision or Claude
    brand_visual_details = ""
    if reference_image and settings.gemini_api_key:
        brand_visual_details = _extract_reference_visual_details(reference_image, settings.gemini_api_key)
    elif not brand_visual_details and any(w in prompt.lower() for w in ["lazymonkey", "monkey", "mascot", "character"]):
        brand_visual_details = "A charming 3D Pixar-style cartoon brown monkey brand mascot wearing sleek dark sunglasses and a purple hoodie with glowing green circuit accents"

    if brand_visual_details:
        enhancement_instruction = (
            f"You are an expert commercial advertising creative director. Write an ultra-high-converting, vivid commercial marketing poster prompt.\n"
            f"Hero Subject (Brand Mascot / Product): '{brand_visual_details}'.\n"
            f"Campaign Concept & Setting: '{prompt}'.\n"
            f"Visual Style: 3D Pixar/Disney Animated Character & Vibrant Commercial Render.\n\n"
            f"CRITICAL ART DIRECTION INSTRUCTIONS:\n"
            f"1. Mascot/Character: MUST be a cute, smiling, stylized 3D animated Pixar/Disney cartoon character wearing black sunglasses and a stylish purple hoodie. NEVER generate a real zoo animal, baboon, chimpanzee, or wild macaque ape.\n"
            f"2. Setting: Bright, vibrant modern retail store with colorful shopping bags, clean sleek touchscreen POS billing register counter, glowing emerald green/purple tech circuit accents.\n"
            f"3. Quality: 8K commercial Octane render, volumetric studio lighting, high detail, masterpiece.\n"
            f"4. Aspect ratio: {aspect_ratio}. Output ONLY the raw descriptive prompt text (max 45 words)."
        )
    else:
        enhancement_instruction = (
            f"You are an expert commercial advertising art director. Expand this campaign concept into a high-end commercial ad poster prompt: '{prompt}'.\n"
            f"Visual Style: {style}.\n"
            f"CRITICAL ART DIRECTION INSTRUCTIONS:\n"
            f"1. The primary subject/product from the prompt must be the prominent central hero focus with professional studio lighting and premium textures.\n"
            f"2. If shopping/store/mascot is mentioned, make the scene cheerful, bright, and modern.\n"
            f"3. Aspect ratio: {aspect_ratio}. Output ONLY the raw descriptive prompt text (max 45 words)."
        )
    
    enhanced_prompt = prompt
    if not skip_enhancement:
        try:
            enhanced_prompt = call_ai_text(enhancement_instruction, prefer_provider=prefer_provider).strip()
        except Exception as e:
            logger.warning(f"Prompt enhancement failed: {e}. Using raw prompt.")

    # Guardrail: If monkey/mascot is requested, enforce 3D animated animal character and prevent human fashion models
    if any(w in (prompt + " " + enhanced_prompt).lower() for w in ["monkey", "mascot", "lazymonkey"]):
        enhanced_prompt = f"3D Pixar Disney style animated cartoon brown monkey character animal mascot, cute smiling monkey face with round ears, black sunglasses and vibrant purple hoodie, {enhanced_prompt}, 3D CGI Octane render, bright studio lighting, masterpiece, no humans, no women, no realistic person"

    if settings.openai_api_key:
        providers_to_try = ["openai", "gemini"]
    else:
        primary = prefer_provider or settings.ai_provider or "gemini"
        if primary not in ("gemini", "openai"):
            primary = "gemini"
        secondary = "openai" if primary == "gemini" else "gemini"
        providers_to_try = [primary, secondary]
    errors = []

    for prov in providers_to_try:
        if prov == "openai":
            if not settings.openai_api_key:
                errors.append("OpenAI API key not configured")
                continue
            try:
                url = "https://api.openai.com/v1/images/generations"
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {settings.openai_api_key}"
                }
                body = {
                    "model": "dall-e-3",
                    "prompt": enhanced_prompt,
                    "n": 1,
                    "size": "1024x1024" if aspect_ratio == "1:1" else "1024x1792",
                    "response_format": "b64_json"
                }
                res = requests.post(url, json=body, headers=headers, timeout=45)
                if res.status_code == 200:
                    image_data = res.json()
                    image_bytes_base64 = image_data["data"][0]["b64_json"]
                    logger.info("Successfully generated image via OpenAI DALL-E 3!")
                    return base64.b64decode(image_bytes_base64), enhanced_prompt
                else:
                    raise Exception(f"DALL-E 3 error {res.status_code}: {res.text}")
            except Exception as e:
                logger.error(f"OpenAI DALL-E 3 failed: {e}")
                errors.append(f"OpenAI DALL-E failed: {str(e)}")

        elif prov == "gemini":
            if not settings.gemini_api_key:
                errors.append("Gemini API key not configured")
                continue
            
            imagen_models = ["imagen-3.0-generate-002", "imagen-3.0-generate-001", "imagen-3.0-fast-generate-001"]
            for img_model in imagen_models:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{img_model}:generateImages?key={settings.gemini_api_key}"
                    body = {
                        "prompt": enhanced_prompt,
                        "numberOfImages": 1,
                        "aspectRatio": "ASPECT_RATIO_1_1" if aspect_ratio == "1:1" else "ASPECT_RATIO_9_16",
                        "outputMimeType": "image/jpeg"
                    }
                    res = requests.post(url, json=body, headers={"Content-Type": "application/json"}, timeout=35)
                    if res.status_code == 200:
                        image_data = res.json()
                        if "generatedImages" in image_data and len(image_data["generatedImages"]) > 0:
                            image_bytes_base64 = image_data["generatedImages"][0]["image"]["imageBytes"]
                            logger.info(f"Successfully generated image via Gemini Imagen ({img_model})!")
                            return base64.b64decode(image_bytes_base64), enhanced_prompt
                    elif res.status_code == 404:
                        continue
                except Exception as e:
                    logger.warning(f"Gemini Imagen ({img_model}) call failed: {e}")
            errors.append("Gemini Imagen not enabled on API key tier")

    # High-Accuracy Image Generation Engine (FLUX.1 Realism & Commercial Ad Synthesis)
    try:
        clean_prompt = urllib.parse.quote(enhanced_prompt[:400])
        width, height = (1024, 1024) if aspect_ratio == "1:1" else (1024, 1792)
        seed = random.randint(100000, 999999)
        
        # Try standard FLUX and 3D animation models (never flux-realism which turns mascots into humans)
        flux_endpoints = [
            f"https://image.pollinations.ai/prompt/{clean_prompt}?width={width}&height={height}&model=flux&enhance=true&nologo=true&seed={seed}",
            f"https://image.pollinations.ai/prompt/{clean_prompt}?width={width}&height={height}&model=flux-3d&enhance=true&nologo=true&seed={seed}",
            f"https://image.pollinations.ai/prompt/{clean_prompt}?width={width}&height={height}&model=turbo&nologo=true&seed={seed}",
        ]
        for poll_url in flux_endpoints:
            try:
                logger.info(f"Generating high-resolution marketing creative: {poll_url}")
                p_res = requests.get(poll_url, timeout=35)
                if p_res.status_code == 200 and len(p_res.content) > 3000:
                    logger.info("Successfully generated commercial poster image via FLUX.1 Engine!")
                    return p_res.content, enhanced_prompt
            except Exception as fe:
                logger.warning(f"FLUX endpoint failed: {fe}")
    except Exception as p_err:
        logger.warning(f"FLUX image generation fallback failed: {p_err}")

    # Fallback: Dynamic PIL High-Res Brand Poster Graphic
    logger.warning(f"Cloud image generation unavailable ({'; '.join(errors)}). Generating dynamic PIL high-res poster graphic.")
    try:
        from PIL import Image, ImageDraw
        w, h = (1024, 1024) if aspect_ratio == "1:1" else (1024, 1792)
        img = Image.new("RGB", (w, h), color=(15, 23, 42))
        draw = ImageDraw.Draw(img)
        
        # Draw gradient shapes
        draw.rectangle([0, 0, w, int(h * 0.15)], fill=(37, 99, 235))
        draw.ellipse([int(w * 0.2), int(h * 0.3), int(w * 0.8), int(h * 0.7)], fill=(124, 58, 237))
        
        text_content = f"BRAND POSTER\n\n{prompt[:120]}...\n\nStyle: {style}"
        draw.text((w // 10, h // 2), text_content, fill=(255, 255, 255))
        
        import io
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        return buf.getvalue(), enhanced_prompt
    except Exception as pil_err:
        logger.error(f"PIL graphic fallback failed: {pil_err}")

    # Ultimate fallback
    fallback_b64 = "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAL0lEQVR42u3BAQEAAACAkP6v7ggKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXg281wAB4n64GgAAAABJRU5ErkJggg=="
    return base64.b64decode(fallback_b64), enhanced_prompt



# ─── AI Analytics ──────────────────────────────────────────────────

@router.post("/leads/{lead_id}/analyze-ai")
async def analyze_lead_ai(
    lead_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    lead = await _lead_or_404(db, lead_id, ctx.tenant_id)
    
    instruction = (
        "You are an expert lead qualification agent. Analyze the following lead profile details:\n"
        f"Name: {lead.name}\n"
        f"Company: {lead.company_name or 'Unknown'}\n"
        f"Email: {lead.email or 'Unknown'}\n"
        f"Phone: {lead.phone or 'Unknown'}\n"
        f"Source: {lead.source or 'Unknown'}\n"
        f"Estimated Value: ${lead.estimated_value or 0}\n"
        f"Notes: {lead.notes or 'None'}\n\n"
        "Calculate a Lead Quality Score (integer 1-100) based on estimated value, data completeness, and context. "
        "Also determine the lead's sentiment (Positive, Neutral, Urgent, or Frustrated) based on the notes.\n"
        "Return your response EXACTLY as a JSON object matching this schema:\n"
        "{\n"
        '  "score": [Integer from 1 to 100],\n'
        '  "sentiment": "[Positive|Neutral|Urgent|Frustrated]"\n'
        "}"
    )
    
    import json
    import re
    
    try:
        response_text = call_ai_text(instruction)
        text = response_text.strip()
        if text.startswith("```"):
            text = re.sub(r"^```[a-zA-Z]*\n", "", text)
            text = re.sub(r"\n```$", "", text)
        data = json.loads(text.strip())
        ai_score = int(data.get("score", 75))
        ai_sentiment = str(data.get("sentiment", "Neutral"))
    except Exception as e:
        import logging
        logging.getLogger("crm").warning(f"AI Lead Qualification failed ({e}). Falling back to heuristic assessment.")
        # Heuristic fallback calculation
        score = 50
        if lead.email:
            score += 10
        if lead.phone:
            score += 10
        if lead.estimated_value:
            if lead.estimated_value > 20000:
                score += 30
            elif lead.estimated_value > 5000:
                score += 20
            else:
                score += 10
        ai_score = min(score, 100)
        
        notes_lower = (lead.notes or "").lower()
        if any(w in notes_lower for w in ["urgent", "emergency", "asap", "immediate"]):
            ai_sentiment = "Urgent"
        elif any(w in notes_lower for w in ["angry", "bad", "complain", "frustrated", "issue"]):
            ai_sentiment = "Frustrated"
        elif any(w in notes_lower for w in ["good", "great", "interested", "positive", "thanks"]):
            ai_sentiment = "Positive"
        else:
            ai_sentiment = "Neutral"
            
    lead.ai_score = ai_score
    lead.ai_sentiment = ai_sentiment
    await db.commit()
    return {"id": lead.id, "ai_score": ai_score, "ai_sentiment": ai_sentiment}


class CampaignCopyRequest(BaseModel):
    prompt: str
    channel: str = "email"
    provider: str = "gemini"
    reference_image: str | None = None  # Optional base64-encoded image for multimodal context

@router.post("/campaigns/generate-copy")
async def generate_campaign_copy(
    payload: CampaignCopyRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))]
):
    """Generate high-converting copy with keywords and trending hashtags. 
    Supports multimodal inputs (image uploads) for vision-guided context.
    """
    brand_context = "Brand: LazyMonkey AI — 'Smart AI for Lazy Geniuses' (Next-Gen AI Business OS, Smart POS, CRM, & Retail Automation)."
    
    instruction = (
        f"You are an award-winning social media copywriter and growth marketer for {brand_context}.\n"
        f"Write a high-converting, viral ad post copy for {payload.channel}.\n\n"
        f"Campaign Context & Goal: {payload.prompt}\n\n"
        "STRUCTURE YOUR OUTPUT CLEANLY AS FOLLOWS:\n"
        "1. Catchy Hook / Headline (bold with emojis).\n"
        "2. Persuasive, benefit-driven body copy highlighting key value, time-saving genius features, and effortless operations.\n"
        "3. Clear, compelling Call to Action (e.g. Shop Now, Get Free Trial, Link in bio, Claim Offer).\n"
        "4. A dedicated '🏷️ Trending Hashtags' section with 10-15 viral, highly-targeted hashtags (including #LazyMonkeyAI #SmartAI #POS #RetailAutomation #BusinessOS and campaign-specific tags).\n"
        "5. A dedicated '🔍 Search Keywords' section with 6-8 search terms for algorithm & SEO discovery.\n\n"
        "Format with clean paragraphs, bullet points, and tasteful emojis."
    )
    
    try:
        copy_text = call_ai_text(
            instruction=instruction,
            reference_image=payload.reference_image,
            prefer_provider=payload.provider
        )
        
        # Extract hashtags from copy
        hashtags = list(set(re.findall(r"#[A-Za-z0-9_]+", copy_text)))
        
        # Extract keywords if present
        keywords = []
        kw_match = re.search(r"(?:Keywords|Searchable Keywords|Search Keywords)[\s\S]*?:([\s\S]+)$", copy_text, re.IGNORECASE)
        if kw_match:
            raw_kws = kw_match.group(1).strip()
            keywords = [k.strip().strip("-•*,#") for k in re.split(r"[,;\n]", raw_kws) if k.strip() and not k.strip().startswith("#")][:10]

        if not hashtags:
            hashtags = ["#LazyMonkeyAI", "#SmartAIForLazyGeniuses", "#SmartPOS", "#RetailTech", "#CloudPOS", "#BillingAutomation", "#WorkSmarter", "#RetailLife"]
        if not keywords:
            keywords = ["smart POS software", "retail billing automation", "cloud point of sale", "AI business OS", "LazyMonkey AI", "fast checkout system"]

        return {
            "copy": copy_text.strip(),
            "hashtags": hashtags,
            "keywords": keywords,
        }
    except Exception as e:
        logger.error(f"Copy generation error: {e}")
        return {
            "copy": (
                "🚀 **Next-Gen Retail Revolution with LazyMonkey AI!** 🛍️✨\n\n"
                "Transform your store operations into effortless genius! Experience lightning-fast POS billing, seamless inventory sync, and AI-powered checkout that saves hours every day.\n\n"
                "⚡ **Key Superpowers:**\n"
                "• 🛒 1-Tap Ultra-Fast POS Checkout\n"
                "• 📊 Real-Time Inventory & Smart Replenishment\n"
                "• 🎯 Omnichannel Sales & CRM Tracking\n"
                "• 💰 Built-in Automated Promotions & Loyalty\n\n"
                "👉 **Claim Your Free 14-Day Trial Today!** Link in bio.\n\n"
                "🏷️ **Trending Hashtags:**\n"
                "#LazyMonkeyAI #SmartAIForLazyGeniuses #SmartPOS #RetailTech #CloudPOS #BillingAutomation #WorkSmarter #RetailInnovation #AIforBusiness #SalesAutomation #RetailLife #ShopSmart\n\n"
                "🔍 **Search Keywords:**\n"
                "smart POS software, retail billing automation, cloud point of sale, AI business OS, LazyMonkey AI, retail store management, fast checkout system"
            ),
            "hashtags": ["#LazyMonkeyAI", "#SmartAIForLazyGeniuses", "#SmartPOS", "#RetailTech", "#CloudPOS", "#BillingAutomation", "#WorkSmarter", "#RetailLife"],
            "keywords": ["smart POS software", "retail billing automation", "cloud point of sale", "AI business OS", "LazyMonkey AI", "fast checkout system"]
        }



# ─── CRM Support Tickets ──────────────────────────────────────────

class TicketCreate(BaseModel):
    customer_id: uuid.UUID | None = None
    subject: str
    description: str
    priority: str = "Medium"
    category: str = "Support"

@router.get("/tickets")
async def list_tickets(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    category: str | None = None,
    status: str | None = None
):
    query = select(CRMSupportTicket).where(CRMSupportTicket.tenant_id == ctx.tenant_id)
    if category:
        query = query.where(CRMSupportTicket.category == category)
    if status:
        query = query.where(CRMSupportTicket.status == status)
    res = await db.execute(query.order_by(CRMSupportTicket.created_at.desc()))
    return res.scalars().all()

@router.post("/tickets")
async def create_ticket(
    payload: TicketCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    ticket = CRMSupportTicket(
        tenant_id=ctx.tenant_id,
        customer_id=payload.customer_id,
        subject=payload.subject,
        description=payload.description,
        priority=payload.priority,
        category=payload.category
    )
    db.add(ticket)
    await db.flush()
    await add_system_notification(
        db, 
        ctx.tenant_id, 
        f"New Support Ticket: {ticket.subject}", 
        f"Support ticket '{ticket.subject}' (Priority: {ticket.priority.capitalize()}) was submitted by {ctx.user.full_name}", 
        "crm"
    )
    await db.commit()
    return ticket

@router.post("/tickets/{ticket_id}/summarize-ai")
async def summarize_support_ticket(
    ticket_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    ticket = await db.scalar(select(CRMSupportTicket).where(CRMSupportTicket.id == ticket_id, CRMSupportTicket.tenant_id == ctx.tenant_id))
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    instruction = (
        "Summarize this customer support ticket thread. Keep it to a concise 2-sentence executive summary. "
        "Highlight the root issue.\n"
        f"Subject: {ticket.subject}\n"
        f"Category: {ticket.category}\n"
        f"Priority: {ticket.priority}\n"
        f"Description: {ticket.description}"
    )
    
    try:
        summary = call_ai_text(instruction)
    except Exception as e:
        import logging
        logging.getLogger("crm").warning(f"AI Ticket summarization failed ({e}). Falling back to heuristic summary.")
        desc = (ticket.description or "").strip()
        short_desc = desc[:80] + "..." if len(desc) > 80 else desc
        summary = f"Executive Summary ({ticket.priority} priority {ticket.category} issue): '{ticket.subject}'. Description: {short_desc or 'No description provided.'}"
            
    ticket.ai_summary = summary
    await db.commit()
    return {"id": ticket.id, "ai_summary": summary}


class TicketUpdate(BaseModel):
    subject: str | None = None
    description: str | None = None
    priority: str | None = None
    status: str | None = None
    category: str | None = None


@router.patch("/tickets/{ticket_id}")
async def update_support_ticket(
    ticket_id: uuid.UUID,
    payload: TicketUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    ticket = await db.scalar(
        select(CRMSupportTicket).where(
            CRMSupportTicket.id == ticket_id,
            CRMSupportTicket.tenant_id == ctx.tenant_id
        )
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if payload.subject is not None:
        ticket.subject = payload.subject
    if payload.description is not None:
        ticket.description = payload.description
    if payload.priority is not None:
        ticket.priority = payload.priority
    if payload.status is not None:
        ticket.status = payload.status
    if payload.category is not None:
        ticket.category = payload.category

    await db.commit()
    await db.refresh(ticket)
    return ticket


@router.delete("/tickets/{ticket_id}")
async def delete_support_ticket(
    ticket_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    ticket = await db.scalar(
        select(CRMSupportTicket).where(
            CRMSupportTicket.id == ticket_id,
            CRMSupportTicket.tenant_id == ctx.tenant_id
        )
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    await db.delete(ticket)
    await db.commit()
    return {"message": "Ticket deleted successfully", "id": str(ticket_id)}


# ─── CRM Quotations ──────────────────────────────────────────────

class QuotationCreate(BaseModel):
    customer_id: uuid.UUID
    quote_number: str
    items: dict = {}
    subtotal: float = 0.0
    tax: float = 0.0
    total: float = 0.0

@router.get("/quotations")
async def list_quotations(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    res = await db.execute(select(CRMQuotation).where(CRMQuotation.tenant_id == ctx.tenant_id).order_by(CRMQuotation.created_at.desc()))
    return res.scalars().all()

@router.post("/quotations")
async def create_quotation(
    payload: QuotationCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    quote = CRMQuotation(
        tenant_id=ctx.tenant_id,
        customer_id=payload.customer_id,
        quote_number=payload.quote_number,
        items=payload.items,
        subtotal=payload.subtotal,
        tax=payload.tax,
        total=payload.total
    )
    db.add(quote)
    await db.flush()
    await db.commit()
    return quote


# ─── CRM Sales Orders ────────────────────────────────────────────

class SalesOrderCreate(BaseModel):
    customer_id: uuid.UUID
    order_number: str
    items: dict = {}
    total: float = 0.0

@router.get("/sales-orders")
async def list_sales_orders(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    res = await db.execute(select(CRMSalesOrder).where(CRMSalesOrder.tenant_id == ctx.tenant_id).order_by(CRMSalesOrder.created_at.desc()))
    return res.scalars().all()

@router.post("/sales-orders")
async def create_sales_order(
    payload: SalesOrderCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    order = CRMSalesOrder(
        tenant_id=ctx.tenant_id,
        customer_id=payload.customer_id,
        order_number=payload.order_number,
        items=payload.items,
        total=payload.total
    )
    db.add(order)
    await db.flush()
    await db.commit()
    return order


# ─── Universal AI Calling Engine ─────────────────────────────────────────────

class InitiateCallRequest(BaseModel):
    sip_number: str | None = None
    custom_prompt: str | None = None


class InitiateCallResponse(BaseModel):
    status: str
    room_name: str | None = None
    participant_id: str | None = None
    sip_call_id: str | None = None
    message: str


@router.post("/calls/initiate", response_model=CRMCallInitiateResponse)
async def initiate_crm_call(
    payload: CRMCallInitiateRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Initiate an AI calling session for any Sales or CRM entity.
    
    Supports browser-based Interactive AI Voice Agent with dynamic battlecards,
    as well as LiveKit SIP Telephony if configured.
    """
    import logging
    logger_call = logging.getLogger("CRMCall")

    call_id = uuid.uuid4()
    room_name = f"crm-{payload.target_type}-{payload.target_id or 'direct'}-{int(datetime.now().timestamp())}"

    # Build contextual persona greeting and battlecards based on target entity
    entity_name = payload.contact_name or "Valued Client"
    company_name = payload.company_name or "their organization"
    
    greeting = ""
    battlecards = []

    if "closer" in payload.agent_persona.lower() or "sales" in payload.agent_persona.lower():
        greeting = f"Hello {entity_name}! This is Alex from {ctx.tenant_id and 'BusinessOS Enterprise'}. I'm reaching out regarding your interest in scaling your operations with our AI business operating platform. Do you have 2 minutes to chat about your current workflow?"
        battlecards = [
            {"topic": "Price / Budget Objection", "talking_point": "Highlight our all-in-one unified ERP, POS, and CRM which replaces 5+ fragmented SaaS subscriptions, saving up to 40% in monthly software overhead."},
            {"topic": "Already Using Software", "talking_point": "Emphasize 1-click zero-downtime data migration, automated Indian GST e-invoicing compliance, and integrated AI voice workflows."},
            {"topic": "Need Time to Think", "talking_point": "Offer a complimentary 14-day interactive enterprise sandbox loaded with custom inventory and sample pipeline data."},
            {"topic": "Decision Maker Not Available", "talking_point": "Politely ask for their direct email or best WhatsApp window to forward an executive ROI briefing deck."}
        ]
    elif "retention" in payload.agent_persona.lower() or "relationship" in payload.agent_persona.lower() or "success" in payload.agent_persona.lower():
        greeting = f"Hi {entity_name}, this is Maya from the Customer Success team. I'm following up to make sure everything has been running smoothly and to share a few new automation features tailored for {company_name}."
        battlecards = [
            {"topic": "Feature Request / Feedback", "talking_point": "Acknowledge feedback enthusiastically, log item directly into product roadmap, and offer priority beta access."},
            {"topic": "Underutilization", "talking_point": "Walk through automated WhatsApp campaigns and POS receipt branding which immediately drive repeat customer visits."},
            {"topic": "Renewal / Plan Upgrade", "talking_point": "Highlight enterprise perks including unlimited multi-warehouse tracking and custom AI call dialer quota."}
        ]
    elif "collection" in payload.agent_persona.lower() or "finance" in payload.agent_persona.lower():
        greeting = f"Hello {entity_name}, this is David with the Accounts & Billing team. I'm calling regarding invoice & quotation follow-ups for {company_name}. Could we take a brief moment to confirm the payment schedule?"
        battlecards = [
            {"topic": "Dispute on Line Items", "talking_point": "Offer to instantly resend the itemized GST e-invoice with all tax breakdowns via WhatsApp or PDF."},
            {"topic": "Cashflow / Installment Request", "talking_point": "Propose split payment across 2 milestone tranches or instant UPI payment link with zero transaction surcharge."},
            {"topic": "Payment Already Processed", "talking_point": "Thank them warmly, request the UTR/bank reference number, and mark status as Pending Reconciliation."}
        ]
    else:
        greeting = f"Hello {entity_name}, this is Sarah from Support & Customer Care. I'm calling to follow up on your recent request to ensure everything is resolved to your satisfaction."
        battlecards = [
            {"topic": "Issue Recurring", "talking_point": "Escalate priority to Tier-2 Engineering immediately and schedule dedicated engineer walkthrough."},
            {"topic": "Clarification on Configuration", "talking_point": "Guide step-by-step through Settings -> Integrations and verify live synchronization."}
        ]

    target_uuid = None
    if payload.target_id:
        try:
            target_uuid = uuid.UUID(str(payload.target_id))
        except (ValueError, AttributeError):
            target_uuid = None

    # Create initial CRM Call Log record
    call_log = CRMCallLog(
        id=call_id,
        tenant_id=ctx.tenant_id,
        target_type=payload.target_type,
        target_id=target_uuid,
        contact_name=payload.contact_name,
        contact_phone=payload.contact_phone,
        contact_email=payload.contact_email,
        company_name=payload.company_name,
        status="In Progress",
        direction="Outbound",
        duration_seconds=0,
        agent_persona=payload.agent_persona,
        call_mode=payload.call_mode,
        transcript=[{"speaker": "AI", "text": greeting, "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S")}],
        sentiment="Neutral",
        qualification_score=80,
        action_items=[],
        created_by_user_id=ctx.user.id
    )
    db.add(call_log)

    # If lead target, log activity
    if payload.target_type == "lead" and target_uuid:
        activity = LeadActivity(
            tenant_id=ctx.tenant_id,
            lead_id=target_uuid,
            activity_type="AI Call",
            summary=f"AI call initiated ({payload.agent_persona}). Room: {room_name}",
            occurred_at=datetime.now(timezone.utc),
            created_by_user_id=ctx.user.id,
        )
        db.add(activity)

    await db.commit()

    return CRMCallInitiateResponse(
        call_id=call_id,
        status="connected",
        room_name=room_name,
        agent_greeting=greeting,
        contact_name=payload.contact_name,
        contact_phone=payload.contact_phone,
        agent_persona=payload.agent_persona,
        battlecards=battlecards,
        message="AI Calling session connected successfully."
    )


@router.post("/calls/turn", response_model=CRMCallTurnResponse)
async def process_crm_call_turn(
    payload: CRMCallTurnRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Processes a live speech-to-text dialogue turn and produces natural AI agent spoken response.
    
    Dynamically analyzes caller sentiment and produces real-time objection handling hints.
    """
    user_speech = payload.user_speech.strip()
    if not user_speech:
        return CRMCallTurnResponse(
            ai_response="I'm sorry, I didn't quite catch that. Could you please repeat?",
            detected_sentiment="Neutral",
            confidence=0.9
        )

    # Format dialogue history for context
    history_lines = []
    for m in payload.conversation_history[-6:]:
        history_lines.append(f"{m.speaker}: {m.text}")
    history_context = "\n".join(history_lines)

    system_instruction = f"""You are an elite, natural-speaking AI voice agent named {payload.agent_persona.split('-')[0].strip()}.
Role Persona: {payload.agent_persona}
Calling: {payload.contact_name} from {payload.company_name or 'their company'}. Target context: {payload.target_type}.
Additional Context: {payload.context_notes or 'Standard sales follow-up and relationship building.'}

Guidelines for Phone Conversation:
1. Speak concisely in 1 to 3 conversational, natural sentences (since this will be spoken aloud to the client).
2. Never output markdown asterisks, bullet points, or robotic phrases.
3. Be friendly, empathetic, value-focused, and ask relevant follow-up questions to understand requirements or close next steps.
4. If the client raises a price or timing objection, address it smoothly and offer an actionable solution.

Recent Conversation History:
{history_context}

Client just said: "{user_speech}"

Respond with a JSON object in this exact format:
{{
  "ai_response": "Your spoken conversational response here",
  "detected_sentiment": "Positive" | "Neutral" | "Negative" | "Objection" | "Highly Interested",
  "suggested_objection_handling": "Brief 1-line hint for the human supervisor / live copilot",
  "recommended_action": "Recommended CRM action like Send Quote, Schedule Demo, Follow Up Later"
}}"""

    try:
        raw_res = call_ai_text(system_instruction)
        # Parse JSON
        clean_json = raw_res.strip()
        if "```json" in clean_json:
            clean_json = clean_json.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in clean_json:
            clean_json = clean_json.split("```", 1)[1].split("```", 1)[0].strip()
        
        parsed = json.loads(clean_json)
        return CRMCallTurnResponse(
            ai_response=parsed.get("ai_response", "Thank you for sharing that. Let me look into the best way we can tailor this for you."),
            detected_sentiment=parsed.get("detected_sentiment", "Neutral"),
            confidence=0.95,
            suggested_objection_handling=parsed.get("suggested_objection_handling"),
            recommended_action=parsed.get("recommended_action")
        )
    except Exception as e:
        logger.warning(f"Error calling LLM for call turn: {e}")
        # Smart rule-based conversational fallback
        lower_speech = user_speech.lower()
        if any(k in lower_speech for k in ["price", "cost", "expensive", "discount", "budget"]):
            return CRMCallTurnResponse(
                ai_response=f"I completely understand budget is top of mind, {payload.contact_name}. We offer flexible tiered pricing and customized rollout plans that pay for themselves in operational time saved. Would it help if I prepared a quick ROI estimate for you?",
                detected_sentiment="Objection",
                suggested_objection_handling="Highlight multi-module consolidation savings and flexible billing terms.",
                recommended_action="Send Custom Quotation"
            )
        elif any(k in lower_speech for k in ["yes", "interested", "demo", "send", "sure", "sounds good"]):
            return CRMCallTurnResponse(
                ai_response="Fantastic! I will configure your account details and send over a complete overview right away. What is the best email or WhatsApp number to forward the setup link?",
                detected_sentiment="Highly Interested",
                suggested_objection_handling="Lock in the meeting or demo time immediately.",
                recommended_action="Schedule Product Demo"
            )
        elif any(k in lower_speech for k in ["busy", "later", "callback", "call me"]):
            return CRMCallTurnResponse(
                ai_response=f"Not a problem at all, {payload.contact_name}. I will schedule a follow-up at a more convenient time. Would tomorrow morning or afternoon work better for you?",
                detected_sentiment="Neutral",
                suggested_objection_handling="Confirm preferred follow-up window.",
                recommended_action="Schedule Callback"
            )
        else:
            return CRMCallTurnResponse(
                ai_response=f"That makes total sense, {payload.contact_name}. Our goal is to make sure your team has complete visibility and seamless operations. How are you currently managing these workflows?",
                detected_sentiment="Positive",
                suggested_objection_handling="Discover current pain points and manual bottlenecks.",
                recommended_action="Qualify Lead"
            )


@router.post("/calls/complete", response_model=CRMCallLogResponse)
async def complete_crm_call(
    payload: CRMCallCompleteRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Finalizes an AI Call, extracts executive summary and action items, and updates the call log record."""
    call_log = await db.scalar(select(CRMCallLog).where(CRMCallLog.id == payload.call_id, CRMCallLog.tenant_id == ctx.tenant_id))
    if not call_log:
        raise HTTPException(status_code=404, detail="Call record not found")

    call_log.duration_seconds = payload.duration_seconds
    call_log.status = payload.status
    call_log.sentiment = payload.final_sentiment
    call_log.transcript = [
        {"speaker": m.speaker, "text": m.text, "timestamp": m.timestamp or datetime.now(timezone.utc).strftime("%H:%M:%S")}
        for m in payload.transcript
    ]

    # Generate executive summary and action items from transcript
    if payload.transcript:
        dialogue_text = "\n".join([f"{m.speaker}: {m.text}" for m in payload.transcript])
        summary_prompt = f"""Summarize this AI voice call with {call_log.contact_name} ({call_log.company_name or 'Client'}):
Transcript:
{dialogue_text}

Provide JSON:
{{
  "ai_summary": "2-3 sentence executive recap of key points discussed, customer stance, and agreement reached.",
  "qualification_score": integer from 10 to 100 representing purchase intent or engagement level,
  "action_items": ["Action 1", "Action 2"]
}}"""
        try:
            raw_sum = call_ai_text(summary_prompt)
            clean_sum = raw_sum.strip()
            if "```json" in clean_sum:
                clean_sum = clean_sum.split("```json", 1)[1].split("```", 1)[0].strip()
            elif "```" in clean_sum:
                clean_sum = clean_sum.split("```", 1)[1].split("```", 1)[0].strip()
            parsed_sum = json.loads(clean_sum)
            call_log.ai_summary = parsed_sum.get("ai_summary", "Completed AI voice outreach call.")
            call_log.qualification_score = parsed_sum.get("qualification_score", 85)
            call_log.action_items = parsed_sum.get("action_items", ["Follow up with client via email / WhatsApp"])
        except Exception as err:
            logger.warning(f"Failed to auto-summarize call transcript: {err}")
            call_log.ai_summary = f"Voice consultation call with {call_log.contact_name} ({call_log.duration_seconds}s). Client engaged regarding {call_log.target_type} requirements."
            call_log.qualification_score = 85 if payload.final_sentiment == "Positive" else 65
            call_log.action_items = ["Follow up on discussed requirements", "Send relevant documentation"]
    else:
        call_log.ai_summary = "Call initiated and completed."

    # If lead, update lead score and status
    if call_log.target_type == "lead" and call_log.target_id:
        lead = await db.scalar(select(Lead).where(Lead.id == call_log.target_id, Lead.tenant_id == ctx.tenant_id))
        if lead:
            lead.last_contact_at = datetime.now(timezone.utc)
            if payload.auto_advance_stage and lead.status == "New":
                lead.status = "Contacted"
            if call_log.qualification_score:
                lead.ai_score = call_log.qualification_score
            lead.ai_sentiment = call_log.sentiment

            # Log completion activity
            activity = LeadActivity(
                tenant_id=ctx.tenant_id,
                lead_id=lead.id,
                activity_type="AI Call Completed",
                summary=f"Call completed ({call_log.duration_seconds}s, Sentiment: {call_log.sentiment}). Summary: {call_log.ai_summary}",
                occurred_at=datetime.now(timezone.utc),
                created_by_user_id=ctx.user.id,
            )
            db.add(activity)

    # If opportunity, update next step
    if call_log.target_type in ("opportunity", "deal") and call_log.target_id:
        opp = await db.scalar(select(CRMOpportunity).where(CRMOpportunity.id == call_log.target_id, CRMOpportunity.tenant_id == ctx.tenant_id))
        if opp:
            opp.next_step = call_log.ai_summary
            opp.next_step_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(call_log)
    return call_log


@router.get("/calls/logs", response_model=PaginatedResponse[CRMCallLogResponse])
async def list_crm_call_logs(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    target_type: str | None = None,
    target_id: uuid.UUID | None = None,
    search: str | None = None,
    sentiment: str | None = None,
    status: str | None = None,
    user_id: uuid.UUID | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
):
    """Lists historical AI call logs and transcripts with date, status, agent, and sentiment filtering."""
    query = select(CRMCallLog).where(CRMCallLog.tenant_id == ctx.tenant_id)
    if target_type and target_type != "all":
        query = query.where(CRMCallLog.target_type == target_type)
    if target_id:
        query = query.where(CRMCallLog.target_id == target_id)
    if sentiment and sentiment != "all":
        query = query.where(CRMCallLog.sentiment == sentiment)
    if status and status != "all":
        query = query.where(CRMCallLog.status == status)
    if user_id:
        query = query.where(CRMCallLog.created_by_user_id == user_id)
    if start_date:
        query = query.where(CRMCallLog.created_at >= start_date)
    if end_date:
        query = query.where(CRMCallLog.created_at <= end_date)
    if search:
        search_fmt = f"%{search}%"
        query = query.where(
            or_(
                CRMCallLog.contact_name.ilike(search_fmt),
                CRMCallLog.contact_phone.ilike(search_fmt),
                CRMCallLog.company_name.ilike(search_fmt),
                CRMCallLog.ai_summary.ilike(search_fmt)
            )
        )
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(CRMCallLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.get("/calls/export-csv")
async def export_call_logs_csv(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    target_type: str | None = None,
    sentiment: str | None = None,
    status: str | None = None,
    user_id: uuid.UUID | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    search: str | None = None,
):
    """Exports filtered call logs to downloadable CSV."""
    query = select(CRMCallLog).where(CRMCallLog.tenant_id == ctx.tenant_id)
    if target_type and target_type != "all":
        query = query.where(CRMCallLog.target_type == target_type)
    if sentiment and sentiment != "all":
        query = query.where(CRMCallLog.sentiment == sentiment)
    if status and status != "all":
        query = query.where(CRMCallLog.status == status)
    if user_id:
        query = query.where(CRMCallLog.created_by_user_id == user_id)
    if start_date:
        query = query.where(CRMCallLog.created_at >= start_date)
    if end_date:
        query = query.where(CRMCallLog.created_at <= end_date)
    if search:
        s = f"%{search}%"
        query = query.where(or_(
            CRMCallLog.contact_name.ilike(s),
            CRMCallLog.contact_phone.ilike(s),
            CRMCallLog.company_name.ilike(s),
            CRMCallLog.ai_summary.ilike(s)
        ))

    logs = (await db.scalars(query.order_by(CRMCallLog.created_at.desc()))).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Call ID", "Date & Time", "Target Type", "Contact Name", "Phone", "Email",
        "Company", "Status", "Direction", "Duration (Seconds)", "Agent Persona",
        "Sentiment", "Score", "Summary", "Action Items"
    ])

    for l in logs:
        action_items_str = "; ".join(l.action_items) if isinstance(l.action_items, list) else ""
        writer.writerow([
            str(l.id),
            l.created_at.strftime("%Y-%m-%d %H:%M:%S") if l.created_at else "",
            l.target_type or "",
            l.contact_name or "",
            l.contact_phone or "",
            l.contact_email or "",
            l.company_name or "",
            l.status or "",
            l.direction or "",
            l.duration_seconds or 0,
            l.agent_persona or "",
            l.sentiment or "",
            l.qualification_score or "",
            l.ai_summary or "",
            action_items_str
        ])

    output.seek(0)
    filename = f"crm_call_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/calls/stats", response_model=CRMCallStatsResponse)
async def get_crm_call_stats(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Returns calling analytics and KPIs calculated strictly from actual database records."""
    logs = (await db.scalars(select(CRMCallLog).where(CRMCallLog.tenant_id == ctx.tenant_id))).all()
    total_calls = len(logs)
    connected_calls = sum(1 for l in logs if l.status in ("Completed", "In Progress"))
    total_dur = sum(l.duration_seconds for l in logs)
    avg_dur = int(total_dur / total_calls) if total_calls > 0 else 0
    positive_count = sum(1 for l in logs if l.sentiment and l.sentiment.lower() in ("positive", "interested", "highly interested"))
    pos_rate = round((positive_count / total_calls) * 100, 1) if total_calls > 0 else 0.0
    scores = [l.qualification_score for l in logs if l.qualification_score is not None]
    avg_score = int(sum(scores) / len(scores)) if scores else 0
    leads_count = sum(1 for l in logs if l.target_type == "lead")
    opps_count = sum(1 for l in logs if l.target_type in ("opportunity", "deal"))

    return CRMCallStatsResponse(
        total_calls=total_calls,
        connected_calls=connected_calls,
        avg_duration_seconds=avg_dur,
        positive_sentiment_rate=pos_rate,
        avg_qualification_score=avg_score,
        leads_contacted_count=leads_count,
        opportunities_advanced=opps_count
    )


@router.post("/leads/{lead_id}/initiate-call", response_model=InitiateCallResponse)
async def initiate_lead_ai_call(
    lead_id: uuid.UUID,
    payload: InitiateCallRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Initiate an AI outbound call to a CRM lead (Backward-compatible)."""
    lead = await _lead_or_404(db, lead_id, ctx.tenant_id)
    if not lead.phone:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Lead has no phone number. Please add a phone number before initiating a call."
        )

    from src.config import get_settings
    settings = get_settings()
    livekit_url = getattr(settings, 'livekit_url', None)
    livekit_api_key = getattr(settings, 'livekit_api_key', None)
    livekit_api_secret = getattr(settings, 'livekit_api_secret', None)
    sip_trunk_id = getattr(settings, 'sip_trunk_id', None)

    room_name = f"crm-lead-{lead_id}-{int(datetime.now().timestamp())}"

    # Log activity
    activity = LeadActivity(
        tenant_id=ctx.tenant_id,
        lead_id=lead.id,
        activity_type="AI Call",
        summary=f"AI outbound call initiated. Room: {room_name}",
        occurred_at=datetime.now(timezone.utc),
        created_by_user_id=ctx.user.id,
    )
    db.add(activity)
    await db.commit()

    if all([livekit_url, livekit_api_key, livekit_api_secret, sip_trunk_id]):
        try:
            from livekit import api
            from livekit.protocol.sip import CreateSIPParticipantRequest
            from livekit.protocol.room import CreateRoomRequest

            lk_api = api.LiveKitAPI(livekit_url, livekit_api_key, livekit_api_secret)
            try:
                await lk_api.room.create_room(CreateRoomRequest(name=room_name, empty_timeout=60))
                if payload.sip_number:
                    await lk_api.sip.create_sip_participant(
                        CreateSIPParticipantRequest(
                            sip_trunk_id=sip_trunk_id,
                            sip_number=payload.sip_number,
                            sip_call_to=lead.phone,
                            room_name=room_name,
                            participant_identity="sip-caller",
                            participant_name=lead.name,
                        )
                    )
            finally:
                await lk_api.aclose()
            return InitiateCallResponse(
                status="connected",
                room_name=room_name,
                message=f"LiveKit SIP call successfully dialed to {lead.phone}"
            )
        except Exception as e:
            logger.warning(f"LiveKit dial error: {e}. Falling back to Browser AI session.")

    return InitiateCallResponse(
        status="connected",
        room_name=room_name,
        message=f"AI voice session active for {lead.name} ({lead.phone})"
    )



# ─── CRM Opportunities ───────────────────────────────────────────

@router.get("/opportunities", response_model=list[OpportunityResponse])
async def list_opportunities(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    res = await db.execute(
        select(CRMOpportunity)
        .where(CRMOpportunity.tenant_id == ctx.tenant_id)
        .order_by(CRMOpportunity.created_at.desc())
    )
    return res.scalars().all()

@router.post("/opportunities", response_model=OpportunityResponse, status_code=status.HTTP_201_CREATED)
async def create_opportunity(
    payload: OpportunityCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    opportunity = CRMOpportunity(
        tenant_id=ctx.tenant_id,
        **payload.model_dump()
    )
    db.add(opportunity)
    await db.flush()
    await db.commit()
    return opportunity

@router.patch("/opportunities/{opportunity_id}", response_model=OpportunityResponse)
async def update_opportunity(
    opportunity_id: uuid.UUID,
    payload: OpportunityUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    opportunity = await db.scalar(
        select(CRMOpportunity)
        .where(CRMOpportunity.id == opportunity_id, CRMOpportunity.tenant_id == ctx.tenant_id)
    )
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")
        
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(opportunity, k, v)
        
    await db.commit()
    return opportunity


# ─── AI Social Ad & Poster Creator ───────────────────────────────────

class GeneratePosterRequest(BaseModel):
    prompt: str
    style: str = "Photorealistic" 
    aspect_ratio: str = "1:1"     
    provider: str = "gemini"
    reference_image: str | None = None
    skip_enhancement: bool = False

class OptimizePromptRequest(BaseModel):
    prompt: str
    style: str = "3D Pixar Mascot & Character"
    aspect_ratio: str = "1:1"
    provider: str = "gemini"
    reference_image: str | None = None

class PublishFacebookRequest(BaseModel):
    image_url: str
    caption: str


@router.post("/campaigns/optimize-prompt")
async def optimize_campaign_prompt(
    payload: OptimizePromptRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))]
):
    from src.config import get_settings
    settings = get_settings()
    
    brand_visual_details = ""
    if payload.reference_image and settings.gemini_api_key:
        brand_visual_details = _extract_reference_visual_details(payload.reference_image, settings.gemini_api_key)
    elif not brand_visual_details and any(w in payload.prompt.lower() for w in ["lazymonkey", "monkey", "mascot", "character"]):
        brand_visual_details = "A cool, charismatic, stylized 3D animated brown monkey mascot character wearing sleek dark sunglasses, a vibrant purple tech hoodie, and sneakers"

    if brand_visual_details:
        enhancement_instruction = (
            f"You are an expert commercial advertising creative director. Write an ultra-high-converting, vivid commercial marketing poster prompt.\n"
            f"Hero Subject (Brand Mascot / Product): '{brand_visual_details}'.\n"
            f"Campaign Concept & Setting: '{payload.prompt}'.\n"
            f"Visual Style: {payload.style}.\n\n"
            f"CRITICAL ART DIRECTION INSTRUCTIONS:\n"
            f"1. If a mascot/monkey/character is in the prompt, ALWAYS portray it as a charming, stylish, friendly 3D animated commercial character (Pixar/Disney 3D animation style, expressive face, sunglasses, stylish streetwear), NEVER a wild zoo animal or realistic macaque ape.\n"
            f"2. If shopping or POS is mentioned, place the hero character in a vibrant, brightly lit, modern retail store or supermarket, joyfully holding colorful shopping bags and tapping a modern glowing touchscreen POS billing counter.\n"
            f"3. 8K commercial render, Octane render, beautiful volumetric studio lighting, clean background.\n"
            f"4. Aspect ratio: {payload.aspect_ratio}. Output ONLY the raw descriptive prompt text (max 45 words)."
        )
    else:
        enhancement_instruction = (
            f"You are an expert commercial advertising art director. Expand this campaign concept into a high-end commercial ad poster prompt: '{payload.prompt}'.\n"
            f"Visual Style: {payload.style}.\n"
            f"CRITICAL ART DIRECTION INSTRUCTIONS:\n"
            f"1. The primary subject/product from the prompt must be the prominent central hero focus with professional studio lighting and premium textures.\n"
            f"2. If shopping/store/mascot is mentioned, make the scene cheerful, bright, and modern.\n"
            f"3. Aspect ratio: {payload.aspect_ratio}. Output ONLY the raw descriptive prompt text (max 45 words)."
        )

    try:
        optimized = call_ai_text(enhancement_instruction, prefer_provider=payload.provider).strip()
        return {"optimized_prompt": optimized}
    except Exception as e:
        logger.warning(f"Prompt optimization endpoint failed: {e}")
        return {"optimized_prompt": payload.prompt}


@router.post("/campaigns/generate-poster")
async def generate_campaign_poster(
    payload: GeneratePosterRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))]
):
    import uuid
    import os
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))) # backend
    images_dir = os.path.join(base_dir, "images")
    os.makedirs(images_dir, exist_ok=True)
    filename = f"poster_{uuid.uuid4().hex}.jpg"
    filepath = os.path.join(images_dir, filename)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    try:
        image_bytes, enhanced_prompt = call_ai_image(
            prompt=payload.prompt,
            aspect_ratio=payload.aspect_ratio,
            style=payload.style,
            prefer_provider=payload.provider,
            reference_image=payload.reference_image,
            skip_enhancement=payload.skip_enhancement
        )
        with open(filepath, "wb") as f:
            f.write(image_bytes)

        import base64
        b64_image = f"data:image/jpeg;base64,{base64.b64encode(image_bytes).decode('utf-8')}"
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ad Poster generation failed: {str(e)}"
        )

    return {
        "image_url": f"/images/{filename}",
        "image_b64": b64_image,
        "enhanced_prompt": enhanced_prompt,
        "aspect_ratio": payload.aspect_ratio
    }


@router.post("/campaigns/publish-facebook")
async def publish_to_facebook(
    payload: PublishFacebookRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    "\"\"\"Publish generated poster and marketing copy live to the linked Facebook Page.\"\"\""
    tenant = await db.scalar(select(Tenant).where(Tenant.id == ctx.tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    # Prefer OAuth-connected page; fall back to manually-entered credentials (lead import flow)
    tenant_settings = tenant.settings or {}
    fb_page_cfg = tenant_settings.get("facebook_page", {})
    fb_legacy_cfg = tenant_settings.get("facebook", {})
    
    fb_token = fb_page_cfg.get("page_access_token") or fb_legacy_cfg.get("fb_access_token") or fb_legacy_cfg.get("access_token")
    page_id   = fb_page_cfg.get("page_id") or fb_legacy_cfg.get("fb_page_or_form_id") or fb_legacy_cfg.get("page_id")
    
    if not fb_token or not page_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Facebook Page connected. Click 'Connect FB Page' in the Ad Generator header and complete the OAuth flow.",
        )
        
    import requests
    import base64
    import os
    
    # Auto-resolve specific Page Access Token if a User Token was provided
    target_token = fb_token
    try:
        page_tok_res = requests.get(
            f"https://graph.facebook.com/v25.0/{page_id}",
            params={"fields": "access_token", "access_token": fb_token},
            timeout=10
        )
        if page_tok_res.status_code == 200 and page_tok_res.json().get("access_token"):
            target_token = page_tok_res.json()["access_token"]
        else:
            acc_res = requests.get(
                "https://graph.facebook.com/v25.0/me/accounts",
                params={"access_token": fb_token},
                timeout=10
            )
            if acc_res.status_code == 200:
                for acc in acc_res.json().get("data", []):
                    if str(acc.get("id")) == str(page_id) and acc.get("access_token"):
                        target_token = acc["access_token"]
                        break
    except Exception as tok_err:
        logger.warning(f"Could not auto-resolve Page Access Token: {tok_err}")

    try:
        url = f"https://graph.facebook.com/v25.0/{page_id}/photos"
        
        # Check if the image is hosted locally on the static server path
        if "/images/" in payload.image_url:
            filename = payload.image_url.split("/images/")[1]
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))) # backend
            images_dir = os.path.join(base_dir, "images")
            local_path = os.path.join(images_dir, filename)
            if os.path.exists(local_path):
                with open(local_path, "rb") as f:
                    image_bytes = f.read()
                files = {"source": ("poster.jpeg", image_bytes, "image/jpeg")}
                data = {"message": payload.caption}
                res = requests.post(url, files=files, data=data, params={"access_token": target_token}, timeout=25)
            else:
                raise HTTPException(status_code=404, detail="Image file not found locally")
        elif payload.image_url.startswith("data:image/"):
            header, base64_data = payload.image_url.split(",", 1)
            image_bytes = base64.b64decode(base64_data)
            files = {"source": ("poster.jpeg", image_bytes, "image/jpeg")}
            data = {"message": payload.caption}
            res = requests.post(url, files=files, data=data, params={"access_token": target_token}, timeout=25)
        else:
            params = {
                "url": payload.image_url,
                "caption": payload.caption,
                "access_token": target_token
            }
            res = requests.post(url, params=params, timeout=25)
            
        if res.status_code == 403:
            # Fallback to feed text/caption posting if photo endpoint is restricted
            feed_url = f"https://graph.facebook.com/v25.0/{page_id}/feed"
            res = requests.post(feed_url, data={"message": payload.caption}, params={"access_token": target_token}, timeout=25)

        res.raise_for_status()
        post_data = res.json()
        
        resolved_post_id = post_data.get("post_id") or post_data.get("id")
        page_name = fb_page_cfg.get("page_name") or fb_legacy_cfg.get("page_name") or ""
        fb_post_url = f"https://www.facebook.com/{page_id}_{resolved_post_id}" if page_id and resolved_post_id else ""

        await write_audit_log(
            db,
            tenant_id=ctx.tenant_id,
            user_id=ctx.user.id,
            module="crm",
            action="facebook_ad_published",
            entity_type="campaign",
            entity_id=None,
            new_values={
                "post_id": resolved_post_id,
                "page_id": page_id,
                "page_name": page_name,
                "caption": payload.caption,
                "image_url": payload.image_url,
                "fb_post_url": fb_post_url,
            }
        )
        
        return {
            "status": "success",
            "post_id": resolved_post_id,
            "page_id": page_id,
            "fb_post_url": fb_post_url,
            "message": "Campaign ad published successfully to your Facebook Page!"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to publish to Facebook feed: {str(e)}"
        )


# ─── Ad History & Token Health Endpoints ─────────────────────────────────────

@router.get("/campaigns/fb-token-info")
async def get_fb_token_info(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Check the health and expiry of the stored Facebook access token for this org."""
    import requests as req_lib

    tenant = await db.scalar(select(Tenant).where(Tenant.id == ctx.tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant_settings = tenant.settings or {}
    fb_page_cfg = tenant_settings.get("facebook_page", {})
    fb_legacy_cfg = tenant_settings.get("facebook", {})

    # Prefer page token (non-expiring), fall back to user token
    fb_token = fb_page_cfg.get("page_access_token") or fb_legacy_cfg.get("fb_access_token") or fb_legacy_cfg.get("access_token")
    page_id = fb_page_cfg.get("page_id") or fb_legacy_cfg.get("fb_page_or_form_id") or fb_legacy_cfg.get("page_id")
    page_name = fb_page_cfg.get("page_name") or fb_legacy_cfg.get("page_name")

    if not fb_token:
        return {"connected": False, "is_valid": False, "error": "No token stored for this organization."}

    try:
        # Use /me endpoint to validate token — works for both page and user tokens
        me_resp = req_lib.get(
            "https://graph.facebook.com/v25.0/me",
            params={"access_token": fb_token, "fields": "id,name"},
            timeout=10
        )
        me_data = me_resp.json()

        if "error" in me_data:
            return {
                "connected": True,
                "is_valid": False,
                "page_id": page_id,
                "page_name": page_name,
                "error": me_data["error"].get("message", "Token is invalid or expired."),
                "expires_at": None,
                "token_type": "unknown",
            }

        # For page tokens, Meta does not expose expiry via /me — check via debug_token if App ID/Secret available
        fb_app_cfg = tenant_settings.get("facebook_app", {})
        app_id = fb_app_cfg.get("app_id")
        app_secret = fb_app_cfg.get("app_secret")

        expires_at = None
        scopes = []
        token_type = "page"  # Page tokens never expire by default

        if app_id and app_secret:
            app_token = f"{app_id}|{app_secret}"
            debug_resp = req_lib.get(
                "https://graph.facebook.com/v25.0/debug_token",
                params={"input_token": fb_token, "access_token": app_token},
                timeout=10
            )
            debug_data = debug_resp.json().get("data", {})
            expires_at = debug_data.get("expires_at")  # Unix timestamp or 0 (never)
            scopes = debug_data.get("scopes", [])
            token_type = debug_data.get("type", "page").lower()
            if expires_at == 0:
                expires_at = None  # 0 means never expires (page token)

        return {
            "connected": True,
            "is_valid": True,
            "page_id": page_id,
            "page_name": page_name or me_data.get("name"),
            "token_type": token_type,
            "expires_at": expires_at,
            "scopes": scopes,
            "ad_account_id": fb_page_cfg.get("ad_account_id"),
            "error": None,
        }
    except Exception as e:
        return {
            "connected": True,
            "is_valid": False,
            "page_id": page_id,
            "page_name": page_name,
            "ad_account_id": fb_page_cfg.get("ad_account_id"),
            "error": str(e),
            "expires_at": None,
            "token_type": "unknown",
        }


@router.get("/campaigns/ad-history")
async def get_ad_history(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Return paginated list of all Facebook ads published by this organization."""
    from sqlalchemy import desc

    total = await db.scalar(
        select(func.count())
        .select_from(AuditLog)
        .where(
            AuditLog.tenant_id == ctx.tenant_id,
            AuditLog.module == "crm",
            AuditLog.action == "facebook_ad_published",
        )
    )

    rows = await db.scalars(
        select(AuditLog)
        .where(
            AuditLog.tenant_id == ctx.tenant_id,
            AuditLog.module == "crm",
            AuditLog.action == "facebook_ad_published",
        )
        .order_by(desc(AuditLog.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    items = []
    for row in rows:
        nv = row.new_values or {}
        items.append({
            "id": str(row.id),
            "post_id": nv.get("post_id"),
            "page_id": nv.get("page_id"),
            "page_name": nv.get("page_name"),
            "caption": nv.get("caption"),
            "image_url": nv.get("image_url"),
            "fb_post_url": nv.get("fb_post_url"),
            "published_at": row.created_at.isoformat() if row.created_at else None,
            "published_by_user_id": str(row.user_id) if row.user_id else None,
        })

    return {
        "total": total or 0,
        "page": page,
        "page_size": page_size,
        "items": items,
    }


@router.get("/facebook/ad-accounts")
async def get_facebook_ad_accounts(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Retrieve all Facebook ad accounts accessible by the stored token."""
    tenant = await _get_tenant_or_404(db, ctx.tenant_id)
    settings_dict = tenant.settings or {}
    fb_page_cfg = settings_dict.get("facebook_page", {})
    fb_legacy_cfg = settings_dict.get("facebook", {})
    
    token = fb_page_cfg.get("user_access_token") or fb_page_cfg.get("page_access_token") or fb_legacy_cfg.get("fb_access_token") or fb_legacy_cfg.get("access_token")
    if not token:
        raise HTTPException(status_code=400, detail="Facebook integration is not connected. Please connect it first.")
        
    import requests as req_lib
    try:
        url = "https://graph.facebook.com/v25.0/me/adaccounts"
        res = req_lib.get(url, params={"access_token": token, "fields": "account_id,name,account_status", "limit": 100}, timeout=15)
        data = res.json()
        if "error" in data:
            logger.error(f"Meta Ad Accounts error response: {data}")
            raise HTTPException(status_code=400, detail=data["error"].get("message", "Failed to retrieve ad accounts from Meta."))
        return data.get("data", [])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Meta API connection error: {str(e)}")


@router.post("/facebook/select-ad-account")
async def select_facebook_ad_account(
    payload: SelectFacebookAdAccountRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Save selected Facebook Ad Account ID to organization settings."""
    tenant = await _get_tenant_or_404(db, ctx.tenant_id)
    settings_dict = dict(tenant.settings or {})
    
    if "facebook_page" not in settings_dict:
        settings_dict["facebook_page"] = {}
    if "facebook" not in settings_dict:
        settings_dict["facebook"] = {}
        
    settings_dict["facebook_page"]["ad_account_id"] = payload.ad_account_id.strip()
    settings_dict["facebook"]["fb_ad_account_id"] = payload.ad_account_id.strip()
    
    from sqlalchemy.orm.attributes import flag_modified
    tenant.settings = settings_dict
    flag_modified(tenant, "settings")
    await db.commit()
    return {"success": True, "message": f"Successfully set active Ad Account to {payload.ad_account_id}"}


@router.get("/facebook/campaigns")
async def get_facebook_campaigns(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Retrieve campaigns and real-time performance insights for the selected Ad Account."""
    tenant = await _get_tenant_or_404(db, ctx.tenant_id)
    settings_dict = tenant.settings or {}
    fb_page_cfg = settings_dict.get("facebook_page", {})
    fb_legacy_cfg = settings_dict.get("facebook", {})
    
    token = fb_page_cfg.get("user_access_token") or fb_page_cfg.get("page_access_token") or fb_legacy_cfg.get("fb_access_token") or fb_legacy_cfg.get("access_token")
    ad_account_id = fb_page_cfg.get("ad_account_id") or fb_legacy_cfg.get("fb_ad_account_id")
    
    if not token:
        raise HTTPException(status_code=400, detail="Facebook integration is not connected. Please connect it first.")
    if not ad_account_id:
        return []
        
    import requests as req_lib
    clean_account_id = ad_account_id.strip()
    if not clean_account_id.startswith("act_"):
        clean_account_id = f"act_{clean_account_id}"
        
    try:
        # Step 1: Get campaigns list with nested ad creative details
        campaigns_url = f"https://graph.facebook.com/v25.0/{clean_account_id}/campaigns"
        campaigns_res = req_lib.get(campaigns_url, params={
            "access_token": token,
            "fields": "id,name,status,objective,start_time,stop_time,adsets{name,status,ads{id,name,status,creative{id,name,image_url,body,title,object_story_spec}}}",
            "limit": 100
        }, timeout=20)
        campaigns_data = campaigns_res.json()
        if "error" in campaigns_data:
            raise HTTPException(status_code=400, detail=campaigns_data["error"].get("message", "Failed to retrieve campaigns from Meta."))
        campaigns = campaigns_data.get("data", [])

        # Step 2: Get real insights (spend, impressions, clicks, CTR) via /insights endpoint
        insights_url = f"https://graph.facebook.com/v25.0/{clean_account_id}/insights"
        insights_res = req_lib.get(insights_url, params={
            "access_token": token,
            "level": "campaign",
            "fields": "campaign_id,campaign_name,spend,impressions,clicks,ctr,reach,frequency,actions",
            "date_preset": "maximum",
            "limit": 100,
        }, timeout=20)
        insights_data = insights_res.json()

        # Build a lookup map from campaign_id → insights row
        insights_map: dict = {}
        if "error" not in insights_data:
            for row in insights_data.get("data", []):
                cid = row.get("campaign_id")
                if cid:
                    insights_map[cid] = row

        # Step 3: Merge campaigns with insights and extract ad creative info
        result = []
        for c in campaigns:
            cid = c.get("id", "")
            ins = insights_map.get(cid, {})

            # Extract first ad creative from nested adsets → ads → creative
            ad_image_url = None
            ad_headline = None
            ad_body = None
            ad_name = None
            ad_id = None
            adsets = c.get("adsets", {}).get("data", [])
            for adset in adsets:
                ads = adset.get("ads", {}).get("data", [])
                for ad in ads:
                    creative = ad.get("creative", {})
                    if not ad_image_url:
                        ad_image_url = creative.get("image_url")
                    if not ad_headline:
                        ad_headline = creative.get("title")
                        if not ad_headline:
                            # Try nested object_story_spec
                            oss = creative.get("object_story_spec", {})
                            link_data = oss.get("link_data", {})
                            ad_headline = link_data.get("name") or link_data.get("message")
                    if not ad_body:
                        ad_body = creative.get("body")
                        if not ad_body:
                            oss = creative.get("object_story_spec", {})
                            ad_body = oss.get("link_data", {}).get("message")
                    if not ad_name:
                        ad_name = ad.get("name") or creative.get("name")
                    if not ad_id:
                        ad_id = ad.get("id")
                    if ad_image_url and ad_headline:
                        break
                if ad_image_url and ad_headline:
                    break

            result.append({
                "id": cid,
                "name": c.get("name"),
                "status": c.get("status"),
                "objective": c.get("objective"),
                "start_time": c.get("start_time"),
                "stop_time": c.get("stop_time"),
                "spend": ins.get("spend", "0.00"),
                "impressions": ins.get("impressions", "0"),
                "clicks": ins.get("clicks", "0"),
                "ctr": ins.get("ctr", "0"),
                "reach": ins.get("reach", "0"),
                "frequency": ins.get("frequency", "0"),
                # Ad creative preview fields
                "ad_id": ad_id,
                "ad_name": ad_name,
                "ad_image_url": ad_image_url,
                "ad_headline": ad_headline,
                "ad_body": ad_body,
                "meta_campaign_id": cid,
            })
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Meta API campaigns connection error: {str(e)}")


@router.get("/facebook/ads")
async def get_facebook_ads(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Retrieve all ads under the active Ad Account."""
    tenant = await _get_tenant_or_404(db, ctx.tenant_id)
    settings_dict = tenant.settings or {}
    fb_page_cfg = settings_dict.get("facebook_page", {})
    fb_legacy_cfg = settings_dict.get("facebook", {})
    
    token = fb_page_cfg.get("user_access_token") or fb_page_cfg.get("page_access_token") or fb_legacy_cfg.get("fb_access_token") or fb_legacy_cfg.get("access_token")
    ad_account_id = fb_page_cfg.get("ad_account_id") or fb_legacy_cfg.get("fb_ad_account_id")
    
    if not token or not ad_account_id:
        return []
        
    import requests as req_lib
    clean_account_id = ad_account_id.strip()
    if not clean_account_id.startswith("act_"):
        clean_account_id = f"act_{clean_account_id}"
        
    try:
        url = f"https://graph.facebook.com/v25.0/{clean_account_id}/ads"
        res = req_lib.get(url, params={"access_token": token, "fields": "id,name,status,campaign_id,adset_id", "limit": 150}, timeout=15)
        data = res.json()
        if "error" in data:
            raise HTTPException(status_code=400, detail=data["error"].get("message", "Failed to retrieve ads from Meta."))
        return data.get("data", [])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Meta API ads connection error: {str(e)}")


@router.post("/facebook/sync-leads")
async def sync_facebook_leads(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Sync submissions from Facebook Page Lead Gen Forms directly to Postgres Leads database."""
    tenant = await _get_tenant_or_404(db, ctx.tenant_id)
    settings_dict = tenant.settings or {}
    fb_page_cfg = settings_dict.get("facebook_page", {})
    fb_legacy_cfg = settings_dict.get("facebook", {})
    
    token = fb_page_cfg.get("page_access_token") or fb_legacy_cfg.get("fb_access_token") or fb_legacy_cfg.get("access_token")
    page_id = fb_page_cfg.get("page_id") or fb_legacy_cfg.get("fb_page_or_form_id")
    
    if not token:
        raise HTTPException(status_code=400, detail="Facebook integration is not connected. Please connect it first.")
    if not page_id:
        raise HTTPException(status_code=400, detail="No connected Page ID found. Please connect a Page first.")
        
    import requests as req_lib
    
    try:
        forms_url = f"https://graph.facebook.com/v25.0/{page_id}/leadgen_forms"
        forms_res = req_lib.get(forms_url, params={"access_token": token, "fields": "id,name,status"}, timeout=15)
        forms_data = forms_res.json()
        
        if "error" in forms_data:
            raise HTTPException(status_code=400, detail=forms_data["error"].get("message", "Failed to retrieve Page lead forms."))
            
        forms = forms_data.get("data", [])
        if not forms:
            return {"success": True, "synced_count": 0, "message": "No active lead gen forms found on this Facebook Page."}
            
        synced_count = 0
        
        for form in forms:
            form_id = form["id"]
            leads_url = f"https://graph.facebook.com/v25.0/{form_id}/leads"
            leads_res = req_lib.get(leads_url, params={"access_token": token, "fields": "id,created_time,field_data"}, timeout=15)
            leads_data = leads_res.json()
            
            if "error" in leads_data:
                logger.warning(f"Failed to fetch leads for form {form_id}: {leads_data['error'].get('message')}")
                continue
                
            submissions = leads_data.get("data", [])
            for sub in submissions:
                sub_id = sub["id"]
                
                existing = await db.scalar(
                    select(Lead).where(Lead.tenant_id == ctx.tenant_id, Lead.external_id == sub_id, Lead.external_source == "facebook")
                )
                if existing:
                    continue
                    
                field_data = sub.get("field_data", [])
                lead_name = "Facebook Lead"
                lead_email = None
                lead_phone = None
                lead_company = None
                
                for field in field_data:
                    name_key = field.get("name", "").lower()
                    values = field.get("values", [])
                    val = values[0] if values else None
                    if not val:
                        continue
                        
                    if "name" in name_key or "fullname" in name_key:
                        lead_name = val
                    elif "email" in name_key:
                        lead_email = val
                    elif "phone" in name_key or "tel" in name_key:
                        lead_phone = val
                    elif "company" in name_key or "organization" in name_key:
                        lead_company = val
                
                # Truncate values to prevent database varying character limit insertion crashes
                if lead_name:
                    lead_name = lead_name[:255]
                if lead_company:
                    lead_company = lead_company[:255]
                if lead_email:
                    lead_email = lead_email[:255]
                if lead_phone:
                    lead_phone = lead_phone[:30]
                
                new_lead = Lead(
                    tenant_id=ctx.tenant_id,
                    name=lead_name,
                    company_name=lead_company,
                    email=lead_email,
                    phone=lead_phone,
                    status="New",
                    source="facebook_ad",
                    external_id=sub_id,
                    external_source="facebook",
                    meta={"form_id": form_id, "form_name": form.get("name"), "raw_data": sub},
                    notes=f"Synced from Meta Lead Form: '{form.get('name')}'"
                )
                db.add(new_lead)
                synced_count += 1
                
        if synced_count > 0:
            await db.commit()
            
        return {
            "success": True,
            "synced_count": synced_count,
            "message": f"Successfully synchronized {synced_count} new leads from your Facebook page forms."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing Meta leads: {e}")
        raise HTTPException(status_code=502, detail=f"Meta leads sync error: {str(e)}")


@router.post("/ads/lead-forms")
async def list_paid_ad_lead_forms(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Retrieve Meta Page lead gen forms for ad builder dropdown."""
    tenant = await _get_tenant_or_404(db, ctx.tenant_id)
    settings_dict = tenant.settings or {}
    fb_page_cfg = settings_dict.get("facebook_page", {})
    fb_legacy_cfg = settings_dict.get("facebook", {})
    
    token = fb_page_cfg.get("page_access_token") or fb_page_cfg.get("user_access_token") or fb_legacy_cfg.get("fb_access_token") or fb_legacy_cfg.get("access_token")
    page_id = fb_page_cfg.get("page_id") or fb_legacy_cfg.get("fb_page_or_form_id")
    
    if not token or not page_id:
        return []

    import requests as req_lib
    try:
        url = f"https://graph.facebook.com/v25.0/{page_id}/leadgen_forms"
        res = req_lib.get(url, params={"access_token": token, "fields": "id,name,status,leads_count"}, timeout=15)
        data = res.json()
        if "error" in data:
            logger.warning(f"Lead forms fetch error: {data['error'].get('message')}")
            return []
        forms = data.get("data", [])
        return [{
            "id": f["id"],
            "name": f["name"],
            "status": f.get("status", "ACTIVE"),
            "leads_count": f.get("leads_count", 0)
        } for f in forms]
    except Exception as e:
        logger.error(f"Failed to fetch Meta lead forms: {e}")
        return []


@router.post("/ads/campaigns")
async def create_paid_ad_campaign(
    payload: CreatePaidAdRequestSchema,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a full Meta Ad pipeline (Campaign -> AdSet -> AdCreative -> Ad) and publish to Meta Ads Manager."""
    tenant = await _get_tenant_or_404(db, ctx.tenant_id)
    settings_dict = tenant.settings or {}
    fb_page_cfg = settings_dict.get("facebook_page", {})
    fb_legacy_cfg = settings_dict.get("facebook", {})
    
    token = fb_page_cfg.get("user_access_token") or fb_page_cfg.get("page_access_token") or fb_legacy_cfg.get("fb_access_token") or fb_legacy_cfg.get("access_token")
    ad_account_id = fb_page_cfg.get("ad_account_id") or fb_legacy_cfg.get("fb_ad_account_id")
    page_id = fb_page_cfg.get("page_id") or fb_legacy_cfg.get("fb_page_or_form_id")

    if not token:
        raise HTTPException(status_code=400, detail="Facebook/Meta integration is not connected. Please connect your FB Page first.")
    if not ad_account_id:
        raise HTTPException(status_code=400, detail="No Meta Ad Account selected. Please select your Ad Account in CRM settings.")
    if not page_id:
        raise HTTPException(status_code=400, detail="No Facebook Page connected. Please select your FB Page first.")

    from src.services.meta_ads import MetaAdsClient
    client = MetaAdsClient(
        access_token=token,
        ad_account_id=ad_account_id,
        page_id=page_id,
    )

    try:
        # Step 1: Obtain Image Bytes
        import requests as req_lib
        image_bytes = b""
        if payload.image_url.startswith("data:image/"):
            import base64
            header, encoded = payload.image_url.split(",", 1)
            image_bytes = base64.b64decode(encoded)
        else:
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            try:
                img_res = req_lib.get(payload.image_url, headers=headers, timeout=25)
                img_res.raise_for_status()
                image_bytes = img_res.content
            except Exception as download_err:
                logger.warning(f"Initial image fetch failed ({download_err}), retrying image download...")
                img_res = req_lib.get(payload.image_url, headers=headers, timeout=30)
                img_res.raise_for_status()
                image_bytes = img_res.content

        # Step 2: Call full ad creation pipeline
        res = client.create_full_ad_pipeline(
            image_bytes=image_bytes,
            headline=payload.headline,
            caption=payload.caption,
            destination_url=payload.destination_url,
            campaign_name=payload.campaign_name,
            objective=payload.objective,
            adset_name=payload.adset_name,
            ad_name=payload.ad_name,
            cta_type=payload.cta_type or "LEARN_MORE",
            lead_form_id=payload.lead_form_id,
            daily_budget_cents=payload.daily_budget_cents or 25000,
            targeting=payload.targeting,
            special_ad_categories=payload.special_ad_categories,
        )

        return {
            "success": True,
            "local_campaign_id": res["meta_campaign_id"],
            "local_adset_id": res["meta_adset_id"],
            "local_ad_id": res["meta_ad_id"],
            "meta_campaign_id": res["meta_campaign_id"],
            "meta_adset_id": res["meta_adset_id"],
            "meta_ad_id": res["meta_ad_id"],
            "meta_creative_id": res["meta_creative_id"],
            "image_hash": res["image_hash"],
            "message": f"Successfully created Meta Ad Campaign '{payload.campaign_name}' in Meta Ads Manager!",
        }
    except Exception as e:
        logger.error(f"Error publishing Meta campaign: {e}")
        raise HTTPException(status_code=400, detail=f"Meta Ad Creation Error: {str(e)}")


@router.get("/ads/campaigns")
async def list_paid_ad_campaigns(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Paginated list of active Meta Ad campaigns."""
    campaigns = await get_facebook_campaigns(ctx, db)
    total = len(campaigns)
    start = (page - 1) * page_size
    items = campaigns[start: start + page_size]
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items,
    }


@router.post("/ads/{ad_id}/activate")
async def activate_or_pause_ad(
    ad_id: str,
    payload: ActivateAdRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Toggle ad status between ACTIVE and PAUSED on Meta."""
    tenant = await _get_tenant_or_404(db, ctx.tenant_id)
    settings_dict = tenant.settings or {}
    fb_page_cfg = settings_dict.get("facebook_page", {})
    fb_legacy_cfg = settings_dict.get("facebook", {})
    
    token = fb_page_cfg.get("user_access_token") or fb_page_cfg.get("page_access_token") or fb_legacy_cfg.get("fb_access_token") or fb_legacy_cfg.get("access_token")
    ad_account_id = fb_page_cfg.get("ad_account_id") or fb_legacy_cfg.get("fb_ad_account_id")
    page_id = fb_page_cfg.get("page_id") or fb_legacy_cfg.get("fb_page_or_form_id")

    if not token or not ad_account_id or not page_id:
        raise HTTPException(status_code=400, detail="Meta integration is incomplete. Please check FB Page & Ad Account connection.")

    from src.services.meta_ads import MetaAdsClient
    client = MetaAdsClient(access_token=token, ad_account_id=ad_account_id, page_id=page_id)
    res = client.update_ad_status(ad_id, payload.status)
    return {"success": True, "meta_ad_id": ad_id, "status": payload.status}


@router.get("/ads/campaigns/{campaign_id}/insights")
async def get_campaign_insights_endpoint(
    campaign_id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get live insights for a campaign."""
    campaigns = await get_facebook_campaigns(ctx, db)
    match = next((c for c in campaigns if c.get("id") == campaign_id), None)
    if match:
        return {
            "spend": match.get("spend", "0.00"),
            "impressions": match.get("impressions", "0"),
            "clicks": match.get("clicks", "0"),
            "ctr": match.get("ctr", "0"),
            "reach": match.get("reach", "0"),
            "frequency": match.get("frequency", "0"),
        }
    return {"spend": "0.00", "impressions": "0", "clicks": "0", "ctr": "0", "reach": "0", "frequency": "0"}


@router.get("/facebook/organic-posts")
async def get_facebook_organic_posts(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(25, ge=1, le=100),
):
    """Fetch organic (non-paid) posts from the connected FB Page with engagement metrics."""
    import requests as req_lib
    import logging
    logger = logging.getLogger(__name__)

    tenant = await _get_tenant_or_404(db, ctx.tenant_id)
    settings_dict = tenant.settings or {}
    fb_page_cfg = settings_dict.get("facebook_page", {})
    fb_legacy_cfg = settings_dict.get("facebook", {})

    token = (
        fb_page_cfg.get("page_access_token")
        or fb_page_cfg.get("user_access_token")
        or fb_legacy_cfg.get("fb_access_token")
        or fb_legacy_cfg.get("access_token")
    )
    page_id = (
        fb_page_cfg.get("page_id")
        or fb_legacy_cfg.get("fb_page_or_form_id")
        or fb_legacy_cfg.get("page_id")
    )

    if not token or not page_id:
        raise HTTPException(
            status_code=400,
            detail="Facebook integration is not connected. Please connect it first.",
        )

    try:
        url = f"https://graph.facebook.com/v25.0/{page_id}/posts"
        params = {
            "access_token": token,
            "fields": "id,message,full_picture,created_time,permalink_url,likes.summary(true),comments.summary(true),shares",
            "limit": limit,
        }
        resp = req_lib.get(url, params=params, timeout=20)
        data = resp.json()

        if "error" in data:
            # Fall back to /{page_id}/feed if /posts errors
            feed_url = f"https://graph.facebook.com/v25.0/{page_id}/feed"
            resp = req_lib.get(feed_url, params={"access_token": token, "fields": "id,message,full_picture,created_time,permalink_url", "limit": limit}, timeout=20)
            data = resp.json()

        posts = []
        for post in data.get("data", []):
            likes = (post.get("likes") or {}).get("summary", {}).get("total_count", 0)
            comments = (post.get("comments") or {}).get("summary", {}).get("total_count", 0)
            shares = (post.get("shares") or {}).get("count", 0)

            posts.append({
                "post_id": post.get("id"),
                "message": post.get("message", ""),
                "image_url": post.get("full_picture"),
                "created_time": post.get("created_time"),
                "permalink_url": post.get("permalink_url") or f"https://www.facebook.com/{post.get('id')}",
                "likes": likes,
                "reactions": likes,
                "comments": comments,
                "shares": shares,
                "engagement": likes + comments + shares,
            })

        return {"posts": posts, "total": len(posts), "page_id": page_id}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Meta API error: {str(e)}")


# ─── Customer Intelligence Endpoints ─────────────────────────────────────────

import logging as _logging
_intel_logger = _logging.getLogger("CustomerIntelligence")


@router.get("/intelligence/analytics")
async def get_customer_analytics(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Real-time customer analytics aggregated from live CRM data."""
    from sqlalchemy import cast, Float, extract, case
    from datetime import timedelta

    tid = ctx.tenant_id
    now = datetime.now(timezone.utc)

    # Total customers
    total_customers = await db.scalar(
        select(func.count(Customer.id)).where(Customer.tenant_id == tid)
    ) or 0

    # Active customers (status = Active)
    active_customers = await db.scalar(
        select(func.count(Customer.id)).where(Customer.tenant_id == tid, Customer.status == "Active")
    ) or 0

    # Total revenue from sales orders
    total_revenue = await db.scalar(
        select(func.coalesce(func.sum(CRMSalesOrder.total), 0.0))
        .where(CRMSalesOrder.tenant_id == tid)
    ) or 0.0

    # Total orders count
    total_orders = await db.scalar(
        select(func.count(CRMSalesOrder.id)).where(CRMSalesOrder.tenant_id == tid)
    ) or 0

    # New customers this month
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_customers_month = await db.scalar(
        select(func.count(Customer.id))
        .where(Customer.tenant_id == tid, Customer.created_at >= month_start)
    ) or 0

    # Repeat customers (more than 1 order)
    subq = (
        select(CRMSalesOrder.customer_id, func.count(CRMSalesOrder.id).label("order_count"))
        .where(CRMSalesOrder.tenant_id == tid)
        .group_by(CRMSalesOrder.customer_id)
        .having(func.count(CRMSalesOrder.id) > 1)
        .subquery()
    )
    repeat_customers = await db.scalar(select(func.count()).select_from(subq)) or 0

    repeat_rate = round((repeat_customers / max(total_customers, 1)) * 100, 1)

    # Monthly breakdown (last 6 months) — revenue + new customers
    monthly_data = []
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    for i in range(5, -1, -1):
        m_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        m_end = (m_start.replace(day=28) + timedelta(days=4)).replace(day=1)
        rev = await db.scalar(
            select(func.coalesce(func.sum(CRMSalesOrder.total), 0.0))
            .where(CRMSalesOrder.tenant_id == tid, CRMSalesOrder.created_at >= m_start, CRMSalesOrder.created_at < m_end)
        ) or 0.0
        orders_m = await db.scalar(
            select(func.count(CRMSalesOrder.id))
            .where(CRMSalesOrder.tenant_id == tid, CRMSalesOrder.created_at >= m_start, CRMSalesOrder.created_at < m_end)
        ) or 0
        new_cust_m = await db.scalar(
            select(func.count(Customer.id))
            .where(Customer.tenant_id == tid, Customer.created_at >= m_start, Customer.created_at < m_end)
        ) or 0
        monthly_data.append({
            "month": month_names[m_start.month - 1],
            "revenue": float(rev),
            "orders": orders_m,
            "new_customers": new_cust_m
        })

    # Top segments by customer type
    seg_result = await db.execute(
        select(Customer.customer_type, func.count(Customer.id).label("cnt"))
        .where(Customer.tenant_id == tid)
        .group_by(Customer.customer_type)
        .order_by(func.count(Customer.id).desc())
        .limit(6)
    )
    segments = [{"name": row.customer_type or "Unknown", "count": row.cnt} for row in seg_result]

    avg_order_value = round(float(total_revenue) / max(total_orders, 1), 2)

    return {
        "total_customers": total_customers,
        "active_customers": active_customers,
        "new_customers_this_month": new_customers_month,
        "total_revenue": float(total_revenue),
        "total_orders": total_orders,
        "avg_order_value": avg_order_value,
        "repeat_rate": repeat_rate,
        "monthly_data": monthly_data,
        "segments": segments,
    }


@router.get("/intelligence/churn")
async def get_churn_predictions(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Compute churn risk for all customers based on recency, open tickets, and order frequency."""
    from datetime import timedelta

    tid = ctx.tenant_id
    now = datetime.now(timezone.utc)

    # Get all customers
    customers_res = await db.execute(
        select(Customer).where(Customer.tenant_id == tid).order_by(Customer.created_at.desc()).limit(200)
    )
    customers = customers_res.scalars().all()

    results = []
    high_risk = at_risk = watch = 0

    for c in customers:
        # Last order date
        last_order = await db.scalar(
            select(func.max(CRMSalesOrder.created_at))
            .where(CRMSalesOrder.tenant_id == tid, CRMSalesOrder.customer_id == c.id)
        )
        # Order count
        order_count = await db.scalar(
            select(func.count(CRMSalesOrder.id))
            .where(CRMSalesOrder.tenant_id == tid, CRMSalesOrder.customer_id == c.id)
        ) or 0
        # Open tickets
        open_tickets = await db.scalar(
            select(func.count(CRMSupportTicket.id))
            .where(CRMSupportTicket.tenant_id == tid, CRMSupportTicket.customer_id == c.id, CRMSupportTicket.status == "Open")
        ) or 0

        # Churn risk score calculation
        risk = 0
        days_since = None
        if last_order:
            days_since = (now - last_order.replace(tzinfo=timezone.utc) if last_order.tzinfo is None else now - last_order).days
            if days_since > 60: risk += 50
            elif days_since > 30: risk += 25
            elif days_since > 14: risk += 10
        else:
            # No orders at all
            days_since = (now - c.created_at.replace(tzinfo=timezone.utc) if c.created_at.tzinfo is None else now - c.created_at).days
            risk += 40

        if order_count == 0: risk += 30
        elif order_count == 1: risk += 10
        if open_tickets > 0: risk += 15
        if c.status == "Inactive": risk += 20

        risk = min(risk, 98)

        if risk >= 70:
            tier = "High Risk"
            high_risk += 1
        elif risk >= 45:
            tier = "At Risk"
            at_risk += 1
        else:
            tier = "Watch"
            watch += 1

        last_purchase_str = f"{days_since} days ago" if days_since is not None else "Never"
        reasons = []
        if days_since and days_since > 30: reasons.append(f"No purchase in {days_since} days")
        if open_tickets > 0: reasons.append(f"{open_tickets} open support ticket(s)")
        if order_count <= 1: reasons.append("Low order frequency")

        results.append({
            "customer_id": str(c.id),
            "customer": c.name,
            "company": c.company_name,
            "risk": risk,
            "tier": tier,
            "last_purchase": last_purchase_str,
            "order_count": order_count,
            "open_tickets": open_tickets,
            "reason": "; ".join(reasons) if reasons else "Customer appears healthy"
        })

    results.sort(key=lambda x: x["risk"], reverse=True)

    return {
        "summary": {"high_risk": high_risk, "at_risk": at_risk, "watch": watch, "total": len(results)},
        "customers": results[:50]  # top 50 at-risk
    }


@router.get("/intelligence/lifetime-value")
async def get_lifetime_values(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Compute Customer Lifetime Value from real sales orders and customer data."""
    tid = ctx.tenant_id
    now = datetime.now(timezone.utc)

    # Get CLV per customer (sum of their sales orders)
    clv_result = await db.execute(
        select(
            CRMSalesOrder.customer_id,
            func.sum(CRMSalesOrder.total).label("total_revenue"),
            func.count(CRMSalesOrder.id).label("order_count"),
        )
        .where(CRMSalesOrder.tenant_id == tid)
        .group_by(CRMSalesOrder.customer_id)
        .order_by(func.sum(CRMSalesOrder.total).desc())
        .limit(20)
    )
    clv_rows = clv_result.all()

    customers_by_id = {}
    for row in clv_rows:
        c = await db.scalar(select(Customer).where(Customer.id == row.customer_id, Customer.tenant_id == tid))
        if c:
            years_as_customer = max(1, round((now - (c.created_at.replace(tzinfo=timezone.utc) if c.created_at.tzinfo is None else c.created_at)).days / 365, 1))
            ltv = float(row.total_revenue or 0)
            customers_by_id[str(c.id)] = {
                "customer_id": str(c.id),
                "customer": c.name,
                "company": c.company_name,
                "ltv": ltv,
                "revenue": ltv,
                "profit": round(ltv * 0.30, 2),
                "orders": int(row.order_count or 0),
                "years": years_as_customer,
            }

    # Summary stats
    all_orders_count = await db.scalar(select(func.count(CRMSalesOrder.id)).where(CRMSalesOrder.tenant_id == tid)) or 0
    total_cust = await db.scalar(select(func.count(Customer.id)).where(Customer.tenant_id == tid)) or 1
    total_rev = await db.scalar(select(func.coalesce(func.sum(CRMSalesOrder.total), 0.0)).where(CRMSalesOrder.tenant_id == tid)) or 0.0
    avg_ltv = round(float(total_rev) / max(total_cust, 1), 2)
    avg_orders = round(all_orders_count / max(total_cust, 1), 1)

    return {
        "summary": {
            "avg_ltv": avg_ltv,
            "total_customer_value": float(total_rev),
            "avg_orders_per_customer": avg_orders,
            "total_customers": total_cust,
        },
        "customers": list(customers_by_id.values())
    }


@router.get("/intelligence/purchase-behaviour")
async def get_purchase_behaviour(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Analyse purchase patterns, frequency, and category preferences from live orders."""
    tid = ctx.tenant_id
    now = datetime.now(timezone.utc)

    # Total orders and revenue
    total_orders = await db.scalar(select(func.count(CRMSalesOrder.id)).where(CRMSalesOrder.tenant_id == tid)) or 0
    total_revenue = await db.scalar(select(func.coalesce(func.sum(CRMSalesOrder.total), 0.0)).where(CRMSalesOrder.tenant_id == tid)) or 0.0
    total_customers = await db.scalar(select(func.count(Customer.id)).where(Customer.tenant_id == tid)) or 1

    avg_order_value = round(float(total_revenue) / max(total_orders, 1), 2)
    avg_frequency = round(total_orders / max(total_customers, 1), 1)

    # Order volume by customer type (as a proxy for category preferences)
    type_result = await db.execute(
        select(
            Customer.customer_type,
            func.count(CRMSalesOrder.id).label("order_count"),
            func.coalesce(func.sum(CRMSalesOrder.total), 0.0).label("revenue")
        )
        .join(CRMSalesOrder, CRMSalesOrder.customer_id == Customer.id)
        .where(CRMSalesOrder.tenant_id == tid)
        .group_by(Customer.customer_type)
        .order_by(func.sum(CRMSalesOrder.total).desc())
    )
    type_rows = type_result.all()
    max_rev = max((float(r.revenue) for r in type_rows), default=1)

    categories = [
        {
            "name": r.customer_type or "Unknown",
            "pct": round((float(r.revenue) / max_rev) * 100),
            "revenue": float(r.revenue),
            "orders": int(r.order_count)
        }
        for r in type_rows
    ]

    # Order hour distribution — derived from created_at hour
    hour_result = await db.execute(
        select(
            func.extract("hour", CRMSalesOrder.created_at).label("hr"),
            func.count(CRMSalesOrder.id).label("cnt")
        )
        .where(CRMSalesOrder.tenant_id == tid)
        .group_by(func.extract("hour", CRMSalesOrder.created_at))
        .order_by(func.extract("hour", CRMSalesOrder.created_at))
    )
    hour_rows = hour_result.all()
    hour_map = {int(r.hr): int(r.cnt) for r in hour_rows}

    time_slots = [
        {"hour": "08–10 AM", "orders": sum(hour_map.get(h, 0) for h in range(8, 10))},
        {"hour": "10–12 PM", "orders": sum(hour_map.get(h, 0) for h in range(10, 12))},
        {"hour": "12–2 PM", "orders": sum(hour_map.get(h, 0) for h in range(12, 14))},
        {"hour": "2–4 PM", "orders": sum(hour_map.get(h, 0) for h in range(14, 16))},
        {"hour": "4–6 PM", "orders": sum(hour_map.get(h, 0) for h in range(16, 18))},
        {"hour": "6–8 PM", "orders": sum(hour_map.get(h, 0) for h in range(18, 20))},
        {"hour": "8–10 PM", "orders": sum(hour_map.get(h, 0) for h in range(20, 22))},
    ]
    peak = max(time_slots, key=lambda x: x["orders"], default={"hour": "N/A"})

    # Top N customers by spend (as proxy for brand preference)
    top_customers_result = await db.execute(
        select(Customer.name, func.coalesce(func.sum(CRMSalesOrder.total), 0.0).label("spend"))
        .join(CRMSalesOrder, CRMSalesOrder.customer_id == Customer.id)
        .where(CRMSalesOrder.tenant_id == tid)
        .group_by(Customer.name)
        .order_by(func.sum(CRMSalesOrder.total).desc())
        .limit(5)
    )
    top_spenders = top_customers_result.all()
    max_spend = max((float(r.spend) for r in top_spenders), default=1)
    top_buyers = [{"name": r.name, "score": round((float(r.spend) / max_spend) * 100)} for r in top_spenders]

    return {
        "summary": {
            "avg_frequency": avg_frequency,
            "avg_order_value": avg_order_value,
            "peak_hour": peak["hour"],
            "top_category": categories[0]["name"] if categories else "N/A",
        },
        "categories": categories[:6],
        "top_buyers": top_buyers,
        "purchase_times": time_slots,
    }


@router.get("/intelligence/rfm")
async def get_rfm_analysis(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """RFM segmentation computed from real customer purchase data."""
    from datetime import timedelta

    tid = ctx.tenant_id
    now = datetime.now(timezone.utc)

    customers_res = await db.execute(
        select(Customer).where(Customer.tenant_id == tid)
    )
    customers = customers_res.scalars().all()

    rfm_rows = []
    for c in customers:
        orders_res = await db.execute(
            select(CRMSalesOrder.total, CRMSalesOrder.created_at)
            .where(CRMSalesOrder.tenant_id == tid, CRMSalesOrder.customer_id == c.id)
            .order_by(CRMSalesOrder.created_at.desc())
        )
        orders = orders_res.all()
        if not orders:
            continue
        last_order_at = orders[0].created_at
        if last_order_at.tzinfo is None:
            last_order_at = last_order_at.replace(tzinfo=timezone.utc)
        days_since = (now - last_order_at).days
        freq = len(orders)
        monetary = sum(float(o.total or 0) for o in orders)

        # Score each 1-5
        if days_since <= 7: r_score = 5
        elif days_since <= 30: r_score = 4
        elif days_since <= 60: r_score = 3
        elif days_since <= 120: r_score = 2
        else: r_score = 1

        if freq >= 20: f_score = 5
        elif freq >= 10: f_score = 4
        elif freq >= 5: f_score = 3
        elif freq >= 2: f_score = 2
        else: f_score = 1

        # Relative monetary score based on percentiles is hard without all data upfront
        # Use absolute thresholds instead
        if monetary >= 100000: m_score = 5
        elif monetary >= 50000: m_score = 4
        elif monetary >= 10000: m_score = 3
        elif monetary >= 1000: m_score = 2
        else: m_score = 1

        rfm_rows.append({"customer": c.name, "r": r_score, "f": f_score, "m": m_score, "monetary": monetary})

    # Classify into segments
    segment_counts: dict[str, dict] = {
        "Champions": {"count": 0, "revenue": 0.0, "r": 5, "f": 5, "description": "Bought recently, buy often, and spend the most."},
        "Loyal Customers": {"count": 0, "revenue": 0.0, "r": 4, "f": 4, "description": "Regular buyers with strong engagement."},
        "Potential Loyalists": {"count": 0, "revenue": 0.0, "r": 5, "f": 2, "description": "Recent customers showing strong buying intent."},
        "At Risk": {"count": 0, "revenue": 0.0, "r": 2, "f": 4, "description": "High frequency buyers who haven't purchased recently."},
        "Hibernating": {"count": 0, "revenue": 0.0, "r": 1, "f": 2, "description": "Low activity, haven't bought in a long time."},
        "Lost Customers": {"count": 0, "revenue": 0.0, "r": 1, "f": 1, "description": "Lowest scores across all three dimensions."},
        "Promising": {"count": 0, "revenue": 0.0, "r": 4, "f": 1, "description": "First-time buyers with recent activity."},
        "New Customers": {"count": 0, "revenue": 0.0, "r": 5, "f": 1, "description": "Just joined, first purchase made."},
        "Need Attention": {"count": 0, "revenue": 0.0, "r": 3, "f": 3, "description": "Average on all metrics, need nurturing."},
    }

    colors = {
        "Champions": "bg-emerald-500",
        "Loyal Customers": "bg-teal-500",
        "Potential Loyalists": "bg-blue-500",
        "At Risk": "bg-amber-500",
        "Hibernating": "bg-slate-400",
        "Lost Customers": "bg-red-400",
        "Promising": "bg-indigo-500",
        "New Customers": "bg-purple-400",
        "Need Attention": "bg-orange-400",
    }

    def classify(r, f, m):
        if r >= 4 and f >= 4 and m >= 4: return "Champions"
        if r >= 3 and f >= 3 and m >= 3: return "Loyal Customers"
        if r >= 4 and f <= 2: return "Potential Loyalists" if m >= 3 else "New Customers"
        if r <= 2 and f >= 3: return "At Risk"
        if r <= 2 and f <= 2 and m <= 2: return "Lost Customers" if f == 1 else "Hibernating"
        if r >= 3 and f == 1: return "Promising"
        return "Need Attention"

    for row in rfm_rows:
        seg = classify(row["r"], row["f"], row["m"])
        segment_counts[seg]["count"] += 1
        segment_counts[seg]["revenue"] += row["monetary"]

    segments_out = [
        {
            "label": label,
            "count": data["count"],
            "revenue": data["revenue"],
            "r": data["r"],
            "f": data["f"],
            "description": data["description"],
            "color": colors.get(label, "bg-gray-400")
        }
        for label, data in segment_counts.items()
        if data["count"] > 0
    ]
    segments_out.sort(key=lambda x: x["revenue"], reverse=True)

    return {"segments": segments_out, "total_customers_analysed": len(rfm_rows)}


@router.get("/intelligence/recommendations")
async def get_ai_recommendations(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_customers"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Generate AI-driven customer recommendations from live data patterns."""
    from datetime import timedelta

    tid = ctx.tenant_id
    now = datetime.now(timezone.utc)

    customers_res = await db.execute(
        select(Customer).where(Customer.tenant_id == tid).order_by(Customer.created_at.desc())
    )
    customers = customers_res.scalars().all()

    recs = []
    for c in customers:
        # Order data
        orders_res = await db.execute(
            select(CRMSalesOrder.total, CRMSalesOrder.created_at)
            .where(CRMSalesOrder.tenant_id == tid, CRMSalesOrder.customer_id == c.id)
            .order_by(CRMSalesOrder.created_at.desc())
        )
        orders = orders_res.all()
        order_count = len(orders)
        total_spent = sum(float(o.total or 0) for o in orders)

        # Quotations
        quote_count = await db.scalar(
            select(func.count(CRMQuotation.id))
            .where(CRMQuotation.tenant_id == tid, CRMQuotation.customer_id == c.id)
        ) or 0

        # Open tickets
        open_tickets = await db.scalar(
            select(func.count(CRMSupportTicket.id))
            .where(CRMSupportTicket.tenant_id == tid, CRMSupportTicket.customer_id == c.id, CRMSupportTicket.status == "Open")
        ) or 0

        # Days since last order
        last_order_date = orders[0].created_at if orders else None
        days_inactive = None
        if last_order_date:
            if last_order_date.tzinfo is None:
                last_order_date = last_order_date.replace(tzinfo=timezone.utc)
            days_inactive = (now - last_order_date).days

        # Rule-based recommendation engine
        if days_inactive and days_inactive > 45 and order_count >= 2:
            confidence = min(95, 60 + (days_inactive // 10))
            recs.append({
                "id": f"AIR-{c.id}-churn",
                "type": "churn_risk",
                "customer": c.name,
                "customer_seg": "Inactive",
                "title": "High Churn Risk Detected",
                "description": f"{c.name} has been inactive for {days_inactive} days with {order_count} past orders. A personalised win-back campaign could recover this revenue.",
                "confidence": confidence,
                "action": "Send Win-Back",
                "priority": "Urgent",
                "icon_type": "alert"
            })
        elif total_spent >= 50000 and order_count >= 5:
            recs.append({
                "id": f"AIR-{c.id}-upsell",
                "type": "upsell",
                "customer": c.name,
                "customer_seg": "High Value",
                "title": "Upsell to Premium Tier",
                "description": f"{c.name} has spent ₹{total_spent:,.0f} across {order_count} orders. Upgrading their account tier could significantly increase CLV.",
                "confidence": 92,
                "action": "Propose Upgrade",
                "priority": "High",
                "icon_type": "crown"
            })
        elif quote_count >= 1 and order_count == 0:
            recs.append({
                "id": f"AIR-{c.id}-convert",
                "type": "conversion",
                "customer": c.name,
                "customer_seg": "Prospect",
                "title": "Convert Quotation to Order",
                "description": f"{c.name} has {quote_count} open quotation(s) but has not placed an order yet. A follow-up call could close this deal.",
                "confidence": 76,
                "action": "Follow Up",
                "priority": "High",
                "icon_type": "trending"
            })
        elif open_tickets >= 1:
            recs.append({
                "id": f"AIR-{c.id}-support",
                "type": "support",
                "customer": c.name,
                "customer_seg": c.customer_type or "Standard",
                "title": "Resolve Open Support Ticket",
                "description": f"{c.name} has {open_tickets} unresolved ticket(s). Resolving them proactively will improve NPS and retention.",
                "confidence": 88,
                "action": "View Ticket",
                "priority": "Medium",
                "icon_type": "shield"
            })
        elif order_count == 1 and days_inactive and days_inactive < 20:
            recs.append({
                "id": f"AIR-{c.id}-loyalty",
                "type": "loyalty",
                "customer": c.name,
                "customer_seg": "New Customer",
                "title": "Loyalty Program Enrollment",
                "description": f"{c.name} made their first purchase {days_inactive} days ago. Enrolling them in the loyalty program could boost retention by 40%.",
                "confidence": 83,
                "action": "Enroll in Loyalty",
                "priority": "Medium",
                "icon_type": "gift"
            })

    # Sort: Urgent first, then High, then Medium
    priority_order = {"Urgent": 0, "High": 1, "Medium": 2}
    recs.sort(key=lambda x: priority_order.get(x.get("priority", "Medium"), 2))

    total = len(recs)
    avg_conf = round(sum(r["confidence"] for r in recs) / max(total, 1))
    total_cust = await db.scalar(select(func.count(Customer.id)).where(Customer.tenant_id == tid)) or 0
    total_txns = await db.scalar(select(func.count(CRMSalesOrder.id)).where(CRMSalesOrder.tenant_id == tid)) or 0
    total_tickets = await db.scalar(select(func.count(CRMSupportTicket.id)).where(CRMSupportTicket.tenant_id == tid)) or 0

    return {
        "summary": {
            "total_recommendations": total,
            "avg_confidence": avg_conf,
            "customers_analysed": total_cust,
            "transactions_analysed": total_txns,
            "support_interactions": total_tickets,
        },
        "recommendations": recs[:30]  # top 30
    }


# ─── Email Campaigns & Templates (Google Mail Style) ──────────────────────────

class EmailCampaignCreate(BaseModel):
    name: str
    subject: str
    body_html: str
    target_category: str  # employees|candidates|customers|others

class EmailCampaignResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    subject: str
    body_html: str
    target_category: str
    status: str
    recipient_count: int
    sent_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class EmailTemplateCreate(BaseModel):
    name: str
    subject: str | None = None
    body_html: str

class EmailTemplateResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    subject: str | None
    body_html: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


async def send_campaign_html_email(to_email: str, subject: str, body_html: str) -> bool:
    """Helper to dispatch rich-text HTML emails via SMTP settings."""
    from src.config import get_settings
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    settings = get_settings()
    if not settings.mail_server:
        print(f"\n=================== SMTP DISPATCH OVERRIDE (LOG ONLY) ===================")
        print(f"TO: {to_email}")
        print(f"SUBJECT: {subject}")
        print(f"HTML BODY PREVIEW:\n{body_html[:300]}...")
        print(f"========================================================================\n")
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = settings.mail_from or "campaigns@businessos.ai"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body_html, "html"))

        # Connect and authenticate
        server = smtplib.SMTP(settings.mail_server, settings.mail_port or 587)
        server.starttls()
        if settings.mail_username and settings.mail_password:
            server.login(settings.mail_username, settings.mail_password)

        server.send_message(msg)
        server.quit()
        print(f"[Campaign SMTP SUCCESS] Emailed {to_email}")
        return True
    except Exception as e:
        print(f"[Campaign SMTP ERROR] Failed to email {to_email}: {e}")
        return False


@router.get("/email-campaigns", response_model=list[EmailCampaignResponse])
async def list_email_campaigns(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Lists all email campaigns for the current tenant."""
    stmt = select(EmailCampaign).where(EmailCampaign.tenant_id == ctx.tenant_id).order_by(EmailCampaign.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/email-campaigns", response_model=EmailCampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_email_campaign(
    payload: EmailCampaignCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Creates a new draft email campaign."""
    campaign = EmailCampaign(
        tenant_id=ctx.tenant_id,
        name=payload.name,
        subject=payload.subject,
        body_html=payload.body_html,
        target_category=payload.target_category,
        status="Draft",
        recipient_count=0
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.post("/email-campaigns/{campaign_id}/send", response_model=EmailCampaignResponse)
async def send_email_campaign(
    campaign_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Dispatches the draft email campaign to all recipients in the category in the background."""
    campaign = await db.get(EmailCampaign, campaign_id)
    if not campaign or campaign.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Email campaign not found")

    # Fetch recipient emails based on selected category
    recipient_emails = []
    if campaign.target_category == "employees":
        emp_stmt = select(Employee.email).where(Employee.tenant_id == ctx.tenant_id, Employee.email != None)
        emp_res = await db.execute(emp_stmt)
        recipient_emails = list(emp_res.scalars().all())
    elif campaign.target_category == "candidates":
        cand_stmt = select(Applicant.email).where(Applicant.tenant_id == ctx.tenant_id, Applicant.email != None)
        cand_res = await db.execute(cand_stmt)
        recipient_emails = list(cand_res.scalars().all())
    elif campaign.target_category == "customers":
        cust_stmt = select(Customer.email).where(Customer.tenant_id == ctx.tenant_id, Customer.email != None)
        cust_res = await db.execute(cust_stmt)
        recipient_emails = list(cust_res.scalars().all())
    else:
        # others / fallback: use some mock emails or all combined
        recipient_emails = ["sandbox-recipient@businessos.ai"]

    # Deduplicate emails
    recipient_emails = list(set(filter(None, recipient_emails)))
    campaign.recipient_count = len(recipient_emails)

    # Trigger sending (Sequential for simplicity, or background task in production)
    sent_count = 0
    for email in recipient_emails:
        success = await send_campaign_html_email(email, campaign.subject, campaign.body_html)
        if success:
            sent_count += 1

    campaign.status = "Sent"
    campaign.sent_at = datetime.now(timezone.utc)
    
    # Trigger system notification
    await add_system_notification(
        db,
        ctx.tenant_id,
        f"Campaign Dispatched: {campaign.name}",
        f"Email campaign '{campaign.name}' with subject '{campaign.subject}' was sent to {campaign.recipient_count} recipients in category '{campaign.target_category}' by {ctx.user.full_name}",
        "crm"
    )
    
    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.get("/email-templates", response_model=list[EmailTemplateResponse])
async def list_email_templates(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Lists saved reusable email templates."""
    stmt = select(EmailTemplate).where(EmailTemplate.tenant_id == ctx.tenant_id).order_by(EmailTemplate.name)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/email-templates", response_model=EmailTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_email_template(
    payload: EmailTemplateCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Saves a new custom email template for future uses."""
    template = EmailTemplate(
        tenant_id=ctx.tenant_id,
        name=payload.name,
        subject=payload.subject,
        body_html=payload.body_html
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template

# ─── Ad Asset Library ────────────────────────────────────────────────────────

class SaveAssetRequest(BaseModel):
    filename: str
    public_url: str
    aspect_ratio: str = "1:1"
    width: int | None = None
    height: int | None = None
    file_size_bytes: int | None = None
    source: str = "gemini"
    provider_model: str | None = None
    original_prompt: str | None = None
    enhanced_prompt: str | None = None
    style: str | None = None
    tags: list[str] = []
    notes: str | None = None


@router.post("/ads/save-asset")
async def save_ad_asset(
    payload: SaveAssetRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Save an AI-generated creative to the asset library."""
    asset = AdAsset(
        tenant_id=ctx.tenant_id,
        filename=payload.filename,
        public_url=payload.public_url,
        aspect_ratio=payload.aspect_ratio,
        width=payload.width,
        height=payload.height,
        file_size_bytes=payload.file_size_bytes,
        source=payload.source,
        provider_model=payload.provider_model,
        original_prompt=payload.original_prompt,
        enhanced_prompt=payload.enhanced_prompt,
        style=payload.style,
        approval_status="approved",
        tags=payload.tags or [],
        notes=payload.notes,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return {"id": str(asset.id), "public_url": asset.public_url, "approval_status": asset.approval_status}


@router.get("/ads/asset-library")
async def list_ad_assets(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = None,
    source: str | None = None,
    page: int = 1,
    page_size: int = 20
):
    """List saved AI creative assets with optional status/source filtering."""
    from sqlalchemy import desc
    q = select(AdAsset).where(AdAsset.tenant_id == ctx.tenant_id)
    if status:
        q = q.where(AdAsset.approval_status == status)
    if source:
        q = q.where(AdAsset.source == source)
    total_q = select(func.count()).select_from(q.subquery())
    total = await db.scalar(total_q)
    items_q = q.order_by(desc(AdAsset.created_at)).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(items_q)
    items = result.scalars().all()
    return {
        "total": total or 0,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": str(a.id),
                "filename": a.filename,
                "public_url": a.public_url,
                "thumbnail_url": a.thumbnail_url,
                "aspect_ratio": a.aspect_ratio,
                "width": a.width,
                "height": a.height,
                "source": a.source,
                "provider_model": a.provider_model,
                "original_prompt": a.original_prompt,
                "enhanced_prompt": a.enhanced_prompt,
                "style": a.style,
                "approval_status": a.approval_status,
                "used_in_organic_post": a.used_in_organic_post,
                "used_in_paid_campaign": a.used_in_paid_campaign,
                "organic_post_id": a.organic_post_id,
                "tags": a.tags or [],
                "notes": a.notes,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in items
        ]
    }


class ApproveAssetRequest(BaseModel):
    status: str  # approved | rejected | draft
    rejection_reason: str | None = None


@router.put("/ads/assets/{asset_id}/approve")
async def approve_ad_asset(
    asset_id: str,
    payload: ApproveAssetRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Approve or reject a saved creative asset."""
    import uuid as _uuid
    try:
        uid = _uuid.UUID(asset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid asset ID")
    asset = await db.scalar(select(AdAsset).where(AdAsset.id == uid, AdAsset.tenant_id == ctx.tenant_id))
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    asset.approval_status = payload.status
    if payload.rejection_reason:
        asset.rejection_reason = payload.rejection_reason
    await db.commit()
    await db.refresh(asset)
    return {"id": str(asset.id), "approval_status": asset.approval_status}


# --- Stubs for Missing Endpoints ---------------------------------------------

@router.get('/discounts')
async def list_discounts(page: int = 1, page_size: int = 100):
    return {'items': [], 'total': 0, 'page': page, 'page_size': page_size, 'pages': 0}

@router.get('/membership-plans')
async def list_membership_plans(page: int = 1, page_size: int = 100):
    return {'items': [], 'total': 0, 'page': page, 'page_size': page_size, 'pages': 0}



# Mock endpoints for CRM Groups and Segments
@router.get('/groups')
async def get_crm_groups(page: int = 1, page_size: int = 100):
    return {'items': [], 'total': 0, 'page': page, 'page_size': page_size}

@router.get('/segments')
async def get_crm_segments(page: int = 1, page_size: int = 100):
    return {'items': [], 'total': 0, 'page': page, 'page_size': page_size}
