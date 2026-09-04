from src.utils.timezone import now_ist_naive
import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from src.database.base import Base

class Membership(Base):
    __tablename__ = "memberships"

    id = Column(String, primary_key=True, index=True)
    customer_id = Column(String, ForeignKey("customers.id"), index=True, nullable=False)
    plan_name = Column(String, nullable=False)
    plan_type = Column(String, default="ANNUAL")  # MONTHLY, QUARTERLY, ANNUAL, LIFETIME
    status = Column(String, default="ACTIVE")
    start_date = Column(DateTime, default=now_ist_naive)
    expiry_date = Column(DateTime, default=lambda: now_ist_naive() + datetime.timedelta(days=365))
    price = Column(Float, nullable=False)
    paid_amount = Column(Float, default=0.0)
    due_amount = Column(Float, default=0.0)
    benefits = Column(JSON, default=list)
    created_at = Column(DateTime, default=now_ist_naive)
    updated_at = Column(DateTime, default=now_ist_naive, onupdate=now_ist_naive)

    customer = relationship("Customer", back_populates="memberships")
