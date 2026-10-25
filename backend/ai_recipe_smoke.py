import sys, json, urllib.request, urllib.error
sys.path.insert(0, ".")
from src.utils.security import create_access_token
import uuid

TENANT = uuid.UUID("e9fb216b-6289-43ca-900c-c09eada9840f")
OUTLET = uuid.UUID("11111111-2222-3333-4444-555555555555")
USER = uuid.UUID(int=1)
TOKEN = create_access_token(
    USER, TENANT,
    claims={
        "email": "owner@demo.com", "full_name": "Owner",
        "permissions": ["*"], "roles": ["owner"], "is_tenant_owner": True,
        "tenant_slug": "sunrise-banjara",
        "active_outlet_id": str(OUTLET), "allowed_outlet_ids": [str(OUTLET)],
    },
)
BASE = "http://127.0.0.1:8000/api/v1/menu"


def post(path, body):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or "null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or "null")


print("=== 1) /ai-recipe-search ===")
st, body = post("/ai-recipe-search", {"query": "chicken biryani", "portions": 1, "limit": 5})
print("HTTP", st)
print("provider_used:", body.get("provider_used"))
print("note/error:", body.get("note") or body.get("error"))
for r in body.get("results", []):
    print(f"   {r.get('recipe_id')}  {r.get('name')}  source={r.get('source')}  conf={r.get('confidence')}")

print("\n=== 2) /ai-recipe-reconcile ===")
st2, body2 = post("/ai-recipe-reconcile", {"recipe_name_or_id": "CAT-BIRYANI-CHICK", "portions": 2})
print("HTTP", st2)
print("name:", body2.get("name"), "| portions:", body2.get("portions"))
print("low:", body2.get("low_count"), "missing:", body2.get("missing_count"))
print("total_cost:", body2.get("total_cost"), "cost_known:", body2.get("cost_known"))
for l in (body2.get("lines") or [])[:20]:
    print(
        f"   {str(l.get('name'))[:18]:18s} {l.get('status'):8s} "
        f"req={l.get('required_for_n', 0):8.1f} avail={l.get('available_stock', 0):9.1f} "
        f"reord={l.get('reorder_level', 0):6.1f} short={l.get('shortfall', 0):8.1f}"
    )

print("\n=== 3) /ai-recipe-reorder ===")
st3, body3 = post("/ai-recipe-reorder", {"recipe_name_or_id": "CAT-BIRYANI-CHICK", "portions": 2})
print("HTTP", st3)
print("created:", body3.get("created"))
for c in body3.get("po_created") or []:
    print("   PO:", c.get("number"), "| lines:", c.get("lines"))
for c in body3.get("pr_created") or []:
    print("   PR:", c.get("number"), "| lines:", c.get("lines"))
print("skipped:", body3.get("skipped"))
print("note:", body3.get("note"))
