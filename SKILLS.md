# BusinessOSAI - Feature Skills

Each skill below documents a complete feature/module so you can understand, modify, or extend it without reading through all source files. Skills are organized by module.

---

## SKILL 1: Authentication System

**Files**: `frontend/src/lib/auth.ts`, `frontend/src/components/auth/`, `backend/src/api/v1/auth.py`

### How Auth Works
1. **Signup**: Email + password → Backend creates User + Tenant + sends verification email via Resend
2. **Login**: Email + password → Supabase Auth validates → Backend creates JWT session
3. **Session**: JWT stored in frontend localStorage, sent as `Authorization: Bearer <token>`
4. **Token refresh**: Handled by Supabase client automatically
5. **Logout**: Clears localStorage + Supabase session

### Frontend Auth Flow
```
LoginForm → authApi.login(email, password)
  → Stores token in localStorage
  → Updates AuthContext
  → Redirects to /dashboard

ProtectedRoute → Checks AuthContext
  → If no token → redirect to /login
  → If token exists → render children
```

### Backend Auth Flow
```
POST /auth/login → validate credentials
  → Create JWT access_token + refresh_token
  → Return tokens + user data

POST /auth/register → create User + Tenant
  → Send verification email via Resend
  → Return success

GET /auth/me → validate JWT
  → Return current user with permissions
```

### Permission Model
- Every user has a `role`: `tenant_owner`, `manager`, `agent`, `viewer`
- Permissions are strings: `manage:crm_leads`, `view:crm_deals`, etc.
- `require_permission("manage:crm_leads")` decorator checks before allowing access
- Agents are isolated: they only see leads assigned to them

### Google OAuth
- Frontend: `components/auth/LoginForm.tsx` has "Sign in with Google" button
- Uses Supabase Auth OAuth flow
- Callback: `app/(auth)/auth/callback/route.ts`

---

## SKILL 2: CRM Core (Customers, Leads, Deals)

**Files**:
- Frontend: `components/crm/Customers.tsx`, `components/crm/SalesPipeline.tsx`
- Backend: `api/v1/crm.py`, `api/v1/crm_modules/`, `models/CrmCustomer.py`, `models/Lead.py`

### CRM Module Structure
```
CRM Module
├── Customers        → CrmCustomer (customer records with addresses, tags)
├── Contacts         → CrmContact (contact people linked to customers)
├── Leads            → Lead (potential customers, sourced from WhatsApp/forms)
├── Deals            → CrmDeal (pipeline stages: New → Qualified → Proposal → Won/Lost)
├── Tasks            → CrmTask (CRM-specific tasks, linked to customers/deals)
├── Notes            → CrmNote (free-text notes on any entity)
├── Documents        → CrmDocument (file attachments on entities)
└── Sales Orders     → CrmSalesOrder → CrmSalesOrderItem
```

### Lead Lifecycle
```
1. Created (auto from WhatsApp webhook or manually)
   → LeadActivity: whatsapp_received / created via form
   → Status: "New"

2. Agent contacts → Status: "Contacted"
   → LeadActivity: call, email, whatsapp_sent

3. Qualified → Status: "Qualified"
   → LeadActivity: note with qualification details

4. Deal created → Linked to Deal pipeline
   → CrmDeal with stages: New → Qualified → Proposal → Negotiation → Won/Lost

5. Won → Lead becomes Customer
   → CrmCustomer created from Lead data
   → Status: "Customer"
```

### Customers Component (Customers.tsx)
- Tabs: Directory, Import, Advanced Search, Field Manager
- Supports: CRUD operations, import from CSV, advanced filtering
- Image upload for customer avatars
- Activity timeline per customer
- Linked to: Deals, Tasks, Notes, Documents, Sales Orders

### Sales Pipeline (SalesPipeline.tsx)
- Kanban-style board: New → Qualified → Proposal → Won | Lost
- Drag-and-drop between stages (visual only, update via API)
- Deal cards show: customer name, value, probability, close date
- Click card → Deal detail view with activities

---

## SKILL 3: CRM Modules (Discounts, Loyalty, Wallet, Memberships, Segments, Groups)

**Files**: `backend/src/api/v1/crm_modules/*.py`

### Discounts (`discounts.py`)
- **Model**: Stored in `Tenant.settings` → `discounts` array
- **Fields per discount**: id, name, type (percentage/fixed), value, min_order_value, max_discount, valid_from, valid_until, is_active, applies_to (all/categories/products)
- **Endpoints**: CRUD for discount rules
- **Frontend**: Accessed via Customers tab or dedicated page

### Loyalty (`loyalty.py`)
- **Model**: Stored in `Tenant.settings` → `loyalty` config
- **Features**: Points per purchase, tier levels (Bronze/Silver/Gold), redemption rules
- **Endpoints**: Configure loyalty program, award/redeem points

### Wallet (`wallet.py`)
- **Model**: Stored in `Tenant.settings` → `wallet` config + Customer metadata
- **Features**: Cash wallet per customer, credit limit, transaction history
- **Endpoints**: Add/withdraw balance, check balance, transaction log

### Memberships (`memberships.py`)
- **Model**: Stored in `Tenant.settings` → `membership_plans`
- **Features**: Plan definitions (Free/Basic/Premium), benefits, pricing
- **Endpoints**: Assign membership to customer, check benefits

### Segments (`segments.py`)
- **Model**: Stored in `Tenant.settings` → `segments`
- **Features**: Dynamic customer segmentation (e.g., "VIP", "At Risk", "New")
- **Rules**: Filter by tags, total spent, last purchase date, etc.
- **Endpoints**: Create segment, auto-assign customers to segments

### Groups (`groups.py`)
- **Model**: Stored in `Tenant.settings` → `groups`
- **Features**: Customer grouping (e.g., "Wholesale", "Retail", "Enterprise")
- **Endpoints**: Create/edit groups, assign customers

### All CRM Modules Pattern
- Settings are JSON stored in `Tenant.settings` column
- Backend reads/modifies settings, calls `flag_modified(tenant, "settings")`
- Frontend fetches via `crmApi` and renders in tabbed interfaces
- Permissions: `manage:crm_leads` for write, `view:crm_leads` for read

---

## SKILL 4: WhatsApp Automation

**Files**:
- Frontend: `components/crm/WhatsappCampaigns.tsx`
- Backend: `api/v1/crm_modules/whatsapp_automation.py`
- Gateway: `backend/whatsapp_gateway/index.js`

### Architecture
```
┌──────────────┐    HTTP Proxy     ┌──────────────────┐   puppeteer   ┌────────────┐
│ Frontend     │ ────────────────→ │ FastAPI Backend  │ ────────────→ │ WhatsApp   │
│ (React UI)   │                    │ (Proxy layer)    │               │ Gateway    │
│              │ ←──────────────── │                  │ ←──────────── │ (Node.js)  │
└──────────────┘                   └──────────────────┘               └────────────┘
                                                                          │
                                                                    whatsapp-web.js
```

### Session Management
- **Session = Phone Number**: Each WhatsApp number is a session
- **Tenant Mapping**: `Tenant.settings["whatsapp_web_sessions"]` = `["919912345678", ...]`
- **Agent Ownership**: `Tenant.settings["agent_whatsapp_sessions"]` = `{"919912345678": "agent-uuid"}`
- **Lifecycle**: INITIALIZING → QR_READY → AUTHENTICATED → CONNECTED | DISCONNECTED

### Available API Endpoints (via whatsappAutomationApi)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sessions` | List all sessions with status |
| POST | `/sessions/{id}/start` | Start/connect a session |
| POST | `/sessions/{id}/logout` | Disconnect and clear session |
| GET | `/sessions/{id}/contacts` | Get WhatsApp contacts |
| POST | `/sessions/{id}/sync` | Import contacts as CRM leads |
| GET | `/sessions/{id}/chats` | Get all active conversations |
| GET | `/sessions/{id}/chats/{phone}/messages` | Get message history |
| POST | `/sessions/{id}/chats/{phone}/send` | Send text message |
| POST | `/sessions/{id}/chats/{phone}/send-media` | Send image or PDF |
| POST | `/webhook` | Inbound webhook (called by gateway) |

### Message Format
```typescript
// Outgoing message
{
  message: string              // Text content
}

// Media message (image or PDF)
{
  mimeType: string,            // "image/jpeg", "image/png", "application/pdf"
  data: string,                // Base64 encoded (without data URI prefix)
  fileName?: string,           // Original filename
  caption?: string             // Optional caption
}

// Webhook payload (incoming)
{
  message_id: string,
  from: string,                // Phone number (E.164 without +)
  body: string,                // Message text
  timestamp: number,           // Unix timestamp
  profile_name: string,        // Contact display name
  session_id: string           // Session phone number
}
```

### Key Behaviors
- Media: Only images (`image/*`) and PDFs (`application/pdf`) supported
- Phone cleaning: All phone numbers stripped to digits-only via `_clean_digits()`
- Lead auto-creation: Unknown contacts auto-created as Leads with source "WhatsApp"
- Activity logging: All sent/received messages logged as `LeadActivity`
- LID resolution: WhatsApp LIDs (Linked IDs) resolved to real phone numbers via contact lookup

---

## SKILL 5: ERP System (Accounting, Finance, HRM, Inventory)

**Files**: `backend/src/api/v1/erp/*.py`

### ERP Module Structure
```
ERP Module
├── erp_system.py      → Core ERP, master data management
├── accounting.py      → Chart of accounts, journal entries, ledger
├── financial.py       → Cash flow, bank reconciliation
├── financial_reports.py → P&L, Balance Sheet, Cash Flow statements
├── invoices.py        → Invoice generation, tracking, payment status
├── budgets.py         → Budget planning, vs actual tracking
├── bank.py            → Bank account management, transactions
├── expense_claims.py  → Employee expense submission + approval
├── fixed_assets.py    → Asset register, depreciation
├── audit.py           → Audit trail, compliance logging
└── master_data.py     → Items, units of measure, chart of accounts setup
```

### Accounting Flow
```
1. Master Data Setup
   → Chart of Accounts (COA): Assets, Liabilities, Income, Expenses, Equity
   → Units of Measure (UOM): pcs, kg, liters, etc.

2. Journal Entries
   → Debit + Credit pairs
   → Linked to COA accounts
   → Posted to General Ledger

3. Financial Reports (auto-generated)
   → Profit & Loss (income - expenses)
   → Balance Sheet (assets = liabilities + equity)
   → Cash Flow Statement
```

### Invoice Flow
```
1. Create Invoice (linked to Sales Order or standalone)
   → Line items with products, quantities, prices
   → Tax calculation
   → Discount application

2. Invoice Statuses
   → Draft → Sent → Viewed → Paid | Overdue | Cancelled

3. Payment Recording
   → Payment model linked to Invoice
   → Updates invoice status to "Paid"
   → Creates journal entry
```

### Expense Claims Flow
```
1. Employee submits claim (items + receipts)
2. Manager approves/rejects
3. Approved → Added to accounting as expense
4. Payment processed
```

---

## SKILL 6: Chatbot / AI Assistant

**Files**: `backend/src/services/chatbot_service.py`, `backend/src/services/llm_router.py`

### How It Works
```
User message
  → Frontend ChatbotWidget
    → POST /chatbot/message { message, session_id }
      → ChatbotService.process_message()
        → Load conversation history (ChatbotSession + ChatbotMessage)
        → Build system prompt with business context (RAG)
        → LLM Router → OpenAI/Claude/Gemini
        → Check for function calls → Execute tools (get_customer, search_products, etc.)
        → Return response (text + optional tool results)
      → Stream response back to frontend
        → Render in ChatbotWidget with typing effect
```

### Available Tools (Function Calling)
| Tool | Description |
|------|-------------|
| `get_customer_info` | Look up customer by name/phone/ID |
| `search_products` | Search product catalog |
| `create_lead` | Create a new CRM lead |
| `log_interaction` | Log a CRM activity (call, email, meeting) |
| `get_sales_data` | Get sales figures, revenue trends |
| `get_inventory_status` | Check product stock levels |

### LLM Providers
- **Default**: OpenAI GPT-4
- **Supported**: OpenAI (GPT-4, GPT-3.5), Anthropic Claude, Google Gemini
- **Configuration**: Selectable per-tenant in settings
- **Streaming**: Server-sent events (SSE) for real-time responses

---

## SKILL 7: Meta Ads (Paid Advertising)

**Files**: `frontend/src/components/crm/PaidAdsSection.tsx`, `frontend/src/components/crm/PaidCampaignBuilder.tsx`

### How It Works
```
1. User connects Meta Ads account (OAuth)
   → Stores access token in Tenant.settings

2. Fetch ad accounts + campaigns
   → GET /crm/meta-ads/accounts
   → GET /crm/meta-ads/campaigns/{account_id}

3. Create campaigns
   → POST /crm/meta-ads/campaigns
   → Sets budget, targeting, creative

4. Track performance
   → GET /crm/meta-ads/insights/{campaign_id}
   → Impressions, clicks, conversions, spend
```

### Frontend Components
- `PaidAdsSection.tsx` → Dashboard overview, account management, performance metrics
- `PaidCampaignBuilder.tsx` → Campaign creation wizard with targeting, budget, creative

---

## SKILL 8: Sales Orders

**Files**: `frontend/src/components/crm/SalesOrders.tsx`, `backend/models/CrmSalesOrder.py`

### Sales Order Flow
```
1. Create Sales Order
   → Select customer (from CrmCustomer)
   → Select Sales Order Type (template with predefined items)
   → Add/remove line items
   → Set quantities, prices, discounts
   → Calculate subtotal, tax, total

2. Sales Order Statuses
   → Draft → Confirmed → Processing → Shipped → Delivered | Cancelled

3. Items
   → CrmSalesOrderItem linked to Product/ServiceProduct
   → Quantity, unit price, discount, tax, line total
```

### Sales Order Types
- Predefined templates for common order patterns
- Define: name, description, default items, tax rate
- Used to quickly create recurring order types

---

## SKILL 9: File Upload System

**Files**: `backend/src/services/file_service.py`, `backend/src/api/v1/api.py` (upload endpoints)

### Upload Flow
```
1. Frontend: FileReader → base64 string
2. API: POST /upload (multipart/form-data OR base64 JSON)
   → Backend receives file
   → Generates unique filename: {uuid}_{original_name}
   → Stores to MinIO: tenant/{tenant_id}/{filename}
   → Returns: { url, filename, size, contentType }

3. Download: GET /files/{filename}
   → Backend serves file from MinIO with correct content-type

4. Delete: DELETE /files/{filename}
   → Removes from MinIO + references
```

### Supported Formats
- Images: jpg, png, gif, webp, svg
- Documents: pdf, doc, docx, xls, xlsx
- Max file size: 10MB per file

---

## SKILL 10: Ad Generator (AI Ad Creation)

**Files**: `frontend/src/components/crm/AdGenerator.tsx`

### How It Works
```
1. User selects product/service
2. Selects target audience (from segments)
3. Selects ad format (image, carousel, video)
4. AI generates:
   → Ad copy (headlines, body, CTAs)
   → Visual concepts (image generation via DALL-E)
5. User edits → Saves as campaign
6. Posts to Meta Ads via API
```

---

## SKILL 11: Support Tickets

**Files**: `backend/models/CrmTicket.py`, `components/service/`

### Ticket Lifecycle
```
1. Created (auto from WhatsApp/email/chat or manually)
   → Priority: Low/Medium/High/Critical
   → Status: Open → In Progress → Resolved | Closed

2. Assignment
   → Auto-assign based on agent availability
   → Manual assignment by manager

3. Resolution
   → Agent adds resolution notes
   → Customer satisfaction rating
   → Linked to LeadActivity
```

---

## SKILL 12: Admin & Settings

**Files**: `frontend/src/app/(dashboard)/admin/`, `backend/models/Tenant.py`

### Tenant Settings (JSON stored)
- **General**: Company name, logo, address, timezone
- **Users**: Invite, role assignment, permissions
- **WhatsApp**: Session management, auto-assignment rules
- **AI/LLM**: Provider selection, API keys, model selection
- **CRM**: Field customization, pipeline stages, lead scoring rules
- **ERP**: Chart of accounts, tax rates, invoice templates
- **Integrations**: Meta Ads, email provider, SMS gateway

### Admin Capabilities
- Tenant owners see ALL data across all agents
- Can create/edit/delete users
- Can configure all system settings
- Can view audit logs
- Can export all data

---

## SKILL 13: Notifications & Alerts

**Files**: Frontend notification system using Sonner toast library

### Notification Types
1. **System Notifications**: Updates, maintenance, feature releases
2. **CRM Alerts**: New lead, deal won/lost, task overdue
3. **ERP Alerts**: Invoice overdue, budget exceeded, expense pending approval
4. **WhatsApp Alerts**: Session disconnected, message failed

### Delivery Channels
- In-app toast notifications (Sonner)
- Email (via Resend)
- Push notifications (web push API, optional)

---

## SKILL 14: Reports & Analytics

**Files**: `backend/src/api/v1/erp/financial_reports.py`, chart components

### Available Reports
| Report | Data Source | Frequency |
|--------|------------|-----------|
| Sales Performance | CrmSalesOrder + CrmDeal | Real-time |
| Revenue Report | Invoice + Payment | Daily/Weekly/Monthly |
| Customer Analytics | CrmCustomer + LeadActivity | Real-time |
| Lead Conversion | Lead → Deal → Sales Order | Monthly |
| Financial P&L | Journal entries | Monthly/Quarterly |
| Balance Sheet | Accounts | Monthly/Quarterly |
| Cash Flow | Bank + Payment | Daily |
| WhatsApp Campaign Performance | LeadActivity | Per campaign |
| Agent Performance | Lead + Deal + Activity | Monthly |

### Chart Types Used
- Line charts: Revenue trends, lead volume over time
- Bar charts: Sales by category, deals by stage
- Pie charts: Lead sources, customer segments
- Area charts: Pipeline value, forecast
