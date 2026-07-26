import uuid
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from src.models import LiveNotification, Tenant

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
    Checks tenant settings to confirm if the notification category is active.
    """
    try:
        # Check tenant settings for notification configurations
        tenant = await db.get(Tenant, tenant_id)
        if tenant and tenant.settings:
            cfg = tenant.settings.get("notifications", {})
            if cfg:
                # If notifications are disabled globally for this tenant
                if not cfg.get("enabled", True):
                    logger.info(f"[Live Notification Skip] Globally disabled for tenant {tenant_id}")
                    return None
                # If specific category is turned off
                enabled_categories = cfg.get("categories", ["crm", "hrms", "pos", "inventory", "system"])
                if category not in enabled_categories:
                    logger.info(f"[Live Notification Skip] Category '{category}' disabled for tenant {tenant_id}")
                    return None

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
