# Backend Architecture & File-by-File Documentation

This document provides a comprehensive, file-by-file breakdown of the **RestaurantOS Backend Microservices Architecture**, what has been completed, how each component works, and what remains to be done.

---

## 1. Architectural Principles

1. **Independent Microservices with Zero DB Sharing**:
   - Each microservice owns its own isolated PostgreSQL database. No service directly queries another service's database.
2. **Synchronous Queries via HTTP Gateway / Direct Service Calls**:
   - Services communicate via internal HTTP using standard `X-Identity-*` headers.
3. **Asynchronous State Propagation via Transactional Outbox & Event Bus**:
   - Critical domain events (e.g. `bill.paid`, `order.placed`, `kot.fired`, `stock.movement.created`) are written atomically to an `outbox_messages` table within the same DB transaction. A background relay forwards them to the Event Bus (Redis / In-memory), preventing dual-write inconsistencies.
4. **Resilient Degradation**:
   - External dependencies (such as LLM APIs or aggregators) degrade to local catalogs rather than throwing 500 errors.

---

## 2. Port & Service Directory

14 services total; **9 of them are module-gated at the gateway** (their `ServiceDescriptor.enforce_module_gate` is `True`) — those are the ones the Platform Control Plane can switch on/off per tenant, and the gateway returns `404` for requests to a tenant whose module state is suspended/archived.

| Service Name | Port | Database Name | Module-Gated | Primary Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| **API Gateway** | `8000` | N/A | — | Reverse proxy, JWT auth, per-tenant module gating, identity forwarding |
| **Auth** | `8100` | `restaurantos_auth` | No | User accounts, credentials, RBAC roles, tenant memberships |
| **Organization** | `8101` | `restaurantos_organization` | No | Multi-outlet setup, sections, dining tables, number series |
| **Menu & AI** | `8102` | `restaurantos_menu` | **Yes** | Dishes, categories, pricing, recipe catalog, AI Recipe engine |
| **POS** | `8103` | `restaurantos_pos` | **Yes** | Table sessions, cart, live order placement, status tracking |
| **Kitchen (KDS)** | `8104` | `restaurantos_kitchen` | **Yes** | Kitchen display stations, KOT tickets, line-item cooking status |
| **Billing** | `8105` | `restaurantos_billing` | **Yes** | Invoicing, payments, tax calculations, discounts, refunds |
| **Inventory** | `8106` | `restaurantos_inventory` | **Yes** | Central stock, outlet sub-inventory, cost-lookup, wastage |
| **Purchase** | `8107` | `restaurantos_purchase` | **Yes** | Vendors, Purchase Requests (PR), Purchase Orders (PO), GRN |
| **Staff** | `8108` | `restaurantos_staff` | **Yes** | Employees, roles, shifts, attendance, tips |
| **Customers** | `8109` | `restaurantos_customers` | **Yes** | CRM customer profiles, visit history, total spend |
| **Loyalty** | `8110` | `restaurantos_loyalty` | **Yes** | Wallets, points ledger, earn/redeem rules |
| **Accounting** | `8111` | `restaurantos_accounting` | No | Double-entry journal entries, chart of accounts, GST |
| **Reports** | `8112` | `restaurantos_reports` | No | Read-model reporting projections, financial summaries |
| **Platform** | `8113` | `restaurantos_platform_admin` | No | Super Admin control plane, tenant roster, module lifecycle, RBAC/ABAC, audit trail, admin accounts |

> The `enforce_module_gate` flag lives in `backend/src/services/shared/registry.py` on each `ServiceDescriptor`. Only the 9 flagged services check `TenantModuleState` per request; the other 5 (auth, organization, accounting, reports, platform) are always reachable for an authenticated tenant regardless of module state.

**Note on gateway porting**: A stray legacy reference to port `8010` exists in a few places; the live gateway runs on `8000`.


---

## 3. File-by-File Breakdown: Core Backend

### 3.1. Infrastructure & Shared Core (`backend/src/services/shared/` & `event_bus/`)

#### [`shared/registry.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/shared/registry.py)
- **Role**: The centralized plugin manifest. Defines the `ServiceDescriptor` data class and registers all 14 microservices.
- **Key Details**: Stores service ports, database names, required permissions, published topics, subscribed topics, and per-tenant module gating settings. `kind="core"` vs `kind="plugin"`; and the `enforce_module_gate` flag — **9 of the 14** services set this `True` (menu, pos, kitchen, billing, inventory, purchase, staff, customers, loyalty); the remaining 5 (auth, organization, accounting, reports, platform) are always reachable regardless of module state.
- **Status**: **DONE**.

#### [`shared/identity.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/shared/identity.py)
- **Role**: Identity and authorization extraction.
- **Key Details**: Parses incoming `X-Identity-Tenant-Id`, `X-Identity-User-Id`, `X-Identity-Permissions`, and `X-Identity-Is-Owner` headers passed by the Gateway. Provides `.require("permission:string")` helper for granular RBAC.
- **Status**: **DONE**.

#### [`shared/service_factory.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/shared/service_factory.py)
- **Role**: Standardized FastAPI application builder for all microservices.
- **Key Details**: Instantiates FastAPI instances with unified CORS, standard exception handlers, database lifecycle events, and Prometheus/health endpoints.
- **Status**: **DONE**.

#### [`event_bus/bus.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/event_bus/bus.py)
- **Role**: Event distribution backbone.
- **Key Details**: Supports dual-mode operation: Redis Pub/Sub for distributed multi-process environments, with automatic graceful fallback to an asyncio in-memory event bus if Redis is not running.
- **Status**: **DONE**.

#### [`event_bus/dedupe.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/event_bus/dedupe.py)
- **Role**: Idempotent message consumption.
- **Key Details**: Tracks incoming message IDs in a `consumed_events` table so restarts or network retries do not process the same financial or inventory event twice.
- **Status**: **DONE**.

---

### 3.2. AI Engine & Recipe Management (`backend/src/services/ai_service.py` & `menu/`)

#### [`ai_service.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/ai_service.py)
- **Role**: Multi-LLM provider cascade.
- **Key Details**:
  - Primary provider: Google Gemini (`gemini-2.0-flash`).
  - Secondary failover: Anthropic Claude (`claude-3-5-sonnet`).
  - Tertiary fallback: OpenAI (`gpt-4o`).
  - Includes `generate_structured_json()` which accepts dish queries or base64 images and forces strict Pydantic JSON schema generation.
- **Status**: **DONE**.

#### [`menu/recipe_ai.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/menu/recipe_ai.py)
- **Role**: The heart of the AI Recipe & BOM reconciliation system.
- **Key Details**: Implements three key endpoints:
  1. `POST /api/v1/menu/ai-recipe-search`: Fans out query to AI cascade + local catalog + Zomato/Swiggy connectors. Resolves ingredient strings to live inventory item IDs.
  2. `POST /api/v1/menu/ai-recipe-reconcile`: Calls `inventory/cost-lookup` to match available stock against scaled portions, identifying `in_stock`, `low`, and `missing` items.
  3. `POST /api/v1/menu/ai-recipe-reorder`: Directly communicates with the Purchase microservice to create Draft POs for missing items and Purchase Requests for low stock.
- **Status**: **DONE**. Fully tested and passing pure + degrade unit tests.

#### [`menu/catalog.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/menu/catalog.py)
- **Role**: Static recipe database.
- **Key Details**: Contains predefined recipes (Biryani, Butter Chicken, Paneer Tikka, Naan, Dal Makhani, etc.) with verified BOM lines and stable inventory item codes.
- **Status**: **DONE**.

#### [`menu/seed_catalog.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/menu/seed_catalog.py)
- **Role**: Database seed script for initial deployment.
- **Key Details**: Seeds the `restaurantos_menu` database with categories, food items, and base recipes.
- **Status**: **DONE**.

#### [`menu/api.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/menu/api.py)
- **Role**: FastAPI router for menu operations.
- **Key Details**: Exposes category endpoints, item CRUD, pricing rules, recipe lookups, and mounts the `ai_recipe_search` subrouter.
- **Status**: **DONE**.

---

### 3.3. Transactional Outbox Subsystems

To eliminate dual-write race conditions and data loss across services, four services have dedicated outbox tables and relays:

- **[`billing/outbox.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/billing/outbox.py)**: Records `bill.paid` and `bill.refunded` inside the payment transaction.
- **[`inventory/outbox.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/inventory/outbox.py)**: Records `stock.movement.created`, `stock.low`, and `stock.out`.
- **[`kitchen/outbox.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/kitchen/outbox.py)**: Records `kot.fired` and `kot.ready` when kitchen displays update.
- **[`pos/outbox.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/pos/outbox.py)**: Records `order.placed` and `order.cancelled`.

Each outbox file contains:
1. `OutboxMessage` SQLAlchemy model.
2. `record_outbox()` function running in the same DB transaction.
3. Background polling relay worker that selects unpublished messages (`published_at IS NULL`) with `FOR UPDATE SKIP LOCKED` and dispatches them to the event bus.
- **Status**: **DONE**.

---

### 3.4. Procurement & Inventory Microservices

#### [`inventory/api.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/inventory/api.py) & [`inventory/models.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/inventory/models.py)
- **Role**: Inventory tracking and valuation.
- **Key Endpoints**:
  - `GET /api/v1/inventory/items`: List all inventory items for tenant.
  - `GET /api/v1/inventory/items/cost-lookup`: Highly optimized batch lookup returning `{id: {standard_cost, total_available, reorder_level}}`.
  - `POST /api/v1/inventory/adjustments`: Physical inventory audit adjustments.
  - `POST /api/v1/inventory/movements`: Stock transfers between Main Warehouse and Kitchen Sub-Inventory.
- **Status**: **DONE**.

#### [`purchase/api.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/purchase/api.py) & [`purchase/models.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/purchase/models.py)
- **Role**: Procurement and vendor relations.
- **Key Endpoints**:
  - `POST /api/v1/purchase/purchase-orders`: Create draft/approved POs.
  - `POST /api/v1/purchase/purchase-requests`: Create internal restock requests (PR).
  - `GET /api/v1/purchase/open-by-item`: Check existing open POs/PRs to avoid duplicate orders.
  - `POST /api/v1/purchase/grn`: Goods Received Note entry with batch numbers and expiry dates.
- **Status**: **DONE**.

---

### 3.5. Platform Control Plane (`backend/src/services/platform/`)

#### [`platform/service.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/platform/service.py) & [`platform/api.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/platform/api.py)
- **Role**: Super Admin multi-tenant control plane — the entry point for onboarding, license lifecycle, and cross-tenant governance at SaaS scale.
- **Key Details**:
  - **Tenant Onboarding & Roster**
    - `POST /api/v1/platform/tenants`: Onboards an enterprise tenant (e.g. Spice9) with custom slug, plan, initial modules, and owner credentials.
    - `GET /api/v1/platform/tenants`: Lists platform-managed tenants (those with `TenantModuleState` rows).
    - `GET /api/v1/platform/tenants/all`: **Full auth-service tenant roster, paged** (500-row server-side cap, offset pagination). Calls `auth/tenants` over the service mesh, then enriches each row with the tenant's active modules and `module_versions` from the platform DB, and flags `is_managed`. This is the "thousands of tenants" view — the control plane sees every tenant the auth service knows, not just the ones it has onboarded.
  - **Module Lifecycle** (the on/off switch)
    - `GET /api/v1/platform/tenants/{id}/modules`: Lists active/suspended/archived plug-in modules (POS, Kitchen, Inventory, CRM, Salon, etc.).
    - `POST /api/v1/platform/tenants/{id}/modules/{mod}/activate`: Dynamically activates an enterprise module license.
    - `POST /api/v1/platform/tenants/{id}/modules/{mod}/suspend`: Suspends a module — the gateway's per-tenant module gate then returns 404 for that tenant within its 5-second cache window.
    - `POST /api/v1/platform/tenants/{id}/modules/{mod}/archive`: Retires a module permanently for that tenant.
    - `GET /api/v1/platform/plugins`: The full module catalog, including one row per **core service** (menu, pos, kitchen, ... reports) auto-generated from the registry so the gateway's module gate has something to toggle against.
  - **RBAC & ABAC**
    - `GET /api/v1/platform/permissions`: The 67+ fine-grained permission catalogue.
    - `POST /api/v1/platform/permissions`: Register a new permission key.
    - `GET /api/v1/platform/policies`: ABAC policy rules.
    - `POST /api/v1/platform/policies`: Create a policy (allow/deny/mask/limit).
    - `DELETE /api/v1/platform/policies/{policy_id}`: Retire a policy — the action is audit-logged with the rule's content so "what was enforced" is reconstructable after deletion.
  - **Admin Accounts**
    - `GET /api/v1/platform/admins`: List platform-realm admin accounts.
    - `POST /api/v1/platform/admins`: Provision a new admin (role: super_admin / ops_admin / support_admin / billing_admin).
    - `PATCH /api/v1/platform/admins/{admin_id}`: Update role / name / active state. A super admin **cannot deactivate their own account** — last-super-admin self-lockout guard.
  - **Audit Trail**
    - `GET /api/v1/platform/audit`: The immutable control-plane log, paged (500-row cap) and filterable by action / admin email / target type. Every module lifecycle change, policy write, and admin account action lands here.
  - **Cross-service isolation**: all tenant-roster reads go through the Auth service over the service mesh; the platform service never directly peering into another service's database.
- **Status**: **DONE**.

---

## 4. Verification Suite & Test Files

- **[`tests/test_recipe_ai_pure.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/tests/test_recipe_ai_pure.py)**: 12 tests validating string parsing, regex cleaning, JSON schema stripping, and portion calculation without network access. **Passed (100%)**.
- **[`tests/test_recipe_ai_degrade.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/tests/test_recipe_ai_degrade.py)**: End-to-end simulation of LLM API outages and unreachable inventory services. Verifies that the system safely degrades to catalog data without returning 500 errors. **Passed (100%)**.
- **[`scripts/_smoke_ai_recipe.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/scripts/_smoke_ai_recipe.py)**: Issues self-signed JWT tokens and performs live HTTP smoke tests against `/ai-recipe-search`, `/ai-recipe-reconcile`, and `/ai-recipe-reorder`.

---

## 5. What is Done vs. What Needs to Be Done (Backend)

### ✅ What is Done:
1. Complete 14 microservice domain models and REST APIs.
2. API Gateway with JWT claims verification and per-tenant dynamic module gating on 9 module-gated services.
3. Multi-LLM provider cascade (Gemini + Claude + OpenAI) with multimodal image parsing and strict JSON schemas.
4. AI Recipe Search, Catalog fallback, and Inventory BOM reconciliation.
5. Automated idempotent Purchase Order and Purchase Request creation.
6. Transactional Outbox pattern implemented across Billing, POS, Kitchen, and Inventory.
7. Deduplication ledger (`consumed_events`) preventing duplicate event handling.
8. Cross-service HTTP identity forwarding (`X-Identity-*`).
9. **Platform Control Plane full surface**: paged tenant roster (`/tenants/all`), admin account CRUD with self-lockout guard, paged immutable audit trail, policy deletion with audit capture, and per-tenant module on/off lifecycle.
10. **Auth service tenant endpoint hardening**: `GET /tenants` now requires a platform-realm token or an unauthenticated internal-mesh call; tenant-realm callers (even owners with every permission) get 403 — cross-tenant data leak closed.

### ⏳ What Needs to Be Done:
1. **Redis Server Startup**:
   - The event bus and outbox relays are currently running in in-process fallback mode. In production, Redis must run on port `6379` (using the provided [`start_redis.bat`](file:///c:/Users/abhil/Desktop/restaurant/start_redis.bat)) so cross-service pub/sub is distributed across separate OS processes.
2. **Celery / Background Worker Daemonization**:
   - While the outbox relays run as asyncio tasks inside the FastAPI processes, for heavy enterprise scale, launch them as dedicated background worker daemons.
3. **Database Migration Pipeline (Alembic)**:
   - Ensure all `outbox_messages` table migrations are bundled into an automated migration script for fresh tenant installations.
