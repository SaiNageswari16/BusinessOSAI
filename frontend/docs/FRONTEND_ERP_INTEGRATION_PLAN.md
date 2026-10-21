# RestaurantOS & BusinessOS — Enterprise Frontend Integration & Architecture Guide

> **Status:** All 4 Phases Complete & Verified  
> **Frontend Stack:** TanStack Start, TanStack Router (File-based), React 19, Vite 8, Tailwind CSS v4, Radix UI Primitives  
> **HTTP Client:** 100% Native `fetch` (Zero Axios dependencies)  
> **Gateway Target:** `http://localhost:8000/api/v1/*` (14 Microservices + Gateway)  
> **Platform Control Plane:** Port `:8113` via Gateway `/api/v1/platform/*`  
> **Git Branch:** `microservice-architecture`  

---

## 1. Architecture Overview

RestaurantOS / BusinessOS frontend is an enterprise multi-vertical operating system built to support dynamic vertical plug-and-play modules (Restaurant, Salon, Gym, Retail, Clinic, Auto Care) on top of an isolated microservice mesh.

```
                           [ React 19 / TanStack Start Frontend ]
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
             [ Tenant Workspace ]                        [ Platform Super Admin ]
             • Dynamic Nav per Vertical                  • Fleet Telemetry & Mesh (:8000-:8113)
             • RBAC Guarded (<Can />)                    • Tenant Provisioning Wizard
             • POS / Kitchen / Menu / Stock              • Plugin Marketplace & Global Kill-Switch
             • Outlet / Branch Switcher                  • 67+ Permission Key Catalogue
                     │                                             │
                     └──────────────────────┬──────────────────────┘
                                            │ (Native Fetch Client)
                                            │   Bearer <token>
                                            │   X-Tenant-ID
                                            │   X-Outlet-ID
                                            ▼
                               [ API Gateway (:8000) ]
                                            │
   ┌───────────┬───────────┬───────────┬────┴──────┬───────────┬───────────┬───────────┐
   ▼           ▼           ▼           ▼           ▼           ▼           ▼           ▼
:8100       :8102       :8103       :8104       :8105       :8106       ...         :8113
auth     organization     pos        menu      kitchen    inventory              platform
```

---

## 2. Completed Integration Phases

### Phase 1: API Gateway & Auth Client (Pure Native `fetch`)
- **File:** `frontend/src/lib/api-client.ts`
  - **Zero Axios:** Built entirely using web standards `fetch`, `Headers`, and `RequestInit`.
  - **Context Injection:** Injects `Authorization: Bearer <token>`, `X-Tenant-ID`, and `X-Outlet-ID` on all tenant calls.
  - **Dual Realm Authentication:** Injects isolated `platform_token` for `/api/v1/platform/*` endpoints with `isPlatform: true`.
  - **Transparent 401 Refresh Queue:** Catches expired tokens, requests `/api/v1/auth/refresh`, and replays queued requests without dropping in-flight user actions.
  - **Error Envelope Parsing:** Standardizes backend errors into `ApiException` with HTTP status, machine error code, field-level feedback, and request ID.
- **File:** `frontend/src/lib/auth-tokens.ts`
  - SSR-safe browser storage with `typeof window !== "undefined"` guards.
  - Token accessors: `getAccessToken()`, `setAccessToken()`, `getRefreshToken()`, `setRefreshToken()`, `getActiveTenant()`, `getActiveOutlet()`, `getPlatformToken()`, `setPlatformToken()`.
- **File:** `frontend/src/hooks/use-auth.ts`
  - Decodes claims from JWT tokens (`email`, `full_name`, `roles`, `permissions`, `is_tenant_owner`, `tenant_id`, `outlet_id`).
  - Provides `login()`, `logout()`, `switchOutlet()`, and active state synchronization.
- **File:** `frontend/src/routes/login.tsx`
  - Enterprise login page with quick links to tenant app and Platform Super Admin.

---

### Phase 2: Dynamic Navigation & RBAC Guarding
- **File:** `frontend/src/hooks/use-permissions.ts`
  - Granular RBAC evaluation supporting:
    - Single permission checks: `hasPermission("pos:order:create")`.
    - Multiple checks: `hasAnyPermission(...)` and `hasAllPermissions(...)`.
    - Wildcard prefixes: e.g. `pos:*` satisfies `pos:order:create` and `pos:order:settle`.
    - Super-Admin / Tenant Owner bypass: `*` grants access to all modules.
- **File:** `frontend/src/components/common/Can.tsx`
  - Declarative authorization wrapper:
    ```tsx
    <Can permission="menu:item:manage" fallback={<p>Unauthorized</p>}>
      <Button onClick={handleAddDish}>Add Dish</Button>
    </Can>
    ```
- **File:** `frontend/src/lib/modules.ts`
  - Tenant module registry mapping verticals and core add-ons to navigation routes.
  - `resolveTenantNavigation(activeModules, hasPermission)` dynamically builds the sidebar and top navigation based on the tenant's subscribed modules and user permissions.
- **File:** `frontend/src/components/layout/AppShell.tsx`
  - Dynamic navigation rendering with user profile initials, role pills, branch switcher, and direct link to the Platform Super Admin portal.

---

### Phase 3: Typed Service Layer (Native Fetch)
- **File:** `frontend/src/services/organizationService.ts`
  - `getTenants()`, `createTenant()`, `getOutlets()`, `createOutlet()`, `updateOutlet()`, `getTables()`, `createTable()`, `updateTable()`, `setTableStatus()`, `deleteTable()`.
- **File:** `frontend/src/services/menuService.ts`
  - `getCategories()`, `createCategory()`, `deleteCategory()`, `getItems()`, `getItem()`, `createItem()`, `updateItem()`, `deleteItem()`, `toggleAvailability()`.
- **File:** `frontend/src/services/posService.ts`
  - `getOrders()`, `getOrder()`, `createOrder()`, `updateOrderStatus()`, `addOrderLines()`, `recordPayment()`, `settleOrder()`, `cancelOrder()`.
- **File:** `frontend/src/services/inventoryService.ts`
  - `getItems()`, `getItem()`, `createItem()`, `adjustStock()`.
- **File:** `frontend/src/services/orderService.ts`
  - Backwards-compatible facade re-exporting the in-memory React state store for offline fallback while re-exporting all native-fetch microservice clients.

---

### Phase 4: Platform Super Admin Portal UI
- **File:** `frontend/src/services/platformService.ts`
  - Typed client for platform control plane (`:8113`): `login()`, `getFleetHealth()`, `getTenants()`, `onboardTenant()`, `getPlugins()`, `togglePluginKillSwitch()`, `getTenantModules()`, `activateTenantModule()`, `suspendTenantModule()`, `archiveTenantModule()`, `getPermissions()`, `createPermission()`, `getPolicies()`, `createPolicy()`.
- **File:** `frontend/src/components/layout/PlatformShell.tsx`
  - Dedicated Super Admin layout with live fleet health indicator, management domains navigation, and isolated realm profile.
- **Routes:**
  1. `frontend/src/routes/platform.tsx` — Platform layout route with dedicated Super Admin login gate.
  2. `frontend/src/routes/platform/index.tsx` — Telemetry dashboard probing all 14 microservices with real-time latency, port, and database status.
  3. `frontend/src/routes/platform/tenants.tsx` — Enterprise Tenant Provisioning Wizard & multi-tenant registry.
  4. `frontend/src/routes/platform/modules.tsx` — Plug-and-play vertical marketplace & per-plugin global kill-switches.
  5. `frontend/src/routes/platform/permissions.tsx` — 67+ fine-grained permission catalogue and ABAC policy inspector.

---

## 3. How to Run & Verify

### Running the Backend Services & Gateway
In the root backend folder:
```bash
# Start all 14 microservices + Gateway (:8000)
python run_services.py start

# Check status of the mesh
python run_services.py status
```

Verify the platform service and control plane:
```bash
python smoke_platform.py
```
*(All 14 tests pass across auth realm, marketplace, lifecycle, and tenant onboarding).*

### Running the Frontend
In `frontend/`:
```bash
# Development mode (Vite 8 + TanStack Start)
npm run dev

# Production build verification
npm run build
```

---

## 4. Key Endpoints & Architecture Reference

| Domain | Route / Endpoint | Description |
| :--- | :--- | :--- |
| **Gateway Proxy** | `http://localhost:8000/api/v1/{service}/*` | Edge gateway routing to upstream microservices |
| **Auth Realm** | `/api/v1/auth/login`, `/refresh`, `/me` | Tenant users, passwords, and JWTs |
| **Platform Realm** | `/api/v1/platform/auth/login`, `/me` | Isolated super admin credentials |
| **Fleet Telemetry** | `/api/v1/platform/fleet/health` | Live probe across all 14 services |
| **Tenant Provisioning** | `/api/v1/platform/tenants/onboard` | Provisions Auth, Org, and Platform DBs |
| **Module Kill-Switch** | `/api/v1/platform/plugins/{id}/toggle-kill-switch` | Platform-wide emergency cutoff |
| **Tenant UI** | `http://localhost:3000/` | Tenant workspace (POS, KDS, Menu, Stock) |
| **Platform UI** | `http://localhost:3000/platform` | Super Admin Control Plane |

---

## 5. Security & Isolation Invariants

1. **Zero Axios Invariant:** All HTTP communication uses native browser `fetch` via `apiClient`.
2. **Schema Isolation Invariant:** Zero shared declarative bases between services; cross-service entity lookup crosses the HTTP Gateway.
3. **Dual Auth Realm Invariant:** Platform super admins cannot use tenant tokens, and tenant tokens cannot access the `/platform/*` control plane.
4. **Kill-Switch Invariant:** When a vertical is deactivated globally via `toggle-kill-switch`, neither new activations nor operational endpoints can be called for that vertical.
