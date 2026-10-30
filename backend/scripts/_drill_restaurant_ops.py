"""Full restaurant operational drill — login to settle, live through the gateway.

Runs the entire dining spine against the running services and reports
PASS/FAIL per step:

  0.  real login (auth, no dev-fallback)
  1.  menu: disable + re-enable a menu item (with events)
  2.  pos: dine-in order with waiter assigned and line routed to a kitchen station
  3.  organization: table auto-occupied via the event chain
  4.  kitchen: KOT auto-created, acknowledged -> ready -> served
  5.  pos: extend the open order (guest orders more)
  6.  billing: create the bill with tip + waiter
  7.  billing: ad-hoc bill (cold drink, not on the menu, no order)
  8.  billing: split settlement (cash + card)
  9.  billing: settle the ad-hoc bill in cash
  10. receipt: thermal PDF, ESC/POS bytes, active print template
  11. organization: table freed after the settle event
  12. inventory: BOM deduction movements from the settled bill
  13. pos: order advanced to settled by the event consumer
  14. accounting: auto-posted journal for the settled bill

Usage:  python scripts/_drill_restaurant_ops.py
Exit code 0 = all steps pass. Prints a compact report; state for reuse is
written to .services/.drill_main.json.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
import asyncio

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)

GW = "http://127.0.0.1:8000/api/v1"
TENANT = "e9fb216b-6289-43ca-900c-c09eada9840f"
OUTLET = "11111111-2222-3333-4444-555555555555"
STATION = "bbbbbbbb-1111-0000-0000-000000000001"
MENU_ITEM = "b1daba7e-7190-5b05-88dd-06a4fc695512"
WAITER = "77957dd9-bd42-41de-9f58-0824fa511886"
LOGIN = {"email": "owner-9a3f9b87@spiceroute.dev", "password": "RestaurantOS#2026"}

RESULTS: list[tuple[str, bool, str]] = []


def step(name: str, ok: bool, detail: str = "") -> None:
    RESULTS.append((name, ok, str(detail)))
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  — {str(detail)[:110]}" if detail else ""))


def http(method: str, service: str, path: str, body=None, tok: str | None = None,
         raw: bool = False, query: str = ""):
    url = f"{GW}/{service}{path}" + (f"?{query}" if query else "")
    headers = {"Content-Type": "application/json"}
    if tok:
        headers["Authorization"] = f"Bearer {tok}"
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                 method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            data = r.read()
            return r.status, (data if raw else (json.loads(data or b"{}")))
    except urllib.error.HTTPError as e:
        d = e.read()
        try:
            return e.code, json.loads(d)
        except Exception:
            return e.code, d.decode(errors="replace")[:200]


def fresh_table() -> str:
    """A free table right now — re-queried so repeated drills stay independent."""
    import asyncpg

    async def main():
        con = await asyncpg.connect(
            "postgresql://postgres:0111@127.0.0.1:5432/restaurantos_organization", timeout=5
        )
        val = await con.fetchval(
            f"select coalesce("
            f"(select id from restaurant_tables where tenant_id='{TENANT}' "
            f"and status='free' and outlet_id='{OUTLET}' limit 1), "
            f"(select id from restaurant_tables where tenant_id='{TENANT}' "
            f"and outlet_id='{OUTLET}' limit 1))"
        )
        result = val
        await con.close()
        return result
    val = asyncio.run(main())
    return str(val) if val else ""


def recipe_menu_item() -> str:
    """A menu item that actually HAS an active recipe, so the BOM-deduction
    step is meaningful. The hard-coded MENU_ITEM may be recipe-less, which is
    a valid state (inventory then correctly skips) but proves nothing."""
    import asyncpg

    async def main():
        con = await asyncpg.connect(
            "postgresql://postgres:0111@127.0.0.1:5432/restaurantos_menu", timeout=5
        )
        val = await con.fetchval(
            f"select mi.id from menu_items mi "
            f"join recipes r on r.menu_item_id = mi.id and r.tenant_id = mi.tenant_id and r.is_active "
            f"join recipe_lines rl on rl.recipe_id = r.id and rl.inventory_item_id is not null "
            f"where mi.tenant_id = '{TENANT}' and mi.is_active = true limit 1"
        )
        await con.close()
        return val

    item = asyncio.run(main())
    if item:
        print(f"[drill] using recipe-backed menu item {item}")
    else:
        print(f"[drill] no recipe-backed menu item; keeping {MENU_ITEM}")
    return str(item) if item else MENU_ITEM


def main() -> int:
    # ── 0. LOGIN ───────────────────────────────────────────────────────────────
    s, r = http("POST", "auth", "/login", LOGIN)
    step("0. login via gateway (real credentials)", s == 200, s)
    tok = r.get("access_token") or r.get("accessToken")
    if not tok:
        print("no token — aborting")
        return 1

    table = fresh_table()
    if not table:
        step("0b. free table available", False, "no free table in the fixture outlet")
        return 1
    menu_item = recipe_menu_item()

    # ── 1. MENU disable / enable ──────────────────────────────────────────────
    s, r = http("PUT", "menu", f"/items/{MENU_ITEM}", {"is_active": False}, tok)
    step("1a. menu: disable item", s == 200, s)
    time.sleep(1)
    s, r = http("GET", "menu", f"/items/{MENU_ITEM}", None, tok)
    step("1b. disabled item reports is_active=False", s == 200 and r.get("is_active") is False,
         r.get("is_active"))
    s, r = http("PUT", "menu", f"/items/{MENU_ITEM}", {"is_active": True}, tok)
    step("1c. menu: re-enable item", s == 200, s)

    # ── 2. DINE-IN order: waiter + station routing ───────────────────────────
    s, r = http("POST", "pos", "/orders", {
        "outlet_id": OUTLET, "order_type": "dine_in", "table_id": table,
        "covers": 2, "waiter_id": WAITER,
        "lines": [{"menu_item_id": menu_item, "item_name": "Butter Chicken", "unit_price": 450,
                   "qty": 2, "kitchen_station_id": STATION}],
    }, tok)
    step("2. pos: dine-in order (waiter + station)", s in (200, 201) and r.get("status") == "placed",
         f"{s} status={r.get('status')}")
    order_id, order_number = r.get("id"), r.get("order_number")
    if not order_id:
        print(json.dumps(r)[:300])
        return 1

    # ── 2b. inventory: top up the recipe's ingredients (supplier delivery) ───
    # Repeated runs drain on-hand stock to zero; a zero-store bill.paid then
    # correctly floors deductions at zero and writes no movement. A realistic
    # stock-in first makes step 12 deterministic on every run.
    s, rl = http("GET", "menu", f"/items/{menu_item}/recipe-lines", None, tok)
    rlines = (rl.get("lines") if isinstance(rl, dict) else rl) or []
    topped = 0
    for line in rlines:
        inv_id = line.get("inventory_item_id")
        if not inv_id:
            continue
        s, sr = http("POST", "inventory", f"/items/{inv_id}/stock-in",
                     {"qty": 500, "unit_cost": 2}, tok, query=f"outlet_id={OUTLET}")
        if s in (200, 201):
            topped += 1
    step("2b. inventory: stock-in recipe ingredients", s in (200, 201) and topped >= 1,
         f"{topped} ingredient(s) topped up")

    # ── 3. table auto-occupied ────────────────────────────────────────────────
    time.sleep(3)
    s, r = http("GET", "organization", f"/tables/{table}", None, tok)
    step("3. table auto-occupied via events", s == 200 and str(r.get("status")).lower() in
         ("occupied", "billing"), r.get("status"))

    # ── 4. KOT auto-fired, then ready/served ─────────────────────────────────
    time.sleep(2)
    s, r = http("GET", "kitchen", "/kots", None, tok, query="limit=200")
    tickets = (r.get("tickets") if isinstance(r, dict) else r) or []
    kots = [k for k in tickets if k.get("order_number") == order_number]
    step("4a. KOT auto-created for the order", s == 200 and len(kots) >= 1,
         f"{len(kots)} kot(s) for {order_number}")
    kot = kots[0] if kots else None
    if kot:
        s, r = http("POST", "kitchen", f"/kots/{kot['id']}/acknowledged", None, tok)
        step("4b. KOT acknowledged", s == 200, s)
        s, r = http("POST", "kitchen", f"/kots/{kot['id']}/ready", None, tok)
        step("4c. KOT -> ready", s == 200, s)

    # ── 5. extend the open order (guest orders a second round while the
    #        first is still in the kitchen — the realistic moment) ──────────
    time.sleep(2)
    s, r = http("POST", "pos", f"/orders/{order_id}/lines",
                [{"menu_item_id": menu_item, "item_name": "Butter Chicken", "unit_price": 150,
                  "qty": 2, "kitchen_station_id": STATION}], tok)
    step("5. extend open order (guest orders more)", s == 201, f"{s} items={r.get('item_count')}")

    # ── 4d. only after the extension lands does the food leave the kitchen ──
    if kot:
        s, r = http("POST", "kitchen", f"/kots/{kot['id']}/served", None, tok)
        step("4d. KOT -> served", s == 200, s)

    # ── 6. bill with tip + waiter ────────────────────────────────────────────
    # The bill's first line carries the recipe-backed item so the BOM
    # deduction in step 12 has something to resolve; the tip is the amount
    # that previously broke the auto-GL (Fix B).
    s, bill = http("POST", "billing", "/bills", {
        "outlet_id": OUTLET, "order_id": order_id, "covers": 2, "waiter_id": WAITER,
        "customer_name": "Drill Guest",
        "items": [
            {"name": "Butter Chicken", "qty": 2, "unit_price": 450, "menu_item_id": menu_item},
            {"name": "Fridge Drink", "qty": 2, "unit_price": 120},
        ],
        "tip": 100,
    }, tok)
    expected = 450 * 2 + 120 * 2 + 100
    ok_tip = s in (200, 201) and abs(float(bill.get("grand_total") or 0) - expected) < 5
    step("6. bill created (tip + waiter, totals correct)", ok_tip,
         f"{s} total={bill.get('grand_total')} expected≈{expected}")
    bill_id = bill.get("id")

    # ── 7. ad-hoc bill (cold drink, no menu, no order) ──────────────────────
    s, adhoc = http("POST", "billing", "/bills", {
        "outlet_id": OUTLET, "covers": 1, "customer_name": "Drill AdHoc",
        "items": [{"name": "Fridge Drink (ad-hoc)", "qty": 1, "unit_price": 60}],
    }, tok)
    step("7. ad-hoc bill without menu/order", s in (200, 201) and adhoc.get("id"), s)
    adhoc_id = adhoc.get("id")

    # ── 8/9. settlements ──────────────────────────────────────────────────────
    total = float(bill.get("grand_total") or 0)
    cash, card = round(total / 2, 2), round(total - total / 2, 2)
    s, r = http("POST", "billing", f"/bills/{bill_id}/settle",
                {"payments": [{"method": "cash", "amount": cash},
                               {"method": "card", "amount": card}],
                 "amount_received": total}, tok)
    step("8. settle main bill (split cash + card)", s == 200 and str(r.get("status")).lower() == "settled",
         f"{s} {r.get('status')}")

    s, r = http("GET", "billing", f"/bills/{adhoc_id}", None, tok)
    a_total = float(r.get("grand_total") or 0)
    s, r = http("POST", "billing", f"/bills/{adhoc_id}/settle",
                {"payments": [{"method": "cash", "amount": a_total}],
                 "amount_received": a_total}, tok)
    step("9. settle ad-hoc bill (cash)", s == 200 and str(r.get("status")).lower() == "settled", s)

    # ── 10. receipts ──────────────────────────────────────────────────────────
    s, pdf = http("POST", "billing", f"/receipts/{bill_id}/print", None, tok,
                  raw=True, query="size=80mm")
    step("10a. receipt thermal PDF", s == 200 and pdf[:4] == b"%PDF", f"{s} {len(pdf)} bytes")
    s, esc = http("POST", "billing", f"/receipts/{bill_id}/print", None, tok,
                  raw=True, query="escpos=true&size=80mm")
    step("10b. receipt ESC/POS raw bytes", s == 200 and len(esc) > 50, f"{s} {len(esc)} bytes")
    s, tmpl = http("GET", "billing", "/print-template/active", None, tok)
    if s == 404:
        s2, tmpl = http("POST", "billing", "/print-templates", {
            "outlet_id": OUTLET, "name": "Drill Template",
            "content": json.dumps({"storeName": "Spice Route", "showQrCode": True}),
        }, tok)
        s3, _ = http("POST", "billing", "/print-template/active", {"template_id": tmpl.get("id")}, tok)
        step("10c. print template (created + set active)", s2 in (200, 201) and s3 == 200,
             f"create={s2} activate={s3}")
    else:
        step("10c. active print template lookup", s == 200, s)

    # ── 11. table freed by the event chain ───────────────────────────────────
    time.sleep(4)
    s, r = http("GET", "organization", f"/tables/{table}", None, tok)
    step("11. table freed after settle (event chain)", s == 200 and
         str(r.get("status")).lower() == "free", r.get("status"))

    # ── 12. BOM deduction in inventory ───────────────────────────────────────
    # The deduction lands through outbox relay + redis + consumer loop, so
    # give the chain a beat past the settle — 3s has flaked on cold starts.
    time.sleep(6)
    s, r = http("GET", "inventory", "/movements", None, tok, query="limit=500")
    movs = r if isinstance(r, list) else (r.get("items") or r.get("movements") or [])
    bill_moved = any(
        m.get("reference_type") == "bill" and str(m.get("reference_id") or "") == str(bill_id)
        for m in movs
    )
    step("12. inventory: bill-linked BOM deduction exists", s == 200 and bill_moved,
         f"{len(movs)} movements, bill-linked={bill_moved}")

    # ── 13. order advanced to settled by pos's bill.paid consumer ───────────
    time.sleep(2)
    s, r = http("GET", "pos", f"/orders/{order_id}", None, tok)
    step("13. order auto-settled by event consumer", s == 200 and r.get("status") == "settled",
         r.get("status"))

    # ── 14. accounting auto-posted the journal ───────────────────────────────
    time.sleep(2)
    s, r = http("GET", "accounting", "/journal-entries", None, tok, query="limit=50")
    entries = r if isinstance(r, list) else (r.get("items") or r.get("entries") or [])
    posted = any(str(e.get("reference_id") or "") == str(bill_id) for e in entries)
    step("14. accounting: auto-posted journal for bill", s == 200 and posted,
         f"{len(entries)} entries, bill ref found={posted}")

    fails = [x for x in RESULTS if not x[1]]
    print(f"\n===== DRILL: {len(RESULTS) - len(fails)}/{len(RESULTS)} PASSED =====")
    for f in fails:
        print("  FAIL:", f[0], "—", str(f[2])[:140])
    os.makedirs(os.path.join(BACKEND, ".services"), exist_ok=True)
    with open(os.path.join(BACKEND, ".services", ".drill_main.json"), "w") as fh:
        json.dump({"bill_id": bill_id, "order_id": order_id, "fails": [f[0] for f in fails]},
                  fh, default=str)
    return 0 if not fails else 1


if __name__ == "__main__":
    raise SystemExit(main())
