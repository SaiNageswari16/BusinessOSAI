from fastapi import APIRouter

from src.api.v1.marketplace.vendors import router as vendors_router
from src.api.v1.marketplace.products import router as products_router
from src.api.v1.marketplace.orders import router as orders_router
from src.api.v1.marketplace.delivery import router as delivery_router
from src.api.v1.marketplace.promotions import router as promotions_router
from src.api.v1.marketplace.intelligence import router as intelligence_router

router = APIRouter(prefix="/marketplace", tags=["Marketplace Management"])

router.include_router(vendors_router)
router.include_router(products_router)
router.include_router(orders_router)
router.include_router(delivery_router)
router.include_router(promotions_router)
router.include_router(intelligence_router)
