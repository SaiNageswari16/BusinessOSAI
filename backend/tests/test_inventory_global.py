"""Test Global Master Inventory and Restaurant Module Sub-Inventory Linking."""
import asyncio
import uuid
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import httpx

GATEWAY_URL = "http://127.0.0.1:8000/api/v1/inventory"
INVENTORY_URL = "http://127.0.0.1:8106/api/v1/inventory"

# Create a mock identity / JWT token or call inventory service directly with tenant headers
from src.utils.security import create_access_token

tenant_id = uuid.uuid4()
outlet_id = uuid.uuid4()
user_id = uuid.uuid4()

token = create_access_token(
    user_id=str(user_id),
    tenant_id=str(tenant_id),
    claims={
        "email": "admin@restaurant.test",
        "roles": ["admin"],
        "permissions": ["view:inventory", "manage:inventory"],
        "is_tenant_owner": True,
        "active_outlet_id": str(outlet_id),
    },
)

headers = {
    "Authorization": f"Bearer {token}",
    "X-Tenant-Id": str(tenant_id),
}

async def run_test():
    async with httpx.AsyncClient(base_url=GATEWAY_URL, headers=headers, timeout=10.0) as client:
        print("\n1. Bootstrapping Locations (Central Hub + Module Sub-Inventories)...")
        resp = await client.post(f"/locations/bootstrap?outlet_id={outlet_id}")
        assert resp.status_code == 200, f"Bootstrap failed: {resp.text}"
        locations = resp.json()
        print(f"  [OK] Created/Found {len(locations)} locations:")
        for loc in locations:
            print(f"       * {loc['name']} (module={loc['module']}, is_central={loc['is_central']})")
        
        central = next(l for l in locations if l["is_central"] or l["module"] == "central")
        kitchen = next(l for l in locations if l["module"] == "restaurant")
        bar = next(l for l in locations if l["module"] == "bar")
        
        print("\n2. Creating Master Inventory Item (Basmati Rice)...")
        item_resp = await client.post("/items", json={
            "name": "Basmati Rice Royal",
            "code": f"ING-RICE-{uuid.uuid4().hex[:4]}",
            "item_type": "ingredient",
            "standard_cost": 85.0,
            "reorder_level": 20.0,
            "reorder_qty": 50.0,
            "default_location_id": central["id"],
            "outlet_id": str(outlet_id),
        })
        assert item_resp.status_code == 201, f"Create item failed: {item_resp.text}"
        item = item_resp.json()
        print(f"  [OK] Created Item: {item['name']} (ID: {item['id']})")
        
        print("\n3. Setting Opening Stock of 100 kg in Central Warehouse...")
        open_resp = await client.post(
            f"/items/{item['id']}/opening-stock?outlet_id={outlet_id}",
            json={
                "qty": 100.0,
                "unit_cost": 85.0,
                "location_id": central["id"],
            }
        )
        assert open_resp.status_code == 201, f"Opening stock failed: {open_resp.text}"
        print(f"  [OK] Opening stock recorded.")

        print("\n4. Transferring 25 kg from Central Warehouse to Restaurant Kitchen Sub-Inventory...")
        trf_resp = await client.post("/transfers", json={
            "outlet_id": str(outlet_id),
            "inventory_item_id": item["id"],
            "source_location_id": central["id"],
            "destination_location_id": kitchen["id"],
            "qty": 25.0,
            "notes": "Morning Kitchen Prep Replenishment",
        })
        assert trf_resp.status_code == 201, f"Transfer failed: {trf_resp.text}"
        transfer = trf_resp.json()
        print(f"  [OK] Transfer Succeeded:")
        print(f"       From: {transfer['source_location_name']} -> To: {transfer['destination_location_name']}")
        print(f"       Qty: {transfer['qty']} kg")

        print("\n5. Checking Global Multi-Tier Inventory Rollup...")
        rollup_resp = await client.get(f"/global-rollup?outlet_id={outlet_id}")
        assert rollup_resp.status_code == 200, f"Rollup failed: {rollup_resp.text}"
        overview = rollup_resp.json()
        print(f"  [OK] Global Overview:")
        print(f"       Total Value: Rs {overview['total_value']}")
        print(f"       Central Warehouse Value: Rs {overview['central_warehouse_value']}")
        print(f"       Module Values: {overview['module_values']}")
        
        rolled_item = next(i for i in overview["items"] if i["id"] == item["id"])
        print(f"  [OK] Item Breakdown for {rolled_item['name']}:")
        print(f"       Global On Hand: {rolled_item['total_global_on_hand']} kg")
        print(f"       Central Warehouse: {rolled_item['central_warehouse_on_hand']} kg")
        for ms in rolled_item["module_stocks"]:
            print(f"       * {ms['location_name']} ({ms['module']}): {ms['qty_on_hand']} kg")
        
        assert rolled_item["total_global_on_hand"] == 100.0
        assert rolled_item["central_warehouse_on_hand"] == 75.0
        kitchen_stock = next(ms["qty_on_hand"] for ms in rolled_item["module_stocks"] if ms["module"] == "restaurant")
        assert kitchen_stock == 25.0, f"Kitchen stock was {kitchen_stock}, expected 25.0"

        print("\n6. Consuming 5 kg from Restaurant Kitchen Store (Simulating Restaurant POS Orders)...")
        consume_resp = await client.post("/consume", json={
            "outlet_id": str(outlet_id),
            "inventory_item_id": item["id"],
            "location_id": kitchen["id"],
            "module": "restaurant",
            "qty": 5.0,
            "reference_type": "pos_sale",
            "reference_id": "ORD-1001",
            "notes": "Biryani preparation dinner rush",
        })
        assert consume_resp.status_code == 201, f"Consumption failed: {consume_resp.text}"
        print(f"  [OK] Consumed 5 kg.")

        print("\n7. Verifying Updated Global Rollup After Restaurant Order Consumption...")
        rollup_resp2 = await client.get(f"/global-rollup?outlet_id={outlet_id}")
        overview2 = rollup_resp2.json()
        item2 = next(i for i in overview2["items"] if i["id"] == item["id"])
        print(f"  [OK] Updated Item Breakdown:")
        print(f"       Global On Hand: {item2['total_global_on_hand']} kg (Expected 95.0)")
        print(f"       Central Warehouse: {item2['central_warehouse_on_hand']} kg (Expected 75.0)")
        kitchen_stock2 = next(ms["qty_on_hand"] for ms in item2["module_stocks"] if ms["module"] == "restaurant")
        print(f"       Restaurant Kitchen: {kitchen_stock2} kg (Expected 20.0)")
        assert item2["total_global_on_hand"] == 95.0
        assert kitchen_stock2 == 20.0

        print("\n=======================================================")
        print("  ALL GLOBAL & RESTAURANT INVENTORY INTEGRATION TESTS PASSED! ")
        print("=======================================================\n")

if __name__ == "__main__":
    asyncio.run(run_test())
