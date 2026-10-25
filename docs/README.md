# RestaurantOS — Master Architecture & Complete File-by-File Documentation Index

Welcome to the complete documentation suite for **RestaurantOS** (Enterprise Multi-Tenant, Multi-Vertical SaaS: RestaurantOS, Salon, Gym, Retail, Clinic & Carwash OS — each a plug-and-play module on the same platform).

---

## 📚 Complete Documentation Suite

The documentation is organized into dedicated blueprints and exhaustive file catalogs:

| Document | Purpose & Scope |
| :--- | :--- |
| **[Backend File-by-File Catalog](file:///c:/Users/abhil/Desktop/restaurant/docs/BACKEND_FILE_BY_FILE_CATALOG.md)** | **Every single backend file** cataloged: config, utils, shared infrastructure, event bus, gateway, AI engine, and all 14 microservices (`models.py`, `schemas.py`, `service.py`, `api.py`, `outbox.py`, `main.py`), including the Platform Control Plane (`/audit`, `/admins`, `/tenants/all` endpoints). |
| **[Frontend File-by-File Catalog](file:///c:/Users/abhil/Desktop/restaurant/docs/FRONTEND_FILE_BY_FILE_CATALOG.md)** | **Every single frontend file** cataloged: core setup, client libraries, all views/routes (including the full `/platform/*` Super Admin control plane), all API services, and UI component hierarchy. |
| **[Backend Architecture](file:///c:/Users/abhil/Desktop/restaurant/docs/BACKEND_ARCHITECTURE.md)** | Deep architectural breakdown of all 14 microservices (9 of which are module-gated at the gateway), database schemas, Transactional Outbox pattern, event bus, multi-LLM AI recipe engine, inventory reconciliation, and the Platform Control Plane's full capability surface (audit trail, admin account management, paged tenant roster, per-tenant module on/off switch) — what is done, and what needs to be done. |
| **[Frontend Architecture](file:///c:/Users/abhil/Desktop/restaurant/docs/FRONTEND_ARCHITECTURE.md)** | Deep breakdown of the SPA client: TanStack Router file-based routing, real-time recipe management, live BOM calculation, interactive POS, KDS station, and the Platform Super Admin portal (dashboard, paged tenant roster, module lifecycle, RBAC/ABAC, admin accounts, audit trail) — what is done, and what needs to be done. |
| **[End-to-End Integration & Roadmap](file:///c:/Users/abhil/Desktop/restaurant/docs/END_TO_END_INTEGRATION.md)** | How frontend and backend connect: Gateway routing, JWT identity forwarding headers, cross-service HTTP calls, the Platform → Auth tenant-roster flow, Outbox event relays, complete end-to-end workflow walkthroughs, and the exhaustive production checklist. |

---

## 🏛️ System High-Level Topology

```
[ Frontend: React + TanStack Router (Port 5173 / 3000) ]
      │  includes the /platform/* Super Admin Control Plane
      │
      ▼ HTTP
[ API Gateway: FastAPI (Port 8000) ]
  • JWT Auth verification (tenant realm)
  • Platform-realm token verification (platform/* routes)
  • Per-tenant module gating on 9 module-gated services
    (menu, pos, kitchen, billing, inventory, purchase, staff,
     customers, loyalty) — suspended/archived modules return 404
  • Forwarded identity injection (X-Identity-*)
      │
  ┌───┼──────────┬──────────┬──────────┬──────────┬──────────┐
  :8100         :8101      :8102      :8103      :8104      :8105
  [Auth]      [Organization][Menu*]  [POS*]   [Kitchen*][Billing*]
  │
  :8106       :8107       :8108      :8109       :8110      :8111
  [Inv*]     [Purchase*] [Staff*]  [Customers*][Loyalty*] [Accounting*]
  │
  :8112       :8113
  [Reports*] [Platform]  ← Super Admin Control Plane (audit,
                            admins, tenant roster, module switch)

  * = module-gated at the gateway (TenantModuleState enforced)

Every service owns its own Postgres database (restaurantos_<name>).
Outbox relays on each service feed a shared event bus (Redis / in-memory).
```

---

## ⚡ Quick Navigation

- **To review every single backend file and its purpose**: Read [BACKEND_FILE_BY_FILE_CATALOG.md](file:///c:/Users/abhil/Desktop/restaurant/docs/BACKEND_FILE_BY_FILE_CATALOG.md).
- **To review every single frontend file and its purpose**: Read [FRONTEND_FILE_BY_FILE_CATALOG.md](file:///c:/Users/abhil/Desktop/restaurant/docs/FRONTEND_FILE_BY_FILE_CATALOG.md).
- **To understand the AI Recipe, BOM, and microservices backend**: Read [BACKEND_ARCHITECTURE.md](file:///c:/Users/abhil/Desktop/restaurant/docs/BACKEND_ARCHITECTURE.md).
- **To understand the UI views, store state, printing, and recipe components**: Read [FRONTEND_ARCHITECTURE.md](file:///c:/Users/abhil/Desktop/restaurant/docs/FRONTEND_ARCHITECTURE.md).
- **To understand authentication flow, cross-service communication, and the roadmap**: Read [END_TO_END_INTEGRATION.md](file:///c:/Users/abhil/Desktop/restaurant/docs/END_TO_END_INTEGRATION.md).
