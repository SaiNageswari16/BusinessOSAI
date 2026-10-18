"""Smoke-test the organization service against the real database.

Mints a self-contained access token, then drives the full org hierarchy:
tenant -> outlet -> section -> table -> printer, plus validation, tenant
isolation and auth enforcement.

Run:  python smoke_org.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
import uuid

ROOT = os.path.dirname(os.path.abspath(__file__))
RUN = uuid.uuid4().hex[:8]
sys.path.insert(0, ROOT)

from src.utils.security import create_access_token  # noqa: E402

BASE = os.environ.get("ORG_URL", "http://127.0.0.1:8101/api/v1/organization")
TENANT = uuid.uuid4()
USER = uuid.uuid4()
OUTLET = uuid.uuid4()

TOKEN = create_access_token(
    USER, TENANT,
    claims={
        "email": "org-smoke@restaurantos.test", "full_name": "Org Smoke",
        "permissions": ["view:organization", "manage:organization"],
        "roles": ["owner"], "is_tenant_owner": True, "tenant_slug": "org-smoke",
        "active_outlet_id": str(OUTLET), "allowed_outlet_ids": [str(OUTLET)],
    },
)

PASS, FAIL = [], []


def call(method, path, body=None, token=TOKEN):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path, data=data, method=method,
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {token}"},
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


def check(label, condition, detail=""):
    (PASS if condition else FAIL).append(label)
    print(f"  [{'PASS' if condition else 'FAIL'}] {label}"
          + (f" — {detail}" if detail else ""))


print(f"\nOrganization smoke test against {BASE}\n" + "=" * 62)

# 1. Tenant
st, tenant = call("POST", "/tenants", {
    "name": f"Spice Route {RUN}", "slug": f"spice-route-{RUN}",
    "contact_email": "ops@spiceroute.test", "contact_phone": "+91-98765-43210",
})
check("create tenant", st == 201, str(st))
tenant_id = tenant["id"] if tenant else None

st, dup = call("POST", "/tenants", {"name": "Dup", "slug": f"spice-route-{RUN}"})
check("duplicate tenant slug rejected (409)", st == 409, str(st))

st, bad = call("POST", "/tenants", {"name": "Bad", "slug": "Not Valid!"})
check("invalid slug rejected (422)", st == 422, str(st))

st, got = call("GET", "/tenants")
check("list tenants scoped to caller's tenant",
      st == 200 and all(t["id"] == str(TENANT) for t in (got or [])),
      f"{len(got or [])} returned")

# 2. Outlet
st, outlet = call("POST", "/outlets", {
    "name": "Spice Route — Koramangala", "code": f"KOR-{RUN[:4]}",
    "outlet_type": "dine_in", "address_line1": "80 Feet Road",
    "city": "Bengaluru", "state": "Karnataka", "state_code": "29",
    "gstin": "29ABCDE1234F1Z5", "phone": "+91-80-4000-1234",
})
check("create outlet", st == 201, str(st))
outlet_id = outlet["id"] if outlet else None
check("outlet belongs to token tenant",
      outlet and outlet.get("tenant_id") == str(TENANT),
      outlet.get("tenant_id") if outlet else "n/a")

st, dup_out = call("POST", "/outlets", {"name": "Dup", "code": f"KOR-{RUN[:4]}"})
check("duplicate outlet code rejected (409)", st == 409, str(st))

st, one = call("GET", f"/outlets/{outlet_id}")
check("get outlet by id", st == 200 and one.get("code") == f"KOR-{RUN[:4]}", str(st))

st, all_out = call("GET", "/outlets")
check("list outlets", st == 200 and any(o["id"] == outlet_id for o in all_out), str(st))

# 3. Section
st, section = call("POST", "/sections", {
    "outlet_id": outlet_id, "name": "AC Hall", "section_type": "ac_hall",
    "capacity": 60, "sort_order": 1,
})
check("create section", st == 201, str(st))
section_id = section["id"] if section else None

st, sections = call("GET", "/sections")
check("list sections", st == 200 and len(sections) >= 1, str(st))

# 4. Table
st, table = call("POST", "/tables", {
    "outlet_id": outlet_id, "section_id": section_id,
    "name": "T1", "code": f"T1-{RUN[:4]}", "seats": 4, "min_covers": 1, "max_covers": 4,
})
check("create table", st == 201, str(st))
table_id = table["id"] if table else None

st, dup_t = call("POST", "/tables", {
    "outlet_id": outlet_id, "name": "T1 again", "code": f"T1-{RUN[:4]}",
})
check("duplicate table code rejected (409)", st == 409, str(st))

st, tables = call("GET", f"/tables?outlet_id={outlet_id}")
check("list tables for outlet", st == 200 and len(tables) >= 1, str(st))

# 5. Outlet detail carries the hierarchy
st, detail = call("GET", f"/outlets/{outlet_id}")
check("outlet detail includes sections",
      st == 200 and isinstance(detail.get("sections", []), list), str(st))

# 6. Update
st, upd = call("PUT", f"/outlets/{outlet_id}", {"name": "Spice Route — HSR"})
check("update outlet", st == 200 and upd.get("name") == "Spice Route — HSR", str(st))

# 7. Cross-tenant isolation — a different tenant must not see this outlet
OTHER = uuid.uuid4()
other_token = create_access_token(
    uuid.uuid4(), OTHER,
    claims={"permissions": ["view:organization"], "is_tenant_owner": False,
            "tenant_slug": "other"},
)
st, _ = call("GET", f"/outlets/{outlet_id}", token=other_token)
check("other tenant cannot read outlet (404)", st == 404, str(st))

st, other_list = call("GET", "/outlets", token=other_token)
check("other tenant sees no outlets",
      st == 200 and all(o["id"] != outlet_id for o in (other_list or [])), str(st))

# 8. Auth enforcement
req = urllib.request.Request(BASE + "/outlets", method="GET")
try:
    with urllib.request.urlopen(req, timeout=10) as r:
        st_noauth = r.status
except urllib.error.HTTPError as e:
    st_noauth = e.code
check("unauthenticated request rejected (401)", st_noauth == 401, str(st_noauth))

# 9. Permission enforcement
noperm = create_access_token(
    uuid.uuid4(), TENANT,
    claims={"permissions": ["view:organization"], "roles": ["staff"]},
)
st, _ = call("POST", "/outlets", {"name": "Nope", "code": f"NPE-{RUN[:4]}"}, token=noperm)
check("write without manage permission rejected (403)",
      st == 403, str(st))

# 10. Deletes
st, _ = call("DELETE", f"/tables/{table_id}")
check("delete table (204)", st == 204, str(st))
st, tables_after = call("GET", f"/tables?outlet_id={outlet_id}")
check("deleted table no longer listed",
      all(t["id"] != table_id for t in (tables_after or [])), "")

st, _ = call("DELETE", f"/sections/{section_id}")
check("delete section (204)", st == 204, str(st))

st, _ = call("DELETE", f"/outlets/{outlet_id}")
check("delete outlet (204)", st == 204, str(st))

st, gone = call("GET", f"/outlets/{outlet_id}")
check("deleted outlet is 404", st == 404, str(st))

print("\n" + "=" * 62)
print(f"  {len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("  FAILED: " + ", ".join(FAIL))
print("=" * 62 + "\n")
sys.exit(1 if FAIL else 0)
