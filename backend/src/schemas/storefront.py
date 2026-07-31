import uuid
from pydantic import BaseModel, ConfigDict
from typing import Optional

class StorefrontWalletResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    balance: float
    osai_coins: int
    membership_tier: str
    card_last_four: Optional[str] = None

class TopUpRequest(BaseModel):
    amount: float

class StorefrontWalletTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    category: str
    amount: float
    is_positive: bool

class StorefrontJourneyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: Optional[str] = None
    icon_type: str
    action_url: str

class StorefrontNotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    body: str
    type: str
    action_url: Optional[str] = None
    is_read: bool

class StorefrontUserContextResponse(BaseModel):
    wallet: Optional[StorefrontWalletResponse] = None
    active_journey: Optional[StorefrontJourneyResponse] = None
