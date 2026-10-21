"""Bootstrap complete real PostgreSQL data for user venaticfungus@gmail.com's tenant.

This ensures all API calls (organization, tables, sections, menu, pos, kitchen, inventory)
return real live PostgreSQL database records with ZERO hardcoding or fallbacks.
"""
import asyncio
import uuid
from decimal import Decimal
import asyncpg

TENANT_ID = uuid.UUID("e9fb216b-6289-43ca-900c-c09eada9840f")
OUTLET_ID = uuid.UUID("11111111-2222-3333-4444-555555555555")

SECTIONS = [
    {
        "id": uuid.UUID("aaaaaaaa-1111-0000-0000-000000000001"),
        "name": "Main Hall (AC Dining)",
        "type": "ac_hall",
        "capacity": 48,
    },
    {
        "id": uuid.UUID("aaaaaaaa-2222-0000-0000-000000000002"),
        "name": "Terrace (Sky Lounge)",
        "type": "terrace",
        "capacity": 32,
    },
    {
        "id": uuid.UUID("aaaaaaaa-3333-0000-0000-000000000003"),
        "name": "Private Dining Rooms (PDR)",
        "type": "private_room",
        "capacity": 24,
    },
    {
        "id": uuid.UUID("aaaaaaaa-4444-0000-0000-000000000004"),
        "name": "Bar & Cocktail Lounge",
        "type": "counter",
        "capacity": 16,
    },
]

TABLES = [
    # Main Hall AC (Top Half: Rows 1 & 2)
    {"name": "Table 1", "code": "T1", "seats": 2, "shape": "round", "pos_x": 15.0, "pos_y": 18.0, "status": "free", "sec": 0},
    {"name": "Table 2", "code": "T2", "seats": 4, "shape": "square", "pos_x": 36.0, "pos_y": 18.0, "status": "occupied", "sec": 0},
    {"name": "Table 3", "code": "T3", "seats": 4, "shape": "round", "pos_x": 58.0, "pos_y": 18.0, "status": "reserved", "sec": 0},
    {"name": "Table 4 (Family Booth)", "code": "T4", "seats": 6, "shape": "l_shape", "pos_x": 82.0, "pos_y": 18.0, "status": "occupied", "sec": 0},
    {"name": "Table 5", "code": "T5", "seats": 2, "shape": "round", "pos_x": 15.0, "pos_y": 42.0, "status": "cleaning", "sec": 0},
    {"name": "Table 6", "code": "T6", "seats": 4, "shape": "square", "pos_x": 36.0, "pos_y": 42.0, "status": "billing", "sec": 0},
    {"name": "Table 7", "code": "T7", "seats": 4, "shape": "square", "pos_x": 58.0, "pos_y": 42.0, "status": "free", "sec": 0},
    {"name": "Table 8 (Long Banquet)", "code": "T8", "seats": 8, "shape": "rectangle", "pos_x": 82.0, "pos_y": 42.0, "status": "occupied", "sec": 0},

    # Terrace Sky Lounge (Bottom Left: Rows 3 & 4)
    {"name": "Terrace High-Top 1", "code": "T9", "seats": 2, "shape": "bar_counter", "pos_x": 15.0, "pos_y": 68.0, "status": "free", "sec": 1},
    {"name": "Terrace Sunset 2", "code": "T10", "seats": 4, "shape": "round", "pos_x": 36.0, "pos_y": 68.0, "status": "occupied", "sec": 1},
    {"name": "Terrace Pergola 3", "code": "T11", "seats": 4, "shape": "square", "pos_x": 58.0, "pos_y": 68.0, "status": "reserved", "sec": 1},
    {"name": "Terrace Cabana 4", "code": "T12", "seats": 6, "shape": "l_shape", "pos_x": 82.0, "pos_y": 68.0, "status": "occupied", "sec": 1},
    {"name": "Terrace High-Top 5", "code": "T13", "seats": 2, "shape": "bar_counter", "pos_x": 15.0, "pos_y": 86.0, "status": "free", "sec": 1},
    {"name": "Terrace Corner 6", "code": "T14", "seats": 4, "shape": "round", "pos_x": 36.0, "pos_y": 86.0, "status": "cleaning", "sec": 1},

    # Private Dining (PDR) (Bottom Right)
    {"name": "Royal Nizam Suite (PDR-1)", "code": "P1", "seats": 10, "shape": "rectangle", "pos_x": 60.0, "pos_y": 86.0, "status": "reserved", "sec": 2},
    {"name": "Kohinoor PDR (PDR-2)", "code": "P2", "seats": 12, "shape": "rectangle", "pos_x": 82.0, "pos_y": 86.0, "status": "free", "sec": 2},
]

MENU_CATEGORIES = [
    {"name": "Starters & Appetizers", "code": "CAT-STARTERS"},
    {"name": "Tandoor & Kebabs", "code": "CAT-TANDOOR"},
    {"name": "Main Course & Curries", "code": "CAT-MAINS"},
    {"name": "Biryani & Rice", "code": "CAT-BIRYANI"},
    {"name": "Breads & Roti", "code": "CAT-BREADS"},
    {"name": "Desserts & Sweets", "code": "CAT-DESSERT"},
    {"name": "Beverages & Cocktails", "code": "CAT-BEV"},
]

MENU_ITEMS = [
    {"name": "Paneer Tikka", "code": "M01", "price": 280.0, "veg": True, "cat": 1, "station": "Tandoor"},
    {"name": "Chicken Tikka Kebab", "code": "M02", "price": 340.0, "veg": False, "cat": 1, "station": "Tandoor"},
    {"name": "Butter Chicken", "code": "M03", "price": 380.0, "veg": False, "cat": 2, "station": "Main"},
    {"name": "Dal Makhani", "code": "M04", "price": 260.0, "veg": True, "cat": 2, "station": "Main"},
    {"name": "Hyderabadi Dum Biryani (Chicken)", "code": "M05", "price": 360.0, "veg": False, "cat": 3, "station": "Biryani"},
    {"name": "Subz Dum Biryani", "code": "M06", "price": 290.0, "veg": True, "cat": 3, "station": "Biryani"},
    {"name": "Butter Naan", "code": "M07", "price": 60.0, "veg": True, "cat": 4, "station": "Tandoor"},
    {"name": "Garlic Roti", "code": "M08", "price": 50.0, "veg": True, "cat": 4, "station": "Tandoor"},
    {"name": "Gulab Jamun with Rabri", "code": "M09", "price": 140.0, "veg": True, "cat": 5, "station": "Desserts"},
    {"name": "Cold Coffee with Ice Cream", "code": "M10", "price": 160.0, "veg": True, "cat": 6, "station": "Beverages"},
    {"name": "Fresh Lime Soda", "code": "M11", "price": 90.0, "veg": True, "cat": 6, "station": "Beverages"},
]

KITCHEN_STATIONS = [
    {"id": uuid.UUID("bbbbbbbb-1111-0000-0000-000000000001"), "name": "Tandoor & Grill", "type": "tandoor", "cap": 12},
    {"id": uuid.UUID("bbbbbbbb-2222-0000-0000-000000000002"), "name": "Main Curry & Biryani", "type": "curry", "cap": 15},
    {"id": uuid.UUID("bbbbbbbb-3333-0000-0000-000000000003"), "name": "Beverages & Bar", "type": "beverage", "cap": 20},
    {"id": uuid.UUID("bbbbbbbb-4444-0000-0000-000000000004"), "name": "Desserts & Bakery", "type": "dessert", "cap": 10},
]

INVENTORY_ITEMS = [
    {"name": "Basmati Rice Premium", "code": "INV-RICE", "type": "ingredient", "cost": 95.0, "stock": 180.0, "unit": "kg", "reorder": 50.0},
    {"name": "Fresh Paneer", "code": "INV-PANEER", "type": "ingredient", "cost": 320.0, "stock": 25.0, "unit": "kg", "reorder": 10.0},
    {"name": "Chicken Boneless", "code": "INV-CHKN", "type": "ingredient", "cost": 260.0, "stock": 45.0, "unit": "kg", "reorder": 15.0},
    {"name": "Amul Butter 500g", "code": "INV-BTR", "type": "ingredient", "cost": 275.0, "stock": 35.0, "unit": "pack", "reorder": 10.0},
    {"name": "Fresh Cream", "code": "INV-CRM", "type": "ingredient", "cost": 210.0, "stock": 20.0, "unit": "ltr", "reorder": 5.0},
    {"name": "Tomatoes Hybrid", "code": "INV-TOM", "type": "ingredient", "cost": 35.0, "stock": 60.0, "unit": "kg", "reorder": 20.0},
    {"name": "Whole Spices / Garam Masala", "code": "INV-SPC", "type": "ingredient", "cost": 650.0, "stock": 12.0, "unit": "kg", "reorder": 4.0},
    {"name": "Takeaway Containers 750ml", "code": "INV-CONT", "type": "packaging", "cost": 6.5, "stock": 450.0, "unit": "pcs", "reorder": 100.0},
]

async def bootstrap():
    print(f"=== Bootstrapping Real PostgreSQL Microservices for Tenant {TENANT_ID} ===")
    
    # ── 1. ORGANIZATION DATABASE ──
    conn_org = await asyncpg.connect("postgresql://postgres:0111@127.0.0.1:5432/restaurantos_organization")
    
    await conn_org.execute("""
        INSERT INTO tenants (id, name, slug, contact_email, contact_phone, status, plan, settings, created_at, updated_at)
        VALUES ($1, 'Sunrise Restaurant & Bar', 'spice-route-9a3f9b87', 'venaticfungus@gmail.com', '+91 98490 12345', 'active', 'enterprise', '{}'::jsonb, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'active'
    """, TENANT_ID)
    print("  [ok] Tenant in organization: ready")

    await conn_org.execute("""
        INSERT INTO outlets (id, tenant_id, name, code, outlet_type, address_line1, city, country, timezone, currency, is_active, settings, weekly_hours, created_at, updated_at)
        VALUES ($1, $2, 'Sunrise Banjara Hills (Flagship)', 'HYD-01', 'dine_in', 'Road No. 12, Banjara Hills', 'Hyderabad', 'IN', 'Asia/Kolkata', 'INR', true, '{}'::jsonb, '{}'::jsonb, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = true
    """, OUTLET_ID, TENANT_ID)
    print("  [ok] Outlet in organization: ready (HYD-01)")

    sec_ids = []
    for s in SECTIONS:
        sec_id = s["id"]
        sec_ids.append(sec_id)
        await conn_org.execute("""
            INSERT INTO sections (id, tenant_id, outlet_id, name, section_type, capacity, is_active, sort_order, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, true, 0, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, section_type = EXCLUDED.section_type
        """, sec_id, TENANT_ID, OUTLET_ID, s["name"], s["type"], s["capacity"])
    print(f"  [ok] Sections in organization: {len(SECTIONS)} sections ready")

    for t in TABLES:
        sec_id = sec_ids[t["sec"]]
        table_id = uuid.uuid5(TENANT_ID, f"table-{t['code']}")
        await conn_org.execute("""
            INSERT INTO restaurant_tables (
                id, tenant_id, outlet_id, section_id, name, code, seats, shape,
                min_covers, max_covers, status, is_active, position_x, position_y,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10, true, $11, $12, NOW(), NOW())
            ON CONFLICT (outlet_id, code) DO UPDATE SET
                name = EXCLUDED.name,
                seats = EXCLUDED.seats,
                shape = EXCLUDED.shape,
                status = EXCLUDED.status,
                position_x = EXCLUDED.position_x,
                position_y = EXCLUDED.position_y,
                section_id = EXCLUDED.section_id
        """, table_id, TENANT_ID, OUTLET_ID, sec_id, t["name"], t["code"], t["seats"], t["shape"],
             t["seats"] + 2, t["status"], t["pos_x"], t["pos_y"])
    
    t_count = await conn_org.fetchval("SELECT COUNT(*) FROM restaurant_tables WHERE tenant_id = $1", TENANT_ID)
    print(f"  [ok] Tables in organization: {t_count} tables ready")
    await conn_org.close()

    # ── 2. MENU DATABASE ──
    conn_menu = await asyncpg.connect("postgresql://postgres:0111@127.0.0.1:5432/restaurantos_menu")
    cat_ids = []
    for c in MENU_CATEGORIES:
        cid = uuid.uuid5(TENANT_ID, f"cat-{c['code']}")
        cat_ids.append(cid)
        slug = c["code"].lower()
        await conn_menu.execute("""
            INSERT INTO menu_categories (id, tenant_id, outlet_id, name, slug, category_type, is_veg_only, is_active, sort_order, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, 'food', false, true, 0, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
        """, cid, TENANT_ID, OUTLET_ID, c["name"], slug)

    for item in MENU_ITEMS:
        item_id = uuid.uuid5(TENANT_ID, f"item-{item['code']}")
        cid = cat_ids[item["cat"]]
        await conn_menu.execute("""
            INSERT INTO menu_items (
                id, tenant_id, outlet_id, category_id, name, code,
                base_price, is_available, is_active, item_type, track_inventory, sort_order, tags,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, $8, true, 0, '[]'::jsonb, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                base_price = EXCLUDED.base_price,
                is_available = true
        """, item_id, TENANT_ID, OUTLET_ID, cid, item["name"], item["code"],
             Decimal(str(item["price"])), "veg" if item["veg"] else "non_veg")
    
    m_count = await conn_menu.fetchval("SELECT COUNT(*) FROM menu_items WHERE tenant_id = $1", TENANT_ID)
    print(f"  [ok] Menu items in database: {m_count} items ready")
    await conn_menu.close()

    # ── 3. KITCHEN DATABASE ──
    conn_kit = await asyncpg.connect("postgresql://postgres:0111@127.0.0.1:5432/restaurantos_kitchen")
    for ks in KITCHEN_STATIONS:
        await conn_kit.execute("""
            INSERT INTO kitchen_stations (id, tenant_id, outlet_id, name, station_type, is_active, capacity_concurrent, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, true, $6, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, station_type = EXCLUDED.station_type
        """, ks["id"], TENANT_ID, OUTLET_ID, ks["name"], ks["type"], ks["cap"])
    k_count = await conn_kit.fetchval("SELECT COUNT(*) FROM kitchen_stations WHERE tenant_id = $1", TENANT_ID)
    print(f"  [ok] Kitchen stations in database: {k_count} stations ready")
    await conn_kit.close()

    # ── 4. INVENTORY DATABASE ──
    conn_inv = await asyncpg.connect("postgresql://postgres:0111@127.0.0.1:5432/restaurantos_inventory")
    # Central storage location
    loc_id = uuid.uuid5(TENANT_ID, "loc-main-kitchen")
    await conn_inv.execute("""
        INSERT INTO storage_locations (id, tenant_id, outlet_id, name, location_type, module, is_central, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, 'Central Kitchen Dry Store', 'kitchen_store', 'restaurant', true, true, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    """, loc_id, TENANT_ID, OUTLET_ID)

    inv_cat_id = uuid.uuid5(TENANT_ID, "inv-cat-raw")
    await conn_inv.execute("""
        INSERT INTO inventory_categories (id, tenant_id, outlet_id, name, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, 'Raw Ingredients & Provisions', true, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    """, inv_cat_id, TENANT_ID, OUTLET_ID)

    for inv in INVENTORY_ITEMS:
        item_id = uuid.uuid5(TENANT_ID, f"inv-item-{inv['code']}")
        await conn_inv.execute("""
            INSERT INTO inventory_items (
                id, tenant_id, outlet_id, name, code, item_type, category_id,
                default_location_id, track_stock, track_batch, track_expiry, allow_negative_stock,
                reorder_level, reorder_qty, standard_cost, is_active,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, false, false, false, $9, $10, $11, true, NOW(), NOW())
            ON CONFLICT (tenant_id, code) DO UPDATE SET
                name = EXCLUDED.name,
                standard_cost = EXCLUDED.standard_cost,
                reorder_level = EXCLUDED.reorder_level
        """, item_id, TENANT_ID, OUTLET_ID, inv["name"], inv["code"], inv["type"], inv_cat_id,
             loc_id, Decimal(str(inv["reorder"])), Decimal(str(inv["reorder"] * 2)), Decimal(str(inv["cost"])))

        stock_id = uuid.uuid5(TENANT_ID, f"stock-{inv['code']}")
        await conn_inv.execute("""
            INSERT INTO inventory_stock (
                id, tenant_id, outlet_id, inventory_item_id, location_id,
                qty_on_hand, qty_reserved, qty_available, avg_cost, last_cost,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, 0, $6, $7, $7, NOW(), NOW())
            ON CONFLICT (tenant_id, outlet_id, inventory_item_id, location_id) DO UPDATE SET
                qty_on_hand = EXCLUDED.qty_on_hand,
                qty_available = EXCLUDED.qty_available,
                avg_cost = EXCLUDED.avg_cost
        """, stock_id, TENANT_ID, OUTLET_ID, item_id, loc_id,
             Decimal(str(inv["stock"])), Decimal(str(inv["cost"])))
             
    i_count = await conn_inv.fetchval("SELECT COUNT(*) FROM inventory_items WHERE tenant_id = $1", TENANT_ID)
    print(f"  [ok] Inventory items in database: {i_count} items ready with live stock levels")
    await conn_inv.close()

    print("=== Complete PostgreSQL Microservice Database Bootstrapped Successfully ===")

if __name__ == "__main__":
    asyncio.run(bootstrap())
