"""CRM module sub-routers."""
from .groups import router as groups_router
from .segments import router as segments_router
from .memberships import router as memberships_router
from .wallet import router as wallet_router
from .loyalty import router as loyalty_router
from .discounts import router as discounts_router
from .whatsapp_automation import router as whatsapp_automation_router

__all__ = [
    "groups_router",
    "segments_router",
    "memberships_router",
    "wallet_router",
    "loyalty_router",
    "discounts_router",
    "whatsapp_automation_router",
]
