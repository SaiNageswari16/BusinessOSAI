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
    from src.utils.ai_image_control import is_ai_image_search_paused
    if is_ai_image_search_paused():
        return ""

    clean_name = (product_name or "").strip()
    _DUMMY_NAMES = ("test", "demo", "sample", "xyz", "asdf", "p1", "p2", "temp", "dummy", "item", "product", "new product", "null", "undefined")
    if not clean_name or clean_name.lower() in _DUMMY_NAMES or clean_name.lower().startswith("unnamed") or len(clean_name) < 4:
        if not barcode or len(barcode) < 8:
            return ""
        safe_query = f'"{barcode}" FMCG packaged grocery retail product pack -clothing -lingerie -model -person -human'
    else:
        safe_query = f'"{clean_name}" retail packaged grocery product photo pack -clothing -dress -shirt -shoes -lingerie -model -person -human'

    # Step 1: Google Web Search -> collect result page URLs (safe=active strictly enforced)
    result_urls: list = []
    try:
        resp = await client.get(
            "https://www.google.com/search",
            params={"q": safe_query, "num": 8, "hl": "en", "safe": "active"},
        )
        if resp.status_code == 200:
            raw_links = re.findall(r'/url\?q=(https?://[^&"]+)', resp.text)
            _SKIP = ("google.com", "google.co.", "youtube.com", "facebook.com",
                     "twitter.com", "instagram.com", "linkedin.com", "pinterest.com",
                     "accounts.google", "support.google", "reddit.com", "tiktok.com")
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
                if img_url.startswith("http") and not any(bad in img_url.lower() for bad in ["logo", "icon", "avatar", "profile", "banner"]):
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
                if img_url.startswith("http") and not any(bad in img_url.lower() for bad in ["logo", "icon", "avatar", "profile", "banner"]):
                    cached = await _cache_image_async(img_url, barcode)
                    if cached:
                        logger.info("[ImageSearch] Google twitter:image for barcode %s", barcode)
                        return cached
        except Exception as e:
            logger.debug("[ImageSearch] Page fetch error for %s: %s", url, e)

    # Step 3: DuckDuckGo Images API with Strict SafeSearch (kp=1)
    try:
        token_resp = await client.get(
            "https://duckduckgo.com/",
            params={"q": safe_query, "kp": "1"},
        )
        vqd_match = re.search(r'vqd=["\']([\w-]+)["\']', token_resp.text)
        if vqd_match:
            vqd = vqd_match.group(1)
            img_resp = await client.get(
                "https://duckduckgo.com/i.js",
                params={"q": safe_query, "vqd": vqd, "f": ",,,", "p": "1", "kp": "1"},
                headers={**_HEADERS, "Referer": "https://duckduckgo.com/"},
            )
            if img_resp.status_code == 200:
                results = img_resp.json().get("results") or []
                for r in results[:5]:
                    img_url = r.get("image", "")
                    if img_url.startswith("http"):
                        cached = await _cache_image_async(img_url, barcode)
                        if cached:
                            logger.info("[ImageSearch] DuckDuckGo SafeSearch image for barcode %s", barcode)
                            return cached
    except Exception as e:
        logger.debug("[ImageSearch] DuckDuckGo failed for %s: %s", barcode, e)

    # Step 4: Bing Images scraping with Strict SafeSearch (adlt=strict)
    try:
        bing = await client.get(
            "https://www.bing.com/images/search",
            params={"q": safe_query, "first": 1, "adlt": "strict"},
        )
        if bing.status_code == 200:
            murls = re.findall(r'murl&quot;:&quot;(https?://[^&]+?)&quot;', bing.text)
            if not murls:
                murls = re.findall(r'"murl":"(https?://[^"]+?)"', bing.text)
            for murl in murls[:6]:
                if any(ext in murl.lower() for ext in [".jpg", ".jpeg", ".png", ".webp"]):
                    cached = await _cache_image_async(murl, barcode)
                    if cached:
                        logger.info("[ImageSearch] Bing SafeSearch image for barcode %s", barcode)
                        return cached
    except Exception as e:
        logger.debug("[ImageSearch] Bing failed for %s: %s", barcode, e)

    logger.debug("[ImageSearch] No safe image found for barcode %s", barcode)
    return ""


async def _cache_image_async(image_url: str, barcode: str) -> str:
    """
    Validate and cache an image asynchronously.
    The blocking Pillow verification runs in a thread pool so it never blocks.
    Returns the local /images/<filename> path on success, or "".
    """
    from src.utils.ai_image_control import is_ai_image_search_paused
    if is_ai_image_search_paused():
        return ""

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
_ENRICHMENT_CACHE: dict[str, dict] = {}
_CACHE_TTL_SECONDS = 86400  # 24 Hours

class RAGEnricherService:
    """
    Optimized Event-Driven RAG Enricher Service
    - 24-hour deduplication cache to eliminate duplicate API requests.
    - Zero infinite loop spam: disabled master catalog loop, on-demand priority.
    - Fast 5-10s authentic metadata lookup with async background image caching.
    """
    _should_run: bool = False
    _inv_task: Optional[asyncio.Task] = None
    _master_task: Optional[asyncio.Task] = None

    @classmethod
    async def start(cls):
        """Starts background service in eco-friendly event-driven mode."""
        if cls._inv_task is not None and not cls._inv_task.done():
            logger.info("RAG Background Enricher is already active.")
            return
        cls._should_run = True
        cls._inv_task = asyncio.create_task(cls._inventory_worker_loop())
        logger.info("RAG Enricher started in optimized On-Demand / Low-Frequency mode.")

    @classmethod
    async def stop(cls):
        """Stops workers gracefully."""
        global _http_client
        cls._should_run = False
        if cls._inv_task is not None and not cls._inv_task.done():
            try:
                cls._inv_task.cancel()
                await cls._inv_task
            except (asyncio.CancelledError, Exception):
                pass
        cls._inv_task = None
        if _http_client and not _http_client.is_closed:
            await _http_client.aclose()
            _http_client = None
        logger.info("RAG Background Enricher stopped.")

    @classmethod
    async def enrich_product_on_demand(cls, product_id, barcode: str, name: str) -> dict | None:
        """
        On-demand real-time enrichment triggered when a product is scanned or added.
        Uses 24-hr cache deduplication and fast 5-10s Gemini AI / Web metadata.
        """
        clean_code = (barcode or "").strip()
        now = datetime.utcnow().timestamp()

        # 1. Check 24-Hour Cache
        if clean_code and clean_code in _ENRICHMENT_CACHE:
            cached_entry = _ENRICHMENT_CACHE[clean_code]
            if now - cached_entry.get("timestamp", 0) < _CACHE_TTL_SECONDS:
                logger.info("[RAG Enricher] Returning 24-hour cached details for barcode %s (0 API calls)", clean_code)
                return cached_entry.get("data")

        # 2. Perform Single High-Fidelity Lookup
        semaphore = asyncio.Semaphore(1)
        res = await cls._enrich_single_product(product_id, clean_code, name, "inventory", semaphore)

        # 3. Cache result
        if clean_code and res:
            _ENRICHMENT_CACHE[clean_code] = {"timestamp": now, "data": res}
        return res

    @classmethod
    async def _inventory_worker_loop(cls):
        """
        Low-frequency fallback worker for user inventory items. Runs every 60s to prevent API waste.
        Always gathers text metadata, descriptions & specifications.
        """
        semaphore = asyncio.Semaphore(2)

        while cls._should_run:
            try:
                batch = await cls._fetch_pending_inventory_batch()
                if not batch:
                    await asyncio.sleep(60.0)  # Check only once per minute
                    continue

                logger.info("[RAG Enricher] Processing %d pending items with rate-limit pacing...", len(batch))
                for pid, barcode, name in batch:
                    if not cls._should_run:
                        break
                    try:
                        await cls._enrich_single_product(pid, barcode, name, "inventory", semaphore)
                    except Exception as p_err:
                        logger.debug("[RAG Enricher] Item enrichment error: %s", p_err)
                    await asyncio.sleep(3.5)  # 3.5s delay guarantees < 15 requests/min (under Gemini free-tier limits)

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
        Runs concurrently in parallel to populate product descriptions, specifications, brands, and categories.
        """
        semaphore = asyncio.Semaphore(3)

        while cls._should_run:
            try:
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
                                Product.short_description == None,
                                Product.short_description == "",
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
            logger.info("[RAG Enricher - %s] Enriching metadata for '%s' (barcode: %s)...", target_type.upper(), name, barcode)

            # 1. AI RAG search for text metadata (short/long descriptions, brand, category, specs, prices, HSN)
            success = False
            err_msg = None
            ai_item = None
            from src.api.v1.inventory.master_catalog import _perform_ai_rag_web_search
            provider = settings.ai_provider or "gemini"
            results = []

            # Step 1A: Try barcode resolution first
            if barcode and len(barcode.strip()) >= 5:
                try:
                    results = await _perform_ai_rag_web_search(barcode.strip(), provider=provider)
                except Exception as b_ex:
                    logger.debug("[RAG Enricher] Barcode %s not found in public registry (%s)", barcode, b_ex)

            # Step 1B: Fallback to product name if barcode returned nothing (e.g. internal store SKU/barcodes)
            if not results and name and name.strip() and name.strip() != barcode:
                try:
                    logger.info("[RAG Enricher] Resolving metadata by product name '%s'...", name.strip())
                    results = await _perform_ai_rag_web_search(name.strip(), provider=provider)
                except Exception as n_ex:
                    logger.warning("[RAG Enricher] Name search failed for '%s': %s", name, n_ex)
                    err_msg = str(n_ex)

            if results:
                ai_item = results[0]
                success = True
            elif not err_msg:
                err_msg = f"No product match found for {name or barcode}"

            # 2. Image sourcing: ONLY executed when AI image search is ACTIVE (not paused)
            cached_image_url = ""
            from src.utils.ai_image_control import is_ai_image_search_paused
            if not is_ai_image_search_paused():
                # Only look for product images if the product identity was authentically resolved
                if success and ai_item:
                    raw_img = (ai_item.image_url or "").strip()
                    _BAD = ("/static/", "/images/default", "N/A", "n/a", "/uploads/")
                    if any(raw_img.startswith(p) for p in _BAD):
                        raw_img = ""

                    if raw_img.startswith("http"):
                        cached_image_url = await _cache_image_async(raw_img, barcode)

                    # Safe fallback: search Google/DDG ONLY when we have an authoritative resolved product name
                    resolved_name = (ai_item.name or "").strip()
                    if not cached_image_url and resolved_name and len(resolved_name) > 3 and not resolved_name.lower().startswith("unnamed"):
                        cached_image_url = await _google_search_images_async(
                            barcode, resolved_name
                        )
                else:
                    # When product identity is unconfirmed (e.g. internal / non-standard barcodes),
                    # do NOT scrape arbitrary web images to avoid pulling irrelevant/corrupt images from unrelated stores.
                    cached_image_url = ""
            else:
                logger.info("[RAG Enricher] AI Image Search is PAUSED — skipping image scraping for '%s' (%s). Text details enriched.", name, barcode)

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
            # Gentle pacing to respect AI provider limits
            await asyncio.sleep(2.0)


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
                            is_generic_name = (
                                not local_prod.name or
                                local_prod.name.strip().lower() in ("unnamed product", "unnamed", "none", "null", "product") or
                                local_prod.name.strip() == (local_prod.barcode or "").strip() or
                                local_prod.name.strip() == (local_prod.sku or "").strip() or
                                local_prod.name.startswith("SKU-")
                            )
                            if is_generic_name and ai_item.name and ai_item.name.strip():
                                local_prod.name = ai_item.name.strip()

                            if ai_item.mrp and (not local_prod.mrp or local_prod.mrp == 0):
                                local_prod.mrp = ai_item.mrp
                            if ai_item.sale_price and (not local_prod.selling_price or local_prod.selling_price == 0):
                                local_prod.selling_price = ai_item.sale_price
                            if ai_item.short_description and not local_prod.short_description:
                                local_prod.short_description = ai_item.short_description
                        local_prod.updated_at = datetime.utcnow()
                        await session.commit()
                        logger.info("[RAG Enricher - Inventory Worker] Enriched local product '%s' (%s) | image=%s", local_prod.name, barcode, cached_image_url or "none")
                    return

                # Default: master_catalog target_type
                res = await session.execute(
                    select(MasterCatalogProduct).where(MasterCatalogProduct.id == product_id)
                )
                db_prod = res.scalars().first()
                if not db_prod:
                    return

                if success and ai_item:
                    is_generic_db_name = (
                        not db_prod.name or
                        db_prod.name.strip().lower() in ("unnamed product", "unnamed", "none", "null", "product") or
                        db_prod.name.startswith("SKU-") or
                        len(ai_item.name or "") > len(db_prod.name or "")
                    )
                    if ai_item.name and is_generic_db_name:
                        db_prod.name = ai_item.name.strip()
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

                if ai_item and ai_item.name and ai_item.name.strip():
                    is_generic_name = (
                        not lp.name or
                        lp.name.strip().lower() in ("unnamed product", "unnamed", "none", "null", "product") or
                        lp.name.strip() == (lp.barcode or "").strip() or
                        lp.name.strip() == (lp.sku or "").strip() or
                        lp.name.startswith("SKU-")
                    )
                    if is_generic_name:
                        lp.name = ai_item.name.strip()
                        updated.append("name")

                if not lp.image_url and cached_image_url:
                    lp.image_url = cached_image_url
                    updated.append("image_url")

                if ai_item and not lp.short_description and ai_item.short_description:
                    lp.short_description = ai_item.short_description
                    updated.append("desc")

                if ai_item and (not lp.mrp or lp.mrp == 0) and ai_item.mrp and ai_item.mrp > 0:
                    lp.mrp = ai_item.mrp
                    updated.append("mrp")
                if ai_item and (not lp.selling_price or lp.selling_price == 0) and ai_item.sale_price and ai_item.sale_price > 0:
                    lp.selling_price = ai_item.sale_price
                    updated.append("sell_price")
                if ai_item and (not lp.purchase_price or lp.purchase_price == 0) and ai_item.cost_price and ai_item.cost_price > 0:
                    lp.purchase_price = ai_item.cost_price
                    updated.append("cost_price")


                # Brand — link only if an existing brand matches
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
                        updated.append("brand")

                # Category — link only if an existing category matches
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
                        updated.append("category")

                if updated:
                    logger.info(
                        "[RAG Enricher] Synced '%s' (%s): %s",
                        lp.name, barcode, ", ".join(updated),
                    )

        except Exception as e:
            logger.warning("[RAG Enricher] Sync to local products failed for %s: %s", barcode, e)
