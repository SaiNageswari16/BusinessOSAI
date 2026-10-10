import os
import uuid
import logging
import httpx
from datetime import datetime, timezone
from typing import Annotated, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status, Body
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.session import get_db
from src.api.deps import CurrentUserContext, require_permission
from src.models import Tenant, User, Lead, LeadActivity

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/whatsapp-automation", tags=["CRM & Sales - WhatsApp"])

# Force 127.0.0.1 to avoid Windows IPv6/localhost resolution ambiguity
_raw_gateway_url = os.getenv("WHATSAPP_GATEWAY_URL", "http://127.0.0.1:8005")
GATEWAY_URL = _raw_gateway_url.replace("localhost", "127.0.0.1")


def _gateway_client() -> httpx.AsyncClient:
    """Return a fresh httpx client with correct transport for local gateway."""
    transport = httpx.AsyncHTTPTransport(retries=1)
    return httpx.AsyncClient(transport=transport, timeout=10.0)



# Pydantic Schemas
class WhatsappWebhookPayload(BaseModel):
    message_id: str
    from_: str = Field(alias="from")
    body: str
    timestamp: int | None = None
    profile_name: str | None = None
    session_id: str

    model_config = {"populate_by_name": True}


class SendMessagePayload(BaseModel):
    message: str


class SendMediaPayload(BaseModel):
    mimeType: str = Field(..., alias="mimeType")
    data: str = Field(..., description="Base64-encoded media data")
    fileName: str | None = Field(None, alias="fileName")
    caption: str | None = None

    model_config = {"populate_by_name": True}


class SyncContactItem(BaseModel):
    number: str
    name: str | None = None


class SyncPayload(BaseModel):
    contacts: List[SyncContactItem]


def _clean_digits(val: str) -> str:
    return "".join(filter(str.isdigit, val))


# Webhook Endpoint (Called by NodeJS Gateway)
@router.post("/webhook", status_code=status.HTTP_200_OK)
async def inbound_webhook(
    payload: WhatsappWebhookPayload,
    db: AsyncSession = Depends(get_db)
):
    logger.info(f"📥 WhatsApp Webhook message received from {payload.from_} (Session: {payload.session_id})")
    
    session_id = _clean_digits(payload.session_id)
    from_phone = _clean_digits(payload.from_)
    if not session_id or not from_phone:
        return {"success": False, "detail": "Invalid session_id or phone number"}

    # 1. Match Tenant by session_id in settings
    matched_tenant = None
    res = await db.execute(select(Tenant))
    tenants = res.scalars().all()
    for t in tenants:
        if t.settings and isinstance(t.settings, dict):
            active_sessions = t.settings.get("whatsapp_web_sessions") or []
            if session_id in active_sessions or (session_id.startswith("91") and session_id[2:] in active_sessions) or (f"91{session_id}" in active_sessions):
                matched_tenant = t
                break

    if not matched_tenant:
        logger.warning(f"Session {session_id} is not mapped to any Tenant settings. Rejecting webhook to prevent cross-tenant leak.")
        return {"success": False, "detail": "Session not mapped to any organization"}

    # 2. Match (or create) Lead by clean phone number
    stmt = select(Lead).where(
        Lead.tenant_id == matched_tenant.id,
        Lead.phone == from_phone
    )
    res = await db.execute(stmt)
    lead = res.scalars().first()

    if not lead:
        # Resolve owner agent if mapped
        owner_agent_id = None
        if matched_tenant.settings and isinstance(matched_tenant.settings, dict):
            agent_sessions = matched_tenant.settings.get("agent_whatsapp_sessions") or {}
            agent_str = agent_sessions.get(session_id)
            if agent_str:
                try:
                    owner_agent_id = uuid.UUID(agent_str)
                except ValueError:
                    pass

        # Create new Lead
        lead = Lead(
            tenant_id=matched_tenant.id,
            name=payload.profile_name or f"WhatsApp Guest ({from_phone})",
            phone=from_phone,
            source="WhatsApp",
            status="New",
            owner_user_id=owner_agent_id,
            estimated_value=0.0,
            meta={"whatsapp_session_id": session_id}
        )
        db.add(lead)
        await db.commit()
        await db.refresh(lead)
        logger.info(f"🆕 Created new Lead from WhatsApp webhook: {lead.name} ({from_phone})")

    # 3. Log Activity as LeadActivity (whatsapp_received)
    activity = LeadActivity(
        tenant_id=matched_tenant.id,
        lead_id=lead.id,
        activity_type="whatsapp_received",
        summary=payload.body[:500], # crm_lead_activities summary is varchar(500)
        occurred_at=datetime.fromtimestamp(payload.timestamp, timezone.utc) if payload.timestamp else datetime.utcnow()
    )
    db.add(activity)
    await db.commit()
    return {"success": True, "lead_id": str(lead.id)}


# Session Management Proxy Endpoints

@router.post("/sessions/{session_id}/start")
async def start_session(
    session_id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: AsyncSession = Depends(get_db)
):
    clean_id = _clean_digits(session_id)
    if not clean_id:
        raise HTTPException(status_code=400, detail="Invalid session_id format")

    # Disassociate session from any other tenant to ensure strict uniqueness
    other_tenants_res = await db.execute(select(Tenant).where(Tenant.id != ctx.tenant_id))
    other_tenants = other_tenants_res.scalars().all()
    for ot in other_tenants:
        if ot.settings and isinstance(ot.settings, dict):
            ot_settings = dict(ot.settings)
            ot_sessions = list(ot_settings.get("whatsapp_web_sessions") or [])
            ot_agent_sessions = dict(ot_settings.get("agent_whatsapp_sessions") or {})
            changed = False
            for num_var in (clean_id, clean_id[2:] if clean_id.startswith("91") else None, f"91{clean_id}"):
                if num_var and num_var in ot_sessions:
                    ot_sessions.remove(num_var)
                    changed = True
                if num_var and num_var in ot_agent_sessions:
                    del ot_agent_sessions[num_var]
                    changed = True
            if changed:
                ot_settings["whatsapp_web_sessions"] = ot_sessions
                ot_settings["agent_whatsapp_sessions"] = ot_agent_sessions
                ot.settings = ot_settings
                flag_modified(ot, "settings")

    # Load and update Tenant settings
    stmt = select(Tenant).where(Tenant.id == ctx.tenant_id)
    res = await db.execute(stmt)
    tenant = res.scalars().first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    settings = dict(tenant.settings or {})
    
    # Store session ownership map
    active_sessions = list(settings.get("whatsapp_web_sessions") or [])
    if clean_id not in active_sessions:
        active_sessions.append(clean_id)
    settings["whatsapp_web_sessions"] = active_sessions

    agent_sessions = dict(settings.get("agent_whatsapp_sessions") or {})
    agent_sessions[clean_id] = str(ctx.user.id)
    settings["agent_whatsapp_sessions"] = agent_sessions

    tenant.settings = settings
    flag_modified(tenant, "settings")
    await db.commit()

    # Proxy to NodeJS gateway
    try:
        async with _gateway_client() as client:
            resp = await client.post(f"{GATEWAY_URL}/sessions/{clean_id}/start", timeout=20.0)
            return resp.json()
    except Exception as e:
        logger.error(f"Failed to communicate with WhatsApp Gateway at {GATEWAY_URL}: {e}")
        raise HTTPException(status_code=502, detail=f"WhatsApp gateway unreachable: {e}")


@router.get("/sessions")
async def get_sessions(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_leads"))],
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Tenant).where(Tenant.id == ctx.tenant_id)
    res = await db.execute(stmt)
    tenant = res.scalars().first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    settings = dict(tenant.settings or {})
    db_sessions = list(settings.get("whatsapp_web_sessions") or [])
    agent_sessions = dict(settings.get("agent_whatsapp_sessions") or {})

    # Agents only see their own active session
    import src.models as models
    from src.database.base import EntityStatus
    is_admin = False
    
    # Resolve user roles to see if admin/manager
    user_stmt = select(User).where(User.id == ctx.user.id)
    user_res = await db.execute(user_stmt)
    curr_user = user_res.scalars().first()
    if curr_user and curr_user.is_tenant_owner:
        is_admin = True

    if not is_admin:
        # Filter sessions owned by current user
        agent_id_str = str(ctx.user.id)
        db_sessions = [num for num in db_sessions if agent_sessions.get(num) == agent_id_str]

    # Fetch status from NodeJS gateway
    gateway_sessions = {}
    try:
        async with _gateway_client() as client:
            resp = await client.get(f"{GATEWAY_URL}/sessions", timeout=5.0)
            if resp.status_code == 200:
                gateway_sessions = resp.json()
    except Exception as e:
        logger.warning(f"Failed to fetch session list from gateway: {e}")

    # Build responsive status object: strictly scoped to db_sessions of current tenant
    all_nums = list(dict.fromkeys(db_sessions))
    result = {}
    for num in all_nums:
        # Match directly or by checking country code variant
        status_info = gateway_sessions.get(num)
        if not status_info:
            if num.startswith("91") and num[2:] in gateway_sessions:
                status_info = gateway_sessions[num[2:]]
            elif f"91{num}" in gateway_sessions:
                status_info = gateway_sessions[f"91{num}"]
            else:
                status_info = {"status": "DISCONNECTED", "qr": None, "info": None}

        # Add owner metadata
        owner_agent_name = "System Auto-Assigned"
        owner_id = agent_sessions.get(num) or (agent_sessions.get(num[2:]) if num.startswith("91") else agent_sessions.get(f"91{num}"))
        if owner_id:
            try:
                user_res = await db.execute(select(User.full_name).where(User.id == uuid.UUID(owner_id)))
                owner_agent_name = user_res.scalar() or "Agent"
            except Exception:
                pass

        result[num] = {
            "status": status_info.get("status", "DISCONNECTED"),
            "qr": status_info.get("qr"),
            "info": status_info.get("info"),
            "owner_name": owner_agent_name
        }
    return result


async def _verify_tenant_session(clean_id: str, ctx: CurrentUserContext, db: AsyncSession) -> bool:
    """Verify that a given session ID belongs to the current tenant."""
    stmt = select(Tenant).where(Tenant.id == ctx.tenant_id)
    res = await db.execute(stmt)
    tenant = res.scalars().first()
    if not tenant or not tenant.settings:
        return False
    active_sessions = list(tenant.settings.get("whatsapp_web_sessions") or [])
    # Check matching direct or with/without 91
    if clean_id in active_sessions:
        return True
    if clean_id.startswith("91") and clean_id[2:] in active_sessions:
        return True
    if f"91{clean_id}" in active_sessions:
        return True
    return False


@router.post("/sessions/{session_id}/logout")
async def logout_session(
    session_id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: AsyncSession = Depends(get_db)
):
    clean_id = _clean_digits(session_id)
    
    # Remove from Tenant settings
    stmt = select(Tenant).where(Tenant.id == ctx.tenant_id)
    res = await db.execute(stmt)
    tenant = res.scalars().first()
    if tenant:
        settings = dict(tenant.settings or {})
        active_sessions = list(settings.get("whatsapp_web_sessions") or [])
        agent_sessions = dict(settings.get("agent_whatsapp_sessions") or {})

        if clean_id in active_sessions:
            active_sessions.remove(clean_id)
        if clean_id in agent_sessions:
            del agent_sessions[clean_id]

        settings["whatsapp_web_sessions"] = active_sessions
        settings["agent_whatsapp_sessions"] = agent_sessions
        tenant.settings = settings
        flag_modified(tenant, "settings")
        await db.commit()

    # Call NodeJS logout
    try:
        async with _gateway_client() as client:
            resp = await client.post(f"{GATEWAY_URL}/sessions/{clean_id}/logout")
            return resp.json()
    except Exception as e:
        logger.warning(f"Gateway logout failed for {clean_id}: {e}")
        return {"success": True, "message": "Cleared locally, gateway was unreachable."}


@router.get("/sessions/{session_id}/contacts")
async def get_contacts(
    session_id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_leads"))],
    db: AsyncSession = Depends(get_db)
):
    clean_id = _clean_digits(session_id)
    is_valid = await _verify_tenant_session(clean_id, ctx, db)
    if not is_valid:
        raise HTTPException(status_code=403, detail="Unauthorized access to this WhatsApp session.")

    try:
        async with _gateway_client() as client:
            resp = await client.get(f"{GATEWAY_URL}/sessions/{clean_id}/contacts", timeout=20.0)
            return resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to retrieve contacts from gateway: {e}")


@router.post("/sessions/{session_id}/sync")
async def sync_contacts(
    session_id: str,
    payload: SyncPayload,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: AsyncSession = Depends(get_db)
):
    clean_id = _clean_digits(session_id)
    is_valid = await _verify_tenant_session(clean_id, ctx, db)
    if not is_valid:
        raise HTTPException(status_code=403, detail="Unauthorized access to this WhatsApp session.")

    imported_count = 0
    for item in payload.contacts:
        clean_phone = _clean_digits(item.number)
        if not clean_phone:
            continue
            
        stmt = select(Lead).where(
            Lead.tenant_id == ctx.tenant_id,
            Lead.phone == clean_phone
        )
        res = await db.execute(stmt)
        lead = res.scalars().first()
        
        if not lead:
            lead = Lead(
                tenant_id=ctx.tenant_id,
                name=item.name or f"WhatsApp Contact ({clean_phone})",
                phone=clean_phone,
                source="WhatsApp",
                status="New",
                estimated_value=0.0,
                meta={"whatsapp_session_id": clean_id}
            )
            db.add(lead)
            imported_count += 1
            
    if imported_count > 0:
        await db.commit()
        
    return {"success": True, "message": f"Successfully imported {imported_count} contacts as CRM leads."}


# Chat Messages Endpoint (Fetches live history from gateway first, falls back to DB)
@router.get("/sessions/{session_id}/chats/{phone}/messages")
async def get_chat_messages(
    session_id: str,
    phone: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_leads"))],
    db: AsyncSession = Depends(get_db)
):
    clean_phone = _clean_digits(phone)
    clean_id = _clean_digits(session_id)
    is_valid = await _verify_tenant_session(clean_id, ctx, db)
    if not is_valid:
        raise HTTPException(status_code=403, detail="Unauthorized access to this WhatsApp session.")

    # Try live history first
    try:
        async with _gateway_client() as client:
            resp = await client.get(f"{GATEWAY_URL}/sessions/{clean_id}/chats/{clean_phone}/messages", timeout=12.0)
            if resp.status_code == 200:
                gateway_res = resp.json()
                if gateway_res.get("success"):
                    messages = gateway_res.get("messages", [])
                    messages.sort(key=lambda m: m.get("timestamp", 0))
                    return {"success": True, "messages": messages}
    except Exception as e:
        logger.warning(f"Failed to fetch live chat history from gateway for {clean_phone}: {e}")

    # Fallback to database logged activities
    stmt = select(Lead).where(
        Lead.tenant_id == ctx.tenant_id,
        Lead.phone == clean_phone
    )
    res = await db.execute(stmt)
    lead = res.scalars().first()

    if not lead:
        return {"success": True, "messages": []}

    # Fetch database logged WhatsApp activities
    act_stmt = select(LeadActivity).where(
        LeadActivity.tenant_id == ctx.tenant_id,
        LeadActivity.lead_id == lead.id,
        LeadActivity.activity_type.in_(["whatsapp_received", "whatsapp_sent"])
    ).order_by(LeadActivity.occurred_at.asc())
    
    res = await db.execute(act_stmt)
    activities = res.scalars().all()

    messages = []
    for act in activities:
        messages.append({
            "id": str(act.id),
            "body": act.summary,
            "fromMe": act.activity_type == "whatsapp_sent",
            "timestamp": int(act.occurred_at.replace(tzinfo=timezone.utc).timestamp()) if act.occurred_at else int(datetime.utcnow().timestamp())
        })

    return {"success": True, "messages": messages}


# Send Message Endpoint (Proxy to Gateway + log to Database)
@router.post("/sessions/{session_id}/chats/{phone}/send")
async def send_message(
    session_id: str,
    phone: str,
    payload: SendMessagePayload,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: AsyncSession = Depends(get_db)
):
    clean_phone = _clean_digits(phone)
    clean_id = _clean_digits(session_id)
    is_valid = await _verify_tenant_session(clean_id, ctx, db)
    if not is_valid:
        raise HTTPException(status_code=403, detail="Unauthorized access to this WhatsApp session.")

    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Cannot send empty message")

    # 1. Ensure Lead exists in Database
    stmt = select(Lead).where(
        Lead.tenant_id == ctx.tenant_id,
        Lead.phone == clean_phone
    )
    res = await db.execute(stmt)
    lead = res.scalars().first()

    if not lead:
        # Create Lead
        lead = Lead(
            tenant_id=ctx.tenant_id,
            name=f"WhatsApp Contact ({clean_phone})",
            phone=clean_phone,
            source="WhatsApp",
            status="Contacted",
            owner_user_id=ctx.user.id,
            estimated_value=0.0
        )
        db.add(lead)
        await db.commit()
        await db.refresh(lead)

    # 2. Proxy to NodeJS gateway
    try:
        async with _gateway_client() as client:
            resp = await client.post(
                f"{GATEWAY_URL}/sessions/{clean_id}/chats/{clean_phone}/send",
                json={"message": payload.message},
                timeout=15.0
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail=resp.text)
            gateway_res = resp.json()
    except Exception as e:
        logger.error(f"WhatsApp gateway failed to send message to {clean_phone}: {e}")
        raise HTTPException(status_code=502, detail=f"WhatsApp gateway error: {e}")

    # 3. Log as LeadActivity (whatsapp_sent)
    activity = LeadActivity(
        tenant_id=ctx.tenant_id,
        lead_id=lead.id,
        activity_type="whatsapp_sent",
        summary=payload.message[:500],
        occurred_at=datetime.utcnow(),
        created_by_user_id=ctx.user.id
    )
    db.add(activity)
    
    # Update Lead's last contact timestamp
    lead.last_contact_at = datetime.utcnow()
    lead.status = "Contacted"

    await db.commit()

    return {
        "success": True,
        "message_id": gateway_res.get("message_id"),
        "timestamp": gateway_res.get("timestamp")
    }


# Send Media Endpoint (Image/PDF) - Proxy to Gateway + log to Database
@router.post("/sessions/{session_id}/chats/{phone}/send-media")
async def send_media(
    session_id: str,
    phone: str,
    payload: SendMediaPayload,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: AsyncSession = Depends(get_db)
):
    clean_phone = _clean_digits(phone)
    clean_id = _clean_digits(session_id)
    is_valid = await _verify_tenant_session(clean_id, ctx, db)
    if not is_valid:
        raise HTTPException(status_code=403, detail="Unauthorized access to this WhatsApp session.")

    # Validate payload
    if not payload.data or not payload.mimeType:
        raise HTTPException(status_code=400, detail="mimeType and data are required")

    # Allowed mime types (images + PDF)
    allowed_prefixes = ("image/", "application/pdf")
    if not payload.mimeType.startswith(tuple(allowed_prefixes)):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported mime type '{payload.mimeType}'. Only images and PDFs are allowed.",
        )

    # 1. Ensure Lead exists in Database
    stmt = select(Lead).where(
        Lead.tenant_id == ctx.tenant_id,
        Lead.phone == clean_phone
    )
    res = await db.execute(stmt)
    lead = res.scalars().first()

    if not lead:
        lead = Lead(
            tenant_id=ctx.tenant_id,
            name=f"WhatsApp Contact ({clean_phone})",
            phone=clean_phone,
            source="WhatsApp",
            status="Contacted",
            owner_user_id=ctx.user.id,
            estimated_value=0.0
        )
        db.add(lead)
        await db.commit()
        await db.refresh(lead)

    # 2. Proxy to NodeJS gateway (send raw mimeType + data + fileName + caption)
    try:
        proxy_body = {
            "mimeType": payload.mimeType,
            "data": payload.data,
            "fileName": payload.fileName,
            "caption": payload.caption,
        }
        async with _gateway_client() as client:
            resp = await client.post(
                f"{GATEWAY_URL}/sessions/{clean_id}/chats/{clean_phone}/send-media",
                json=proxy_body,
                timeout=30.0,
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail=resp.text)
            gateway_res = resp.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"WhatsApp gateway failed to send media to {clean_phone}: {e}")
        raise HTTPException(status_code=502, detail=f"WhatsApp gateway error: {e}")

    # 3. Log as LeadActivity (whatsapp_sent) - store caption or filename as summary
    summary_text = payload.caption or payload.fileName or "[Media]"
    activity = LeadActivity(
        tenant_id=ctx.tenant_id,
        lead_id=lead.id,
        activity_type="whatsapp_sent",
        summary=f"[{payload.mimeType}] {summary_text}"[:500],
        occurred_at=datetime.utcnow(),
        created_by_user_id=ctx.user.id
    )
    db.add(activity)

    # Update Lead's last contact timestamp
    lead.last_contact_at = datetime.utcnow()
    lead.status = "Contacted"

    await db.commit()

    return {
        "success": True,
        "message_id": gateway_res.get("message_id"),
        "timestamp": gateway_res.get("timestamp"),
    }


@router.get("/sessions/{session_id}/chats")
async def get_active_chats(
    session_id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_leads"))],
    db: AsyncSession = Depends(get_db)
):
    clean_id = _clean_digits(session_id)
    is_valid = await _verify_tenant_session(clean_id, ctx, db)
    if not is_valid:
        raise HTTPException(status_code=403, detail="Unauthorized access to this WhatsApp session.")

    try:
        async with _gateway_client() as client:
            resp = await client.get(f"{GATEWAY_URL}/sessions/{clean_id}/chats", timeout=25.0)
            if resp.status_code == 200:
                return resp.json()
            return {"success": False, "chats": [], "error": f"Gateway status {resp.status_code}"}
    except Exception as e:
        logger.error(f"Failed to retrieve active chats from gateway: {e}")
        return {"success": False, "chats": [], "error": str(e)}


# ─── Automation Settings Endpoints ──────────────────────────────────────────

class WhatsAppAutomationSettingsPayload(BaseModel):
    whatsapp_enabled: bool = True
    whatsapp_settings: Dict[str, Any] = Field(default_factory=lambda: {
        "auto_send_invoices": True,
        "auto_send_pos": True,
        "auto_send_quotations": True,
        "auto_send_payments": True,
        "auto_send_inventory_alerts": True,
    })


@router.get("/settings")
async def get_automation_settings(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_leads"))],
    db: AsyncSession = Depends(get_db)
):
    """Retrieve WhatsApp Master Toggle and Automated Dispatch Settings."""
    from src.models import Company
    stmt = select(Tenant).where(Tenant.id == ctx.tenant_id)
    res = await db.execute(stmt)
    tenant = res.scalars().first()

    # Also look at active company
    comp = None
    comp_stmt = select(Company).where(Company.tenant_id == ctx.tenant_id)
    comp_res = await db.execute(comp_stmt)
    comp = comp_res.scalars().first()

    tenant_settings = (tenant.settings or {}) if tenant else {}
    comp_settings = (comp.whatsapp_settings or {}) if (comp and comp.whatsapp_settings) else {}

    master_enabled = True
    if comp is not None and getattr(comp, "whatsapp_enabled", None) is not None:
        master_enabled = bool(comp.whatsapp_enabled)
    elif "whatsapp_enabled" in tenant_settings:
        master_enabled = bool(tenant_settings.get("whatsapp_enabled", True))

    merged_settings = {
        "auto_send_invoices": True,
        "auto_send_pos": True,
        "auto_send_quotations": True,
        "auto_send_payments": True,
        "auto_send_inventory_alerts": True,
    }
    if isinstance(tenant_settings.get("whatsapp_settings"), dict):
        merged_settings.update(tenant_settings["whatsapp_settings"])
    if isinstance(comp_settings, dict):
        merged_settings.update(comp_settings)

    return {
        "whatsapp_enabled": master_enabled,
        "whatsapp_settings": merged_settings,
        "company_id": str(comp.id) if comp else None,
        "company_name": comp.name if comp else (tenant.name if tenant else "Organization")
    }


@router.put("/settings")
async def update_automation_settings(
    payload: WhatsAppAutomationSettingsPayload,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: AsyncSession = Depends(get_db)
):
    """Update WhatsApp Master Toggle and Automated Dispatch Settings across Company and Tenant."""
    from src.models import Company
    
    # Update Tenant
    stmt = select(Tenant).where(Tenant.id == ctx.tenant_id)
    res = await db.execute(stmt)
    tenant = res.scalars().first()
    if tenant:
        t_settings = dict(tenant.settings or {})
        t_settings["whatsapp_enabled"] = payload.whatsapp_enabled
        t_settings["whatsapp_settings"] = payload.whatsapp_settings
        tenant.settings = t_settings
        flag_modified(tenant, "settings")

    # Update all Companies in this tenant
    comp_stmt = select(Company).where(Company.tenant_id == ctx.tenant_id)
    comp_res = await db.execute(comp_stmt)
    companies = comp_res.scalars().all()
    for comp in companies:
        comp.whatsapp_enabled = payload.whatsapp_enabled
        comp.whatsapp_settings = payload.whatsapp_settings
        flag_modified(comp, "whatsapp_settings")

    await db.commit()
    return {
        "success": True,
        "message": "WhatsApp automation settings saved successfully.",
        "whatsapp_enabled": payload.whatsapp_enabled,
        "whatsapp_settings": payload.whatsapp_settings
    }


# ─── Template Management Endpoints ──────────────────────────────────────────

DEFAULT_TEMPLATES = [
    {
        "id": "tpl-promo-01",
        "name": "Exclusive Promotional Offer",
        "category": "Marketing",
        "body": "✨ *Special Exclusive Offer from {{company}}!*\n\nHello *{{name}}*,\nWe are thrilled to share an exclusive limited-time offer just for you! Enjoy premium discounts across all our offerings.\n\nReply to this message to claim your offer or visit us today!\n\nBest regards,\n*{{company}}*",
        "placeholders": ["name", "company"],
        "created_at": "2026-10-01T00:00:00Z"
    },
    {
        "id": "tpl-reminder-02",
        "name": "Payment & Balance Reminder",
        "category": "Reminder",
        "body": "💳 *Payment Reminder from {{company}}*\n\nDear *{{name}}*,\nThis is a gentle reminder regarding your outstanding balance of *{{amount}}*.\n\nPlease clear the balance at your earliest convenience. Thank you for your continued business!\n\nRegards,\n*{{company}} Billing Team*",
        "placeholders": ["name", "amount", "company"],
        "created_at": "2026-10-01T00:00:00Z"
    },
    {
        "id": "tpl-launch-03",
        "name": "New Product / Catalog Launch",
        "category": "Marketing",
        "body": "🚀 *New Arrivals Alert from {{company}}!*\n\nHello *{{name}}*,\nWe've just launched exciting new products! Explore what's new and discover incredible deals tailored for you.\n\nDate: *{{date}}*\nReply *'CATALOG'* to receive our complete brochure.",
        "placeholders": ["name", "company", "date"],
        "created_at": "2026-10-01T00:00:00Z"
    },
    {
        "id": "tpl-festival-04",
        "name": "Festival & Seasonal Greeting",
        "category": "Festival",
        "body": "🌟 *Warm Festive Greetings from {{company}}!*\n\nWishing you and your family joy, prosperity, and abundant happiness this season! Thank you for being a cherished partner in our journey.\n\nWarmest regards,\n*{{company}} Team*",
        "placeholders": ["name", "company"],
        "created_at": "2026-10-01T00:00:00Z"
    },
    {
        "id": "tpl-announcement-05",
        "name": "Important Customer Announcement",
        "category": "Announcement",
        "body": "📢 *Important Announcement from {{company}}*\n\nDear *{{name}}*,\nPlease take note of our latest update effective *{{date}}*.\n\nIf you have any questions or require assistance, our support team is available 24/7.\n\nSincerely,\n*{{company}}*",
        "placeholders": ["name", "company", "date"],
        "created_at": "2026-10-01T00:00:00Z"
    }
]


class TemplateCreatePayload(BaseModel):
    id: str | None = None
    name: str
    category: str = "Marketing"
    body: str
    media_url: str | None = None
    media_mime_type: str | None = None
    media_file_name: str | None = None
    placeholders: List[str] = Field(default_factory=list)


@router.get("/templates")
async def get_templates(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_leads"))],
    db: AsyncSession = Depends(get_db)
):
    """Get all saved WhatsApp message templates for this organization."""
    stmt = select(Tenant).where(Tenant.id == ctx.tenant_id)
    res = await db.execute(stmt)
    tenant = res.scalars().first()
    if not tenant:
        return DEFAULT_TEMPLATES

    saved = (tenant.settings or {}).get("whatsapp_templates")
    if not saved or not isinstance(saved, list) or len(saved) == 0:
        return DEFAULT_TEMPLATES
    return saved


@router.post("/templates")
async def save_template(
    payload: TemplateCreatePayload,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: AsyncSession = Depends(get_db)
):
    """Create or update a WhatsApp message template."""
    stmt = select(Tenant).where(Tenant.id == ctx.tenant_id)
    res = await db.execute(stmt)
    tenant = res.scalars().first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    settings = dict(tenant.settings or {})
    templates = list(settings.get("whatsapp_templates") or DEFAULT_TEMPLATES)

    tpl_id = payload.id or f"tpl-{uuid.uuid4().hex[:8]}"
    tpl_data = {
        "id": tpl_id,
        "name": payload.name.strip(),
        "category": payload.category,
        "body": payload.body,
        "media_url": payload.media_url,
        "media_mime_type": payload.media_mime_type,
        "media_file_name": payload.media_file_name,
        "placeholders": payload.placeholders,
        "updated_at": datetime.utcnow().isoformat(),
        "created_at": datetime.utcnow().isoformat()
    }

    # Replace existing or append
    existing_idx = next((i for i, t in enumerate(templates) if t.get("id") == tpl_id), -1)
    if existing_idx >= 0:
        tpl_data["created_at"] = templates[existing_idx].get("created_at", tpl_data["created_at"])
        templates[existing_idx] = tpl_data
    else:
        templates.insert(0, tpl_data)

    settings["whatsapp_templates"] = templates
    tenant.settings = settings
    flag_modified(tenant, "settings")
    await db.commit()

    return {"success": True, "template": tpl_data}


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: AsyncSession = Depends(get_db)
):
    """Delete a WhatsApp message template."""
    stmt = select(Tenant).where(Tenant.id == ctx.tenant_id)
    res = await db.execute(stmt)
    tenant = res.scalars().first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    settings = dict(tenant.settings or {})
    templates = list(settings.get("whatsapp_templates") or DEFAULT_TEMPLATES)
    templates = [t for t in templates if t.get("id") != template_id]

    settings["whatsapp_templates"] = templates
    tenant.settings = settings
    flag_modified(tenant, "settings")
    await db.commit()

    return {"success": True, "message": "Template deleted successfully"}


# ─── Broadcast Campaigns Endpoints ──────────────────────────────────────────

class BroadcastRecipient(BaseModel):
    phone: str
    name: str | None = None
    placeholders: Dict[str, Any] = Field(default_factory=dict)


class BroadcastPayload(BaseModel):
    session_id: str
    campaign_name: str
    target_audience: str = "custom"  # leads, customers, employees, custom
    template_id: str | None = None
    message_body: str
    media: SendMediaPayload | None = None
    recipients: List[BroadcastRecipient]


@router.get("/campaigns")
async def get_campaigns(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_leads"))],
    db: AsyncSession = Depends(get_db)
):
    """Get history of all executed WhatsApp broadcast campaigns."""
    stmt = select(Tenant).where(Tenant.id == ctx.tenant_id)
    res = await db.execute(stmt)
    tenant = res.scalars().first()
    if not tenant:
        return []

    campaigns = (tenant.settings or {}).get("whatsapp_campaigns") or []
    return campaigns


@router.post("/broadcast")
async def run_broadcast_campaign(
    payload: BroadcastPayload,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_leads"))],
    db: AsyncSession = Depends(get_db)
):
    """Execute a WhatsApp broadcast campaign to targeted recipients."""
    from src.models import Company
    clean_session_id = _clean_digits(payload.session_id)
    is_valid = await _verify_tenant_session(clean_session_id, ctx, db)
    if not is_valid:
        raise HTTPException(status_code=403, detail="Unauthorized access to this WhatsApp session.")

    if not payload.recipients:
        raise HTTPException(status_code=400, detail="No recipients selected for broadcast.")

    # Get company info for default {{company}} placeholder
    comp_stmt = select(Company).where(Company.tenant_id == ctx.tenant_id)
    comp_res = await db.execute(comp_stmt)
    comp = comp_res.scalars().first()
    company_name = comp.name if comp else "Our Organization"
    today_str = datetime.utcnow().strftime("%d %b %Y")

    campaign_id = f"cmp-{uuid.uuid4().hex[:8]}"
    sent_count = 0
    failed_count = 0
    logs = []

    async with _gateway_client() as client:
        for rec in payload.recipients:
            raw_phone = _clean_digits(rec.phone)
            if not raw_phone:
                failed_count += 1
                logs.append({"phone": rec.phone, "name": rec.name, "status": "FAILED", "error": "Invalid phone format"})
                continue

            if len(raw_phone) == 10 and not raw_phone.startswith("91"):
                clean_phone = f"91{raw_phone}"
            else:
                clean_phone = raw_phone

            # Resolve template placeholders
            rec_name = rec.name or "Valued Customer"
            msg = payload.message_body
            msg = msg.replace("{{name}}", rec_name)
            msg = msg.replace("{{phone}}", clean_phone)
            msg = msg.replace("{{company}}", company_name)
            msg = msg.replace("{{date}}", today_str)

            # Custom placeholders
            for k, v in rec.placeholders.items():
                msg = msg.replace(f"{{{{{k}}}}}", str(v))

            # Dispatch via Gateway
            try:
                if payload.media and payload.media.data:
                    # Send media with message as caption
                    media_payload = {
                        "mimeType": payload.media.mimeType,
                        "data": payload.media.data,
                        "fileName": payload.media.fileName,
                        "caption": msg
                    }
                    resp = await client.post(
                        f"{GATEWAY_URL}/sessions/{clean_session_id}/chats/{clean_phone}/send-media",
                        json=media_payload,
                        timeout=20.0
                    )
                else:
                    # Send text message
                    resp = await client.post(
                        f"{GATEWAY_URL}/sessions/{clean_session_id}/chats/{clean_phone}/send",
                        json={"message": msg},
                        timeout=15.0
                    )

                if resp.status_code == 200:
                    sent_count += 1
                    logs.append({"phone": clean_phone, "name": rec_name, "status": "SENT", "error": None})
                else:
                    failed_count += 1
                    logs.append({"phone": clean_phone, "name": rec_name, "status": "FAILED", "error": resp.text[:100]})
            except Exception as e:
                failed_count += 1
                logs.append({"phone": clean_phone, "name": rec_name, "status": "FAILED", "error": str(e)})

    # Record campaign in Tenant settings
    stmt = select(Tenant).where(Tenant.id == ctx.tenant_id)
    res = await db.execute(stmt)
    tenant = res.scalars().first()
    if tenant:
        settings = dict(tenant.settings or {})
        campaigns = list(settings.get("whatsapp_campaigns") or [])
        campaign_record = {
            "id": campaign_id,
            "name": payload.campaign_name.strip() or f"Broadcast on {today_str}",
            "target_audience": payload.target_audience,
            "total_recipients": len(payload.recipients),
            "sent_count": sent_count,
            "failed_count": failed_count,
            "status": "Completed" if failed_count == 0 else ("Partial" if sent_count > 0 else "Failed"),
            "has_media": bool(payload.media and payload.media.data),
            "created_at": datetime.utcnow().isoformat(),
            "created_by": str(ctx.user.id),
            "logs": logs[:200]  # Store first 200 logs to prevent bloat
        }
        campaigns.insert(0, campaign_record)
        # Keep latest 50 campaigns
        settings["whatsapp_campaigns"] = campaigns[:50]
        tenant.settings = settings
        flag_modified(tenant, "settings")
        await db.commit()

    return {
        "success": True,
        "campaign_id": campaign_id,
        "total_recipients": len(payload.recipients),
        "sent_count": sent_count,
        "failed_count": failed_count,
        "logs": logs
    }


