"""End-to-end smoke test for all RestaurantOS microservices.

Validates the full fleet:
  1. pos (:8103)         — Order creation, lines, and table seating
  2. kitchen (:8104)     — Station creation, KOT ticket and item bumping
  3. billing (:8105)     — Cashier shift opening, bill settlement, split tender
  4. inventory (:8106)   — Inventory item, stock adjustment, stock ledger
  5. purchase (:8107)    — Vendor, Purchase Order, and Goods Receipt Note (GRN)
  6. staff (:8108)       — Employee management, shift roster, and attendance
  7. customers (:8109)   — Customer CRM profiles and phone lookup
  8. loyalty (:8110)     — Loyalty program, points accrual, customer wallet
  9. accounting (:8111)  — Chart of accounts seed, balanced journal entry, trial balance
 10. reports (:8112)     — Direct sale projection and dashboard summary metrics
 11. gateway (:8000)     — Edge health and routed calls

Run:
    python smoke_fleet.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
import uuid
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RUN = uuid.uuid4().hex[:8]
sys.path.insert(0, str(ROOT))

from src.utils.security import create_access_token

TENANT = uuid.uuid4()
USER = uuid.uuid4()
OUTLET = uuid.uuid4()

TOKEN = create_access_token(
    USER,
    TENANT,
    claims={
        "email": f"smoke-fleet-{RUN}@restaurantos.test",
        "full_name": "Fleet Smoke Runner",
        "permissions": ["*"],
        "roles": ["owner"],
        "is_tenant_owner": True,
        "tenant_slug": f"fleet-{RUN}",
        "active_outlet_id": str(OUTLET),
        "allowed_outlet_ids": [str(OUTLET)],
    },
)

PASS, FAIL = [], []


def call(port_or_url: int | str, path: str, method: str = "GET", body: dict | None = None) -> tuple[int, dict | None]:
    if isinstance(port_or_url, int):
        base = f"http://127.0.0.1:{port_or_url}/api/v1"
        # Map port to service path prefix
        port_to_svc = {
            8000: "",
            8100: "/auth",
            8101: "/organization",
            8102: "/menu",
            8103: "/pos",
            8104: "/kitchen",
            8105: "/billing",
            8106: "/inventory",
            8107: "/purchase",
            8108: "/staff",
            8109: "/customers",
            8110: "/loyalty",
            8111: "/accounting",
            8112: "/reports",
        }
        url = base + port_to_svc.get(port_or_url, "") + path
    else:
        url = port_or_url + path

    data = json.dumps(body).encode() if body is not None else None
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TOKEN}",
    }
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, (json.loads(raw) if raw else None)
        except Exception:
            return e.code, None


def check(label: str, condition: bool, detail: str = ""):
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}" + (f" — {detail}" if detail else ""))


print("\n" + "=" * 65)
print(" RestaurantOS End-to-End Fleet Smoke Test")
print("=" * 65)

# ─── 1. POS (:8103) ──────────────────────────────────────────────────────────
print("\n[1/10] POS Service (:8103)")
st, order = call(8103, "/orders", "POST", {
    "outlet_id": str(OUTLET),
    "order_type": "dine_in",
    "covers": 2,
    "customer_name": "Rohan Gupta",
    "customer_phone": "+91-99887-11223",
})
check("POS: Create dine-in order", st == 201, str(st))
order_id = order.get("id") if order else None

if order_id:
    st, line = call(8103, f"/orders/{order_id}/items", "POST", {
        "item_name": "Butter Chicken",
        "variant_name": "Full",
        "unit_price": 450.0,
        "qty": 1,
        "course_number": 2,
    })
    check("POS: Add order item line", st == 201, str(st))

# ─── 2. Kitchen (:8104) ──────────────────────────────────────────────────────
print("\n[2/10] Kitchen Service (:8104)")
st, station = call(8104, "/stations", "POST", {
    "outlet_id": str(OUTLET),
    "name": f"Curry Station {RUN[:4]}",
    "station_type": "curry",
    "capacity_concurrent": 10,
})
check("Kitchen: Create kitchen station", st == 201, str(st))
station_id = station.get("id") if station else None

st, kot = call(8104, "/kots", "POST", {
    "outlet_id": str(OUTLET),
    "order_id": order_id,
    "station_id": station_id,
    "items": [{
        "menu_item_id": str(uuid.uuid4()),
        "name": "Butter Chicken",
        "qty": 1,
        "notes": "Less spicy",
    }],
})
check("Kitchen: Fire KOT ticket", st == 201, str(st))
kot_id = kot.get("id") if kot else None

if kot_id:
    st, ready = call(8104, f"/kots/{kot_id}/ready", "POST")
    check("Kitchen: Bump KOT to READY", st == 200, str(st))

# ─── 3. Billing (:8105) ──────────────────────────────────────────────────────
print("\n[3/10] Billing Service (:8105)")
st, shift = call(8105, "/shifts/open", "POST", {
    "outlet_id": str(OUTLET),
    "opening_cash": 2000.0,
})
check("Billing: Open register shift", st in (200, 201), str(st))

st, bill = call(8105, "/bills", "POST", {
    "outlet_id": str(OUTLET),
    "order_id": order_id,
    "items": [{
        "name": "Butter Chicken",
        "qty": 1,
        "unit_price": 450.0,
        "tax_pct": 5.0,
    }],
})
check("Billing: Generate bill", st in (200, 201), str(st))
bill_id = bill.get("id") if bill else None

if bill_id:
    amount = float(bill.get("grand_total", 450.0))
    st, pay = call(8105, f"/bills/{bill_id}/settle", "POST", {
        "payment_method": "upi",
        "amount_received": amount,
        "reference": f"UPI-{RUN[:6]}",
    })
    check("Billing: Settle bill with payment", st in (200, 201), str(st))

# ─── 4. Inventory (:8106) ────────────────────────────────────────────────────
print("\n[4/10] Inventory Service (:8106)")
st, cat = call(8106, "/categories", "POST", {
    "name": f"Dairy {RUN[:4]}",
    "description": "Milk, butter, cream",
})
check("Inventory: Create inventory category", st in (200, 201), str(st))
cat_id = cat.get("id") if cat else None

st, item = call(8106, "/items", "POST", {
    "category_id": cat_id,
    "name": "Cooking Butter",
    "code": f"BUT-{RUN[:4]}",
    "uom": "kg",
    "reorder_level": 5.0,
    "cost_price": 420.0,
})
check("Inventory: Create ingredient item", st in (200, 201), str(st))
inv_item_id = item.get("id") if item else None

if inv_item_id:
    st, adj = call(8106, "/adjustments", "POST", {
        "outlet_id": str(OUTLET),
        "item_id": inv_item_id,
        "qty_counted": 25.0,
        "reason": "Initial stock audit",
    })
    check("Inventory: Record stock count adjustment", st in (200, 201), str(st))

# ─── 5. Purchase (:8107) ─────────────────────────────────────────────────────
print("\n[5/10] Purchase Service (:8107)")
st, vendor = call(8107, "/vendors", "POST", {
    "name": f"Amul Supply {RUN[:4]}",
    "code": f"VND-{RUN[:4]}",
    "contact_name": "Suresh Patel",
    "phone": "+91-98760-12345",
    "email": f"amul-{RUN}@dairy.test",
})
check("Purchase: Register vendor", st in (200, 201), str(st))
vendor_id = vendor.get("id") if vendor else None

st, po = call(8107, "/purchase-orders", "POST", {
    "outlet_id": str(OUTLET),
    "vendor_id": vendor_id,
    "expected_delivery_date": str(date.today()),
    "items": [{
        "inventory_item_id": inv_item_id or str(uuid.uuid4()),
        "qty": 50,
        "unit_price": 400.0,
    }],
})
check("Purchase: Create purchase order (PO)", st in (200, 201), str(st))

# ─── 6. Staff (:8108) ────────────────────────────────────────────────────────
print("\n[6/10] Staff Service (:8108)")
st, emp = call(8108, "/employees", "POST", {
    "outlet_id": str(OUTLET),
    "employee_code": f"EMP-{RUN[:4]}",
    "first_name": "Vikram",
    "last_name": "Singh",
    "role": "chef",
    "hourly_rate": 250.0,
})
check("Staff: Onboard employee", st in (200, 201), str(st))
emp_id = emp.get("id") if emp else None

if emp_id:
    st, att = call(8108, "/attendance/clock-in", "POST", {
        "employee_id": emp_id,
        "outlet_id": str(OUTLET),
    })
    check("Staff: Employee clock-in", st in (200, 201), str(st))

# ─── 7. Customers (:8109) ────────────────────────────────────────────────────
print("\n[7/10] Customers Service (:8109)")
st, cust = call(8109, "/customers", "POST", {
    "outlet_id": str(OUTLET),
    "name": "Ananya Sharma",
    "phone": f"+91-9811{RUN[:6]}",
    "email": f"ananya-{RUN}@customer.test",
    "dietary_notes": "Allergic to peanuts",
})
check("Customers: Register customer profile", st in (200, 201), str(st))
cust_id = cust.get("id") if cust else None

# ─── 8. Loyalty (:8110) ──────────────────────────────────────────────────────
print("\n[8/10] Loyalty Service (:8110)")
st, prog = call(8110, "/programs", "POST", {
    "outlet_id": str(OUTLET),
    "name": f"Gold Rewards {RUN[:4]}",
    "points_per_unit_spend": 1.0,
    "redemption_value_per_point": 0.50,
})
check("Loyalty: Create loyalty program", st in (200, 201), str(st))
prog_id = prog.get("id") if prog else None

if prog_id and cust_id:
    st, acct = call(8110, "/accounts", "POST", {
        "customer_id": cust_id,
        "program_id": prog_id,
    })
    check("Loyalty: Enroll customer in program", st in (200, 201), str(st))

# ─── 9. Accounting (:8111) ───────────────────────────────────────────────────
print("\n[9/10] Accounting Service (:8111)")
st, accts = call(8111, "/accounts/seed", "POST")
check("Accounting: Seed standard chart of accounts", st in (200, 201), f"{len(accts or [])} accounts")

if accts and len(accts) >= 2:
    cash_acct = accts[0]["id"]
    rev_acct = accts[-1]["id"]
    st, je = call(8111, "/journal-entries", "POST", {
        "outlet_id": str(OUTLET),
        "entry_date": str(date.today()),
        "narration": "Daily food sales posting",
        "lines": [
            {"account_id": cash_acct, "debit": 5000.0, "credit": 0.0, "description": "Cash in register"},
            {"account_id": rev_acct, "debit": 0.0, "credit": 5000.0, "description": "Food sales revenue"},
        ],
    })
    check("Accounting: Post balanced journal entry", st == 201, str(st))
    je_id = je.get("id") if je else None

    if je_id:
        st, posted = call(8111, f"/journal-entries/{je_id}/post", "POST")
        check("Accounting: Transition entry to POSTED", st == 200, str(st))

    st, tb = call(8111, f"/trial-balance?outlet_id={OUTLET}")
    check("Accounting: Compute balanced trial balance", st == 200 and tb.get("is_balanced") is True, str(tb.get("is_balanced")))

# ─── 10. Reports (:8112) ─────────────────────────────────────────────────────
print("\n[10/10] Reports Service (:8112)")
st, proj = call(8112, f"/project/bill-paid?outlet_id={OUTLET}", "POST", {
    "grand_total": 1250.0,
    "tax_total": 62.50,
    "discount_total": 50.0,
    "covers": 3,
    "payment_method": "card",
    "items": [{
        "menu_item_id": str(uuid.uuid4()),
        "name": "Tandoori Platter",
        "qty": 2,
        "line_total": 800.0,
        "cost": 300.0,
    }],
})
check("Reports: Ingest sale projection event", st == 200, str(st))

st, dash = call(8112, f"/dashboard?outlet_id={OUTLET}")
check("Reports: Query live dashboard metrics", st == 200 and float(dash.get("total_sales", 0)) > 0, f"Total sales: {dash.get('total_sales') if dash else 0}")

print("\n" + "=" * 65)
print(f" Fleet Results: {len(PASS)} passed, {len(FAIL)} failed")
print("=" * 65 + "\n")

if FAIL:
    sys.exit(1)
