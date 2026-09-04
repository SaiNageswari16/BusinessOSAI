from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from src.database.session import get_db
from src.services.crm_service import CrmService

router = APIRouter(prefix="/crm", tags=["CRM & Growth Suite"])

# ── LEADS & SALES PIPELINE ──
@router.get("/leads")
def get_leads(db: Session = Depends(get_db)):
    return CrmService.get_all_leads(db)

@router.post("/leads")
def create_lead(payload: dict = Body(...), db: Session = Depends(get_db)):
    if not payload.get("name") or not payload.get("phone"):
        raise HTTPException(status_code=400, detail="Name and phone are required")
    return CrmService.create_lead(db, payload)

@router.patch("/leads/{lead_id}")
def update_lead(lead_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    return CrmService.update_lead(db, lead_id, payload)

# ── AI VOICE CALLING & LOGS ──
@router.get("/calls")
def get_call_logs(db: Session = Depends(get_db)):
    return CrmService.get_all_call_logs(db)

@router.post("/calls/trigger")
def trigger_ai_call(payload: dict = Body(...), db: Session = Depends(get_db)):
    return CrmService.trigger_ai_call(db, payload)

# ── CUSTOMER SERVICE & SUPPORT TICKETS ──
@router.get("/tickets")
def get_support_tickets(db: Session = Depends(get_db)):
    return CrmService.get_support_tickets(db)

@router.post("/tickets")
def create_support_ticket(payload: dict = Body(...), db: Session = Depends(get_db)):
    if not payload.get("subject") or not payload.get("description"):
        raise HTTPException(status_code=400, detail="Subject and description are required")
    return CrmService.create_support_ticket(db, payload)

@router.patch("/tickets/{ticket_id}/status")
def update_ticket_status(ticket_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    status = payload.get("status", "Resolved")
    return CrmService.update_ticket_status(db, ticket_id, status)

# ── MARKETING AD PIPELINE ──
@router.get("/ads")
def get_marketing_ads(db: Session = Depends(get_db)):
    return CrmService.get_marketing_ads(db)

@router.post("/ads")
def create_marketing_ad(payload: dict = Body(...), db: Session = Depends(get_db)):
    return CrmService.create_marketing_ad(db, payload)
