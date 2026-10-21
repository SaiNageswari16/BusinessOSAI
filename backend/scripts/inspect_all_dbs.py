import asyncio
import asyncpg

async def main():
    conn_menu = await asyncpg.connect("postgresql://postgres:0111@127.0.0.1:5432/restaurantos_menu")
    cols = await conn_menu.fetch("SELECT column_name FROM information_schema.columns WHERE table_name = 'menu_items'")
    print("Menu item columns:", [c["column_name"] for c in cols])
    items = await conn_menu.fetch("SELECT id, name, base_price, is_available FROM menu_items LIMIT 5")
    print("Menu items count in DB:", len(items))
    await conn_menu.close()

    conn_pos = await asyncpg.connect("postgresql://postgres:0111@127.0.0.1:5432/restaurantos_pos")
    cols = await conn_pos.fetch("SELECT column_name FROM information_schema.columns WHERE table_name = 'orders'")
    print("POS order columns:", [c["column_name"] for c in cols])
    orders = await conn_pos.fetch("SELECT id, order_number, status, grand_total FROM orders LIMIT 5")
    print("POS orders count in DB:", len(orders))
    await conn_pos.close()

if __name__ == "__main__":
    asyncio.run(main())
