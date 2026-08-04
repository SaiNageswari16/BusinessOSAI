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
            if session_id in active_sessions:
                matched_tenant = t
                break

    if not matched_tenant:
        # Fallback to first tenant
        logger.warning(f"Session {session_id} not mapped to any Tenant settings. Using fallback first tenant.")
        stmt = select(Tenant).limit(1)
        res = await db.execute(stmt)
        matched_tenant = res.scalars().first()

    if not matched_tenant:
        raise HTTPException(status_code=404, detail="No tenant configured in system")

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

    # Build responsive status object
    result = {}
    for num in db_sessions:
        status_info = gateway_sessions.get(num, {"status": "DISCONNECTED", "qr": None, "info": None})
        
        # Add owner metadata
        owner_agent_name = "System Auto-Assigned"
        owner_id = agent_sessions.get(num)
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
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_leads"))]
):
    clean_id = _clean_digits(session_id)
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


@router.get("/sessions/{session_id}/chats")
async def get_active_chats(
    session_id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_leads"))]
):
    clean_id = _clean_digits(session_id)
    try:
        async with _gateway_client() as client:
            resp = await client.get(f"{GATEWAY_URL}/sessions/{clean_id}/chats", timeout=25.0)
            if resp.status_code == 200:
                return resp.json()
            return {"success": False, "chats": [], "error": f"Gateway status {resp.status_code}"}
    except Exception as e:
        logger.error(f"Failed to retrieve active chats from gateway: {e}")
        return {"success": False, "chats": [], "error": str(e)}

