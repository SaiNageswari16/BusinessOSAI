# RestaurantOS — Backend & Database Architecture Plan

**Project:** RestaurantOS (restaurant POS / management platform)
**Derived from:** BusinessOSAI conventions (FastAPI + SQLAlchemy 2.x async + PostgreSQL + Next.js)
**Date:** 2026-10-13
**Status:** Planning — implementation starts after approval

---

## 1. What This Document Covers

This is the planning document for a restaurant management platform built on the same
architectural foundation as BusinessOSAI, but re-modelled for restaurant operations:
KOT (Kitchen Order Ticket), table service, menu/recipe management, delivery aggregation,
and all standard POS mechanics (shifts, payments, discounts, GST).

It covers:

1. Scope & target users
2. Architecture & stack
3. Module map (what we build, in what order)
4. Database design — every model, relationships, key indexes
5. KOT / kitchen flow (the core restaurant-specific engine)
6. API surface (endpoint inventory per module)
7. Permissions model
8. Money, tax & numbering rules
9. Directory structure & file-by-file build order
10. Phased implementation plan
11. What we deliberately do NOT carry over from BusinessOSAI

**Not covered:** frontend implementation detail, deployment/infra, mobile apps.
These come after the backend skeleton exists.

---

## 2. Scope & Target Users

### 2.1 Primary users

| Role | What they do |
|------|--------------|
| **Owner / Franchisor** | Multi-outlet oversight, menu & pricing, P&L, recipes, wastage |
| **Outlet Manager** | Shift management, staff, day-close, approvals |
| **Cashier** | Billing, payments, discounts within limits, order taking |
| **Captain / Server** | Table orders, KOT firing, running orders, course pacing |
| **Kitchen (KDS)** | Receive KOT tickets, mark items prepared, bump/call |
| **Delivery / Counter** | Parcel, takeaway, aggregator order intake |

### 2.2 Service models supported

The system must handle all of these under one tenant:

- **Dine-in** — table-based, multi-course, running order, split/merge bills
- **Takeaway** — counter pickup, token display
- **Delivery (own)** — own riders
- **Delivery (aggregators)** — Zomato / Swiggy / others via order ingestion
- **QSR / Counter service** — token, no table, fast kitchen
- **Cloud kitchen** — aggregator-only, no dine-in tables

### 2.3 In scope

Menu + recipes + variants, dine-in table service, KOT/KDS, POS billing, shifts &
cash, payments (multi-gateway), discounts/promos/coupons, loyalty, GST invoicing
(e-invoice + e-way where applicable), inventory with recipe-level deduction, purchase
& vendor, wastage, staff & attendance, reservations, feedback, reports/analytics,
multi-outlet, WhatsApp notifications, printing (KOT + bill), aggregator integration.

### 2.4 Out of scope (for now)

Marketplace (vendor-of-vendors), CRM pipeline/deals, Meta Ads, social scheduler,
HRMS payroll/recruitment (staff basics only), storefront e-commerce, LiveKit/Plivo
telephony. These are BusinessOSAI modules that don't map to a restaurant POS.

---

## 3. Architecture & Stack

Carrying over the BusinessOSAI stack unchanged — it works and the team knows it:

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python async), Pydantic v2, SQLAlchemy 2.x async |
| Database | PostgreSQL (single DB, multi-tenant via `tenant_id`) |
| Cache / Rate limit | Redis (auto-disables after 60s of failure) |
| File storage | MinIO (S3-compatible) — menu images, receipts |
| Realtime | WebSocket (KDS + order status push) |
| Printing | Local print bridge (ESC/POS thermal) + PDF |
| AI | Multi-provider cascade: Gemini → OpenAI → Anthropic |
| Messaging | WhatsApp gateway (Node.js, port 8005) |
| Payments | Multi-gateway config (Razorpay, Stripe, PhonePe, Paytm, Cashfree, COD, Pine Labs EDC) |
| Tax / GST | Whitebooks GSP (e-Invoice/IRN, e-Way Bill, GST filing) |
| Frontend | Next.js + React + TS + Tailwind + shadcn/ui |

### 3.1 Design principles (inherited)

- **Multi-tenant**: every query filters `tenant_id == ctx.tenant_id`
- **Outlet scoping**: most entities also carry `outlet_id` (equivalent to BusinessOSAI `company_id`)
- **UUID v4 primary keys** everywhere
- **RBAC** with granular permissions via `Depends(require_permission("..."))`
- **No soft delete** — status enums (ACTIVE / INACTIVE / SUSPENDED / CLOSED)
- **No Alembic** — schema changes are inline `ALTER TABLE IF NOT EXISTS ADD COLUMN` in `init_db.py`
- **JSON columns** mutated then `flag_modified()`'d
- Money stored as `Numeric(12, 2)` — never float in the database

### 3.2 Naming discipline

RestaurantOS keeps the BusinessOSAI naming *conventions* but its own domain vocabulary:

| BusinessOSAI | RestaurantOS |
|--------------|--------------|
| `company_id` | `outlet_id` (table `outlets`) |
| `Product` | `MenuItem` |
| `Warehouse` | `Kitchen` / `Store` (inventory location) |
| `Invoice` | `Order` / `Bill` |
| `PurchaseOrder` | `PurchaseOrder` (unchanged) |
| `POSSession` | `Shift` |

---

## 4. Module Map

Grouped by build priority. **P0** = the system does not work without it.

### 4.1 Foundation (P0)

| # | Module | Purpose |
|---|--------|---------|
| 1 | **Auth & Security** | Users, roles, permissions, JWT refresh, passkeys, MFA policy, API keys |
| 2 | **Organization** | Tenant, Outlet, Section/Floor, Cost center, Fiscal year, Currency, tax config |
| 3 | **Master Data** | UOM, tax codes/HSN, payment methods, printers, tags, geography |

### 4.2 Menu & Recipe (P0)

| # | Module | Purpose |
|---|--------|---------|
| 4 | **Menu Categories** | Veg/non-veg, course type, category ordering, time-based menus |
| 5 | **Menu Items** | Item + variants + add-ons + portion sizes + pricing + prep time |
| 6 | **Recipe / BOM** | Ingredient mapping → auto stock deduction |
| 7 | **Modifiers & Combos** | Add-on groups, combo meals, free-qty rules, happy-hour pricing |

### 4.3 Dine-in & Tables (P0)

| # | Module | Purpose |
|---|--------|---------|
| 8 | **Tables & Sections** | Table, section/floor, capacity, merge/split, status lifecycle |
| 9 | **Reservations** | Booking, waitlist, table assignment, no-show tracking |
| 10 | **Orders (Dine-in)** | Running order, courses, guest count, waiter assignment |
| 11 | **KOT / KDS** | Kitchen ticket generation, routing, status, bump, re-fire |

### 4.4 Billing & Payments (P0)

| # | Module | Purpose |
|---|--------|---------|
| 12 | **Order Types** | Dine-in / takeaway / delivery / aggregator / QSR |
| 13 | **Billing & Settlement** | Bill, split, merge, tip, service charge, round-off |
| 14 | **Shifts & Cash** | Open/close float, denominations, discrepancy, handover |
| 15 | **Payments** | Multi-gateway, split tender, refunds, credit sale |
| 16 | **Discounts & Promos** | Item/cart discounts, coupons, BOGO, happy hour, loyalty redeem |

### 4.5 Kitchen & Ops (P1)

| # | Module | Purpose |
|---|--------|---------|
| 17 | **Kitchen Stations** | Station routing, load balancing, prep-time tracking |
| 18 | **Inventory & Stock** | Ingredients, stock, locations, batch, expiry, low-stock |
| 19 | **Purchase & Vendor** | PR → PO → GRN → vendor bill → payment (P2P) |
| 20 | **Wastage & Transfers** | Wastage log, inter-outlet transfers |
| 21 | **Production / Prep** | Semi-finished goods, batch prep, yield |

### 4.6 Staff & Front-of-house (P1)

| # | Module | Purpose |
|---|--------|---------|
| 22 | **Staff & Roles** | Employee, designation, shift roster, attendance |
| 23 | **Waiter & Service** | Table assignment, tips, service ratings |
| 24 | **Feedback & CRM** | Customer, feedback, complaints, basic loyalty |

### 4.7 Compliance & Growth (P2)

| # | Module | Purpose |
|---|--------|---------|
| 25 | **GST & e-Invoice** | Tax config, HSN, IRN, e-Way Bill, GST filing |
| 26 | **Accounting** | COA, journal entries, day-close posting, P&L |
| 27 | **Loyalty & Wallet** | Points, tiers, wallet, gift cards |
| 28 | **Reports & Analytics** | Sales, item-wise, hourly, outlet-wise, margins |
| 29 | **AI Copilot** | Natural-language queries, demand forecast, menu engineering |
| 30 | **Notifications** | WhatsApp/SMS/push — order status, offers |
| 31 | **Integrations** | Aggregators (Zomato/Swiggy), WhatsApp gateway, printers |

---

## 5. Database Design

All models use `Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin`.
Money → `Numeric(12, 2)`. Status → enum. No `deleted_at`.

### 5.1 Foundation models

#### `Outlet`
```
id, tenant_id, company_id?, name, code, outlet_type
  outlet_type: DINE_IN | TAKEAWAY | QSR | CLOUD_KITCHEN | CAFE | FOOD_TRUCK
address_line1, address_line2, city, state, pincode, country
phone, email, gstin, fssai_license, pan
timezone, currency
is_active, settings(JSONB)
opening_time, closing_time, weekly_hours(JSONB)
```
Unique: `(tenant_id, code)`. Index: `tenant_id, is_active`.

#### `User` (reused from BusinessOSAI shape)
```
id, tenant_id, email, phone, hashed_password, full_name
is_active, is_tenant_owner, is_platform_admin
avatar_url, status, outlet_ids(JSONB)  # outlets this user can access
```

#### `Role`, `Permission`, `RolePermission`, `UserRole`
Standard RBAC, unchanged in shape from BusinessOSAI.

#### `Section` (floor / area)
```
id, tenant_id, outlet_id, name, section_type
  section_type: AC_HALL | NON_AC | TERRACE | PRIVATE_DINING | BAR | COUNTER
capacity, is_active, sort_order
```

#### `RestaurantTable`
```
id, tenant_id, outlet_id, section_id, name, code
seats, min_covers, max_covers
status: FREE | OCCUPIED | RESERVED | BILLING | CLEANING | BLOCKED
is_active, position_x, position_y  # floor plan
```

#### `CostCenter`
```
id, tenant_id, outlet_id, name, code, type
```

#### `FiscalYear`, `Currency`
Unchanged from BusinessOSAI.

### 5.2 Menu models

#### `MenuCategory`
```
id, tenant_id, outlet_id?, name, slug, description
category_type: FOOD | BEVERAGE | DESSERT | COMBO | ADDON
is_veg_only, is_active, sort_order
available_from, available_to  # time-based menu (breakfast/lunch/dinner)
image_url
```

#### `MenuItem`
```
id, tenant_id, outlet_id, category_id, name, code, description
item_type: VEG | EGG | NON_VEG | VEGAN
is_active, is_available
base_price(Numeric12,2), cost_price
prep_time_minutes, serving_size
kitchen_station_id  # default routing
tax_code_id, hsn_code
track_inventory (bool → drives recipe deduction)
image_url, tags(JSONB)
sort_order
```
Index: `tenant_id, outlet_id, category_id, is_available`.

#### `MenuItemVariant` (portion sizes)
```
id, tenant_id, menu_item_id, name
  e.g. Half / Full / Regular / Large
price(Numeric12,2), cost_price, is_default, is_active
```

#### `MenuItemAddonGroup`
```
id, tenant_id, menu_item_id, name
min_selections, max_selections, is_required
```

#### `MenuItemAddon`
```
id, tenant_id, addon_group_id, name, price, is_veg, is_available
```

#### `Recipe`
```
id, tenant_id, menu_item_id, variant_id?, name, yield_qty, yield_uom_id
instructions(Text), is_active
```

#### `RecipeLine`
```
id, tenant_id, recipe_id, ingredient_id (→ InventoryItem), qty, uom_id
wastage_pct, is_optional
```

#### `Combo`
```
id, tenant_id, outlet_id?, name, code, description
combo_price(Numeric12,2), is_active
available_from, available_to
```

#### `ComboItem`
```
id, tenant_id, combo_id, menu_item_id, variant_id?, qty, is_choice
choice_group  # for "pick 1 of 3" style combos
```

#### `ModifierGroup` / `Modifier`
Reusable modifier sets (e.g. "Spice Level", "Sugar Level", "Extra Cheese").
```
ModifierGroup: id, tenant_id, name, min_selections, max_selections, is_required
Modifier: id, tenant_id, group_id, name, price, is_available
```

#### `PricingRule` (happy hour / day-part pricing)
```
id, tenant_id, outlet_id?, menu_item_id?
rule_type: HAPPY_HOUR | DAY_PART | SEASONAL | BULK
discount_pct, discount_amount
valid_from, valid_to, days_of_week(JSONB)
priority, is_active
```

### 5.3 Dine-in & order models

#### `Order`
```
id, tenant_id, outlet_id, order_number (auto, NumberSeries)
order_type: DINE_IN | TAKEAWAY | DELIVERY | AGGREGATOR | QSR
status: DRAFT | PLACED | IN_KITCHEN | PREPARING | PARTIALLY_SERVED | SERVED | BILL_REQUESTED | SETTLED | CANCELLED
table_id?, section_id?, covers (guest count), waiter_id?
customer_id?, customer_name?, customer_phone?
shift_id?
placed_at, closed_at
aggregator_name, aggregator_order_id  # Zomato/Swiggy
notes(Text)
subtotal, discount_total, tax_total, service_charge, tip, round_off, grand_total
is_parcel, token_number
```

#### `OrderItem`
```
id, tenant_id, order_id, menu_item_id, variant_id?, combo_id?
item_name (snapshot), variant_name, unit_price, qty
status: ORDERED | SENT_TO_KITCHEN | PREPARING | READY | SERVED | CANCELLED
course_number (int — pacing: 1=starter, 2=main, 3=dessert)
kot_id? (which ticket it fired on)
notes(Text)  # "no onion", "extra spicy"
discount_pct, discount_amount, tax_code_id, tax_amount
total (line total)
```

#### `OrderItemAddon`
```
id, tenant_id, order_item_id, addon_id?, modifier_id?
name, price, qty
```

#### `OrderItemCourse` (optional explicit course control)
```
id, tenant_id, order_id, course_number, name
fired_at, served_at, status
```

#### `TableSession` (dine-in occupancy)
```
id, tenant_id, outlet_id, table_id, order_id?
status: ACTIVE | CLOSED
started_at, ended_at, covers, waiter_id?
```

#### `Reservation`
```
id, tenant_id, outlet_id, table_id?, customer_name, customer_phone
covers, reserved_from, reserved_to
status: PENDING | CONFIRMED | SEATED | CANCELLED | NO_SHOW | COMPLETED
notes, occasion, deposit_amount
```

#### `Waitlist`
```
id, tenant_id, outlet_id, customer_name, customer_phone, covers
requested_at, quoted_wait_minutes, status: WAITING | SEATED | CANCELLED
```

### 5.4 KOT / Kitchen models (core differentiator)

#### `KitchenStation`
```
id, tenant_id, outlet_id, name
station_type: TANDOOR | FRY | GRILL | CURRY | SALAD | DESSERT | BEVERAGE | COUNTER
printer_id?, kds_device_id?, is_active
capacity_concurrent (max tickets in parallel)
avg_prep_minutes
```

#### `KOT` (Kitchen Order Ticket)
```
id, tenant_id, outlet_id, order_id, table_id?, kot_number (auto)
status: PENDING | ACKNOWLEDGED | PREPARING | READY | SERVED | CANCELLED
station_id
fired_at, acknowledged_at, ready_at, served_at
printed_count
priority: NORMAL | RUSH | VIP
notes
```
Index: `tenant_id, outlet_id, status, station_id`, `order_id`.

#### `KOTItem`
```
id, tenant_id, kot_id, order_item_id?, menu_item_id, variant_id?, name
qty, status: PENDING | PREPARING | READY | SERVED | CANCELLED
course_number, notes, modifiers(JSONB snapshot)
prepared_at
```

#### `KDSDevice` (Kitchen Display Screen)
```
id, tenant_id, outlet_id, station_id?, name, device_token
is_active, last_seen_at
```

#### `KOTStatusLog`
```
id, tenant_id, kot_id, from_status, to_status, changed_by, changed_at
reason(Text)
```
Used for prep-time analytics and kitchen audit.

### 5.5 Billing, shift & payment models

#### `Shift` (POS session)
```
id, tenant_id, outlet_id, user_id, shift_number (auto)
status: OPEN | CLOSED
opening_cash, closing_cash_expected, closing_cash_actual, discrepancy
opened_at, closed_at, closed_by?
denominations(JSONB)  # cash count
discrepancy_reason(Text)
```

#### `ShiftCashMovement`
```
id, tenant_id, shift_id, type: PAID_IN | PAID_OUT | DROP | PICKUP
amount, reason, created_by, created_at
```

#### `Bill` (settlement record)
```
id, tenant_id, outlet_id, order_id, bill_number (auto)
shift_id?, cashier_id?, waiter_id?
customer_id?, customer_name, customer_phone
covers
status: DRAFT | SETTLED | VOID | REFUNDED
subtotal, discount_total, taxable_amount, tax_total
service_charge, service_charge_pct, packaging_charge, tip, round_off, grand_total
paid_amount, change_amount
gst_invoice_number, irn, irn_status  # e-invoice
settled_at, void_reason(Text)
```

#### `BillItem`
```
id, tenant_id, bill_id, order_item_id?, menu_item_id, name, variant_name
qty, unit_price, discount_pct, discount_amount
tax_code_id, hsn_code, tax_pct, cgst, sgst, igst, cess
line_total
```

#### `BillPayment`
```
id, tenant_id, bill_id, shift_id?, method
  method: CASH | CARD | UPI | WALLET | CREDIT | GIFT_CARD | AGGREGATOR_PAID | ONLINE
amount, reference, gateway, gateway_txn_id
status: PENDING | SUCCESS | FAILED | REFUNDED
card_last4, card_type, upi_vpa
refunded_amount, refunded_at
```

#### `Discount`
```
id, tenant_id, outlet_id?, name, code
discount_type: PERCENT | FLAT | BOGO | FREE_ITEM
value, max_discount_amount
applies_to: CART | ITEM | CATEGORY
scope(JSONB)  # item/category ids
min_order_value, max_uses, uses_count, per_customer_limit
valid_from, valid_to, days_of_week(JSONB), time_from, time_to
requires_approval_above(Numeric), is_active
```

#### `DiscountUsage`
```
id, tenant_id, discount_id, bill_id?, customer_id?, user_id?
amount_discounted, applied_at
```

#### `Coupon`
```
id, tenant_id, outlet_id?, code, description
discount_type, value, max_discount_amount
min_order_value, valid_from, valid_to, usage_limit, per_user_limit
is_single_use, is_active
```

#### `ServiceChargeConfig`
```
id, tenant_id, outlet_id?, name, pct, applies_to: SUBTOTAL | SUBTOTAL_AFTER_DISCOUNT
is_active
```

#### `TipConfig`
```
id, tenant_id, outlet_id?, suggested_pcts(JSONB), is_enabled
```

### 5.6 Inventory models

#### `InventoryItem` (ingredient / raw material)
```
id, tenant_id, outlet_id?, name, code, sku
item_type: INGREDIENT | SEMI_FINISHED | PACKAGING | FINISHED
uom_id, category_id?
track_stock, track_batch, track_expiry
reorder_level, reorder_qty, standard_cost
storage_location_id?, is_active
```

#### `StorageLocation`
```
id, tenant_id, outlet_id, name
location_type: KITCHEN_STORE | FREEZER | COLD_STORAGE | DRY_STORE | BAR_STORE
```

#### `InventoryStock`
```
id, tenant_id, outlet_id, inventory_item_id, location_id?
qty_on_hand, qty_reserved, qty_available
avg_cost, last_cost, last_updated_at
```
Unique: `(tenant_id, outlet_id, inventory_item_id, location_id)`.

#### `InventoryBatch`
```
id, tenant_id, inventory_item_id, batch_number, expiry_date
qty, cost, received_at, grn_id?
```

#### `StockMovement`
```
id, tenant_id, outlet_id, inventory_item_id, location_id?
movement_type: PURCHASE | CONSUMPTION | WASTAGE | TRANSFER_IN | TRANSFER_OUT | ADJUSTMENT | PRODUCTION | OPENING
qty, uom_id, unit_cost, reference_type, reference_id
occurred_at, created_by
```
Index: `tenant_id, outlet_id, inventory_item_id, occurred_at`.

#### `WastageLog`
```
id, tenant_id, outlet_id, inventory_item_id?, menu_item_id?
qty, uom_id, reason
  reason: SPOILAGE | OVERPREP | DROPPED | STAFF_MEAL | COMP | EXPIRED | TRIAL
cost, notes, logged_by, logged_at
```

#### `StockAdjustment`
```
id, tenant_id, outlet_id, adjustment_number, reason(Text)
status: DRAFT | APPROVED | REJECTED
system_qty, counted_qty, variance_qty, variance_value
created_by, approved_by?, approved_at?
```

#### `StockAdjustmentLine`
```
id, tenant_id, adjustment_id, inventory_item_id, location_id?
system_qty, counted_qty, variance_qty, unit_cost
```

#### `InterOutletTransfer`
```
id, tenant_id, from_outlet_id, to_outlet_id, transfer_number
status: DRAFT | IN_TRANSIT | RECEIVED | CANCELLED
dispatched_at, received_at, received_by?, notes
```

#### `InterOutletTransferLine`
```
id, tenant_id, transfer_id, inventory_item_id, qty, uom_id
sent_qty, received_qty, variance_qty
```

#### `ProductionBatch` (semi-finished prep)
```
id, tenant_id, outlet_id, recipe_id?, batch_number
produced_qty, uom_id, produced_at, produced_by, expiry_at, cost
```

### 5.7 Purchase & vendor models

#### `Vendor`
```
id, tenant_id, outlet_id?, name, code, contact_person
phone, email, gstin, address(Text), city, state, pincode
payment_terms_days, credit_limit, rating, is_active
vendor_type: INGREDIENT | BEVERAGE | PACKAGING | SERVICE | EQUIPMENT
```

#### `VendorItem` (vendor → item price mapping)
```
id, tenant_id, vendor_id, inventory_item_id
vendor_item_code, price, uom_id, min_order_qty, lead_time_days
is_preferred
```

#### `PurchaseRequest`
```
id, tenant_id, outlet_id, pr_number, status: DRAFT | SUBMITTED | APPROVED | REJECTED | CONVERTED
requested_by, approved_by?, notes, created_at
```

#### `PurchaseRequestLine`
```
id, tenant_id, purchase_request_id, inventory_item_id, qty, uom_id
required_by(date)
```

#### `PurchaseOrder`
```
id, tenant_id, outlet_id, vendor_id, po_number
status: DRAFT | SENT | CONFIRMED | PARTIAL | RECEIVED | CANCELLED
order_date, expected_date, received_date
subtotal, tax_total, grand_total, notes
```

#### `PurchaseOrderLine`
```
id, tenant_id, purchase_order_id, inventory_item_id
qty, uom_id, unit_price, tax_pct, tax_amount, received_qty, line_total
```

#### `GoodsReceiptNote` (GRN)
```
id, tenant_id, outlet_id, purchase_order_id?, vendor_id, grn_number
status: DRAFT | RECEIVED | QC_PASSED | QC_FAILED | CANCELLED
received_date, received_by?, invoice_number, invoice_date
qc_notes, notes
```

#### `GoodsReceiptNoteLine`
```
id, tenant_id, grn_id, purchase_order_line_id?, inventory_item_id
ordered_qty, received_qty, accepted_qty, rejected_qty
uom_id, unit_price, batch_number, expiry_date, rejection_reason
```

#### `VendorBill`
```
id, tenant_id, outlet_id, vendor_id, grn_id?, bill_number
status: DRAFT | UNPAID | PARTIALLY_PAID | PAID | CANCELLED
bill_date, due_date, subtotal, tax_total, grand_total, paid_amount
```

#### `VendorBillLine`
```
id, tenant_id, vendor_bill_id, inventory_item_id, qty, uom_id, unit_price, tax_pct, line_total
```

#### `VendorPayment`
```
id, tenant_id, outlet_id, vendor_bill_id?, vendor_id
amount, method, reference, paid_at, paid_by?
```

### 5.8 Staff & service models

#### `Employee`
```
id, tenant_id, outlet_id, user_id?, employee_code, full_name
phone, email, designation, department
role_type: MANAGER | CASHIER | WAITER | CAPTAIN | CHEF | KITCHEN_STAFF | DELIVERY | HOUSEKEEPING
joined_date, is_active, hourly_rate
```

#### `ShiftRoster`
```
id, tenant_id, outlet_id, employee_id
shift_date, start_time, end_time, shift_type: MORNING | EVENING | NIGHT
status: SCHEDULED | COMPLETED | ABSENT | SWAPPED
```

#### `Attendance`
```
id, tenant_id, outlet_id, employee_id, attendance_date
check_in, check_out, status: PRESENT | ABSENT | LATE | HALF_DAY | LEAVE | HOLIDAY
worked_hours, overtime_hours, notes
```

#### `Tip`
```
id, tenant_id, outlet_id, bill_id?, employee_id?
amount, distributed_at
```

#### `TipPoolDistribution`
```
id, tenant_id, outlet_id?, pool_date, total_amount
distribution(JSONB), status: PENDING | DISTRIBUTED
```

#### `Customer`
```
id, tenant_id, outlet_id?, name, phone, email
address(Text), gstin?, anniversary, birthday
notes, tags(JSONB)
```
Unique: `(tenant_id, phone)`.

#### `Feedback`
```
id, tenant_id, outlet_id, order_id?, bill_id?, customer_id?
rating_overall, rating_food, rating_service, rating_ambience
comment(Text), status: NEW | ACKNOWLEDGED | RESOLVED
source: POS | QR | WHATSAPP | GOOGLE | ZOMATO | SWIGGY
created_at
```

#### `Complaint`
```
id, tenant_id, outlet_id, order_id?, customer_id?, raised_by
category, description(Text), severity: LOW | MEDIUM | HIGH
status: OPEN | IN_PROGRESS | RESOLVED | CLOSED
resolution(Text), resolved_by?, resolved_at?
```

### 5.9 Loyalty & wallet models

#### `LoyaltyProgram`
```
id, tenant_id, outlet_id?, name, is_active
points_per_currency, redemption_value (points → currency)
min_redemption_points, expiry_days
tiers(JSONB)
```

#### `CustomerLoyaltyAccount`
```
id, tenant_id, customer_id, program_id
points_balance, lifetime_points, tier
enrolled_at, last_activity_at
```

#### `LoyaltyTransaction`
```
id, tenant_id, account_id, bill_id?
type: EARN | REDEEM | EXPIRE | ADJUST
points, value_amount, description, created_at
```

#### `CustomerWallet`
```
id, tenant_id, customer_id, balance, is_active
```

#### `WalletTransaction`
```
id, tenant_id, wallet_id, bill_id?
type: CREDIT | DEBIT, amount, description, created_at
```

#### `GiftCard`
```
id, tenant_id, outlet_id?, card_number, pin
initial_value, balance, status: ACTIVE | REDEEMED | EXPIRED | VOID
issued_to?, issued_at, expires_at
```

### 5.10 Accounting & tax models

#### `TaxCode`
```
id, tenant_id, outlet_id?, name, code, hsn_code
tax_type: GST | VAT | NONE
cgst_pct, sgst_pct, igst_pct, cess_pct
is_active
```

#### `ChartOfAccount`
```
id, tenant_id, outlet_id?, code, name
account_type: ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE
parent_id?, is_active
```

#### `JournalEntry` / `JournalEntryLine`
Standard double-entry, unchanged shape from BusinessOSAI.
```
JournalEntry: id, tenant_id, outlet_id, entry_number, entry_date
  reference_type, reference_id, narration(Text), status: DRAFT | POSTED | REVERSED
JournalEntryLine: id, tenant_id, journal_entry_id, account_id
  debit, credit, description
```

#### `DayClose`
```
id, tenant_id, outlet_id, close_date, shift_id?
status: OPEN | CLOSED | RECONCILED
total_sales, cash_sales, card_sales, upi_sales, credit_sales, aggregator_sales
total_discount, total_tax, total_orders, total_covers, avg_ticket
cash_expected, cash_actual, discrepancy
closed_by?, closed_at, journal_entry_id?
```

#### `GSTReturn` / `TaxPayment`
Standard, unchanged from BusinessOSAI.

### 5.11 Notification, integration & misc models

#### `NotificationTemplate`
```
id, tenant_id, outlet_id?, name, channel: WHATSAPP | SMS | EMAIL | PUSH
event: ORDER_PLACED | ORDER_READY | BILL_GENERATED | RESERVATION_CONFIRMED | FEEDBACK
subject, body(Text), variables(JSONB), is_active
```

#### `NotificationLog`
```
id, tenant_id, outlet_id?, channel, recipient, template_id?
event, payload(JSONB), status: PENDING | SENT | FAILED | DELIVERED
provider, provider_message_id, error(Text), sent_at
```

#### `AggregatorConfig`
```
id, tenant_id, outlet_id, aggregator: ZOMATO | SWIGGY | MAGICPIN | DOTPE
api_key, api_secret, restaurant_id(encrypted), is_active
auto_accept, menu_sync_enabled, last_synced_at
settings(JSONB)
```

#### `AggregatorOrderMap`
```
id, tenant_id, outlet_id, aggregator, aggregator_order_id
order_id, raw_payload(JSONB), synced_at, sync_status
```
Unique: `(tenant_id, outlet_id, aggregator, aggregator_order_id)`.

#### `Printer`
```
id, tenant_id, outlet_id, name, station_id?
printer_type: KOT | BILL | LABEL | REPORT
connection: USB | NETWORK | BLUETOOTH
address, port, paper_width_mm, is_default, is_active
```

#### `AuditLog` / `ActivityLog`
Unchanged from BusinessOSAI.

#### `NumberSeries`
Unchanged — but seeded with restaurant modules (`order`, `kot`, `bill`, `shift`,
`purchase_order`, `grn`, `adjustment`, `wastage`, `production_batch`).

---

## 6. KOT / Kitchen Flow

This is the core restaurant-specific engine and needs careful design.

### 6.1 Order → KOT lifecycle

```
[Captain takes order on table]
        │
        ▼
   Order created (status=DRAFT, order_type=DINE_IN)
   OrderItems added with course_number, notes, modifiers
        │
        ▼  "FIRE" action
   ┌────────────────────────────────────────────┐
   │ Split items by kitchen_station_id           │
   │ Group into KOT per station                  │
   │ KOT status=PENDING, KOTItem per order item  │
   └────────────────────────────────────────────┘
        │
        ├──► Print KOT at station printer (or push to KDS via WebSocket)
        │
        ▼
   Kitchen ACKNOWLEDGES (status=ACKNOWLEDGED)
        │
        ▼
   Kitchen marks PREPARING (status=PREPARING)
        │
        ▼
   Kitchen marks READY (status=READY)
        │
        ▼  server notified (WhatsApp/push to captain's device)
   Captain SERVES items (status=SERVED)
        │
        ▼
   All items served → Order status=SERVED → Bill request
```

### 6.2 Key design decisions

**Firing is explicit, not automatic.** A captain builds the running order, then fires
per course (starter first, main later). This means `OrderItem` carries `course_number`
and its own `status`, and a single `Order` can have multiple `KOT`s over time.

**One KOT per station per fire.** When course 1 is fired and it has 3 items across
3 stations, that produces 3 KOTs. Each KOT routes to exactly one station.

**KOTItem snapshots the item.** If the menu item is later renamed or repriced, the
KOT still shows what the kitchen originally received. `KOTItem.name` and
`KOTItem.modifiers` (JSONB) are snapshots.

**Re-fire / add-on.** Adding items to a table after firing creates new `OrderItem`s
and a new KOT referencing the same `Order`. Cancelling an item that's already in the
kitchen produces a KOT with `status=CANCELLED` and a status log entry, so the kitchen
sees the cancellation rather than silently losing the item.

**Prep-time tracking.** `KOTStatusLog` records every transition with timestamp →
analytics on average prep time per station, per item, per hour.

**Offline resilience.** KOTs are created server-side; the KDS polls/subscribes. If a
printer is down, `KOT.printed_count` stays 0 and the ops dashboard flags unprinted
tickets.

### 6.3 Station routing rules

Each `MenuItem` has a default `kitchen_station_id`. On fire:
1. Group pending OrderItems by `kitchen_station_id`
2. Create one KOT per station
3. Assign `priority` — RUSH if the table has been waiting beyond threshold, VIP if
   reservation flagged as occasion
4. Respect `KitchenStation.capacity_concurrent` — if exceeded, the station's new KOTs
   queue and the dashboard shows backlog

### 6.4 Course pacing

`OrderItemCourse` gives explicit control when a restaurant wants courses fired on a
timer or by captain action. Most QSR outlets won't use it — `course_number` on the
item alone covers their case.

---

## 7. API Surface

Prefix: `/api/v1`. Every endpoint uses `Depends(require_permission("..."))`.

### 7.1 Auth (`/auth`)
`POST /login`, `POST /register`, `POST /refresh`, `POST /logout`,
`GET /me`, `POST /passkey/register`, `POST /passkey/verify`,
`POST /mfa/verify`, `POST /password/change`, `POST /password/reset`

### 7.2 Organization (`/organization`)
Outlets CRUD + `GET /outlets/{id}/config`, sections CRUD, tables CRUD +
`POST /tables/{id}/status`, floor plan `GET/PUT /outlets/{id}/floor-plan`

### 7.3 Menu (`/menu`)
- Categories: `GET/POST /categories`, `GET/PUT/DELETE /categories/{id}`
- Items: `GET/POST /items`, `GET/PUT/DELETE /items/{id}`, `POST /items/{id}/availability`
- Variants: `POST/GET /items/{id}/variants`
- Addon groups: `POST/GET /items/{id}/addon-groups`, `POST .../addons`
- Modifier groups: `GET/POST /modifier-groups`, `POST .../modifiers`
- Recipes: `GET/PUT /items/{id}/recipe`, `POST .../recipe/lines`
- Combos: `GET/POST /combos`, `POST .../items`
- Pricing rules: `GET/POST /pricing-rules`

### 7.4 Dine-in (`/dine-in`)
- `POST /orders` — create order (dine-in/takeaway/delivery/qsr)
- `GET /orders` — list with filters (status, table, waiter, date)
- `GET /orders/{id}` — full order with items, KOTs, payments
- `POST /orders/{id}/items` — add items to running order
- `PUT /orders/{id}/items/{item_id}` — update qty / notes
- `DELETE /orders/{id}/items/{item_id}` — remove (with KOT cancellation if fired)
- `POST /orders/{id}/fire` — fire course(s) to kitchen
- `POST /orders/{id}/transfer-table` — move to another table
- `POST /orders/{id}/merge` — merge into another order
- `POST /orders/{id}/split` — split bill by item or by amount
- `GET /orders/{id}/kot-status` — live kitchen status
- `POST /orders/{id}/cancel`
- Reservations: `GET/POST /reservations`, `PUT /reservations/{id}/status`
- Waitlist: `GET/POST /waitlist`, `POST /waitlist/{id}/seat`

### 7.5 Kitchen / KOT (`/kitchen`)
- `GET /stations`, `POST /stations`, `PUT /stations/{id}`
- `GET /kots` — filter by station, status, outlet
- `GET /kots/{id}`
- `POST /kots/{id}/acknowledge`
- `POST /kots/{id}/preparing`
- `POST /kots/{id}/ready`
- `POST /kots/{id}/served`
- `POST /kots/{id}/cancel` — with reason
- `POST /kots/{id}/reprint`
- `POST /kds/register`, `POST /kds/heartbeat`
- `WS /kds/stream` — WebSocket live ticket feed
- `GET /kitchen/analytics` — prep times, backlog, throughput

### 7.6 Billing (`/billing`)
- `POST /orders/{id}/bill` — generate bill from order
- `GET /bills`, `GET /bills/{id}`
- `POST /bills/{id}/pay` — take payment (supports split tender)
- `POST /bills/{id}/void`
- `POST /bills/{id}/refund`
- `POST /bills/{id}/print`
- `POST /bills/{id}/gst-invoice` — generate IRN via Whitebooks
- `GET /bills/{id}/pdf`

### 7.7 Shifts & cash (`/shifts`)
- `POST /open`, `POST /{id}/close`, `GET /current`, `GET /{id}/summary`
- `POST /{id}/cash-movement` — paid in/out, drop, pickup
- `GET /{id}/denominations`, `PUT /{id}/denominations`
- `GET /day-close`, `POST /day-close`

### 7.8 Discounts & promos (`/discounts`)
- `GET/POST /discounts`, `PUT/DELETE /discounts/{id}`
- `POST /validate` — validate a code against a cart
- `GET/POST /coupons`, `POST /coupons/{id}/deactivate`
- `GET/POST /pricing-rules`
- Service charge & tip config: `GET/PUT /service-charge`, `GET/PUT /tip-config`

### 7.9 Inventory (`/inventory`)
- Items: `GET/POST /items`, `PUT /items/{id}`
- Locations: `GET/POST /locations`
- Stock: `GET /stock`, `GET /stock/{item_id}`, `POST /stock/adjust`
- Movements: `GET /movements`
- Wastage: `GET/POST /wastage`, `PUT /wastage/{id}/approve`
- Adjustments: `GET/POST /adjustments`, `POST /adjustments/{id}/approve`
- Transfers: `GET/POST /transfers`, `POST /transfers/{id}/dispatch`,
  `POST /transfers/{id}/receive`
- Production: `GET/POST /production-batches`
- Alerts: `GET /alerts/low-stock`

### 7.10 Purchase (`/purchase`)
- Vendors: `GET/POST /vendors`, `PUT /vendors/{id}`, `POST /vendors/{id}/items`
- PR: `GET/POST /requests`, `POST /requests/{id}/approve`
- PO: `GET/POST /orders`, `POST /orders/{id}/send`, `POST /orders/{id}/receive`
- GRN: `GET/POST /grn`, `POST /grn/{id}/qc`
- Bills: `GET/POST /bills`, `POST /bills/{id}/pay`

### 7.11 Staff & service (`/staff`)
- Employees: `GET/POST /employees`, `PUT /employees/{id}`
- Roster: `GET/POST /roster`, `PUT /roster/{id}`
- Attendance: `POST /attendance/check-in`, `POST /attendance/check-out`,
  `GET /attendance`
- Tips: `GET /tips`, `POST /tips/distribute`
- Customers: `GET/POST /customers`, `PUT /customers/{id}`, `GET /customers/{id}/history`
- Feedback: `GET/POST /feedback`, `PUT /feedback/{id}/status`
- Complaints: `GET/POST /complaints`, `PUT /complaints/{id}/resolve`

### 7.12 Loyalty (`/loyalty`)
- Programs: `GET/PUT /program`
- Accounts: `GET /customers/{id}/account`, `POST /enroll`
- Transactions: `GET /accounts/{id}/transactions`, `POST /redeem`
- Wallets: `GET /customers/{id}/wallet`, `POST /wallet/topup`
- Gift cards: `GET/POST /gift-cards`, `POST /gift-cards/{id}/redeem`

### 7.13 Accounting & tax (`/accounting`)
- Tax codes: `GET/POST /tax-codes`
- COA: `GET/POST /accounts`
- Journal: `GET/POST /journal-entries`, `POST /journal-entries/{id}/post`
- GST: `POST /gst/e-invoice`, `POST /gst/e-way-bill`, `GET /gst/returns`

### 7.14 Reports (`/reports`)
`GET /sales/summary`, `GET /sales/by-item`, `GET /sales/by-hour`,
`GET /sales/by-category`, `GET /sales/by-outlet`, `GET /sales/by-waiter`,
`GET /inventory/consumption`, `GET /inventory/margin`, `GET /kitchen/performance`,
`GET /customers/rfm`, `GET /financial/pnl`

### 7.15 Integrations (`/integrations`)
- Aggregators: `GET/POST /aggregators`, `POST /aggregators/{id}/sync-menu`,
  `POST /aggregators/order-webhook` (Zomato/Swiggy push)
- WhatsApp: `GET /sessions`, `POST /sessions/{phone}/start`,
  `POST /send-message`, `POST /send-media`
- Printers: `GET/POST /printers`, `POST /printers/{id}/test`

### 7.16 Notifications (`/notifications`)
`GET /`, `POST /{id}/read`, `GET /templates`, `PUT /templates/{id}`,
`GET /logs`, `POST /broadcast`

### 7.17 AI (`/ai`)
`POST /copilot/chat` — natural language → SQL/answer
`GET /insights/menu-engineering` — BCG matrix on items
`GET /insights/demand-forecast` — predicted covers per day-part
`POST /insights/price-optimization`

---

## 8. Permissions Model

Naming: `action:resource`. RestaurantOS resource prefixes:

```
menu:           view:menu_items, manage:menu_items, view:recipes, manage:recipes,
                manage:pricing_rules, manage:combos
dine_in:        view:orders, manage:orders, fire:kot, view:tables, manage:tables,
                manage:reservations, manage:waitlist, transfer:tables
kitchen:        view:kot, manage:kot, acknowledge:kot, prepare:kot, ready:kot,
                serve:kot, cancel:kot, view:kitchen_analytics
billing:        view:bills, manage:bills, settle:bills, void:bills, refund:bills,
                apply:discounts, approve:discounts, split:bills, generate:gst_invoice
shift:          view:shifts, manage:shifts, close:shifts, approve:cash_discrepancy,
                manage:cash_movements
inventory:      view:inventory, manage:inventory, view:stock, adjust:stock,
                manage:wastage, approve:wastage, manage:transfers, receive:transfers
purchase:       view:purchase, manage:purchase, approve:purchase_orders,
                receive:grn, manage:vendor_bills, pay:vendor_bills
staff:          view:staff, manage:staff, manage:roster, manage:attendance,
                view:tips, distribute:tips
customers:      view:customers, manage:customers, view:feedback, manage:feedback,
                view:complaints, resolve:complaints
loyalty:        view:loyalty, manage:loyalty, redeem:loyalty_points,
                manage:gift_cards, manage:wallets
accounting:     view:accounting, manage:accounting, post:journal_entries,
                view:financial_reports, manage:tax_codes
reports:        view:reports, view:sales_reports, view:inventory_reports,
                view:kitchen_reports, view:financial_reports
integrations:   view:integrations, manage:integrations, manage:aggregators,
                manage:printers, manage:whatsapp
ai:             use:copilot, view:insights
```

Seeded roles: **Tenant Owner**, **Outlet Manager**, **Cashier**, **Captain**,
**Waiter**, **Kitchen (KDS)**, **Purchase Manager**, **Accountant**, **Viewer**.

---

## 9. Money, Tax & Numbering

### 9.1 Money
- Stored as `Numeric(12, 2)` — never `Float`
- All arithmetic server-side in `Decimal`, never client-side
- Round-off: compute `grand_total = round(subtotal - discount + tax + charges)` and
  store the `round_off` delta so accounting reconciles

### 9.2 Tax
- `TaxCode` holds cgst/sgst/igst/cess percentages
- Interstate → IGST, intrastate → CGST+SGST, determined by comparing outlet state
  with customer GSTIN state
- Discount applied **before** tax (configurable per discount)
- Service charge is taxable per current GST treatment — configurable

### 9.3 Number series (NumberSeries table)
`order`, `kot`, `bill`, `shift`, `purchase_request`, `purchase_order`, `grn`,
`vendor_bill`, `adjustment`, `wastage`, `production_batch`, `transfer`,
`day_close`, `gst_invoice`, `reservation`

Format per outlet, e.g. `KOT-{OUTLET}-{YYMM}-{####}`.

---

## 10. Directory Structure & Build Order

```
restaurant/
├── PLAN.md                       ← this document
├── CLAUDE.md                     ← project knowledge (generated after skeleton)
├── RULES.md                      ← conventions
├── ARCHITECTURE.md               ← diagrams
├── SKILLS.md                     ← module docs
│
├── backend/
│   ├── requirements.txt
│   ├── src/
│   │   ├── main.py               # FastAPI app, lifespan, CORS, WebSocket, static mounts
│   │   ├── config/settings.py    # all env vars
│   │   ├── database/
│   │   │   ├── base.py           # Base, mixins
│   │   │   ├── session.py        # async engine + session
│   │   │   ├── init_db.py        # CREATE TABLE + inline ALTER migrations + seed
│   │   │   └── purge.py
│   │   ├── models/
│   │   │   ├── __init__.py       # hub, star imports
│   │   │   ├── core.py           # Tenant, User, Role, Permission, Outlet, Section,
│   │   │   │                     # RestaurantTable, CostCenter, FiscalYear, Currency
│   │   │   ├── menu.py           # MenuCategory, MenuItem, variants, addons, modifiers,
│   │   │   │                     # Recipe, RecipeLine, Combo, PricingRule
│   │   │   ├── orders.py         # Order, OrderItem, OrderItemAddon, TableSession,
│   │   │   │                     # Reservation, Waitlist
│   │   │   ├── kitchen.py        # KitchenStation, KOT, KOTItem, KDSDevice, KOTStatusLog
│   │   │   ├── billing.py        # Bill, BillItem, BillPayment, Discount, Coupon,
│   │   │   │                     # DiscountUsage, ServiceChargeConfig, TipConfig
│   │   │   ├── shift.py          # Shift, ShiftCashMovement, DayClose
│   │   │   ├── inventory.py      # InventoryItem, StorageLocation, InventoryStock,
│   │   │   │                     # InventoryBatch, StockMovement, WastageLog,
│   │   │   │                     # StockAdjustment(+Line), InterOutletTransfer(+Line),
│   │   │   │                     # ProductionBatch
│   │   │   ├── purchase.py       # Vendor, VendorItem, PurchaseRequest(+Line),
│   │   │   │                     # PurchaseOrder(+Line), GoodsReceiptNote(+Line),
│   │   │   │                     # VendorBill(+Line), VendorPayment
│   │   │   ├── staff.py          # Employee, ShiftRoster, Attendance, Tip,
│   │   │   │                     # TipPoolDistribution, Customer, Feedback, Complaint
│   │   │   ├── loyalty.py        # LoyaltyProgram, CustomerLoyaltyAccount,
│   │   │   │                     # LoyaltyTransaction, CustomerWallet,
│   │   │   │                     # WalletTransaction, GiftCard
│   │   │   ├── accounting.py     # TaxCode, ChartOfAccount, JournalEntry(+Line),
│   │   │   │                     # GSTReturn, TaxPayment
│   │   │   └── system.py         # NumberSeries, NotificationTemplate, NotificationLog,
│   │   │                         # AggregatorConfig, AggregatorOrderMap, Printer,
│   │   │                         # AuditLog, ActivityLog, ApiKey
│   │   ├── schemas/              # one file per domain, mirroring models/
│   │   ├── api/
│   │   │   ├── deps.py           # CurrentUserContext, require_permission
│   │   │   └── v1/
│   │   │       ├── router.py     # master router
│   │   │       ├── auth.py
│   │   │       ├── organization.py
│   │   │       ├── menu.py
│   │   │       ├── dine_in.py
│   │   │       ├── kitchen.py     # + WebSocket KDS
│   │   │       ├── billing.py
│   │   │       ├── shifts.py
│   │   │       ├── discounts.py
│   │   │       ├── inventory.py
│   │   │       ├── purchase.py
│   │   │       ├── staff.py
│   │   │       ├── customers.py
│   │   │       ├── loyalty.py
│   │   │       ├── accounting.py
│   │   │       ├── reports.py
│   │   │       ├── integrations/
│   │   │       │   ├── aggregators.py
│   │   │       │   └── printers.py
│   │   │       ├── notifications.py
│   │   │       └── ai/
│   │   │           └── copilot.py
│   │   ├── services/             # business logic extracted from routers
│   │   │   ├── kot_service.py    # station routing, firing, cancellation
│   │   │   ├── billing_service.py# totals, tax, split/merge
│   │   │   ├── inventory_service.py # recipe deduction, stock ops
│   │   │   ├── shift_service.py
│   │   │   └── number_series.py
│   │   └── utils/security.py     # 200+ permission definitions, JWT, password
│   └── whatsapp_gateway/         # reused as-is from BusinessOSAI
│
├── frontend/
│   ├── src/
│   │   ├── lib/api-client.ts
│   │   ├── app/(dashboard)/...
│   │   └── components/
│   │       ├── pos/             # terminal, order screen
│   │       ├── kitchen/         # KDS
│   │       ├── menu/
│   │       ├── inventory/
│   │       ├── reports/
│   │       └── ui/
│   └── ...
│
└── print_bridge/                 # local ESC/POS thermal print agent
    └── index.js
```

---

## 11. Phased Implementation Plan

### Phase 0 — Skeleton (foundation, no features)
1. `backend/` scaffold: `settings.py`, `base.py`, `session.py`, `main.py`, `deps.py`
2. `models/core.py` — Tenant, User, Role, Permission, RolePermission, UserRole,
   RefreshToken, ApiKey, Outlet, Section, RestaurantTable
3. `models/__init__.py` hub + star imports
4. `utils/security.py` — full permission catalogue
5. `api/v1/auth.py` — login/register/refresh/me
6. `database/init_db.py` — CREATE TABLE for core + seed tenant owner role + permissions
7. Smoke test: register → login → `/me` returns context with permissions

**Done when:** a user can authenticate and the core tables exist.

### Phase 1 — Menu & Recipe
8. `models/menu.py` + `schemas/menu.py`
9. `api/v1/menu.py` — categories, items, variants, addons, modifiers, recipes, combos
10. `init_db.py` migrations for menu tables
11. Menu CRUD verified via API

**Done when:** you can build a menu with variants, addons and recipes via API.

### Phase 2 — Tables & Dine-in Orders
12. `models/orders.py` — Order, OrderItem, OrderItemAddon, TableSession, Reservation, Waitlist
13. `api/v1/dine_in.py` — create order, add/update/remove items, transfer/merge/split
14. Table status lifecycle transitions

**Done when:** a captain can open a table, build a running order, and fire it.

### Phase 3 — KOT / Kitchen (core)
15. `models/kitchen.py` — KitchenStation, KOT, KOTItem, KDSDevice, KOTStatusLog
16. `services/kot_service.py` — station routing, firing, cancellation, re-fire
17. `api/v1/kitchen.py` — station CRUD, KOT list/get/status transitions, reprint
18. WebSocket `/kds/stream` for live tickets
19. Print hook to `Printer` config

**Done when:** firing a dine-in order produces per-station KOTs, KDS receives them
live, and status transitions flow through to READY → SERVED.

### Phase 4 — Billing & Payments
20. `models/billing.py` — Bill, BillItem, BillPayment, Discount, Coupon, ServiceCharge, Tip
21. `services/billing_service.py` — totals, tax, split/merge, round-off
22. `api/v1/billing.py` — generate bill, pay (split tender), void, refund, print, PDF
23. GST invoice (IRN) stub via Whitebooks

**Done when:** a served order becomes a settled bill with correct tax and payment
records.

### Phase 5 — Shifts & Cash
24. `models/shift.py` — Shift, ShiftCashMovement, DayClose
25. `services/shift_service.py` — expected cash computation, denomination counting
26. `api/v1/shifts.py` — open/close, cash movements, day close

**Done when:** cashiers run shifts and day-close reconciles cash/card/UPI.

### Phase 6 — Inventory & Recipe Deduction
27. `models/inventory.py`
28. `services/inventory_service.py` — **recipe deduction on bill settlement**,
   stock movements, low-stock alerts, wastage
29. `api/v1/inventory.py`

**Done when:** settling a bill decrements ingredient stock via recipes, and wastage
adjustments work.

### Phase 7 — Purchase & Vendor
30. `models/purchase.py`
31. `api/v1/purchase.py` — PR → PO → GRN → bill → payment

**Done when:** a full P2P cycle completes and GRN receipt increments stock.

### Phase 8 — Staff, Customers, Loyalty
32. `models/staff.py`, `models/loyalty.py`
33. `api/v1/staff.py`, `api/v1/customers.py`, `api/v1/loyalty.py`

**Done when:** staff attendance, customer history, loyalty earn/redeem all work.

### Phase 9 — Accounting & GST
34. `models/accounting.py`
35. `api/v1/accounting.py` — COA, journal, day-close posting, GST returns
36. Auto-journal on bill settlement and day close

**Done when:** every settled bill produces balanced journal entries.

### Phase 10 — Reports & AI
37. `api/v1/reports.py` — sales/inventory/kitchen/financial
38. `api/v1/ai/copilot.py` — NL → SQL, menu engineering, demand forecast

**Done when:** dashboards have data and the copilot answers questions.

### Phase 11 — Integrations
39. Aggregators (Zomato/Swiggy) order ingestion + menu push
40. WhatsApp gateway proxy
41. Print bridge (ESC/POS)
42. Notifications engine

**Done when:** an aggregator order appears as an Order with a KOT.

### Phase 12 — Frontend
43. `api-client.ts` with all modules
44. POS terminal screen
45. KDS screen
46. Menu management
47. Inventory, reports, settings

---

## 12. What We Do NOT Carry Over

Deliberately dropped from BusinessOSAI because they don't map to restaurant POS:

| Dropped | Why |
|---------|-----|
| Marketplace (vendor-of-vendors, String PKs) | Not a restaurant concept |
| Storefront e-commerce | Replaced by aggregator integration |
| CRM pipeline (leads, opportunities, deals) | Restaurant sales aren't pipeline-based |
| Meta Ads / social scheduler | Separate product concern |
| HRMS payroll, recruitment, performance, learning, exit mgmt | Restaurant needs attendance + roster only |
| LiveKit / Plivo telephony | No call-centre workflow |
| Procurement AI suggestions | Can be added later if needed |
| IoT / RFID / barcode scanner | Keep as optional P3 |

---

## 13. Decisions & Assumptions

These were open questions in the draft. They're now resolved — each takes the
recommended default so implementation can start without further input. Flag any you
want changed and I'll adjust the affected phases.

| # | Question | Decision | Consequence |
|---|----------|----------|-------------|
| 1 | Single or multi-outlet? | **Multi-outlet schema, single-outlet UI first** | Every model carries `outlet_id` from day one; the UI shows one outlet at a time until Phase 12 |
| 2 | GST/IRN in v1? | **Tax stored correctly from day one, IRN deferred to Phase 9** | `TaxCode`, HSN, CGST/SGST/IGST all live in Phase 0. The Whitebooks IRN call is a Phase 9 endpoint |
| 3 | Aggregators in v1? | **Schema + ingestion in Phase 11, real APIs wired there too** | `AggregatorConfig` / `AggregatorOrderMap` tables exist from Phase 0 so nothing needs migrating later |
| 4 | Offline POS? | **Out of scope for v1 — online-only** | No local-first sync layer. Worth a separate design pass if internet is unreliable at your outlets |
| 5 | Recipe deduction automatic? | **Automatic on bill settlement, with manual override** | `billing_service.settle()` calls `inventory_service.deduct_for_bill()`. Wastage/adjustment endpoints exist for manual corrections |
| 6 | Reuse BusinessOSAI gateway + design system? | **Yes to both** | `whatsapp_gateway/` copied as-is; shadcn/ui + Tailwind conventions inherited |

### Additional assumptions

- **Currency:** INR, `Asia/Kolkata` timezone as defaults. Both are settings-level, not hardcoded.
- **Demo tenant** is seeded on first `init_db.py` run so the app is usable immediately.
- **No CI-enforced tests**, same as BusinessOSAI — but the money/tax/KOT-routing paths get pytest coverage because those are where silent errors are expensive.
- **Printing is via a local print bridge** (see §18), not direct browser printing, because browsers can't reliably drive thermal printers.

---

## 14. Environment & Configuration

`backend/src/config/settings.py` mirrors the BusinessOSAI shape — `BaseSettings` with
`alias` on every field so `.env` keys match the code names.

### Application
```
APP_NAME=RestaurantOS
APP_ENV=development            # development | staging | production
APP_DEBUG=true
APP_HOST=127.0.0.1
APP_PORT=8000
API_V1_PREFIX=/api/v1
APP_PUBLIC_URL=http://127.0.0.1:8000
FRONTEND_URL=http://localhost:3000
```

### Database
```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=restaurant_admin
POSTGRES_PASSWORD=
POSTGRES_DB=restaurant_core
POSTGRES_SCHEMA=public
DATABASE_URL=                  # if set, overrides the discrete fields above
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_ECHO=false
```

### Security
```
SECRET_KEY=
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### Redis
```
REDIS_URL=redis://localhost:6379/0
REDIS_ENABLED=true
REDIS_FAILURE_DISABLE_SECONDS=60     # auto-disable after this long, same as BusinessOSAI
CACHE_TTL_SECONDS=300
```

### Storage (MinIO)
```
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=<SECRET_a1c198aa>ET=restaurant-media
MINIO_SECURE=false
```

### WhatsApp
```
WHATSAPP_GATEWAY_URL=http://127.0.0.1:8005    # 127.0.0.1 not localhost — Windows IPv6
WHATSAPP_ENABLED=true
```

### Printing
```
PRINT_BRIDGE_URL=http://127.0.0.1:8006
PRINT_BRIDGE_ENABLED=true
KOT_PRINT_RETRY_MAX=5
KOT_PRINT_RETRY_DELAY_SECONDS=30
```

### KDS / Realtime
```
KDS_WS_ENABLED=true
KDS_WS_HEARTBEAT_SECONDS=20
KOT_AUTO_ACK_TIMEOUT_MINUTES=5      # flag ticket if kitchen hasn't acknowledged
KDS_POLL_FALLBACK_SECONDS=5         # used when WebSocket is unavailable
KITCHEN_BACKLOG_ALERT_COUNT=10      # warn when a station has this many open tickets
```

### Email
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=<SECRET_b6b33eec>M_FROM=noreply@restaurantos.app
RESEND_API_KEY=
```

### AI (cascade: Gemini → OpenAI → Anthropic)
```
AI_PROVIDER=gemini
GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
AI_MODEL_GEMINI=gemini-2.0-flash
AI_MODEL_OPENAI=gpt-4o-mini
AI_MODEL_ANTHROPIC=claude-sonnet-5
AI_MAX_TOKENS=2048
```

### Payments
```
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=<SECRET_4728b9b9>Y_MODE=true
STRIPE_SECRET_KEY=<SECRET_08bd9145>ERCHANT_ID=
PHONEPE_SALT_KEY=
PAYTM_MERCHANT_ID=
CASHFREE_APP_ID=
CASHFREE_SECRET_KEY=<SECRET_bd5fa5bf>NT_ID=
COD_ENABLED=true
CREDIT_SALE_ENABLED=false
```

### Tax / GST (Whitebooks GSP)
```
WHITEBOOKS_ENABLED=false
WHITEBOOKS_GSP_APP_KEY=
WHITEBOOKS_GSP_CLIENT_ID=
WHITEBOOKS_GSP_CLIENT_SECRET=<SECRET_c89b7c3f>NAME=
WHITEBOOKS_GSP_PASSWORD=
WHITEBOOKS_GSP_GSTIN=
WHITEBOOKS_GSP_BASE_URL=https://gsp.whitebooks.com
EINVOICE_ENABLED=false
EWAY_BILL_ENABLED=false
```

### Aggregators
```
ZOMATO_ENABLED=false
ZOMATO_API_KEY=
SWIGGY_ENABLED=false
SWIGGY_API_KEY=
MAGICPIN_ENABLED=false
DOTPE_ENABLED=false
```

### Locale
```
DEFAULT_TIMEZONE=Asia/Kolkata
DEFAULT_CURRENCY=INR
DEFAULT_COUNTRY=IN
```

---

## 15. Seed Data

`init_db.py` seeds this on first run, guarded by existence checks so it's idempotent.

### 15.1 Permissions
The full catalogue from §8, written into `permissions` as `(code, name, module, description)`
tuples in `utils/security.py` — same `ALL_PERMISSIONS` tuple-of-tuples pattern as BusinessOSAI.

### 15.2 Roles
| Role | Permission scope |
|------|------------------|
| **Tenant Owner** | Implicit `*` via `is_tenant_owner` — no rows needed |
| **Outlet Manager** | Everything except `manage:integrations`, `post:journal_entries`, `manage:api_keys` |
| **Cashier** | `view:menu_items`, `manage:orders`, `view:tables`, `fire:kot`, `view:bills`, `manage:bills`, `settle:bills`, `apply:discounts`, `view:customers`, `manage:customers`, `view:shifts`, `manage:shifts`, `view:pos_reports` |
| **Captain** | `view:menu_items`, `manage:orders`, `view:tables`, `manage:tables`, `fire:kot`, `manage:reservations`, `manage:waitlist`, `view:bills`, `manage:bills`, `apply:discounts`, `view:customers` |
| **Waiter** | `view:menu_items`, `view:orders`, `view:tables`, `view:kot` |
| **Kitchen (KDS)** | `view:kot`, `acknowledge:kot`, `prepare:kot`, `ready:kot`, `serve:kot`, `view:kitchen_analytics` |
| **Purchase Manager** | All `purchase:*`, `view:inventory`, `manage:inventory`, `receive:grn`, `pay:vendor_bills` |
| **Accountant** | All `accounting:*`, `view:financial_reports`, `view:bills`, `approve:cash_discrepancy`, `close:shifts` |
| **Viewer** | Read-only `view:*` across modules |

### 15.3 Demo tenant
- 1 tenant, 1 tenant-owner user (`owner@demo.com` / seeded password from env, default `demo1234`)
- 1 outlet: `MAIN`, type `DINE_IN`, GSTIN `29ABCDE1234F1Z5`
- 4 sections: AC Hall (10 tables), Non-AC (6), Terrace (4), Bar (6)
- 8 kitchen stations: Tandoor, Fry, Grill, Curry, Salad, Dessert, Beverage, Counter
- 6 UOMs: kg, g, litre, ml, piece, dozen
- 4 tax codes: GST 0%, GST 5%, GST 12%, GST 18% — with HSN `9963` (restaurant service) and `2202` (beverages)
- Payment methods: Cash, Card, UPI, Wallet, Credit
- 1 sample menu: 4 categories (Starters, Main Course, Breads, Beverages), ~12 items with variants and addons
- 2 recipes linked to items so stock deduction is demonstrable
- 5 ingredients with opening stock

### 15.4 Default notification templates
`ORDER_PLACED`, `ORDER_READY`, `BILL_GENERATED`, `RESERVATION_CONFIRMED`,
`RESERVATION_REMINDER`, `FEEDBACK_REQUEST`, `BIRTHDAY_WISH` — all WhatsApp-first with
`{{variable}}` placeholders.

---

## 16. Number Series

Configured per outlet in the `number_series` table. `number_series.py` is reused from
BusinessOSAI with restaurant module aliases added.

| Module | Default format | Example |
|--------|---------------|---------|
| `order` | `ORD-{OUTLET}-{YYMM}-{####}` | `ORD-MAIN-2610-0042` |
| `kot` | `KOT-{OUTLET}-{YYMM}-{####}` | `KOT-MAIN-2610-0187` |
| `bill` | `INV-{OUTLET}-{YYMM}-{####}` | `INV-MAIN-2610-0187` |
| `shift` | `SHF-{OUTLET}-{YYMM}-{###}` | `SHF-MAIN-2610-014` |
| `purchase_request` | `PR-{OUTLET}-{YYMM}-{####}` | `PR-MAIN-2610-0008` |
| `purchase_order` | `PO-{OUTLET}-{YYMM}-{####}` | `PO-MAIN-2610-0012` |
| `grn` | `GRN-{OUTLET}-{YYMM}-{####}` | `GRN-MAIN-2610-0012` |
| `vendor_bill` | `VB-{OUTLET}-{YYMM}-{####}` | `VB-MAIN-2610-0011` |
| `adjustment` | `ADJ-{OUTLET}-{YYMM}-{####}` | `ADJ-MAIN-2610-0003` |
| `wastage` | `WST-{OUTLET}-{YYMM}-{####}` | `WST-MAIN-2610-0021` |
| `production_batch` | `PRD-{OUTLET}-{YYMM}-{####}` | `PRD-MAIN-2610-0006` |
| `transfer` | `TRF-{YYMM}-{####}` | `TRF-2610-0004` |
| `day_close` | `DC-{OUTLET}-{YYMMDD}` | `DC-MAIN-261013` |
| `reservation` | `RSV-{OUTLET}-{YYMM}-{####}` | `RSV-MAIN-2610-0031` |

**Rule:** numbers are allocated inside the same transaction as the row insert, with a
`SELECT ... FOR UPDATE` on the series row, so concurrent cashiers can't collide.

---

## 17. Realtime — KDS WebSocket Protocol

Browsers can't set an `Authorization` header on a WebSocket, so auth is a short-lived
token in the query string.

### Connection
```
WS /api/v1/kitchen/kds/stream?token=<jwt>
```

The JWT is issued by `POST /kitchen/kds/ticket` (60-second TTL) and carries
`outlet_id` + `station_id`. The socket only ever emits tickets for that station.

### Server → client
| Type | Payload | When |
|------|---------|------|
| `kot.created` | full KOT with items | ticket fired |
| `kot.updated` | KOT with changed fields | any status transition |
| `kot.item.status` | `{kot_id, item_id, status}` | single item prepared |
| `kot.cancelled` | `{kot_id, reason}` | item cancelled after firing |
| `order.updated` | `{order_id, status}` | table order state changed |
| `station.backlog` | `{station_id, open_count}` | backlog threshold crossed |
| `ping` | `{ts}` | every 20s heartbeat |

### Client → server
| Type | Payload | Effect |
|------|---------|--------|
| `kot.ack` | `{kot_id}` | PENDING → ACKNOWLEDGED |
| `kot.prepare` | `{kot_id}` | ACKNOWLEDGED → PREPARING |
| `kot.ready` | `{kot_id}` | PREPARING → READY, notifies captain |
| `kot.serve` | `{kot_id}` | READY → SERVED |
| `pong` | `{ts}` | heartbeat reply |

### Fallback
If the socket drops, the KDS client polls `GET /kitchen/kots?since=<iso_timestamp>&station_id=<id>`
every 5 seconds. The endpoint is the same code path as the WebSocket emit, so both
channels stay consistent.

### Backpressure
`KitchenStation.capacity_concurrent` caps open tickets per station. Excess KOTs are
created with `status=PENDING` and a `station.backlog` event is emitted once the count
crosses `KITCHEN_BACKLOG_ALERT_COUNT`.

---

## 18. Printing

Browsers can't reliably drive ESC/POS thermal printers, so a small local bridge process
handles the actual device I/O. The backend only ever talks HTTP to it.

### Bridge
```
print_bridge/index.js     # Node.js, port 8006
POST /print               # { printer_id, doc_type, payload }
GET  /printers            # enumerate locally attached devices
GET  /health
```

### Document types
| Type | Width | Contents |
|------|-------|----------|
| `KOT` | 80mm | Station name, KOT no, table, covers, waiter, course, items with qty + modifiers + notes, fired_at, priority flag |
| `BILL` | 80mm | Outlet header + GSTIN + FSSAI, bill no, date, items, tax breakup (CGST/SGST/IGST), totals, payment split, round-off, footer |
| `LABEL` | 58mm | Packaging label — item, qty, allergen flags, expiry |
| `REPORT` | A4 PDF | Day close, sales summary |

### Reliability
- If the bridge is unreachable, the print job is queued in Redis and retried up to
  `KOT_PRINT_RETRY_MAX` times, `KOT_PRINT_RETRY_DELAY_SECONDS` apart
- `KOT.printed_count` stays 0 until the bridge confirms — the ops dashboard surfaces
  unprinted tickets so a silent printer failure can't lose kitchen orders
- `POST /printers/{id}/test` fires a diagnostic slip

### PDF
Bill and report PDFs are generated server-side (reportlab / xhtml2pdf) for email and
WhatsApp delivery. The thermal path never goes through PDF.

---

## 19. Business Invariants

Hard rules the services must enforce. These are the ones worth a test each.

1. **Every query filters `tenant_id == ctx.tenant_id`.** Cross-tenant access returns
   404, never 403 — don't confirm a resource exists in another tenant.
2. **Bill generation requires all order items `SERVED` or `CANCELLED`.** You can't bill
   an item still in the kitchen.
3. **A fired item can't be silently deleted.** Removing an `OrderItem` whose KOT is not
   yet `READY` produces a `CANCELLED` KOT with a reason. After `READY`, cancellation
   needs `cancel:kot` permission and logs to `KOTStatusLog`.
4. **`SUM(bill_payments.amount) == bill.grand_total`**, or the bill is explicitly marked
   credit sale. No partial settlement without a credit flag.
5. **`round_off` is at most one currency unit** and is always stored, never inferred.
6. **Stock cannot go negative** unless `InventoryItem.allow_negative_stock` is true.
   Overselling is a data bug, not a rounding artifact.
7. **A bill cannot be voided after its outlet's day close is posted.**
8. **Cash discrepancy above the tenant threshold requires `approve:cash_discrepancy`.**
9. **Discounts apply before tax.** Service charge is taxable and configurable.
10. **Aggregator orders cannot be discounted beyond the aggregator's policy** — enforced
    in `billing_service` against `AggregatorConfig.settings`.
11. **Number allocation and row insert share one transaction** (`SELECT ... FOR UPDATE`).
12. **JSON column mutations are followed by `flag_modified()`.**
13. **Money is `Decimal` end to end** — no float arithmetic anywhere in totals.

---

## 20. API Conventions

### Response envelope
Success returns the resource directly (FastAPI default, matching BusinessOSAI). No
wrapper object.

```json
GET /api/v1/menu/items/{id}
{
  "id": "uuid",
  "tenant_id": "uuid",
  "outlet_id": "uuid",
  "name": "Paneer Tikka",
  "base_price": "280.00",
  ...
}
```

Lists support `?page=1&page_size=50&sort=-created_at&search=...` and return:
```json
{ "items": [...], "total": 142, "page": 1, "page_size": 50 }
```

### Error shape
Always `{ "detail": "..." }`. Status codes:

| Code | Use |
|------|-----|
| 400 | Business rule violation — "A session is already open for this user" |
| 401 | Missing/invalid/expired token |
| 403 | Authenticated but lacks permission |
| 404 | Not found **or cross-tenant** |
| 409 | Conflict — duplicate code, concurrent edit |
| 422 | Pydantic validation failure |
| 502 | External service failed (gateway, Whitebooks, aggregator, print bridge) |

### Idempotency
`POST /billing/orders/{id}/bill` and `POST /billing/bills/{id}/pay` accept an
`Idempotency-Key` header. Double-tapping Pay on a flaky connection must not create two
payments — the key is cached in Redis for 24h.

---

## 21. Testing Strategy

BusinessOSAI has no CI-enforced tests, and that's fine for CRUD. The restaurant money
and kitchen paths are different — a silent bug there costs real revenue, so those get
automated coverage.

### Automated (pytest + async fixtures)
- **`test_money.py`** — totals, discount-before-tax, CGST/SGST vs IGST selection,
  round-off bounds, split-tender reconciliation
- **`test_tax.py`** — interstate/intrastate resolution, cess, inclusive vs exclusive
- **`test_kot_routing.py`** — one KOT per station, re-fire creates a new ticket,
  cancellation propagates, snapshots survive a menu edit
- **`test_inventory.py`** — recipe deduction arithmetic, wastage, transfer variance,
  negative-stock guard
- **`test_tenant_isolation.py`** — every read endpoint returns 404 for another tenant's id

### Smoke tests (manual, per phase)
| Phase | Smoke |
|-------|-------|
| 0 | register → login → `/me` returns context with permissions |
| 1 | create category → item → variant → addon group → recipe via API |
| 2 | open table → add items → running order totals correct |
| 3 | fire order → 1 KOT per station → KDS ack → ready → served |
| 4 | settle bill → payments recorded → tax correct → PDF generated |
| 5 | open shift → take cash → close → day close reconciles |
| 6 | settle bill → stock decremented by recipe → wastage logged |
| 7 | PR → PO → GRN → stock incremented → vendor bill → payment |
| 11 | aggregator webhook → Order created → KOT fired |

---

## 22. Implementation Checklist

Exact files, in build order. Check them off as they land.

### Phase 0 — Skeleton
```
[ ] backend/requirements.txt
[ ] backend/src/config/settings.py              # §14 fields
[ ] backend/src/database/base.py                # Base, 4 mixins
[ ] backend/src/database/session.py             # async engine + get_db
[ ] backend/src/models/core.py                  # Tenant, User, Role, Permission,
                                                # RolePermission, UserRole, RefreshToken,
                                                # UserPasskey, MfaPolicy, ApiKey,
                                                # Outlet, Section, RestaurantTable,
                                                # CostCenter, FiscalYear, Currency, Tag
[ ] backend/src/models/__init__.py              # hub + star imports
[ ] backend/src/utils/security.py               # permission catalogue, JWT, password
[ ] backend/src/api/deps.py                     # CurrentUserContext, require_permission
[ ] backend/src/api/v1/auth.py
[ ] backend/src/api/v1/router.py
[ ] backend/src/main.py                         # app, lifespan, CORS, static mounts
[ ] backend/src/database/init_db.py             # CREATE TABLE + seed (§15)
[ ] backend/src/database/purge.py
[ ] backend/src/schemas/core.py
[ ] backend/tests/conftest.py
[ ] backend/tests/test_auth.py
```

### Phase 1 — Menu & Recipe
```
[ ] backend/src/models/menu.py                  # MenuCategory, MenuItem, MenuItemVariant,
                                                # MenuItemAddonGroup, MenuItemAddon,
                                                # ModifierGroup, Modifier, Recipe,
                                                # RecipeLine, Combo, ComboItem,
                                                # PricingRule
[ ] backend/src/schemas/menu.py
[ ] backend/src/api/v1/menu.py
[ ] backend/src/services/menu_service.py
[ ] backend/src/database/init_db.py             # menu migrations + seed (§15.3)
```

### Phase 2 — Tables & Dine-in Orders
```
[ ] backend/src/models/orders.py                # Order, OrderItem, OrderItemAddon,
                                                # OrderItemCourse, TableSession,
                                                # Reservation, Waitlist
[ ] backend/src/schemas/orders.py
[ ] backend/src/api/v1/dine_in.py
[ ] backend/src/services/order_service.py
[ ] backend/src/services/table_service.py
```

### Phase 3 — KOT / Kitchen (core)
```
[ ] backend/src/models/kitchen.py               # KitchenStation, KOT, KOTItem,
                                                # KDSDevice, KOTStatusLog
[ ] backend/src/schemas/kitchen.py
[ ] backend/src/services/kot_service.py         # station routing, firing, cancellation
[ ] backend/src/api/v1/kitchen.py               # + WS /kds/stream (§17)
[ ] backend/src/services/print_service.py       # bridge client + Redis retry queue
[ ] print_bridge/index.js                       # ESC/POS agent (§18)
[ ] backend/tests/test_kot_routing.py
```

### Phase 4 — Billing & Payments
```
[ ] backend/src/models/billing.py               # Bill, BillItem, BillPayment, Discount,
                                                # DiscountUsage, Coupon,
                                                # ServiceChargeConfig, TipConfig
[ ] backend/src/schemas/billing.py
[ ] backend/src/services/billing_service.py     # totals, tax, split/merge, round-off
[ ] backend/src/services/payment_service.py     # multi-gateway, idempotency (§20)
[ ] backend/src/services/pdf_service.py
[ ] backend/src/api/v1/billing.py
[ ] backend/src/api/v1/discounts.py
[ ] backend/tests/test_money.py
[ ] backend/tests/test_tax.py
```

### Phase 5 — Shifts & Cash
```
[ ] backend/src/models/shift.py                 # Shift, ShiftCashMovement, DayClose
[ ] backend/src/schemas/shift.py
[ ] backend/src/services/shift_service.py       # expected cash, denominations
[ ] backend/src/api/v1/shifts.py
```

### Phase 6 — Inventory & Recipe Deduction
```
[ ] backend/src/models/inventory.py             # InventoryItem, StorageLocation,
                                                # InventoryStock, InventoryBatch,
                                                # StockMovement, WastageLog,
                                                # StockAdjustment, StockAdjustmentLine,
                                                # InterOutletTransfer,
                                                # InterOutletTransferLine,
                                                # ProductionBatch
[ ] backend/src/schemas/inventory.py
[ ] backend/src/services/inventory_service.py   # recipe deduction, stock ops, alerts
[ ] backend/src/api/v1/inventory.py
[ ] backend/tests/test_inventory.py
```

### Phase 7 — Purchase & Vendor
```
[ ] backend/src/models/purchase.py              # Vendor, VendorItem, PurchaseRequest,
                                                # PurchaseRequestLine, PurchaseOrder,
                                                # PurchaseOrderLine, GoodsReceiptNote,
                                                # GoodsReceiptNoteLine, VendorBill,
                                                # VendorBillLine, VendorPayment
[ ] backend/src/schemas/purchase.py
[ ] backend/src/services/purchase_service.py
[ ] backend/src/api/v1/purchase.py
```

### Phase 8 — Staff, Customers, Loyalty
```
[ ] backend/src/models/staff.py                 # Employee, ShiftRoster, Attendance,
                                                # Tip, TipPoolDistribution, Customer,
                                                # Feedback, Complaint
[ ] backend/src/models/loyalty.py               # LoyaltyProgram, CustomerLoyaltyAccount,
                                                # LoyaltyTransaction, CustomerWallet,
                                                # WalletTransaction, GiftCard
[ ] backend/src/schemas/staff.py
[ ] backend/src/schemas/loyalty.py
[ ] backend/src/api/v1/staff.py
[ ] backend/src/api/v1/customers.py
[ ] backend/src/api/v1/loyalty.py
```

### Phase 9 — Accounting & GST
```
[ ] backend/src/models/accounting.py            # TaxCode, ChartOfAccount, JournalEntry,
                                                # JournalEntryLine, GSTReturn, TaxPayment
[ ] backend/src/schemas/accounting.py
[ ] backend/src/services/accounting_service.py  # auto-journal on settle + day close
[ ] backend/src/services/whitebooks_service.py  # IRN + e-way bill
[ ] backend/src/api/v1/accounting.py
```

### Phase 10 — Reports & AI
```
[ ] backend/src/api/v1/reports.py
[ ] backend/src/services/report_service.py
[ ] backend/src/api/v1/ai/copilot.py
[ ] backend/src/services/ai_service.py          # Gemini → OpenAI → Anthropic cascade
[ ] backend/src/services/insight_service.py     # menu engineering, demand forecast
```

### Phase 11 — Integrations
```
[ ] backend/src/models/system.py                # NotificationTemplate, NotificationLog,
                                                # AggregatorConfig, AggregatorOrderMap,
                                                # Printer, AuditLog, ActivityLog
[ ] backend/src/schemas/system.py
[ ] backend/src/api/v1/integrations/aggregators.py
[ ] backend/src/api/v1/integrations/printers.py
[ ] backend/src/api/v1/notifications.py
[ ] backend/src/services/aggregator_service.py
[ ] backend/src/services/notification_service.py
[ ] backend/whatsapp_gateway/                   # copied from BusinessOSAI
```

### Phase 12 — Frontend
```
[ ] frontend/src/lib/api-client.ts              # all modules
[ ] frontend/src/app/(dashboard)/pos/           # terminal
[ ] frontend/src/app/(dashboard)/kitchen/       # KDS
[ ] frontend/src/app/(dashboard)/menu/
[ ] frontend/src/app/(dashboard)/inventory/
[ ] frontend/src/app/(dashboard)/reports/
[ ] frontend/src/app/(dashboard)/settings/
[ ] frontend/src/components/pos/
[ ] frontend/src/components/kitchen/
```

### Docs (written alongside, not after)
```
[ ] CLAUDE.md        # project knowledge — after Phase 0 skeleton exists
[ ] RULES.md         # conventions — copy BusinessOSAI, adjust vocabulary
[ ] ARCHITECTURE.md  # diagrams — after Phase 3, when KOT flow is real
[ ] SKILLS.md        # module docs — after Phase 11
```

---

## 23. Next Step

Phase 0 is fully specified and unblocked. Starting there means:

`requirements.txt` → `settings.py` → `base.py` → `session.py` → `models/core.py` →
`models/__init__.py` → `utils/security.py` → `deps.py` → `auth.py` → `router.py` →
`main.py` → `init_db.py` (core tables + §15 seed) → `tests/conftest.py` + `test_auth.py`,
then a register → login → `/me` smoke test to confirm the foundation works.

No further decisions are needed to begin. The only item worth raising before Phase 12
is **offline POS** (§13, decision 4) — if your outlets have unreliable internet, say so
early, because retrofitting local-first sync is far more expensive than designing for it.
