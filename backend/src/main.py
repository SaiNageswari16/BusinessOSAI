import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.api.v1.router import api_router
from src.config import get_settings
from src.database.init_db import init_database
from src.database.session import check_database_health

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s (%s)", settings.app_name, settings.app_env)

    if settings.auto_create_tables:
        try:
            await init_database()
            logger.info("Database initialised")
        except Exception as exc:
            logger.error("Database initialisation failed: %s", exc)
            if settings.app_env == "production":
                raise
    else:
        logger.warning("AUTO_CREATE_TABLES=false — skipping schema creation")

    yield
    logger.info("Shutting down %s", settings.app_name)


app = FastAPI(
    title=settings.app_name,
    description="Restaurant management platform — POS, KOT/KDS, menu, inventory, billing",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS is intentionally wide open for local development across the terminal,
# KDS screens and print bridge. Tighten this via CORS_ORIGINS before production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health")
async def health():
    db_ok = await check_database_health()
    return {
        "status": "ok" if db_ok else "degraded",
        "app": settings.app_name,
        "env": settings.app_env,
        "database": "up" if db_ok else "down",
    }


@app.get("/")
async def root():
    return {
        "app": settings.app_name,
        "version": "1.0.0",
        "docs": "/docs",
        "api": settings.api_v1_prefix,
    }


# Serve generated receipts / PDFs if the directory exists
_static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.isdir(_static_dir):
    app.mount("/static", StaticFiles(directory=_static_dir), name="static")
