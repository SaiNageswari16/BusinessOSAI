from typing import Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime

class CustomerBase(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = None
    weight: Optional[float] = None
    bmi: Optional[float] = None
    fitness_score: Optional[int] = None
    goal: Optional[str] = None
    profile_image: Optional[str] = None
    status: Optional[str] = None

class CustomerCreate(CustomerBase):
    assigned_trainer_name: Optional[str] = None
    membership_plan: Optional[str] = None
    plan_price: Optional[float] = None
    plan_duration_days: Optional[int] = None
    payment_method: Optional[str] = None
    is_face_enrolled: Optional[bool] = None

class CustomerResponse(CustomerBase):
    id: str
    user_id: str
    trainer_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
