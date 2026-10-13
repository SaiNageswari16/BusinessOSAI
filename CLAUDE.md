# CLAUDE.md - Project Knowledge for BusinessOSAI

This file provides project-specific context for Claude Code so future sessions
can immediately understand the codebase without reading every file.

---

## What is BusinessOSAI?

BusinessOSAI is a full-stack business management platform combining CRM, ERP,
HRMS, Inventory, POS, Procurement, Marketplace, and AI automation with WhatsApp
integration. It's built for small-to-medium businesses to manage customers,
sales, finances, inventory, employees, and communication in one system.

The app name is "LazyMonkeyai" (v1.0.0).

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
# Runs on port 3000 (or 5173/5174 for Vite)
```

### Environment Setup
- Backend `.env`: See `ARCHITECTURE.md` for full list
- Frontend `.env.local`: `VITE_API_BASE_URL`
- Database: PostgreSQL running locally or on cloud
- Redis: Required for caching + rate limiting (auto-disables after 60s failure)
- MinIO: Required for file storage

---

## Essential Files (Read These First)

| File | Why |
|------|-----|
| `ARCHITECTURE.md` | Complete system architecture diagram + explanation |
| `SKILLS.md` | 14 feature skills documenting every module |
| `RULES.md` | Coding conventions and architectural rules |
| `CLAUDE.md` | This file — project knowledge for Claude Code |
| `FULL_MODULES_DOCUMENTATION.md` | Exhaustive module/entity/API reference |
| `backend/src/config/settings.py` | ALL environment variables + defaults |
| `backend/src/database/base.py` | Base classes: Base, TimestampMixin, UUIDPrimaryKeyMixin, TenantScopedMixin |
| `backend/src/database/session.py` | Async SQLAlchemy engine + session factory |
| `backend/src/database/init_db.py` | Schema creation, 200+ migration statements, seed data |
| `backend/src/database/purge.py` | Complete tenant/user data purge logic |
| `backend/src/api/deps.py` | Central `CurrentUserContext` + permission dependencies |
| `backend/src/models/__init__.py` | Hub model file — 88 models, 6 enums, star imports |
| `backend/src/api/v1/router.py` | Monolithic router with 40+ sub-routers |
| `backend/src/main.py` | FastAPI app entry, lifespan, CORS, static mounts |
| `frontend/src/lib/api-client.ts` | ALL API methods — know this before writing any frontend code |
| `backend/src/utils/security.py` | 200+ permission definitions + password/JWT utilities |
| `backend/src/utils/number_series.py` | Auto-incrementing document numbering |

---

## When Working on a Feature

### Adding a New Backend Endpoint
1. Define Pydantic schema in `schemas/` or inline in the route file
2. Add route with `@router.method()` + permission check `Depends(require_permission("..."))`
3. Use `Depends(get_db)` and `Depends(get_current_user_context())`
4. Add corresponding method in `frontend/src/lib/api-client.ts`
5. Use that method in the frontend component

### Adding a New Frontend Component
1. Check if API method exists in `lib/api-client.ts` (add if not)
2. Place component in appropriate `components/{module}/` folder
3. Use shadcn UI components for base elements
4. Follow Tailwind styling conventions from RULES.md
5. Add route in `app/(dashboard)/{module}/` folder

### Working with WhatsApp
1. Gateway: `backend/whatsapp_gateway/index.js` (Node.js, port 8005)
2. Proxy: `backend/src/api/v1/crm_modules/whatsapp_automation.py` (FastAPI)
3. Frontend: `frontend/src/components/crm/WhatsappCampaigns.tsx`
4. API client: `whatsappAutomationApi.*` in `api-client.ts`
5. Phone numbers: Always use cleaned digits (no +, no spaces)
6. Gateway URL: Always use `127.0.0.1` not `localhost` (Windows IPv6 issue)

### Working with the Database
1. Models in `backend/src/models/` — add new model class to appropriate file
2. Add to `backend/src/models/__init__.py` imports (or use star imports)
3. Schema changes go in `backend/src/database/init_db.py` as `ALTER TABLE IF NOT EXISTS ADD COLUMN` (NO Alembic)
4. Add API routes in appropriate module file under `api/v1/`

### Adding CRM Module (Discounts, Loyalty, etc.)
1. Create route file in `api/v1/crm_modules/{name}.py`
2. Import and include in `api/v1/crm.py` router
3. Create model in `backend/src/models/crm.py` or `models/__init__.py`
4. Add schema in `backend/src/schemas/crm.py`
5. Add API method in `frontend/src/lib/api-client.ts`
6. Add frontend tab/page in CRM module

---

## Architecture Overview

### Stack
| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python async) + SQLAlchemy 2.x + asyncpg |
| Frontend | Next.js + React + TypeScript + Tailwind + shadcn/ui |
| Database | PostgreSQL (single DB, multi-tenant via tenant_id) |
| Cache | Redis (caching + rate limiting) |
| File Storage | MinIO (S3-compatible) |
| WhatsApp | Node.js gateway (whatsapp-web.js + Puppeteer, port 8005) |
| Email | SMTP (Gmail) + Resend fallback |
| AI/LLM | Multi-provider: Gemini (primary), OpenAI, Anthropic |
| Payments | Razorpay (SaaS), multi-gateway config (Stripe, PhonePe, Paytm, Cashfree, PayPal, Pine Labs EDC, COD) |
| Telephony | LiveKit WebRTC + Plivo PSTN |
| Tax/GST | Whitebooks GSP (e-Way Bill, GST Filing, e-Invoice/IRN) |

### Design Principles
- **Multi-tenant**: Every query filters by `tenant_id = ctx.tenant_id`
- **Company scoping**: Most entities also have `company_id` for multi-company within tenant
- **UUID v4**: All primary keys are UUIDs (except marketplace which uses String PKs)
- **RBAC**: 200+ granular permissions checked via `Depends(require_permission("..."))`
- **No soft delete**: Status enum pattern (ACTIVE/INACTIVE/SUSPENDED) — no `deleted_at` column
- **No Alembic**: Schema changes are inline `ALTER TABLE` in `init_db.py`

### Directory Structure
```
backend/
  src/
    main.py                    # App entry, lifespan, CORS, static mounts
    config/settings.py         # ALL env vars (60+ config options)
    database/                  # Base classes, session, init_db, purge
    api/
      v1/
        router.py              # Master router with 40+ sub-routers
        deps.py                # CurrentUserContext, require_permission
        auth.py                # Auth + WebAuthn passkeys + fingerprint
        crm.py                 # Main CRM router
        crm_modules/           # discounts, groups, loyalty, memberships, segments, wallet, whatsapp_automation
        erp/                   # 22 sub-routers (accounting, bank, budgets, einvoice, eway_bill,
                                # expense_claims, fixed_assets, financial, financial_reports,
                                # gst_filing, invoices, master_data, organization, payment_reminders,
                                # tax, vouchers, workflow, whitebooks_config, delivery_challan,
                                # access_control, audit, erp_system)
        hrms/                  # 9 sub-routers (attendance, employees, exit_management,
                                # intelligence, leaves, payroll, recruitment, travel_routes, learning)
        inventory/             # 18 sub-routers (product_master, variants, bundles, kits,
                                # images, identifiers, intelligence, traceability, warehouses,
                                # goods_receipt, goods_issue, movements, adjustments,
                                # cycle_counting, barcode_scanner, master_catalog,
                                # product_attributes, warehouse_rules, alerts)
        pos/                   # 4 sub-routers (sessions, transactions, products, free_qty_rules)
        marketplace/           # marketplace_router
        payments.py            # Payment gateway config
        reports.py             # Generic reports + AI consult
        notifications.py       # Live notifications + push templates + broadcast
        copilot.py             # AI chat copilot
        social.py              # Social media accounts + scheduled posts
        system/                # System admin
        utilities.py           # Pincode lookup, geocoding
        integrations/          # Zoho integration
    models/                    # All SQLAlchemy models (165 classes across 7 files)
    schemas/                   # All Pydantic schemas (9 files)
    services/                  # Business logic services (12+ files)
    utils/                     # Security, email, number_series, pagination, redis_cache
    data/                      # Seed data
  whatsapp_gateway/
    index.js                   # Node.js Express app (port 8005)
    package.json               # whatsapp-web.js, express, cors, qrcode
  importer/                    # Open Food Facts product importer

frontend/
  src/
    lib/
      api-client.ts            # 55+ API modules, 500+ methods (6448 lines)
    app/                       # Next.js App Router pages
    components/
      accounting/              # Accounting UI
      admin/                   # Admin settings
      common/                  # Shared components
      crm/                     # CRM (customers, leads, tickets, campaigns)
      dashboard/               # Dashboard widgets
      erp/                     # ERP UI
      hrms/                    # HRMS UI
      inventory/               # Inventory UI
      layout/                  # Layout, sidebar, header
      marketplace/             # Marketplace UI
      pos/                     # POS terminal + invoice history
      procurement/             # Procurement UI
      reports/                 # Reports + layouts + screens
      settings/                # Settings pages
      social/                  # Social media UI
      storefront/              # Customer storefront + organic
      superapp/                # Superapp interface
      ui/                      # shadcn/ui components
    hooks/                     # Custom React hooks
    contexts/                  # React contexts
    lib/                       # Utilities, config
    routes/                    # Route definitions
    styles/                    # Global styles
```

---

## Common Gotchas

1. **Phone numbers**: Always clean to digits-only before DB operations
2. **Tenant isolation**: Every query MUST filter by `tenant_id = ctx.tenant_id`
3. **JSON fields**: Use `flag_modified()` after modifying JSON columns
4. **WhatsApp gateway URL**: Always use `127.0.0.1` not `localhost` (Windows IPv6 issue)
5. **Pydantic aliases**: `from_` field uses `Field(alias="from")` with `populate_by_name=True`
6. **Frontend imports**: Always use `@/` path alias (not relative paths)
7. **Form submissions**: Always wrap in try/catch with loading state
8. **Media uploads**: Base64 data does NOT include the `data:image/...;base64,` prefix when sending to backend
9. **No Alembic**: Schema migrations are inline `ALTER TABLE IF NOT EXISTS` in `init_db.py`
10. **No soft delete**: Use status enums (ACTIVE/INACTIVE/SUSPENDED), no `deleted_at`
11. **CORS**: FastAPI uses wildcard `*` despite env variable — gateway also allows all origins
12. **Storefront models**: Do NOT use `TenantScopedMixin` — they use `user_id` directly
13. **Marketplace models**: Use String PKs (not UUID), no mixins — completely separate pattern

---

## Project-Specific Terminology

| Term | Meaning |
|------|---------|
| **Tenant** | An organization/company using the platform |
| **Tenant Owner** | The primary admin of a tenant (Super Admin role) |
| **Company** | A legal entity within a tenant (multi-company support) |
| **Agent** | CRM user who manages leads/deals |
| **Manager** | Can view team data, approve expenses |
| **Lead** | A potential customer (from WhatsApp, forms, Meta Ads, etc.) |
| **CrmCustomer** | A confirmed/active customer in CRM |
| **Deal** | A sales opportunity with stages (pipeline) |
| **Session** (WhatsApp) | A connected WhatsApp phone number |
| **JID** | WhatsApp JID format: `{phone}@c.us` or `{phone}@lid` |
| **LID** | WhatsApp Linked ID (newer WhatsApp account format) |
| **RAG** | Retrieval-Augmented Generation (AI context enrichment for inventory) |
| **COA** | Chart of Accounts (accounting) |
| **UOM** | Unit of Measure (inventory/ERP) |
| **GSP** | GST Suvidha Provider (Whitebooks — government portal integration) |
| **IRN** | Invoice Reference Number (e-Invoice) |
| **EWB** | e-Way Bill (goods transport compliance) |
| **GRN** | Goods Received Note (procurement) |
| **POS Session** | Cashier shift with opening/closing cash |
| **P2P** | Procure-to-Pay (procurement lifecycle) |
| **O2C** | Order-to-Cash (sales lifecycle) |

---

## Module Map (35+ Modules)

| # | Module | Models | API Sub-routers | Frontend |
|---|--------|--------|-----------------|----------|
| 1 | **Auth & Security** | User, Role, Permission, UserRole, RefreshToken, UserPasskey, UserFingerprint, MfaPolicy | auth.py | Login, Register, Passkey, Fingerprint |
| 2 | **Organization** | Tenant, Company, BusinessUnit, Region, Zone, Branch, Department, Designation, Team, TeamMember, CostCenter, FiscalYear, Currency | organization_router | Settings/Organization |
| 3 | **CRM** | Customer, Lead, Opportunity, CRMSupportTicket, CRMQuotation, CRMSalesOrder, CRMCallLog, EmailCampaign/Template, CustomerGroup/Member, CustomerSegment, MembershipPlan/Membership, CustomerWallet/Transaction, LoyaltyProgram/Transaction, Discount | crm.py + crm_modules/ | Customers, Leads, Deals, Tickets, Quotations, etc. |
| 4 | **WhatsApp Automation** | (uses LiveNotification model) | whatsapp_automation.py | WhatsAppCampaigns.tsx |
| 5 | **ERP — Accounting** | ChartOfAccount, JournalEntry, JournalEntryLine | accounting_router | Accounting UI |
| 6 | **ERP — Invoicing** | Invoice, InvoiceLine, InvoicePayment, InvoiceReturn | invoices_router | Invoice forms |
| 7 | **ERP — Tax/GST** | TaxConfiguration, TaxCode, TaxReturn, TaxPayment | tax_router, gst_filing_router | GST reports |
| 8 | **E-Way Bill** | (uses Invoice data) | eway_bill_router | — |
| 9 | **E-Invoice** | (uses Invoice data) | einvoice_router | — |
| 10 | **ERP — Bank** | BankAccount, BankTransaction, BankReconciliation | bank_router | Bank UI |
| 11 | **ERP — Fixed Assets** | FixedAsset, FixedAssetCategory, FixedAssetDepreciation | fixed_assets_router | Fixed Assets UI |
| 12 | **ERP — Expense Claims** | ExpenseClaim | expense_claims_router | Expense UI |
| 13 | **ERP — Vouchers** | PaymentVoucher | vouchers_router | Vouchers UI |
| 14 | **ERP — Budgets** | Budget | budgets_router | Budget UI |
| 15 | **ERP — Payment Reminders** | PaymentReminderPolicy, PaymentReminderLog | payment_reminders_router | — |
| 16 | **ERP — Delivery Challan** | DeliveryChallan, DeliveryChallanItem | delivery_challan_router | — |
| 17 | **ERP — Sales Returns** | InvoiceReturn | sales_returns_router | — |
| 18 | **Workflow Engine** | ApprovalWorkflow, NotificationTemplate, DocumentTemplate, AutomationRule, CustomField | workflow_router | Workflow settings |
| 19 | **HRMS — Employees** | Employee, EmployeeDocument | employees.py | Employee directory |
| 20 | **HRMS — Attendance** | AttendanceRecord, AttendanceScheme, BiometricDevice, FaceRecognitionLog, AttendanceCorrection | attendance.py | Attendance UI |
| 21 | **HRMS — Leaves** | LeaveRequest, LeaveBalance, LeavePolicy | leaves.py | Leave management |
| 22 | **HRMS — Payroll** | SalaryStructure, Payslip, PayslipTemplate, PayGrade, EmployeeLoan, SalaryAdvance, EmployeeBonus, SalesCommission, CommissionSlabPlan | payroll.py | Payroll UI |
| 23 | **HRMS — Recruitment** | JobOpening, Applicant, Interview, OfferLetter, OnboardingRecord | recruitment.py | Recruitment pipeline |
| 24 | **HRMS — Performance** | PerformanceGoal, PerformanceKpi, PerformanceAppraisal, PerformanceIncentive | performance.py | Performance UI |
| 25 | **HRMS — Learning** | LearningCourse, LearningCertificate, LearningAssessment | learning.py | Learning UI |
| 26 | **HRMS — Exit Management** | ExitResignation, ExitClearanceTask, ExitFinalSettlement, ExitExperienceLetter | exit_management.py | Exit UI |
| 27 | **HRMS — Intelligence** | (uses Employee, Attendance, Performance models) | intelligence.py | HR analytics |
| 28 | **HRMS — Travel Routes** | EmployeeLocationTrail | travel_routes.py | Field staff tracking |
| 29 | **Inventory — Products** | Product, ProductCategory, Brand, UnitOfMeasure, ProductVariant, ProductBundle, ProductKit, ProductImage, ProductAttribute, MasterCatalogProduct, HSNMaster | product_master_router, variants/bundles/kits/images/attributes routers | Product catalog |
| 30 | **Inventory — Warehouse** | Warehouse, StorageLocation, InventoryBatch, InventorySerial | warehouses_router, warehouse_rules_router | Warehouse UI |
| 31 | **Inventory — Stock Ops** | StockMovement, StockAdjustment, CycleCount | movement/adjustment/cycle_counting routers | Stock operations |
| 32 | **Inventory — GRN/Issue** | GoodsReceiptNote, GoodsReceiptNoteItem, GoodsIssue, GoodsIssueItem | grn_router, issue_router | GRN/Issue UI |
| 33 | **Inventory — Intelligence** | (uses Product, StockMovement models) | intelligence_router | Inventory analytics |
| 34 | **Inventory — Alerts** | (uses Product, StockMovement models) | alerts_router | WhatsApp alerts engine |
| 35 | **Inventory — Identifiers** | ProductQRCode, ProductRFID, TraceabilityEvent | identifiers_router, traceability_router | Barcode/QR management |
| 36 | **Inventory — Barcode Scanner** | (API endpoint only) | barcode_scanner_router | Scanner UI |
| 37 | **POS** | POSTransaction, POSTransactionItem, POSPayment, POSSession, FreeQtyRule | sessions, transactions, products, free_qty_rules routers | POS terminal, invoice history |
| 38 | **Procurement** | SupplierCategory, Supplier, SupplierContact, SupplierContract, SupplierPerformance, BlacklistedSupplier, PurchaseRequest, PurchaseQuotation, PurchaseOrder, PurchaseOrderItem, GoodsReceivedNote, GoodsReceivedNoteItem, PurchaseReturn, VendorBill, VendorBillItem, VendorPayment, VendorCreditNote, VendorDebitNote, ProcurementAISuggestion | procurement_router (also under /erp) | Procurement UI |
| 39 | **Marketplace** | MarketplaceVendor, MarketplaceProduct, MarketplaceOrder, MarketplaceOrderItem, MarketplacePayout, MarketplacePromotion | marketplace_router | Marketplace UI |
| 40 | **Storefront** | StorefrontWallet, StorefrontWalletTransaction, StorefrontJourney, StorefrontNotification, StorefrontWishlist | (via marketplace/api routes) | Storefront UI |
| 41 | **Notifications** | LiveNotification, PushNotificationTemplate, NotificationBroadcast, UserDeviceToken | notifications.py | Notification center |
| 42 | **Reports & Analytics** | (uses all module data) | reports.py, financial_reports_router | Reports screens |
| 43 | **AI Copilot** | (no dedicated model) | copilot.py | Chat interface |
| 44 | **Social Media** | SocialAccount, SocialScheduledPost | social.py | Social hub |
| 45 | **Meta Ads** | AdAsset, CreatePaidAd | meta_ads routes | Meta Ads UI |
| 46 | **Payments** | PaymentGatewayConfig | payments.py | Payment settings |
| 47 | **Master Data** | GeographyCountry, Location, WorkCalendar, Tag | master_data_router | Master data UI |
| 48 | **Access Control** | ApiKey, MfaPolicy | access_control_router | Admin settings |
| 49 | **Audit** | AuditLog, ActivityLog | audit_router | Audit logs UI |
| 50 | **Zoho Integration** | (uses existing models) | integrations/zoho/routes.py | — |

**Total: ~165 model classes, 200+ API endpoints, 35+ modules**

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
fastapi, sqlalchemy, asyncpg, redis, httpx
openai, anthropic, google-generativeai
pydantic, python-jose, passlib, python-multipart
minio, resend, supabase
fpdf, reportlab, xhtml2pdf
python-ntp (for time sync)
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

### WhatsApp Gateway (Node.js)
```
whatsapp-web.js, express, cors, qrcode, axios
```

---

## Testing the System

### Quick Smoke Test
```bash
# 1. Verify backend is running
curl http://localhost:8000/health

# 2. Verify gateway is running
curl http://localhost:8005/sessions

# 3. Test WhatsApp session
curl -X POST http://localhost:8005/sessions/919912345678/start

# 4. Check session status
curl http://localhost:8005/sessions

# 5. Test Redis
redis-cli ping  # should return PONG

# 6. Check database
psql -U postgres -d businessosai
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
11. **No Alembic migrations** — schema changes are inline `ALTER TABLE` in `init_db.py`
12. **WebAuthn/FIDO2 passkeys + fingerprint auth** exist in `auth.py`
13. **AI cascade** tries Claude → Gemini → OpenAI based on `AI_PROVIDER` setting
14. **CORS is wide open** on both FastAPI and gateway — not restricted to env origins
15. **Marketplace uses String PKs** (not UUID) and no mixins — completely different pattern
16. **Storefront models** use `user_id` directly, no `TenantScopedMixin`
17. **Zoho integration** exists at `backend/src/integrations/zoho/` for recruitment + CRM sync
18. **LiveKit + Plivo** provide telephony (WebRTC + PSTN fallback)
19. **Whitebooks GSP** provides 3 Indian tax compliance modules (e-Way Bill, GST, e-Invoice)
20. **Pine Labs EDC** is integrated for POS terminal card payments
