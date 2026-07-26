import uuid
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from src.models import LiveNotification

logger = logging.getLogger(__name__)

async def add_system_notification(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    title: str,
    body: str,
    category: str = "system"
) -> LiveNotification:
    """
    Creates and saves a real-time live notification record in the database.
    This notification will be picked up by user topbar alerts.
    """
    try:
        notif = LiveNotification(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            title=title,
            body=body,
            category=category,
            unread=True
        )
        db.add(notif)
        await db.flush()  # Write to DB without committing yet (delegating commit to caller)
        logger.info(f"[Live Notification] Saved: '{title}' under category '{category}'")
        return notif
    except Exception as e:
        logger.error(f"[Live Notification Error] Failed to create system notification: {e}")
        return None
