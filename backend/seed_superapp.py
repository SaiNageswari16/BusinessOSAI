import asyncio
import logging
from sqlalchemy import select
from src.database.session import AsyncSessionLocal
from src.models import Tenant
from src.models.inventory import ProductCategory, Product
from src.models import EntityStatus

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed")

async def seed_superapp():
    async with AsyncSessionLocal() as db:
        # 1. Get or create a default tenant
        tenant_query = await db.execute(select(Tenant).limit(1))
        tenant = tenant_query.scalars().first()
        if not tenant:
            logger.info("Creating default tenant...")
            tenant = Tenant(
                name="OSAI Marketplace",
                schema_name="osai_marketplace",
                subdomain="marketplace",
                settings={}
            )
            db.add(tenant)
            await db.commit()
            await db.refresh(tenant)
        
        logger.info(f"Using Tenant: {tenant.name} ({tenant.id})")

        # 2. Define categories
        categories_data = [
            "Grocery",
            "Fashion",
            "Electronics",
            "Travel & Booking",
            "Food & Dining"
        ]
        
        cat_map = {}
        for c_name in categories_data:
            cat_query = await db.execute(select(ProductCategory).where(ProductCategory.name == c_name, ProductCategory.tenant_id == tenant.id))
            cat = cat_query.scalars().first()
            if not cat:
                cat = ProductCategory(
                    name=c_name,
                    category_code=c_name.upper().replace(" ", "_").replace("&", "AND"),
                    tenant_id=tenant.id
                )
                db.add(cat)
                await db.commit()
                await db.refresh(cat)
            cat_map[c_name] = cat.id

        # 3. Define mock products
        products_data = [
            # Grocery
            {"name": "Organic Bananas (1 Dozen)", "category": "Grocery", "sku": "GRO-001", "mrp": 5.00, "price": 4.50, "image": "https://images.unsplash.com/photo-1528825871115-3581a5387919?w=500&auto=format"},
            {"name": "Whole Milk 1 Gallon", "category": "Grocery", "sku": "GRO-002", "mrp": 4.00, "price": 3.80, "image": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format"},
            {"name": "Fresh Avocados (Pack of 4)", "category": "Grocery", "sku": "GRO-003", "mrp": 6.50, "price": 5.99, "image": "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=500&auto=format"},
            {"name": "Artisan Sourdough Bread", "category": "Grocery", "sku": "GRO-004", "mrp": 7.00, "price": 6.00, "image": "https://images.unsplash.com/photo-1585478259715-876acc5be8eb?w=500&auto=format"},
            {"name": "Free Range Eggs (Dozen)", "category": "Grocery", "sku": "GRO-005", "mrp": 4.50, "price": 4.00, "image": "https://images.unsplash.com/photo-1506976773554-1b4d0eb01931?w=500&auto=format"},
            
            # Fashion
            {"name": "Men's Classic White Sneaker", "category": "Fashion", "sku": "FSH-001", "mrp": 89.99, "price": 75.00, "image": "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500&auto=format"},
            {"name": "Women's Summer Floral Dress", "category": "Fashion", "sku": "FSH-002", "mrp": 120.00, "price": 95.00, "image": "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=500&auto=format"},
            {"name": "Luxury Leather Watch", "category": "Fashion", "sku": "FSH-003", "mrp": 250.00, "price": 199.99, "image": "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=500&auto=format"},
            {"name": "Designer Sunglasses", "category": "Fashion", "sku": "FSH-004", "mrp": 150.00, "price": 110.00, "image": "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=500&auto=format"},
            {"name": "Denim Jacket Vintage", "category": "Fashion", "sku": "FSH-005", "mrp": 140.00, "price": 89.99, "image": "https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=500&auto=format"},
            
            # Electronics
            {"name": "Pro Wireless Noise-Cancelling Headphones", "category": "Electronics", "sku": "ELE-001", "mrp": 349.00, "price": 299.00, "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format"},
            {"name": "4K Ultra HD Smart TV 55-inch", "category": "Electronics", "sku": "ELE-002", "mrp": 799.00, "price": 649.00, "image": "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=500&auto=format"},
            {"name": "Gaming Laptop 16GB RAM RTX 4060", "category": "Electronics", "sku": "ELE-003", "mrp": 1299.00, "price": 1150.00, "image": "https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=500&auto=format"},
            {"name": "Smart Watch Series 8", "category": "Electronics", "sku": "ELE-004", "mrp": 399.00, "price": 349.00, "image": "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500&auto=format"},
            {"name": "Wireless Charging Pad", "category": "Electronics", "sku": "ELE-005", "mrp": 45.00, "price": 29.99, "image": "https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=500&auto=format"},
            
            # Travel & Booking
            {"name": "5-Star Hotel Stay (Downtown Dubai)", "category": "Travel & Booking", "sku": "TRV-001", "mrp": 600.00, "price": 450.00, "image": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=500&auto=format"},
            {"name": "Roundtrip Flight (JFK to LHR)", "category": "Travel & Booking", "sku": "TRV-002", "mrp": 1200.00, "price": 950.00, "image": "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=500&auto=format"},
            {"name": "Luxury Yacht Rental (4 Hours)", "category": "Travel & Booking", "sku": "TRV-003", "mrp": 800.00, "price": 700.00, "image": "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=500&auto=format"},
            
            # Food & Dining
            {"name": "Gourmet Sushi Platter (For 2)", "category": "Food & Dining", "sku": "FOD-001", "mrp": 65.00, "price": 55.00, "image": "https://images.unsplash.com/photo-1553621042-f6e147245754?w=500&auto=format"},
            {"name": "Wagyu Beef Burger Combo", "category": "Food & Dining", "sku": "FOD-002", "mrp": 28.00, "price": 22.50, "image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format"},
            {"name": "Italian Truffle Pasta", "category": "Food & Dining", "sku": "FOD-003", "mrp": 35.00, "price": 28.00, "image": "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=500&auto=format"}
        ]

        # 4. Insert Products
        for p_data in products_data:
            cat_id = cat_map[p_data["category"]]
            # Check if exists
            p_query = await db.execute(select(Product).where(Product.sku == p_data["sku"], Product.tenant_id == tenant.id))
            prod = p_query.scalars().first()
            if not prod:
                prod = Product(
                    name=p_data["name"],
                    sku=p_data["sku"],
                    category_id=cat_id,
                    mrp=p_data["mrp"],
                    selling_price=p_data["price"],
                    image_url=p_data["image"],
                    tenant_id=tenant.id,
                    status=EntityStatus.ACTIVE,
                    supplier="OSAI First-Party",
                    short_description=f"Premium {p_data['category']} item."
                )
                db.add(prod)
                logger.info(f"Adding product: {p_data['name']}")
            else:
                # Update image
                prod.image_url = p_data["image"]
                prod.selling_price = p_data["price"]
                prod.name = p_data["name"]
                prod.category_id = cat_id

        await db.commit()
        logger.info("Database successfully seeded with Super App mock data!")

if __name__ == "__main__":
    asyncio.run(seed_superapp())
