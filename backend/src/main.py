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
from fastapi.responses import FileResponse, Response
import os
import shutil
from pathlib import Path

BASE_DIR = Path(os.path.dirname(os.path.abspath(__file__))) # backend/src
BACKEND_DIR = BASE_DIR.parent                               # backend
WORKSPACE_DIR = BACKEND_DIR.parent                          # BusinessOSAI

UPLOAD_IMAGES_DIR = BACKEND_DIR / "upload_images"
IMAGES_DIR = BACKEND_DIR / "images"
STATIC_DIR = BACKEND_DIR / "static"

# Ensure backend/upload_images, backend/images & static folders exist
UPLOAD_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
STATIC_DIR.mkdir(parents=True, exist_ok=True)

# Sync any images stored in src/upload_images to backend/upload_images
src_upload_dir = BASE_DIR / "upload_images"
if src_upload_dir.exists():
    for f in src_upload_dir.glob("*"):
        if f.is_file():
            dest = UPLOAD_IMAGES_DIR / f.name
            if not dest.exists():
                shutil.copy2(f, dest)

DEFAULT_PLACEHOLDER_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:#f8fafc;border-radius:12px;"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>"""

def find_image_on_disk(file_path: str) -> Path | None:
    clean_name = os.path.basename(file_path)
    search_dirs = [
        UPLOAD_IMAGES_DIR,
        IMAGES_DIR,
        STATIC_DIR / "uploads" / "products",
        STATIC_DIR / "uploads",
        STATIC_DIR,
        BASE_DIR / "upload_images",
        BASE_DIR / "images",
        BACKEND_DIR / "uploaded_images",
        BACKEND_DIR / "uploaded images",
        WORKSPACE_DIR / "upload_images",
        WORKSPACE_DIR / "uploaded_images",
        WORKSPACE_DIR / "uploaded images",
        WORKSPACE_DIR / "frontend" / "public" / "images",
        WORKSPACE_DIR / "frontend" / "public" / "upload_images",
    ]
    for d in search_dirs:
        if d.is_file():
            return d
        p = d / file_path
        if p.is_file():
            return p
        p_base = d / clean_name
        if p_base.is_file():
            return p_base
    return None

@app.get("/upload_images/{file_path:path}")
async def serve_upload_image_fallback(file_path: str):
    p = find_image_on_disk(file_path)
    if p:
        return FileResponse(str(p))
    # Graceful fallback: return clean SVG placeholder instead of 404
    return Response(content=DEFAULT_PLACEHOLDER_SVG, media_type="image/svg+xml")

@app.get("/images/{file_path:path}")
async def serve_image_fallback(file_path: str):
    p = find_image_on_disk(file_path)
    if p:
        return FileResponse(str(p))
    # Graceful fallback: return clean SVG placeholder instead of 404
    return Response(content=DEFAULT_PLACEHOLDER_SVG, media_type="image/svg+xml")

@app.get("/vault/{file_path:path}")
async def serve_vault_fallback(file_path: str):
    vault_p = STATIC_DIR / "vault" / file_path
    if vault_p.is_file():
        return FileResponse(str(vault_p), media_type="application/pdf" if file_path.endswith(".pdf") else None)
    
    # On-the-fly generation for offer letters if file not yet cached on disk
    if "offers" in file_path and file_path.endswith(".pdf"):
        offer_id_raw = os.path.basename(file_path).replace(".pdf", "").strip()
        try:
            import uuid
            from src.models import OfferLetter, Tenant
            from src.database.session import get_db
            from src.api.v1.hrms.recruitment import generate_offer_letter_pdf
            
            offer_uuid = uuid.UUID(offer_id_raw)
            async for db in get_db():
                offer = await db.get(OfferLetter, offer_uuid)
                if offer:
                    tenant = await db.scalar(Tenant.__table__.select().where(Tenant.id == offer.tenant_id)) if hasattr(Tenant, '__table__') else None
                    comp_name = "BusinessOS Enterprise"
                    pdf_bytes = generate_offer_letter_pdf(offer, comp_name)
                    vault_p.parent.mkdir(parents=True, exist_ok=True)
                    vault_p.write_bytes(pdf_bytes)
                    return Response(content=pdf_bytes, media_type="application/pdf")
        except Exception as e:
            logger.warning(f"On-the-fly PDF generation skipped for {file_path}: {e}")

    raise HTTPException(status_code=404, detail="File not found in compliance vault")

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/privacy-policy", response_class=FileResponse)
async def get_privacy_policy():
    policy_path = os.path.join(STATIC_DIR, "privacy_policy.html")
    if os.path.exists(policy_path):
        return FileResponse(policy_path)
    return FileResponse(os.path.join(BACKEND_DIR, "static", "privacy_policy.html"))

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.app_name, "env": settings.app_env}

