# PetPooja Screen Coverage → RestaurantOS Backend Design

Source: `pet pooja.docx` (102 screenshots, no text — extracted to `/_petpooja_media/NNN.png`).
Method: every screen cataloged (module, layout, fields, buttons, workflow, implied data), then mapped against a static route inventory of all 14 services + gateway + event bus.

Status legend: ✅ covered · ⚠️ partial · ❌ missing (new work)

---

## 1. Coverage matrix (screen group → module)

| Screens | PetPooja area | Owning module today | State |
|---|---|---|---|
| login, dashboard, POS "New Order" (dine-in/delivery/pickup), bill drawer, split, hold, KOT&Print | POS | `pos` (26 routes: orders, lines, split, merge, hold, resume, void, cancel, tip, table-sessions, reservations, waitlist) | ✅ |
| Invoice list/detail/print/PDF, settlements, send email/WA, void/cancel, reminders | `billing` invoices (75 routes incl. `invoice.pdf`, `settlement`, `sales-returns`, coupons, discounts, tip-configs, shifts, tax-codes, gateways: razorpay/pinelabs, print-templates, receipts/{id}/print) | ✅ |
| Bulk Purchase Bill Payments (From: supplier, date range, settle) | `purchase` vendor-bills (26 routes: PR/PO/GRN 3-way match, vendor-bills/{id}/payments, credit-note, qc) | ✅ |
| Goods Received, PO, PR, vendors, vendor items | `purchase` + `inventory` procurement (suppliers, quotations, purchase-returns, credit/debit notes, OCR extract-*, analytics/spend, lead-time) | ✅ |
| Consumption → Sales, Transfer (challan), Wastage, Adjustments, Stock In, Expiry | `inventory` (113 routes: /deduct-recipe, /transfers, /items/{id}/wastage, /adjustments(+decide), /items/{id}/stock-in, /batches, /expiry-scan, /value, /global-rollup, /items/low) | ✅ |
| Barcode generation (raw materials, bulk upload, print config), QR | `inventory` api_barcode (127+ routes: /barcodes, /barcodes/generate(+bulk), /barcodes/batch-print, /products/barcode/{raw}, /expiry/summary) | ✅ |
| Raw Materials / Item Recipes / Suppliers masters | `inventory` items+categories+locations, `menu` recipes (/items/{id}/recipe-breakdown, /recipes, AI-recipe-*), `purchase` vendors | ✅ |
| Menu: item form (categories, UOM, pricing, combos, addons, KOT routes, print groups, GST/HSN), combos, KOT-by-number | `menu` (43 routes) + `kitchen` stations (19: kots, kots/poll, kds-devices, stations, KOT history/bump/refire) | ✅ |
| Table Management (floor sections, add table, table types, status colors, Move KOT/Items, Contactless, Table Reservation) | `organization` tables/sections/floor-plans (40 routes: /tables/{id}/status, /tables/bulk-status, floor-plans+restore, royalty) + `pos` table-sessions/reservations/waitlist | ✅ |
| Kitchen KDS (by station, by number, item-level ready/served, rush/bump) | `kitchen` | ✅ |
| Sales Return (from supplier/restaurant/kitchen, credit note, "Update Inventory Stock" toggle) | `billing` /sales-returns + /items returns | ✅ |
| Advance Orders (pre-scheduled "New Order") | `pos` | ⚠️ needs scheduled orders (P1) |
| Online Delivery dispatch (live delivery-boy board) + Delivery Boy master + Delivery Areas | — | ❌ new `delivery` service (P2) |
| Due Payment (AR by restaurant, due amounts) | `accounting` /financial-reports/ar-aging + `billing` invoices customer-summary | ⚠️ thin AR-by-outlet endpoint (P4) |
| Cash Flow ("All Wallets" IN/OUT/NET/BALANCE 30d), Expenses (entry+report), Withdrawal (entry+approve) | `accounting` has expense-claims (staff), bank accounts, cash-flow statement | ❌ operational expense ledger + withdrawals + multi-source cash-flow summary (P4) |
| Currency Conversion (Exchange Rate Book USD/INR effective dates) | — | ❌ exchange-rate book in accounting (P4) |
| Production Master (process → raw material + qty + UOM), Production Execution (send to production, convert, raise direct PO, production plan, via Excel) | — | ❌ new `production` service (P3) |
| Virtual Wallet (customer prepaid balance, topup, txn list) | `loyalty` wallets (16 routes: /wallets, /wallets/{id}/credit, /wallets/{id}/transactions) | ✅ |
| Loyalty / points | `loyalty` programs/accounts/redeem/adjust/reconcile | ✅ |
| Subscriptions: plan cards (FREE/STARTER/PRO, feature limits) | `platform` (TenantModuleState module gating, 67 RBAC perms) | ❌ SaaS plan entities + tenant↔plan link (P5) |
| Device Registration (KDS/POS devices, polling) | `kitchen` /kds-devices + /kots/poll | ✅ |
| Reports (Report Center: Current Stock (valued), Purchase, Sales, GST, custom saved reports, export) | `reports` (only 5 routes: dashboard/sales/hourly/items/project) + `accounting` gst-summary/trial-balance/pnl | ❌ expansion + custom report builder (P6) |
| HRMS: employees, attendance, leaves, payroll, recruitment, analytics | `staff` (comprehensive: departments, designations, teams, work-calendars, companies, branches, roles, resignations, clearance, settlements, experience-letters, leaves+balances+policies, analytics, recruitment jobs/applicants, offer letters) | ✅ |
| Settings (outlet, GST/FSSAI profile, tax codes, service charge, tip, currency, print templates) | `organization` + `billing` tax-codes/service-charges/tip-configs + print-templates + `auth` | ✅ (receipts settings page already built in tree) |
| Marketing (if in screens 1–40: campaigns/offers/banners/SMS-WA) | `billing` coupons/discounts + `loyalty` | ❌ confirm from catalog → `marketing` service (P7) |

---

## 2. Cross-module event wiring (as-is, verified)

Publishers → consumers already in place:
- `order.placed` → kitchen (KOT create, idempotent on order+station+line hash), kitchen outbox-durable
- `order.cancelled` → kitchen (cancel KOTs), inventory (release BOM consumption), pos void flow
- `order.status.changed` → kitchen (close KOTs on served/settled/cancelled), billing (void draft bills)
- `bill.paid` (payload: order_id, lines[menu_item_id,qty], GST split, covers, cash/card) → accounting (auto journal + tax payables + COGS), inventory (BOM deduction via menu recipe resolve, wastage, low-stock), loyalty (points + wallet), customers (visit/summary), staff tips, reports projection, gateway dashboard
- `grn.posted` → accounting, purchase, inventory
- `stock.out`/`stock.low` → purchase (reorder)
- `wastage.recorded`, `adjustment.approved` → accounting
- `menu.item.updated/deactivated` → pos (annotate open lines)
- `table_session.opened/closed` → (consumers: none yet ⚠️)
- `kot.ready/served` → reports only ⚠️ (no kitchen→POS feedback)

Known broken links (fix in P0, one-line + 3 consumers):
1. **Redis port mismatch** — `backend/.env` has `REDIS_URL=redis://localhost:6380` but Redis runs on **6379** → bus "degraded", all cross-service events lost between processes.
2. KOT `served` → POS order → `served` (no consumer)
3. `bill.paid` → POS order → `settled` + close table session (no consumer)
4. dine-in `order.placed` → organization table → occupied; `bill.paid`/session close → free (no consumer)
5. Every transition above must also write the **per-service outbox** (durable, per tenant+outlet) — "everything logged per org."

## 3. New domains (detailed design)

### P0 — flow closure (no new service)
- POS: `@bus.on("kot.served")` → `svc.update_order_status(order→SERVED)` (ALLOWED sets already permit it), emit `order.status.changed`
- POS: `@bus.on("bill.paid")` where `status=settled` → order→SETTLED + close its TableSession (emit `table_session.closed`)
- Organization: new consumer module (`src/services/organization/events.py`, register in main like accounting/events.py) — `@bus.on("order.placed")` dine-in→table OCCUPIED, `@bus.on("bill.paid")`→BILLING, `@bus.on("table_session.closed")`→FREE; each change via `record_event(...)` outbox (pattern at organization/api.py:415)
- Fix `.env` REDIS_URL port; verify with `scripts/probe_eventbus.py` (exit 0 = cross-process delivery)

### P1 — `pos` extensions: advance orders
- `Order.scheduled_for: DateTime|None` + `OrderStatus.SCHEDULED` (insert in enum + `ALLOWED_FROM_SCHEDULED={PLACED, CANCELLED}`)
- `POST /orders` accepts `scheduled_for` → order stays SCHEDULED, KOT NOT fired
- `POST /orders/scheduled/activate` (scheduler endpoint; fires due orders → PLACED + `order.placed` outbox so kitchen/inventory react on time) + `GET /orders/scheduled`
- Gateway: expose under `/api/v1/pos/...` (already routed)

### P2 — new service `delivery` (db `restaurantos_delivery`, registry entry, module_key `delivery`)
Models:
- `DeliveryBoy` (tenant, outlet, name, phone, email, area, active, status)
- `DeliveryZone` (outlet, name, area_code, pincode, min/max distance, radius_m)
- `Delivery` (order_id, boy_id, zone_id, address, phone, notes, fee, tip, status: ASSIGNED|PICKING|OUT_FOR_DELIVERY|DELIVERED|CANCELLED|RETURNED, assigned_at/picked_at/delivered_at, cancel_reason)
- `DeliveryStatusLog`
API: `GET/POST /delivery-boys`, `PATCH /delivery-boys/{id}`, `GET/POST /zones`, `POST /orders/{order_id}/dispatch` (assign), `POST /deliveries/{id}/{transition}`, `GET /deliveries?live=1` (board, last_updated), `GET /deliveries/{id}`
Events: publish `delivery.assigned`, `delivery.out_for_delivery`, `delivery.delivered`, `delivery.cancelled` (outbox); consume `order.placed` (order_type=DELIVERY → auto-assign or queue), `order.cancelled` (cancel dispatch).
RBAC codes: `delivery:boys:manage`, `delivery:dispatch:manage`, `delivery:board:view`.

### P3 — new service `production` (db `restaurantos_production`)
Models:
- `ProductionProcess` (name, output: inventory item+qty+uom, raw lines [{item_id, qty, uom}], yield_pct, active)
- `ProductionRun` (process_id, batch_no, status PLANNED|RUNNING|COMPLETED|CANCELLED, scheduled_at, started/completed, output_qty, loss_qty, source: manual|excel|plan, po_id?)
- `ProductionPlanLine` (date, process_id, planned_qty)
API: CRUD `/processes`; `POST /runs` ("Send Selected To Production"); `POST /runs/{id}/complete` (emit stock moves); `POST /runs/{id}/raise-po` (HTTP call → purchase `/purchase-orders` direct PO, record po_id); `POST /plans/generate` (forecast from reports sales/hourly + stock-low items → `stock.low`); `POST /runs/import-excel`
Events: publish `production.run.completed` (payload: raw deductions, output additions) → **inventory** consumes → `stock-in`/adjustments (inventory owns the stock ledger, same pattern as bill.paid→consumption).

### P4 — `accounting` extensions
- `ExpenseCategory` + `Expense` (expense_no, date, description, category_id, payment_mode CASH|CARD|BANK|UPI, amount, account_id, recorded_by) — auto journal (debit expense / credit cash/bank) reusing JournalEntry machinery; `POST /expenses`, `GET /expenses`
- `Withdrawal` (date, amount, method, account_id, note, approved_by, status) with `POST /withdrawals/{id}/approve`; auto journal
- `ExchangeRate` (from_currency, to_currency, rate, effective_date) + `GET /exchange-rates/current`; billing/invoices use rate for currency conversion (currency conversion screen)
- `GET /cash-flow/summary` ("All Wallets": cash drawers from billing shifts + bank accounts + customer wallets → IN/OUT/NET/BALANCE, 30d window)
- `GET /receivables/summary` (due by outlet/restaurant for Due Payment screen)
Events: publish `expense.recorded`, `withdrawal.recorded` → reports projection.

### P5 — `platform` plan entities
- `Plan` (FREE/STARTER/PRO: limits — outlet_count, user_count, module entitlements, price, period), `TenantPlan` (tenant_id, plan_id, status, period_start/end, renews_at)
- `GET /plans`, `POST /tenants/{id}/plan`, `POST /tenants/{id}/plan/renew` → rewrites `TenantModuleState` rows (existing module gating stays state-driven) + outbox `tenant.plan.changed`
- Plan card page = `GET /platform/plans` + active plan for tenant.

### P6 — `reports` expansion
- Consume more topics: `grn.posted`, `purchase.*`, `expense.recorded`, `production.run.completed`, `delivery.delivered`
- New endpoints: `GET /reports/stock/current` (proxy aggregation of inventory /value + global-rollup), `/reports/purchase` (vendor-bill/GRN from purchase), `/reports/gross-profit` (sales − COGS from accounting), `/reports/gst-summary` (delegate accounting), custom report builder: `ReportDefinition` (name, module, metric keys, filters, owner, shareable) + `POST /reports/{id}/run` (+CSV export)
- `kot.ready` already consumed for KPI dashboards.

### P7 — `marketing` service (only if screens 1–40 confirm campaigns/banners/offer UIs)
- Campaigns (SMS/WhatsApp/Email), message templates, offer rules (coupons live in billing — marketing references coupon_id), banners, send logs; consume `bill.paid` (trigger sends), `customer.created` (welcome offers).

---

## 4. Integration plumbing for new services (follow existing patterns exactly)

- Registry: `src/services/shared/registry.py` — add `ServiceDescriptor(name, port=_port(name, 8100, <next free offset>), db_name="restaurantos_<name>", module_key=..., publishes=..., subscribes=...)`
- App skeleton: `build_service(name, [router], on_startup=..., tags=...)` from `shared/service_factory` (pos/main.py is the reference: OutboxRelay wiring + `install_service_ledger`)
- Outbox: copy `outbox.py` per service (POS template verified: record_event in-txn + relay 1s poll, `with_for_update(skip_locked)`, MAX_RETRIES=5 → dead)
- Event bus: consumer loop + dedupe ledger already shared; each service own consumer group
- Gateway: auto-proxy via registry; module gate via TenantModuleState (platform `GET /tenants/me/modules` drives ribbon hiding — keep new modules there too)
- RBAC: new permission codes registered in platform `PermissionCatalogue`; enforce via `identity.require("<code>")` in routes (existing pattern)
- Migrations: `python run_services.py migrate` + startup schema checks (organization/main.py ALTER pattern)

## 5. Build order & verification

P0 (1 line + 4 consumers) → P1 → P2 ∥ P3 (independent, fan out) → P4 → P5 → P6 → P7
After each service: pyflakes clean, `run_services.py start/status`, `scripts/probe_eventbus.py` exit 0, E2E script per domain (test_pos_flow.py pattern): place dine-in → KOT fires → served → bill settled → table free + inventory consumed; delivery: order→dispatch→out→delivered; production: process→run→PO raised→stock moves; finance: expense/withdrawal → journals + cash-flow summary.

---

## 6. Open items
- Screens 1–40 full catalog (agent) → confirm marketing scope (P7) and any dashboard KPIs missing from reports
- Finance-domain gap audit (agent) → exact model deltas for P4
- Ops-domain gap audit (agent) → confirm P2/P3/P1 model deltas before code
