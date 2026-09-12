import asyncio
import uuid
import re
from sqlalchemy import select, update, delete, text
from src.database.session import AsyncSessionLocal
from src.models import (
    Tenant, Company, ProductCategory, Product, Brand, UnitOfMeasure, EntityStatus
)

CLEAN_CATEGORIES = [
    {
        "code": "CAT-PRODUCE",
        "name": "Fresh Fruits & Vegetables",
        "description": "Farm-fresh organic fruits, crisp leafy greens, roots & seasonal herbs",
        "image_url": "/organic/images/category-thumb-1.jpg"
    },
    {
        "code": "CAT-DAIRY",
        "name": "Dairy, Eggs & Bakery",
        "description": "Artisan stoneground breads, farm butter, organic milk, free-range eggs & cheeses",
        "image_url": "/organic/images/category-thumb-6.jpg"
    },
    {
        "code": "CAT-BEVERAGE",
        "name": "Beverages & Fresh Juices",
        "description": "Cold-pressed juices, organic kombucha, artisanal teas, roasted beans & coconut water",
        "image_url": "/organic/images/category-thumb-3.jpg"
    },
    {
        "code": "CAT-STAPLES",
        "name": "Organic Grains & Staples",
        "description": "Organic basmati rice, ancient grains, stone-ground flour, pulses & cold-pressed oils",
        "image_url": "/organic/images/category-thumb-2.jpg"
    },
    {
        "code": "CAT-SNACKS",
        "name": "Snacks & Packaged Foods",
        "description": "Roasted nuts, dried fruits, organic dark chocolate, baked crackers & pantry treats",
        "image_url": "/organic/images/category-thumb-5.jpg"
    },
    {
        "code": "CAT-MEAT",
        "name": "Meat, Poultry & Seafood",
        "description": "Pasture-raised poultry, free-range chicken, grass-fed cuts & wild salmon",
        "image_url": "/organic/images/category-thumb-4.jpg"
    },
    {
        "code": "CAT-WELLNESS",
        "name": "Health, Wellness & Beauty",
        "description": "Herbal wellness teas, plant supplements, cold-pressed serums & natural body care",
        "image_url": "/organic/images/category-thumb-7.jpg"
    },
    {
        "code": "CAT-HOME",
        "name": "Household & Eco Living",
        "description": "Plant-based eco cleaners, reusable beeswax wraps, natural home & kitchen essentials",
        "image_url": "/organic/images/category-thumb-8.jpg"
    }
]

SAMPLE_REAL_PRODUCTS = [
    # Fresh Produce
    {
        "name": "Fresh Organic Hass Avocados (Pack of 4)",
        "sku": "ORG-AVO-001",
        "category_code": "CAT-PRODUCE",
        "mrp": 280.0,
        "selling_price": 239.0,
        "stock": 45,
        "image_url": "/organic/images/product-thumb-1.png",
        "short_description": "Creamy, nutrient-dense ripe Hass avocados handpicked from certified organic orchards.",
        "brand_name": "LazyMonkey Farms",
        "unit": "4 pcs"
    },
    {
        "name": "Crisp Farm-Grown Green Seedless Grapes (500g)",
        "sku": "ORG-GRP-002",
        "category_code": "CAT-PRODUCE",
        "mrp": 190.0,
        "selling_price": 149.0,
        "stock": 60,
        "image_url": "/organic/images/product-thumb-2.png",
        "short_description": "Sweet, crisp organic green table grapes packed with antioxidants and vitamin C.",
        "brand_name": "LazyMonkey Farms",
        "unit": "500g"
    },
    {
        "name": "Sweet Baby Bell Peppers Trio (300g)",
        "sku": "ORG-PEP-003",
        "category_code": "CAT-PRODUCE",
        "mrp": 150.0,
        "selling_price": 120.0,
        "stock": 35,
        "image_url": "/organic/images/product-thumb-3.png",
        "short_description": "Vibrant tri-color organic sweet bell peppers harvested directly at peak sweetness.",
        "brand_name": "LazyMonkey Farms",
        "unit": "300g"
    },
    {
        "name": "Organic Roma Plum Tomatoes (1kg)",
        "sku": "ORG-TOM-004",
        "category_code": "CAT-PRODUCE",
        "mrp": 95.0,
        "selling_price": 75.0,
        "stock": 80,
        "image_url": "/organic/images/product-thumb-4.png",
        "short_description": "Vine-ripened organic Roma tomatoes with thick juicy flesh perfect for salads and cooking.",
        "brand_name": "LazyMonkey Farms",
        "unit": "1 kg"
    },
    # Dairy & Bakery
    {
        "name": "Artisan Stone-Ground Sourdough Bread (450g)",
        "sku": "ORG-BRD-005",
        "category_code": "CAT-DAIRY",
        "mrp": 180.0,
        "selling_price": 145.0,
        "stock": 25,
        "image_url": "/organic/images/product-thumb-5.png",
        "short_description": "Naturally fermented 36-hour sourdough loaf baked with stoneground whole wheat flour.",
        "brand_name": "Artisan Bakery Co",
        "unit": "450g"
    },
    {
        "name": "Farm Fresh A2 Organic Whole Milk (1 Litre)",
        "sku": "ORG-MLK-006",
        "category_code": "CAT-DAIRY",
        "mrp": 110.0,
        "selling_price": 95.0,
        "stock": 50,
        "image_url": "/organic/images/product-thumb-6.png",
        "short_description": "Pure unadulterated Gir cow A2 milk, gently pasteurized and chilled within 2 hours of milking.",
        "brand_name": "Amul Organic",
        "unit": "1 L"
    },
    {
        "name": "Free-Range Pasture Brown Eggs (Pack of 12)",
        "sku": "ORG-EGG-007",
        "category_code": "CAT-DAIRY",
        "mrp": 195.0,
        "selling_price": 165.0,
        "stock": 40,
        "image_url": "/organic/images/product-thumb-7.png",
        "short_description": "Omega-3 enriched golden yolk eggs laid by freely roaming pasture-fed hens.",
        "brand_name": "LazyMonkey Farms",
        "unit": "12 pcs"
    },
    # Beverages
    {
        "name": "Cold-Pressed Raw Orange & Ginger Juice (350ml)",
        "sku": "ORG-JUC-008",
        "category_code": "CAT-BEVERAGE",
        "mrp": 160.0,
        "selling_price": 129.0,
        "stock": 30,
        "image_url": "/organic/images/product-thumb-8.png",
        "short_description": "100% pure Valencia oranges cold-pressed with a zesty kick of wild ginger root. No added sugar.",
        "brand_name": "PurePressed",
        "unit": "350ml"
    },
    {
        "name": "Organic Darjeeling First Flush Green Tea (100g)",
        "sku": "ORG-TEA-009",
        "category_code": "CAT-BEVERAGE",
        "mrp": 450.0,
        "selling_price": 380.0,
        "stock": 20,
        "image_url": "/organic/images/product-thumb-9.png",
        "short_description": "Hand-plucked tender green tea leaves from single-estate Darjeeling hills.",
        "brand_name": "Tata Tea Artisanal",
        "unit": "100g"
    },
    # Staples & Grains
    {
        "name": "Traditional Aged Organic Basmati Rice (5kg)",
        "sku": "ORG-RIC-010",
        "category_code": "CAT-STAPLES",
        "mrp": 650.0,
        "selling_price": 549.0,
        "stock": 35,
        "image_url": "/organic/images/product-thumb-10.png",
        "short_description": "2-year Himalayan snow-fed aged extra long basmati rice with exquisite aroma and fluffy texture.",
        "brand_name": "Aashirvaad Select",
        "unit": "5 kg"
    },
    {
        "name": "Cold-Pressed Organic Extra Virgin Mustard Oil (1L)",
        "sku": "ORG-OIL-011",
        "category_code": "CAT-STAPLES",
        "mrp": 290.0,
        "selling_price": 245.0,
        "stock": 40,
        "image_url": "/organic/images/product-thumb-11.png",
        "short_description": "Wood-churned kachi ghani unrefined mustard oil preserving natural pungent aroma and health benefits.",
        "brand_name": "LazyMonkey Organics",
        "unit": "1 L"
    },
    # Snacks & Packaged
    {
        "name": "Roasted California Almonds & Cranberry Trail Mix (250g)",
        "sku": "ORG-SNK-012",
        "category_code": "CAT-SNACKS",
        "mrp": 399.0,
        "selling_price": 329.0,
        "stock": 55,
        "image_url": "/organic/images/product-thumb-12.png",
        "short_description": "Gently dry roasted nonpareil almonds blended with tart dried cranberries and pumpkin seeds.",
        "brand_name": "LazyMonkey Snacks",
        "unit": "250g"
    },
    {
        "name": "70% Single Origin Dark Chocolate Bar (80g)",
        "sku": "ORG-CHO-013",
        "category_code": "CAT-SNACKS",
        "mrp": 220.0,
        "selling_price": 185.0,
        "stock": 45,
        "image_url": "/organic/images/product-thumb-1.png",
        "short_description": "Bean-to-bar artisanal dark chocolate made with organic Idukki cocoa beans and raw cane sugar.",
        "brand_name": "Nestle Artisanal",
        "unit": "80g"
    },
    # Meat & Seafood
    {
        "name": "Fresh Country Chicken Curry Cut (500g)",
        "sku": "ORG-MET-014",
        "category_code": "CAT-MEAT",
        "mrp": 320.0,
        "selling_price": 275.0,
        "stock": 25,
        "image_url": "/organic/images/product-thumb-2.png",
        "short_description": "Antibiotic-free, hormone-free pasture raised chicken curry cut with skin off.",
        "brand_name": "LazyMonkey Fresh",
        "unit": "500g"
    },
    # Wellness & Beauty
    {
        "name": "Raw Wild Forest Multi-Flora Honey (500g)",
        "sku": "ORG-HNY-015",
        "category_code": "CAT-WELLNESS",
        "mrp": 480.0,
        "selling_price": 399.0,
        "stock": 30,
        "image_url": "/organic/images/product-thumb-3.png",
        "short_description": "Unheated, unfiltered wild forest honey collected by tribal beekeepers in Western Ghats.",
        "brand_name": "LazyMonkey Wellness",
        "unit": "500g"
    },
    # Household
    {
        "name": "Eco-Friendly Citrus Kitchen Dish Wash Gel (500ml)",
        "sku": "ORG-HOM-016",
        "category_code": "CAT-HOME",
        "mrp": 199.0,
        "selling_price": 160.0,
        "stock": 40,
        "image_url": "/organic/images/product-thumb-4.png",
        "short_description": "Biodegradable, plant-based dishwash gel powered by natural lemon peel bio-enzymes.",
        "brand_name": "LazyMonkey Eco",
        "unit": "500ml"
    }
]

async def clean_and_seed():
    async with AsyncSessionLocal() as db:
        print("[INFO] Starting Category & Store Data cleanup...")

        # 1. Get primary tenant & company
        tenant = (await db.execute(select(Tenant).limit(1))).scalar_one_or_none()
        if not tenant:
            print("[ERROR] No tenant found.")
            return
        
        tenant_id = tenant.id
        company = (await db.execute(select(Company).where(Company.tenant_id == tenant_id).limit(1))).scalar_one_or_none()
        company_id = company.id if company else None

        # 2. Upsert the 8 standard categories
        cat_map = {}
        for cdef in CLEAN_CATEGORIES:
            existing_cat = (await db.execute(
                select(ProductCategory).where(
                    (ProductCategory.category_code == cdef["code"]) | 
                    (ProductCategory.name.ilike(cdef["name"]))
                )
            )).scalar_one_or_none()

            if existing_cat:
                existing_cat.name = cdef["name"]
                existing_cat.category_code = cdef["code"]
                existing_cat.description = cdef["description"]
                existing_cat.image_url = cdef["image_url"]
                existing_cat.status = EntityStatus.ACTIVE
                cat_map[cdef["code"]] = existing_cat.id
            else:
                new_cat = ProductCategory(
                    tenant_id=tenant_id,
                    company_id=company_id,
                    name=cdef["name"],
                    category_code=cdef["code"],
                    description=cdef["description"],
                    image_url=cdef["image_url"],
                    status=EntityStatus.ACTIVE
                )
                db.add(new_cat)
                await db.flush()
                cat_map[cdef["code"]] = new_cat.id

        await db.commit()
        print(f"[OK] Upserted {len(cat_map)} clean master categories.")

        # 3. Clean up and map existing products to clean categories
        all_products = (await db.execute(select(Product))).scalars().all()
        clean_name_regex = re.compile(r"[\?]+")

        for p in all_products:
            # Clean corrupt string names
            clean_name = clean_name_regex.sub("'", p.name).replace("??", "'")
            p.name = clean_name
            pname_lower = clean_name.lower()

            # Map to one of the 8 clean categories
            target_cat_code = "CAT-SNACKS"
            if any(k in pname_lower for k in ["fruit", "apple", "grape", "tomato", "pepper", "avocado", "corn", "vegetable"]):
                target_cat_code = "CAT-PRODUCE"
            elif any(k in pname_lower for k in ["milk", "egg", "butter", "cheese", "bread", "bakery", "pain", "biscuit", "cookie"]):
                target_cat_code = "CAT-DAIRY"
            elif any(k in pname_lower for k in ["tea", "coffee", "juice", "drink", "boisson", "yerba", "mate", "beverage", "whisky", "scotch", "ginger"]):
                target_cat_code = "CAT-BEVERAGE"
            elif any(k in pname_lower for k in ["rice", "grain", "atta", "wheat", "flour", "oil", "ghee", "dal", "pulses", "staple", "aashirvaad"]):
                target_cat_code = "CAT-STAPLES"
            elif any(k in pname_lower for k in ["chicken", "meat", "beef", "seafood", "fish", "strips"]):
                target_cat_code = "CAT-MEAT"
            elif any(k in pname_lower for k in ["dove", "colgate", "shampoo", "soap", "paste", "brush", "skin", "care", "wellness", "honey"]):
                target_cat_code = "CAT-WELLNESS"
            elif any(k in pname_lower for k in ["clean", "wash", "dish", "detergent", "eco", "home", "house"]):
                target_cat_code = "CAT-HOME"
            elif any(k in pname_lower for k in ["snack", "candy", "chocolate", "ketchup", "pasta", "sauce", "crisp", "boat", "samsung", "sony"]):
                target_cat_code = "CAT-SNACKS"

            p.category_id = cat_map.get(target_cat_code)
            if not p.image_url or "placeholder" in p.image_url:
                p.image_url = f"/organic/images/product-thumb-{(abs(hash(p.name)) % 12) + 1}.png"
            if not p.selling_price or p.selling_price <= 0:
                p.selling_price = p.mrp if (p.mrp and p.mrp > 0) else 150.0
            if not p.mrp or p.mrp <= 0:
                p.mrp = round(float(p.selling_price) * 1.2, 2)
            if not p.on_hand_stock or p.on_hand_stock <= 0:
                p.on_hand_stock = 50

        # 4. Remove corrupt / unwanted categories that are not in clean categories list
        valid_cat_ids = set(cat_map.values())
        all_db_cats = (await db.execute(select(ProductCategory))).scalars().all()
        for c in all_db_cats:
            if c.id not in valid_cat_ids:
                # Reassign any products before deleting
                await db.execute(
                    update(Product).where(Product.category_id == c.id).values(category_id=cat_map["CAT-SNACKS"])
                )
                await db.delete(c)

        await db.commit()
        print("[OK] Cleaned existing products and removed obsolete / corrupt categories.")

        # 5. Insert rich real sample products if missing
        for sp in SAMPLE_REAL_PRODUCTS:
            existing_p = (await db.execute(
                select(Product).where(Product.sku == sp["sku"])
            )).scalar_one_or_none()

            if not existing_p:
                new_p = Product(
                    tenant_id=tenant_id,
                    company_id=company_id,
                    name=sp["name"],
                    sku=sp["sku"],
                    category_id=cat_map.get(sp["category_code"]),
                    mrp=sp["mrp"],
                    selling_price=sp["selling_price"],
                    purchase_price=round(sp["selling_price"] * 0.7, 2),
                    initial_stock=sp["stock"],
                    on_hand_stock=sp["stock"],
                    image_url=sp["image_url"],
                    short_description=sp["short_description"],
                    specifications={"unit": sp["unit"], "organic_certified": True, "freshness": "Daily Farm Harvest"},
                    status=EntityStatus.ACTIVE,
                    is_tax_inclusive=True,
                    tax_percent=5.0
                )
                db.add(new_p)

        await db.commit()
        print(f"[OK] Successfully seeded {len(SAMPLE_REAL_PRODUCTS)} rich real products!")

if __name__ == "__main__":
    asyncio.run(clean_and_seed())
