import uuid
import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, JSON
from src.database.base import Base
from src.utils.timezone import now_ist_naive

class CrmLead(Base):
    __tablename__ = "crm_leads"

    id = Column(String, primary_key=True, index=True, default=lambda: f"lead_{uuid.uuid4().hex[:8]}")
    name = Column(String, nullable=False, index=True)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=True)
    source = Column(String, default="Instagram Ad")
    interest = Column(String, default="Weight Loss & Transformation")
    assigned_trainer = Column(String, default="Head Coach")
    status = Column(String, default="lead", index=True)  # lead, enquiry, trial, follow_up, negotiation, enrollment, active, lost
    stage = Column(String, default="Prospecting")
    probability = Column(Integer, default=50)
    deal_value = Column(Float, default=15000.0)
    notes = Column(Text, nullable=True)
    last_contacted_at = Column(DateTime, default=now_ist_naive)
    created_at = Column(DateTime, default=now_ist_naive)

class CrmVoiceCallLog(Base):
    __tablename__ = "crm_voice_call_logs"

    id = Column(String, primary_key=True, index=True, default=lambda: f"call_{uuid.uuid4().hex[:8]}")
    contact_name = Column(String, nullable=False)
    contact_type = Column(String, default="LEAD")  # LEAD, CUSTOMER, TRIAL
    phone = Column(String, nullable=False)
    status = Column(String, default="Completed")  # Completed, Busy, No Answer, In Progress
    duration_seconds = Column(Integer, default=12)
    duration_formatted = Column(String, default="0m 12s")
    sentiment = Column(String, default="Positive")  # Positive, Neutral, Hesitant, Negative
    qualification_score = Column(Integer, default=65)  # 0 to 100
    ai_summary = Column(Text, nullable=False)
    action_items = Column(JSON, default=list)  # ["Send customized ROI analysis..."]
    transcript = Column(Text, nullable=True)
    audio_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=now_ist_naive)

class CrmSupportTicket(Base):
    __tablename__ = "crm_support_tickets"

    id = Column(String, primary_key=True, index=True, default=lambda: f"tkt_{uuid.uuid4().hex[:6]}")
    customer_name = Column(String, nullable=True)
    customer_id = Column(String, nullable=True)
    subject = Column(String, nullable=False)
    category = Column(String, default="General Support")  # General Support, Billing & Payment, Trainer / Service, Equipment / Facility, Membership
    priority = Column(String, default="Medium")  # Low, Medium, High, Urgent
    status = Column(String, default="Open", index=True)  # Open, In Progress, Resolved, Closed
    description = Column(Text, nullable=False)
    assigned_to = Column(String, default="Support Desk")
    created_at = Column(DateTime, default=now_ist_naive)
    resolved_at = Column(DateTime, nullable=True)

class CrmMarketingAd(Base):
    __tablename__ = "crm_marketing_ads"

    id = Column(String, primary_key=True, index=True, default=lambda: f"ad_{uuid.uuid4().hex[:8]}")
    headline = Column(String, nullable=False)
    prompt = Column(Text, nullable=False)
    aspect_ratio = Column(String, default="1:1 (Post Square)")
    model_used = Column(String, default="Gemini Imagen")
    image_url = Column(Text, nullable=True)
    caption = Column(Text, nullable=True)
    target_audience = Column(String, default="Fitness & Gym Enthusiasts 18-45")
    status = Column(String, default="Draft")  # Draft, Approved, Published, Scheduled
    meta_campaign_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=now_ist_naive)
