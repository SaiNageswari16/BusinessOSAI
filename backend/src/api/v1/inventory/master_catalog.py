import json
import re
import uuid
import requests
import logging
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_any_permission, require_permission
from src.config import get_settings
from src.database.session import get_db
from src.models import EntityStatus
from src.models.inventory import ProductCategory, Brand, UnitOfMeasure, Product, MasterCatalogProduct
from src.schemas.inventory import (
    MasterCatalogItem,
    MasterCatalogImportRequest,
    MasterCatalogSaveToLocalRequest,
    ProductResponse
)

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/inventory/master-catalog", tags=["Inventory - Master Data Catalog"])


def _extract_json_from_text(text: str) -> dict | list:
    """Helper to extract JSON object or array from markdown codeblocks or raw text."""
    try:
        return json.loads(text)
    except Exception:
        pass
    
    # Try finding JSON block in ```json ... ```
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except Exception:
            pass
            
    # Try finding object { ... } or array [ ... ]
    match_obj = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", text)
    if match_obj:
        try:
            return json.loads(match_obj.group(1).strip())
        except Exception:
            pass
            
    raise ValueError(f"Could not parse valid JSON from AI response text: {text[:200]}")


async def _perform_ai_rag_web_search(query_str: str, provider: str = "gemini") -> List[MasterCatalogItem]:
    """Uses Gemini 2.5 Google Search Grounding or OpenAI to fetch live real-time product details from the web."""
    ai_results: List[MasterCatalogItem] = []
    
    if provider == "gemini" and settings.gemini_api_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.gemini_api_key}"
            prompt = (
                f"You are an expert product sourcing assistant. Perform a deep, thorough live Google search for the product query or barcode: '{query_str}'.\n"
                "You MUST search across reliable online retail and e-commerce sources (such as Amazon, BigBasket, Blinkit, JioMart, Nykaa, or direct manufacturer listings) to extract the actual real-time product name, brand, MRP, online sale prices, weight, specifications, and brand.\n"
                "CRITICAL: The 'name' and 'brand' fields must NEVER be generic placeholders (like 'Generic Product', 'Product Query', or 'Unknown Brand'). You MUST extract the actual official product title (e.g. 'Lakmé Peach Milk 2% Pro-Ceramide Gel Moisturiser') and the actual brand (e.g. 'Lakmé') from the search grounding results. If you cannot identify the product name and brand, do not generate a fake object.\n"
                "For any numeric/operational fields you cannot find directly on the internet (such as cost_price, tax, hsn_code, or specifications), you may use standard defaults (e.g. cost_price can be estimated at 70% of the actual found MRP, tax can be 18.0, sub_category can be 'General') rather than leaving them out or failing! Always prioritize actual found retail prices over generic estimates for mrp and sale_price.\n"
                "Return your findings as a JSON ARRAY of 1 to 3 matching product objects with this EXACT structure for each item:\n"
                "[\n"
                "  {\n"
                '    "name": "Full official product title",\n'
                '    "brand": "Brand Name",\n'
                '    "barcode": "EAN / UPC / GTIN barcode if available, or null",\n'
                '    "sku_code": "SKU code if available, or null",\n'
                '    "product_code": "Product code if available, or null",\n'
                '    "hsn_code": "Standard HSN / SAC code if applicable",\n'
                '    "plu_no": "PLU No if applicable, or null",\n'
                '    "cost_price": 0.00,\n'
                '    "mrp": 0.00,\n'
                '    "sale_price": 0.00,\n'
                '    "wholesale_price": 0.00,\n'
                '    "special_price": 0.00,\n'
                '    "online_price": 0.00,\n'
                '    "weight": "e.g. 10g or 1kg or null",\n'
                '    "quantity": 1.0,\n'
                '    "expired_quantity": 0.0,\n'
                '    "near_expiry_quantity": 0.0,\n'
                '    "tax": 0.0,\n'
                '    "type": "e.g. CGST + SGST or null",\n'
                '    "cess": 0.0,\n'
                '    "cess_on": 0.0,\n'
                '    "cess_type": null,\n'
                '    "tax_amount": 0.0,\n'
                '    "taxable_value": 0.0,\n'
                '    "cess_tax_amount": 0.0,\n'
                '    "additional_cess_tax_amount": 0.0,\n'
                '    "supplier": null,\n'
                '    "discount_rs": 0.0,\n'
                '    "discount_percent": 0.0,\n'
                '    "actual_margin_rs": 0.0,\n'
                '    "margin_on_cp": 0.0,\n'
                '    "margin_on_sp": 0.0,\n'
                '    "category": "Product Category (e.g. Snacks, Electronics, Oral Care)",\n'
                '    "sub_category": "Sub Category",\n'
                '    "instock_value": 0.0,\n'
                '    "image_url": "Direct image URL if found or placeholder",\n'
                '    "short_description": "2-3 sentence overview of features",\n'
                '    "specifications": "Key specs (e.g. Capacity, Dimensions, Weight, Power)"\n'
                "  }\n"
                "]\n"
                "Respond strictly with the valid JSON ARRAY, with no markdown conversation around it."
            )
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "tools": [{"googleSearch": {}}]
            }
            res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=60)
            if res.status_code == 429:
                error_msg = "Gemini API daily/rate limit exceeded (429 Quota Exhausted). Please configure a paid Gemini key."
                try:
                    error_msg = res.json()["error"]["message"]
                except:
                    pass
                raise HTTPException(status_code=429, detail=f"Gemini API Error: {error_msg}")
            
            if res.status_code != 200:
                raise HTTPException(
                    status_code=res.status_code,
                    detail=f"Gemini API returned error status {res.status_code}: {res.text[:500]}"
                )
                
            data = res.json()
            candidates = data.get("candidates", [])
            if not candidates:
                prompt_feedback = data.get("promptFeedback", {})
                block_reason = prompt_feedback.get("blockReason")
                if block_reason:
                    raise HTTPException(status_code=400, detail=f"Gemini API query blocked. Reason: {block_reason}")
                raise HTTPException(status_code=502, detail="Gemini API returned an empty candidates list.")
            
            candidate = candidates[0]
            content = candidate.get("content", {})
            parts = content.get("parts", [])
            
            finish_reason = candidate.get("finishReason")
            if finish_reason and finish_reason not in ["STOP", "MAX_TOKENS"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Gemini API failed to generate response. Finish reason: {finish_reason}"
                )
                
            if not parts:
                raise HTTPException(
                    status_code=502,
                    detail="Gemini API search grounding returned no content parts. The search queries did not yield structured product text."
                )
                
            raw_text = parts[0].get("text", "")
            parsed_data = _extract_json_from_text(raw_text)
            if isinstance(parsed_data, dict):
                parsed_data = [parsed_data]
                
            for item in parsed_data:
                ai_results.append(MasterCatalogItem(
                    name=item.get("name", query_str),
                    brand=item.get("brand"),
                    barcode=item.get("barcode"),
                    sku_code=item.get("sku_code"),
                    product_code=item.get("product_code"),
                    hsn_code=item.get("hsn_code"),
                    plu_no=item.get("plu_no"),
                    cost_price=float(item.get("cost_price") or 0.0),
                    mrp=float(item.get("mrp") or 0.0),
                    sale_price=float(item.get("sale_price") or 0.0),
                    wholesale_price=float(item.get("wholesale_price") or 0.0),
                    special_price=float(item.get("special_price") or 0.0),
                    online_price=float(item.get("online_price") or 0.0),
                    weight=item.get("weight"),
                    quantity=float(item.get("quantity") or 0.0),
                    expired_quantity=float(item.get("expired_quantity") or 0.0),
                    near_expiry_quantity=float(item.get("near_expiry_quantity") or 0.0),
                    tax=float(item.get("tax") or 0.0),
                    type=item.get("type"),
                    cess=float(item.get("cess") or 0.0),
                    cess_on=float(item.get("cess_on") or 0.0),
                    cess_type=item.get("cess_type"),
                    tax_amount=float(item.get("tax_amount") or 0.0),
                    taxable_value=float(item.get("taxable_value") or 0.0),
                    cess_tax_amount=float(item.get("cess_tax_amount") or 0.0),
                    additional_cess_tax_amount=float(item.get("additional_cess_tax_amount") or 0.0),
                    supplier=item.get("supplier"),
                    discount_rs=float(item.get("discount_rs") or 0.0),
                    discount_percent=float(item.get("discount_percent") or 0.0),
                    actual_margin_rs=float(item.get("actual_margin_rs") or 0.0),
                    margin_on_cp=float(item.get("margin_on_cp") or 0.0),
                    margin_on_sp=float(item.get("margin_on_sp") or 0.0),
                    category=item.get("category"),
                    sub_category=item.get("sub_category"),
                    instock_value=float(item.get("instock_value") or 0.0),
                    image_url=item.get("image_url"),
                    short_description=item.get("short_description"),
                    specifications=item.get("specifications"),
                    source="AI_WEB_SEARCH"
                ))
            return ai_results
        except HTTPException as he:
            raise he
        except Exception as e:
            logger.error(f"Gemini Web RAG search failed: {e}")
            raise HTTPException(status_code=502, detail=f"Gemini API connection error: {e}")

    # Fallback to OpenAI if configured or provider is openai
    if (provider == "openai" or not ai_results) and settings.openai_api_key:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Content-Type": "application/json", "Authorization": f"Bearer {settings.openai_api_key}"}
            prompt = (
                f"Find real product specs for query '{query_str}'. Return JSON ARRAY of product with keys: "
                "name, brand, barcode, sku_code, product_code, hsn_code, plu_no, cost_price, mrp, sale_price, "
                "wholesale_price, special_price, online_price, weight, quantity, expired_quantity, near_expiry_quantity, "
                "tax, type, cess, cess_on, cess_type, tax_amount, taxable_value, cess_tax_amount, additional_cess_tax_amount, "
                "supplier, discount_rs, discount_percent, actual_margin_rs, margin_on_cp, margin_on_sp, category, sub_category, instock_value."
            )
            body = {
                "model": settings.openai_model or "gpt-4o",
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"}
            }
            res = requests.post(url, json=body, headers=headers, timeout=60)
            if res.status_code == 429:
                raise HTTPException(status_code=429, detail="OpenAI API rate limit exceeded (429).")
            if res.status_code != 200:
                raise HTTPException(status_code=res.status_code, detail=f"OpenAI API returned error: {res.text[:500]}")
            
            text = res.json()["choices"][0]["message"]["content"]
            parsed_data = json.loads(text)
            if "products" in parsed_data:
                parsed_data = parsed_data["products"]
            elif not isinstance(parsed_data, list):
                parsed_data = [parsed_data]
                
            for item in parsed_data:
                ai_results.append(MasterCatalogItem(
                    name=item.get("name", query_str),
                    brand=item.get("brand"),
                    barcode=item.get("barcode"),
                    sku_code=item.get("sku_code"),
                    product_code=item.get("product_code"),
                    hsn_code=item.get("hsn_code"),
                    plu_no=item.get("plu_no"),
                    cost_price=float(item.get("cost_price") or 0.0),
                    mrp=float(item.get("mrp") or 0.0),
                    sale_price=float(item.get("sale_price") or 0.0),
                    wholesale_price=float(item.get("wholesale_price") or 0.0),
                    special_price=float(item.get("special_price") or 0.0),
                    online_price=float(item.get("online_price") or 0.0),
                    weight=item.get("weight"),
                    quantity=float(item.get("quantity") or 0.0),
                    expired_quantity=float(item.get("expired_quantity") or 0.0),
                    near_expiry_quantity=float(item.get("near_expiry_quantity") or 0.0),
                    tax=float(item.get("tax") or 0.0),
                    type=item.get("type"),
                    cess=float(item.get("cess") or 0.0),
                    cess_on=float(item.get("cess_on") or 0.0),
                    cess_type=item.get("cess_type"),
                    tax_amount=float(item.get("tax_amount") or 0.0),
                    taxable_value=float(item.get("taxable_value") or 0.0),
                    cess_tax_amount=float(item.get("cess_tax_amount") or 0.0),
                    additional_cess_tax_amount=float(item.get("additional_cess_tax_amount") or 0.0),
                    supplier=item.get("supplier"),
                    discount_rs=float(item.get("discount_rs") or 0.0),
                    discount_percent=float(item.get("discount_percent") or 0.0),
                    actual_margin_rs=float(item.get("actual_margin_rs") or 0.0),
                    margin_on_cp=float(item.get("margin_on_cp") or 0.0),
                    margin_on_sp=float(item.get("margin_on_sp") or 0.0),
                    category=item.get("category"),
                    sub_category=item.get("sub_category"),
                    instock_value=float(item.get("instock_value") or 0.0),
                    image_url=item.get("image_url"),
                    short_description=item.get("short_description"),
                    specifications=item.get("specifications"),
                    source="AI_WEB_SEARCH"
                ))
            return ai_results
        except HTTPException as he:
            raise he
        except Exception as e:
            logger.error(f"OpenAI Web RAG search failed: {e}")
            raise HTTPException(status_code=502, detail=f"OpenAI API connection error: {e}")

    # Final fallback: if query is a numeric barcode and no results were fetched, query Open Food Facts API!
    clean_query = query_str.strip()
    if not ai_results and clean_query.isdigit() and len(clean_query) >= 8:
        try:
            logger.info(f"AI search failed or exhausted. Trying Open Food Facts API lookup for barcode: {clean_query}")
            url = f"https://world.openfoodfacts.org/api/v2/product/{clean_query}.json"
            headers = {"User-Agent": "BusinessOSAI/1.0 (contact@businessosai.com)"}
            res = requests.get(url, headers=headers, timeout=10)
            if res.status_code == 200:
                data = res.json()
                if data.get("status") == 1:
                    p = data.get("product", {})
                    brand_name = p.get("brands", "").split(",")[0].strip() if p.get("brands") else None
                    category_name = p.get("categories", "").split(",")[0].strip() if p.get("categories") else "Groceries"
                    if category_name.startswith("en:"):
                        category_name = category_name[3:].replace("-", " ").title()
                    weight_str = p.get("quantity") or p.get("serving_size") or None
                    image_url = p.get("image_url") or p.get("image_front_url") or None
                    
                    ai_results.append(MasterCatalogItem(
                        name=p.get("product_name") or f"Product {clean_query}",
                        brand=brand_name,
                        barcode=clean_query,
                        sku_code=None,
                        product_code=None,
                        hsn_code="1905",
                        plu_no=None,
                        cost_price=0.0,
                        mrp=0.0,
                        sale_price=0.0,
                        wholesale_price=0.0,
                        special_price=0.0,
                        online_price=0.0,
                        weight=weight_str,
                        quantity=1.0,
                        expired_quantity=0.0,
                        near_expiry_quantity=0.0,
                        tax=18.0,
                        type="CGST + SGST",
                        cess=0.0,
                        cess_on=0.0,
                        cess_type=None,
                        tax_amount=0.0,
                        taxable_value=0.0,
                        cess_tax_amount=0.0,
                        additional_cess_tax_amount=0.0,
                        supplier=None,
                        discount_rs=0.0,
                        discount_percent=0.0,
                        actual_margin_rs=0.0,
                        margin_on_cp=0.0,
                        margin_on_sp=0.0,
                        category=category_name,
                        sub_category="General",
                        instock_value=0.0,
                        image_url=image_url,
                        short_description=p.get("generic_name") or f"Automatically imported from public barcode registry: {clean_query}",
                        specifications=f"Brands: {p.get('brands')}\nCategories: {p.get('categories')}",
                        source="AI_WEB_SEARCH"
                    ))
                else:
                    raise HTTPException(status_code=404, detail=f"Product with barcode {clean_query} not found in public barcode registry.")
            else:
                raise HTTPException(status_code=res.status_code, detail=f"Open Food Facts API error status {res.status_code}")
        except HTTPException as he:
            raise he
        except Exception as ex:
            logger.error(f"Open Food Facts fallback lookup failed: {ex}")
            raise HTTPException(status_code=502, detail=f"Barcode registry network resolution error: {ex}")

    # If no AI keys are configured and it's not a barcode query, throw the error that keys are missing
    if not settings.gemini_api_key and not settings.openai_api_key:
        raise HTTPException(
            status_code=400,
            detail="AI Sourcing API keys are not configured. Please check your .env settings."
        )

    return ai_results


@router.get("/search", response_model=List[MasterCatalogItem])
async def search_master_catalog(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    query: str = Query(..., min_length=1),
    search_web: bool = Query(False),
    provider: str = Query("gemini")
):
    """Searches Master Catalog DB first, and falls back or combines with AI Web RAG search."""
    results: List[MasterCatalogItem] = []
    
    # 1. Search local Master Catalog DB with split-word fuzzy search
    words = [w.strip() for w in query.strip().split() if w.strip()]
    if words:
        conditions = []
        for w in words:
            like = f"%{w}%"
            conditions.append(
                MasterCatalogProduct.name.ilike(like) |
                MasterCatalogProduct.barcode.ilike(like) |
                MasterCatalogProduct.brand.ilike(like) |
                MasterCatalogProduct.sku_code.ilike(like) |
                MasterCatalogProduct.product_code.ilike(like)
            )
        from sqlalchemy import and_
        db_query = select(MasterCatalogProduct).where(and_(*conditions)).limit(30)
    else:
        db_query = select(MasterCatalogProduct).limit(30)
    
    db_res = await db.execute(db_query)
    db_products = db_res.scalars().all()
    
    for p in db_products:
        results.append(MasterCatalogItem(
            id=p.id,
            name=p.name,
            brand=p.brand,
            barcode=p.barcode,
            sku_code=p.sku_code,
            product_code=p.product_code,
            hsn_code=p.hsn_code,
            plu_no=p.plu_no,
            cost_price=float(p.cost_price or 0.0),
            mrp=float(p.mrp or 0.0),
            sale_price=float(p.sale_price or 0.0),
            wholesale_price=float(p.wholesale_price or 0.0),
            special_price=float(p.special_price or 0.0),
            online_price=float(p.online_price or 0.0),
            weight=p.weight,
            quantity=float(p.quantity or 0.0),
            expired_quantity=float(p.expired_quantity or 0.0),
            near_expiry_quantity=float(p.near_expiry_quantity or 0.0),
            tax=float(p.tax or 0.0),
            type=p.type,
            cess=float(p.cess or 0.0),
            cess_on=float(p.cess_on or 0.0),
            cess_type=p.cess_type,
            tax_amount=float(p.tax_amount or 0.0),
            taxable_value=float(p.taxable_value or 0.0),
            cess_tax_amount=float(p.cess_tax_amount or 0.0),
            additional_cess_tax_amount=float(p.additional_cess_tax_amount or 0.0),
            supplier=p.supplier,
            discount_rs=float(p.discount_rs or 0.0),
            discount_percent=float(p.discount_percent or 0.0),
            actual_margin_rs=float(p.actual_margin_rs or 0.0),
            margin_on_cp=float(p.margin_on_cp or 0.0),
            margin_on_sp=float(p.margin_on_sp or 0.0),
            category=p.category,
            sub_category=p.sub_category,
            instock_value=float(p.instock_value or 0.0),
            image_url=p.image_url,
            short_description=p.short_description,
            specifications=p.specifications,
            source=p.source or "MASTER_DB"
        ))
        
    # 2. If no local DB results and search_web is requested, perform AI RAG Search
    if not results and search_web:
        ai_items = await _perform_ai_rag_web_search(query, provider=provider)
        results.extend(ai_items)
        
    return results


@router.post("/import-excel", status_code=status.HTTP_201_CREATED)
async def bulk_import_master_catalog(
    payload: MasterCatalogImportRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Bulk imports master products from Excel / CSV into erp_master_catalog table."""
    imported_count = 0
    tenant_id = ctx.tenant_id
    
    for item in payload.items:
        new_master_item = MasterCatalogProduct(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            name=item.name,
            brand=item.brand,
            barcode=item.barcode,
            sku_code=item.sku_code,
            product_code=item.product_code,
            hsn_code=item.hsn_code,
            plu_no=item.plu_no,
            cost_price=item.cost_price or 0.0,
            mrp=item.mrp or 0.0,
            sale_price=item.sale_price or 0.0,
            wholesale_price=item.wholesale_price or 0.0,
            special_price=item.special_price or 0.0,
            online_price=item.online_price or 0.0,
            weight=item.weight,
            quantity=item.quantity or 0.0,
            expired_quantity=item.expired_quantity or 0.0,
            near_expiry_quantity=item.near_expiry_quantity or 0.0,
            tax=item.tax or 0.0,
            type=item.type,
            cess=item.cess or 0.0,
            cess_on=item.cess_on or 0.0,
            cess_type=item.cess_type,
            tax_amount=item.tax_amount or 0.0,
            taxable_value=item.taxable_value or 0.0,
            cess_tax_amount=item.cess_tax_amount or 0.0,
            additional_cess_tax_amount=item.additional_cess_tax_amount or 0.0,
            supplier=item.supplier,
            discount_rs=item.discount_rs or 0.0,
            discount_percent=item.discount_percent or 0.0,
            actual_margin_rs=item.actual_margin_rs or 0.0,
            margin_on_cp=item.margin_on_cp or 0.0,
            margin_on_sp=item.margin_on_sp or 0.0,
            category=item.category,
            sub_category=item.sub_category,
            instock_value=item.instock_value or 0.0,
            image_url=item.image_url,
            short_description=item.short_description,
            specifications=item.specifications,
            source="EXCEL_IMPORT"
        )
        db.add(new_master_item)
        imported_count += 1
        
    await db.commit()
    return {"message": f"Successfully imported {imported_count} products into Master Catalog", "count": imported_count}


@router.post("/save", response_model=MasterCatalogItem, status_code=status.HTTP_201_CREATED)
async def save_to_master_catalog(
    payload: MasterCatalogItem,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Saves an AI-discovered product into the Master Data Catalog DB table."""
    new_item = MasterCatalogProduct(
        id=uuid.uuid4(),
        tenant_id=ctx.tenant_id,
        name=payload.name,
        brand=payload.brand,
        barcode=payload.barcode,
        sku_code=payload.sku_code,
        product_code=payload.product_code,
        hsn_code=payload.hsn_code,
        plu_no=payload.plu_no,
        cost_price=payload.cost_price or 0.0,
        mrp=payload.mrp or 0.0,
        sale_price=payload.sale_price or 0.0,
        wholesale_price=payload.wholesale_price or 0.0,
        special_price=payload.special_price or 0.0,
        online_price=payload.online_price or 0.0,
        weight=payload.weight,
        quantity=payload.quantity or 0.0,
        expired_quantity=payload.expired_quantity or 0.0,
        near_expiry_quantity=payload.near_expiry_quantity or 0.0,
        tax=payload.tax or 0.0,
        type=payload.type,
        cess=payload.cess or 0.0,
        cess_on=payload.cess_on or 0.0,
        cess_type=payload.cess_type,
        tax_amount=payload.tax_amount or 0.0,
        taxable_value=payload.taxable_value or 0.0,
        cess_tax_amount=payload.cess_tax_amount or 0.0,
        additional_cess_tax_amount=payload.additional_cess_tax_amount or 0.0,
        supplier=payload.supplier,
        discount_rs=payload.discount_rs or 0.0,
        discount_percent=payload.discount_percent or 0.0,
        actual_margin_rs=payload.actual_margin_rs or 0.0,
        margin_on_cp=payload.margin_on_cp or 0.0,
        margin_on_sp=payload.margin_on_sp or 0.0,
        category=payload.category,
        sub_category=payload.sub_category,
        instock_value=payload.instock_value or 0.0,
        image_url=payload.image_url,
        short_description=payload.short_description,
        specifications=payload.specifications,
        source="AI_SEARCH"
    )
    db.add(new_item)
    await db.commit()
    await db.refresh(new_item)
    
    payload.id = new_item.id
    payload.source = "MASTER_DB"
    return payload


@router.post("/import-to-local-inventory", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def import_to_local_inventory(
    payload: MasterCatalogSaveToLocalRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Instantly converts a Master Catalog or AI-searched item into a live operational local product (erp_products)."""
    tenant_id = ctx.tenant_id
    
    # 1. Sync / Find Brand
    brand_id = None
    if payload.brand_name and payload.brand_name.strip():
        b_name = payload.brand_name.strip()
        b_res = await db.execute(select(Brand).where(Brand.tenant_id == tenant_id, Brand.name.ilike(b_name)))
        existing_brand = b_res.scalars().first()
        if existing_brand:
            brand_id = existing_brand.id
        else:
            new_brand = Brand(id=uuid.uuid4(), tenant_id=tenant_id, name=b_name, status=EntityStatus.ACTIVE)
            db.add(new_brand)
            await db.flush()
            brand_id = new_brand.id
            
    # 2. Sync / Find Category
    category_id = None
    if payload.category_name and payload.category_name.strip():
        c_name = payload.category_name.strip()
        c_res = await db.execute(select(ProductCategory).where(ProductCategory.tenant_id == tenant_id, ProductCategory.name.ilike(c_name)))
        existing_cat = c_res.scalars().first()
        if existing_cat:
            category_id = existing_cat.id
        else:
            import string, random
            rand_code = f"CAT-{''.join(random.choices(string.ascii_uppercase + string.digits, k=6))}"
            new_cat = ProductCategory(id=uuid.uuid4(), tenant_id=tenant_id, name=c_name, category_code=rand_code, status=EntityStatus.ACTIVE)
            db.add(new_cat)
            await db.flush()
            category_id = new_cat.id

    # 3. Determine SKU
    sku = payload.sku
    if not sku:
        if payload.barcode:
            sku = f"SKU-{payload.barcode}"
        else:
            import string, random
            sku = f"SKU-{''.join(random.choices(string.ascii_uppercase + string.digits, k=8))}"
            
    # Check duplicate SKU in tenant
    sku_res = await db.execute(select(Product).where(Product.tenant_id == tenant_id, Product.sku == sku))
    if sku_res.scalars().first():
        import string, random
        sku = f"{sku}-{''.join(random.choices(string.ascii_uppercase, k=3))}"

    # 4. Create Product in erp_products
    new_product = Product(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        name=payload.name,
        sku=sku,
        barcode=payload.barcode,
        brand_id=brand_id,
        category_id=category_id,
        short_description=payload.short_description,
        image_url=payload.image_url,
        purchase_price=payload.purchase_price or 0.0,
        mrp=payload.mrp or 0.0,
        selling_price=payload.selling_price or payload.mrp or 0.0,
        tax_percent=payload.tax_percent or 0.0,
        initial_stock=payload.initial_stock or 0,
        supplier=payload.supplier,
        warehouse=payload.warehouse,
        status=EntityStatus.ACTIVE
    )
    db.add(new_product)
    
    # Cache in global master catalog if it has a barcode and doesn't exist yet
    if payload.barcode and payload.barcode.strip():
        clean_barcode = payload.barcode.strip()
        existing_mc_res = await db.execute(
            select(MasterCatalogProduct).where(MasterCatalogProduct.barcode == clean_barcode)
        )
        if not existing_mc_res.scalars().first():
            new_mc = MasterCatalogProduct(
                id=uuid.uuid4(),
                tenant_id=None,
                name=payload.name,
                brand=payload.brand_name.strip() if payload.brand_name else "General",
                barcode=clean_barcode,
                sku_code=sku,
                hsn_code="150990",  # General default
                cost_price=payload.purchase_price or 0.0,
                mrp=payload.mrp or 0.0,
                sale_price=payload.selling_price or payload.mrp or 0.0,
                weight="Standard",
                quantity=1.0,
                tax=payload.tax_percent or 18.0,
                type="CGST + SGST",
                category=payload.category_name.strip() if payload.category_name else "General",
                sub_category=payload.sub_category_name.strip() if payload.sub_category_name else "General",
                short_description=payload.short_description or "",
                specifications="Imported from tenant inventory creation",
                source="AI_WEB_SEARCH"
            )
            db.add(new_mc)
            
    await db.commit()
    await db.refresh(new_product)
    
    return new_product
