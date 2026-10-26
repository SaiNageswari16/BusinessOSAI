# RestaurantOS — Execution Plan (Backend-First)

**Date:** 2026-10-25 · **Status:** Ready to execute · **Reference app:** `C:\Users\abhil\Desktop\businessosai\BusinessOSAI` (retail ERP, copy-source for commerce features)
**Companion docs:** `PLAN.md` (original architecture plan), `docs/BACKEND_ARCHITECTURE.md`, `AI-RECIPE-HANDOFF.md`

---

## 0. The Big Picture — where RestaurantOS is headed

**End state (12+ months):** a complete multi-outlet restaurant ERP with:
- **Commerce spine:** invoices → GST/e-invoice → receipts (80mm thermal + A4) → day close → accounting GL → financial reports
- **Full inventory:** master catalog, product variants, barcodes/QR/RFID, procurement (POs/GRN/vendor bills), par & reorder intelligence
- **Restaurant core:** KOT/kitchen with live tracking, floor & table ops, aggregators (zomato/swiggy), reservations
- **People:** the full HRMS suite (already the deepest module — 314 routes)
- **Growth layer:** CRM (53 frontend calls waiting), marketplace, social/WhatsApp marketing, notifications
- **Platform:** super-admin control plane (modules, RBAC, audit) with real enforcement
- **AI layer:** recipe RAG (done), HR intelligence (done), ops copilots, cost/smart-shift prediction

**The single biggest structural fact:** the *backend is ahead of the frontend in places and behind in others*. 305 of 405 frontend API calls have no route; 439 backend routes have no UI consumer. This plan closes both gaps in one sweep, backend-first.

**Execution principle:** every phase ships (a) working backend routes, (b) the frontend calls that were dead coming back to life with **zero frontend rework** where possible, (c) a verification pass (pyflakes + app build + live curl), and (d) docs updated in the same commit.

---

## Phase 0 — Stabilize (what's broken today)

Goal: no 500s on existing surfaces. **~1–2 days, backend only.**

| # | Task | Where | Notes |
|---|------|-------|------|
| 0.1 | Fix `/hrms/attendance/{biometric,face-logs,corrections}` path mismatch | `staff/api/attendance.py` | Frontend calls the nested path; router (prefix `/hrms`) serves flat. Add nested variants (or re-prefix). Trivial, kills 6 live 404s. |
| 0.2 | Register gateway aliases | `shared/registry.py` + `gateway/app.py` | `tax|financial-reports|bank|fixed-assets|budgets|expense-claims` → accounting; `invoices|payments|sales-returns` → billing; `analytics` → reports; `system/notifications|copilot` → new thin services or 404-with-hint later. Kills ~30 dead calls instantly. |
| 0.3 | Re-nest `/inventory/procurement/*` | `inventory/api.py` | 26 frontend calls hit `/inventory/procurement/...`; data lives in the purchase service. Either alias the purchase router under `/inventory/procurement` on the purchase app, or add a proxy module in inventory that forwards via mesh (keep data in purchase DB — split rules). |
| 0.4 | Gateway realm check | `gateway/app.py` | 2 lines: if decoded `auth_realm == "platform"` and target service ≠ platform → 403. Closes the documented-but-missing isolation. |
| 0.5 | Platform role enforcement | `platform/api.py` | `require_role("super_admin")` dependency on `POST /admins`, kill-switch, breakglass-class routes. |
| 0.6 | Kill-switch real effect | `platform/api.py` `module-gate/check` | AND in `PluginManifest.is_active` → gate denies. One extra column in the same query. |
| 0.7 | POS model decision (documented) | `pos/api.py` | Re-point frontend sessions/transactions calls (10) to `/orders` + `/table-sessions` **or** build the terminal model. **Recommendation: re-point** — the orders model is what kitchen/billing consume. |
| 0.8 | Reconcile billing prefix | decision | Alias `bills` ↔ `invoices` at the gateway now so both UI and backend work; Stage 1 upgrades it to real invoices. |
| 0.9 | Hygiene | `platform/api.py`, `frontend/` | audit `ip_address` stamping, `tenant.onboarded` audit row, cap the unbounded gateway gate cache, delete or repair `rbac-context.tsx` (dangling `modules-config.ts` import), remove `SuperAdmin123!` prefill. |
| 0.10 | **Event-bus consistency — CRITICAL** | `accounting/`, `reports/`, `registry.py` | `accounting` and `reports` **declare** bus subscriptions in the registry but have **zero `@bus.on` handlers** (verified: 0 handler files in both). No `bill.paid` ever auto-posts a journal; no report projections build. Either implement handlers (`bill.paid`→journal+cash, `grn.posted`→inventory-cost entries, `adjustment.approved`/`wastage.recorded`→GL, `kot.ready`/`attendance.marked`→projections) or strip the registry claims. Also 6 topics are **declared but published nowhere**: `payment.received` (billing must emit on settle), `stock.movement.created` (inventory, on every movement), `attendance.marked` (staff), `po.approved` (purchase), `user.deactivated` + `customer.deleted` (auth/customers). |
| 0.11 | **Outbox durability for 4 services** | `purchase/`, `customers/`, `loyalty/`, `staff/` | these four publish events **directly** (`bus.publish`) with no outbox module — an event lost between commit and publish is lost cross-service permanently. Copy the outbox+relay pattern from billing/pos/kitchen/inventory (the proven ledger design). |
| 0.12 | **Staff rep-performance silent zero** | `staff/api/payroll.py:3344-3412` | imports `CRMOpportunity`/`POTransaction`/`Invoice` from `staff.models` — **none exist** — swallowed by bare `except: pass`, so CRM/POS/invoice revenue is *always 0* in the performance module. Fix: replace with cross-service HTTP lookups (customers → billing → menu), matching the mesh rule; delete the dead imports. |
| 0.13 | **Gate-cache invalidation channel** | `platform/`, `gateway/` | platform publishes none of its declared `platform.module.*` topics; gateway relies purely on the 5s per-process TTL (N replicas = N×5s lag). Publish `platform.module.suspended/activated/archived` and have a gateway subscriber evict the matching cache key. |
| 0.14 | **Schema-repair hazard** (from my Phase-0 work) | `shared/schema_bootstrap.py:213` | in `_add_missing_columns`, the `except: present = set()` fallback makes the same pass try to ALTER-add columns that `create_all` just created → `DuplicateColumn` on boot (rare: inspector race right after table creation). Fix: re-inspect once on failure; skip per-column on duplicate. |
| 0.15 | **CRM ownership decision** | registry + `customers/` | `/crm` (53–74 frontend calls) has **no owner** — not a gateway alias, no routes. Decision: register `crm→customers` alias and port BusinessOSAI `api/v1/crm.py` into the customers service (Phase 5), or retire the dead client code. Also `shifsts/` leftover empty dir + `hrms/documents` top-level path to prune. |

**Done =** pyflakes clean, all 14 apps build, a curl smoke through the gateway for every alias in 0.2 returns 2xx/4xx (no 500/SERVICE_NOT_FOUND), **and a bus smoke test proving a `bill.paid` event produces a journal entry (accounting) + projection row (reports) end-to-end** (0.10's definition of done).

---

## Phase 1 — Invoice & Receipt Subsystem (the main ask)

Goal: a real billing spine: bill → **invoice** → GST/e-invoice → **receipt (A4 + 80/58mm thermal, escpos)** → print templates. **~1–2 weeks.**

**Copy-source (BusinessOSAI):**
- `services/invoice_pdf.py` (2,520 lines) — A4 FMCG/parle/stylish layouts, **`_render_thermal_receipt_pdf` (80/58mm)**, QR-on-invoice, amount-in-words, template-aware rendering
- `api/v1/erp/invoices.py` print-template routes (lines 613–900: `/print-templates` CRUD, `/print-template/active`) — maps 1:1 onto RestaurantOS's dead `printTemplatesApi`
- `models/erp.py` Invoice + receipt enums, `services/razorpay_service.py` (payment gateways)

**Target (RestaurantOS):** extend the **billing service** (owns bills/payments/tax-codes already):
1. Models: `Invoice` (AR, numbered via billing's `number_series`), `PrintTemplate`, `PaymentGatewayConfig`, `SalesReturn`
2. Routes (exact shapes the frontend already calls, from the gap sweep):
   - `GET/POST /invoices`, `GET /invoices/{id}`, `POST /invoices/settlement`
   - `GET/POST/DELETE /invoices/print-templates`, `GET/POST /invoices/print-template/active`
   - `GET /invoices/{id}/pdf` → A4 or thermal (query `format=thermal&size=80mm`)
   - `POST /receipts/{bill_id}/print` → escpos/thermal bytes (`python-escpos` is already in requirements but unused)
   - `GET/POST /payments/gateways/config`, `/payments/razorpay/create-order|verify`, `/payments/pinelabs/charge`
   - `GET/POST /sales-returns`, `POST /sales-returns/exchange`
3. GST: reuse billing `tax-codes`; add e-invoice QR (qrcode lib) + UQCIN shape; e-invoice/EWBS submission deferred to Phase 4
4. Events: publish `invoice.created`, `invoice.settled`, `receipt.printed` (event-bus, per-service consumer groups); inventory subscribes to `invoice.settled` for BOM deduction parity with `bill.paid`
5. Day close ↔ GL: `accounting` subscribes to settlement events; wires to existing `day-close` + `trial-balance`

**Libs:** **zero new dependencies** — `reportlab`, `fpdf2`, `python-escpos`, `qrcode`, `pillow`, `pandas`, `openpyxl` are all already in `requirements.txt` (staff service already imports qrcode/reportlab in two places). Notably `python-escpos` lets us go *beyond* BusinessOSAI: it only renders thermal PDFs (printing is client-side), whereas RestaurantOS can emit raw ESC/POS byte streams for physical printers server-side.

**Model/numbering specifics (verified):**
- New tables on billing DB: `invoices`, `invoice_lines`, `invoice_payments`, `invoice_returns(+_lines)`, `billing_print_templates` (JSONB per outlet — BusinessOSAI stores templates in `Tenant.settings` JSONB which RestaurantOS lacks; a small settings table replaces it).
- `Invoice` shape to copy from `models/erp.py` L251: `invoice_number`, `invoice_type`, cgst/sgst/igst/tds/round_off totals, `is_reverse_charge`, `is_tax_inclusive`, `irn_number`/`ack_number`/`e_invoice_qr` (e-invoice-ready columns from day one), `journal_entry_id`, `print_template_id`, unique `(tenant_id, invoice_number)`.
- Numbering: reuse the house `NumberCounter` pattern (`billing_number_counters`, FOR UPDATE row lock, key `invoice:<outlet>:<YYYY-MM>`) — do NOT copy BusinessOSAI's global `NumberSeries` table.
- GST math: copy `_compute_invoice_totals` + `_enrich_invoice_tax_details` from `invoices.py` (self-contained ~150 LOC); wire rates to billing's existing `TaxCode` rows.

**Done =** every `invoicesApi`/`printTemplatesApi`/`receipt-template-store.ts` call returns live data; a bill can be printed as A4 PDF, 80mm thermal PDF, **and raw ESC/POS bytes**; a tenant receipt shows outlet + tax + QR; print templates live server-side (localStorage retired).

---

## Phase 2 — Inventory Upgrade: product catalog + barcodes

Goal: the rich product model the frontend already expects (84 missing inventory calls → ~0). **~1 week.**

**Copy-source:** `api/v1/inventory/identifiers.py` (778 lines: `barcodes` list/next/generate/**generate-bulk/batch-print**, qrcodes CRUD + print, rfids), `product_master.py`, `product_variants.py`, `product_images.py`, `barcode_scanner.py` (Excel import + image upload), `master_catalog.py` (global catalog + suggestions + import-to-local-inventory).

**Verified facts about the source code:**
- Barcode generation in BusinessOSAI is **string-only** (no image library): ~120 self-contained lines in `identifiers.py` — `compute_ean13_checksum` (GS1 mod-10), `generate_tenant_barcode` (EAN-13: `20 + tenant_code(4) + seq(6) + check` digit; Code-128: `PREFIX-tenantcode-00000`), uniqueness loops. RestaurantOS retarget: "globally unique" → *per-tenant* (the whole `restaurantos_inventory` DB is one tenant's estate across outlets). Label images stay client-side.
- RestaurantOS inventory has **zero** barcode support today: no `barcode` column on `InventoryItem`, no routes.

**Target:** inventory service:
1. Models: `barcode String(100)` column on `InventoryItem` (via the `ALTER TABLE … ADD COLUMN IF NOT EXISTS` startup pattern in `inventory/main.py`), new `inventory_qrcodes` (+`inventory_rfid_tags` if wanted), `inventory_cycle_counts(+_items)` — all auto-created by `schema_bootstrap` on boot
2. Routes — exact names the frontend already calls (verified against `api-client.ts:4900-4913`): `GET /inventory/barcodes`, `/barcodes/next?format=&prefix=`, `POST /barcodes/generate`, `/barcodes/generate-bulk`, `POST /barcodes/batch-print`, plus qrcodes/manufacturing-cohorts/expiry-ops clusters, scanner lookup `GET /items/barcode/{raw}`
3. Keep the stock engine as-is (movements ledger, par, expiry batches, GRN consumption all proven). Delta to add, priority order:
   - **Expiry ops** — near-expiry discount + write-off + manufacturing cohorts (~200 LOC; high value for a spoilage-heavy restaurant)
   - **Cycle counts** (~150 LOC; approvals write through the existing `record_adjustment`)
   - **`stock.low` → auto-PR suggestion**: purchase service subscribes to the outbox event and posts to its existing `vendor-items/recommend` slot — closes the silent stockout→purchase chain
4. Deferred/low: product-variants/bundles/images (menu service already covers variants), serials, put-away/picking rules (retail-specific), master-catalog AI enrichment (port the HTTP-client shape when the AI key is configured)

**Done =** barcode page, product-catalog tabs, expiry ops and procurement calls all live; scan-to-stock works with the generated barcodes; `stock.low` now produces purchase suggestions.

---

## Phase 3 — Restaurant Core Deepening

Goal: make the dining spine production-grade. **~1–2 weeks.**

1. **KOT/kitchen** (kitchen service): status transitions already there — add live tracking events (`kot.item.status.changed` exists; consumers: pos + kitchen UI), KOT auto-close timer, printer-queue outbox
2. **Floor ops** (organization): the `size_w/size_h/rotation/label` table columns now exist via the schema repair — add floor-plan autosave endpoint + blueprint JSON validation
3. **Aggregators** (pos): zomato/swiggy order import (model: `aggregator_name/order_id` columns exist on `orders`) — webhook receiver + auto-KOT on aggregator order
4. **Shifts ↔ accounting**: `shifts` (billing) close event → accounting day-close auto-entry; reconcile cash vs POS sales
5. **Reports service** (43 unused routes to wire): sales/hourly/items exist — add `analytics/*` (employee-sales, payment-mode-sales, report-builder presets) since Phase 0 aliases `analytics`→reports

**Done =** a shift can be opened → sold → settled → closed → GL'd without manual steps; aggregator orders appear as KOTs.

---

## Phase 4 — Finance Module Completion (accounting)

Goal: the full back-office. **~1 week.**

- `GET /accounting/general-ledger`, `/opening-balances` (2 known-missing)
- `POST /bank/accounts`, `/bank/reconciliations`; `/fixed-assets`, `/budgets`, `/expense-claims` (all frontend-called, none built)
- GST: `gstr-1/2b/3b` filing models + `otp` verify (BusinessOSAI `api/v1/erp/gst_filing.py` + `einvoice.py` + `eway_bill.py` are the copy-source). **Key insight:** GSTR-1/3B summaries should be *computed from billing's invoice tables* (already GST-complete: cgst/sgst/igst/tds/round-off, `is_reverse_charge`, `hsn_code` on lines) into accounting's existing `GSTReturn` rows — fed by the `invoice.paid`/`invoice.voided` events from Phase 0.10's accounting handlers. e-invoice registration + IRN (Whitebooks GSP) only if a client needs it; e-way bills + delivery challans are small add-ons (`erp/delivery_challan.py`, 252 LOC)
- Financial reports: balance-sheet, cash-flow, AR/AP aging (`financial-reports/*` alias from Phase 0; BusinessOSAI `erp/financial_reports.py` is the copy-source — 620 LOC of P&L/balance-sheet/TB/cash-flow/aging)
- Day-close tie-out: shift-close (billing) → accounting auto-entry reconciles cash vs POS sales (the shift-close event is one of Phase 0.10's handlers)

**Done =** month-end close: day-close → trial balance → P&L → balance sheet → GST return, all in-app.

---

## Phase 5 — Growth Layer (CRM + marketing + notifications)

Goal: new services, the "think huge" tier. **~2–4 weeks; can run parallel by 2 devs.**

1. **`crm` service** (53 dead calls, largest single gap): leads/opportunities/quotations/sales-orders/tickets + campaigns + intelligence (churn/LTV/RFM) — port from BusinessOSAI `api/v1/crm.py`
2. **`notifications` service** (system/notifications + whatsapp-automation + social): templates, device registry, broadcast engine (BusinessOSAI `services/whatsapp_invoice_sender.py`, social accounts)
3. **`marketplace` service**: vendors/products/orders/payouts/coupons/RFQs + pricing rules (BusinessOSAI `models/marketplace.py`)
4. **`integrations` + `copilot` services**: Zoho sync; `ai_service.py` is already half-wired — promote to a gateway service
5. **Loyalty UI hookup**: loyalty service is fully built but the UI calls `/crm/loyalty/*` — alias + small route additions

**Done =** the CRM/marketing pages in the frontend go live with real data; cross-sell events (bill.paid → loyalty points → whatsapp coupon) flow on the bus.

---

## Phase 6 — Platform Hardening (control plane integrity)

Goal: the super-admin stack matches its claims. **~3–5 days.**

1. **Single permission source**: `auth` service adopts the platform `PermissionCatalogue` (sync endpoint or shared seed) — the 67-permission page stops being decorative
2. **ABAC policies**: gateway-side `/policies/evaluate` (module-gate pattern + TTL cache), or relabel "draft"
3. **Break-glass**: `POST /platform/breakglass` (short-TTL emergency token + audit row)
4. **Vertical plugins** (restaurant/salon/gym/retail/clinic/carwash): implement as real service bundles **or** demote to marketing rows — decision needed
5. Gate-cache hardening (TTLCache with cap), multi-replica invalidation doc
6. Audit immutability (append-only view; revoke direct deletes)

---

## Cross-cutting (runs through all phases)

- **Test harness**: per-service smoke tests (repo already has `smoke_*.py` patterns) + a gateway-level e2e script hitting every alias
- **Runbook**: `run_services.py restart` SOP; log-watching for `NameError|UndefinedColumn` (the post-split failure signatures, now auto-repaired at boot by `schema_bootstrap`)
- **Docs**: update `docs/BACKEND_ARCHITECTURE.md` + `END_TO_END_INTEGRATION.md` in the same PR as each phase
- **Copy-paste rule**: BusinessOSAI code gets retargeted (router/deps/imports rewritten to the service's `Identity`/`DbDep` pattern; monolith `Company`→tenant-scoped rows; no cross-service FKs; timestamps app-side; status columns String)

---

## Sequencing & effort summary

| Phase | Scope | Effort | Unlocks (frontend) |
|---|---|---|---|
| 0 | Stabilize: paths, aliases, realm, roles, kill-switch, **event-bus handlers (0.10), outbox for 4 services (0.11), gate-cache invalidation (0.13)** | 2–3 d | ~60 dead calls live; no more 500s; money + reports actually flow on the bus |
| 1 | Invoices + receipts + templates + payments | 1–2 w | billing/receipts/print-template pages |
| 2 | Product catalog + barcodes/QR/RFID | 1 w | inventory product pages, barcode printing |
| 3 | KOT/aggregators/shifts→GL | 1–2 w | kitchen live tracking, reports/analytics |
| 4 | Accounting completion + GST/e-invoice | 1 w | finance module, GST filing |
| 5 | CRM/marketing/marketplace/notifications | 2–4 w | CRM + growth pages (largest UI surface) |
| 6 | Platform enforcement | 3–5 d | super-admin claims become real |

**Critical path:** 0 → 1 → 3 (dining spine) → 4 (money) · **parallel:** 2 with 1, 5 after 1, 6 anytime.

**Decision needed from you (before Phase 5):** are the 6 "vertical plugins" real product bundles or marketing? And is restaurant → the primary vertical with salon/gym/retail as roadmap, or multi-vertical from day one? That decides whether Phase 5 builds a single `crm` service now or a pluggable growth layer.
