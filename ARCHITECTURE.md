# BusinessOSAI - Complete Architecture

## System Overview

BusinessOSAI is an AI-powered CRM + ERP platform with a WhatsApp automation layer. It follows a **3-tier microservice architecture** with a Next.js frontend, FastAPI backend, and NodeJS WhatsApp gateway.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────────┐  │
│  │  Next.js SPA  │  │  Admin Panel  │  │  End Users (CRM)   │  │
│  │  (Vercel)     │  │  Dashboard    │  │  ERP Users         │  │
│  └───────┬───────┘  └───────┬───────┘  └────────────────────┘  │
└──────────┼──────────────────┼──────────────────────────────────┘
           │                  │
           ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API GATEWAY LAYER                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Next.js API Routes (app/api/)                 │  │
│  │  Authentication | Upload | Auth Callbacks | Email          │  │
│  └──────────────────────┬────────────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND LAYER                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  FastAPI (port 8000)                                       │   │
│  │  ┌──────────────────────────────────────────────────────┐ │   │
│  │  │  API Routers (src/api/v1/)                            │ │   │
│  │  │  ┌────────────┬──────────────┬───────────────────┐  │ │   │
│  │  │  │ Auth       │ CRM Modules  │ ERP Modules       │  │ │   │
│  │  │  │ (auth.py)  │ (crm.py)     │ (erp/*.py)        │  │ │   │
│  │  │  └──────┬─────┴──────┬──────┴──────┬────────────┘  │ │   │
│  │  │         │             │              │               │ │   │
│  │  │  ┌──────▼─────┐  ┌───▼────────┐ ┌──▼─────────────┐ │ │   │
│  │  │  │ Chatbot     │  │ WhatsApp   │ │ Accounting/    │ │ │   │
│  │  │  │ Engine      │  │ Automation │ │ Finance/HRM    │ │ │   │
│  │  │  └─────────────┘  └────────────┘ └────────────────┘ │ │   │
│  │  └──────────────────────────────────────────────────────┘ │   │
│  │  ┌──────────────────────────────────────────────────────┐ │   │
│  │  │  Core Services                                        │ │   │
│  │  │  Auth Service │ File Service │ RAG Engine │ LLM Router│ │   │
│  │  └──────────────────────────────────────────────────────┘ │   │
│  └──────────────────────┬────────────────────────────────────┘   │
│                         │                                         │
│  ┌──────────────────────▼────────────────────────────────────┐   │
│  │  SQLAlchemy ORM → PostgreSQL (asyncpg + pgvector)          │   │
│  │  Redis (caching + rate limiting)                            │   │
│  │  MinIO/S3 (file storage)                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              WHATSAPP GATEWAY LAYER                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Node.js Express (port 8005)                              │   │
│  │  whatsapp-web.js → puppeteer                              │   │
│  │  Manages WhatsApp sessions, message sending, contacts     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                             │
│  OpenAI │ Anthropic │ Google Gemini │ Twilio │ Razorpay │       │
│  Resend │ Supabase Auth │ LinkedIn API │ Meta Ads API           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture (Next.js App Router)

### Directory Structure
```
frontend/src/
├── app/                          # Next.js App Router pages
│   ├── (auth)/                   # Auth group routes (login, register, forgot-password)
│   ├── (dashboard)/              # Authenticated dashboard routes
│   │   ├── dashboard/            # Main dashboard shell
│   │   ├── crm/                  # CRM pages
│   │   ├── erp/                  # ERP pages
│   │   ├── sales/                # Sales pages
│   │   ├── marketing/            # Marketing pages
│   │   ├── accounting/           # Accounting pages
│   │   ├── service/              # Service/Support pages
│   │   ├── profile/              # User profile
│   │   ├── admin/                # Admin settings
│   │   └── help/                 # Help center
│   └── layout.tsx / page.tsx     # Root layout & page
│
├── components/
│   ├── ui/                       # Shadcn UI components (Button, Card, etc.)
│   ├── auth/                     # Auth components (LoginForm, ProtectedRoute)
│   ├── layout/                   # Sidebar, TopBar, AppShell
│   ├── dashboard/                # Dashboard-specific components
│   ├── crm/                      # CRM-specific components
│   ├── erp/                      # ERP-specific components
│   ├── sales/                    # Sales-specific components
│   ├── marketing/                # Marketing components (MetaAds, etc.)
│   ├── accounting/               # Accounting components
│   ├── service/                  # Service/support components
│   └── feedback/                 # Feedback components
│
├── lib/
│   ├── api-client.ts             # TypeScript API client (ALL backend endpoints)
│   ├── auth-context.tsx           # AuthContext provider
│   ├── auth.ts                   # Auth utilities (login, register, logout)
│   ├── whatsapp-media.ts         # WhatsApp media helper
│   └── utils.ts                  # Utility functions (formatCurrency, formatDate, etc.)
│
├── hooks/                        # Custom React hooks
├── contexts/                     # React contexts (beyond auth)
├── types/                        # TypeScript type definitions
└── styles/                       # Global styles
```

### Page Grouping (Route Groups)
- `(auth)` → Routes NOT requiring authentication
- `(dashboard)` → Routes requiring authentication (shares same layout)
- `dashboard/` → Main dashboard page (redirects to first module)
- `crm/`, `erp/`, `sales/`, etc. → Module-specific pages

### Technology Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v3 + Shadcn UI components
- **State**: React Context (no Redux/Zustand)
- **Forms**: React Hook Form + Zod validation
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **PDF**: react-pdf / @react-pdf/renderer
- **Spreadsheets**: SheetJS (xlsx)
- **Charts**: Recharts
- **WebSockets**: Native WebSocket API

---

## Backend Architecture (FastAPI + SQLAlchemy)

### Directory Structure
```
backend/src/
├── api/v1/                       # API v1 routes
│   ├── auth.py                   # Authentication endpoints
│   ├── crm.py                    # CRM router (aggregates CRM modules)
│   ├── crm_modules/              # CRM sub-modules
│   │   ├── whatsapp_automation.py # WhatsApp gateway proxy
│   │   ├── discounts.py          # Discount management
│   │   ├── loyalty.py            # Loyalty programs
│   │   ├── wallet.py             # Wallet management
│   │   ├── memberships.py        # Membership management
│   │   ├── groups.py             # Customer groups
│   │   └── segments.py           # Customer segmentation
│   ├── erp/                      # ERP sub-modules
│   │   ├── erp_system.py         # ERP core
│   │   ├── accounting.py         # Accounting
│   │   ├── financial.py          # Financial management
│   │   ├── financial_reports.py  # Financial reports
│   │   ├── invoices.py           # Invoice management
│   │   ├── budgets.py            # Budget management
│   │   ├── bank.py               # Banking operations
│   │   ├── expense_claims.py     # Expense claims
│   │   ├── fixed_assets.py       # Fixed assets
│   │   ├── audit.py              # Audit trail
│   │   └── master_data.py        # Master data (items, units, charts)
│   └── deps.py                   # Shared dependencies (auth, DB session)
│
├── models/                       # SQLAlchemy ORM models
│   ├── User.py
│   ├── Tenant.py
│   ├── Customer.py
│   ├── CrmCustomer.py
│   ├── CrmContact.py
│   ├── CrmDeal.py
│   ├── CrmTask.py
│   ├── CrmNote.py
│   ├── CrmDocument.py
│   ├── CrmSalesOrder.py
│   ├── CrmSalesOrderItem.py
│   ├── CrmSalesOrderType.py
│   ├── CrmTicket.py
│   ├── Lead.py
│   ├── LeadActivity.py
│   ├── Product.py
│   ├── ServiceProduct.py
│   ├── Supplier.py
│   ├── Invoice.py
│   ├── ChatbotSession.py
│   ├── ChatbotMessage.py
│   ├── Payment.py
│   ├── Budget.py
│   ├── BudgetLine.py
│   ├── FixedAsset.py
│   ├── Claim.py
│   ├── Approval.py
│   ├── AuditLog.py
│   ├── Conversation.py
│   ├── Campaign.py
│   ├── LeadScore.py
│   ├── Opportunity.py
│   └── ... (more)
│
├── database/                     # Database configuration
│   ├── session.py                # Async session factory
│   ├── base.py                   # Base model class
│   └── migrations/               # Alembic migrations
│
├── core/                         # Core services
│   ├── config.py                 # Settings/env configuration
│   ├── security.py               # JWT + password hashing
│   ├── logging.py                # Logging configuration
│   └── exceptions.py             # Custom exceptions
│
├── services/                     # Business logic services
│   ├── file_service.py           # File upload/download (MinIO/S3)
│   ├── chatbot_service.py        # LLM-powered chatbot logic
│   ├── pdf_service.py            # PDF generation
│   ├── email_service.py          # Email via Resend
│   └── ...
│
├── schemas/                      # Pydantic schemas
│   ├── user.py
│   ├── crm.py
│   ├── auth.py
│   └── ...
│
├── main.py                       # FastAPI app entry point
├── deps.py                       # Dependency injection
└── .env                          # Environment variables
```

### Technology Stack
- **Framework**: FastAPI
- **Language**: Python 3.11+
- **ORM**: SQLAlchemy 2.x (async)
- **Database**: PostgreSQL + pgvector (embeddings)
- **Cache**: Redis
- **Storage**: MinIO (S3-compatible)
- **AI/LLM**: OpenAI GPT, Anthropic Claude, Google Gemini
- **Auth**: JWT + Supabase Auth
- **RAG**: Vector search with pgvector
- **Validation**: Pydantic v2

---

## WhatsApp Automation Layer

### NodeJS Gateway (`backend/whatsapp_gateway/`)
- **Library**: whatsapp-web.js (puppeteer-based)
- **Port**: 8005
- **Architecture**: One WhatsApp Client per session (phone number)
- **Authentication**: LocalAuth (persists session in `.wwebjs_auth/`)
- **Core Functions**:
  1. `startClient(id)` → Initialize WhatsApp client, handle QR → CONNECTED lifecycle
  2. `resolveJid(client, phone)` → Convert phone number to WhatsApp JID
  3. Message sending (text + media)
  4. Contact sync
  5. Live chat history fetching

### FastAPI Proxy (`backend/src/api/v1/crm_modules/whatsapp_automation.py`)
- Proxies all WhatsApp operations to the NodeJS gateway
- Stores session mapping in `Tenant.settings` (JSON field):
  - `whatsapp_web_sessions`: `["919912345678", "919976543210"]`
  - `agent_whatsapp_sessions`: `{"919912345678": "agent-uuid"}`
- Creates Leads from incoming WhatsApp messages
- Logs all activity as `LeadActivity` records

### Frontend Component (`frontend/src/components/crm/WhatsappCampaigns.tsx`)
- Full WhatsApp chat interface mimicking WhatsApp Web UI
- Features: Session management, contact sync, real-time chat, media send (images + PDFs)
- Uses `api-client.ts` → `whatsappAutomationApi` for all backend calls

### WhatsApp Data Flow
```
User sends message (Frontend)
  → sendMessage() / sendMedia()
    → FastAPI /whatsapp-automation/sessions/{id}/chats/{phone}/send
      → NodeJS Gateway /sessions/{id}/chats/{phone}/send
        → whatsapp-web.js client.sendMessage(jid, message)
          → WhatsApp servers
  → Logs LeadActivity to DB

Incoming message (WhatsApp → Frontend)
  → User sends WhatsApp message
    → whatsapp-web.js 'message' event
      → POST to FastAPI /whatsapp-automation/webhook
        → Creates Lead (if new) + LeadActivity
          → Frontend polls /get-chat-messages
            → Displays in chat UI
```

---

## Database Schema (Key Models)

### Core Models
- **User** → Authentication, permissions, roles (tenant_owner, agent, manager)
- **Tenant** → Organization (settings JSON field for dynamic config)
- **Customer** → ERP customer record
- **CrmCustomer** → CRM customer profile (extends with CRM-specific fields)
- **Lead** → CRM lead (phone, source, status, estimated_value)
- **LeadActivity** → All customer interactions (email, call, whatsapp, etc.)

### CRM Models
- **CrmContact** → Contact person linked to customer/lead
- **CrmDeal** → Deal/pipeline stages
- **CrmTask** → Tasks with priority, due dates, assignments
- **CrmNote** → Notes on customers/leads
- **CrmDocument** → Document management
- **CrmSalesOrder** → Sales order (with linked SalesOrderType)
- **CrmSalesOrderItem** → Line items in sales orders
- **CrmSalesOrderType** → Sales order type template
- **CrmTicket** → Support tickets

### ERP Models
- **Product** / **ServiceProduct** → Products & services
- **Supplier** → Vendor management
- **Invoice** → Billing invoices
- **Payment** → Payment records
- **Budget** / **BudgetLine** → Budget management
- **FixedAsset** → Fixed asset tracking
- **Claim** → Expense claims
- **Approval** → Approval workflow
- **AuditLog** → Audit trail

### AI/Chatbot Models
- **ChatbotSession** → Chat conversation session
- **ChatbotMessage** → Individual messages with role/function calls
- **Campaign** → Marketing campaigns
- **LeadScore** → AI-calculated lead scores

---

## Authentication & Authorization

### Flow
1. User logs in via Supabase Auth (email/password or Google OAuth)
2. Backend validates JWT → returns user context
3. Frontend stores token in localStorage
4. Every API call includes token via axios interceptor

### Permission System
- **Roles**: `tenant_owner`, `manager`, `agent`, `viewer`
- **Permissions**: Scoped strings like `manage:crm_leads`, `view:crm_leads`, `manage:erp_invoices`
- **Enforcement**: Backend `require_permission()` decorator checks every endpoint
- **Agent Isolation**: Agents only see their own leads (filtered by `owner_user_id`)

---

## AI / Chatbot System

### Components
1. **ChatbotEngine** (`backend/src/services/chatbot_service.py`)
   - Manages conversation state
   - Routes to appropriate tools
   - Maintains conversation history

2. **LLM Router** (`backend/src/services/llm_router.py`)
   - Supports OpenAI GPT, Anthropic Claude, Google Gemini
   - Default: OpenAI
   - Streaming support for real-time responses

3. **RAG Engine** (pending: `.rag_enricher_paused`)
   - Retrieves relevant docs from pgvector
   - Enriches AI responses with business context

4. **Tools** (function calling)
   - `get_customer_info` → Look up customer details
   - `search_products` → Search product catalog
   - `create_lead` → Create new lead
   - `log_interaction` → Log CRM activity
   - `get_sales_data` → Retrieve sales figures

---

## File Storage System

### MinIO / S3 Integration
- **Config**: `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`
- **Endpoints**:
  - `POST /upload` → Upload single file (supports multipart + base64)
  - `POST /upload-multiple` → Batch upload
  - `GET /files/{path:path}` → Download/view file
  - `DELETE /files/{filename}` → Delete file
  - `GET /files` → List all files
- **Path format**: `tenant/{tenant_id}/{filename}` (tenant isolation)
- **File types**: Images, PDFs, documents, spreadsheets

### Frontend Upload Flow
```
User selects file
  → FileReader.readAsDataURL (base64)
  → API upload endpoint (multipart + base64 both supported)
    → Backend decodes and stores to MinIO
      → Returns public URL
```

---

## Important Configuration

### Environment Variables (Backend `.env`)
```
DATABASE_URL=postgresql://...          # PostgreSQL connection
REDIS_URL=redis://localhost:6379/0     # Redis
S3_ENDPOINT=...                         # MinIO/S3 endpoint
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=...
S3_REGION=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_AI_API_KEY=...
GEMINI_API_KEY=...
RESEND_API_KEY=...                     # Email service
SUPABASE_URL=...                        # Supabase (auth + DB)
SUPABASE_KEY=...
WHATSAPP_GATEWAY_URL=http://127.0.0.1:8005
FASTAPI_WEBHOOK_URL=http://localhost:8000/api/v1/whatsapp-automation/webhook
JWT_SECRET_KEY=...
```

### Environment Variables (Frontend `.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## Key Integration Points

| Feature | Frontend Component | API Client Method | Backend Endpoint | Backend Service |
|---------|-------------------|-------------------|-----------------|-----------------|
| Auth | LoginForm | authApi.login | POST /auth/login | Auth service |
| CRM Leads | Customers | crmApi.getLeads | GET /crm/leads | Lead model |
| CRM Deals | SalesPipeline | crmApi.getDeals | GET /crm/deals | CrmDeal model |
| CRM Tasks | Tasks | crmApi.getTasks | GET /crm/tasks | CrmTask model |
| ERP Invoices | Invoices | erpApi.getInvoices | GET /erp/invoices | Invoice model |
| Chatbot | ChatbotWidget | chatbotApi.sendMessage | POST /chatbot/message | ChatbotService |
| WhatsApp | WhatsappCampaigns | whatsappAutomationApi | GET/POST /whatsapp-automation/... | Gateway proxy |
| File Upload | ProfilePage | uploadApi.upload | POST /upload | FileService |
| Meta Ads | PaidAdsSection | metaAdsApi | POST /crm/meta-ads/... | Meta Ads API |
| AI Chat | ChatbotInterface | chatbotApi | POST /chatbot/message | LLM Router |

---

## Deployment Architecture

```
                    ┌──────────────┐
                    │   Vercel     │ (Frontend + API Routes)
                    │  (Next.js)   │
                    └──────┬───────┘
                           │
                           ▼
              ┌────────────────────────┐
              │     Render / Railway    │
              │     (FastAPI Backend)   │
              │   PostgreSQL + Redis    │
              │   MinIO (file storage)  │
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   AWS / GCP / Railway   │
              │   (WhatsApp Gateway)    │
              │   whatsapp-web.js       │
              └────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────────┐
        │ OpenAI   │ │WhatsApp  │ │ Supabase Auth │
        │ GPT-4    │ │ Business │ │ + Storage     │
        │Claude    │ │ API      │ │               │
        │Gemini    │ └──────────┘ └──────────────┘
        └──────────┘
```

---

## Important Patterns & Conventions

### Frontend Patterns
- **Component naming**: PascalCase for components, camelCase for functions/variables
- **File naming**: PascalCase for components, kebab-case for utilities
- **API calls**: Always use `lib/api-client.ts` — never fetch directly
- **State**: Use React Context (auth), useState for local state
- **Forms**: React Hook Form with Zod schema validation
- **Styling**: Tailwind utility classes, shadcn components
- **Animations**: Framer Motion (`motion.div`, `AnimatePresence`)

### Backend Patterns
- **Router prefix**: All routers use `prefix="/v1/..."` or module-specific prefix
- **Dependencies**: Use `Depends(get_db)`, `Depends(require_permission("..."))`
- **Models**: SQLAlchemy 2.x async ORM, `flag_modified()` for JSON columns
- **Sessions**: Always `async with _gateway_client() as client:`
- **Error handling**: `HTTPException` with appropriate status codes
- **Logging**: `logger.info()`, `logger.warning()`, `logger.error()`

### WhatsApp Patterns
- **Phone numbers**: Always clean with `_clean_digits()` (strip non-digits)
- **Session IDs**: Use phone numbers as session IDs (clean digits only)
- **JID resolution**: `resolveJid()` handles @lid, @c.us, and @lid fallbacks
- **Tenant mapping**: Stored in `Tenant.settings` JSON field
- **Activity logging**: All messages logged as `LeadActivity` with type `whatsapp_sent`/`whatsapp_received`
