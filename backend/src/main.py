import logging
import sys

# Ensure standard streams handle all Unicode currency symbols (e.g. ₹, €, د.إ) safely on Windows
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Passlib bcrypt compatibility patch for newer bcrypt versions
try:
    import bcrypt
    if not hasattr(bcrypt, "__about__"):
        class About:
            __version__ = getattr(bcrypt, "__version__", "4.0.0")
        bcrypt.__about__ = About()
except ImportError:
    pass

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
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

    # Start background enricher service
    try:
        from src.services.rag_enricher import RAGEnricherService
        await RAGEnricherService.start()
    except Exception as enrich_err:
        logger.error(f"Failed to start RAG Enricher Service: {enrich_err}")

    yield

    # Shutdown
    logger.info("Shutting down LazyMonkeyai Core Services...")
    try:
        from src.services.rag_enricher import RAGEnricherService
        await RAGEnricherService.stop()
    except Exception as enrich_err:
        logger.error(f"Failed to stop RAG Enricher Service: {enrich_err}")


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
from fastapi.responses import FileResponse
import os
from pathlib import Path

BASE_DIR = os.path.dirname(os.path.abspath(__file__)) # backend/src
BACKEND_DIR = os.path.dirname(BASE_DIR)              # backend
UPLOAD_IMAGES_DIR = os.path.join(BACKEND_DIR, "upload_images")
IMAGES_DIR = os.path.join(BACKEND_DIR, "images")
STATIC_DIR = os.path.join(BACKEND_DIR, "static")

# Ensure backend/upload_images, backend/images & static folders exist
os.makedirs(UPLOAD_IMAGES_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

app.mount("/upload_images", StaticFiles(directory=UPLOAD_IMAGES_DIR), name="upload_images")
app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/upload_images/{file_path:path}")
async def serve_upload_image_fallback(file_path: str):
    candidate_dirs = [
        UPLOAD_IMAGES_DIR,
        IMAGES_DIR,
        os.path.join(BASE_DIR, "images"),
        STATIC_DIR,
    ]
    for d in candidate_dirs:
        p = os.path.join(d, file_path)
        if os.path.isfile(p):
            return FileResponse(p)
    raise HTTPException(status_code=404, detail="Image not found")

@app.get("/images/{file_path:path}")
async def serve_image_fallback(file_path: str):
    candidate_dirs = [
        UPLOAD_IMAGES_DIR,
        IMAGES_DIR,
        os.path.join(BASE_DIR, "images"),
        STATIC_DIR,
    ]
    for d in candidate_dirs:
        p = os.path.join(d, file_path)
        if os.path.isfile(p):
            return FileResponse(p)
    raise HTTPException(status_code=404, detail="Image not found")

@app.get("/privacy-policy", response_class=FileResponse)
async def get_privacy_policy():
    policy_path = os.path.join(STATIC_DIR, "privacy_policy.html")
    if os.path.exists(policy_path):
        return FileResponse(policy_path)
    return FileResponse(os.path.join(BACKEND_DIR, "static", "privacy_policy.html"))

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.app_name, "env": settings.app_env}

