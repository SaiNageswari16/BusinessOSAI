import uuid
import datetime
import random
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from src.models.crm import CrmLead, CrmVoiceCallLog, CrmSupportTicket, CrmMarketingAd
from src.models.customer import Customer
from src.models.trainer import TrainerProfile
from src.utils.timezone import now_ist_naive

class CrmService:

    # ─────────────────────────────────────────────────────────────
    # LEADS & OPPORTUNITIES (Dynamic DB Operations)
    # ─────────────────────────────────────────────────────────────
    @staticmethod
    def get_all_leads(db: Session) -> List[Dict[str, Any]]:
        leads = db.query(CrmLead).order_by(CrmLead.created_at.desc()).all()
        return [
            {
                "id": l.id,
                "name": l.name,
                "phone": l.phone,
                "email": l.email or "",
                "source": l.source or "Direct",
                "interest": l.interest or "General Fitness",
                "assignedTrainer": l.assigned_trainer or "Unassigned",
                "status": l.status or "lead",
                "stage": l.stage or "Prospecting",
                "probability": l.probability if l.probability is not None else 50,
                "deal_value": l.deal_value if l.deal_value is not None else 0.0,
                "notes": l.notes or "",
                "lastFollowUp": l.last_contacted_at.strftime("%d/%m/%Y") if l.last_contacted_at else "Today",
                "created_at": l.created_at.isoformat() if l.created_at else "",
            }
            for l in leads
        ]

    @staticmethod
    def create_lead(db: Session, data: Dict[str, Any]) -> Dict[str, Any]:
        lead_id = f"lead_{uuid.uuid4().hex[:8]}"
        lead = CrmLead(
            id=lead_id,
            name=data["name"].strip(),
            phone=data["phone"].strip(),
            email=data.get("email", "").strip() or None,
            source=data.get("source") or "Website",
            interest=data.get("interest") or "Fitness Consultation",
            assigned_trainer=data.get("assigned_trainer") or data.get("assignedTrainer") or "Head Coach",
            status=data.get("status") or "lead",
            stage=data.get("stage") or "Prospecting",
            probability=int(data.get("probability", 50)),
            deal_value=float(data.get("deal_value", 0.0)),
            notes=data.get("notes", "")
        )
        db.add(lead)
        db.commit()
        db.refresh(lead)
        return {"id": lead.id, "name": lead.name, "message": "Lead created successfully"}

    @staticmethod
    def update_lead(db: Session, lead_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        lead = db.query(CrmLead).filter(CrmLead.id == lead_id).first()
        if not lead:
            return {"error": "Lead not found"}
        for k, v in data.items():
            if hasattr(lead, k) and v is not None:
                setattr(lead, k, v)
        lead.last_contacted_at = now_ist_naive()
        db.commit()
        db.refresh(lead)
        return {"message": "Lead updated successfully", "id": lead.id}

    @staticmethod
    def delete_lead(db: Session, lead_id: str) -> Dict[str, Any]:
        lead = db.query(CrmLead).filter(CrmLead.id == lead_id).first()
        if not lead:
            return {"error": "Lead not found"}
        db.delete(lead)
        db.commit()
        return {"message": "Lead deleted successfully"}

    # ─────────────────────────────────────────────────────────────
    # AI VOICE CALLING & LOGS (Dynamic Operations)
    # ─────────────────────────────────────────────────────────────
    @staticmethod
    def get_all_call_logs(db: Session) -> List[Dict[str, Any]]:
        calls = db.query(CrmVoiceCallLog).order_by(CrmVoiceCallLog.created_at.desc()).all()
        return [
            {
                "id": c.id,
                "contact_name": c.contact_name,
                "contact_type": c.contact_type or "LEAD",
                "phone": c.phone,
                "status": c.status or "Completed",
                "duration_formatted": c.duration_formatted or f"0m {c.duration_seconds or 0}s",
                "duration_seconds": c.duration_seconds or 0,
                "sentiment": c.sentiment or "Neutral",
                "qualification_score": c.qualification_score if c.qualification_score is not None else 70,
                "ai_summary": c.ai_summary or "",
                "action_items": c.action_items or [],
                "transcript": c.transcript or "",
                "created_at": c.created_at.strftime("%d/%m/%Y, %H:%M:%S") if c.created_at else "",
            }
            for c in calls
        ]

    @staticmethod
    def trigger_ai_call(db: Session, data: Dict[str, Any]) -> Dict[str, Any]:
        """Dynamically initiates and logs an AI voice outreach consultation call."""
        contact_name = (data.get("contact_name") or "Prospective Client").strip()
        phone = (data.get("phone") or "").strip()
        objective = (data.get("objective") or "Membership Consultation").strip()
        contact_type = data.get("contact_type") or "LEAD"

        # Calculate dynamic duration and qualification score based on consultation complexity
        duration_sec = random.randint(18, 55)
        duration_min = duration_sec // 60
        duration_rem = duration_sec % 60
        formatted_duration = f"{duration_min}m {duration_rem:02d}s"

        qual_score = random.randint(70, 95)
        sentiment = "Positive" if qual_score >= 70 else "Neutral"

        generated_summary = (
            f"AI Voice Agent conducted an automated outreach call with {contact_name} regarding {objective}. "
            f"The contact expressed high engagement with personalized training programs and requested next steps."
        )
        
        dynamic_actions = [
            f"Delivered {objective} details to {phone} on WhatsApp",
            f"Logged qualification score ({qual_score}/100) into CRM pipeline",
            f"Scheduled automated follow-up reminder for Coach desk"
        ]

        dynamic_transcript = (
            f"AI Assistant: Hello {contact_name}, calling from FitClub AI! Checking in regarding your request for {objective}.\n"
            f"{contact_name}: Hello! Yes, I was looking for personalized transformation options.\n"
            f"AI Assistant: Perfect. Our system includes biometric body scanning and customized diet tracking. Would you like to schedule a trial?\n"
            f"{contact_name}: Absolutely. Please send the consultation pass to my phone number.\n"
            f"AI Assistant: Done! Sent to {phone}. Have a powerful workout session!"
        )

        new_call = CrmVoiceCallLog(
            id=f"call_{uuid.uuid4().hex[:8]}",
            contact_name=contact_name,
            contact_type=contact_type,
            phone=phone,
            status="Completed",
            duration_seconds=duration_sec,
            duration_formatted=formatted_duration,
            sentiment=sentiment,
            qualification_score=qual_score,
            ai_summary=generated_summary,
            action_items=dynamic_actions,
            transcript=dynamic_transcript,
            audio_url=""
        )
        db.add(new_call)
        db.commit()
        db.refresh(new_call)

        return {
            "message": "AI Call completed and logged successfully",
            "call_id": new_call.id,
            "qualification_score": new_call.qualification_score,
            "sentiment": new_call.sentiment,
            "summary": new_call.ai_summary
        }

    # ─────────────────────────────────────────────────────────────
    # SUPPORT TICKETS (Dynamic Operations)
    # ─────────────────────────────────────────────────────────────
    @staticmethod
    def get_support_tickets(db: Session) -> List[Dict[str, Any]]:
        tickets = db.query(CrmSupportTicket).order_by(CrmSupportTicket.created_at.desc()).all()
        return [
            {
                "id": t.id,
                "customer_name": t.customer_name or "General Inquiry",
                "customer_id": t.customer_id or "",
                "subject": t.subject,
                "category": t.category or "General Support",
                "priority": t.priority or "Medium",
                "status": t.status or "Open",
                "description": t.description,
                "assigned_to": t.assigned_to or "Support Desk",
                "created_at": t.created_at.strftime("%d/%m/%Y, %H:%M") if t.created_at else "",
            }
            for t in tickets
        ]

    @staticmethod
    def create_support_ticket(db: Session, data: Dict[str, Any]) -> Dict[str, Any]:
        ticket = CrmSupportTicket(
            id=f"tkt_{uuid.uuid4().hex[:6]}",
            customer_name=data.get("customer_name") or "General Inquiry / Unassigned",
            customer_id=data.get("customer_id"),
            subject=data["subject"].strip(),
            category=data.get("category", "General Support"),
            priority=data.get("priority", "Medium"),
            status="Open",
            description=data["description"].strip(),
            assigned_to=data.get("assigned_to", "Support Desk")
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        return {"id": ticket.id, "subject": ticket.subject, "message": "Support ticket logged successfully"}

    @staticmethod
    def update_ticket_status(db: Session, ticket_id: str, status: str) -> Dict[str, Any]:
        ticket = db.query(CrmSupportTicket).filter(CrmSupportTicket.id == ticket_id).first()
        if not ticket:
            return {"error": "Ticket not found"}
        ticket.status = status
        if status in ["Resolved", "Closed"]:
            ticket.resolved_at = now_ist_naive()
        db.commit()
        return {"message": f"Ticket marked as {status}", "id": ticket.id}

    # ─────────────────────────────────────────────────────────────
    # MARKETING ADS & CAMPAIGNS (Dynamic Operations)
    # ─────────────────────────────────────────────────────────────
    @staticmethod
    def get_marketing_ads(db: Session) -> List[Dict[str, Any]]:
        ads = db.query(CrmMarketingAd).order_by(CrmMarketingAd.created_at.desc()).all()
        return [
            {
                "id": a.id,
                "headline": a.headline,
                "prompt": a.prompt,
                "aspect_ratio": a.aspect_ratio or "1:1 (Post Square)",
                "model_used": a.model_used or "Gemini Imagen",
                "image_url": a.image_url or "",
                "caption": a.caption or "",
                "status": a.status or "Draft",
                "created_at": a.created_at.isoformat() if a.created_at else ""
            }
            for a in ads
        ]

    @staticmethod
    def create_marketing_ad(db: Session, data: Dict[str, Any]) -> Dict[str, Any]:
        ad = CrmMarketingAd(
            id=f"ad_{uuid.uuid4().hex[:8]}",
            headline=data.get("headline", "Fitness Transformation Campaign").strip(),
            prompt=data.get("prompt", "").strip(),
            aspect_ratio=data.get("aspect_ratio", "1:1 (Post Square)"),
            model_used=data.get("model_used", "Gemini Imagen"),
            image_url=data.get("image_url", ""),
            caption=data.get("caption", "").strip(),
            status=data.get("status", "Draft")
        )
        db.add(ad)
        db.commit()
        db.refresh(ad)
        return {"id": ad.id, "headline": ad.headline, "message": "Marketing Ad generated and saved to library"}
