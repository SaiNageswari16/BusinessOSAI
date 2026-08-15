# CLAUDE.md - Project Knowledge for BusinessOSAI

This file provides project-specific context for Claude Code so future sessions
can immediately understand the codebase without reading every file.

---

## What is BusinessOSAI?

BusinessOSAI is a full-stack business management platform combining CRM, ERP,
and AI automation with WhatsApp integration. It's built for small-to-medium
businesses to manage customers, sales, finances, and communication in one system.

---

## Quick Start

### Start Everything (Development)
```bash
# Terminal 1: Backend (FastAPI)
cd backend
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000

# Terminal 2: WhatsApp Gateway (Node.js)
cd backend/whatsapp_gateway
npm install
node index.js
# Runs on port 8005

# Terminal 3: Frontend (Next.js)
cd frontend
npm install
npm run dev
# Runs on port 3000
```

### Environment Setup
- Backend `.env`: See [ARCHITECTURE.md](./ARCHITECTURE.md) for full list
- Frontend `.env.local`: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`
- Database: PostgreSQL running locally or on cloud
- Redis: Required for caching + rate limiting
- MinIO: Required for file storage

---

## Essential Files (Read These First)

| File | Why |
|------|-----|
| `ARCHITECTURE.md` | Complete system architecture diagram + explanation |
| `SKILLS.md` | 14 feature skills explaining every module |
| `RULES.md` | Coding conventions and architectural rules |
| `frontend/src/lib/api-client.ts` | ALL API methods — know this before writing any frontend code |
| `backend/src/main.py` | FastAPI app entry, middleware, CORS |
| `backend/src/api/v1/auth.py` | Auth endpoints and permission system |
| `backend/src/api/v1/crm.py` | Main CRM router |
| `backend/src/api/v1/crm_modules/whatsapp_automation.py` | WhatsApp proxy layer |
| `backend/whatsapp_gateway/index.js` | NodeJS WhatsApp gateway |

---

## When Working on a Feature

### Adding a New Backend Endpoint
1. Define Pydantic schema in `schemas/` or inline in the route file
2. Add route with `@router.method()` + permission check
3. Use `Depends(get_db)` and `Depends(require_permission("..."))`
4. Add corresponding method in `frontend/src/lib/api-client.ts`
5. Use that method in the frontend component

### Adding a New Frontend Component
1. Check if API method exists in `lib/api-client.ts` (add if not)
2. Place component in appropriate `components/{module}/` folder
3. Use shadcn UI components for base elements
4. Follow Tailwind styling conventions from RULES.md
5. Add route in `app/(dashboard)/{module}/` folder

### Working with WhatsApp
1. Gateway: `backend/whatsapp_gateway/index.js` (Node.js)
2. Proxy: `backend/src/api/v1/crm_modules/whatsapp_automation.py` (FastAPI)
3. Frontend: `frontend/src/components/crm/WhatsappCampaigns.tsx`
4. API client: `whatsappAutomationApi.*` in `api-client.ts`
5. Phone numbers: Always use cleaned digits (no +, no spaces)

### Working with the Database
1. Models in `backend/src/models/`
2. New model: Create class extending `Base`, add to `__init__.py` imports
3. Create migration: `alembic revision --autogenerate -m "description"`
4. Apply: `alembic upgrade head`
5. Add API routes in appropriate module file

### Adding CRM Module (Discounts, Loyalty, etc.)
1. Create route file in `api/v1/crm_modules/{name}.py`
2. Import and include in `api/v1/crm.py` router
3. Store config in `Tenant.settings` JSON (no new DB table needed for simple config)
4. For complex data, create dedicated model
5. Add frontend tab/page in CRM module

---

## Common Gotchas

1. **Phone numbers**: Always clean to digits-only before DB operations
2. **Tenant isolation**: Every query MUST filter by `tenant_id = ctx.tenant_id`
3. **JSON fields**: Use `flag_modified(tenant, "settings")` after modifying JSON columns
4. **WhatsApp gateway URL**: Always use `127.0.0.1` not `localhost` (Windows IPv6 issue)
5. **Pydantic aliases**: `from_` field uses `Field(alias="from")` with `populate_by_name=True`
6. **Frontend imports**: Always use `@/` path alias (not relative paths)
7. **Form submissions**: Always wrap in try/catch with loading state
8. **Media uploads**: Base64 data does NOT include the `data:image/...;base64,` prefix when sending to backend

---

## Project-Specific Terminology

| Term | Meaning |
|------|---------|
| **Tenant** | An organization/company using the platform |
| **Tenant Owner** | The primary admin of a tenant (super-admin role) |
| **Agent** | CRM user who manages leads/deals |
| **Manager** | Can view team data, approve expenses |
| **Lead** | A potential customer (from WhatsApp, forms, etc.) |
| **CrmCustomer** | A confirmed/active customer in CRM |
| **Deal** | A sales opportunity with stages (pipeline) |
| **Sales Order Type** | Template for recurring sales order patterns |
| **Session** (WhatsApp) | A connected WhatsApp phone number |
| **JID** | WhatsApp JID format: `{phone}@c.us` or `{phone}@lid` |
| **LID** | WhatsApp Linked ID (newer WhatsApp account format) |
| **RAG** | Retrieval-Augmented Generation (AI context enrichment) |
| **COA** | Chart of Accounts (accounting) |
| **UOM** | Unit of Measure (inventory/ERP) |

---

## Recent Changes (from git log)
- `meta and gst` — Meta Ads + GST tax features
- `meta ads fixing` — Paid advertising module fixes
- `view changes` — UI/UX improvements
- `fixing inventory issue` — Inventory management bug fixes
- `redis` — Redis caching/rate limiting integration
- Latest WhatsApp: Added media send (images + PDFs) with caption support

---

## Key Dependencies

### Backend (Python)
```
fastapi, sqlalchemy, asyncpg, redis, httpx, whatsapp-web.js (via httpx)
openai, anthropic, google-generativeai
pydantic, python-jose, passlib, python-multipart
minio, resend, supabase
alembic, pytest
```

### Frontend (Node.js)
```
next, react, typescript
tailwindcss, shadcn/ui
framer-motion, lucide-react
axios, react-hook-form, zod
react-pdf, xlsx (SheetJS), recharts
sonner (toasts)
```

---

## Testing the System

### Quick Smoke Test
```bash
# 1. Verify backend is running
curl http://localhost:8000/health

# 2. Verify gateway is running
curl http://localhost:8005/sessions

# 3. Create a test tenant + user
# Use the signup page at http://localhost:3000/register

# 4. Test WhatsApp session
curl -X POST http://localhost:8005/sessions/919912345678/start

# 5. Check session status
curl http://localhost:8005/sessions
```

### Common Debug Points
- Frontend console: Check for API errors (red in browser devtools)
- Backend logs: Check terminal running uvicorn
- Gateway logs: Check terminal running node index.js
- Database: `psql -U postgres -d businessosai` to inspect data
- Redis: `redis-cli ping` should return `PONG`

---

## Notes for Future Sessions

1. This project has NO tests enforced in CI (yet) — manual QA is expected
2. The RAG engine is paused (`.rag_enricher_paused` file exists)
3. WhatsApp LID resolution is handled in both gateway and backend
4. Media files (images/PDFs) are sent base64 to gateway, NOT stored server-side
5. The chatbot supports streaming responses but frontend streaming is basic
6. Multi-language support (i18n) is NOT implemented yet — all UI is English
7. Payment integration (Razorpay) exists but may need reconfiguration
8. Meta Ads OAuth tokens stored in `Tenant.settings` — handle carefully
9. File uploads go to MinIO, served through FastAPI proxy
10. The `customers` page (CRM) is the most complex component — read it carefully before modifying
