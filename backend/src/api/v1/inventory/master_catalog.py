import json
import re
import uuid
import requests
import logging
import io
import os
import urllib.parse
from html import unescape
from html.parser import HTMLParser
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, BackgroundTasks
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


def _is_meaningless_product_name(name: Optional[str], query: str) -> bool:
    """Helper to detect if a product name returned by the AI is empty, placeholder, or failure message."""
    if not name or not name.strip():
        return True
    nl = name.lower()
    placeholders = [
        "null", "none", "unknown", "placeholder", "n/a", "na", "nil", "empty",
        f"product {query}", f"barcode {query}", "product not identified",
        "product query", "not identified"
    ]
    if nl in placeholders:
        return True
    # If the name is a sentence explaining that the barcode is not recognized or not found
    indicators = ["not identified", "does not match", "requires database", "not found", "no information"]
    for ind in indicators:
        if ind in nl:
            return True
    return False


def _deprecated_download_and_cache_product_image(image_url: str, barcode: str = None) -> Optional[str]:
    """Legacy implementation retained only for source-history compatibility."""
    if not image_url or not image_url.startswith("http"):
        return image_url
        
    try:
        import os
        os.makedirs("images", exist_ok=True)
        
        # Generate a safe filename
        ext = ".jpg"
        if ".png" in image_url.lower():
            ext = ".png"
        elif ".gif" in image_url.lower():
            ext = ".gif"
            
        filename = f"{barcode}{ext}" if barcode else f"{uuid.uuid4()}{ext}"
        local_path = os.path.join("images", filename)
        
        # Download the image bytes
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
        res = requests.get(image_url, headers=headers, timeout=10)
        if res.status_code == 200:
            with open(local_path, "wb") as f:
                f.write(res.content)
            logger.info(f"Downloaded and cached product image locally: /images/{filename}")
            return f"/images/{filename}"
        else:
            logger.warning(f"Failed to download image {image_url}, status code: {res.status_code}")
    except Exception as e:
        logger.error(f"Error caching product image: {e}")
        
    return image_url


def _deprecated_fetch_barcodelookup_data(barcode: str) -> dict:
    """Legacy implementation retained only for source-history compatibility."""
    import urllib.parse, re
    result = {"name": "", "brand": "", "description": "", "image_url": "", "category": "", "weight": ""}
    try:
        url = f"https://www.barcodelookup.com/{barcode}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.google.com/"
        }
        res = requests.get(url, headers=headers, timeout=12)
        logger.info(f"BarcodeLookup.com status for {barcode}: {res.status_code}")
        if res.status_code == 200:
            html = res.text
            # Extract product name
            name_match = re.search(r'<h4[^>]*>\s*(.*?)\s*</h4>', html, re.DOTALL)
            if not name_match:
                name_match = re.search(r'<h1[^>]*class="[^"]*product[^"]*"[^>]*>\s*(.*?)\s*</h1>', html, re.DOTALL | re.IGNORECASE)
            if name_match:
                result["name"] = re.sub(r'<[^>]+>', '', name_match.group(1)).strip()
            
            # Extract product image - look for the main product image
            img_match = re.search(r'<img[^>]+(?:id="[^"]*product[^"]*"|class="[^"]*product[^"]*")[^>]+src="([^"]+)"', html, re.IGNORECASE)
            if not img_match:
                img_match = re.search(r'<div[^>]*class="[^"]*product-image[^"]*"[^>]*>.*?<img[^>]+src="([^"]+)"', html, re.DOTALL | re.IGNORECASE)
            if not img_match:
                # Try og:image meta tag
                img_match = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', html, re.IGNORECASE)
            if not img_match:
                # Try any large image that's not a logo/icon
                img_match = re.search(r'<img[^>]+src="(https://[^"]+(?:product|item|barcode)[^"]*\.(?:jpg|jpeg|png|webp))"', html, re.IGNORECASE)
            if img_match:
                result["image_url"] = img_match.group(1).strip()
                
            # Extract brand
            brand_match = re.search(r'(?:Brand|Manufacturer)[^<]*:\s*<[^>]*>([^<]+)<', html, re.IGNORECASE)
            if not brand_match:
                brand_match = re.search(r'"brand"\s*:\s*"([^"]+)"', html)
            if brand_match:
                result["brand"] = brand_match.group(1).strip()
                
            # Extract description  
            desc_match = re.search(r'<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)</p>', html, re.IGNORECASE)
            if not desc_match:
                desc_match = re.search(r'<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)</div>', html, re.IGNORECASE)
            if desc_match:
                result["description"] = re.sub(r'<[^>]+>', '', desc_match.group(1)).strip()[:500]
                
            # Extract category
            cat_match = re.search(r'(?:Category|Type)[^<]*:\s*<[^>]*>([^<]+)<', html, re.IGNORECASE)
            if cat_match:
                result["category"] = cat_match.group(1).strip()
                
            # Extract weight/size
            weight_match = re.search(r'(?:Weight|Size|Net Weight)[^<]*:\s*<[^>]*>([^<]+)<', html, re.IGNORECASE)
            if not weight_match:
                weight_match = re.search(r'(?:Weight|Size|Net Weight)\s*[:\-]\s*([0-9]+\s*(?:g|kg|ml|l|oz|lb)[^<,\n]*)', html, re.IGNORECASE)
            if weight_match:
                result["weight"] = weight_match.group(1).strip()
                
            logger.info(f"BarcodeLookup.com data: name='{result['name']}', image='{result['image_url'][:60] if result['image_url'] else 'none'}'")
    except Exception as e:
        logger.warning(f"BarcodeLookup.com scrape failed: {e}")
    return result


def _deprecated_fetch_web_search_context(query: str) -> dict:
    """Legacy implementation retained only for source-history compatibility.
    Returns a dict with 'text' (context for AI prompt) and 'image_url' (best image found)."""
    import urllib.parse, re
    context_parts = []
    found_image_url = ""
    
    clean = query.strip()
    is_barcode = clean.isdigit() and len(clean) >= 8
    
    # 1. BarcodeLookup.com — PRIMARY source, richest data + images
    if is_barcode:
        bl_data = _fetch_barcodelookup_data(clean)
        if bl_data.get("name"):
            bl_text = f"[BarcodeLookup.com - AUTHORITATIVE]\nProduct Name: {bl_data['name']}\nBrand: {bl_data['brand']}\nDescription: {bl_data['description']}\nCategory: {bl_data['category']}\nWeight: {bl_data['weight']}"
            context_parts.append(bl_text)
            if bl_data.get("image_url"):
                found_image_url = bl_data["image_url"]
    
    # 2. Open Food Facts — great for food/FMCG barcodes (with image)
    if is_barcode:
        try:
            off_url = f"https://world.openfoodfacts.org/api/v2/product/{clean}.json"
            off_headers = {"User-Agent": "BusinessOSAI/1.0 (contact@businessosai.com)"}
            off_res = requests.get(off_url, headers=off_headers, timeout=8)
            if off_res.status_code == 200:
                off_data = off_res.json()
                if off_data.get("status") == 1:
                    p = off_data.get("product", {})
                    name = p.get("product_name") or p.get("product_name_en") or ""
                    brand = p.get("brands", "")
                    quantity = p.get("quantity", "")
                    categories = p.get("categories", "")
                    ingreds = p.get("ingredients_text", "")
                    country = p.get("countries", "")
                    image = p.get("image_url") or p.get("image_front_url", "")
                    off_text = f"[Open Food Facts]\nProduct Name: {name}\nBrand: {brand}\nQuantity/Weight: {quantity}\nCategories: {categories}\nIngredients: {ingreds[:200] if ingreds else 'N/A'}\nCountry: {country}"
                    context_parts.append(off_text)
                    if image and not found_image_url:
                        found_image_url = image
                    logger.info(f"Open Food Facts: {name}")
        except Exception as e:
            logger.warning(f"Open Food Facts lookup failed: {e}")

    # 3. DuckDuckGo Instant Answer
    try:
        ddg_url = f"https://api.duckduckgo.com/?q={urllib.parse.quote(query)}&format=json&no_redirect=1&no_html=1"
        ddg_res = requests.get(ddg_url, headers={"User-Agent": "BusinessOSAI/1.0"}, timeout=8)
        if ddg_res.status_code == 200:
            ddg_data = ddg_res.json()
            bits = []
            if ddg_data.get("AbstractText"):
                bits.append(ddg_data["AbstractText"])
            if ddg_data.get("Answer"):
                bits.append(ddg_data["Answer"])
            for r in ddg_data.get("RelatedTopics", [])[:4]:
                if isinstance(r, dict) and r.get("Text"):
                    bits.append(r["Text"])
            if bits:
                context_parts.append("[DuckDuckGo]\n" + "\n".join(bits))
    except Exception as e:
        logger.warning(f"DuckDuckGo lookup failed: {e}")

    # 4. Yahoo scraping for additional context and titles (always run to ensure rich data)
    try:
        url = f"https://search.yahoo.com/search?p={urllib.parse.quote(query)}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5"
        }
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code == 200:
            # Extract titles
            titles = re.findall(r'<h3[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)</h3>', res.text)
            # Extract snippets
            snippets = re.findall(r'<(?:p|span|div)[^>]*class="[^"]*(?:spry|caption|abstract|abstract-text|result-snippet|compText)[^"]*"[^>]*>([\s\S]*?)</(?:p|span|div)>', res.text)
            
            yahoo_bits = []
            for i in range(max(len(titles), len(snippets))):
                bit = []
                if i < len(titles):
                    t_clean = re.sub(r'<[^>]+>', '', titles[i]).strip()
                    if t_clean:
                        bit.append(f"Title: {t_clean}")
                if i < len(snippets):
                    s_clean = re.sub(r'<[^>]+>', '', snippets[i]).strip()
                    if s_clean and "cookie" not in s_clean.lower():
                        bit.append(f"Snippet: {s_clean}")
                if bit:
                    yahoo_bits.append(" - ".join(bit))
            
            if yahoo_bits:
                context_parts.append("[Yahoo Search Results]\n" + "\n".join(yahoo_bits[:8]))
                
            # Try to grab a product image from the search page HTML (e.g. favicons or image links)
            if not found_image_url:
                img_matches = re.findall(r'src="(https://[^"]+?\.(?:jpg|jpeg|png|webp))"', res.text, re.IGNORECASE)
                for img in img_matches:
                    if any(x in img.lower() for x in ["product", "item", "catalog", "nehanx", "bigbasket", "jiomart", "netmeds", "1mg", "amazon", "m.media-amazon"]):
                        found_image_url = img
                        logger.info(f"Extracted image from Yahoo Search HTML: {found_image_url}")
                        break
    except Exception as e:
        logger.warning(f"Yahoo search scrape failed: {e}")

    return {"text": "\n\n".join(context_parts), "image_url": found_image_url}



def _is_valid_key(key: str | None) -> bool:
    """Returns True only when an API key is genuinely configured (non-empty and not a commented-out placeholder like #...)."""
    return bool(key) and not str(key).strip().startswith("#")


def _normalize_provider(provider: str | None) -> str:
    """Normalize provider names and treat empty/unknown values as auto."""
    if not provider:
        return ""
    provider_name = str(provider).strip().lower()
    return provider_name if provider_name in {"gemini", "openai", "claude"} else ""


def _resolve_ai_provider(requested_provider: str | None) -> str:
    """Prefer the explicit request when it has a configured key, otherwise honor server AI_PROVIDER."""
    requested = _normalize_provider(requested_provider)
    configured = {
        "gemini": _is_valid_key(settings.gemini_api_key),
        "openai": _is_valid_key(settings.openai_api_key),
        "claude": _is_valid_key(settings.anthropic_api_key),
    }

    if requested and configured.get(requested):
        return requested

    server_provider = _normalize_provider(getattr(settings, "ai_provider", None))
    if server_provider and configured.get(server_provider):
        return server_provider

    for provider_name, is_configured in configured.items():
        if is_configured:
            return provider_name

    return requested or server_provider or "gemini"


async def _deprecated_perform_ai_rag_web_search(query_str: str, provider: str = "gemini") -> List[MasterCatalogItem]:
    """Legacy implementation retained only for source-history compatibility."""
    ai_results: List[MasterCatalogItem] = []
    
    # Resolve the effective active AI provider, always honouring server configuration
    has_gemini = _is_valid_key(settings.gemini_api_key)
    has_openai = _is_valid_key(settings.openai_api_key)
    has_claude = _is_valid_key(settings.anthropic_api_key)

    active_provider = _resolve_ai_provider(provider)
        
    search_context_text = ""
    direct_image_url = ""
    if active_provider in ["openai", "claude"] and query_str:
        logger.info(f"Retrieving search grounding context for '{query_str}'...")
        context_res = _fetch_web_search_context(query_str)
        search_context_text = context_res.get("text", "")
        direct_image_url = context_res.get("image_url", "")
        
    if active_provider == "gemini" and has_gemini:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.gemini_api_key}"
            
            clean_query = query_str.strip()
            is_barcode = clean_query.isdigit() and len(clean_query) in [8, 12, 13, 14]
            
            if is_barcode:
                prompt = (
                    f"You are an expert product sourcing assistant. Perform a deep, thorough live Google search for the EXACT product barcode number: '{clean_query}'.\n"
                    f"Your search query MUST contain the barcode number in double quotes (e.g. \"{clean_query}\") to find the exact official matching product name.\n"
                    "You MUST search across reliable online retail, pharmacy, and e-commerce listings (such as Amazon, BigBasket, Blinkit, Netmeds, Tata 1mg, Apollo Pharmacy, JioMart) to find the correct product name corresponding to this exact barcode.\n"
                    "CRITICAL RULES:\n"
                    "1. Do NOT return an unrelated product. Double check the search grounding snippets to ensure the product title matches the barcode identifier. For example, Sun Pharma products (like Volini) have the barcode prefix 8901296.\n"
                    "2. If search grounding contains conflicting products (e.g., one hobby site listing it as an aquarium item, while major pharmacy sites list it as a pain relief spray), you MUST prioritize the major authoritative sites (Amazon, Netmeds, Tata 1mg, BigBasket) and return the pharmacy product.\n"
                    "For any numeric/operational fields you cannot find directly on the internet (such as cost_price, tax, hsn_code, or specifications), you may use standard defaults (e.g. cost_price can be estimated at 70% of the actual found MRP, tax can be 18.0, sub_category can be 'General') rather than leaving them out or failing! Always prioritize actual found retail prices over generic estimates for mrp and sale_price.\n"
                    "Return your findings as a JSON ARRAY of 1 matching product object with this EXACT structure:\n"
                    "[\n"
                    "  {\n"
                    '    "name": "Full official product title",\n'
                    '    "brand": "Brand Name",\n'
                    f'    "barcode": "{clean_query}",\n'
                    '    "sku_code": null,\n'
                    '    "product_code": "Product code if available, or null",\n'
                    '    "hsn_code": "Standard HSN / SAC code if applicable",\n'
                    '    "plu_no": null,\n'
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
                    '    "category": "Product Category",\n'
                    '    "sub_category": "Sub Category",\n'
                    '    "instock_value": 0.0,\n'
                    '    "image_url": "Real-world product image URL from the retail website grounding sources (e.g. ending in .jpg, .png, or from e-commerce CDNs). Do NOT return placeholders, example.com domains, or dummy text. If not found, return null.",\n'
                    '    "short_description": "2-3 sentence overview of features",\n'
                    '    "specifications": "Key specs (e.g. Capacity, Dimensions, Weight, Power)"\n'
                    "  }\n"
                    "]\n"
                    "Respond strictly with the valid JSON ARRAY, with no markdown conversation around it."
                )
            else:
                prompt = (
                    f"You are an expert product sourcing assistant. Perform a deep, thorough live Google search for the product query or barcode: '{query_str}'.\n"
                    "You MUST search across reliable online retail and e-commerce sources (such as Amazon, BigBasket, Blinkit, JioMart, Nykaa, or direct manufacturer listings) to extract the actual real-time product name, brand, MRP, online sale prices, weight, specifications, and brand.\n"
                    "CRITICAL: The 'name' and 'brand' fields must NEVER be generic placeholders (like 'Generic Product', 'Product Query', or 'Unknown Brand'). You MUST extract the actual official product title (e.g. 'Lakmé Peach Milk 2% Pro-Ceramide Gel Moisturiser') and the actual brand (e.g. 'Lakmé') from the search grounding results. If you cannot identify the product name and brand, do not generate a fake object.\n"
                    "CRITICAL BARCODE RULE: You MUST locate and extract the actual official EAN, UPC, or GTIN barcode number of the product (for example, for 'Noise Master Buds Max' search for its EAN barcode which is '8906174626478'). If a numeric barcode is found in the search results (especially 8 to 14 digit numbers), you MUST populate the 'barcode' field with it. Do NOT put the barcode number in the 'sku_code' field while leaving 'barcode' empty or null.\n"
                    "For any numeric/operational fields you cannot find directly on the internet (such as cost_price, tax, hsn_code, or specifications), you may use standard defaults (e.g. cost_price can be estimated at 70% of the actual found MRP, tax can be 18.0, sub_category can be 'General') rather than leaving them out or failing! Always prioritize actual found retail prices over generic estimates for mrp and sale_price.\n"
                    "Return your findings as a JSON ARRAY of 1 to 3 matching product objects with this EXACT structure for each item:\n"
                    "[\n"
                    "  {\n"
                    '    "name": "Full official product title",\n'
                    '    "brand": "Brand Name",\n'
                    '    "barcode": "Numeric EAN / UPC / GTIN barcode number (e.g. 8906174626478), or null",\n'
                    '    "sku_code": "SKU code if available, or null (do not put the barcode here)",\n'
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
                    '    "image_url": "Real-world product image URL from the retail website grounding sources (e.g. ending in .jpg, .png, or from e-commerce CDNs). Do NOT return placeholders, example.com domains, or dummy text. If not found, return null.",\n'
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
                name = item.get("name")
                if _is_meaningless_product_name(name, query_str):
                    continue
                ai_results.append(MasterCatalogItem(
                    name=name,
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
                    image_url=_download_and_cache_product_image(item.get("image_url"), item.get("barcode")),
                    short_description=item.get("short_description"),
                    specifications=item.get("specifications"),
                    source="AI_WEB_SEARCH"
                ))
            return ai_results
        except HTTPException as he:
            if settings.openai_api_key or settings.anthropic_api_key:
                logger.warning(f"Gemini RAG search failed: {he.detail}. Falling back to next available provider...")
            else:
                raise he
        except Exception as e:
            if settings.openai_api_key or settings.anthropic_api_key:
                logger.warning(f"Gemini RAG search failed: {e}. Falling back to next available provider...")
            else:
                logger.error(f"Gemini Web RAG search failed: {e}")
                raise HTTPException(status_code=502, detail=f"Gemini API connection error: {e}")

    # Fallback to OpenAI if configured or provider is openai
    if (active_provider == "openai" or not ai_results) and settings.openai_api_key:
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
            if search_context_text:
                prompt += f"\n\nHere is the live web search context for this product/barcode:\n{search_context_text}\n"
            body = {
                "model": settings.openai_model or "gpt-4o",
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"}
            }
            import time
            max_retries = 4
            backoff = 2.0
            res = None
            for attempt in range(max_retries):
                res = requests.post(url, json=body, headers=headers, timeout=60)
                if res.status_code == 429 and attempt < max_retries - 1:
                    logger.warning(f"OpenAI API returned 429 (Rate Limit Exceeded). Retrying in {backoff}s... (Attempt {attempt+1}/{max_retries})")
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                break
                
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
                name = item.get("name")
                if _is_meaningless_product_name(name, query_str):
                    continue
                ai_results.append(MasterCatalogItem(
                    name=name,
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
                    image_url=_download_and_cache_product_image(item.get("image_url") or direct_image_url, item.get("barcode")),
                    short_description=item.get("short_description"),
                    specifications=item.get("specifications"),
                    source="AI_WEB_SEARCH"
                ))
            return ai_results
        except HTTPException as he:
            if settings.anthropic_api_key:
                logger.warning(f"OpenAI RAG search failed: {he.detail}. Falling back to Claude...")
            else:
                raise he
        except Exception as e:
            if settings.anthropic_api_key:
                logger.warning(f"OpenAI RAG search failed: {e}. Falling back to Claude...")
            else:
                logger.error(f"OpenAI Web RAG search failed: {e}")
                raise HTTPException(status_code=502, detail=f"OpenAI API connection error: {e}")

    # Fallback to Anthropic Claude if configured or provider is claude
    if (active_provider == "claude" or not ai_results) and settings.anthropic_api_key:
        try:
            logger.info("Executing Anthropic Claude product catalog sourcing...")
            url = f"{settings.anthropic_base_url.rstrip('/')}/v1/messages"
            headers = {
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            prompt = (
                f"Identify real-world product specifications, real-time MRP, sales price, specifications, weight, and correct brand for the query/barcode: '{query_str}'.\n"
                "CRITICAL: Do NOT attempt to call any tools or output tool calls (such as <tool_call> or web_search). Answer directly using your internal knowledge.\n"
                "CRITICAL: Keep your response extremely brief. Generate ONLY the JSON array. Do NOT output any thinking, preamble, explanation, or conversational text. Go straight to the JSON output.\n"
                "Return the findings as a JSON ARRAY of 1 to 3 matching product objects. Do NOT output any conversational text or markdown codeblocks, only valid JSON.\n"
                "Structure structure for each product item:\n"
                "[\n"
                "  {\n"
                '    "name": "Full official product title",\n'
                '    "brand": "Brand Name",\n'
                '    "barcode": "Numeric barcode (EAN/UPC/GTIN) or null",\n'
                '    "sku_code": null,\n'
                '    "product_code": "Product code if available, or null",\n'
                '    "hsn_code": "HSN Code",\n'
                '    "plu_no": null,\n'
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
                '    "tax": 18.0,\n'
                '    "type": "CGST + SGST",\n'
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
                '    "category": "Category",\n'
                '    "sub_category": "Sub Category",\n'
                '    "instock_value": 0.0,\n'
                '    "image_url": "Direct product image URL from retail CDNs if known, else null (strictly do NOT use example.com placeholders)",\n'
                '    "short_description": "2-3 sentence overview of features",\n'
                '    "specifications": "Key specs (e.g. Dimensions, Weight, Power)"\n'
                "  }\n"
                "]"
            )
            if search_context_text:
                prompt += f"\n\nHere is the live web search context for this product/barcode:\n{search_context_text}\n"
            body = {
                "model": settings.anthropic_model or "claude-3-5-sonnet-20241022",
                "max_tokens": 4096,
                "messages": [{"role": "user", "content": prompt}]
            }
            import time
            max_retries = 4
            backoff = 2.0
            res = None
            for attempt in range(max_retries):
                res = requests.post(url, json=body, headers=headers, timeout=120)
                if res.status_code == 429 and attempt < max_retries - 1:
                    logger.warning(f"Anthropic API returned 429 (Rate Limit Exceeded). Retrying in {backoff}s... (Attempt {attempt+1}/{max_retries})")
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                break
                
            if res.status_code == 429:
                raise HTTPException(status_code=429, detail="Anthropic API rate limit exceeded (429).")
            if res.status_code != 200:
                raise HTTPException(status_code=res.status_code, detail=f"Anthropic API returned error: {res.text[:500]}")
            
            content_blocks = res.json().get("content", [])
            text = ""
            for block in content_blocks:
                if block.get("type") == "text":
                    text = block.get("text", "")
                    break
            if not text and content_blocks:
                text = content_blocks[0].get("text", "")
            
            parsed_data = _extract_json_from_text(text)
            if isinstance(parsed_data, dict):
                if "products" in parsed_data:
                    parsed_data = parsed_data["products"]
                else:
                    parsed_data = [parsed_data]
            elif not isinstance(parsed_data, list):
                parsed_data = [parsed_data]
                
            for item in parsed_data:
                name = item.get("name")
                if _is_meaningless_product_name(name, query_str):
                    continue
                ai_results.append(MasterCatalogItem(
                    name=name,
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
                    image_url=_download_and_cache_product_image(item.get("image_url") or direct_image_url, item.get("barcode")),
                    short_description=item.get("short_description"),
                    specifications=item.get("specifications"),
                    source="AI_WEB_SEARCH"
                ))
            return ai_results
        except Exception as e:
            logger.error(f"Anthropic Claude RAG search failed: {e}")
            if active_provider == "claude":
                raise HTTPException(status_code=502, detail=f"Anthropic API connection error: {e}")

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
                        image_url=_download_and_cache_product_image(image_url, clean_query),
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
    if not _is_valid_key(settings.gemini_api_key) and not _is_valid_key(settings.openai_api_key) and not _is_valid_key(settings.anthropic_api_key):
        raise HTTPException(
            status_code=400,
            detail="AI Sourcing API keys are not configured. Please check your .env settings."
        )

    # Backfill missing images using Open Food Facts if a barcode is available
    for item in ai_results:
        has_no_img = not item.image_url or item.image_url.strip() == "" or "placeholder" in item.image_url.lower() or "example.com" in item.image_url.lower()
        if has_no_img and item.barcode and item.barcode.strip().isdigit() and len(item.barcode.strip()) >= 8:
            try:
                barcode_clean = item.barcode.strip()
                logger.info(f"Image is missing for barcode {barcode_clean}. Sourcing from Open Food Facts...")
                off_url = f"https://world.openfoodfacts.org/api/v2/product/{barcode_clean}.json"
                off_headers = {"User-Agent": "BusinessOSAI/1.0 (contact@businessosai.com)"}
                off_res = requests.get(off_url, headers=off_headers, timeout=5)
                if off_res.status_code == 200:
                    off_data = off_res.json()
                    if off_data.get("status") == 1:
                        off_prod = off_data.get("product", {})
                        off_img = off_prod.get("image_url") or off_prod.get("image_front_url")
                        if off_img:
                            item.image_url = _download_and_cache_product_image(off_img, barcode_clean)
                            logger.info(f"Successfully backfilled image from Open Food Facts for barcode {barcode_clean}")
            except Exception as off_err:
                logger.warning(f"Failed to backfill image from Open Food Facts: {off_err}")

    return ai_results


# Source-first product sourcing helpers.  These definitions intentionally replace
# the older helpers above while keeping the route and response contracts intact.
_IMAGE_TIMEOUT = (5, 20)
_SOURCE_HEADERS = {
    "User-Agent": "BusinessOSAI/1.0 (+https://businessos.ai)",
    "Accept": "application/json,text/html,application/xhtml+xml,image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
}


class _ProductMetadataParser(HTMLParser):
    """Small dependency-free parser for structured product metadata."""

    def __init__(self) -> None:
        super().__init__()
        self.meta: dict[str, str] = {}
        self.json_ld: list[str] = []
        self._in_json_ld = False
        self._chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        attributes = {key.lower(): value or "" for key, value in attrs}
        if tag.lower() == "meta":
            key = (attributes.get("property") or attributes.get("name") or attributes.get("itemprop") or "").lower()
            value = attributes.get("content", "").strip()
            if key and value and key not in self.meta:
                self.meta[key] = unescape(value)
        if tag.lower() == "script" and "ld+json" in attributes.get("type", "").lower():
            self._in_json_ld = True
            self._chunks = []

    def handle_data(self, data: str) -> None:
        if self._in_json_ld:
            self._chunks.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "script" and self._in_json_ld:
            self.json_ld.append("".join(self._chunks))
            self._in_json_ld = False


def _clean_source_text(value: object, limit: int = 1000) -> str:
    return re.sub(r"\s+", " ", unescape(str(value or ""))).strip()[:limit]


def _normalise_identity(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (value or "").lower())


def _is_barcode_query(query: str) -> bool:
    return query.strip().isdigit() and len(query.strip()) in (8, 12, 13, 14)


def _download_and_cache_product_image(image_url: str, barcode: str = None) -> Optional[str]:
    """Validate, download, verify and cache only a real product image.

    Returning ``None`` is deliberate: callers must not persist an unverified
    remote URL as a product image.
    """
    if not image_url:
        return None
    if image_url.startswith("/images/"):
        return image_url
    parsed = urllib.parse.urlparse(image_url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        logger.warning("Rejected invalid product image URL: %r", image_url)
        return None

    response = None
    try:
        # HEAD cheaply rejects error pages and non-image resources before GET.
        head = requests.head(image_url, headers=_SOURCE_HEADERS, timeout=_IMAGE_TIMEOUT, allow_redirects=True)
        if head.status_code != 200:
            logger.warning("Rejected product image %s: HEAD returned %s", image_url, head.status_code)
            return None
        content_type = (head.headers.get("Content-Type") or "").split(";", 1)[0].lower()
        if not content_type.startswith("image/"):
            logger.warning("Rejected product image %s: MIME type %s", image_url, content_type or "missing")
            return None

        response = requests.get(image_url, headers=_SOURCE_HEADERS, timeout=_IMAGE_TIMEOUT, allow_redirects=True)
        content_type = (response.headers.get("Content-Type") or "").split(";", 1)[0].lower()
        if response.status_code != 200 or not content_type.startswith("image/"):
            logger.warning("Rejected product image %s: GET status=%s MIME=%s", image_url, response.status_code, content_type or "missing")
            return None
        if not response.content:
            logger.warning("Rejected empty product image: %s", image_url)
            return None

        from PIL import Image, UnidentifiedImageError
        try:
            Image.open(io.BytesIO(response.content)).verify()
            image = Image.open(io.BytesIO(response.content))
            image.load()
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            logger.warning("Rejected corrupt product image %s: %s", image_url, exc)
            return None

        # Preserve accepted web formats. Convert all other decodable images to JPEG.
        image_format = (image.format or "").upper()
        extension = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp", "GIF": ".gif"}.get(image_format, ".jpg")
        if extension == ".jpg":
            image = image.convert("RGB")
        filename = f"{barcode.strip() if barcode else uuid.uuid4()}{extension}"
        images_dir = os.path.join("images")
        os.makedirs(images_dir, exist_ok=True)
        local_path = os.path.join(images_dir, filename)
        temporary_path = f"{local_path}.tmp"
        try:
            if image_format in {"JPEG", "PNG", "WEBP", "GIF"}:
                with open(temporary_path, "wb") as image_file:
                    image_file.write(response.content)
            else:
                image.save(temporary_path, format="JPEG", quality=90, optimize=True)
            os.replace(temporary_path, local_path)
        finally:
            if os.path.exists(temporary_path):
                os.unlink(temporary_path)
        logger.info("Validated and cached product image: /images/%s", filename)
        return f"/images/{filename}"
    except requests.RequestException as exc:
        logger.warning("Could not download product image %s: %s", image_url, exc)
    except ImportError:
        logger.error("Pillow is required to validate product images; image was not cached")
    except Exception:
        logger.exception("Unexpected failure while caching product image: %s", image_url)
    return None


def _walk_json_ld(value: object) -> list[dict]:
    if isinstance(value, dict):
        found = [value]
        for child in value.values():
            found.extend(_walk_json_ld(child))
        return found
    if isinstance(value, list):
        return [node for child in value for node in _walk_json_ld(child)]
    return []


def _value_from_schema(value: object) -> str:
    if isinstance(value, dict):
        return _clean_source_text(value.get("name") or value.get("@id"))
    if isinstance(value, list):
        return _clean_source_text(", ".join(_value_from_schema(item) for item in value if _value_from_schema(item)))
    return _clean_source_text(value)


def _fetch_barcodelookup_data(barcode: str) -> dict:
    """Fetch BarcodeLookup using JSON-LD/OpenGraph before HTML fallbacks."""
    result = {"name": "", "brand": "", "description": "", "image_url": "", "category": "", "weight": "", "source": "BarcodeLookup"}
    try:
        response = requests.get(f"https://www.barcodelookup.com/{barcode}", headers=_SOURCE_HEADERS, timeout=(5, 15))
        if response.status_code != 200:
            logger.info("BarcodeLookup returned %s for %s", response.status_code, barcode)
            return result
        parser = _ProductMetadataParser()
        parser.feed(response.text)
        schema_products: list[dict] = []
        for raw_json in parser.json_ld:
            try:
                for node in _walk_json_ld(json.loads(raw_json)):
                    node_types = node.get("@type", "")
                    node_types = node_types if isinstance(node_types, list) else [node_types]
                    if any(str(node_type).lower() in {"product", "individualproduct"} for node_type in node_types):
                        schema_products.append(node)
            except (TypeError, ValueError, json.JSONDecodeError):
                continue
        product = schema_products[0] if schema_products else {}
        meta = parser.meta
        result.update({
            "name": _value_from_schema(product.get("name")) or _clean_source_text(meta.get("og:title") or meta.get("twitter:title")),
            "brand": _value_from_schema(product.get("brand")),
            "description": _value_from_schema(product.get("description")) or _clean_source_text(meta.get("og:description") or meta.get("description")),
            "image_url": _value_from_schema(product.get("image")) or _clean_source_text(meta.get("og:image") or meta.get("twitter:image")),
            "category": _value_from_schema(product.get("category")),
            "weight": _value_from_schema(product.get("weight")),
        })
        if not result["brand"]:
            result["brand"] = _clean_source_text(meta.get("product:brand") or meta.get("brand"))
        # Last-resort fallback for legacy BarcodeLookup pages with no metadata.
        if not result["name"]:
            title_match = re.search(r"<h[14][^>]*>\s*(.*?)\s*</h[14]>", response.text, re.I | re.S)
            if title_match:
                result["name"] = _clean_source_text(re.sub(r"<[^>]+>", " ", title_match.group(1)))
        logger.info("BarcodeLookup source for %s: name=%r", barcode, result["name"])
    except requests.RequestException as exc:
        logger.warning("BarcodeLookup lookup failed for %s: %s", barcode, exc)
    except Exception:
        logger.exception("Could not parse BarcodeLookup result for %s", barcode)
    return result


def _fetch_openfacts_data(barcode: str, host: str, source: str) -> dict:
    """Read one of the public Open Facts product registries by barcode."""
    result = {"name": "", "brand": "", "description": "", "image_url": "", "category": "", "weight": "", "source": source}
    try:
        response = requests.get(f"https://{host}/api/v2/product/{barcode}.json", headers=_SOURCE_HEADERS, timeout=(5, 12))
        data = response.json() if response.status_code == 200 else {}
        if data.get("status") != 1:
            return result
        product = data.get("product") or {}
        result.update({
            "name": _clean_source_text(product.get("product_name") or product.get("product_name_en")),
            "brand": _clean_source_text((product.get("brands") or "").split(",")[0]),
            "description": _clean_source_text(product.get("generic_name") or product.get("ingredients_text")),
            "image_url": _clean_source_text(product.get("image_url") or product.get("image_front_url")),
            "category": _clean_source_text((product.get("categories") or "").split(",")[0]),
            "weight": _clean_source_text(product.get("quantity") or product.get("serving_size")),
        })
        logger.info("%s source for %s: name=%r", source, barcode, result["name"])
    except (requests.RequestException, ValueError) as exc:
        logger.info("%s lookup failed for %s: %s", source, barcode, exc)
    return result


def _fetch_openfoodfacts_data(barcode: str) -> dict:
    return _fetch_openfacts_data(barcode, "world.openfoodfacts.org", "Open Food Facts")


def _fetch_openfacts_registries(barcode: str) -> list[dict]:
    """Public barcode registries covering food, beauty, pet and general products."""
    registries = (
        ("world.openfoodfacts.org", "Open Food Facts"),
        ("world.openbeautyfacts.org", "Open Beauty Facts"),
        ("world.openpetfoodfacts.org", "Open Pet Food Facts"),
        ("world.openproductsfacts.org", "Open Products Facts"),
    )
    return [product for host, source in registries
            if (product := _fetch_openfacts_data(barcode, host, source)).get("name")]


def _fetch_upcitemdb_data(barcode: str) -> dict:
    """Use UPCitemdb's public trial endpoint as an additional non-scraped source."""
    result = {"name": "", "brand": "", "description": "", "image_url": "", "category": "", "weight": "", "source": "UPCitemdb"}
    try:
        response = requests.get(
            f"https://api.upcitemdb.com/prod/trial/lookup?upc={urllib.parse.quote(barcode)}",
            headers=_SOURCE_HEADERS, timeout=(5, 12),
        )
        data = response.json() if response.status_code == 200 else {}
        item = (data.get("items") or [{}])[0]
        result.update({
            "name": _clean_source_text(item.get("title")), "brand": _clean_source_text(item.get("brand")),
            "description": _clean_source_text(item.get("description")), "image_url": _clean_source_text((item.get("images") or [""])[0]),
            "category": _clean_source_text(item.get("category")), "weight": _clean_source_text(item.get("size")),
        })
        if result["name"]:
            logger.info("UPCitemdb source for %s: name=%r", barcode, result["name"])
    except (requests.RequestException, ValueError, IndexError) as exc:
        logger.info("UPCitemdb lookup unavailable for %s: %s", barcode, exc)
    return result


def _fetch_search_snippets(query: str, provider_name: str) -> list[str]:
    """Fetch minimal public search context using DuckDuckGo Lite or Yahoo."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    
    # Try DuckDuckGo Lite first as it is extremely reliable and lightweight
    try:
        url = "https://lite.duckduckgo.com/lite/"
        data = {"q": query}
        res = requests.post(url, data=data, headers=headers, timeout=(5, 10))
        if res.status_code == 200:
            raw_snippets = re.findall(r"<td[^>]*class=['\"]result-snippet['\"][^>]*>([\s\S]*?)</td>", res.text)
            clean_snippets = []
            for snip in raw_snippets[:10]:
                clean = re.sub(r'<[^>]+>', '', snip).strip()
                clean = re.sub(r'\s+', ' ', clean)
                if len(clean) > 20:
                    clean_snippets.append(_clean_source_text(clean))
            if clean_snippets:
                return clean_snippets
    except Exception as exc:
        logger.info("DuckDuckGo Lite search fallback failed: %s", exc)

    # Fallback to Yahoo if DDG Lite is down/fails
    try:
        url = f"https://search.yahoo.com/search?p={urllib.parse.quote(query)}"
        res = requests.get(url, headers=headers, timeout=(5, 10))
        if res.status_code == 200:
            raw_snippets = re.findall(
                r'<p class="[^"]*fc-spry[^"]*">([\s\S]*?)</p>|<div class="compText[^"]*">([\s\S]*?)</div>',
                res.text
            )
            clean_snippets = []
            for match in raw_snippets[:8]:
                val = match[0] or match[1]
                clean = re.sub(r'<[^>]+>', '', val).strip()
                clean = re.sub(r'\s+', ' ', clean)
                if len(clean) > 20:
                    clean_snippets.append(_clean_source_text(clean))
            if clean_snippets:
                return clean_snippets
    except Exception as exc:
        logger.info("Yahoo search fallback failed: %s", exc)
        
    return []


def _fetch_web_search_context(query: str) -> dict:
    """Return source-ranked, non-AI search context used only for enrichment."""
    clean_query = query.strip()
    sources: list[dict] = []
    if _is_barcode_query(clean_query):
        sources.extend(_fetch_openfacts_registries(clean_query))
        for lookup in (_fetch_barcodelookup_data, _fetch_upcitemdb_data):
            product = lookup(clean_query)
            if product.get("name"):
                sources.append(product)
                
    # Fetch web search snippets
    web_snippets = _fetch_search_snippets(clean_query, "DuckDuckGo")
    if web_snippets:
        sources.append({"source": "Web Search", "text": "\n".join(web_snippets)})
        
    text_parts = []
    for source in sources:
        if source.get("name"):
            text_parts.append("[{source}]\nProduct Name: {name}\nBrand: {brand}\nDescription: {description}\nCategory: {category}\nWeight: {weight}".format(**source))
        elif source.get("text"):
            text_parts.append(f"[{source['source']}]\n{source['text']}")
    image_url = next((source.get("image_url", "") for source in sources if source.get("image_url")), "")
    registry_sources = [source for source in sources if source.get("name")]
    confidence = 0
    if len(registry_sources) == 1:
        confidence = 80
    elif len(registry_sources) > 1 and _normalise_identity(registry_sources[0]["name"]) == _normalise_identity(registry_sources[1]["name"]):
        confidence = 100
    return {
        "text": "\n\n".join(text_parts), "image_url": image_url, "confidence": confidence,
        "sources": sources, "source_list": [source["source"] for source in sources],
    }


def _resolve_conflicting_identity(barcode: str, candidates: list[dict], context: str) -> Optional[dict]:
    """Use Gemini only as a constrained selector after registry/retailer conflict."""
    if not _is_valid_key(settings.gemini_api_key):
        return None
    choices = [{"name": item["name"], "brand": item.get("brand", "")} for item in candidates]
    prompt = (
        f"Select the most consistently supported existing candidate for barcode {barcode}. "
        "You must return exactly one JSON object with only selected_index, or {} if the evidence is insufficient. "
        "Do not create, rename, or infer a product.\n"
        f"Candidates: {json.dumps(choices)}\nRetailer evidence: {context[:5000]}"
    )
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.gemini_api_key}"
        response = requests.post(url, json={"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"responseMimeType": "application/json"}}, timeout=45)
        if response.status_code != 200:
            logger.warning("Gemini conflict resolution returned %s for %s", response.status_code, barcode)
            return None
        data = _extract_json_from_text(response.json()["candidates"][0]["content"]["parts"][0]["text"])
        index = data.get("selected_index") if isinstance(data, dict) else None
        return candidates[index] if isinstance(index, int) and 0 <= index < len(candidates) else None
    except Exception as exc:
        logger.warning("Gemini could not resolve barcode conflict %s: %s", barcode, exc)
        return None


def _resolve_barcode_consensus(barcode: str) -> dict:
    valid = _fetch_openfacts_registries(barcode)
    for lookup in (_fetch_barcodelookup_data, _fetch_upcitemdb_data):
        product = lookup(barcode)
        if product.get("name"):
            valid.append(product)
    if not valid:
        return {"identity": None, "confidence": 0, "source": "", "resolved_by": "no_registry_match", "candidates": []}
    if len(valid) == 1:
        return {"identity": valid[0], "confidence": 80, "source": valid[0]["source"], "resolved_by": "single_registry", "candidates": valid}
    identity_groups: dict[str, list[dict]] = {}
    for product in valid:
        identity_groups.setdefault(_normalise_identity(product["name"]), []).append(product)
    best_group = max(identity_groups.values(), key=len)
    if len(best_group) >= 2:
        identity = dict(best_group[0])
        for product in best_group[1:]:
            for key, value in product.items():
                if not identity.get(key) and value:
                    identity[key] = value
        return {"identity": identity, "confidence": 100, "source": " + ".join(item["source"] for item in best_group), "resolved_by": "registry_consensus", "candidates": valid}
    # Retailer/search evidence is deliberately only a tie breaker. No LLM identity
    # is accepted unless it exactly selects one of the registry candidates.
    context = _fetch_web_search_context(barcode)
    retailer_text = context["text"].lower()
    scores = [retailer_text.count(candidate["name"].lower()) for candidate in valid]
    if max(scores) and scores.count(max(scores)) == 1:
        selected = valid[scores.index(max(scores))]
        return {"identity": selected, "confidence": 85, "source": selected["source"], "resolved_by": "retailer_context", "candidates": valid}
    selected = _resolve_conflicting_identity(barcode, valid, context["text"])
    if selected:
        return {"identity": selected, "confidence": 80, "source": selected["source"], "resolved_by": "gemini_constrained_selector", "candidates": valid}
    return {"identity": None, "confidence": 0, "source": " + ".join(item["source"] for item in valid), "resolved_by": "conflicting_registries", "candidates": valid}


def _resolve_barcode_with_claude_web_search(barcode: str) -> Optional[dict]:
    """Last-resort web-grounded resolution for barcodes missing from public registries.
    Uses custom scraped search context to ground Claude model predictions securely.
    """
    if not _is_valid_key(settings.anthropic_api_key):
        return None

    # Get search context using our fixed Yahoo/DDG snippet parser
    context = _fetch_web_search_context(barcode)
    context_text = context.get("text", "")
    if not context_text:
        logger.warning("No search context found for barcode %s, Claude cannot resolve", barcode)
        return None

    prompt = (
        f"You are an expert product cataloging assistant. Identify the product name, brand, description, category, and weight for barcode '{barcode}'.\n"
        "Here is the live search context containing search results for this barcode:\n"
        f"{context_text}\n\n"
        "CRITICAL RULES:\n"
        "1. Identify the exact product title and brand from the search results.\n"
        "2. Return JSON ONLY with barcode, name, brand, description, category, weight, and image_url.\n"
        "3. Keep your response extremely brief. Do NOT output any preamble, explanation, thinking blocks, or conversational text. Return only valid JSON.\n"
        "Format:\n"
        "{\n"
        '  "barcode": "...",\n'
        '  "name": "...",\n'
        '  "brand": "...",\n'
        '  "description": "...",\n'
        '  "category": "...",\n'
        '  "weight": "...",\n'
        '  "image_url": "..."\n'
        "}"
    )

    url = f"{settings.anthropic_base_url.rstrip('/')}/v1/messages"
    headers = {
        "x-api-key": settings.anthropic_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": settings.anthropic_model or "claude-3-5-sonnet-20241022",
        "max_tokens": 800,
        "messages": [{"role": "user", "content": prompt}],
    }
    try:
        response = requests.post(url, headers=headers, json=body, timeout=60)
        if response.status_code != 200:
            logger.warning("Claude search resolution returned %s for barcode %s: %s", response.status_code, barcode, response.text)
            return None
        payload = response.json()
        content = payload.get("content") or []
        text = next((block.get("text", "") for block in content if block.get("type") == "text"), "")
        data = _extract_json_from_text(text) if text else {}
        if isinstance(data, list):
            data = data[0] if data else {}
        
        if not isinstance(data, dict) or not data.get("name"):
            return None
            
        name = _clean_source_text(data.get("name"))
        if _is_meaningless_product_name(name, barcode):
            return None
            
        return {
            "name": name,
            "brand": _clean_source_text(data.get("brand")),
            "description": _clean_source_text(data.get("description")),
            "category": _clean_source_text(data.get("category")),
            "weight": _clean_source_text(data.get("weight")),
            "image_url": _clean_source_text(data.get("image_url") or context.get("image_url")),
            "source": "Claude RAG Search",
        }
    except Exception as exc:
        logger.warning("Claude search resolution failed for %s: %s", barcode, exc)
    return None


def _resolve_barcode_with_gemini_web_search(barcode: str) -> Optional[dict]:
    """Web-grounded Gemini fallback when public barcode registries have no match."""
    if not _is_valid_key(settings.gemini_api_key):
        return None
    prompt = (
        f"You are a professional product identification system. Search the web for the product matching barcode '{barcode}' using Google Search.\n"
        "Return a JSON object containing the product information from the search results:\n"
        "{\n"
        f'  "barcode": "{barcode}",\n'
        '  "name": "Full official product title",\n'
        '  "brand": "Brand Name",\n'
        '  "description": "Product description",\n'
        '  "category": "Product category",\n'
        '  "weight": "Product size or weight"\n'
        "}\n"
        "CRITICAL: If the search results contain no product information for this barcode, return {}."
    )
    try:
        response = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.gemini_api_key}",
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "tools": [{"googleSearch": {}}],
            },
            timeout=90,
        )
        if response.status_code != 200:
            logger.warning("Gemini web search returned %s for barcode %s: %s", response.status_code, barcode, response.text[:300])
            return None
        candidate = (response.json().get("candidates") or [{}])[0]
        text = next((part.get("text", "") for part in candidate.get("content", {}).get("parts", []) if part.get("text")), "")
        data = _extract_json_from_text(text) if text else {}
        if isinstance(data, list):
            data = data[0] if data else {}
        if isinstance(data, dict) and isinstance(data.get("products"), list):
            data = data["products"][0] if data["products"] else {}
        grounding = candidate.get("groundingMetadata") or {}
        chunks = grounding.get("groundingChunks") or []
        source_urls = [
            (chunk.get("web") or {}).get("uri")
            for chunk in chunks if isinstance(chunk, dict) and (chunk.get("web") or {}).get("uri")
        ]
        if not isinstance(data, dict) or not data.get("name"):
            logger.warning(
                "Gemini web search did not find a name for barcode %s (sources=%d, text=%r)",
                barcode, len(source_urls), text[:300],
            )
            return None
        name = _clean_source_text(data.get("name"))
        if _is_meaningless_product_name(name, barcode):
            return None
        image_url = _find_grounded_product_image(source_urls)
        return {
            "name": name, "brand": _clean_source_text(data.get("brand")),
            "description": _clean_source_text(data.get("description")), "category": _clean_source_text(data.get("category")),
            "weight": _clean_source_text(data.get("weight")), "image_url": image_url,
            "source": "Gemini Google Search",
        }
    except (requests.RequestException, ValueError, KeyError) as exc:
        logger.warning("Gemini web-search fallback failed for %s: %s", barcode, exc)
    return None


def _find_grounded_product_image(source_urls: list[str]) -> str:
    """Get a product image from Gemini-grounded pages, never from model text."""
    for source_url in source_urls[:5]:
        parsed = urllib.parse.urlparse(source_url)
        if parsed.scheme not in {"http", "https"}:
            continue
        try:
            response = requests.get(source_url, headers=_SOURCE_HEADERS, timeout=(5, 10))
            content_type = (response.headers.get("Content-Type") or "").lower()
            if response.status_code != 200 or "html" not in content_type:
                continue
            parser = _ProductMetadataParser()
            parser.feed(response.text)
            image_url = _clean_source_text(parser.meta.get("og:image") or parser.meta.get("twitter:image"))
            if image_url:
                return urllib.parse.urljoin(source_url, image_url)
        except requests.RequestException as exc:
            logger.info("Could not fetch grounded page image from %s: %s", source_url, exc)
    return ""


def _catalog_item(identity: dict, barcode: str, enrichment: Optional[dict] = None) -> MasterCatalogItem:
    enrichment = enrichment or {}
    def number(name: str) -> float:
        try:
            return float(enrichment.get(name) or 0.0)
        except (TypeError, ValueError):
            return 0.0

    def to_str(val) -> Optional[str]:
        if val is None:
            return None
        if isinstance(val, (int, float)):
            if isinstance(val, int) or val.is_integer():
                return str(int(val))
            return str(val)
        ret = str(val).strip()
        return ret if ret else None

    image_url = _download_and_cache_product_image(identity.get("image_url") or enrichment.get("image_url"), barcode)
    return MasterCatalogItem(
        name=identity["name"], brand=to_str(identity.get("brand") or enrichment.get("brand")), barcode=barcode,
        sku_code=to_str(enrichment.get("sku_code")), product_code=to_str(enrichment.get("product_code")), hsn_code=to_str(enrichment.get("hsn_code")), plu_no=to_str(enrichment.get("plu_no")),
        cost_price=number("cost_price"), mrp=number("mrp"), sale_price=number("sale_price"), wholesale_price=number("wholesale_price"), special_price=number("special_price"), online_price=number("online_price"),
        weight=to_str(identity.get("weight") or enrichment.get("weight")), quantity=number("quantity") or 1.0, expired_quantity=0.0, near_expiry_quantity=0.0,
        tax=number("tax"), type=to_str(enrichment.get("type")), cess=number("cess"), cess_on=number("cess_on"), cess_type=to_str(enrichment.get("cess_type")), tax_amount=number("tax_amount"), taxable_value=number("taxable_value"), cess_tax_amount=number("cess_tax_amount"), additional_cess_tax_amount=number("additional_cess_tax_amount"),
        supplier=to_str(enrichment.get("supplier")), discount_rs=number("discount_rs"), discount_percent=number("discount_percent"), actual_margin_rs=number("actual_margin_rs"), margin_on_cp=number("margin_on_cp"), margin_on_sp=number("margin_on_sp"),
        category=to_str(enrichment.get("category") or identity.get("category")), sub_category=to_str(enrichment.get("sub_category")), instock_value=0.0,
        image_url=image_url, short_description=to_str(enrichment.get("short_description") or identity.get("description")), specifications=to_str(enrichment.get("specifications")), source="AI_WEB_SEARCH",
    )


def _call_enrichment_ai(provider: str, identity: dict, barcode: str, context: str) -> dict:
    """Ask an LLM for enrichment only; identity values are never accepted."""
    prompt = (
        "Enrich this already-resolved product. Do not change or infer its identity. "
        f"Barcode: {barcode}; Name: {identity['name']}; Brand: {identity.get('brand') or ''}.\n"
        "Return one JSON object containing only: short_description, specifications, category, sub_category, weight, mrp, sale_price, online_price, cost_price, tax, hsn_code. "
        "Use 0 or null when unavailable. Do not include name, brand, barcode, image_url, or any identity field.\n"
        f"Source context:\n{context[:6000]}"
    )
    try:
        if provider == "gemini" and _is_valid_key(settings.gemini_api_key):
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.gemini_api_key}"
            response = requests.post(url, json={"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"responseMimeType": "application/json"}}, timeout=60)
            text = response.json()["candidates"][0]["content"]["parts"][0]["text"] if response.status_code == 200 else "{}"
        elif provider == "openai" and _is_valid_key(settings.openai_api_key):
            response = requests.post("https://api.openai.com/v1/chat/completions", headers={"Authorization": f"Bearer {settings.openai_api_key}", "Content-Type": "application/json"}, json={"model": settings.openai_model or "gpt-4o", "messages": [{"role": "user", "content": prompt}], "response_format": {"type": "json_object"}}, timeout=60)
            text = response.json()["choices"][0]["message"]["content"] if response.status_code == 200 else "{}"
        elif provider == "claude" and _is_valid_key(settings.anthropic_api_key):
            response = requests.post(f"{settings.anthropic_base_url.rstrip('/')}/v1/messages", headers={"x-api-key": settings.anthropic_api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}, json={"model": settings.anthropic_model or "claude-3-5-sonnet-20241022", "max_tokens": 1500, "messages": [{"role": "user", "content": prompt}]}, timeout=60)
            text = next((block.get("text", "") for block in response.json().get("content", []) if block.get("type") == "text"), "{}") if response.status_code == 200 else "{}"
        else:
            return {}
        data = _extract_json_from_text(text)
        return data if isinstance(data, dict) else {}
    except Exception as exc:
        logger.warning("Product enrichment failed for %s: %s", barcode, exc)
        return {}


async def _perform_ai_rag_web_search(query_str: str, provider: str = "gemini") -> List[MasterCatalogItem]:
    """Source product identity first, then use AI only for safe enrichment."""
    query = query_str.strip()
    active_provider = _resolve_ai_provider(provider)
    if _is_barcode_query(query):
        consensus = _resolve_barcode_consensus(query)
        identity = consensus["identity"]
        if not identity:
            # Preserve the proven Gemini Google Search path for products that are
            # absent from public barcode registries.  It uses the original broad
            # retailer-search prompt and still passes image URLs through the
            # validated cache function defined in this module.
            if active_provider == "gemini":
                legacy_results = await _deprecated_perform_ai_rag_web_search(query, provider="gemini")
                if legacy_results:
                    logger.info("Resolved barcode %s through legacy Gemini Google Search grounding", query)
                    return legacy_results
            if active_provider == "gemini":
                identity = _resolve_barcode_with_gemini_web_search(query)
            elif active_provider == "claude":
                identity = _resolve_barcode_with_claude_web_search(query) or _resolve_barcode_with_gemini_web_search(query)
            else:
                # OpenAI has no server-side web-search tool in this integration;
                # prefer a configured grounded provider before returning a 404.
                identity = (
                    _resolve_barcode_with_gemini_web_search(query)
                    or _resolve_barcode_with_claude_web_search(query)
                )
            if identity:
                consensus = {
                    "confidence": 65, "source": identity["source"],
                    "resolved_by": "grounded_web_search", "candidates": [],
                }
            else:
                logger.warning("No safe product identity for barcode %s (%s)", query, consensus["resolved_by"])
                raise HTTPException(status_code=404, detail=f"Product with barcode {query} could not be confidently resolved from public registries or web-grounded search.")
        context = _fetch_web_search_context(query)
        enrichment = _call_enrichment_ai(active_provider, identity, query, context["text"])
        logger.info("Resolved barcode %s confidence=%s source=%s resolved_by=%s", query, consensus["confidence"], consensus["source"], consensus["resolved_by"])
        return [_catalog_item(identity, query, enrichment)]

    # Existing text-query capability is retained. It never claims a barcode unless
    # the provider supplies one; a barcode result will be revalidated on a later lookup.
    context = _fetch_web_search_context(query)
    identity = {"name": query, "brand": "", "description": "", "category": "", "weight": "", "image_url": context.get("image_url", "")}
    enrichment = _call_enrichment_ai(active_provider, identity, "", context["text"])
    proposed_name = _clean_source_text(enrichment.pop("name", ""))
    if proposed_name and not _is_meaningless_product_name(proposed_name, query):
        identity["name"] = proposed_name
    identity["brand"] = _clean_source_text(enrichment.pop("brand", ""))
    return [_catalog_item(identity, _clean_source_text(enrichment.pop("barcode", "")) or None, enrichment)] if identity["name"] else []


@router.get("/suggestions", response_model=List[str])
async def get_search_suggestions(
    db: Annotated[AsyncSession, Depends(get_db)],
    query: str = Query(..., min_length=1)
):
    """Returns rapid search suggestions combining local Master DB and DuckDuckGo autocomplete."""
    local_matches = []
    clean_query = query.strip()
    try:
        # Check if the query is a barcode (digits)
        if clean_query.isdigit() and len(clean_query) >= 3:
            stmt = select(MasterCatalogProduct.name).where(
                MasterCatalogProduct.barcode == clean_query
            ).limit(5)
            db_res = await db.execute(stmt)
            local_matches = list(db_res.scalars().all())
            if not local_matches:
                stmt = select(MasterCatalogProduct.name).where(
                    MasterCatalogProduct.barcode.like(f"{clean_query}%")
                ).limit(5)
                db_res = await db.execute(stmt)
                local_matches = list(db_res.scalars().all())
        else:
            # Prefix search on Name or Brand to hit B-Tree index (no leading wildcard f"%{query}%")
            stmt = select(MasterCatalogProduct.name).where(
                MasterCatalogProduct.name.ilike(f"{clean_query}%") | 
                MasterCatalogProduct.brand.ilike(f"{clean_query}%")
            ).limit(5)
        db_res = await db.execute(stmt)
        local_matches = list(db_res.scalars().all())
    except Exception as e:
        logger.error(f"Failed to fetch local suggestions: {e}")

    ddg_matches = []
    import requests as _req
    try:
        # Fetch auto-suggestions from DuckDuckGo autocomplete service
        url = f"https://ac.duckduckgo.com/ac/?q={clean_query}&type=list"
        res = _req.get(url, timeout=3)
        if res.status_code == 200:
            data = res.json()
            if isinstance(data, list) and len(data) > 1:
                ddg_matches = data[1]
    except Exception as e:
        logger.error(f"Failed to fetch DuckDuckGo suggestions: {e}")

    # Merge maintaining uniqueness
    seen = set()
    results = []
    for item in local_matches + ddg_matches:
        cleaned = item.strip()
        cleaned_lower = cleaned.lower()
        if cleaned_lower not in seen and len(cleaned) > 1:
            seen.add(cleaned_lower)
            results.append(cleaned)
            
    return results[:10]


@router.get("/search", response_model=List[MasterCatalogItem])
async def search_master_catalog(
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    query: str = Query(..., min_length=1),
    search_web: bool = Query(False),
    provider: str | None = Query(None)
):
    """Searches Master Catalog DB first, and falls back or combines with AI Web RAG search."""
    results: List[MasterCatalogItem] = []
    effective_provider = _resolve_ai_provider(provider)
    clean_query = query.strip()

    # 1. Search local Master Catalog DB with optimized index-friendly strategy
    db_products = []
    
    # If the search query looks like a barcode (only digits and length >= 4)
    if clean_query.isdigit() and len(clean_query) >= 4:
        db_query = select(MasterCatalogProduct).where(
            MasterCatalogProduct.barcode == clean_query
        ).limit(30)
        db_res = await db.execute(db_query)
        db_products = db_res.scalars().all()
        if not db_products:
            db_query = select(MasterCatalogProduct).where(
                MasterCatalogProduct.barcode.like(f"{clean_query}%")
            ).limit(30)
            db_res = await db.execute(db_query)
            db_products = db_res.scalars().all()
    else:
        # Standard text query: split search words
        words = [w.strip() for w in clean_query.split() if w.strip()]
        if words:
            conditions = []
            for w in words:
                # If a word is short (<= 3 chars), do prefix matching ONLY to hit b-tree index
                if len(w) <= 3:
                    like_term = f"{w}%"
                    conditions.append(
                        MasterCatalogProduct.name.ilike(like_term) |
                        MasterCatalogProduct.brand.ilike(like_term)
                    )
                else:
                    # Longer words: standard wildcard match
                    like_term = f"%{w}%"
                    conditions.append(
                        MasterCatalogProduct.name.ilike(like_term) |
                        MasterCatalogProduct.brand.ilike(like_term) |
                        MasterCatalogProduct.barcode.ilike(like_term) |
                        MasterCatalogProduct.sku_code.ilike(like_term) |
                        MasterCatalogProduct.product_code.ilike(like_term)
                    )
            from sqlalchemy import and_
            db_query = select(MasterCatalogProduct).where(and_(*conditions)).limit(30)
            db_res = await db.execute(db_query)
            db_products = db_res.scalars().all()

    # Map database records to response items
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
            source=p.source or "MASTER_DB",
            ai_search_done=p.ai_search_done,
            rag_status=p.rag_status,
            rag_enriched_at=p.rag_enriched_at,
            rag_error=p.rag_error
        ))

    # 2. Trigger AI Web RAG Search only if:
    # - Local DB search returned NO matches
    # - AND search_web is requested and active AI key is configured
    # - AND global AI enrichment is NOT paused
    import os
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    pause_file = os.path.join(backend_dir, ".rag_enricher_paused")
    ai_paused = os.path.exists(pause_file)

    if not results and search_web and not ai_paused and (settings.gemini_api_key or settings.openai_api_key or settings.anthropic_api_key):
        ai_items = await _perform_ai_rag_web_search(clean_query, provider=effective_provider)
        results.extend(ai_items)
        
    # Prepend request base URL to static image paths so they load on localhost/production
    base_url = str(request.base_url).rstrip("/")
    for item in results:
        if item.image_url and item.image_url.startswith("/images/"):
            item.image_url = f"{base_url}{item.image_url}"
            
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

    # 4. Determine Barcode (fallback to SKU if SKU is a numeric barcode)
    product_barcode = payload.barcode
    if not product_barcode and sku and sku.strip().isdigit() and len(sku.strip()) in [8, 12, 13, 14]:
        product_barcode = sku.strip()

    # 5. Create Product in erp_products
    new_product = Product(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        name=payload.name,
        sku=sku,
        barcode=product_barcode,
        brand_id=brand_id,
        category_id=category_id,
        short_description=payload.short_description,
        long_description=payload.specifications,
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
    
    # Cache in global master catalog if we have a valid barcode and doesn't exist yet
    if product_barcode and product_barcode.strip():
        clean_barcode = product_barcode.strip()
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
                specifications=payload.specifications or "Imported from tenant inventory creation",
                source="AI_WEB_SEARCH"
            )
            db.add(new_mc)
            
    await db.commit()
    await db.refresh(new_product, ["category", "brand", "uom"])
    
    return new_product


from pydantic import BaseModel

class RAGEnrichTriggerRequest(BaseModel):
    product_ids: Optional[list[uuid.UUID]] = None
    enrich_all: bool = False


@router.post("/enrich/trigger", status_code=status.HTTP_200_OK)
async def trigger_rag_enrichment(
    payload: RAGEnrichTriggerRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("edit:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Enqueues products for RAG enrichment by resetting their ai_search_done status to False."""
    from src.models.inventory import MasterCatalogProduct
    from sqlalchemy import update
    
    if payload.enrich_all:
        stmt = (
            update(MasterCatalogProduct)
            .values(ai_search_done=False, rag_status="pending")
            .where(MasterCatalogProduct.barcode != None)
        )
        await db.execute(stmt)
        await db.commit()
        return {"message": "All catalog products enqueued for RAG enrichment."}
        
    if payload.product_ids:
        stmt = (
            update(MasterCatalogProduct)
            .values(ai_search_done=False, rag_status="pending")
            .where(MasterCatalogProduct.id.in_(payload.product_ids))
        )
        await db.execute(stmt)
        await db.commit()
        return {"message": f"{len(payload.product_ids)} catalog products enqueued for RAG enrichment."}
        
    raise HTTPException(status_code=400, detail="Must provide either product_ids or enrich_all=true")


@router.post("/enrich/pause", status_code=status.HTTP_200_OK)
async def pause_rag_enrichment(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos"))]
):
    """Pauses RAG enrichment worker by creating .rag_enricher_paused file."""
    import os
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    pause_file = os.path.join(backend_dir, ".rag_enricher_paused")
    with open(pause_file, "w") as f:
        f.write("paused")
    return {"message": "RAG Enrichment paused successfully."}


@router.post("/enrich/resume", status_code=status.HTTP_200_OK)
async def resume_rag_enrichment(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos"))]
):
    """Resumes RAG enrichment worker by removing .rag_enricher_paused file."""
    import os
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    pause_file = os.path.join(backend_dir, ".rag_enricher_paused")
    if os.path.exists(pause_file):
        os.remove(pause_file)
    return {"message": "RAG Enrichment resumed successfully."}


@router.get("/enrich/status")
async def get_rag_enrichment_status(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Returns real-time progress statistics for the background RAG enricher pipeline."""
    from src.models.inventory import MasterCatalogProduct
    from sqlalchemy import select, func
    import os
    
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    pause_file = os.path.join(backend_dir, ".rag_enricher_paused")
    is_paused = os.path.exists(pause_file)
    
    total_stmt = select(func.count()).select_from(MasterCatalogProduct).where(MasterCatalogProduct.barcode != None)
    pending_stmt = select(func.count()).select_from(MasterCatalogProduct).where(
        (MasterCatalogProduct.ai_search_done == False) & 
        (MasterCatalogProduct.barcode != None) & 
        (MasterCatalogProduct.rag_status != "processing")
    )
    processing_stmt = select(func.count()).select_from(MasterCatalogProduct).where(
        (MasterCatalogProduct.rag_status == "processing") & 
        (MasterCatalogProduct.barcode != None)
    )
    completed_stmt = select(func.count()).select_from(MasterCatalogProduct).where(
        (MasterCatalogProduct.ai_search_done == True) & 
        (MasterCatalogProduct.barcode != None)
    )
    failed_stmt = select(func.count()).select_from(MasterCatalogProduct).where(
        (MasterCatalogProduct.rag_status == "failed") & 
        (MasterCatalogProduct.barcode != None)
    )
    
    total = await db.scalar(total_stmt) or 0
    pending = await db.scalar(pending_stmt) or 0
    processing = await db.scalar(processing_stmt) or 0
    completed = await db.scalar(completed_stmt) or 0
    failed = await db.scalar(failed_stmt) or 0
    
    return {
        "total": total,
        "pending": pending,
        "processing": processing,
        "completed": completed,
        "failed": failed,
        "paused": is_paused
    }


class AdminCatalogListResponse(BaseModel):
    items: list[MasterCatalogItem]
    total: int
    page: int
    page_size: int


@router.get("/admin/list", response_model=AdminCatalogListResponse)
async def get_admin_master_catalog_list(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    rag_status: Optional[str] = None
):
    """Returns paginated and filtered global master catalog products for admin view."""
    from src.models.inventory import MasterCatalogProduct
    from sqlalchemy import select, func, and_
    
    offset = (page - 1) * page_size
    
    query_stmt = select(MasterCatalogProduct)
    count_stmt = select(func.count()).select_from(MasterCatalogProduct)
    
    conditions = []
    if search:
        search_words = [w.strip() for w in search.strip().split() if w.strip()]
        for w in search_words:
            like = f"%{w}%"
            conditions.append(
                MasterCatalogProduct.name.ilike(like) |
                MasterCatalogProduct.barcode.ilike(like) |
                MasterCatalogProduct.brand.ilike(like) |
                MasterCatalogProduct.sku_code.ilike(like) |
                MasterCatalogProduct.product_code.ilike(like)
            )
            
    if rag_status:
        if rag_status == "enriched":
            conditions.append(MasterCatalogProduct.ai_search_done == True)
        elif rag_status == "pending":
            conditions.append((MasterCatalogProduct.ai_search_done == False) & (MasterCatalogProduct.rag_status != "processing"))
        elif rag_status == "processing":
            conditions.append(MasterCatalogProduct.rag_status == "processing")
        elif rag_status == "failed":
            conditions.append(MasterCatalogProduct.rag_status == "failed")
            
    if conditions:
        query_stmt = query_stmt.where(and_(*conditions))
        count_stmt = count_stmt.where(and_(*conditions))
        
    total = await db.scalar(count_stmt) or 0
    
    query_stmt = query_stmt.order_by(MasterCatalogProduct.created_at.desc()).offset(offset).limit(page_size)
    db_res = await db.execute(query_stmt)
    products = db_res.scalars().all()
    
    serialized_items = []
    for p in products:
        serialized_items.append(MasterCatalogItem(
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
            source=p.source or "MASTER_DB",
            ai_search_done=p.ai_search_done,
            rag_status=p.rag_status,
            rag_enriched_at=p.rag_enriched_at,
            rag_error=p.rag_error
        ))
        
    return {
        "items": serialized_items,
        "total": total,
        "page": page,
        "page_size": page_size
    }
