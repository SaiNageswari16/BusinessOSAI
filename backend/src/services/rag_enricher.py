import asyncio
import logging
from datetime import datetime
from sqlalchemy import select, or_, and_, func
from src.database.session import AsyncSessionLocal
from src.models.inventory import MasterCatalogProduct
from src.api.v1.inventory.master_catalog import _perform_ai_rag_web_search, _download_and_cache_product_image
from src.config import get_settings

logger = logging.getLogger("rag_enricher")
settings = get_settings()

class RAGEnricherService:
    _instance_task = None
    _should_run = False

    @classmethod
    async def start(cls):
        """Starts the background worker task if not already running."""
        if cls._instance_task is not None:
            logger.info("RAG Background Enricher is already active.")
            return

        cls._should_run = True
        cls._instance_task = asyncio.create_task(cls._run_loop())
        logger.info("RAG Background Enricher worker started successfully.")

    @classmethod
    async def stop(cls):
        """Stops the background worker task cleanly."""
        if cls._instance_task is None:
            return

        logger.info("Stopping RAG Background Enricher worker...")
        cls._should_run = False
        try:
            await asyncio.wait_for(cls._instance_task, timeout=10.0)
        except asyncio.TimeoutError:
            logger.warning("RAG Background worker did not terminate cleanly, cancelling task.")
            cls._instance_task.cancel()
        cls._instance_task = None
        logger.info("RAG Background Enricher worker stopped.")

    @classmethod
    async def _run_loop(cls):
        """Infinite loop processing multiple pending barcodes concurrently."""
        import os
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        pause_file = os.path.join(backend_dir, ".rag_enricher_paused")
        
        # Concurrency control - max 4 parallel web retrievals
        semaphore = asyncio.Semaphore(4)
        
        while cls._should_run:
            try:
                # 1. Pause Check
                if os.path.exists(pause_file):
                    logger.info("[RAG Enricher] Pipeline is paused via control panel. Standing by...")
                    await asyncio.sleep(8.0)
                    continue

                # 2. Fetch a batch of pending products
                async with AsyncSessionLocal() as session:
                    stmt = select(MasterCatalogProduct).where(
                        and_(
                            MasterCatalogProduct.ai_search_done == False,
                            MasterCatalogProduct.barcode != None,
                            func.length(func.trim(MasterCatalogProduct.barcode)) >= 8,
                            or_(
                                MasterCatalogProduct.rag_status == None,
                                MasterCatalogProduct.rag_status.notin_(["processing", "failed"])
                            )
                        )
                    ).order_by(MasterCatalogProduct.created_at.asc()).limit(8)
                    
                    res = await session.execute(stmt)
                    products = res.scalars().all()
                    
                    if not products:
                        # No pending products found, sleep and try again
                        await asyncio.sleep(8.0)
                        continue
                    
                    product_data = []
                    for product in products:
                        # Mark as processing immediately to prevent duplicate grabs
                        product.rag_status = "processing"
                        product_data.append((product.id, product.barcode.strip(), product.name))
                    
                    await session.commit()
                
                # 3. Process the batch concurrently
                logger.info(f"[RAG Enricher] Processing batch of {len(product_data)} pending products in parallel...")
                tasks = [
                    cls._enrich_single_product(pid, barcode, name, semaphore)
                    for pid, barcode, name in product_data
                ]
                await asyncio.gather(*tasks)

            except Exception as e:
                logger.error(f"[RAG Enricher] Error in background worker loop: {e}")
                await asyncio.sleep(10.0)

            # Rest a bit between batches
            await asyncio.sleep(2.0)

    @classmethod
    async def _enrich_single_product(cls, product_id, barcode, name, semaphore):
        """Enriches a single product with web-sourced specifications under semaphore lock."""
        async with semaphore:
            logger.info(f"[RAG Enricher] Sourcing details for barcode '{barcode}' ({name})...")
            success = False
            err_msg = None
            ai_item = None
            
            try:
                provider = settings.ai_provider or "claude"
                results = await _perform_ai_rag_web_search(barcode, provider=provider)
                if results:
                    ai_item = results[0]
                    success = True
                else:
                    err_msg = "AI returned no matching search results."
            except Exception as ex:
                err_msg = str(ex)
                logger.error(f"[RAG Enricher] AI RAG search failed for '{name}' ({barcode}): {ex}")

            # Update the product record in database
            try:
                async with AsyncSessionLocal() as session:
                    stmt = select(MasterCatalogProduct).where(MasterCatalogProduct.id == product_id)
                    res = await session.execute(stmt)
                    db_prod = res.scalars().first()
                    
                    if db_prod:
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
                            
                            if ai_item.image_url:
                                try:
                                    db_prod.image_url = _download_and_cache_product_image(ai_item.image_url, barcode)
                                except Exception as img_ex:
                                    logger.warning(f"Failed to cache image for {barcode}: {img_ex}")
                                    db_prod.image_url = ai_item.image_url
                            
                            db_prod.ai_search_done = True
                            db_prod.rag_status = "completed"
                            db_prod.rag_error = None
                            db_prod.source = "AI_WEB_SEARCH"
                            db_prod.rag_enriched_at = datetime.utcnow()
                            logger.info(f"[RAG Enricher] Successfully enriched '{db_prod.name}' (Barcode: {barcode})!")
                        else:
                            db_prod.rag_status = "failed"
                            db_prod.rag_error = err_msg
                            db_prod.ai_search_done = False
                            logger.warning(f"[RAG Enricher] Enrichment failed for '{db_prod.name}' (Barcode: {barcode}): {err_msg}")
                        
                        await session.commit()
            except Exception as db_ex:
                logger.error(f"[RAG Enricher] Database update failed for '{name}' ({barcode}):", exc_info=True)
