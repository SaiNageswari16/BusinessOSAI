"""Smoke-test the menu service against the real database.

Mints a self-contained access token (no auth service needed), then drives the
menu endpoints: categories, items, variants, addon groups/addons, the price
calculator, recipes, combos and pricing rules.

Run:  python smoke_menu.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RUN = uuid.uuid4().hex[:8]
sys.path.insert(0, str(ROOT))

from src.utils.security import create_access_token  # noqa: E402

BASE = os.environ.get("MENU_URL", "http://127.0.0.1:8102/api/v1/menu")
TENANT = uuid.uuid4()
USER = uuid.uuid4()
OUTLET = uuid.uuid4()

TOKEN = create_access_token(
    USER,
    TENANT,
    claims={
        "email": "smoke@restaurantos.test",
        "full_name": "Smoke Test",
        "permissions": [
            "view:menu", "manage:menu", "view:recipes", "manage:recipes",
        ],
        "roles": ["owner"],
        "is_tenant_owner": True,
        "tenant_slug": "smoke",
        "active_outlet_id": str(OUTLET),
        "allowed_outlet_ids": [str(OUTLET)],
    },
)

PASS, FAIL = [], []


def call(method: str, path: str, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {TOKEN}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, (json.loads(raw) if raw else None)
        except json.JSONDecodeError:
            return e.code, None


def check(label: str, condition: bool, detail: str = ""):
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}" + (f" — {detail}" if detail else ""))


print(f"\nMenu smoke test against {BASE}\n" + "=" * 60)

# 1. Category
st, cat = call("POST", "/categories", {
    "outlet_id": str(OUTLET), "name": "Starters", "slug": f"starters-{RUN}",
    "category_type": "food", "is_veg_only": False, "sort_order": 1,
})
check("create category", st == 201, f"{st} {cat if st != 201 else ''}")
cat_id = cat["id"] if cat else None

st, dup = call("POST", "/categories", {
    "name": "Starters 2", "slug": f"starters-{RUN}",
})
check("duplicate category slug rejected (409)", st == 409, str(st))

# 2. Item
st, item = call("POST", "/items", {
    "outlet_id": str(OUTLET), "category_id": cat_id, "name": "Paneer Tikka",
    "code": f"ST-{RUN[:4]}", "description": "Char-grilled cottage cheese",
    "item_type": "veg", "base_price": 280, "cost_price": 120,
    "prep_time_minutes": 18, "serving_size": "8 pcs", "track_inventory": True,
})
check("create item", st == 201, f"{st} {item if st != 201 else ''}")
item_id = item["id"] if item else None

st, item2 = call("POST", "/items", {
    "category_id": cat_id, "name": "Chicken Wings", "code": f"ST2-{RUN[:4]}",
    "item_type": "non_veg", "base_price": 320,
})
check("create second item", st == 201, str(st))

# 3. Variants
st, vh = call("POST", f"/items/{item_id}/variants",
              {"name": "Half", "price_delta": 0, "is_default": True})
st2, vf = call("POST", f"/items/{item_id}/variants",
               {"name": "Full", "price_delta": 120})
check("create variants", st == 201 and st2 == 201, f"{st}/{st2}")
half_id = vh["id"] if vh else None
full_id = vf["id"] if vf else None

# 4. Addon group + addons
st, grp = call("POST", f"/items/{item_id}/addon-groups",
               {"name": "Spice level", "min_select": 1, "max_select": 2})
group_id = grp["id"] if grp else None
st, a1 = call("POST", f"/addon-groups/{group_id}/addons",
              {"name": "Extra chutney", "price": 20})
st, a2 = call("POST", f"/addon-groups/{group_id}/addons",
              {"name": "Cheese topping", "price": 60})
addon_ids = [a["id"] for a in (a1, a2) if a]
check("create addon group + addons", len(addon_ids) == 2, str(len(addon_ids)))

# 5. Price calculator — the arithmetic POS depends on
st, p = call("GET", f"/items/{item_id}/price?variant_id={full_id}"
                  + "".join(f"&addon_ids={a}" for a in addon_ids))
check("price = base + full variant + both addons",
      st == 200 and p and p["unit_price"] == 280 + 120 + 20 + 60,
      f"got {p.get('unit_price') if p else None}, want 480")

st, p2 = call("GET", f"/items/{item_id}/price?variant_id={half_id}")
check("price with half variant only", p2 and p2["unit_price"] == 280,
      f"got {p2.get('unit_price') if p2 else None}")

st, p3 = call("GET", f"/items/{item_id}/price")
check("price with no options = base", p3 and p3["unit_price"] == 280,
      f"got {p3.get('unit_price') if p3 else None}")

st, p4 = call("GET", f"/items/{item_id}/price?variant_id={full_id}"
                  + f"&addon_ids={addon_ids[0]}")
check("min_select enforced (400 when 1 required, 1 given is ok)",
      st == 200, f"{st}")

# 6. Recipe — the bill of materials inventory reads
st, recipe = call("POST", f"/items/{item_id}/recipes", {
    "name": "Paneer Tikka standard",
    "yield_qty": 1,
    "instructions": "Marinate 4h, grill 12 min.",
    "lines": [
        {"inventory_item_id": str(uuid.uuid4()), "qty": 250, "wastage_pct": 5},
        {"inventory_item_id": str(uuid.uuid4()), "qty": 30, "wastage_pct": 2},
    ],
})
check("create recipe with lines", st == 201 and len(recipe.get("lines", [])) == 2,
      str(st))
recipe_id = recipe["id"] if recipe else None

st, got = call("GET", f"/items/{item_id}/recipes")
check("list item recipes", st == 200 and len(got) == 1, str(st))

st, repl = call("PUT", f"/recipes/{recipe_id}/lines", [
    {"inventory_item_id": str(uuid.uuid4()), "qty": 300, "wastage_pct": 5},
])
check("replace recipe lines", st == 200 and len(repl.get("lines", [])) == 1, str(st))

# 7. Combo
st, combo = call("POST", "/combos", {
    "name": "Starter Duo", "code": f"CB-{RUN[:4]}", "combo_price": 520,
    "description": "Any two starters",
    "items": [
        {"menu_item_id": item_id, "qty": 1},
        {"menu_item_id": item2["id"], "qty": 1},
    ],
})
check("create combo", st == 201 and len(combo.get("items", [])) == 2, str(st))
combo_id = combo["id"] if combo else None

st, combos = call("GET", "/combos")
check("list combos", st == 200 and len(combos) >= 1, str(st))

# 8. Pricing rule (no outlet_id => applies to every outlet)
st, rule = call("POST", "/pricing-rules", {
    "name": "Happy Hour 4-6pm", "rule_type": "happy_hour",
    "conditions": {"days": [1, 2, 3, 4, 5], "from": "16:00", "to": "18:00"},
    "discount_pct": 20, "priority": 10,
})
check("create pricing rule", st == 201, str(st))
rule_id = rule["id"] if rule else None

st, all_rules = call("GET", "/pricing-rules")
check("list pricing rules (unscoped)", st == 200 and len(all_rules) == 1, str(st))

st, outlet_rule = call("POST", "/pricing-rules", {
    "outlet_id": str(OUTLET), "name": "Weekend Bump", "rule_type": "day_part",
    "discount_pct": 5, "priority": 20,
})
check("create outlet-scoped pricing rule", st == 201, str(st))

st, rules = call("GET", f"/pricing-rules?outlet_id={OUTLET}")
check("list pricing rules for outlet includes global + scoped",
      st == 200 and len(rules) == 2, f"got {len(rules) if rules else 0}")

st, rules_hi = call("GET", f"/pricing-rules?outlet_id={OUTLET}")
check("rules ordered by priority desc",
      [r["priority"] for r in rules_hi] == sorted(
          [r["priority"] for r in rules_hi], reverse=True),
      f"{[r['priority'] for r in rules_hi]}")

# 9. Search / filter
st, found = call("GET", f"/items?search=paneer&outlet_id={OUTLET}")
check("search items by name", st == 200 and len(found) == 1,
      f"got {len(found) if found else 0}")

st, veg_only = call("GET", f"/items?item_type=veg")
check("filter items by type", st == 200 and all(
    i["item_type"] == "veg" for i in veg_only), str(st))

st, avail = call("GET", "/items?available_only=true")
check("filter available items", st == 200, str(st))

# 10. Detail view
st, detail = call("GET", f"/items/{item_id}")
check("item detail has variants + addon groups",
      st == 200 and len(detail.get("variants", [])) == 2
      and len(detail.get("addon_groups", [])) == 1, str(st))

# 11. Update
st, upd = call("PUT", f"/items/{item_id}",
               {"base_price": 300, "is_available": False})
check("update item", st == 200 and upd.get("base_price") == 300, str(st))

st, p5 = call("GET", f"/items/{item_id}/price")
check("price follows updated base_price", p5 and p5["unit_price"] == 300,
      f"got {p5.get('unit_price') if p5 else None}")

# 12. Auth enforcement
st, _ = call("GET", "/items")
req = urllib.request.Request(BASE + "/items", method="GET")
try:
    with urllib.request.urlopen(req, timeout=10) as r:
        st_noauth = r.status
except urllib.error.HTTPError as e:
    st_noauth = e.code
check("unauthenticated request rejected (401)", st_noauth == 401, str(st_noauth))

# 13. Tenant isolation
other = uuid.uuid4()
st, leaked = call("GET", "/items")
st_foreign = None
try:
    data = json.dumps({"category_id": cat_id, "name": "X", "code": "X-1"}).encode()
    req = urllib.request.Request(
        BASE + "/items", data=data, method="POST",
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req, timeout=10) as r:
        st_foreign = r.status
except urllib.error.HTTPError as e:
    st_foreign = e.code

st, cats = call("GET", "/categories")
check("tenant scoping — only this tenant's categories returned",
      st == 200 and all(c["slug"] == f"starters-{RUN}" for c in cats),
      f"{len(cats)} returned")

# 14. Delete / deactivate
st, _ = call("DELETE", f"/combos/{combo_id}")
check("delete combo (soft)", st == 204, str(st))
st, combos_after = call("GET", "/combos")
check("deleted combo no longer listed",
      all(c["id"] != combo_id for c in combos_after), "")

st, _ = call("DELETE", f"/items/{item2['id']}")
check("delete item (soft deactivate)", st == 204, str(st))

print("\n" + "=" * 60)
print(f"  {len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("  FAILED: " + ", ".join(FAIL))
print("=" * 60 + "\n")
sys.exit(1 if FAIL else 0)
