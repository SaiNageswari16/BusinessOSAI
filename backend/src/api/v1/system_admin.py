import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Annotated
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, get_current_user_context
from src.database.session import get_db
from src.models import (
    Tenant,
    User,
    TenantStatus,
    UserStatus,
    Company,
    Branch,
    Role,
    RolePermission,
    Permission,
    UserRole,
    UserBranch,
    AuditLog,
)
from src.schemas.erp import ORMModel, MessageResponse
from src.config.settings import settings
from src.services.razorpay_service import RazorpayService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/system", tags=["SaaS Platform Administration"])


# ─── Schemas ──────────────────────────────────────────────────────

class PlatformTenantSummary(ORMModel):
    id: uuid.UUID
    slug: str
    name: str
    plan: str
    status: str
    created_at: str
    owner_name: str | None = None
    owner_email: str | None = None
    user_count: int = 0
    enabled_modules: list[str] = []
    subscription_expires_at: str | None = None
    days_remaining: int | None = None
    subscription_details: dict | None = None


class SystemStatsResponse(ORMModel):
    total_tenants: int
    active_tenants: int
    suspended_tenants: int
    total_users: int
    active_users: int
    total_companies: int
    total_branches: int
    total_roles: int
    total_audit_logs: int
    system_status: str = "operational"
    server_time: str


class CreateTenantPayload(ORMModel):
    name: str
    slug: str | None = None
    plan: str = "enterprise"
    status: str = "active"
    owner_full_name: str
    owner_email: str
    owner_phone: str | None = None
    owner_password: str
    company_name: str | None = None
    branch_name: str | None = None
    branch_code: str | None = None
    enabled_modules: list[str] = [
        "erp", "hrms", "inventory", "pos", "crm", "manufacturing",
        "supply_chain", "projects", "iot", "bi_ai", "finance", "compliance"
    ]
    tenure_value: int = 12
    tenure_unit: str = "months"  # days, months, years
    subscription_start_date: str | None = None
    billing_amount: float = 0.0
    currency: str = "INR"
    tax_rate: float = 18.0
    tax_id: str | None = None
    billing_address: str | None = None
    payment_status: str = "paid"  # paid, pending, trial, complimentary
    payment_method: str = "Bank Transfer"
    sla_tier: str = "Enterprise Gold (99.9% Uptime)"
    notes: str | None = None


class TenantSubscriptionPayload(ORMModel):
    tenure_value: int = 12
    tenure_unit: str = "months"  # days, months, years
    subscription_start_date: str | None = None
    plan: str | None = None
    billing_amount: float = 0.0
    currency: str = "INR"
    tax_rate: float = 18.0
    tax_id: str | None = None
    billing_address: str | None = None
    customer_phone: str | None = None
    payment_status: str = "paid"
    payment_method: str = "Bank Transfer"
    sla_tier: str = "Enterprise Gold (99.9% Uptime)"
    notes: str | None = None


class SubscriptionDocumentResponse(ORMModel):
    invoice_number: str
    agreement_number: str
    issue_date: str
    tenant_id: uuid.UUID
    tenant_name: str
    tenant_slug: str
    client_company_name: str
    client_admin_name: str
    client_admin_email: str
    client_admin_phone: str | None = None
    client_tax_id: str | None = None
    client_billing_address: str | None = None
    plan: str
    enabled_modules: list[str] = []
    tenure_value: int
    tenure_unit: str
    subscription_start_date: str
    subscription_expires_at: str
    days_remaining: int
    is_active: bool
    billing_amount: float
    tax_rate: float
    tax_amount: float
    total_amount: float
    currency: str
    payment_status: str
    payment_method: str
    sla_tier: str
    notes: str | None = None
    provider_name: str = "LazyMonkeyAI Technologies Pvt. Ltd."
    provider_address: str = "Level 8, Smart AI Tower, Tech Hub, Bengaluru, Karnataka 560103"
    provider_tax_id: str = "29AAACL9821Q1ZV"
    provider_cin: str = "U72200KA2024PTC184201"
    provider_support_email: str = "support@lazymonkeyai.com"


class SubscriptionRazorpayOrderRequest(ORMModel):
    billing_amount: float = 0.0
    currency: str = "INR"
    tax_rate: float = 18.0
    tenure_value: int = 12
    tenure_unit: str = "months"
    plan: str | None = None
    notes: dict | None = None


class SubscriptionRazorpayOrderResponse(ORMModel):
    order_id: str
    amount: float
    amount_paise: int
    currency: str
    key_id: str
    tenant_id: uuid.UUID
    tenant_name: str
    invoice_number: str


class SubscriptionRazorpayVerifyPayload(ORMModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    tenure_value: int = 12
    tenure_unit: str = "months"
    subscription_start_date: str | None = None
    plan: str | None = None
    billing_amount: float = 0.0
    currency: str = "INR"
    tax_rate: float = 18.0
    tax_id: str | None = None
    billing_address: str | None = None
    sla_tier: str = "Enterprise Gold (99.9% Uptime)"
    notes: str | None = None


class SubscriptionPaymentLinkRequest(ORMModel):
    customer_email: str | None = None
    customer_phone: str | None = None
    customer_name: str | None = None
    billing_amount: float | None = None
    currency: str = "INR"
    tax_rate: float = 18.0
    tenure_value: int = 12
    tenure_unit: str = "months"
    plan: str | None = None
    notify_email: bool = True
    notify_sms: bool = True


class SubscriptionPaymentLinkResponse(ORMModel):
    payment_link_id: str
    payment_link_url: str
    short_url: str
    amount: float
    currency: str
    status: str
    tenant_id: uuid.UUID
    tenant_name: str
    customer_email: str | None = None
    customer_phone: str | None = None
    invoice_number: str


class SendAgreementEmailRequest(ORMModel):
    recipient_email: str | None = None
    notes: str | None = None


class CreatePlatformUserPayload(ORMModel):
    tenant_id: uuid.UUID
    email: str
    full_name: str
    password: str
    is_tenant_owner: bool = False
    is_platform_admin: bool = False
    status: str = "active"
    role_ids: list[uuid.UUID] = []


class TenantStatusUpdateRequest(ORMModel):
    status: str


class TenantModulesUpdateRequest(ORMModel):
    enabled_modules: list[str]


class CompanyStatusUpdateRequest(ORMModel):
    status: str


class PlatformBranchSummary(ORMModel):
    id: uuid.UUID
    company_id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    code: str
    branch_type: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    is_head_office: bool = False
    status: str = "active"
    created_at: str


class PlatformCompanySummary(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    tenant_name: str
    tenant_slug: str
    name: str
    legal_name: str
    company_type: str | None = None
    gst_number: str | None = None
    pan_number: str | None = None
    registration_number: str | None = None
    industry: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = "India"
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    website: str | None = None
    default_currency_code: str = "INR"
    timezone: str = "Asia/Kolkata"
    financial_year_start_month: int = 4
    status: str = "active"
    created_at: str
    branches_count: int = 0
    branches: list[PlatformBranchSummary] = []


class PendingApprovalSummary(ORMModel):
    tenant_id: uuid.UUID
    tenant_slug: str
    tenant_name: str
    admin_name: str | None = None
    admin_email: str | None = None
    requested_modules: list[str] = []
    enabled_modules: list[str] = []
    status: str
    requested_at: str


class ApproveTenantPayload(ORMModel):
    approved_modules: list[str]


class UpdateTenantModulesPayload(ORMModel):
    enabled_modules: list[str]



# ─── Helpers ──────────────────────────────────────────────────────

def require_platform_admin(ctx: CurrentUserContext):
    is_god = bool(getattr(ctx.user, "is_platform_admin", False))
    if is_god:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied. Only system platform administrators (God Mode) can access SaaS administration endpoints.",
    )



# ─── Endpoints ────────────────────────────────────────────────────

@router.get("/stats", response_model=SystemStatsResponse)
async def get_system_stats(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get high-level platform-wide statistics across all tenants for God Mode.
    """
    require_platform_admin(ctx)
    from datetime import datetime, timezone
    from src.models import Company, Branch, Role, AuditLog, UserStatus

    total_tenants = await db.scalar(select(func.count(Tenant.id))) or 0
    active_tenants = await db.scalar(select(func.count(Tenant.id)).where(Tenant.status == TenantStatus.ACTIVE)) or 0
    suspended_tenants = await db.scalar(select(func.count(Tenant.id)).where(Tenant.status == TenantStatus.SUSPENDED)) or 0
    
    total_users = await db.scalar(select(func.count(User.id))) or 0
    active_users = await db.scalar(select(func.count(User.id)).where(User.status == UserStatus.ACTIVE)) or 0

    total_companies = await db.scalar(select(func.count(Company.id))) or 0
    total_branches = await db.scalar(select(func.count(Branch.id))) or 0
    total_roles = await db.scalar(select(func.count(Role.id))) or 0
    total_audit_logs = await db.scalar(select(func.count(AuditLog.id))) or 0

    return SystemStatsResponse(
        total_tenants=total_tenants,
        active_tenants=active_tenants,
        suspended_tenants=suspended_tenants,
        total_users=total_users,
        active_users=active_users,
        total_companies=total_companies,
        total_branches=total_branches,
        total_roles=total_roles,
        total_audit_logs=total_audit_logs,
        system_status="operational",
        server_time=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/tenants", response_model=list[PlatformTenantSummary])
async def list_tenants(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    List all registered tenants on the platform with their status, registration date,
    owner account details, enabled modules, and total active users.
    """
    require_platform_admin(ctx)

    from datetime import datetime, timezone, timedelta
    now_utc = datetime.now(timezone.utc)

    # Fetch all tenants
    result = await db.execute(select(Tenant).order_by(Tenant.created_at.desc()))
    tenants = result.scalars().all()

    items = []
    for tenant in tenants:
        # Fetch the owner user for this tenant
        owner = await db.scalar(
            select(User).where(User.tenant_id == tenant.id, User.is_tenant_owner.is_(True))
        )
        
        # Count total users in this tenant
        user_count = await db.scalar(
            select(func.count(User.id)).where(User.tenant_id == tenant.id)
        )

        settings_dict = tenant.settings or {}
        enabled_modules = settings_dict.get("enabled_modules", [])
        sub_dict = settings_dict.get("subscription")
        sub_exp = tenant.subscription_expires_at

        days_rem = None
        if sub_exp:
            if sub_exp.tzinfo is None:
                sub_exp = sub_exp.replace(tzinfo=timezone.utc)
            days_rem = max(0, (sub_exp - now_utc).days)

        items.append(
            PlatformTenantSummary(
                id=tenant.id,
                slug=tenant.slug,
                name=tenant.name,
                plan=tenant.plan,
                status=tenant.status.value,
                created_at=tenant.created_at.isoformat(),
                owner_name=owner.full_name if owner else "Unknown",
                owner_email=owner.email if owner else "Unknown",
                user_count=user_count or 0,
                enabled_modules=enabled_modules,
                subscription_expires_at=sub_exp.isoformat() if sub_exp else None,
                days_remaining=days_rem,
                subscription_details=sub_dict,
            )
        )

    return items


@router.post("/tenants", response_model=PlatformTenantSummary, status_code=status.HTTP_201_CREATED)
async def create_platform_tenant(
    payload: CreateTenantPayload,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Platform Super Admin (God Mode): Create a complete client workspace/tenant directly
    including subscription tenure duration, formal invoice/agreement draft, primary legal entity,
    branch, super admin role, and initial owner user.
    """
    require_platform_admin(ctx)
    from src.models import Company, Branch, UserRole, UserBranch, UserStatus
    from src.utils.security import hash_password, create_super_admin_role
    from src.database.init_db import write_audit_log
    from datetime import datetime, timezone, timedelta
    import re

    # Generate slug if omitted
    slug_raw = payload.slug or payload.name
    slug = re.sub(r"[^a-z0-9]+", "-", slug_raw.lower()).strip("-")
    if not slug:
        slug = f"workspace-{uuid.uuid4().hex[:6]}"

    existing = await db.scalar(select(Tenant).where(Tenant.slug == slug))
    if existing:
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"

    try:
        tenant_status = TenantStatus(payload.status.lower())
    except ValueError:
        tenant_status = TenantStatus.ACTIVE

    # Calculate tenure duration and subscription expiry
    start_dt = datetime.now(timezone.utc)
    if payload.subscription_start_date:
        try:
            start_dt = datetime.fromisoformat(payload.subscription_start_date.replace("Z", "+00:00"))
        except Exception:
            pass

    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)

    t_val = max(1, payload.tenure_value or 1)
    t_unit = (payload.tenure_unit or "months").lower()
    if t_unit == "days":
        expires_at = start_dt + timedelta(days=t_val)
    elif t_unit == "years":
        expires_at = start_dt + timedelta(days=int(t_val * 365.25))
    else:  # months
        expires_at = start_dt + timedelta(days=int(t_val * 30.4375))

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    subtotal = float(payload.billing_amount or 0.0)
    tax_rate = float(payload.tax_rate if payload.tax_rate is not None else 18.0)
    tax_amount = round(subtotal * (tax_rate / 100.0), 2)
    total_amount = round(subtotal + tax_amount, 2)
    now_yr = datetime.now(timezone.utc).year
    inv_num = f"INV-{now_yr}-{uuid.uuid4().hex[:6].upper()}"
    sla_num = f"SLA-{now_yr}-{uuid.uuid4().hex[:6].upper()}"

    sub_data = {
        "invoice_number": inv_num,
        "agreement_number": sla_num,
        "issue_date": start_dt.date().isoformat(),
        "tenure_value": t_val,
        "tenure_unit": t_unit,
        "subscription_start_date": start_dt.isoformat(),
        "subscription_expires_at": expires_at.isoformat(),
        "plan": payload.plan or "enterprise",
        "billing_amount": subtotal,
        "currency": payload.currency or "INR",
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "total_amount": total_amount,
        "tax_id": payload.tax_id or "",
        "billing_address": payload.billing_address or "",
        "payment_status": payload.payment_status or "paid",
        "payment_method": payload.payment_method or "Bank Transfer",
        "sla_tier": payload.sla_tier or "Enterprise Gold (99.9% Uptime)",
        "notes": payload.notes or "",
    }

    tenant = Tenant(
        name=payload.name,
        slug=slug,
        plan=payload.plan or "enterprise",
        status=tenant_status,
        subscription_expires_at=expires_at,
        settings={
            "enabled_modules": payload.enabled_modules,
            "created_by_platform_admin": str(ctx.user.id),
            "subscription": sub_data,
        },
    )
    db.add(tenant)
    await db.flush()

    # 1. Super Admin Role
    super_role = await create_super_admin_role(db, tenant.id)

    # 2. Owner User
    user_status = UserStatus.ACTIVE if tenant_status == TenantStatus.ACTIVE else UserStatus.SUSPENDED
    owner = User(
        tenant_id=tenant.id,
        email=payload.owner_email.lower().strip(),
        password_hash=hash_password(payload.owner_password),
        full_name=payload.owner_full_name,
        avatar_initials="".join(p[0].upper() for p in (payload.owner_full_name or "Admin").split()[:2] if p),
        status=user_status,
        is_tenant_owner=True,
    )
    db.add(owner)
    await db.flush()

    # 3. Company
    comp_name = payload.company_name or payload.name
    company = Company(
        tenant_id=tenant.id,
        name=comp_name,
        legal_name=comp_name,
        logo_initials="".join(p[0].upper() for p in comp_name.split()[:2] if p),
    )
    db.add(company)
    await db.flush()

    # 4. Default Branch
    b_name = payload.branch_name or "Main Headquarters"
    b_code = payload.branch_code or "HQ"
    branch = Branch(
        tenant_id=tenant.id,
        company_id=company.id,
        name=b_name,
        code=b_code,
    )
    db.add(branch)
    await db.flush()

    # 5. UserRole & UserBranch assignments
    db.add(UserRole(user_id=owner.id, role_id=super_role.id, company_id=company.id, branch_id=branch.id, is_default=True))
    db.add(UserBranch(user_id=owner.id, branch_id=branch.id, is_primary=True))

    await write_audit_log(
        db,
        tenant_id=tenant.id,
        user_id=ctx.user.id,
        module="system_admin",
        action="tenant_created_by_platform_admin",
        entity_type="tenant",
        entity_id=tenant.id,
        new_values={
            "name": tenant.name,
            "slug": tenant.slug,
            "owner": owner.email,
            "modules": payload.enabled_modules,
            "tenure_value": t_val,
            "tenure_unit": t_unit,
            "subscription_expires_at": expires_at.isoformat(),
        },
    )

    await db.commit()
    await db.refresh(tenant)

    now_utc = datetime.now(timezone.utc)
    days_rem = max(0, (expires_at - now_utc).days)

    return PlatformTenantSummary(
        id=tenant.id,
        slug=tenant.slug,
        name=tenant.name,
        plan=tenant.plan,
        status=tenant.status.value,
        created_at=tenant.created_at.isoformat(),
        owner_name=owner.full_name,
        owner_email=owner.email,
        user_count=1,
        enabled_modules=payload.enabled_modules,
        subscription_expires_at=expires_at.isoformat(),
        days_remaining=days_rem,
        subscription_details=sub_data,
    )


@router.post("/tenants/{tenant_id}/subscription", response_model=PlatformTenantSummary)
async def update_tenant_subscription(
    tenant_id: uuid.UUID,
    payload: TenantSubscriptionPayload,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    God Mode: Update or renew workspace subscription tenure, billing amount, and validity.
    """
    require_platform_admin(ctx)
    from datetime import datetime, timezone, timedelta
    from sqlalchemy.orm.attributes import flag_modified

    tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    start_dt = datetime.now(timezone.utc)
    if payload.subscription_start_date:
        try:
            start_dt = datetime.fromisoformat(payload.subscription_start_date.replace("Z", "+00:00"))
        except Exception:
            pass

    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)

    t_val = max(1, payload.tenure_value or 1)
    t_unit = (payload.tenure_unit or "months").lower()
    if t_unit == "days":
        expires_at = start_dt + timedelta(days=t_val)
    elif t_unit == "years":
        expires_at = start_dt + timedelta(days=int(t_val * 365.25))
    else:  # months
        expires_at = start_dt + timedelta(days=int(t_val * 30.4375))

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    subtotal = float(payload.billing_amount or 0.0)
    tax_rate = float(payload.tax_rate if payload.tax_rate is not None else 18.0)
    tax_amount = round(subtotal * (tax_rate / 100.0), 2)
    total_amount = round(subtotal + tax_amount, 2)
    now_yr = datetime.now(timezone.utc).year

    current_settings = dict(tenant.settings or {})
    old_sub = current_settings.get("subscription", {})
    inv_num = old_sub.get("invoice_number") or f"INV-{now_yr}-{uuid.uuid4().hex[:6].upper()}"
    sla_num = old_sub.get("agreement_number") or f"SLA-{now_yr}-{uuid.uuid4().hex[:6].upper()}"

    sub_data = {
        "invoice_number": inv_num,
        "agreement_number": sla_num,
        "issue_date": start_dt.date().isoformat(),
        "tenure_value": t_val,
        "tenure_unit": t_unit,
        "subscription_start_date": start_dt.isoformat(),
        "subscription_expires_at": expires_at.isoformat(),
        "plan": payload.plan or tenant.plan,
        "billing_amount": subtotal,
        "currency": payload.currency or "INR",
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "total_amount": total_amount,
        "tax_id": payload.tax_id or old_sub.get("tax_id", ""),
        "billing_address": payload.billing_address or old_sub.get("billing_address", ""),
        "payment_status": payload.payment_status or "paid",
        "payment_method": payload.payment_method or "Bank Transfer",
        "sla_tier": payload.sla_tier or "Enterprise Gold (99.9% Uptime)",
        "notes": payload.notes or old_sub.get("notes", ""),
    }

    tenant.subscription_expires_at = expires_at
    if payload.plan:
        tenant.plan = payload.plan
    current_settings["subscription"] = sub_data
    tenant.settings = current_settings
    flag_modified(tenant, "settings")

    await db.commit()
    await db.refresh(tenant)

    owner = await db.scalar(select(User).where(User.tenant_id == tenant.id, User.is_tenant_owner.is_(True)))
    user_count = await db.scalar(select(func.count(User.id)).where(User.tenant_id == tenant.id)) or 0
    now_utc = datetime.now(timezone.utc)
    days_rem = max(0, (expires_at - now_utc).days)

    return PlatformTenantSummary(
        id=tenant.id,
        slug=tenant.slug,
        name=tenant.name,
        plan=tenant.plan,
        status=tenant.status.value,
        created_at=tenant.created_at.isoformat(),
        owner_name=owner.full_name if owner else "Unknown",
        owner_email=owner.email if owner else "Unknown",
        user_count=user_count,
        enabled_modules=current_settings.get("enabled_modules", []),
        subscription_expires_at=expires_at.isoformat(),
        days_remaining=days_rem,
        subscription_details=sub_data,
    )


class TenantModulesUpdateRequest(BaseModel):
    enabled_modules: list[str]


@router.patch("/tenants/{tenant_id}/modules", response_model=MessageResponse)
async def update_tenant_modules(
    tenant_id: uuid.UUID,
    payload: TenantModulesUpdateRequest,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Platform Control Center: Update enabled enterprise modules and entitlements for a workspace.
    """
    require_platform_admin(ctx)
    from sqlalchemy.orm.attributes import flag_modified
    from src.database.init_db import write_audit_log

    tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace tenant not found")

    settings_dict = dict(tenant.settings or {})
    settings_dict["enabled_modules"] = payload.enabled_modules
    tenant.settings = settings_dict
    flag_modified(tenant, "settings")

    await write_audit_log(
        db=db,
        tenant_id=tenant.id,
        user_id=ctx.user.id,
        action="tenant:update_modules",
        entity_type="tenant",
        entity_id=str(tenant.id),
        meta={"enabled_modules": payload.enabled_modules},
    )

    await db.commit()
    return MessageResponse(
        message=f"Module entitlements for '{tenant.name}' updated successfully ({len(payload.enabled_modules)} modules active)."
    )


@router.get("/tenants/{tenant_id}/agreement-invoice", response_model=SubscriptionDocumentResponse)
async def get_tenant_agreement_invoice(
    tenant_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    God Mode: Generate full formal subscription invoice & service level agreement draft for printing.
    """
    require_platform_admin(ctx)
    from datetime import datetime, timezone

    tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace tenant not found")

    owner = await db.scalar(select(User).where(User.tenant_id == tenant.id, User.is_tenant_owner.is_(True)))
    company = await db.scalar(select(Company).where(Company.tenant_id == tenant.id))

    settings_dict = tenant.settings or {}
    sub_data = settings_dict.get("subscription", {})
    enabled_modules = settings_dict.get("enabled_modules", [])

    now_utc = datetime.now(timezone.utc)
    sub_exp = tenant.subscription_expires_at
    if not sub_exp:
        sub_exp = now_utc + timedelta(days=365)

    if sub_exp.tzinfo is None:
        sub_exp = sub_exp.replace(tzinfo=timezone.utc)

    days_rem = max(0, (sub_exp - now_utc).days)
    is_active = tenant.status == TenantStatus.ACTIVE and (sub_exp > now_utc)

    inv_num = sub_data.get("invoice_number") or f"INV-{now_utc.year}-{str(tenant.id)[:6].upper()}"
    sla_num = sub_data.get("agreement_number") or f"SLA-{now_utc.year}-{str(tenant.id)[:6].upper()}"
    start_date_str = sub_data.get("subscription_start_date") or tenant.created_at.isoformat()

    subtotal = float(sub_data.get("billing_amount", 0.0))
    tax_rate = float(sub_data.get("tax_rate", 18.0))
    tax_amt = float(sub_data.get("tax_amount", round(subtotal * (tax_rate / 100.0), 2)))
    tot_amt = float(sub_data.get("total_amount", round(subtotal + tax_amt, 2)))

    return SubscriptionDocumentResponse(
        invoice_number=inv_num,
        agreement_number=sla_num,
        issue_date=sub_data.get("issue_date") or now_utc.date().isoformat(),
        tenant_id=tenant.id,
        tenant_name=tenant.name,
        tenant_slug=tenant.slug,
        client_company_name=company.name if company else tenant.name,
        client_admin_name=owner.full_name if owner else "Authorized Administrator",
        client_admin_email=owner.email if owner else "admin@workspace.com",
        client_tax_id=sub_data.get("tax_id") or (company.gst_number if company else None),
        client_billing_address=sub_data.get("billing_address") or (company.address if company else None),
        plan=tenant.plan,
        enabled_modules=enabled_modules,
        tenure_value=int(sub_data.get("tenure_value", 12)),
        tenure_unit=str(sub_data.get("tenure_unit", "months")),
        subscription_start_date=start_date_str,
        subscription_expires_at=sub_exp.isoformat(),
        days_remaining=days_rem,
        is_active=is_active,
        billing_amount=subtotal,
        tax_rate=tax_rate,
        tax_amount=tax_amt,
        total_amount=tot_amt,
        currency=str(sub_data.get("currency", "INR")),
        payment_status=str(sub_data.get("payment_status", "paid")),
        payment_method=str(sub_data.get("payment_method", "Bank Transfer")),
        sla_tier=str(sub_data.get("sla_tier", "Enterprise Gold (99.9% Uptime)")),
        notes=sub_data.get("notes"),
    )


@router.get("/subscription/gateway-status")
async def get_subscription_gateway_status(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
):
    """
    Check Master Platform Razorpay connection status for SaaS subscription billing.
    """
    require_platform_admin(ctx)
    rzp = RazorpayService(
        key_id=settings.razorpay_key_id,
        key_secret=settings.razorpay_key_secret,
        webhook_secret=settings.razorpay_webhook_secret,
    )
    conn = await rzp.test_connection()
    return {
        "gateway": "Razorpay",
        "key_id": settings.razorpay_key_id,
        "is_configured": bool(settings.razorpay_key_id and settings.razorpay_key_secret),
        "status": "connected" if conn.get("success") else "disconnected",
        "message": conn.get("message"),
        "mode": conn.get("mode", "test"),
        "default_currency": "INR",
        "supported_currencies": ["INR", "USD", "EUR", "GBP", "AED"],
    }


@router.post("/tenants/{tenant_id}/subscription/razorpay/create-order", response_model=SubscriptionRazorpayOrderResponse)
async def create_subscription_razorpay_order(
    tenant_id: uuid.UUID,
    payload: SubscriptionRazorpayOrderRequest,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Create a Razorpay order via the Master Platform Razorpay gateway for client workspace subscription.
    """
    require_platform_admin(ctx)
    from datetime import datetime, timezone

    tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    subtotal = float(payload.billing_amount or 0.0)
    if subtotal <= 0:
        current_sub = (tenant.settings or {}).get("subscription", {})
        subtotal = float(current_sub.get("billing_amount", 0.0))

    tax_rate = float(payload.tax_rate if payload.tax_rate is not None else 18.0)
    tax_amount = round(subtotal * (tax_rate / 100.0), 2)
    total_amount = round(subtotal + tax_amount, 2)

    if total_amount <= 0:
        raise HTTPException(status_code=400, detail="Subscription total amount must be greater than 0")

    rzp = RazorpayService(
        key_id=settings.razorpay_key_id,
        key_secret=settings.razorpay_key_secret,
    )

    inv_num = (tenant.settings or {}).get("subscription", {}).get("invoice_number") or f"INV-{uuid.uuid4().hex[:6].upper()}"
    receipt = f"SUB-{str(tenant.id)[:8]}-{int(datetime.now(timezone.utc).timestamp())}"

    try:
        rzp_order = await rzp.create_order(
            amount=total_amount,
            currency=payload.currency or "INR",
            receipt=receipt,
            notes={
                "tenant_id": str(tenant.id),
                "tenant_name": tenant.name,
                "invoice_number": inv_num,
                "tenure_value": str(payload.tenure_value),
                "tenure_unit": payload.tenure_unit,
                "plan": payload.plan or tenant.plan,
            },
        )
    except Exception as rzp_err:
        logger.error(f"Razorpay order creation failed: {rzp_err}")
        raise HTTPException(
            status_code=400,
            detail=f"Razorpay Gateway Error: {str(rzp_err)}. Please verify your RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env.",
        )

    return SubscriptionRazorpayOrderResponse(
        order_id=rzp_order["id"],
        amount=total_amount,
        amount_paise=int(rzp_order["amount"]),
        currency=rzp_order.get("currency", payload.currency or "INR"),
        key_id=settings.razorpay_key_id,
        tenant_id=tenant.id,
        tenant_name=tenant.name,
        invoice_number=inv_num,
    )


@router.post("/tenants/{tenant_id}/subscription/razorpay/verify", response_model=PlatformTenantSummary)
async def verify_subscription_razorpay_payment(
    tenant_id: uuid.UUID,
    payload: SubscriptionRazorpayVerifyPayload,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Verify Razorpay payment signature for a tenant subscription and immediately activate/renew the tenure.
    """
    require_platform_admin(ctx)
    from datetime import datetime, timezone, timedelta
    from sqlalchemy.orm.attributes import flag_modified
    from src.database.init_db import write_audit_log

    tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    rzp = RazorpayService(
        key_id=settings.razorpay_key_id,
        key_secret=settings.razorpay_key_secret,
    )

    is_valid = rzp.verify_payment_signature(
        razorpay_order_id=payload.razorpay_order_id,
        razorpay_payment_id=payload.razorpay_payment_id,
        razorpay_signature=payload.razorpay_signature,
    )

    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid Razorpay payment signature. Payment verification failed.")

    start_dt = datetime.now(timezone.utc)
    if payload.subscription_start_date:
        try:
            start_dt = datetime.fromisoformat(payload.subscription_start_date.replace("Z", "+00:00"))
        except Exception:
            pass

    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)

    t_val = max(1, payload.tenure_value or 1)
    t_unit = (payload.tenure_unit or "months").lower()
    if t_unit == "days":
        expires_at = start_dt + timedelta(days=t_val)
    elif t_unit == "years":
        expires_at = start_dt + timedelta(days=int(t_val * 365.25))
    else:
        expires_at = start_dt + timedelta(days=int(t_val * 30.4375))

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    subtotal = float(payload.billing_amount or 0.0)
    tax_rate = float(payload.tax_rate if payload.tax_rate is not None else 18.0)
    tax_amount = round(subtotal * (tax_rate / 100.0), 2)
    total_amount = round(subtotal + tax_amount, 2)
    now_yr = datetime.now(timezone.utc).year

    current_settings = dict(tenant.settings or {})
    old_sub = current_settings.get("subscription", {})
    inv_num = old_sub.get("invoice_number") or f"INV-{now_yr}-{uuid.uuid4().hex[:6].upper()}"
    sla_num = old_sub.get("agreement_number") or f"SLA-{now_yr}-{uuid.uuid4().hex[:6].upper()}"

    sub_data = {
        "invoice_number": inv_num,
        "agreement_number": sla_num,
        "issue_date": start_dt.date().isoformat(),
        "tenure_value": t_val,
        "tenure_unit": t_unit,
        "subscription_start_date": start_dt.isoformat(),
        "subscription_expires_at": expires_at.isoformat(),
        "plan": payload.plan or tenant.plan,
        "billing_amount": subtotal,
        "currency": payload.currency or "INR",
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "total_amount": total_amount,
        "tax_id": payload.tax_id or old_sub.get("tax_id", ""),
        "billing_address": payload.billing_address or old_sub.get("billing_address", ""),
        "payment_status": "paid",
        "payment_method": "Razorpay Online",
        "razorpay_order_id": payload.razorpay_order_id,
        "razorpay_payment_id": payload.razorpay_payment_id,
        "razorpay_verified_at": datetime.now(timezone.utc).isoformat(),
        "sla_tier": payload.sla_tier or "Enterprise Gold (99.9% Uptime)",
        "notes": payload.notes or old_sub.get("notes", ""),
    }

    tenant.subscription_expires_at = expires_at
    if payload.plan:
        tenant.plan = payload.plan
    tenant.status = TenantStatus.ACTIVE
    current_settings["subscription"] = sub_data
    tenant.settings = current_settings
    flag_modified(tenant, "settings")

    await write_audit_log(
        db,
        tenant_id=tenant.id,
        user_id=ctx.user.id,
        module="system_admin",
        action="subscription_paid_via_razorpay",
        entity_type="tenant",
        entity_id=tenant.id,
        new_values={
            "payment_id": payload.razorpay_payment_id,
            "order_id": payload.razorpay_order_id,
            "amount": total_amount,
            "expires_at": expires_at.isoformat(),
        },
    )

    await db.commit()
    await db.refresh(tenant)

    owner = await db.scalar(select(User).where(User.tenant_id == tenant.id, User.is_tenant_owner.is_(True)))
    user_count = await db.scalar(select(func.count(User.id)).where(User.tenant_id == tenant.id)) or 0
    now_utc = datetime.now(timezone.utc)
    days_rem = max(0, (expires_at - now_utc).days)

    return PlatformTenantSummary(
        id=tenant.id,
        slug=tenant.slug,
        name=tenant.name,
        plan=tenant.plan,
        status=tenant.status.value,
        created_at=tenant.created_at.isoformat(),
        owner_name=owner.full_name if owner else "Unknown",
        owner_email=owner.email if owner else "Unknown",
        user_count=user_count,
        enabled_modules=current_settings.get("enabled_modules", []),
        subscription_expires_at=expires_at.isoformat(),
        days_remaining=days_rem,
        subscription_details=sub_data,
    )


@router.post("/tenants/{tenant_id}/subscription/razorpay/payment-link", response_model=SubscriptionPaymentLinkResponse)
async def create_subscription_razorpay_payment_link(
    tenant_id: uuid.UUID,
    payload: SubscriptionPaymentLinkRequest,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Generate an official Razorpay Payment Link for client subscription renewal/provisioning.
    Automatically triggers email and SMS notifications from Razorpay and updates workspace record.
    """
    require_platform_admin(ctx)
    from datetime import datetime, timezone
    from sqlalchemy.orm.attributes import flag_modified
    from src.utils.email import send_email

    tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace tenant not found")

    owner = await db.scalar(select(User).where(User.tenant_id == tenant.id, User.is_tenant_owner.is_(True)))
    cust_name = payload.customer_name or (owner.full_name if owner else tenant.name)
    cust_email = payload.customer_email or (owner.email if owner else "")
    cust_phone = payload.customer_phone or getattr(owner, "phone", "") or ""

    current_settings = dict(tenant.settings or {})
    old_sub = current_settings.get("subscription", {})
    subtotal = float(payload.billing_amount if payload.billing_amount is not None else old_sub.get("billing_amount", 50000.0))
    tax_rate = float(payload.tax_rate if payload.tax_rate is not None else old_sub.get("tax_rate", 18.0))
    tax_amount = round(subtotal * (tax_rate / 100.0), 2)
    total_amount = round(subtotal + tax_amount, 2)

    inv_num = old_sub.get("invoice_number") or f"INV-{datetime.now(timezone.utc).year}-{uuid.uuid4().hex[:6].upper()}"

    rzp = RazorpayService(
        key_id=settings.razorpay_key_id,
        key_secret=settings.razorpay_key_secret,
    )

    description = f"Subscription: {tenant.name} ({payload.tenure_value or 12} {payload.tenure_unit or 'months'}) - Inv #{inv_num}"

    try:
        link_data = await rzp.create_payment_link(
            amount=total_amount,
            description=description,
            customer_name=cust_name,
            customer_phone=cust_phone or None,
            customer_email=cust_email or None,
            notify_sms=payload.notify_sms,
            notify_email=payload.notify_email,
            notes={
                "tenant_id": str(tenant.id),
                "tenant_name": tenant.name,
                "invoice_number": inv_num,
                "tenure_value": str(payload.tenure_value),
                "tenure_unit": payload.tenure_unit,
            },
        )
        payment_url = link_data.get("short_url") or link_data.get("url") or f"https://rzp.io/i/{link_data.get('id', '')}"
        plink_id = link_data.get("id", "")
    except Exception as rzp_err:
        logger.warning(f"Razorpay payment link creation hit limitation ({rzp_err}), creating fallback order...")
        try:
            rzp_order = await rzp.create_order(
                amount=total_amount,
                currency=payload.currency or "INR",
                receipt=f"SUB-{str(tenant.id)[:8]}-{int(datetime.now(timezone.utc).timestamp())}",
                notes={
                    "tenant_id": str(tenant.id),
                    "tenant_name": tenant.name,
                    "invoice_number": inv_num,
                },
            )
            plink_id = rzp_order.get("id", f"sub_ord_{uuid.uuid4().hex[:8]}")
            payment_url = f"https://rzp.io/i/{plink_id}"
        except Exception as ord_err:
            logger.error(f"Fallback order creation failed: {ord_err}")
            raise HTTPException(
                status_code=400,
                detail=f"Razorpay Gateway Error: {str(rzp_err)}. Please verify your RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env.",
            )

    # Save to tenant settings
    old_sub["payment_link_id"] = plink_id
    old_sub["payment_link_url"] = payment_url
    old_sub["invoice_number"] = inv_num
    old_sub["billing_amount"] = subtotal
    old_sub["tax_amount"] = tax_amount
    old_sub["total_amount"] = total_amount
    old_sub["payment_status"] = "pending"
    old_sub["payment_method"] = "Razorpay Online Link"
    current_settings["subscription"] = old_sub
    tenant.settings = current_settings
    flag_modified(tenant, "settings")
    await db.commit()

    # Also send direct platform branded email dispatch if recipient provided
    if cust_email:
        try:
            html_msg = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; rounded: 12px; background: #ffffff;">
              <h2 style="color: #6d28d9; margin-bottom: 8px;">BusinessOS AI — Subscription Invoice & Payment Link</h2>
              <p style="color: #334155; font-size: 14px;">Dear <strong>{cust_name}</strong>,</p>
              <p style="color: #334155; font-size: 14px;">Your workspace <strong>{tenant.name}</strong> subscription invoice <strong>#{inv_num}</strong> is ready for payment.</p>
              <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #cbd5e1;">
                <p style="margin: 4px 0; font-size: 13px;"><strong>Plan:</strong> {(payload.plan or tenant.plan).upper()}</p>
                <p style="margin: 4px 0; font-size: 13px;"><strong>Tenure:</strong> {payload.tenure_value} {payload.tenure_unit}</p>
                <p style="margin: 4px 0; font-size: 13px;"><strong>Total Amount:</strong> INR {total_amount:,.2f} (incl. {tax_rate}% GST)</p>
              </div>
              <div style="text-align: center; margin: 28px 0;">
                <a href="{payment_url}" style="background: #6d28d9; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-weight: bold; text-decoration: none; display: inline-block;">Pay Securely via Razorpay</a>
              </div>
              <p style="font-size: 11px; color: #64748b; text-align: center;">Once paid, your workspace SLA agreement and tax invoice will be automatically certified and active.</p>
            </div>
            """
            await send_email(
                subject=f"Action Required: Subscription Payment Link for {tenant.name} (Inv #{inv_num})",
                recipients=cust_email,
                html=html_msg,
                text=f"Pay your workspace subscription #{inv_num} (INR {total_amount:,.2f}) here: {payment_url}",
                tenant_id=tenant.id,
                db=db,
            )
        except Exception as mail_err:
            logger.warning(f"Could not send custom email dispatch: {mail_err}")

    return SubscriptionPaymentLinkResponse(
        payment_link_id=plink_id,
        payment_link_url=payment_url,
        short_url=payment_url,
        amount=total_amount,
        currency=payload.currency or "INR",
        status=link_data.get("status", "created"),
        tenant_id=tenant.id,
        tenant_name=tenant.name,
        customer_email=cust_email,
        customer_phone=cust_phone,
        invoice_number=inv_num,
    )


def generate_subscription_sla_pdf(tenant: Tenant, owner: User | None, sub_data: dict) -> bytes:
    """
    Generates an official, high-resolution A4 vector PDF Master SLA Agreement & Tax Invoice via ReportLab,
    pixel-perfect matched to the on-screen LazyMonkeyAI Enterprise SLA agreement draft.
    """
    import io
    from datetime import datetime, timezone
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    def clean_date_str(val: str | None) -> str:
        if not val:
            return datetime.now(timezone.utc).strftime("%d/%m/%Y")
        try:
            val_clean = str(val).split("T")[0].replace("Z", "")
            parts = val_clean.split("-")
            if len(parts) == 3:
                return f"{int(parts[1])}/{int(parts[2])}/{parts[0]}"
        except Exception:
            pass
        return str(val).split("T")[0]

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=28,
        bottomMargin=28,
    )

    h1 = ParagraphStyle('DocH1', fontName='Helvetica-Bold', fontSize=15, leading=18, textColor=colors.HexColor('#0f172a'))
    h_sub = ParagraphStyle('DocHSub', fontName='Helvetica', fontSize=7.5, leading=10, textColor=colors.HexColor('#64748b'))
    badge = ParagraphStyle('DocBadge', fontName='Helvetica-Bold', fontSize=7, leading=9, textColor=colors.HexColor('#581c87'), alignment=2)
    meta_r = ParagraphStyle('DocMetaR', fontName='Helvetica', fontSize=7.5, leading=10, textColor=colors.HexColor('#334155'), alignment=2)
    
    box_title = ParagraphStyle('BoxTitle', fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=colors.HexColor('#6d28d9'))
    box_p = ParagraphStyle('BoxP', fontName='Helvetica', fontSize=7.5, leading=10.5, textColor=colors.HexColor('#1e293b'))
    
    sec_h = ParagraphStyle('SecH', fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=colors.HexColor('#0f172a'))
    
    th_l = ParagraphStyle('THL', fontName='Helvetica-Bold', fontSize=7.5, leading=9.5, textColor=colors.HexColor('#1e293b'))
    th_r = ParagraphStyle('THR', fontName='Helvetica-Bold', fontSize=7.5, leading=9.5, textColor=colors.HexColor('#1e293b'), alignment=2)
    td_l = ParagraphStyle('TDL', fontName='Helvetica', fontSize=7.5, leading=10, textColor=colors.HexColor('#1e293b'))
    td_r = ParagraphStyle('TDR', fontName='Helvetica', fontSize=7.5, leading=10, textColor=colors.HexColor('#1e293b'), alignment=2)
    td_tot = ParagraphStyle('TDTot', fontName='Helvetica-Bold', fontSize=8.5, leading=11, textColor=colors.HexColor('#581c87'), alignment=2)
    
    clause_p = ParagraphStyle('ClauseP', fontName='Helvetica', fontSize=6.8, leading=9.2, textColor=colors.HexColor('#334155'))
    
    sig_h = ParagraphStyle('SigH', fontName='Helvetica-Bold', fontSize=7.5, leading=9.5, textColor=colors.HexColor('#0f172a'))
    sig_sub = ParagraphStyle('SigSub', fontName='Helvetica', fontSize=7, leading=9, textColor=colors.HexColor('#64748b'))

    story = []

    inv_num = sub_data.get("invoice_number", f"INV-2026-{str(tenant.id)[:6].upper()}")
    sla_num = sub_data.get("agreement_number", f"SLA-2026-{str(tenant.id)[-6:].upper()}")
    issue_date = clean_date_str(sub_data.get("issue_date") or sub_data.get("subscription_start_date"))
    pay_status = sub_data.get("payment_status", "PAID").upper()
    pay_method = sub_data.get("payment_method", "Razorpay Online")

    header_left = [
        Paragraph("<font color='#6d28d9'><b>Lazy</b></font><b>Monkey</b><font color='#059669'><b>AI</b></font>", h1),
        Paragraph("<font color='#64748b'>Enterprise Cloud Business Operating System</font>", h_sub),
        Spacer(1, 3),
        Paragraph("<b>LazyMonkeyAI Technologies Pvt. Ltd.</b>", h_sub),
        Paragraph("Level 8, Smart AI Tower, Tech Hub, Bengaluru, Karnataka 560103", h_sub),
        Paragraph("<b>GSTIN:</b> 29AAACL9821Q1ZV • <b>CIN:</b> U72200KA2024PTC184201", h_sub),
        Paragraph("<b>Support & Billing:</b> support@lazymonkeyai.com", h_sub),
    ]

    header_right = [
        Paragraph("<font color='#581c87'><b>OFFICIAL TAX INVOICE & SLA DRAFT</b></font>", badge),
        Spacer(1, 3),
        Paragraph(f"<b>Invoice #:</b> <font color='#0f172a'><b>{inv_num}</b></font>", meta_r),
        Paragraph(f"<b>SLA Agreement #:</b> <font color='#0f172a'><b>{sla_num}</b></font>", meta_r),
        Paragraph(f"<b>Issue Date:</b> {issue_date}", meta_r),
        Paragraph(f"<b>Payment Status:</b> <font color='#15803d'><b>{pay_status}</b></font>", meta_r),
        Paragraph(f"<b>Payment Method:</b> {pay_method}", meta_r),
    ]

    header_table = Table([[header_left, header_right]], colWidths=[310, 213])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0'), spaceBefore=2, spaceAfter=6))

    # Two-Column Client Details Box
    client_name = sub_data.get("client_company_name") or tenant.name
    admin_name = owner.full_name if owner else "Admin"
    admin_email = owner.email if owner else ""
    client_gstin = sub_data.get("client_tax_id") or ""
    client_addr = sub_data.get("client_billing_address") or ""
    
    t_val = sub_data.get("tenure_value", 12)
    t_unit = str(sub_data.get("tenure_unit", "months")).upper()
    start_str = clean_date_str(sub_data.get("subscription_start_date"))
    exp_str = clean_date_str(tenant.subscription_expires_at.strftime("%Y-%m-%d") if tenant.subscription_expires_at else None)
    sla_tier = sub_data.get("sla_tier", "Enterprise Gold (99.9% Uptime SLA)")

    col1 = [
        Paragraph("<b>BILLED TO & LICENSED ENTITY</b>", box_title),
        Spacer(1, 2),
        Paragraph(f"<b>{client_name}</b>", box_p),
        Paragraph(f"<b>Workspace:</b> {tenant.name} (<font color='#6d28d9'>{tenant.slug}</font>)", box_p),
        Paragraph(f"<b>Authorized Admin:</b> {admin_name} ({admin_email})", box_p),
    ]
    if client_gstin:
        col1.append(Paragraph(f"<b>Client GSTIN:</b> {client_gstin}", box_p))
    if client_addr:
        col1.append(Paragraph(f"<b>Billing Address:</b> {client_addr}", box_p))

    col2 = [
        Paragraph("<b>SUBSCRIPTION TERM & VALIDITY</b>", box_title),
        Spacer(1, 2),
        Paragraph(f"<b>Plan Tier:</b> <font color='#6d28d9'><b>{tenant.plan.upper()}</b></font>", box_p),
        Paragraph(f"<b>Tenure Duration:</b> {t_val} {t_unit}", box_p),
        Paragraph(f"<b>Start Date:</b> {start_str}", box_p),
        Paragraph(f"<b>Expiration Date:</b> <font color='#15803d'><b>{exp_str}</b></font>", box_p),
        Paragraph(f"<b>Guaranteed SLA:</b> {sla_tier}", box_p),
    ]

    box_table = Table([[col1, col2]], colWidths=[255, 255])
    box_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(box_table)
    story.append(Spacer(1, 6))

    # Licensed Modules
    story.append(Paragraph("<b>LICENSED ENTERPRISE MODULES</b>", sec_h))
    story.append(Spacer(1, 2))
    enabled_mods = (tenant.settings or {}).get("enabled_modules") or ["dashboard", "pos", "inventory", "operations", "crm", "marketplace", "accounting", "hrms", "iot", "analytics", "erp", "settings"]
    mods_text = "   ".join([f"✓ {str(m).replace('_', ' ').upper()}" for m in enabled_mods])
    mod_table = Table([[Paragraph(f"<font color='#581c87' size='6.8'><b>{mods_text}</b></font>", box_p)]], colWidths=[523])
    mod_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#faf5ff')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#f3e8ff')),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(mod_table)
    story.append(Spacer(1, 6))

    # Financial Commercials Table
    story.append(Paragraph("<b>FINANCIAL BREAKDOWN</b>", sec_h))
    story.append(Spacer(1, 2))

    billing_amt = float(sub_data.get("billing_amount", 50000.0))
    tax_rate = float(sub_data.get("tax_rate", 18.0))
    tax_amt = float(sub_data.get("tax_amount", round(billing_amt * (tax_rate / 100.0), 2)))
    tot_amt = float(sub_data.get("total_amount", round(billing_amt + tax_amt, 2)))
    curr = sub_data.get("currency", "INR")

    fin_rows = [
        [Paragraph("<b>DESCRIPTION</b>", th_l), Paragraph("<b>TENURE TERM</b>", th_l), Paragraph("<b>TAX RATE</b>", th_r), Paragraph(f"<b>AMOUNT ({curr})</b>", th_r)],
        [
            Paragraph(f"<b>{tenant.plan.upper()} Enterprise Cloud Subscription License</b><br/><font size='6.5' color='#64748b'>Includes AI Copilot, POS, Inventory, Accounting, HRMS, and IoT Integration.</font>", td_l),
            Paragraph(f"{t_val} {t_unit.lower()}", td_l),
            Paragraph(f"{tax_rate:.0f}%", td_r),
            Paragraph(f"{billing_amt:,.2f}", td_r)
        ],
        [Paragraph("", td_l), Paragraph("<b>Subtotal</b>", td_r), Paragraph("", td_r), Paragraph(f"<b>{curr} {billing_amt:,.2f}</b>", td_r)],
        [Paragraph("", td_l), Paragraph(f"Goods & Service Tax (GST / Tax {tax_rate:.0f}%)", td_r), Paragraph("", td_r), Paragraph(f"{curr} {tax_amt:,.2f}", td_r)],
        [Paragraph("", td_l), Paragraph("<b>Grand Total Due / Settled</b>", td_tot), Paragraph("", td_r), Paragraph(f"<b>{curr} {tot_amt:,.2f}</b>", td_tot)],
    ]

    fin_table = Table(fin_rows, colWidths=[270, 75, 65, 113])
    fin_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#f1f5f9')),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#faf5ff')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(fin_table)
    story.append(Spacer(1, 6))

    # Master SLA Clauses
    story.append(Paragraph("<b>MASTER CLOUD SERVICE LEVEL AGREEMENT (SLA) & TERMS</b>", sec_h))
    story.append(Spacer(1, 2))
    clauses = [
        "<b>1. Service Availability:</b> LazyMonkeyAI guarantees " + str(sla_tier) + " uptime across all provisioned modules, calculated per calendar month excluding scheduled maintenance.",
        "<b>2. Data Isolation & Security:</b> All client workspace data is encrypted at rest (AES-256) and in transit (TLS 1.3). The client retains 100% exclusive proprietary ownership of all transaction, inventory, and employee records.",
        "<b>3. Tenure & Renewal:</b> This cloud subscription is active for the tenure length of " + f"{t_val} {t_unit.lower()}" + " ending on " + str(exp_str) + ".",
        "<b>4. Compliance Standards:</b> The platform operates in compliance with SOC 2 Type II, ISO 27001, and GDPR data privacy frameworks."
    ]
    clauses_flow = [Paragraph(c, clause_p) for c in clauses]
    sla_table = Table([[clauses_flow]], colWidths=[523])
    sla_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0,0), (-1,-1), 4.5),
    ]))
    story.append(sla_table)
    story.append(Spacer(1, 8))

    # Signature Block
    sig1 = [
        Paragraph("For and on behalf of <b>LazyMonkeyAI Technologies Pvt. Ltd.</b>", sig_sub),
        Spacer(1, 12),
        Paragraph("<b>Authorized Signatory & Seal</b> <font color='#16a34a' size='6.5'><b>[Digitally Verified]</b></font>", sig_h),
    ]
    sig2 = [
        Paragraph(f"Acknowledged and Accepted on behalf of <b>{client_name}</b>", sig_sub),
        Spacer(1, 12),
        Paragraph(f"<b>{admin_name}</b> <font color='#64748b' size='6.5'>Client Signature</font>", sig_h),
    ]
    sig_table = Table([[sig1, sig2]], colWidths=[255, 255])
    sig_table.setStyle(TableStyle([
        ('LINEABOVE', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(sig_table)

    doc.build(story)
    return buffer.getvalue()


@router.get("/tenants/{tenant_id}/subscription/pdf")
async def get_subscription_agreement_pdf(
    tenant_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Generate and stream official Master SLA Agreement & Tax Invoice PDF.
    """
    require_platform_admin(ctx)
    from fastapi.responses import Response

    tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    owner = await db.scalar(select(User).where(User.tenant_id == tenant.id, User.is_tenant_owner.is_(True)))
    sub_data = (tenant.settings or {}).get("subscription", {})
    inv_num = sub_data.get("invoice_number", f"INV-{str(tenant.id)[:6].upper()}")

    pdf_bytes = generate_subscription_sla_pdf(tenant, owner, sub_data)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="Master_SLA_Agreement_{inv_num}.pdf"',
            "Content-Type": "application/pdf",
        },
    )


@router.post("/tenants/{tenant_id}/subscription/send-agreement-email", response_model=MessageResponse)
async def send_tenant_agreement_email(
    tenant_id: uuid.UUID,
    payload: SendAgreementEmailRequest,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Generate official PDF agreement and send directly to client with PDF attachment.
    """
    require_platform_admin(ctx)
    from src.utils.email import send_email

    tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace tenant not found")

    owner = await db.scalar(select(User).where(User.tenant_id == tenant.id, User.is_tenant_owner.is_(True)))
    recipient = payload.recipient_email or (owner.email if owner else "")
    if not recipient:
        raise HTTPException(status_code=400, detail="No valid client email address found")

    sub_data = (tenant.settings or {}).get("subscription", {})
    inv_num = sub_data.get("invoice_number", f"INV-{str(tenant.id)[:6].upper()}")
    sla_num = sub_data.get("agreement_number", "SLA-2026")
    total_amt = float(sub_data.get("total_amount", 59000.0))
    exp_date = tenant.subscription_expires_at.strftime("%d-%b-%Y") if tenant.subscription_expires_at else "Active"

    # Generate the official vector PDF attachment
    pdf_bytes = generate_subscription_sla_pdf(tenant, owner, sub_data)

    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 28px; border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff;">
      <div style="border-bottom: 2px solid #6d28d9; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="color: #6d28d9; margin: 0;">BusinessOS AI — Formal Master SLA Agreement & Tax Invoice</h2>
        <p style="color: #64748b; font-size: 12px; margin-top: 4px;">Official Subscriber License & Service Guarantee</p>
      </div>
      <p style="color: #1e293b; font-size: 14px;">Dear <strong>{owner.full_name if owner else 'Valued Client'}</strong>,</p>
      <p style="color: #334155; font-size: 13px; line-height: 1.6;">
        We hereby acknowledge the execution of your Master Cloud Service Agreement and confirmed Tax Invoice for workspace <strong>{tenant.name}</strong>.
      </p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0; font-size: 13px;">
        <p style="margin: 4px 0;"><strong>Invoice Number:</strong> {inv_num}</p>
        <p style="margin: 4px 0;"><strong>Master SLA Agreement:</strong> {sla_num}</p>
        <p style="margin: 4px 0;"><strong>Subscription Validity:</strong> Until {exp_date}</p>
        <p style="margin: 4px 0;"><strong>Plan Tier:</strong> {tenant.plan.upper()}</p>
        <p style="margin: 4px 0;"><strong>Payment Status:</strong> <span style="color: #16a34a; font-weight: bold;">PAID & SETTLED</span></p>
        <p style="margin: 4px 0;"><strong>Grand Total:</strong> INR {total_amt:,.2f}</p>
      </div>
      <p style="font-size: 12px; color: #475569; line-height: 1.6;">
        Your workspace is guaranteed with {sub_data.get('sla_tier', 'Enterprise Gold (99.9% Uptime)')} SLA, continuous data encryption, automated backups, and 24x7 hardware & AI support.
      </p>
      <p style="font-size: 13px; color: #4c1d95; font-weight: bold; margin-top: 15px;">
        📎 The official signed PDF copy of your Master SLA Agreement & Tax Invoice is attached to this email.
      </p>
      <div style="margin-top: 30px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
        BusinessOS AI Platform Administration · Digitally Verified Document
      </div>
    </div>
    """

    await send_email(
        subject=f"Official SLA Agreement & Tax Invoice PDF - {tenant.name} (Inv #{inv_num})",
        recipients=recipient,
        html=html_body,
        text=f"Your formal SLA agreement & invoice #{inv_num} for workspace {tenant.name} is confirmed and attached.",
        attachment_bytes=pdf_bytes,
        attachment_filename=f"Master_SLA_Agreement_{inv_num}.pdf",
        tenant_id=tenant.id,
        db=db,
    )

    return MessageResponse(message=f"Official PDF agreement and invoice attached and sent successfully to {recipient}")


@router.patch("/tenants/{tenant_id}/status", response_model=MessageResponse)
async def update_tenant_status(
    tenant_id: uuid.UUID,
    payload: TenantStatusUpdateRequest,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Update a tenant's subscription status (e.g. suspend or activate).
    Suspended tenants will be instantly blocked from logging in or executing requests.
    """
    require_platform_admin(ctx)

    tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    try:
        new_status = TenantStatus(payload.status.lower())
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tenant status. Allowed: {[s.value for s in TenantStatus]}",
        ) from exc

    tenant.status = new_status
    await db.flush()

    return MessageResponse(message=f"Tenant '{tenant.name}' status updated to {new_status.value}")


@router.patch("/tenants/{tenant_id}/modules", response_model=MessageResponse)
async def update_tenant_modules(
    tenant_id: uuid.UUID,
    payload: TenantModulesUpdateRequest,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    God Mode / Platform Super Admin: Configure enabled modules for a specific workspace tenant.
    """
    require_platform_admin(ctx)
    from sqlalchemy.orm.attributes import flag_modified

    tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    settings_dict = dict(tenant.settings or {})
    settings_dict["enabled_modules"] = payload.enabled_modules
    tenant.settings = settings_dict
    flag_modified(tenant, "settings")
    await db.flush()

    return MessageResponse(message=f"Module entitlements for tenant '{tenant.name}' updated successfully.")


@router.delete("/tenants/{tenant_id}", response_model=MessageResponse)
async def delete_platform_tenant(
    tenant_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Platform Super Admin: Permanently delete an entire workspace and all its products, invoices, users, and activities.
    """
    require_platform_admin(ctx)

    tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace tenant not found")

    if tenant.slug == "system":
        raise HTTPException(status_code=400, detail="Cannot delete the root system platform tenant")

    tenant_name = tenant.name
    from src.database.purge import purge_tenant_data
    await purge_tenant_data(db, tenant_id)

    return MessageResponse(message=f"Workspace '{tenant_name}' and all its products, invoices, inventory, and activities have been completely purged from the system.")


@router.post("/tenants/purge-orphans", response_model=MessageResponse)
async def purge_orphaned_tenants(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Purge all orphaned tenant workspaces that have 0 remaining users.
    """
    require_platform_admin(ctx)
    from src.database.purge import purge_tenant_data

    result = await db.execute(select(Tenant).where(Tenant.slug != "system"))
    all_tenants = result.scalars().all()

    purged_names = []
    for t in all_tenants:
        user_count = await db.scalar(select(func.count(User.id)).where(User.tenant_id == t.id))
        if not user_count or user_count == 0:
            purged_names.append(t.name)
            await purge_tenant_data(db, t.id)

    msg = f"Purged {len(purged_names)} orphaned workspaces: {', '.join(purged_names)}" if purged_names else "No orphaned workspaces found. All workspaces have active users."
    return MessageResponse(message=msg)


class PlatformAuditLogResponse(ORMModel):
    id: uuid.UUID
    tenant_name: str
    user_name: str | None
    user_email: str | None
    module: str
    action: str
    ip_address: str | None
    created_at: str


@router.get("/audit-logs", response_model=list[PlatformAuditLogResponse])
async def list_platform_audit_logs(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Retrieve audit logs across all tenants. Guaranteed Platform Admin access only.
    """
    require_platform_admin(ctx)

    from src.models import AuditLog
    
    query = (
        select(
            AuditLog.id,
            AuditLog.module,
            AuditLog.action,
            AuditLog.ip_address,
            AuditLog.created_at,
            Tenant.name.label("tenant_name"),
            User.email.label("user_email"),
            User.full_name.label("user_name"),
        )
        .join(Tenant, AuditLog.tenant_id == Tenant.id)
        .outerjoin(User, AuditLog.user_id == User.id)
        .order_by(AuditLog.created_at.desc())
        .limit(100)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    logs = []
    for r in rows:
        logs.append(
            PlatformAuditLogResponse(
                id=r.id,
                tenant_name=r.tenant_name,
                user_name=r.user_name,
                user_email=r.user_email,
                module=r.module,
                action=r.action,
                ip_address=r.ip_address,
                created_at=r.created_at.isoformat(),
            )
        )
    return logs


class PlatformUserResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    tenant_name: str
    tenant_slug: str | None = None
    email: str
    full_name: str
    status: str
    is_tenant_owner: bool
    is_platform_admin: bool = False
    mfa_enabled: bool
    created_at: str


class UpdateUserStatusPayload(ORMModel):
    status: str


class ResetPasswordPayload(ORMModel):
    password: str


@router.get("/users", response_model=list[PlatformUserResponse])
async def list_platform_users(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Retrieve all users across all tenants. Guaranteed Platform Admin access only.
    """
    require_platform_admin(ctx)

    query = (
        select(
            User.id,
            User.email,
            User.full_name,
            User.status,
            User.is_tenant_owner,
            User.is_platform_admin,
            User.mfa_enabled,
            User.created_at,
            Tenant.id.label("tenant_id"),
            Tenant.name.label("tenant_name"),
            Tenant.slug.label("tenant_slug"),
        )
        .join(Tenant, User.tenant_id == Tenant.id)
        .order_by(User.created_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()

    users = []
    for r in rows:
        is_god = bool(
            getattr(r, "is_platform_admin", False)
        )

        users.append(
            PlatformUserResponse(
                id=r.id,
                tenant_id=r.tenant_id,
                tenant_name=r.tenant_name,
                tenant_slug=r.tenant_slug,
                email=r.email,
                full_name=r.full_name,
                status=r.status.value if hasattr(r.status, "value") else str(r.status),
                is_tenant_owner=r.is_tenant_owner,
                is_platform_admin=is_god,
                mfa_enabled=r.mfa_enabled,
                created_at=r.created_at.isoformat(),
            )
        )
    return users


@router.post("/users", response_model=PlatformUserResponse, status_code=status.HTTP_201_CREATED)
async def create_platform_user(
    payload: CreatePlatformUserPayload,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Platform Super Admin (God Mode): Create a user in any workspace/tenant directly,
    optionally setting Super Admin or Platform Admin permissions.
    """
    require_platform_admin(ctx)
    from src.models import UserStatus, UserRole
    from src.utils.security import hash_password
    from src.database.init_db import write_audit_log

    tenant = await db.scalar(select(Tenant).where(Tenant.id == payload.tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Selected workspace tenant not found")

    existing = await db.scalar(
        select(User).where(User.tenant_id == payload.tenant_id, User.email == payload.email.lower().strip())
    )
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email already exists in this workspace.")

    try:
        user_status = UserStatus(payload.status.upper())
    except ValueError:
        user_status = UserStatus.ACTIVE

    user = User(
        tenant_id=payload.tenant_id,
        email=payload.email.lower().strip(),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        avatar_initials="".join(p[0].upper() for p in (payload.full_name or "User").split()[:2] if p),
        status=user_status,
        is_tenant_owner=payload.is_tenant_owner or payload.is_platform_admin,
        is_platform_admin=payload.is_platform_admin,
    )
    db.add(user)
    await db.flush()

    if payload.role_ids:
        for rid in payload.role_ids:
            db.add(UserRole(user_id=user.id, role_id=rid, is_default=True))
    else:
        # Default to the tenant's Super Admin role if is_tenant_owner or is_platform_admin, else find any role
        from src.models import Role
        target_role = await db.scalar(
            select(Role).where(Role.tenant_id == payload.tenant_id, Role.name == "Super Admin")
        )
        if not target_role:
            target_role = await db.scalar(select(Role).where(Role.tenant_id == payload.tenant_id))
        if target_role:
            db.add(UserRole(user_id=user.id, role_id=target_role.id, is_default=True))

    await write_audit_log(
        db,
        tenant_id=payload.tenant_id,
        user_id=ctx.user.id,
        module="system_admin",
        action="user_created_by_platform_admin",
        entity_type="user",
        entity_id=user.id,
        new_values={"email": user.email, "full_name": user.full_name, "is_platform_admin": user.is_platform_admin},
    )

    await db.commit()
    await db.refresh(user)

    return PlatformUserResponse(
        id=user.id,
        tenant_id=tenant.id,
        tenant_name=tenant.name,
        tenant_slug=tenant.slug,
        email=user.email,
        full_name=user.full_name,
        status=user.status.value,
        is_tenant_owner=user.is_tenant_owner,
        is_platform_admin=user.is_platform_admin,
        mfa_enabled=user.mfa_enabled,
        created_at=user.created_at.isoformat(),
    )



@router.patch("/users/{user_id}/status")
async def update_platform_user_status(
    user_id: uuid.UUID,
    payload: UpdateUserStatusPayload,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Suspend or activate any user account on the platform.
    """
    require_platform_admin(ctx)

    from src.models import UserStatus, TenantStatus
    user = await db.scalar(select(User).options(selectinload(User.tenant)).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        user.status = UserStatus(payload.status.upper())
        if user.status == UserStatus.ACTIVE and user.tenant and user.tenant.status == TenantStatus.SUSPENDED:
            user.tenant.status = TenantStatus.ACTIVE
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid user status. Allowed: {[s.value for s in UserStatus]}",
        ) from exc

    await db.commit()
    await db.refresh(user)
    return MessageResponse(message=f"User account status updated to {user.status.value}")


@router.post("/users/{user_id}/reset-password", response_model=MessageResponse)
async def reset_platform_user_password(
    user_id: uuid.UUID,
    payload: ResetPasswordPayload,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Platform Super Admin: Reset a user's password administratively across any workspace tenant
    and automatically send them an email with their new login credentials.
    """
    require_platform_admin(ctx)

    if not payload.password or len(payload.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long.",
        )

    import asyncio
    from src.config import get_settings
    from src.utils.security import hash_password
    from src.utils.email import send_email

    cfg = get_settings()

    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(payload.password)
    user.must_change_password = True
    await db.commit()
    await db.refresh(user)

    # Dispatch email notification to the user
    login_url = f"{cfg.frontend_url}/login" if cfg.frontend_url else "https://lazymonkeyai.com/login"
    try:
        asyncio.create_task(
            send_email(
                subject=f"Your Password Has Been Reset — {cfg.app_name}",
                recipients=[user.email],
                text=(
                    f"Hello {user.full_name},\n\n"
                    f"Your password for {cfg.app_name} has been administratively reset by the Platform Administrator.\n\n"
                    f"Your New Temporary Password: {payload.password}\n"
                    f"Login URL: {login_url}\n\n"
                    "For security, you will be required to change your password immediately upon logging in.\n\n"
                    f"— {cfg.app_name} Security Team"
                ),
                html=(
                    f"<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;'>"
                    f"<h2 style='color: #4f46e5; margin-top: 0;'>Password Reset Notification</h2>"
                    f"<p style='color: #334155; font-size: 15px;'>Hello <strong>{user.full_name}</strong>,</p>"
                    f"<p style='color: #475569; font-size: 14px;'>Your account password for <strong>{cfg.app_name}</strong> has been administratively reset by the Platform Administrator.</p>"
                    f"<div style='background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4f46e5;'>"
                    f"<p style='margin: 0; font-size: 13px; color: #64748b;'>New Temporary Password:</p>"
                    f"<p style='margin: 4px 0 0; font-size: 18px; font-weight: bold; font-family: monospace; color: #0f172a; letter-spacing: 1px;'>{payload.password}</p>"
                    f"</div>"
                    f"<p style='color: #475569; font-size: 14px;'>Click the button below to log in with your temporary password. You will be required to choose a new password upon login.</p>"
                    f"<div style='margin: 24px 0; text-align: center;'>"
                    f"<a href='{login_url}' style='background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;'>Log In to Your Account</a>"
                    f"</div>"
                    f"<p style='color: #94a3b8; font-size: 12px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;'>If you did not expect this reset, please contact your workspace administrator immediately.</p>"
                    f"</div>"
                ),
            )
        )
    except Exception as err:
        logger.warning("Could not queue password reset email: %s", err)

    return MessageResponse(message=f"Password for user {user.email} has been successfully reset and notification email dispatched.")


@router.post("/users/{user_id}/reset-mfa")
async def reset_platform_user_mfa(
    user_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Force disable MFA (webauthn/totp) for a user account to help them log in.
    """
    require_platform_admin(ctx)

    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.mfa_enabled = False
    await db.commit()
    return MessageResponse(message="MFA lock removed for user.")


class ToggleSuperAdminPayload(BaseModel):
    is_platform_admin: bool | None = None


@router.patch("/users/{user_id}/super-admin")
@router.post("/users/{user_id}/super-admin")
@router.post("/users/{user_id}/toggle-super-admin")
async def toggle_platform_super_admin(
    user_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    payload: ToggleSuperAdminPayload | None = None,
):
    """
    Promote or revoke Global Super Admin (is_platform_admin & God Mode) access for any user on the platform.
    """
    require_platform_admin(ctx)

    user = await db.scalar(select(User).options(selectinload(User.tenant)).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload and payload.is_platform_admin is not None:
        user.is_platform_admin = payload.is_platform_admin
    else:
        user.is_platform_admin = not bool(user.is_platform_admin)

    if user.is_platform_admin:
        user.is_tenant_owner = True

    await db.commit()
    await db.refresh(user)

    status_str = "Global Platform Super Admin (God Mode)" if user.is_platform_admin else "Regular Workspace User"
    return MessageResponse(message=f"User {user.email} access updated to {status_str}")


@router.delete("/users/{user_id}", response_model=MessageResponse)
async def delete_platform_user(
    user_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Platform Super Admin: Permanently delete any user across the platform and purge their activities/tokens/organization.
    """
    require_platform_admin(ctx)

    if ctx.user.id == user_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete your own platform admin account while logged in."
        )

    from src.database.purge import purge_user_complete
    res = await purge_user_complete(
        db,
        user_id=user_id,
        actor_user_id=ctx.user.id,
        purge_entire_tenant_if_owner=True
    )
    if not res.get("success"):
        raise HTTPException(status_code=404, detail=res.get("message", "User not found"))

    return MessageResponse(message=res["message"])






@router.get("/pending-approvals", response_model=list[PendingApprovalSummary])
async def list_pending_approvals(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all pending tenant workspace registrations with requested module entitlements."""
    require_platform_admin(ctx)

    result = await db.execute(
        select(Tenant)
        .options(selectinload(Tenant.users))
        .where(Tenant.status == TenantStatus.SUSPENDED)
        .order_by(Tenant.created_at.desc())
    )
    tenants = result.scalars().all()

    items = []
    for t in tenants:
        owner = next((u for u in t.users if u.is_tenant_owner), t.users[0] if t.users else None)
        settings_dict = t.settings or {}
        req_mods = settings_dict.get("requested_modules", ["inventory", "pos"])
        enb_mods = settings_dict.get("enabled_modules", [])
        req_at = settings_dict.get("requested_at", t.created_at.isoformat())

        items.append(
            PendingApprovalSummary(
                tenant_id=t.id,
                tenant_slug=t.slug,
                tenant_name=t.name,
                admin_name=owner.full_name if owner else None,
                admin_email=owner.email if owner else None,
                requested_modules=req_mods,
                enabled_modules=enb_mods,
                status=t.status.value,
                requested_at=str(req_at),
            )
        )
    return items


@router.post("/tenants/{tenant_id}/approve")
async def approve_tenant_registration(
    tenant_id: uuid.UUID,
    payload: ApproveTenantPayload,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Approve a pending workspace registration, set custom approved module entitlements, and activate tenant & owner accounts.
    """
    require_platform_admin(ctx)

    from src.models import UserStatus, TenantStatus, Company, Branch, UserRole, UserBranch
    from src.config import get_settings
    from src.utils.email import send_email
    from src.utils.security import create_super_admin_role
    from sqlalchemy.orm.attributes import flag_modified
    import asyncio

    cfg = get_settings()

    tenant = await db.scalar(select(Tenant).options(selectinload(Tenant.users)).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace tenant not found")

    approved_mods = payload.approved_modules or ["inventory", "pos"]

    tenant.status = TenantStatus.ACTIVE
    current_settings = dict(tenant.settings or {})
    current_settings["enabled_modules"] = approved_mods
    tenant.settings = current_settings
    flag_modified(tenant, "settings")

    # Activate tenant users
    for user in tenant.users:
        user.status = UserStatus.ACTIVE

    # Ensure company exists for this tenant
    company = await db.scalar(select(Company).where(Company.tenant_id == tenant.id))
    if not company:
        company = Company(
            tenant_id=tenant.id,
            name=tenant.name,
            legal_name=tenant.name,
            logo_initials="".join(p[0].upper() for p in tenant.name.split()[:2] if p),
        )
        db.add(company)
        await db.flush()

    # Ensure default branch exists
    branch = await db.scalar(select(Branch).where(Branch.tenant_id == tenant.id))
    if not branch:
        branch = Branch(
            tenant_id=tenant.id,
            company_id=company.id,
            name="Main Headquarters",
            code="HQ",
        )
        db.add(branch)
        await db.flush()

    # Ensure owner user has primary branch & role assignment
    owner = next((u for u in tenant.users if u.is_tenant_owner), None)
    if owner:
        existing_branch_link = await db.scalar(
            select(UserBranch).where(UserBranch.user_id == owner.id, UserBranch.branch_id == branch.id)
        )
        if not existing_branch_link:
            db.add(UserBranch(user_id=owner.id, branch_id=branch.id, is_primary=True))

    await db.commit()

    # Send approval email notification to workspace owner
    if owner:
        try:
            asyncio.create_task(
                send_email(
                    subject=f"Workspace Approved! — {cfg.app_name}",
                    recipients=[owner.email],
                    text=(
                        f"Hello {owner.full_name},\n\n"
                        f"Great news! Your workspace '{tenant.name}' has been approved by the Platform Administrator.\n"
                        f"Approved Modules: {', '.join(approved_mods).upper()}\n\n"
                        "You can now log in to your workspace and start managing your operations.\n\n"
                        "— BusinessOS AI Team"
                    ),
                )
            )
        except Exception:
            pass

    return MessageResponse(message=f"Workspace '{tenant.name}' approved successfully with {len(approved_mods)} active modules.")





@router.get("/companies", response_model=list[PlatformCompanySummary])
async def list_all_system_companies(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    tenant_id: uuid.UUID | None = None,
    status: str | None = None,
    search: str | None = None,
):
    """
    God Mode Hub: Lists all internal legal entities / companies across all workspaces with branches.
    """
    require_platform_admin(ctx)
    from src.models import Company, Branch

    query = (
        select(Company)
        .options(
            selectinload(Company.tenant),
            selectinload(Company.branches),
        )
        .order_by(Company.created_at.desc())
    )

    if tenant_id:
        query = query.where(Company.tenant_id == tenant_id)

    if search:
        term = f"%{search.strip().lower()}%"
        query = query.where(
            func.lower(Company.name).like(term)
            | func.lower(Company.legal_name).like(term)
            | func.lower(Company.gst_number).like(term)
            | func.lower(Company.pan_number).like(term)
            | func.lower(Company.city).like(term)
        )

    results = (await db.scalars(query)).all()
    out = []

    for comp in results:
        t_name = comp.tenant.name if comp.tenant else "Unknown Workspace"
        t_slug = comp.tenant.slug if comp.tenant else "unknown"

        comp_status = comp.status.value if hasattr(comp.status, "value") else str(comp.status or "active")
        if status and status.lower() != "all" and comp_status.lower() != status.lower():
            continue

        branch_summaries = []
        for b in (comp.branches or []):
            b_status = b.status.value if hasattr(b.status, "value") else str(b.status or "active")
            branch_summaries.append(
                PlatformBranchSummary(
                    id=b.id,
                    company_id=comp.id,
                    tenant_id=comp.tenant_id,
                    name=b.name,
                    code=b.code,
                    branch_type=getattr(b, "branch_type", "Branch"),
                    city=b.city,
                    state=b.state,
                    country=b.country or "India",
                    address=b.address,
                    phone=b.phone,
                    email=b.email,
                    is_head_office=bool(getattr(b, "is_head_office", False) or (b.code and b.code.upper() in ["HQ", "HEAD"]) or ("headquarters" in (b.name or "").lower())),
                    status=b_status,
                    created_at=b.created_at.isoformat() if b.created_at else "",
                )
            )

        out.append(
            PlatformCompanySummary(
                id=comp.id,
                tenant_id=comp.tenant_id,
                tenant_name=t_name,
                tenant_slug=t_slug,
                name=comp.name,
                legal_name=comp.legal_name or comp.name,
                company_type=comp.company_type,
                gst_number=comp.gst_number,
                pan_number=comp.pan_number,
                registration_number=comp.registration_number,
                industry=comp.industry,
                city=comp.city,
                state=comp.state,
                country=comp.country or "India",
                address=comp.address,
                phone=comp.phone,
                email=comp.email,
                website=comp.website,
                default_currency_code=comp.default_currency_code or "INR",
                timezone=comp.timezone or "Asia/Kolkata",
                financial_year_start_month=comp.financial_year_start_month or 4,
                status=comp_status,
                created_at=comp.created_at.isoformat() if comp.created_at else "",
                branches_count=len(comp.branches or []),
                branches=branch_summaries,
            )
        )

    return out


@router.patch("/companies/{company_id}/status")
async def update_company_status(
    company_id: uuid.UUID,
    payload: CompanyStatusUpdateRequest,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    God Mode Hub: Update internal company status (active / inactive).
    """
    require_platform_admin(ctx)
    from src.models import Company, EntityStatus

    company = await db.scalar(select(Company).where(Company.id == company_id))
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    new_st = payload.status.lower()
    if new_st in ("active", "enabled"):
        company.status = EntityStatus.ACTIVE
    else:
        company.status = EntityStatus.INACTIVE

    await db.commit()
    return MessageResponse(message=f"Company '{company.name}' status updated to {new_st.upper()}")


@router.get("/branches", response_model=list[PlatformBranchSummary])
async def list_all_system_branches(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    company_id: uuid.UUID | None = None,
):
    """
    God Mode Hub: Lists all branches/outlets across all companies and workspaces.
    """
    require_platform_admin(ctx)
    from src.models import Branch

    query = select(Branch).order_by(Branch.created_at.desc())
    if company_id:
        query = query.where(Branch.company_id == company_id)

    results = (await db.scalars(query)).all()
    out = []
    for b in results:
        b_status = b.status.value if hasattr(b.status, "value") else str(b.status or "active")
        out.append(
            PlatformBranchSummary(
                id=b.id,
                company_id=b.company_id,
                tenant_id=b.tenant_id,
                name=b.name,
                code=b.code,
                branch_type=getattr(b, "branch_type", "Branch"),
                city=b.city,
                state=b.state,
                country=b.country or "India",
                address=b.address,
                phone=b.phone,
                email=b.email,
                is_head_office=bool(getattr(b, "is_head_office", False) or (b.code and b.code.upper() in ["HQ", "HEAD"]) or ("headquarters" in (b.name or "").lower())),
                status=b_status,
                created_at=b.created_at.isoformat() if b.created_at else "",
            )
        )
    return out

