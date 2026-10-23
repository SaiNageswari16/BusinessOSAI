# RestaurantOS — Master Architecture & Complete File-by-File Documentation Index

Welcome to the complete documentation suite for **RestaurantOS** (Enterprise Multi-Tenant Microservices ERP & Platform Control Plane).

---

## 📚 Complete Documentation Suite

The documentation is organized into dedicated blueprints and exhaustive file catalogs:

| Document | Purpose & Scope |
| :--- | :--- |
| **[Backend File-by-File Catalog](file:///c:/Users/abhil/Desktop/restaurant/docs/BACKEND_FILE_BY_FILE_CATALOG.md)** | **Every single backend file** cataloged: config, utils, shared infrastructure, event bus, gateway, AI engine, and all 14 microservices (`models.py`, `schemas.py`, `service.py`, `api.py`, `outbox.py`, `main.py`). |
| **[Frontend File-by-File Catalog](file:///c:/Users/abhil/Desktop/restaurant/docs/FRONTEND_FILE_BY_FILE_CATALOG.md)** | **Every single frontend file** cataloged: core setup, client libraries, all 27 views/routes (`recipes.tsx`, `pos.tsx`, `kitchen.tsx`, etc.), all 12 API services, and UI component hierarchy. |
| **[Backend Architecture](file:///c:/Users/abhil/Desktop/restaurant/docs/BACKEND_ARCHITECTURE.md)** | Deep architectural breakdown of all 14 microservices, database schemas, Transactional Outbox pattern, event bus, multi-LLM AI recipe engine, inventory reconciliation, what is done, and what needs to be done. |
| **[Frontend Architecture](file:///c:/Users/abhil/Desktop/restaurant/docs/FRONTEND_ARCHITECTURE.md)** | Deep breakdown of the SPA client: TanStack Router file-based routing, real-time recipe management, live BOM calculation, interactive POS, KDS station, what is done, and what needs to be done. |
| **[End-to-End Integration & Roadmap](file:///c:/Users/abhil/Desktop/restaurant/docs/END_TO_END_INTEGRATION.md)** | How frontend and backend connect: Gateway routing, JWT identity forwarding headers, cross-service HTTP calls, Outbox event relays, complete end-to-end workflow walkthroughs, and the exhaustive production checklist. |

---

## 🏛️ System High-Level Topology

```
[ Frontend: React + TanStack Router (Port 5173 / 3000) ]
                      │
                      ▼ HTTP / SSE / WebSockets
        [ API Gateway: FastAPI (Port 8000 / 8010) ]
        • JWT Auth verification
        • Per-tenant module gating (Platform Control Plane)
        • Forwarded identity injection (X-Identity-*)
                      │
   ┌──────────────────┼────────────────────────┬──────────────────┐
   ▼ :8100            ▼ :8102                  ▼ :8103            ▼ :8106
[ Auth Service ]  [ Menu & AI Service ]    [ POS Service ]    [ Inventory Service ]
  Postgres DB       Postgres DB              Postgres DB        Postgres DB
   │                  │                        │                  │
   └─────────┬────────┴────────────┬───────────┴──────────────────┘
             ▼                     ▼
     [ Outbox Relays ] ──► [ Event Bus (Redis / In-Memory) ]
                                   │
                ┌──────────────────┼──────────────────┐
                ▼ :8104            ▼ :8105            ▼ :8107
         [ Kitchen (KDS) ]   [ Billing Service ]  [ Purchase & PR/PO ]
           Postgres DB         Postgres DB          Postgres DB
```

---

## ⚡ Quick Navigation

- **To review every single backend file and its purpose**: Read [BACKEND_FILE_BY_FILE_CATALOG.md](file:///c:/Users/abhil/Desktop/restaurant/docs/BACKEND_FILE_BY_FILE_CATALOG.md).
- **To review every single frontend file and its purpose**: Read [FRONTEND_FILE_BY_FILE_CATALOG.md](file:///c:/Users/abhil/Desktop/restaurant/docs/FRONTEND_FILE_BY_FILE_CATALOG.md).
- **To understand the AI Recipe, BOM, and microservices backend**: Read [BACKEND_ARCHITECTURE.md](file:///c:/Users/abhil/Desktop/restaurant/docs/BACKEND_ARCHITECTURE.md).
- **To understand the UI views, store state, printing, and recipe components**: Read [FRONTEND_ARCHITECTURE.md](file:///c:/Users/abhil/Desktop/restaurant/docs/FRONTEND_ARCHITECTURE.md).
- **To understand authentication flow, cross-service communication, and the roadmap**: Read [END_TO_END_INTEGRATION.md](file:///c:/Users/abhil/Desktop/restaurant/docs/END_TO_END_INTEGRATION.md).
