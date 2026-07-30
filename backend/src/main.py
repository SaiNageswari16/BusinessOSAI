import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.v1.router import api_router
from src.config import get_settings
from src.database.init_db import bootstrap_defaults, init_database
from src.database.session import AsyncSessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Starting %s [%s]", settings.app_name, settings.app_env)
    await init_database()
    async with AsyncSessionLocal() as session:
        try:
            await bootstrap_defaults(session)
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("Bootstrap failed")
            raise

    yield

    logger.info("Shutting down %s", settings.app_name)


app = FastAPI(
    title=settings.app_name,
    description="Multi-tenant Core ERP API for IOTRONCS Retail",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)

from fastapi.staticfiles import StaticFiles
import os

# Ensure backend/images folder exists
os.makedirs("images", exist_ok=True)
app.mount("/images", StaticFiles(directory="images"), name="images")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.app_name, "env": settings.app_env}
