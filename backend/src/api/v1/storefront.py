import uuid
from typing import Annotated, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from src.database.session import get_db
from src.models.storefront import StorefrontWallet, StorefrontJourney, StorefrontNotification, StorefrontWishlist
from src.schemas.storefront import StorefrontUserContextResponse, StorefrontWalletResponse, StorefrontJourneyResponse, StorefrontNotificationResponse, StorefrontWishlistResponse, StorefrontWishlistAddRequest

router = APIRouter(prefix="/storefront/public", tags=["Storefront Context"])

# For demo purposes, we use a fixed demo user ID if none is provided.
# In a real system, this would come from a CurrentUserContext dependency.
DEMO_USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")

@router.get("/user-context", response_model=StorefrontUserContextResponse)
async def get_user_context(
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: uuid.UUID = Query(default=DEMO_USER_ID, description="User ID for context. Defaults to demo user.")
):
    """
    Fetch the contextual data for the storefront user, including their Wallet and Active Journey.
    """
    # Fetch Wallet
    wallet_result = await db.execute(
        select(StorefrontWallet).where(StorefrontWallet.user_id == user_id)
    )
    wallet = wallet_result.scalar_one_or_none()

    # Fetch active journey (just grabbing the most recent one for the demo)
    journey_result = await db.execute(
        select(StorefrontJourney)
        .where(StorefrontJourney.user_id == user_id)
        .order_by(StorefrontJourney.created_at.desc())
        .limit(1)
    )
    journey = journey_result.scalar_one_or_none()

    # If demo user has no data yet, create it on the fly so the frontend works immediately
    if not wallet and user_id == DEMO_USER_ID:
        wallet = StorefrontWallet(
            user_id=DEMO_USER_ID,
            balance=1250.50,
            osai_coins=5200,
            membership_tier="Platinum Member",
            card_last_four="8924"
        )
        db.add(wallet)
        
        journey = StorefrontJourney(
            user_id=DEMO_USER_ID,
            title="Complete your flight booking to Dubai",
            description="Emirates Airlines • Departure: Aug 24",
            icon_type="plane",
            action_url="/store/cart"
        )
        db.add(journey)
        await db.commit()
        await db.refresh(wallet)
        await db.refresh(journey)

    return StorefrontUserContextResponse(
        wallet=wallet,
        active_journey=journey
    )

@router.get("/notifications", response_model=List[StorefrontNotificationResponse])
async def get_notifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: uuid.UUID = Query(default=DEMO_USER_ID)
):
    # Ensure there are some demo notifications
    if user_id == DEMO_USER_ID:
        count = await db.scalar(select(func.count()).select_from(StorefrontNotification).where(StorefrontNotification.user_id == user_id))
        if count == 0:
            db.add_all([
                StorefrontNotification(
                    user_id=DEMO_USER_ID,
                    title="Flight Reminder",
                    body="Your flight to Dubai (EK501) departs in 24 hours. Click here to check in.",
                    type="travel",
                    action_url="/store/travel/checkin",
                    is_read=False
                ),
                StorefrontNotification(
                    user_id=DEMO_USER_ID,
                    title="Order Delivered",
                    body="Your grocery order #GR-8910 has been delivered to your doorstep.",
                    type="order",
                    action_url="/store/orders/GR-8910",
                    is_read=False
                )
            ])
            await db.commit()
            
    result = await db.execute(
        select(StorefrontNotification)
        .where(StorefrontNotification.user_id == user_id)
        .order_by(StorefrontNotification.created_at.desc())
        .limit(20)
    )
    return result.scalars().all()

@router.post("/notifications/read")
async def mark_notifications_read(
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: uuid.UUID = Query(default=DEMO_USER_ID)
):
    from sqlalchemy import update
    stmt = update(StorefrontNotification).where(
        StorefrontNotification.user_id == user_id,
        StorefrontNotification.is_read == False
    ).values(is_read=True)
    await db.execute(stmt)
    await db.commit()
    return {"status": "success"}

from src.models.storefront import StorefrontWalletTransaction
from src.schemas.storefront import StorefrontWalletTransactionResponse, TopUpRequest
from fastapi import HTTPException

@router.get("/wallet/transactions", response_model=List[StorefrontWalletTransactionResponse])
async def get_wallet_transactions(
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: uuid.UUID = Query(default=DEMO_USER_ID)
):
    result = await db.execute(
        select(StorefrontWalletTransaction)
        .where(StorefrontWalletTransaction.user_id == user_id)
        .order_by(StorefrontWalletTransaction.created_at.desc())
    )
    return result.scalars().all()

@router.post("/wallet/topup", response_model=StorefrontWalletResponse)
async def topup_wallet(
    request: TopUpRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: uuid.UUID = Query(default=DEMO_USER_ID)
):
    # Fetch Wallet
    wallet_result = await db.execute(
        select(StorefrontWallet).where(StorefrontWallet.user_id == user_id)
    )
    wallet = wallet_result.scalar_one_or_none()
    
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    from decimal import Decimal
    amount_decimal = Decimal(str(request.amount))

    # Update balance
    wallet.balance += amount_decimal
    
    # 10% coin reward
    wallet.osai_coins += int(request.amount * 0.1)

    # Create transaction log
    transaction = StorefrontWalletTransaction(
        user_id=user_id,
        title="LazyMonkeyAI Top Up",
        category="Deposit",
        amount=amount_decimal,
        is_positive=True
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(wallet)
    
    return wallet
