from src.utils.timezone import now_ist_naive
import datetime
from sqlalchemy import Column, String, Boolean, DateTime
from src.database.base import Base

class GymBranch(Base):
    __tablename__ = "gym_branches"

    id = Column(String, primary_key=True, index=True)
    gym_name = Column(String, nullable=False)
    branch_name = Column(String, nullable=False)
    city = Column(String, nullable=False)
    address = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=now_ist_naive)

class GymSetting(Base):
    __tablename__ = "gym_settings"

    id = Column(String, primary_key=True, index=True, default="default")
    gym_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    gstin = Column(String, nullable=True)
    essl_bioserver_url = Column(String, nullable=True)
    enable_auto_sms = Column(Boolean, default=True)
    enable_gate_autolock = Column(Boolean, default=True)
    enable_pos = Column(Boolean, default=True)
    enable_inventory = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=now_ist_naive, onupdate=now_ist_naive)

class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    code = Column(String, nullable=True)
    icon = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=now_ist_naive)


class FeatureControl(Base):
    """Database-driven Plan Feature Control Matrix table."""
    __tablename__ = "feature_controls"

    id = Column(String, primary_key=True, index=True)
    feature_name = Column(String, nullable=False, unique=True, index=True)
    starter = Column(Boolean, default=False)
    pro = Column(Boolean, default=False)
    business = Column(Boolean, default=True)
    enterprise = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=now_ist_naive, onupdate=now_ist_naive)
