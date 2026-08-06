"""
RAG Enricher Background Service
================================
Silently enriches products in the MasterCatalogProduct table with web-sourced details,
images, and specifications. ALL I/O (HTTP, DB) is async — this service never blocks
the FastAPI event loop and never interferes with live application traffic.

Image sourcing waterfall (highest -> lowest priority):
  1. AI-returned image URL (Gemini / Claude / public registry)
  2. Google web search -> scrape og:image from product result pages
  3. DuckDuckGo Images API (no key needed)
  4. Bing Images scraping
"""
import asyncio
import logging
import random
import re
import string
import uuid
from datetime import datetime
from typing import Optional

import httpx                      # async HTTP -- never blocks the event loop
from sqlalchemy import select, or_, and_, func
from sqlalchemy.exc import SQLAlchemyError

from src.database.session import AsyncSessionLocal
from src.models.inventory import MasterCatalogProduct, Product, Brand, ProductCategory
from src.models import EntityStatus
from src.config import get_settings

logger = logging.getLogger("rag_enricher")
settings = get_settings()

# ---------------------------------------------------------------------------
# Shared async HTTP client
# ---------------------------------------------------------------------------
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
}

_http_client: Optional[httpx.AsyncClient] = None


def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            headers=_HEADERS,
            timeout=httpx.Timeout(connect=8.0, read=20.0, write=10.0, pool=5.0),
            follow_redirects=True,
            limits=httpx.Limits(max_connections=12, max_keepalive_connections=6),
        )
    return _http_client


# ---------------------------------------------------------------------------
# Async image search: Google -> DuckDuckGo -> Bing
# ---------------------------------------------------------------------------

async def _google_search_images_async(barcode: str, product_name: str = "") -> str:
    """
    Search Google for the barcode, follow top result pages, and extract the
    best product image (og:image / twitter:image).
    Returns a cached local /images/<filename> path, or "" on failure.
    All HTTP calls are async -- never blocks the event loop.
    """
    client = _get_http_client()
    query = f"{product_name} {barcode}".strip() if product_name else barcode

    # Step 1: Google Web Search -> collect result page URLs
    result_urls: list = []
    try:
        resp = await client.get(
            "https://www.google.com/search",
            params={"q": query, "num": 8, "hl": "en"},
        )
        if resp.status_code == 200:
            raw_links = re.findall(r'/url\?q=(https?://[^&"]+)', resp.text)
            _SKIP = ("google.com", "google.co.", "youtube.com", "facebook.com",
                     "twitter.com", "instagram.com", "linkedin.com", "pinterest.com",
                     "accounts.google", "support.google")
            for link in raw_links:
                decoded = (link
                           .replace("%3A", ":").replace("%2F", "/")
                           .replace("%3F", "?").replace("%3D", "=").replace("%26", "&"))
                if not any(skip in decoded for skip in _SKIP):
                    result_urls.append(decoded)
                if len(result_urls) >= 5:
                    break
    except Exception as e:
        logger.debug("[ImageSearch] Google search request failed for %s: %s", barcode, e)

    # Step 2: Fetch each result page and extract og:image / twitter:image
    for url in result_urls:
        try:
            page = await client.get(url, timeout=8.0)
            if page.status_code != 200:
                continue
            text = page.text

            # og:image (highest priority)
            og = re.search(
                r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
                text, re.IGNORECASE
            ) or re.search(
                r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
                text, re.IGNORECASE
            )
            if og:
                img_url = og.group(1).strip()
                if img_url.startswith("http"):
                    cached = await _cache_image_async(img_url, barcode)
                    if cached:
                        logger.info("[ImageSearch] Google og:image for barcode %s from %s", barcode, url)
                        return cached

            # twitter:image fallback
            tw = re.search(
                r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\']',
                text, re.IGNORECASE
            )
            if tw:
                img_url = tw.group(1).strip()
                if img_url.startswith("http"):
                    cached = await _cache_image_async(img_url, barcode)
                    if cached:
                        logger.info("[ImageSearch] Google twitter:image for barcode %s", barcode)
                        return cached
        except Exception as e:
            logger.debug("[ImageSearch] Page fetch error for %s: %s", url, e)

    # Step 3: DuckDuckGo Images API (no API key needed)
    try:
        token_resp = await client.get(
            "https://duckduckgo.com/",
            params={"q": query},
        )
        vqd_match = re.search(r'vqd=["\']([\w-]+)["\']', token_resp.text)
        if vqd_match:
            vqd = vqd_match.group(1)
            img_resp = await client.get(
                "https://duckduckgo.com/i.js",
                params={"q": query, "vqd": vqd, "f": ",,,", "p": "1"},
                headers={**_HEADERS, "Referer": "https://duckduckgo.com/"},
            )
            if img_resp.status_code == 200:
                results = img_resp.json().get("results") or []
                for r in results[:5]:
                    img_url = r.get("image", "")
                    if img_url.startswith("http"):
                        cached = await _cache_image_async(img_url, barcode)
                        if cached:
                            logger.info("[ImageSearch] DuckDuckGo image for barcode %s", barcode)
                            return cached
    except Exception as e:
        logger.debug("[ImageSearch] DuckDuckGo failed for %s: %s", barcode, e)

    # Step 4: Bing Images scraping
    try:
        bing = await client.get(
            "https://www.bing.com/images/search",
            params={"q": query, "first": 1},
        )
        if bing.status_code == 200:
            murls = re.findall(r'murl&quot;:&quot;(https?://[^&]+?)&quot;', bing.text)
            if not murls:
                murls = re.findall(r'"murl":"(https?://[^"]+?)"', bing.text)
            for murl in murls[:6]:
                if any(ext in murl.lower() for ext in [".jpg", ".jpeg", ".png", ".webp"]):
                    cached = await _cache_image_async(murl, barcode)
                    if cached:
                        logger.info("[ImageSearch] Bing image for barcode %s", barcode)
                        return cached
    except Exception as e:
        logger.debug("[ImageSearch] Bing failed for %s: %s", barcode, e)

    logger.debug("[ImageSearch] No image found for barcode %s", barcode)
    return ""


async def _cache_image_async(image_url: str, barcode: str) -> str:
    """
    Validate and cache an image asynchronously.
    The blocking Pillow verification runs in a thread pool so it never blocks.
    Returns the local /images/<filename> path on success, or "".
    """
    if not image_url or not image_url.startswith("http"):
        return ""
    try:
        from src.api.v1.inventory.master_catalog import _download_and_cache_product_image
        result = await asyncio.to_thread(_download_and_cache_product_image, image_url, barcode)
        return result or ""
    except Exception as e:
        logger.debug("[ImageCache] Failed to cache %s for %s: %s", image_url, barcode, e)
        return ""


# ---------------------------------------------------------------------------
# Main RAGEnricherService
# ---------------------------------------------------------------------------

class RAGEnricherService:
    _inv_task: Optional[asyncio.Task] = None
    _master_task: Optional[asyncio.Task] = None
    _should_run: bool = False

    @classmethod
    async def start(cls):
        """Starts dual parallel background workers if not already running."""
        if (cls._inv_task is not None and not cls._inv_task.done()) or (
            cls._master_task is not None and not cls._master_task.done()
        ):
            logger.info("RAG Background Enricher workers are already active.")
            return
        cls._should_run = True
        cls._inv_task = asyncio.create_task(cls._inventory_worker_loop())
        cls._master_task = asyncio.create_task(cls._master_worker_loop())
        logger.info("RAG Background Enricher started with 2 parallel workers (Inventory Priority Worker + Master Catalog Worker).")

    @classmethod
    async def stop(cls):
        """Stops both workers gracefully and closes the shared HTTP client."""
        global _http_client
        cls._should_run = False
        for task in (cls._inv_task, cls._master_task):
            if task is not None and not task.done():
                try:
                    task.cancel()
                    await task
                except (asyncio.CancelledError, Exception):
                    pass
        cls._inv_task = None
        cls._master_task = None
        if _http_client and not _http_client.is_closed:
            await _http_client.aclose()
            _http_client = None
        logger.info("RAG Background Enricher stopped both workers.")

    @classmethod
    async def _inventory_worker_loop(cls):
        """
        Worker 1: HIGHEST PRIORITY — Enriches user-added inventory products (Product table).
        Ensures user-uploaded inventory items get images and details enriched FIRST.
        """
        import os
        pause_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            ".rag_enricher_paused",
        )
        semaphore = asyncio.Semaphore(3)

        while cls._should_run:
            try:
                if os.path.exists(pause_file):
                    await asyncio.sleep(5.0)
                    continue

                batch = await cls._fetch_pending_inventory_batch()
                if not batch:
                    await asyncio.sleep(5.0)  # Check every 5s for newly added user products
                    continue

                logger.info("[RAG Enricher - Inventory Worker] Processing %d user-added products...", len(batch))

                tasks = [
                    asyncio.create_task(
                        cls._enrich_single_product(pid, barcode, name, "inventory", semaphore)
                    )
                    for pid, barcode, name in batch
                ]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for r in results:
                    if isinstance(r, Exception):
                        logger.debug("[RAG Enricher - Inventory Worker] Task exception: %s", r)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("[RAG Enricher - Inventory Worker] Unexpected error: %s", e, exc_info=True)
                await asyncio.sleep(10.0)

            await asyncio.sleep(2.0)

    @classmethod
    async def _master_worker_loop(cls):
        """
        Worker 2: BACKGROUND PRIORITY — Enriches Master Catalog products (MasterCatalogProduct table).
        Runs concurrently in parallel without slowing down inventory enrichment.
        """
        import os
        pause_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            ".rag_enricher_paused",
        )
        semaphore = asyncio.Semaphore(3)

        while cls._should_run:
            try:
                if os.path.exists(pause_file):
                    await asyncio.sleep(5.0)
                    continue

                batch = await cls._fetch_pending_master_batch()
                if not batch:
                    await asyncio.sleep(8.0)
                    continue

                logger.info("[RAG Enricher - Master Worker] Processing %d master catalog items...", len(batch))

                tasks = [
                    asyncio.create_task(
                        cls._enrich_single_product(pid, barcode, name, "master_catalog", semaphore)
                    )
                    for pid, barcode, name in batch
                ]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for r in results:
                    if isinstance(r, Exception):
                        logger.debug("[RAG Enricher - Master Worker] Task exception: %s", r)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("[RAG Enricher - Master Worker] Unexpected error: %s", e, exc_info=True)
                await asyncio.sleep(10.0)

            await asyncio.sleep(3.0)

    @classmethod
    async def _fetch_pending_inventory_batch(cls) -> list:
        """Fetch user-added Product rows that lack an image or barcode details."""
        try:
            async with AsyncSessionLocal() as session:
                stmt = (
                    select(Product)
                    .where(
                        and_(
                            Product.barcode.isnot(None),
                            func.length(func.trim(Product.barcode)) >= 5,
                            or_(
                                Product.image_url == None,
                                Product.image_url == "",
                                Product.image_url.like("/static/%"),
                                Product.image_url.like("%default%"),
                            )
                        )
                    )
                    .order_by(Product.created_at.desc()) # Newest uploaded user products FIRST
                    .limit(6)
                )
                res = await session.execute(stmt)
                products = res.scalars().all()
                if not products:
                    return []
                return [(p.id, p.barcode.strip(), p.name) for p in products]
        except Exception as e:
            logger.warning("[RAG Enricher] Could not fetch pending inventory batch: %s", e)
            return []

    @classmethod
    async def _fetch_pending_master_batch(cls) -> list:
        """Fetch MasterCatalogProduct rows that are pending RAG enrichment."""
        try:
            async with AsyncSessionLocal() as session:
                stmt = (
                    select(MasterCatalogProduct)
                    .where(
                        and_(
                            MasterCatalogProduct.ai_search_done == False,
                            MasterCatalogProduct.barcode.isnot(None),
                            func.length(func.trim(MasterCatalogProduct.barcode)) >= 8,
                            or_(
                                MasterCatalogProduct.rag_status == None,
                                MasterCatalogProduct.rag_status == "pending",
                            ),
                        )
                    )
                    .order_by(MasterCatalogProduct.created_at.asc())
                    .limit(6)
                )
                res = await session.execute(stmt)
                products = res.scalars().all()
                if not products:
                    return []
                batch = []
                for p in products:
                    p.rag_status = "processing"
                    batch.append((p.id, p.barcode.strip(), p.name))
                await session.commit()
                return batch
        except Exception as e:
            logger.warning("[RAG Enricher] Could not fetch pending master batch: %s", e)
            return []


    @classmethod
    async def _enrich_single_product(

        cls, product_id, barcode: str, name: str, target_type: str, semaphore: asyncio.Semaphore
    ):
        """
        Fully async enrichment of one product.
        target_type: 'inventory' (user's local Product) or 'master_catalog' (global MasterCatalogProduct).
        All HTTP (AI search + image search) is awaited. Never blocks the event loop.
        """
        async with semaphore:
            logger.info("[RAG Enricher - %s] Enriching '%s' (barcode: %s)...", target_type.upper(), name, barcode)

            # 1. AI RAG search (already async in master_catalog)
            success = False
            err_msg = None
            ai_item = None
            try:
                from src.api.v1.inventory.master_catalog import _perform_ai_rag_web_search
                provider = settings.ai_provider or "gemini"
                results = await _perform_ai_rag_web_search(barcode, provider=provider)
                if results:
                    ai_item = results[0]
                    success = True
                else:
                    err_msg = "AI returned no results."
            except Exception as ex:
                err_msg = str(ex)
                logger.warning("[RAG Enricher] AI search failed for '%s' (%s): %s", name, barcode, ex)

            # 2. Image sourcing: AI result URL first, then Google/DDG/Bing async waterfall
            cached_image_url = ""
            if success and ai_item:
                raw_img = (ai_item.image_url or "").strip()
                _BAD = ("/static/", "/images/default", "N/A", "n/a", "/uploads/")
                if any(raw_img.startswith(p) for p in _BAD):
                    raw_img = ""

                if raw_img.startswith("http"):
                    cached_image_url = await _cache_image_async(raw_img, barcode)

                # Fallback: async Google -> DDG -> Bing image search
                if not cached_image_url:
                    cached_image_url = await _google_search_images_async(
                        barcode, ai_item.name or name
                    )
            else:
                # AI search failed — still try to get an image using the product name alone.
                # This means even failed products get a photo populated silently.
                logger.debug("[RAG Enricher] AI failed for %s — trying image-only search with name '%s'", barcode, name)
                cached_image_url = await _google_search_images_async(barcode, name)
                if cached_image_url:
                    logger.info("[RAG Enricher] Image-only fallback found image for '%s' (%s): %s", name, barcode, cached_image_url)

            # 3. Persist results to DB (isolated session)
            await cls._write_enrichment_result(
                product_id=product_id,
                barcode=barcode,
                name=name,
                target_type=target_type,
                success=success,
                err_msg=err_msg,
                ai_item=ai_item,
                cached_image_url=cached_image_url,
            )


    @classmethod
    async def _write_enrichment_result(
        cls,
        product_id,
        barcode: str,
        name: str,
        target_type: str,
        success: bool,
        err_msg: Optional[str],
        ai_item,
        cached_image_url: str,
    ):
        """Write enrichment result directly to Product or MasterCatalogProduct. Uses isolated DB session."""
        try:
            async with AsyncSessionLocal() as session:
                if target_type == "inventory":
                    res = await session.execute(
                        select(Product).where(Product.id == product_id)
                    )
                    local_prod = res.scalars().first()
                    if local_prod:
                        if cached_image_url:
                            local_prod.image_url = cached_image_url
                        if success and ai_item:
                            if ai_item.mrp and (not local_prod.mrp or local_prod.mrp == 0):
                                local_prod.mrp = ai_item.mrp
                            if ai_item.sale_price and (not local_prod.selling_price or local_prod.selling_price == 0):
                                local_prod.selling_price = ai_item.sale_price
                            if ai_item.short_description and not local_prod.short_description:
                                local_prod.short_description = ai_item.short_description
                        await session.commit()
                        logger.info("[RAG Enricher - Inventory Worker] Enriched local product '%s' (%s) | image=%s", name, barcode, cached_image_url or "none")
                    return

                # Default: master_catalog target_type
                res = await session.execute(
                    select(MasterCatalogProduct).where(MasterCatalogProduct.id == product_id)
                )
                db_prod = res.scalars().first()
                if not db_prod:
                    return

                if success and ai_item:
                    if ai_item.name and len(ai_item.name) > len(db_prod.name or ""):
                        db_prod.name = ai_item.name
                    if ai_item.brand:
                        db_prod.brand = ai_item.brand
                    if ai_item.category:
                        db_prod.category = ai_item.category
                    if ai_item.sub_category:
                        db_prod.sub_category = ai_item.sub_category
                    if ai_item.weight:
                        db_prod.weight = ai_item.weight
                    if ai_item.mrp and ai_item.mrp > 0:
                        db_prod.mrp = ai_item.mrp
                    if ai_item.cost_price and ai_item.cost_price > 0:
                        db_prod.cost_price = ai_item.cost_price
                    if ai_item.sale_price and ai_item.sale_price > 0:
                        db_prod.sale_price = ai_item.sale_price
                    if ai_item.hsn_code:
                        db_prod.hsn_code = ai_item.hsn_code
                    if ai_item.short_description:
                        db_prod.short_description = ai_item.short_description
                    if ai_item.specifications:
                        db_prod.specifications = ai_item.specifications
                    if cached_image_url:
                        db_prod.image_url = cached_image_url

                    db_prod.ai_search_done = True
                    db_prod.rag_status = "completed"
                    db_prod.rag_error = None
                    db_prod.source = "AI_WEB_SEARCH"
                    db_prod.rag_enriched_at = datetime.utcnow()
                    logger.info(
                        "[RAG Enricher] Enriched '%s' (%s) | image=%s",
                        db_prod.name, barcode, cached_image_url or "none",
                    )

                    # Sync to local Product rows with same barcode
                    await cls._sync_to_local_products(session, barcode, ai_item, cached_image_url)
                else:
                    db_prod.rag_status = "failed"
                    db_prod.rag_error = err_msg
                    db_prod.ai_search_done = False
                    logger.warning("[RAG Enricher] Failed '%s' (%s): %s", name, barcode, err_msg)
                    if cached_image_url:
                        db_prod.image_url = cached_image_url
                        await cls._sync_to_local_products(session, barcode, None, cached_image_url)

                await session.commit()



        except asyncio.CancelledError:
            raise
        except SQLAlchemyError as e:
            logger.error("[RAG Enricher] DB error for %s: %s", barcode, e)
        except Exception as e:
            logger.error("[RAG Enricher] Error writing result for %s: %s", barcode, e, exc_info=True)

    @classmethod
    async def _sync_to_local_products(
        cls, session, barcode: str, ai_item, cached_image_url: str
    ):
        """
        Silently fill in missing fields on all local Product rows matching this barcode.
        Non-destructive: never overwrites data the user already provided.
        """
        try:
            local_res = await session.execute(
                select(Product).where(
                    Product.barcode == barcode,
                    Product.barcode.isnot(None),
                )
            )
            local_products = local_res.scalars().all()

            for lp in local_products:
                updated = []

                if not lp.image_url and cached_image_url:
                    lp.image_url = cached_image_url
                    updated.append("image_url")

                if not lp.short_description and ai_item.short_description:
                    lp.short_description = ai_item.short_description
                    updated.append("desc")

                if (not lp.mrp or lp.mrp == 0) and ai_item.mrp and ai_item.mrp > 0:
                    lp.mrp = ai_item.mrp
                    updated.append("mrp")
                if (not lp.selling_price or lp.selling_price == 0) and ai_item.sale_price and ai_item.sale_price > 0:
                    lp.selling_price = ai_item.sale_price
                    updated.append("sell_price")
                if (not lp.purchase_price or lp.purchase_price == 0) and ai_item.cost_price and ai_item.cost_price > 0:
                    lp.purchase_price = ai_item.cost_price
                    updated.append("cost_price")

                # Brand — link only if not set
                if not lp.brand_id and ai_item.brand:
                    brand_name = ai_item.brand.strip()
                    b_res = await session.execute(
                        select(Brand).where(
                            Brand.tenant_id == lp.tenant_id,
                            Brand.name.ilike(brand_name),
                        )
                    )
                    existing_brand = b_res.scalars().first()
                    if existing_brand:
                        lp.brand_id = existing_brand.id
                    else:
                        new_brand = Brand(
                            id=uuid.uuid4(),
                            tenant_id=lp.tenant_id,
                            name=brand_name,
                            status=EntityStatus.ACTIVE,
                        )
                        session.add(new_brand)
                        await session.flush()
                        lp.brand_id = new_brand.id
                    updated.append("brand")

                # Category — link only if not set
                if not lp.category_id and ai_item.category:
                    cat_name = ai_item.category.strip()
                    c_res = await session.execute(
                        select(ProductCategory).where(
                            ProductCategory.tenant_id == lp.tenant_id,
                            ProductCategory.name.ilike(cat_name),
                        )
                    )
                    existing_cat = c_res.scalars().first()
                    if existing_cat:
                        lp.category_id = existing_cat.id
                    else:
                        try:
                            code = "CAT-" + "".join(
                                random.choices(string.ascii_uppercase + string.digits, k=8)
                            )
                            new_cat = ProductCategory(
                                id=uuid.uuid4(),
                                tenant_id=lp.tenant_id,
                                name=cat_name,
                                category_code=code,
                                status=EntityStatus.ACTIVE,
                            )
                            session.add(new_cat)
                            await session.flush()
                            lp.category_id = new_cat.id
                        except Exception:
                            await session.rollback()
                            c2 = await session.execute(
                                select(ProductCategory).where(
                                    ProductCategory.tenant_id == lp.tenant_id,
                                    ProductCategory.name.ilike(cat_name),
                                )
                            )
                            ec = c2.scalars().first()
                            if ec:
                                lp.category_id = ec.id
                    updated.append("category")

                if updated:
                    logger.info(
                        "[RAG Enricher] Synced '%s' (%s): %s",
                        lp.name, barcode, ", ".join(updated),
                    )

        except Exception as e:
            logger.warning("[RAG Enricher] Sync to local products failed for %s: %s", barcode, e)
