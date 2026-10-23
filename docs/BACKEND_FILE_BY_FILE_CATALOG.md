# Complete Backend File-by-File Catalog & Purpose Directory

This document lists **every single backend file** in `c:\Users\abhil\Desktop\restaurant\backend\`, explaining its exact architectural purpose, what it implements, and its status.

---

## 1. Top-Level Core & Configuration

| File Path | Purpose & Responsibility | Status |
| :--- | :--- | :--- |
| **[`backend/src/config/settings.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/config/settings.py)** | Centralized Pydantic application settings. Reads `.env` for database URLs, JWT secret keys (`SECRET_KEY`), LLM API keys (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`), Redis URL, and external aggregator tokens. | **DONE** |
| **[`backend/src/utils/security.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/utils/security.py)** | Cryptographic security utilities. Password hashing with bcrypt, JWT token creation (`create_access_token`), token decoding, and signature verification. | **DONE** |
| **[`backend/src/utils/enums.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/utils/enums.py)** | Global enumerations for order statuses (`DRAFT`, `PLACED`, `PREPARING`, `READY`, `SERVED`, `PAID`, `CANCELLED`), payment methods (`CASH`, `CARD`, `UPI`, `CREDIT`), and role types. | **DONE** |
| **[`backend/src/utils/phone.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/utils/phone.py)** | E.164 phone number normalization and Indian mobile number validation helpers. | **DONE** |

---

## 2. Infrastructure & Shared Services (`backend/src/services/shared/` & `event_bus/`)

| File Path | Purpose & Responsibility | Status |
| :--- | :--- | :--- |
| **[`shared/registry.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/shared/registry.py)** | Central plugin manifest. Registers all 14 microservices, their dedicated ports, database names, event topics published/subscribed, and module gating rules. | **DONE** |
| **[`shared/identity.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/shared/identity.py)** | Trusted identity extractor. Decodes `X-Identity-Tenant-Id`, `X-Identity-User-Id`, `X-Identity-Permissions`, and provides `.require()` for granular RBAC. | **DONE** |
| **[`shared/service_factory.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/shared/service_factory.py)** | Standardized FastAPI application builder. Applies uniform CORS, JSON error handlers, database lifecycles, and health check endpoints. | **DONE** |
| **[`shared/service_db.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/shared/service_db.py)** | Database session factory for microservices. Initializes independent SQLAlchemy connection pools and provides `get_db()` dependency injection. | **DONE** |
| **[`shared/service_app.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/shared/service_app.py)** | Standalone runner wrapper for microservices. Allows individual services to boot up as independent processes on their configured port. | **DONE** |
| **[`shared/schema_bootstrap.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/shared/schema_bootstrap.py)** | Automated startup table generator. Ensures SQLAlchemy models are reflected in the PostgreSQL database if tables do not exist. | **DONE** |
| **[`shared/base.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/shared/base.py)** | Common SQLAlchemy declarative base and standard audit mixin columns (`id`, `tenant_id`, `created_at`, `updated_at`). | **DONE** |
| **[`event_bus/bus.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/event_bus/bus.py)** | Pub/Sub event bus backbone. Supports Redis Pub/Sub with automatic graceful degradation to an in-memory asyncio bus if Redis is offline. | **DONE** |
| **[`event_bus/dedupe.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/event_bus/dedupe.py)** | Deduplication ledger. Manages the `consumed_events` table ensuring events (e.g. billing settlements) are not processed twice after restarts. | **DONE** |

---

## 3. Gateway & AI Cascade

| File Path | Purpose & Responsibility | Status |
| :--- | :--- | :--- |
| **[`gateway/app.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/gateway/app.py)** | Reverse Proxy API Gateway (Port 8000/8010). Intercepts incoming requests, validates JWTs, verifies per-tenant module gating licenses, and injects `X-Identity-*` headers. | **DONE** |
| **[`ai_service.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/ai_service.py)** | Multi-LLM provider cascade. Cascades requests across Google Gemini 2.0 (primary) $\to$ Anthropic Claude (failover) $\to$ OpenAI GPT-4o (fallback). Provides `generate_structured_json()` with multimodal image support. | **DONE** |

---

## 4. The 14 Domain Microservices

### 4.1. Auth Service (`backend/src/services/auth/` — Port 8100)
- **[`auth/models.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/auth/models.py)**: ORM entities for `User`, `Role`, `Permission`, `TenantMembership`, `ApiKey`, and `RefreshToken`.
- **[`auth/schemas.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/auth/schemas.py)**: Pydantic request/response validation schemas for login, register, password change, and token refresh.
- **[`auth/service.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/auth/service.py)**: Business logic for credential checking, password salting, role assignment, and JWT issuance.
- **[`auth/api.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/auth/api.py)**: Endpoints `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/tenants`, `/auth/users`.
- **[`auth/util.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/auth/util.py)**: Cookie and bearer token extraction helpers.
- **[`auth/main.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/auth/main.py)**: FastAPI entry point booting the Auth microservice on port 8100.

### 4.2. Organization Service (`backend/src/services/organization/` — Port 8101)
- **[`organization/models.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/organization/models.py)**: Database tables for `Tenant`, `Outlet`, `DiningSection`, `DiningTable`, `CostCenter`, and `NumberSeries`.
- **[`organization/schemas.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/organization/schemas.py)**: Schemas for outlet creation, floor layout sections, table capacity, and series formatting.
- **[`organization/service.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/organization/service.py)**: Logic for outlet assignment, section ordering, and number generation (`INV-2026-0001`).
- **[`organization/api.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/organization/api.py)**: REST routes `/organization/outlets`, `/organization/sections`, `/organization/tables`.
- **[`organization/main.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/organization/main.py)**: FastAPI entry point on port 8101.

### 4.3. Menu & AI Service (`backend/src/services/menu/` — Port 8102)
- **[`menu/models.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/menu/models.py)**: ORM entities for `Category`, `MenuItem`, `Variant`, `AddonGroup`, `Modifier`, `Recipe`, and `RecipeLine`.
- **[`menu/schemas.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/menu/schemas.py)**: Schemas for dish authoring, recipe lines, and AI search requests (`AiRecipeSearchRequest`, `AiReconcileRequest`, `AiReorderRequest`).
- **[`menu/service.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/menu/service.py)**: CRUD business logic for categories, menu items, and pricing rules.
- **[`menu/catalog.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/menu/catalog.py)**: Static embedded recipe database with verified BOM lines and stable inventory item codes.
- **[`menu/seed_catalog.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/menu/seed_catalog.py)**: Seeder script populating initial dishes and BOM specifications.
- **[`menu/recipe_ai.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/menu/recipe_ai.py)**: Core engine implementing `/ai-recipe-search`, `/ai-recipe-reconcile`, and `/ai-recipe-reorder`.
- **[`menu/api.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/menu/api.py)**: REST API mounting menu item routes and AI recipe endpoints.
- **[`menu/main.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/menu/main.py)**: FastAPI entry point on port 8102.

### 4.4. POS Service (`backend/src/services/pos/` — Port 8103)
- **[`pos/models.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/pos/models.py)**: ORM entities for `Order`, `OrderItem`, `OrderItemModifier`, `TableSession`, and `OrderDiscount`.
- **[`pos/schemas.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/pos/schemas.py)**: Schemas for cart creation, modifier additions, split order requests, and table assignments.
- **[`pos/service.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/pos/service.py)**: Core order state machine (`DRAFT` $\to$ `PLACED` $\to$ `COMPLETED`).
- **[`pos/outbox.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/pos/outbox.py)**: Transactional outbox table and relay polling worker for `order.placed` and `order.cancelled`.
- **[`pos/api.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/pos/api.py)**: REST endpoints for order placement, item additions, and table checkout.
- **[`pos/main.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/pos/main.py)**: FastAPI entry point on port 8103.

### 4.5. Kitchen Display Service (`backend/src/services/kitchen/` — Port 8104)
- **[`kitchen/models.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/kitchen/models.py)**: ORM entities for `KitchenStation`, `KotTicket`, `KotItem`, and `KotStatusAudit`.
- **[`kitchen/schemas.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/kitchen/schemas.py)**: Schemas for KOT creation, status transitions, and item cancellation.
- **[`kitchen/service.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/kitchen/service.py)**: KDS routing logic (sending food to Pantry vs Hot Kitchen vs Bar based on category).
- **[`kitchen/outbox.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/kitchen/outbox.py)**: Transactional outbox recording `kot.fired` and `kot.ready`.
- **[`kitchen/api.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/kitchen/api.py)**: Routes for cook station display, item bump status, and KOT reprints.
- **[`kitchen/main.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/kitchen/main.py)**: FastAPI entry point on port 8104.

### 4.6. Billing Service (`backend/src/services/billing/` — Port 8105)
- **[`billing/models.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/billing/models.py)**: ORM entities for `Bill`, `BillItem`, `Payment`, `PaymentRefund`, `TaxLine`, and `ReceiptTemplate`.
- **[`billing/schemas.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/billing/schemas.py)**: Schemas for bill generation, split payments, coupon validation, and tip addition.
- **[`billing/service.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/billing/service.py)**: Tax calculation (CGST, SGST, IGST, Service Charge) and invoice numbering.
- **[`billing/outbox.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/billing/outbox.py)**: Transactional outbox recording `bill.paid` and `payment.received`.
- **[`billing/api.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/billing/api.py)**: Billing routes `/billing/bills`, `/billing/pay`, `/billing/templates`.
- **[`billing/main.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/billing/main.py)**: FastAPI entry point on port 8105.

### 4.7. Inventory Service (`backend/src/services/inventory/` — Port 8106)
- **[`inventory/models.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/inventory/models.py)**: Tables for `InventoryItem`, `StockLevel`, `StockMovement`, `StockAdjustment`, `WastageRecord`.
- **[`inventory/schemas.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/inventory/schemas.py)**: Schemas for stock creation, transfer between central warehouse and kitchen, and physical audits.
- **[`inventory/service.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/inventory/service.py)**: Stock valuation (FIFO / Weighted Average) and consumption deduction logic.
- **[`inventory/outbox.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/inventory/outbox.py)**: Transactional outbox recording `stock.movement.created`, `stock.low`, `stock.out`.
- **[`inventory/api.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/inventory/api.py)**: Optimized batch endpoint `/items/cost-lookup` and stock movement endpoints.
- **[`inventory/main.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/inventory/main.py)**: FastAPI entry point on port 8106.

### 4.8. Purchase Service (`backend/src/services/purchase/` — Port 8107)
- **[`purchase/models.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/purchase/models.py)**: Tables for `Vendor`, `VendorItem`, `PurchaseRequest`, `PurchaseOrder`, `PurchaseOrderLine`, `GoodsReceivedNote`.
- **[`purchase/schemas.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/purchase/schemas.py)**: Schemas for vendor onboarding, PO generation, and GRN inspection.
- **[`purchase/service.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/purchase/service.py)**: Procurement lifecycle logic, automated reorder creation, and 3-way matching.
- **[`purchase/api.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/purchase/api.py)**: REST routes `/purchase/purchase-orders`, `/purchase/purchase-requests`, `/purchase/open-by-item`.
- **[`purchase/main.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/purchase/main.py)**: FastAPI entry point on port 8107.

### 4.9. Staff Service (`backend/src/services/staff/` — Port 8108)
- **[`staff/models.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/staff/models.py)**: Tables for `Employee`, `ShiftRoster`, `AttendanceRecord`, `TipDistribution`.
- **[`staff/schemas.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/staff/schemas.py)**: Employee registration and clock-in/clock-out payload validation.
- **[`staff/service.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/staff/service.py)**: Shift scheduling and tip pooling calculations.
- **[`staff/api.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/staff/api.py)**: Employee endpoints `/staff/employees`, `/staff/attendance`.
- **[`staff/main.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/staff/main.py)**: FastAPI entry point on port 8108.

### 4.10. Customers Service (`backend/src/services/customers/` — Port 8109)
- **[`customers/models.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/customers/models.py)**: Database tables for `Customer`, `CustomerAddress`, `CustomerTag`, and `CustomerVisitLog`.
- **[`customers/schemas.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/customers/schemas.py)**: Schemas for customer profiles, GSTIN validation, and preferences.
- **[`customers/service.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/customers/service.py)**: Customer matching logic by phone number, spend aggregation.
- **[`customers/api.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/customers/api.py)**: CRM endpoints `/customers/`, `/customers/{id}/history`.
- **[`customers/main.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/customers/main.py)**: FastAPI entry point on port 8109.

### 4.11. Loyalty Service (`backend/src/services/loyalty/` — Port 8110)
- **[`loyalty/models.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/loyalty/models.py)**: Tables for `LoyaltyProgram`, `LoyaltyAccount`, `PointTransaction`, and `RewardTier`.
- **[`loyalty/schemas.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/loyalty/schemas.py)**: Schemas for earn/burn rules and point redemption requests.
- **[`loyalty/service.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/loyalty/service.py)**: Point calculation engine (e.g. 1 point per ₹100 spent) and expiration handler.
- **[`loyalty/api.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/loyalty/api.py)**: Routes `/loyalty/accounts`, `/loyalty/redeem`.
- **[`loyalty/main.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/loyalty/main.py)**: FastAPI entry point on port 8110.

### 4.12. Accounting Service (`backend/src/services/accounting/` — Port 8111)
- **[`accounting/models.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/accounting/models.py)**: Tables for `ChartOfAccounts`, `JournalEntry`, `JournalLine`, `FiscalYear`, `TaxReturn`.
- **[`accounting/schemas.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/accounting/schemas.py)**: Double-entry debit/credit balance validation schemas.
- **[`accounting/service.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/accounting/service.py)**: Automatic ledger entry generation from sales invoices, vendor payments, and inventory adjustments.
- **[`accounting/api.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/accounting/api.py)**: Routes for trial balance, ledger statements, and journal posting.
- **[`accounting/main.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/accounting/main.py)**: FastAPI entry point on port 8111.

### 4.13. Reports Service (`backend/src/services/reports/` — Port 8112)
- **[`reports/models.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/reports/models.py)**: Read-model projection tables for `DailySalesSummary`, `HourlySalesPattern`, `ProductMixProjection`.
- **[`reports/schemas.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/reports/schemas.py)**: Filter and aggregation query parameters for financial and inventory analytics.
- **[`reports/service.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/reports/service.py)**: Read-heavy aggregation service consuming event bus topics to refresh read-models asynchronously.
- **[`reports/api.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/reports/api.py)**: Analytics endpoints `/reports/sales`, `/reports/product-mix`, `/reports/gst-summary`.
- **[`reports/main.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/reports/main.py)**: FastAPI entry point on port 8112.

### 4.14. Platform Control Plane (`backend/src/services/platform/` — Port 8113)
- **[`platform/models.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/platform/models.py)**: Tables for `PlatformTenant`, `TenantModuleLicense`, `PlatformAuditEntry`, `GlobalRole`.
- **[`platform/schemas.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/platform/schemas.py)**: Onboarding payloads, license toggles, and breakglass audit requests.
- **[`platform/service.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/platform/service.py)**: Super admin operations: onboarding organizations (e.g. Spice9), activating modules, granting global RBAC.
- **[`platform/api.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/platform/api.py)**: Routes `/platform/tenants`, `/platform/tenants/{id}/modules`, `/platform/audit`.
- **[`platform/main.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/src/services/platform/main.py)**: FastAPI entry point on port 8113.

---

## 5. Scripts, Verification & Operational Files

| File Path | Purpose & Responsibility | Status |
| :--- | :--- | :--- |
| **[`backend/tests/test_recipe_ai_pure.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/tests/test_recipe_ai_pure.py)** | Unit test suite. Tests catalog lexical scoring, LLM JSON extraction, and reorder math without network. | **12 Passed** |
| **[`backend/tests/test_recipe_ai_degrade.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/tests/test_recipe_ai_degrade.py)** | Resilience test suite. Simulates missing API keys and down services to prove that recipe search returns 200 catalog results. | **All Passed** |
| **[`backend/scripts/_smoke_ai_recipe.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/scripts/_smoke_ai_recipe.py)** | Live smoke test script. Mints test JWT and sends requests to `/ai-recipe-search`, `/ai-recipe-reconcile`, and `/ai-recipe-reorder`. | **Verified** |
| **[`backend/scripts/_eventbus_receiver.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/scripts/_eventbus_receiver.py)** | Utility script to listen and dump incoming Redis event bus messages for debugging. | **Active** |
| **[`backend/scripts/probe_eventbus.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/scripts/probe_eventbus.py)** | Diagnostic script testing connection to Redis on port 6379 and verifying latency. | **Active** |
| **[`backend/ro_test.py`](file:///c:/Users/abhil/Desktop/restaurant/backend/ro_test.py)** | Live end-to-end HTTP tester issuing calls to port 8000 for tenant `e9fb216b-6289-43ca-900c-c09eada9840f`. | **Verified** |
| **[`start_redis.bat`](file:///c:/Users/abhil/Desktop/restaurant/start_redis.bat)** | Windows batch script to start local Redis server for cross-service pub/sub messaging. | **Ready** |
