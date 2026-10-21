import asyncio
import httpx

async def test_pos_flow():
    async with httpx.AsyncClient() as client:
        # 1. Login
        login_res = await client.post(
            "http://127.0.0.1:8000/api/v1/auth/login",
            json={"email": "venaticfungus@gmail.com", "password": "121245@Forgot"}
        )
        if login_res.status_code != 200:
            print("Login failed:", login_res.status_code, login_res.text)
            return
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Get Outlets
        outlets_res = await client.get("http://127.0.0.1:8000/api/v1/organization/outlets", headers=headers)
        outlets = outlets_res.json()
        print(f"Found {len(outlets)} outlets. First: {outlets[0]['name']} ({outlets[0]['id']})")
        outlet_id = outlets[0]["id"]

        # 3. Get Tables
        tables_res = await client.get("http://127.0.0.1:8000/api/v1/organization/tables", headers=headers)
        tables = tables_res.json()
        print(f"Found {len(tables)} tables. First: {tables[0]['name']} ({tables[0]['id']})")
        table_id = tables[0]["id"]

        # 4. Get Menu items
        menu_res = await client.get("http://127.0.0.1:8000/api/v1/menu/items", headers=headers)
        menu_items = menu_res.json()
        print(f"Found {len(menu_items)} menu items. First: {menu_items[0]['name']} (₹{menu_items[0]['base_price']})")
        item = menu_items[0]

        # 5. Place order via POS
        order_payload = {
            "outlet_id": outlet_id,
            "order_type": "dine_in",
            "table_id": table_id,
            "covers": 2,
            "customer_name": "Rajesh Sharma",
            "customer_phone": "+91 98765 43210",
            "lines": [
                {
                    "menu_item_id": item["id"],
                    "item_name": item["name"],
                    "unit_price": float(item["base_price"]),
                    "qty": 2,
                    "notes": "Extra spicy"
                }
            ]
        }
        order_res = await client.post("http://127.0.0.1:8000/api/v1/pos/orders", json=order_payload, headers=headers)
        print("Create Order Status:", order_res.status_code)
        if order_res.status_code not in (200, 201):
            print("Create Order Error:", order_res.text)
            return
        order_data = order_res.json()
        print(f"✓ Order Placed! Order #{order_data.get('order_number')}, Total: ₹{order_data.get('grand_total')}, ID: {order_data.get('id')}")

        # 6. Check KOT in Kitchen service
        await asyncio.sleep(1) # Wait for event bus
        kots_res = await client.get("http://127.0.0.1:8000/api/v1/kitchen/kots", headers=headers)
        print("KOTs Status:", kots_res.status_code)
        if kots_res.status_code != 200:
            print("KOTs Error:", kots_res.text)
        else:
            kots = kots_res.json()
            items = kots.get("items", []) if isinstance(kots, dict) else kots
            print(f"✓ Kitchen has {len(items)} active KOT tickets!")

asyncio.run(test_pos_flow())
