import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.v1.router import api_router
from src.config.settings import get_settings
from src.database.session import check_database_health
from src.database.init_db import init_database

settings = get_settings()

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Perform basic DB health check & bootstrap
    logger.info("Initializing BusinessOS AI Core Services...")
    try:
        is_healthy = await check_database_health()
        if is_healthy:
            logger.info("PostgreSQL database connection verified.")
            if settings.auto_create_tables:
                await init_database()
        else:
            logger.warning(
                "PostgreSQL connection check failed. System will operate with degraded capabilities."
            )
    except Exception as e:
        logger.error(f"Error during system startup initialization: {e}")

    yield

    # Shutdown
    logger.info("Shutting down BusinessOS AI Core Services...")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="BusinessOS AI - Production ERP Core Backend System",
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
