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
    logger.info("Initializing LazyMonkeyai Core Services...")
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
    logger.info("Shutting down LazyMonkeyai Core Services...")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="LazyMonkeyai - Production ERP Core Backend System",
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

# Ensure backend/images & static folders exist
os.makedirs("images", exist_ok=True)
os.makedirs("static", exist_ok=True)
app.mount("/images", StaticFiles(directory="images"), name="images")
app.mount("/static", StaticFiles(directory="static"), name="static")

from fastapi.responses import FileResponse

@app.get("/privacy-policy", response_class=FileResponse)
async def get_privacy_policy():
    policy_path = os.path.join("static", "privacy_policy.html")
    if os.path.exists(policy_path):
        return FileResponse(policy_path)
    return FileResponse(os.path.join("..", "static", "privacy_policy.html"))

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.app_name, "env": settings.app_env}

