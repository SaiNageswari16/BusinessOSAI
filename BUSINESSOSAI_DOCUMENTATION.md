# LazyMonkeyAI — Complete Technical Documentation

> **Version:** 2.0  
> **Date:** September 2026  
> **Author:** LazyMonkeyAI Engineering Team

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Module 1 — CRM](#4-module-1--crm)
5. [Module 2 — Inventory Management](#5-module-2--inventory-management)
6. [Module 3 — ERP & Accounting](#6-module-3--erp--accounting)
7. [Module 4 — WhatsApp Automation](#7-module-4--whatsapp-automation)
8. [Module 5 — Meta Ads Integration](#8-module-5--meta-ads-integration)
9. [Module 6 — AI Chatbot & Copilot](#9-module-6--ai-chatbot--copilot)
10. [Module 7 — HRMS](#10-module-7--hrms)
11. [Module 8 — Warehouse Management](#11-module-8--warehouse-management)
12. [Module 9 — Marketplace](#12-module-9--marketplace)
13. [Module 10 — Storefront & Super App](#13-module-10--storefront--super-app)
14. [Module 11 — Point of Sale](#14-module-11--point-of-sale)
15. [Module 12 — Payment Reminders](#15-module-12--payment-reminders)
16. [Module 13 — GST & Tax Compliance](#16-module-13--gst--tax-compliance)
17. [Module 14 — Procurement](#17-module-14--procurement)
18. [Module 15 — Reports & Business Intelligence](#18-module-15--reports--business-intelligence)
19. [Module 16 — Workflow & Automation Engine](#19-module-16--workflow--automation-engine)
20. [Module 17 — IoT Integration](#20-module-17--iot-integration)
21. [Module 18 — Discounts & Loyalty Engine](#21-module-18--discounts--loyalty-engine)
22. [Module 19 — Staff Onboarding](#22-module-19--staff-onboarding)
23. [Authentication & RBAC](#23-authentication--rbac)
24. [Contexts & State Management](#24-contexts--state-management)
25. [Hooks](#25-hooks)
26. [Database Schema](#26-database-schema)
27. [Frontend Structure](#27-frontend-structure)
28. [API Client Reference](#28-api-client-reference)
29. [Configuration & Environment Variables](#29-configuration--environment-variables)
30. [WhatsApp Gateway (Node.js)](#30-whatsapp-gateway-nodejs)
31. [Development Guidelines](#31-development-guidelines)
32. [Common Gotchas](#32-common-gotchas)

---

## 1. System Overview

**LazyMonkeyAI** is a full-stack business management platform combining CRM, ERP, inventory, HRMS, e-commerce, and AI automation with WhatsApp integration. It is designed for small-to-medium businesses to manage customers, sales, finances, inventory, procurement, HR, and communication — all in one unified system.

### Core Value Proposition
- **Unified Platform**: CRM, ERP, HRMS, Inventory, POS, Marketplace, and e-commerce in one system
- **WhatsApp-First Communication**: Native WhatsApp integration for sales, support, and automated messaging
- **AI-Powered**: Chatbot/Copilot with multi-provider AI support (OpenAI, Anthropic, Google Gemini)
- **Indian Business Ready**: Built-in GST, eWay Bill, eInvoice, TDS, multi-currency (INR primary)
- **Multi-Tenant**: Complete tenant isolation for SaaS deployment

---

## 2. Architecture

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                        │
│                      Port 3000 | TanStack Router                 │
│   shadcn/ui + Tailwind + Framer Motion + Recharts              │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                        HTTP/REST (Axios)
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│                    Backend (FastAPI - Python)                      │
│                      Port 8000 | SQLAlchemy                       │
│   Auth (Supabase) → RBAC → Module Routers → Services              │
│   ┌───────────────────────────────────────────────────────────┐  │
│   │  Redis (Caching + Rate Limiting)                           │  │
│   │  MinIO (File Storage)                                      │  │
│   │  PostgreSQL (Primary Database)                             │  │
│   └───────────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────┬──────────────────────────────┘
                       │              │
          ┌────────────▼──────┐  ┌───▼──────────────────┐
          │ WhatsApp Gateway   │  │  External Services   │
          │ (Node.js :8005)    │  │  - OpenAI API        │
          │ whatsapp-web.js    │  │  - Anthropic API     │
          │ Puppeteer + Chrom  │  │  - Google Gemini     │
          │                    │  │  - Resend (Email)    │
          └────────────────────┘  │  - Supabase (Auth)   │
                                  │  - Razorpay (Payments)│
                                  │  - Pine Labs (POS)    │
                                  │  - Whitebooks (GST)   │
                                  │  - Zoho Recruit       │
                                  └──────────────────────┘
```

### Request Flow

```
User (Browser) ──► Next.js Frontend
                         │
                         ▼
              FastAPI Backend (Port 8000)
                 │           │
                 │           └──► Redis (Cache/Rate Limit)
                 │           └──► MinIO (File Storage)
                 │           └──► PostgreSQL (Database)
                 │
                 ├──► WhatsApp Gateway (Port 8005)
                 │         │
                 │         ▼
                 │    WhatsApp (via whatsapp-web.js)
                 │
                 └──► External APIs
                           ├──► OpenAI (GPT)
                           ├──► Anthropic (Claude)
                           ├──► Google Gemini
                           ├──► Resend (Email)
                           ├──► Razorpay (Payments)
                           ├──► Pine Labs (POS Terminal)
                           ├──► Whitebooks (GST/eWay/eInvoice)
                           └──► Zoho Recruit (Job Postings)
```

---

## 3. Technology Stack

### Frontend
| Component | Technology |
|-----------|-----------|
| Framework | Next.js (React 19) |
| Language | TypeScript |
| Routing | TanStack Router (file-based, type-safe) |
| UI Components | shadcn/ui (Radix UI primitives) — 13 base components |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| Charts | Recharts |
| State Management | TanStack Query (React Query) + React Context |
| PDF | react-pdf |
| Excel | SheetJS (xlsx) |
| Notifications | Sonner (toasts) |
| HTTP Client | Axios (wrapped in central api-client.ts) |

### Backend
| Component | Technology |
|-----------|-----------|
| Framework | FastAPI (Python) |
| Language | Python 3.11+ |
| ORM | SQLAlchemy 2.0 (async) |
| Database | PostgreSQL |
| Cache | Redis |
| File Storage | MinIO (S3-compatible) |
| Auth | Supabase Auth (JWT) |
| Payments | Razorpay + Pine Labs |
| Email | Resend |
| AI Providers | OpenAI, Anthropic, Google Generative AI |
| GST/Compliance | Whitebooks integration |
| HR | Zoho Recruit integration |
| Migrations | Alembic |

### WhatsApp Gateway
| Component | Technology |
|-----------|-----------|
| Runtime | Node.js + Express |
| WhatsApp Library | whatsapp-web.js |
| Browser Automation | Puppeteer + Chromium |
| HTTP Client | Axios |

---

## 4. Module 1 — CRM

**Purpose:** Complete customer relationship management — lead generation, pipeline tracking, customer intelligence, WhatsApp-driven communication, and sales automation.

**Frontend Route:** `/crm`  
**API Client:** `crmApi`, `crmLeadsApi`, `crmCustomersApi`, `crmOpportunitiesApi`, `crmGroupsApi`, `crmSegmentsApi`, `crmMembershipsApi`, `crmWalletApi`, `crmLoyaltyApi`, `crmDiscountsApi`, `crmCampaignsApi`, `crmTicketsApi`, `crmQuotationsApi`, `crmSalesOrdersApi`, `crmIntelligenceApi`, `crmCallsApi`

### Core CRM Features
- **Leads Management**: Capture, qualify, assign, bulk-import, export CSV
- **Opportunities Pipeline**: Track deals through stages with Kanban board
- **Customer Profiles**: Full profiles with contact info, GSTIN, addresses, interaction history
- **Customer Groups**: Organize customers into groups with bulk member management
- **Customer Segments**: Dynamic segmentation with auto-recalculation
- **Membership Plans**: Tiered subscription plans (Standard/Premium/VIP)
- **Customer Wallet**: Balance management with credit/debit/adjust operations
- **Loyalty Engine**: Points-based loyalty with rules, earn/redeem transactions
- **Discount System**: Coupon-based discounts with validation and usage tracking
- **Tickets**: Support ticket creation and management
- **Quotations**: Create, send, convert to orders, PDF download
- **Sales Orders**: Order creation linked to customers

### Customer Intelligence (AI-Powered)
| Feature | API | Description |
|---------|-----|-------------|
| Analytics | `crmIntelligenceApi.getAnalytics()` | Overview metrics |
| Churn Prediction | `crmIntelligenceApi.getChurn()` | AI predicts at-risk customers |
| Lifetime Value | `crmIntelligenceApi.getLifetimeValue()` | Customer LTV analysis |
| Purchase Behaviour | `crmIntelligenceApi.getPurchaseBehaviour()` | Buying pattern analysis |
| RFM Analysis | `crmIntelligenceApi.getRfm()` | Recency/Frequency/Monetary segmentation |
| Recommendations | `crmIntelligenceApi.getRecommendations()` | AI product recommendations |
| AI Recommendations | `AiRecommendations.tsx` | Visual recommendation panel |

### Communication Campaigns
- **Email Campaigns**: Create, send, template management (`crmCampaignsApi`)
- **SMS Campaigns**: `SmsCampaigns.tsx` component
- **Social Media Dashboard**: `SocialMediaDashboard.tsx` — multi-platform management
- **Paid Ad Campaigns**: `PaidCampaignBuilder.tsx` — Meta/Facebook ad builder
- **AI Ad Generation**: `AdGenerator.tsx` — AI-generated ad creatives
- **Facebook Integration**: Full OAuth flow via `crmLeadsApi` (getFbAuthUrl, connectFbDirect, syncFbLeads, publishToFacebook, getFbCampaigns, getFbAds, getFbAdAccounts, etc.)
- **Push Notifications**: `pushNotificationsApi` — templates, broadcasts, device registration

### Other CRM Features
- **Live Notifications**: `liveNotificationsApi` — in-app notification center
- **Call Integration**: `crmCallsApi` — initiate, turn-based, complete calls with logging
- **Customer Analytics**: `CustomerAnalytics.tsx` — analytics dashboard
- **Churn Prediction**: `ChurnPrediction.tsx` — visual churn analysis
- **Lifetime Value**: `LifetimeValue.tsx` — LTV visualization
- **Purchase Behaviour**: `PurchaseBehaviour.tsx` — buying patterns
- **RFM Analysis**: `RfmAnalysis.tsx` — RFM segmentation view
- **Asset Library**: `assetLibraryApi` — save, list, approve media assets

**Database Models:**
- `crm_leads` — Lead records with source, status, score, assigned agent
- `crm_customers` — Customer records with full profile, GSTIN, addresses
- `crm_lead_activities` — Activity log (call, email, meeting, whatsapp_received, etc.)
- `crm_groups` / `crm_group_members` — Customer group definitions
- `crm_segments` — Dynamic segmentation rules
- `crm_documents` — Attached files
- `crm_opportunities` — Deal/opportunity records
- `crm_tickets` — Support tickets
- `crm_quotations` — Quotation records
- `crm_sales_orders` — Sales order records
- `crm_lead_attributions` — Attribution tracking
- `discounts_*` — Discount rules, coupons, usage
- `loyalty_*` — Loyalty rules and transactions
- `memberships_*` — Membership plans and subscriptions

---

## 5. Module 2 — Inventory Management

**Purpose:** Complete inventory operations — product catalog, variants, bundles, batch/serial tracking, stock movements, AI-powered health analysis, and barcode/QR/RFID management.

**Frontend Route:** `/inventory`  
**API Client:** `inventoryApi`, `posApi`

### Product Management
- **Product Catalog**: Full CRUD with SKU, barcode, images, multi-pricing (cost/sale/online/store)
- **Product Categories**: Hierarchical categories with CRUD + bulk create
- **Brands**: Brand management with CRUD
- **Unit of Measures (UOM)**: Configurable UOMs per product
- **Product Attributes**: Custom attribute definitions
- **Product Variants**: Size, color, or attribute-based variants with additional pricing
- **Product Bundles**: Bundle products for combo sales
- **Product Kits**: Kits for assembled items
- **Product Images**: Multiple images per product with upload support
- **Asian Paints Special**: Base code, base name, size (L/kg) columns for paint industry
- **Master Catalog**: Central product catalog with import/export
  - `searchMasterCatalog()`, `saveToMasterCatalog()`
  - `importExcelMasterCatalog()` — bulk import from Excel
  - `importToLocalInventory()` — import to tenant inventory

### Stock Operations
- **Goods Receipts**: Inbound receiving against POs
- **Goods Issues**: Outbound dispatch against SOs
- **Stock Movements**: Inter-location transfers
- **Stock Adjustments**: Physical count adjustments
- **Cycle Counting**: Scheduled physical counts
- **Operations Overview**: Dashboard of all operations

### AI-Powered Intelligence
- **AI Inventory Health**: `AiInventoryHealth.tsx` — AI-driven health scoring
- **ABC Analysis**: `AbcAnalysis.tsx` — Pareto analysis of inventory
- **Dead Stock Detection**: `DeadStock.tsx` — identify non-moving items
- **Fast Moving Items**: `FastMoving.tsx` — top sellers
- **Slow Moving Items**: `SlowMoving.tsx` — slow movers alert
- **Reorder Planning**: `ReorderPlanning.tsx` — automated reorder suggestions
- **Inventory Forecast**: `InventoryForecast.tsx` — demand forecasting
- **RAG Enrichment**: `triggerRAGEnrichment()`, `getRAGEnrichmentStatus()` — AI enriches product data
- **AI Image Search**: `getAiImageSearchStatus()`, `pause/resume AI image search` — visual product search
- **AI Suggestions**: `AISuggestions.tsx` — AI-generated inventory recommendations
- **Cost Analysis**: `CostAnalysis.tsx` — product cost analysis

### Tracking & Traceability
- **Batch Numbers**: `BatchNumbers.tsx` — batch tracking with expiry
- **Serial Numbers**: `SerialNumbers.tsx` — individual item tracking
- **Barcode Management**: `QrCodeManagement.tsx` — generate, print, bulk operations
  - `generateBarcode()`, `generateBulkBarcodes()`, `batchPrintBarcodes()`
- **QR Codes**: Full QR code CRUD + print functionality
- **RFID Management**: RFID tag tracking with scanning support
- **Traceability**: `Traceability.tsx` — full trace chain
  - `getTraceabilityEvents()`, `getBatchGenealogy()`

### Expiry Management
- **Expiry Summary**: `getExpirySummary()` — overview of expiring items
- **Expiry List**: `getExpiryList()` — detailed expiry tracking
- **Apply Expiry Discount**: `applyExpiryDiscount()` — automatic discount for near-expiry
- **Write Off Expired**: `writeOffExpired()` — process expired inventory

### Warehouse & Location
- **Warehouses**: CRUD with type, capacity, manager
- **Storage Locations**: Zone/Aisle/Rack/Shelf/Bin hierarchy
- **Put-Away Rules**: Automated location assignment rules
- **Picking Rules**: Optimized picking path rules

### GST Integration
- **GSTIN Verification**: `verifyGstin()` — validate supplier GST numbers
- **GSTIN Lookup**: `lookupGstin()` — fetch GST details
- **HSN Codes**: `getHsnCodes()`, `suggestHsn()` — HSN code management

### Hardware Integration
- **Barcode Scanner**: `useHardwareBarcodeScanner()` hook — USB/Bluetooth barcode gun support
- **Instant Scan**: `instantScan()` — quick product lookup by barcode

---

## 6. Module 3 — ERP & Accounting

**Purpose:** Complete enterprise resource planning and financial accounting — chart of accounts, journal entries, invoicing, accounts payable/receivable, banking, fixed assets, expense management, budgets, and financial reporting.

**Frontend Routes:** `/erp`, `/accounting`  
**API Client:** `accountingApi`, `bankApi`, `invoicesApi`, `financialReportsApi`, `fixedAssetsApi`, `expenseClaimsApi`, `budgetsApi`, `taxApi`, `ewayBillApi`, `einvoiceApi`, `gstFilingApi`, `whitebooksSettingsApi`, `whitebooksApi`

### Chart of Accounts (COA)
- **Account Types**: Asset, Liability, Equity, Revenue, Expense
- **Account Sub-Types**: Current Asset, Fixed Asset, Current Liability, etc.
- **Hierarchical Structure**: Parent/child accounts with unlimited nesting
- **Control Accounts**: Flag accounts for summary reporting
- **Opening Balances**: Set opening balance and date per account
- **Account Tree**: `getAccountTree()` — hierarchical view
- **General Ledger**: `getGeneralLedger()` — full ledger view

### Journal Entries
- **Entry Types**: Receipt, Payment, Contra, Journal
- **Entry Statuses**: Draft, Pending, Approved, Posted, Voided
- **Multi-line Entries**: Debit/credit lines per entry
- **Auto-numbering**: Sequential entry numbers per tenant
- **Reverse Entries**: Create reversal entries with source tracking

### Invoicing
- **Invoice Types**: Tax Invoice, Proforma, Estimate, Credit Note
- **Invoice CRUD**: Full create, read, update operations
- **Send Invoice**: `sendInvoice()`, `sendInvoiceToWhatsApp()` — multi-channel delivery
- **Payment Recording**: `recordPayment()` — track partial/full payments
- **Customer Summary**: `getCustomerSummary()` — customer-level invoice overview

### Accounts Payable (Procurement Integration)
- **Vendor Payments**: `listVendorPayments()`, `recordVendorPayment()` — pay suppliers
- **Vendor Bills**: Vendor bill management
- **Credit Notes**: Supplier credit notes
- **Debit Notes**: Supplier debit notes
- **Spend Analysis**: `SpendAnalysis.tsx` — spend pattern analysis
- **Lead Time Analysis**: `LeadTimeAnalysis.tsx` — procurement lead time tracking

### Banking
- **Bank Accounts**: CRUD bank account records
- **Bank Transactions**: Record and categorize bank transactions
- **Bank Reconciliation**: Match transactions with bank statements
  - `listReconciliations()`, `createReconciliation()`, `completeReconciliation()`

### Fixed Assets
- **Asset Management**: Full asset lifecycle tracking
- **Depreciation Methods**: Straight Line, Declining Balance, Units of Production
- **Asset Categories**: Categorize assets
- **Depreciation Run**: `runDepreciation()` — batch depreciation processing
- **Status Tracking**: Active, Under Maintenance, Disposed, Sold, Scrapped

### Expense Claims
- **Submit Expenses**: Create expense claims with items
- **Approval Workflow**: Submit → Pending → Approved/Rejected
- **Expense Categories**: Categorize expenses

### Budgets
- **Budget Creation**: Set budgets per period/department
- **Budget Tracking**: Monitor actual vs budget

### Financial Reports
- **Profit & Loss**: `profitAndLoss()` — P&L statement
- **Balance Sheet**: `balanceSheet()` — assets/liabilities/equity
- **Cash Flow**: `cashFlow()` — operating/investing/financing cash flow
- **Trial Balance**: `trialBalance()` — account-wise balances
- **AR Aging**: `arAging()` — accounts receivable aging report

### Tax & Compliance
- **Tax Codes**: CRUD tax code definitions
- **Tax Returns**: Create, update, file, delete tax returns
- **Tax Payments**: Record and manage tax payments
- **eWay Bill**: `ewayBillApi` — generate, cancel, update vehicle
- **eInvoice**: `einvoiceApi` — generate IRN, cancel IRN, B2C QR
- **GST Filing**: `gstFilingApi` — GSTR-1, GSTR-2B, GSTR-3B
  - `searchGstin()`, `requestOtp()`, `verifyOtp()`
- **Whitebooks Integration**: `whitebooksSettingsApi` + `whitebooksApi` — third-party GST tool
  - Test connection, configure credentials
  - Unified access to eWay, eInvoice, GST filing

### ERP Configuration (`/erp` route)
| Component | Purpose |
|-----------|---------|
| `ActivityLogs.tsx` | System activity audit trail |
| `ApiKeys.tsx` | API key management |
| `ApprovalWorkflows.tsx` | Configure approval hierarchies |
| `AutomationRules.tsx` | Business rule automation |
| `BackupRestore.tsx` | Database backup/restore |
| `BusinessUnits.tsx` | Multi-business-unit setup |
| `CalendarsAndShifts.tsx` | Work calendars and shift definitions |
| `CostCenters.tsx` | Cost center management |
| `CurrencyManagement.tsx` | Multi-currency and exchange rates |
| `DesignationManagement.tsx` | Job designations |
| `DocumentTemplates.tsx` | Template management |
| `FiscalYears.tsx` | Fiscal year periods |
| `GlobalSettings.tsx` | Tenant-level settings |
| `Locations.tsx` | Business locations |
| `NumberSeries.tsx` | Auto-numbering series |
| `OrganizationStructure.tsx` | Org chart setup |
| `PaymentTerms.tsx` | Payment term definitions |
| `Regions.tsx` | Geographic regions |
| `SystemHealth.tsx` | System health monitoring |
| `TagsLabels.tsx` | Tag/label management |
| `TaxConfiguration.tsx` | Tax rule configuration |
| `Teams.tsx` | Team management |
| `WorkspaceManagement.tsx` | Workspace setup |
| `Zones.tsx` | Zone management |

### Master Data
| API Object | Purpose |
|-----------|---------|
| `geographyApi` | Countries CRUD |
| `locationsApi` | Business locations CRUD |
| `workCalendarsApi` | Work calendar CRUD |
| `tagsApi` | Tag/label CRUD |
| `systemSettingsApi` | Tenant settings CRUD |
| `systemHealthApi` | System health check |
| `errorLogsApi` | Error log viewer |
| `backupApi` | Backup status |

---

## 7. Module 4 — WhatsApp Automation

**Purpose:** Full WhatsApp Business integration for customer communication, lead capture, and automated messaging campaigns.

**Architecture:** Bidirectional bridge between WhatsApp (via whatsapp-web.js) and the FastAPI backend.

```
┌─────────────┐       Node.js Gateway (:8005)       ┌──────────────────┐
│   WhatsApp   │◄─────► whatsapp-web.js + Puppeteer ─►│  FastAPI Backend │
│  (Personal/ │                                      │     (:8000)       │
│  Business)   │◄────── Webhook: /whatsapp-automation  └────────┬─────────┘
└─────────────┘             └──────────────────────►           │
                                                          ┌────▼────┐
                                                          │ Frontend │
                                                          └─────────┘
```

### Session Management
- **Multi-Session Support**: Multiple WhatsApp numbers per tenant (sales, support)
- **QR Authentication**: Scan QR code via WhatsApp Web
- **Session Persistence**: Chromium profile stored per session, survives restarts
- **Auto-Restore**: Sessions auto-reconnect on server restart
- **Watchdog Timer**: 60-second timeout for stuck sessions
- **Session States**: Initializing → QR_Ready → Authenticated → Connected/Disconnected
- **Graceful Shutdown**: All clients destroyed on server termination

### Inbound Message Processing
- **Webhook Dispatch**: Every inbound message POSTed to FastAPI at `/api/v1/whatsapp-automation/webhook`
- **Lead Auto-Creation**: New contacts automatically create Lead records
- **Activity Logging**: Each message logged as `whatsapp_received` activity
- **LID Resolution**: WhatsApp Linked ID → Phone number resolution
- **Profile Enrichment**: Sender name from WhatsApp profile

### Outbound Messaging
- **Send Text**: Send text messages to any WhatsApp number
- **Send Media**: Send images/PDFs with captions (base64-encoded, up to 50MB)
- **Media Format**: Base64-encoded, up to 50MB payload

### Contact Sync
- **Sync Contacts**: Bulk import WhatsApp contacts as leads
- **Deduplication**: Contacts deduplicated by phone number
- **Async Processing**: Webhook events fired asynchronously for each contact

**Gateway API Endpoints (Node.js):**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/sessions` | List all sessions |
| POST | `/sessions/:id/start` | Start/restart a session |
| GET | `/sessions/:id/contacts` | Get contacts (deduplicated) |
| POST | `/sessions/:id/sync` | Sync contacts to leads |
| POST | `/sessions/:id/logout` | Logout and destroy session |
| GET | `/sessions/:id/chats` | List all active chats |
| GET | `/sessions/:id/chats/:phone/messages` | Get last 50 messages from a chat |
| POST | `/sessions/:id/chats/:phone/send` | Send text message |
| POST | `/sessions/:id/chats/:phone/send-media` | Send media (image/PDF) |

**Configuration:**
- `WHATSAPP_GATEWAY_URL=http://127.0.0.1:8005`
- `PORT=8005`
- `PUPPETEER_EXECUTABLE_PATH` (optional)

---

## 8. Module 5 — Meta Ads Integration

**Purpose:** Connect Meta (Facebook/Instagram) advertising accounts, track ad performance, and import leads directly from Meta Lead Forms.

**Frontend Components:** `components/meta/MetaAdsIntegration.tsx`, `components/crm/PaidCampaignBuilder.tsx`, `components/crm/AdGenerator.tsx`

### Key Functionalities:
- **Meta OAuth Connection**: Connect Meta advertising accounts via OAuth
- **Paid Ad Campaigns**: `paidAdsApi` — create, activate, archive campaigns
  - `listLeadForms()`, `createCampaign()`, `activateAd()`, `listCampaigns()`
  - `getCampaignInsights()`, `archiveCampaign()`
- **Facebook Lead Import**: Full OAuth flow via `crmLeadsApi`
  - `getFbAuthUrl()`, `connectFbDirect()`, `verifyFbToken()`
  - `getFbAvailablePages()`, `selectFbPage()`, `disconnectFbPage()`
  - `getFbAdAccounts()`, `selectFbAdAccount()`
  - `getFbCampaigns()`, `getFbAds()`, `syncFbLeads()`
  - `importFacebookLeads()`, `getAdHistory()`
- **Facebook Publishing**: `publishToFacebook()` — publish posts to Facebook pages
- **Organic Posts**: `getOrganicPosts()` — fetch organic Facebook posts
- **Ad Creative Management**: `AdGenerator.tsx` — AI-generated ad creatives
- **Ad Campaign Builder**: `PaidCampaignBuilder.tsx` — visual campaign builder

---

## 9. Module 6 — AI Chatbot & Copilot

**Purpose:** AI-powered assistant for customer support, lead qualification, business insights, and report analysis.

**Frontend Route:** `/copilot`  
**API Client:** `copilotApi`

### Two AI Interfaces

#### 1. AI Copilot (`/copilot`)
- **Chat Interface**: Conversational AI assistant
- **AI Suggestions**: `getSuggestions()` — contextual suggestions
- **Context-Aware**: Has access to CRM, ERP, and business data
- **Streaming Responses**: Real-time streaming of AI responses

#### 2. Chatbot Widget
- **Embedded Chatbot**: `routes/chatbot-embed/` — embeddable chatbot
- **Conversation History**: Persistent chat sessions
- **Multi-Provider**: OpenAI (GPT), Anthropic (Claude), Google Gemini

#### 3. Report AI Assistant
- `consultAIReport()` — AI-powered report analysis via `inventoryApi`
- AI generates insights from report data

### AI Across Modules
| Component | Purpose |
|-----------|---------|
| `AiRecommendations.tsx` | CRM product recommendations |
| `AiInventoryHealth.tsx` | Inventory health scoring |
| `AISuggestions.tsx` | Procurement suggestions |
| `AdGenerator.tsx` | AI ad creative generation |
| `ai-insights-panel.tsx` | Dashboard AI insights |

**Note:** The RAG engine is currently paused (`.rag_enricher_paused` file exists).

---

## 10. Module 7 — HRMS

**Purpose:** Complete human resource management — employee lifecycle, attendance, leave, payroll, recruitment, performance, learning, and exit management.

**Frontend Route:** `/hrms`  
**API Client:** `hrmsApi`, `exitApi`  
**Components:** 11 specialized components under `components/hrms/`

### Sub-Modules

#### 1. Employee Management
- **Employee Records**: Full profiles with personal, contact, employment info
- **Departments**: Department CRUD
- **Designations**: Job titles and hierarchy (also in ERP config)
- **Teams**: Team management (also in ERP config)
- **Documents**: Store employee documents (ID proofs, certificates)
- **Employee Profiles**: Self-service and admin views

#### 2. Attendance Management
- **Daily Attendance**: Mark/view daily attendance
- **Attendance Settings**: Configure working hours, grace periods
- **Biometric Devices**: `BiometricDevice` type — device management
- **Face Recognition**: `FaceRecognitionLog` type — AI-based attendance
- **GPS Attendance**: Location-verified attendance
- **Shift Attendance**: Multiple shift support
- **Attendance Corrections**: Manager corrections with approval workflow

#### 3. Leave Management
- **Leave Requests**: Apply for leave with types (Casual, Sick, Earned, etc.)
- **Leave Balance**: Track available balances per employee
- **Leave Policies**: Configure leave types, accrual rules

#### 4. Payroll Management
- **Salary Structure**: Configure components (basic, HRA, allowances)
- **Pay Grades**: Grade-based salary bands
- **Payroll Processing**: Monthly payroll with calculations
- **Statutory Deductions**: PF, ESI, TDS calculations
- **Payslip Generation**: PDF payslips with templates
- **Payslip Template Studio**: `PayslipTemplateStudio.tsx` — visual template builder
- **Loans & Advances**: Employee loan tracking with EMI
- **Bonuses & Commissions**: Variable pay calculations
- **Reimbursements**: Expense reimbursement

#### 5. Recruitment Management
- **Job Openings**: Post vacancies
- **Job Postings**: Multi-channel posting
- **Zoho Recruit Integration**: `recruitment-integrations.tsx`
  - `getZohoStatus()`, `connectZoho()`, `disconnectZoho()`
  - `publishJobToZoho()`, `syncJobsFromZoho()`
- **Applicant Tracking**: Track applicants through stages
- **Interview Scheduling**: Schedule and track interviews
- **Offer Letters**: Generate offer letters
- **Onboarding**: New hire workflow

#### 6. Performance Management
- **Goals**: Set and track employee goals
- **KPIs**: Key performance indicators per role
- **Appraisals**: Performance appraisal cycles
- **Performance Reviews**: Manager/peer reviews
- **Feedback**: Continuous feedback system
- **KRA**: Key Result Areas tracking

#### 7. Learning Management
- **Training Programs**: Create training courses
- **Course Enrollment**: Enroll employees
- **Certifications**: Track certifications and expiry

#### 8. Employee Self-Service
- **Personal Dashboard**: Employee view of their data
- **Apply for Leave**: Self-service leave application
- **View Payslips**: Access personal payslips
- **Update Profile**: Self-service updates

#### 9. Exit Management (`exitApi`)
- **Resignation Tracking**: Track resignation process
  - `listResignations()`, `createResignation()`, `updateResignation()`
- **Exit Interviews**: Conduct and record exit interviews
- **Clearance**: Department-wise clearance workflow
  - `listClearance()`, `createClearance()`, `updateClearance()`
- **Full & Final Settlement**: Calculate and process FnF
  - `listSettlements()`, `createSettlement()`
- **Experience Letters**: Generate and manage
  - `listExperienceLetters()`, `createExperienceLetter()`, `updateExperienceLetter()`

#### 10. HR Intelligence
- **Dashboards**: HR analytics and reports
- **Turnover Analysis**: Employee attrition tracking
- **Headcount Reports**: Workforce analytics

#### 11. HR Benefits
- **Benefits Management**: Employee benefits tracking

### HRMS Types (30+ types in api-client.ts)
`Employee`, `AttendanceRecord`, `LeaveRequest`, `HrmsDashboardStats`, `PayGrade`, `SalaryStructure`, `ExitResignation`, `ExitClearanceTask`, `ExitFinalSettlement`, `ExitExperienceLetter`, `EmployeeDocument`, `BiometricDevice`, `FaceRecognitionLog`, `AttendanceCorrection`, `LeaveBalance`, `LeavePolicy`, and more.

---

## 11. Module 8 — Warehouse Management

**Purpose:** Warehouse operations — bin-level inventory tracking, pick/pack/ship workflows, mobile scanning, and putaway optimization.

**Frontend Route:** `/warehouse`  
**Status:** Coming Soon (placeholder page exists)

**Database Models:**
- `erp_warehouses` — Warehouse definitions with type, capacity, manager
- `erp_storage_locations` — Bin-level storage with zone/aisle/rack/shelf/bin
- `erp_goods_receipts` / `erp_goods_receipt_items` — Receiving documents
- `erp_goods_issues` / `erp_goods_issue_items` — Dispatch documents

**Note:** Backend models exist but frontend is not yet implemented.

---

## 12. Module 9 — Marketplace

**Purpose:** Multi-vendor marketplace platform — vendor management, product listing, order processing, fulfillment, and vendor payouts.

**Frontend Route:** `/marketplace`  
**API Client:** `marketplaceApi`

### Vendor Management
- **Vendor Registration**: Onboard vendors with KYC (trade license, tax TRN)
- **Vendor Profiles**: Complete profiles with ratings, commission rates
- **Commission Management**: Platform commission per vendor
- **Vendor Performance**: Track vendor ratings and order history
- **Vendor Dashboard**: `components/marketplace/VendorDashboard.tsx`

### Product Management
- **Marketplace Products**: Vendor-listed products
- **Product Approval**: Admin review before products go live
- **Featured Products**: Highlight premium listings

### Order Management
- **Order Processing**: Full order lifecycle (Pending → Processing → Shipped → Delivered)
- **Fulfillment Tracking**: Pending Pick → Packed → Ready to Ship → Shipped → Delivered
- **Order Split**: Split orders by vendor for multi-vendor carts
- **Tracking Integration**: Delivery partner tracking numbers
- **Components**: `MarketplaceOrders.tsx`, `MarketplaceProducts.tsx`

### Delivery & Logistics
- **Delivery Partners**: Integration with delivery services
- **Tracking**: Real-time order tracking
- **Delivery Status**: Status updates throughout delivery
- **Component**: `DeliveryTracking.tsx`

### B2B Pricing
- **B2B Pricing Rules**: Special pricing for business customers
- **Volume Discounts**: Quantity-based pricing
- **Customer-Specific Pricing**: Per-customer negotiated rates
- **Component**: `B2BPricingRules.tsx`

### RFQ (Request for Quotation)
- **RFQ Management**: Create and manage RFQs
- **Vendor Quotes**: Collect and compare vendor quotations
- **Award Process**: Select winning vendor
- **Component**: `MarketplaceRFQ.tsx`

### Trade Credit
- **Trade Credit Manager**: Extend credit to trusted B2B customers
- **Credit Limits**: Set per-customer credit limits
- **Credit Tracking**: Monitor outstanding trade credit
- **Component**: `TradeCreditManager.tsx`

### Coupons
- **Coupon Management**: Create and manage discount coupons
- **Component**: Part of marketplace management

### Modals
- **MarketplaceModals.tsx**: Reusable modals for vendor/product/order operations

---

## 13. Module 10 — Storefront & Super App

**Purpose:** Customer-facing e-commerce — traditional storefront and mobile-first Super App experience.

### A. Traditional Storefront (`routes/store.*`)

| Route | Page | Purpose |
|-------|------|---------|
| `/store` | Home | Storefront landing page |
| `/store/shop` | Product catalog | Browse products |
| `/store/product/:id` | Product detail | Individual product page |
| `/store/cart` | Shopping cart | Cart management |
| `/store/checkout` | Checkout | Complete purchase |
| `/store/orders` | Order history | Customer orders |
| `/store/search` | Search | Product search |
| `/store/wallet` | Wallet | Digital wallet |
| `/store/wishlist` | Wishlist | Saved products |
| `/store/register` | Register | Customer registration |
| `/store/account` | Account | Account settings |
| `/store/addresses` | Addresses | Shipping addresses |
| `/store/security` | Security | Account security |
| `/store/about` | About | About page |
| `/store/contact` | Contact | Contact page |
| `/store/blog` | Blog | Blog/content |
| `/store/pages` | Pages | Static pages |
| `/store/collection` | Collections | Product collections |
| `/store/styles` | Styles | Fashion/styles page |
| `/store/thank-you` | Thank you | Order confirmation |

**Contexts:**
- `StoreCartContext` — Shopping cart state management
- `StoreWishlistContext` — Wishlist state management

**Components:** `components/storefront/AmazonHeader.tsx`, `AmazonSubNav.tsx`, `LazyMonkeyAINavBar.tsx`, `HeroCarousel.tsx`, `ProductGrid.tsx`, `ProductInfo.tsx`, `ProductActions.tsx`

### B. Super App (Mobile-First)

**Components:** `components/superapp/`

| Component | Purpose |
|-----------|---------|
| `SuperAppHeader.tsx` | Mobile app header |
| `CategoryModules.tsx` | Category-based module grid |
| `DynamicProductGrid.tsx` | Dynamic product display |
| `FlashDeals.tsx` | Flash sale/deal section |
| `ResumeJourneyWidget.tsx` | Resume browsing journey |
| `WalletRewardsWidget.tsx` | Wallet and rewards display |
| `MobileBottomNav.tsx` | Bottom navigation bar |
| `SuperAppFooter.tsx` | App footer |

---

## 14. Module 11 — Point of Sale

**Purpose:** In-store point-of-sale system with session management, checkout, barcode scanning, and Pine Labs terminal integration.

**Frontend Route:** `/pos`  
**API Client:** `posApi`

### POS Features
- **Session Management**: Open/close POS sessions
  - `openSession()`, `closeSession()`, `getCurrentSession()`
- **Checkout**: Complete sales transactions
  - `checkout()` — process payment
  - `lookupBarcode()` — quick product scan
- **Transaction History**: View past transactions
  - `getHistory()`, `getTransactionHistory()`
- **Daily Summary**: End-of-day reports
  - `getDailySummary()`
- **Product Management**: Quick product CRUD at POS
  - `getProducts()`, `createProduct()`, `bulkCreateProducts()`, `updateProduct()`, `deleteProduct()`
- **Categories**: POS-specific product categories
- **Customer Management**: Quick customer lookup and summary
  - `getCustomerSummary()`
- **Free Quantity Rules**: Buy-X-get-Y-free promotions
  - `getFreeQtyRules()`, `saveFreeQtyRules()`, `evaluateFreeQtyRules()`

### POS Components
- `PaymentMethods.tsx` — Payment method selection
- `StoreSettings.tsx` — POS store configuration
- `LoyaltyPrograms.tsx` — POS loyalty integration

### Payment Integrations
- **Razorpay**: `paymentsApi.createRazorpayOrder()`, `verifyRazorpayPayment()`, `createRazorpayLink()`, `createRazorpayQR()`
- **Pine Labs**: `paymentsApi.chargePineLabs()`, `cancelPineLabs()`, `voidPineLabs()`, `settlePineLabsBatch()`
- **Gateway Config**: `getGatewayConfigs()`, `saveGatewayConfig()`, `testGatewayConnection()`

---

## 15. Module 12 — Payment Reminders

**Purpose:** Automated payment reminder system with configurable policies, multi-channel delivery, and penalty management.

**Frontend Route:** `/dashboard` (part of dashboard)  
**API Client:** `paymentRemindersApi`

### Reminder Policies
- **Credit Period**: Default 30 days
- **Pre-due Reminders**: Configurable intervals (e.g., 7, 3, 1 days before due)
- **Overdue Reminders**: Configurable frequency (every 12h/24h)
- **Max Reminders**: Limit on overdue reminders

### Penalty Management
- **Penalty Types**: Percentage, Fixed, Daily Percentage
- **Configurable Rate**: Set penalty rate and grace period

### Multi-Channel Delivery
- Email, WhatsApp, SMS
- Templated messages with variable substitution

### API Methods
- `getSummary()` — reminder summary stats
- `getPolicy()` — get current reminder policy
- `updatePolicy()` — update reminder configuration
- `evaluateBatch()` — batch evaluate and send reminders
- `sendSingleReminder()` — send individual reminder
- `getLogs()` — reminder send history

---

## 16. Module 13 — GST & Tax Compliance

**Purpose:** Indian GST compliance — tax calculations, invoice formatting, and tax reporting.

**Frontend Route:** Part of accounting/settings  
**API Client:** `taxApi`, `ewayBillApi`, `einvoiceApi`, `gstFilingApi`, `whitebooksSettingsApi`, `whitebooksApi`

### Tax Management
- **Tax Codes**: CRUD tax code definitions (`taxApi`)
- **Tax Returns**: Create, update, file, delete tax returns
- **Tax Payments**: Record and manage tax payments

### eWay Bill
- `generateEWayBill()` — create eWay bill
- `cancelEWayBill()` — cancel eWay bill
- `updateVehicle()` — update vehicle details
- `getEWayBillDetails()` — view eWay bill details

### eInvoice
- `generateIrn()` — generate Invoice Reference Number
- `cancelIrn()` — cancel IRN
- `generateEwaybillByIrn()` — generate eWay from IRN
- `generateB2CQr()` — generate B2C QR code

### GST Filing
- `searchGstin()` — search GST number
- `getGstr1Summary()` — GSTR-1 summary
- `uploadGstr1()` — upload GSTR-1
- `getGstr2b()` — GSTR-2B data
- `getGstr3bSummary()` — GSTR-3B summary
- `requestOtp()` — request OTP for GST portal
- `verifyOtp()` — verify OTP
- `getSessionStatus()` — GST portal session status

### Whitebooks Integration (Third-Party GST Tool)
- **Settings**: `whitebooksSettingsApi.getConfig()`, `saveConfig()`, `testConnection()`
- **Unified Access**: `whitebooksApi` provides nested access to eWay, eInvoice, GST filing, and settings through a single interface

---

## 17. Module 14 — Procurement

**Purpose:** Complete procurement workflow — supplier management, purchase requests, purchase orders, vendor bills, payments, and spend analytics.

**Frontend Route:** `/procurement`  
**API Client:** `procurementApi`, `inventoryApi` (supplier functions), `deliveryChallanApi`

### Supplier Management
- **Supplier Directory**: Full supplier profiles
- **Supplier Categories**: Categorize suppliers (Manufacturer, Distributor, Service Provider)
- **Supplier Contacts**: Multiple contacts per supplier
- **Supplier Contracts**: Contract management with start/end dates
- **Supplier Performance**: Rating system (delivery, quality, pricing)
- **Blacklisting**: Blacklist underperforming suppliers
- **Supplier CRUD**: Through `inventoryApi` — `getVendors`, `getVendorSummary`, CRUD operations

### Purchase Requests
- **Request Creation**: Internal purchase requisitions
- **Approval Workflow**: Multi-level approval before PO creation
- **Request to PO**: Convert approved PR to Purchase Order

### Purchase Orders & Orders
- **Purchase Orders**: `purchase_order_*` tables via `inventoryApi`
- **Purchase Quotations**: `purchase_quotation_*` tables
- **Goods Received Notes**: `goods_received_note_*` tables
- **Purchase Returns**: `purchase_return_*` tables
- **OCR Extraction**: Extract data from PR, Quotation, PO, GRN, Invoice documents

### Accounts Payable
- **Vendor Bills**: `vendor_bill_*` tables
- **Vendor Payments**: `listVendorPayments()`, `recordVendorPayment()`
- **Credit Notes**: Vendor credit notes
- **Debit Notes**: Vendor debit notes

### Analytics
- **Spend Analysis**: `SpendAnalysis.tsx` — spend pattern analysis
- **Lead Time Analysis**: `LeadTimeAnalysis.tsx` — procurement lead time tracking
- **Cost Analysis**: `CostAnalysis.tsx` — product cost analysis
- **Procurement Forecast**: `ProcurementForecast.tsx` — demand forecasting
- **AI Suggestions**: AI-powered procurement recommendations

### Approvals
- **Pending Approvals**: `getPendingApprovals()` — unified approval queue
- **Approval Workflows**: Configurable approval chains

### Delivery
- **Delivery Challans**: `deliveryChallanApi` — create, update, dispatch, delete challans

### Components
- `PurchaseApprovals.tsx` — Purchase approval interface
- `SupplierForm.tsx` — Supplier creation/edit form
- `SupplierRatings.tsx` — Supplier performance ratings

---

## 18. Module 15 — Reports & Business Intelligence

**Purpose:** Analytics dashboards and reporting across all modules.

**Frontend Route:** `/reports`  
**API Client:** `inventoryApi` (report methods), `reportsApi` references

### Report Categories
- **CRM Reports**: Lead conversion, sales pipeline, customer analytics
- **Sales Reports**: Revenue, order trends, top products
- **Finance Reports**: P&L, Balance Sheet, Cash Flow, Trial Balance
- **Inventory Reports**: Stock levels, valuation, movement
- **HR Reports**: Attendance, leave, payroll summaries
- **WhatsApp Reports**: Message volume, response times, lead conversion
- **Meta Ads Reports**: Ad spend, ROAS, lead generation metrics

### Report Features
- **Custom Report Builder**: `getReportBuilderPresets()`, `generateCustomReport()`
- **AI Report Analysis**: `consultAIReport()` — AI-powered report insights
- **Report Layouts**: `components/reports/layouts/LayoutTypes.ts` — different report layout types
- **Export**: Export to Excel (SheetJS) and PDF

### Dashboard
- **Main Dashboard** (`/dashboard`): KPI tiles, AI insights panel
  - `ai-insights-panel.tsx` — AI-generated business insights
  - `kpi-tile.tsx` — Individual KPI tile component
  - `section.tsx` — Dashboard section wrapper

---

## 19. Module 16 — Workflow & Automation Engine

**Purpose:** Automate business processes with configurable workflows, notifications, document templates, and automation rules.

**Frontend Route:** Part of ERP settings  
**API Client:** `approvalWorkflowsApi`, `notificationTemplatesApi`, `documentTemplatesApi`, `automationRulesApi`, `customFieldsApi`

### Sub-Modules

#### Approval Workflows
- `approvalWorkflowsApi` — list, get, create, update, delete
- Configurable approval chains for expenses, purchase requests, etc.

#### Notification Templates
- `notificationTemplatesApi` — list, get, create, update, delete
- Email, WhatsApp, SMS template management

#### Document Templates
- `documentTemplatesApi` — list, get, create, update, delete
- Invoice, quotation, payslip, offer letter templates

#### Automation Rules
- `automationRulesApi` — list, get, create, update, delete
- Trigger-based business automation

#### Custom Fields
- `customFieldsApi` — list, get, create, update, delete
- Add custom fields to any entity

---

## 20. Module 17 — IoT Integration

**Purpose:** Connect and monitor IoT devices (planned, not yet implemented).

**Frontend Route:** `/iot`  
**Status:** Coming Soon (placeholder page exists)

**Planned Functionalities:**
- Device Management: Register and manage connected IoT devices
- Real-time Monitoring: Live data from sensors
- Alerts & Notifications: Threshold-based alerts
- Data Logging: Historical data storage and analysis
- Integration with WMS: IoT sensors for warehouse monitoring

---

## 21. Module 18 — Discounts & Loyalty Engine

**Purpose:** Advanced discount and loyalty management system.

**API Client:** `crmDiscountsApi`, `crmLoyaltyApi`

### Discounts
- **Discount Rules**: Create flexible discount rules
  - Percentage/Fixed amount discounts
  - Minimum purchase thresholds
  - Customer segment targeting
  - Product/category targeting
  - Date-range validity
  - Stackable/non-stackable rules
- **Coupon System**: Generate and manage discount coupons
  - Percentage/Fixed/Free shipping coupon types
  - Usage limits and per-customer limits
  - Expiry dates
  - Auto-apply or manual entry
- **Validation**: `validateCoupon()` — real-time coupon validation
- **Usage Tracking**: `listUsage()` — track coupon usage

### Loyalty
- **Loyalty Rules**: Configure earning/redemption rules
  - `listRules()`, `getRule()`, `createRule()`, `updateRule()`, `deleteRule()`, `toggleRule()`
- **Loyalty Transactions**: Points earned and redeemed
  - `listTransactions()`, `addPoints()`, `redeemPoints()`

### Membership Plans
- **Plan Management**: Create membership plans
  - `listPlans()`, `getPlan()`, `createPlan()`, `updatePlan()`, `deletePlan()`
- **Subscriptions**: Customer membership subscriptions
  - `listSubscriptions()`, `getSubscription()`, `createSubscription()`, `cancelSubscription()`, `renewSubscription()`

---

## 22. Module 19 — Staff Onboarding

**Purpose:** Streamlined staff onboarding and authentication system.

**Frontend Route:** `/staff-onboarding`

**Key Functionalities:**
- **Invitation System**: Send onboarding invitations via email/WhatsApp
- **Role Assignment**: Pre-assign roles during invitation
- **Self-Service Registration**: Staff completes their own profile
- **Document Collection**: Collect ID proofs, address proof during onboarding
- **Welcome Flow**: Guided first-login experience
- **WhatsApp Onboarding**: Complete onboarding via WhatsApp chat

**Integration Points:**
- Uses WhatsApp Automation for onboarding conversations
- Creates user accounts linked to the tenant
- Sets initial RBAC permissions

---

## 23. Authentication & RBAC

### Authentication
- **Provider**: Supabase Auth
- **Methods**: Email/Password, OAuth (Google, etc.)
- **Session Management**: JWT tokens via Supabase
- **Password Reset**: Email-based reset flow
- **Multi-Tenant**: Users scoped to tenants
- **Additional Auth Methods**:
  - Passkeys: `passkeysApi` — WebAuthn passkey support
  - Fingerprints: `fingerprintsApi` — biometric fingerprint authentication

### Role-Based Access Control (RBAC)
- **Roles**: Tenant Owner, Admin, Manager, Agent, Viewer
- **Permissions**: Granular CRUD permissions per module
- **Context Injection**: `RBACContext` injected into all API requests
- **Permission Decorator**: `@require_permission("module:action")` on routes
- **Frontend Guarding**: `useRbac()` hook for UI-level permission checks

### Auth Pages
| Route | Page | Purpose |
|-------|------|---------|
| `/login` | Login | User login |
| `/register` | Register | New user signup |
| `/change-password` | Change Password | Password change |
| `/role-select` | Role Select | Select active role after login |
| `/platform-admin` | Platform Admin | Super-admin / multi-tenant management |

### RBAC Permission Examples
```
crm:leads:read          — View leads
crm:leads:write         — Create/edit leads
crm:leads:delete        — Delete leads
erp:products:read       — View products
erp:invoices:write      — Create invoices
whatsapp:send           — Send WhatsApp messages
hrms:employees:read     — View employee data
payroll:process         — Run payroll
```

---

## 24. Contexts & State Management

| Context | File | Purpose |
|---------|------|---------|
| `AuthContext` | `auth-context.tsx` | Authentication state — login, logout, register, profile, token refresh. Exports `AuthRole`, `AppUser` interfaces. |
| `TenantContext` | `tenant-context.tsx` | Multi-tenant/company switching — selected company, active branch, companies/branches list. |
| `RbacContext` | `rbac-context.tsx` | Role-based access — active role, available roles, `hasPermission()`, `isModuleAllowed()`, `isTabAllowed()`. |
| `ThemeContext` | `theme-context.tsx` | Theme management — currently locked to light mode. |
| `I18nContext` | `i18n-context.tsx` | Internationalization — supports `en` (English) and `ar` (Arabic/RTL). `t()` translation function. |
| `StoreCartContext` | `StoreCartContext.tsx` | Storefront shopping cart — items, add/remove/update, totals, localStorage persistence. |
| `StoreWishlistContext` | `StoreWishlistContext.tsx` | Storefront wishlist — toggle items, React Query cache management. |

---

## 25. Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useCurrency()` | `use-currency.ts` | Active currency config, formatting function, exchange rates, currency icon. Listens for `bos-currency-changed` event. |
| `useMobile()` | `use-mobile.tsx` | Responsive detection — returns whether viewport is mobile-sized. |
| `usePincodeLookup()` | `use-pincode-lookup.ts` | Looks up Indian pincode → city/state/address. Uses `utilsApi.lookupPincode` with India Post API fallback. Caches results. |
| `useHrmsData()` | `useHrmsData.ts` | Tenant-specific HRMS mock data — varies stats/departments per tenant (Atlas Manufacturing, Helios Logistics, Nimbus Retail). |
| `useCrmData()` | `useCrmData.ts` | Fetches live CRM data (opportunities, leads, tickets, quotations) via API. Returns typed `CrmData` interface. |
| `useHardwareBarcodeScanner()` | `useHardwareBarcodeScanner.ts` | Listens for rapid keystrokes from USB/Bluetooth barcode guns. Fires `onScan` callback on Enter after rapid input. |

---

## 26. Database Schema

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `tenants` | Multi-tenant organizations | name, slug, settings (JSON) |
| `users` | System users | email, tenant_id, role, passkeys, fingerprints |
| `companies` | Business entities (multi-company) | name, tenant_id, gstin |
| `crm_leads` | Sales leads | name, phone, email, source, status, score |
| `crm_customers` | CRM customers | name, phone, email, gstin, addresses |
| `crm_lead_activities` | Activity log | lead_id, type, description, timestamp |
| `crm_groups` / `crm_group_members` | Customer groups | name, members |
| `crm_segments` | Dynamic segments | rules, criteria |
| `crm_opportunities` | Deal/opportunity records | name, stage, value, probability |
| `crm_tickets` | Support tickets | subject, status, priority |
| `crm_quotations` | Quotations | quote_number, customer, items, status |
| `crm_sales_orders` | Sales orders | order_number, customer, items, status |
| `crm_lead_attributions` | Lead attribution tracking | source, campaign, medium |
| `erp_products` | Product catalog | name, sku, price, stock, uom_id |
| `erp_product_categories` | Product categories | name, parent_id |
| `erp_brands` | Brands | name, logo_url |
| `erp_unit_of_measures` | UOM definitions | name, symbol, category |
| `erp_product_variants` | Product variants | product_id, attributes, price_delta |
| `erp_product_bundles` / `erp_product_bundle_items` | Product bundles |
| `erp_product_kits` / `erp_product_kit_items` | Product kits |
| `erp_product_images` | Product images | product_id, url, sort_order |
| `erp_warehouses` | Warehouses | name, type, capacity, manager |
| `erp_storage_locations` | Bin locations | warehouse_id, zone, aisle, rack, shelf, bin |
| `erp_goods_receipts` / `erp_goods_receipt_items` | Goods receipts |
| `erp_goods_issues` / `erp_goods_issue_items` | Goods issues |
| `chart_of_accounts` | COA | code, name, type, sub_type, parent_id |
| `journal_entries` / `journal_entry_lines` | Journal entries | entry_number, type, status |
| `account_balances` | Periodic balances | account_id, period, opening, closing |
| `ar_invoices` / `ar_invoice_lines` | Sales invoices | invoice_number, customer, amounts, tax |
| `ar_credit_notes` | Credit notes | note_number, invoice_id, amount |
| `purchase_orders` / `purchase_order_items` | Purchase orders | po_number, supplier, status |
| `purchase_requests` / `purchase_request_items` | Purchase request workflow |
| `purchase_quotations` / `purchase_quotation_items` | Purchase quotations |
| `goods_received_notes` / `goods_received_note_items` | GRN records |
| `purchase_returns` / `purchase_return_items` | Purchase returns |
| `vendor_bills` / `vendor_bill_items` | Vendor bills |
| `vendor_payments` / `vendor_payment_items` | Vendor payments |
| `vendor_credit_notes` / `vendor_credit_note_items` | Vendor credit notes |
| `vendor_debit_notes` / `vendor_debit_note_items` | Vendor debit notes |
| `erp_suppliers` | Supplier master | name, code, type, rating, gstin |
| `erp_supplier_categories` | Supplier categories | name, description |
| `erp_supplier_contacts` | Supplier contacts | supplier_id, name, phone, email |
| `erp_supplier_contracts` | Supplier contracts | supplier_id, start_date, end_date |
| `erp_supplier_performance` | Supplier ratings | supplier_id, rating, criteria |
| `erp_blacklisted_suppliers` | Blacklist records | supplier_id, reason, date |
| `fixed_assets` | Fixed assets | name, cost, depreciation, status |
| `expenses` / `expense_items` | Expense records | amount, category, status |
| `vouchers` / `voucher_lines` | Voucher management |
| `cost_centers` | Cost centers | name, code, parent_id |
| `fiscal_years` | Fiscal year periods | name, start_date, end_date |
| `currencies` | Currency definitions | code, name, symbol, rate |
| `bank_accounts` / `bank_transactions` | Banking | account details, transactions |
| `bank_reconciliations` / `bank_reconciliation_items` | Bank reconciliation |
| `budgets` | Budget records | period, amount, category |
| `expense_claims` / `expense_claim_items` | Expense claims |
| `tax_codes` | Tax code definitions | name, rate, type |
| `tax_returns` | Tax return records | type, period, status |
| `tax_payments` | Tax payment records | return_id, amount, date |
| `whatsapp_sessions` | WhatsApp sessions | session_id, phone, status, qr_data |
| `marketplace_vendors` | Marketplace vendors | name, rating, commission, kyc |
| `marketplace_products` | Marketplace products | vendor_id, name, price, stock |
| `marketplace_orders` / `marketplace_order_items` | Marketplace orders | customer, amounts, status, tracking |
| `marketplace_payouts` | Vendor payouts | vendor_id, amount, status |
| `marketplace_coupons` | Discount coupons | code, type, value, expiry |
| `marketplace_reviews` | Product reviews | product_id, rating, review |
| `marketplace_wishlists` | Customer wishlists | user_id, product_id |
| `marketplace_delivery_partners` | Delivery services | name, api_config |
| `marketplace_b2b_pricing_rules` | B2B pricing rules | customer_id, product_id, price |
| `marketplace_rfqs` / `marketplace_rfq_bids` | RFQ management | rfq_id, vendor_id, bid_amount |
| `marketplace_trade_credits` | Trade credit records | customer_id, limit, outstanding |
| `storefront_wallets` | Customer wallets | user_id, balance, coins, tier |
| `storefront_wallet_transactions` | Wallet transactions | wallet_id, type, amount |
| `storefront_journeys` | Customer journeys | user_id, steps, status |
| `storefront_notifications` | Notifications | user_id, type, message, read |
| `payment_reminder_policies` | Reminder config | tenant settings, templates |
| `payment_reminder_logs` | Reminder history | channel, status, amounts |
| `delivery_challans` / `delivery_challan_items` | Delivery challans | challan_number, status |
| `inventory_categories` | Inventory categories | name, parent_id |
| `inventory_brands` | Inventory brands | name, logo_url |
| `inventory_uoms` | Unit of measures | name, symbol, category |
| `product_attributes` | Product attributes | name, type, values |
| `product_variants` | Product variants | product_id, attributes, price_delta |
| `product_bundles` / `product_bundle_items` | Product bundles |
| `product_kits` / `product_kit_items` | Product kits |
| `product_images` | Product images | product_id, url, sort_order |
| `inventory_products` | Inventory products | sku, name, stock, pricing |
| `goods_receipts` / `goods_receipt_items` | Goods receipts |
| `goods_issues` / `goods_issue_items` | Goods issues |
| `stock_movements` | Stock movements | product_id, from_location, to_location, qty |
| `stock_adjustments` / `stock_adjustment_items` | Stock adjustments |
| `cycle_counts` / `cycle_count_items` | Cycle counting |
| `batches` | Batch tracking | product_id, batch_number, expiry |
| `serials` | Serial tracking | product_id, serial_number, status |
| `qr_codes` | QR code records | product_id, code, status |
| `rfid_tags` | RFID tag records | product_id, tag_id, status |
| `traceability_events` | Traceability events | product_id, event_type, location |
| `expiry_discounts` | Expiry discount rules | product_id, discount_pct, threshold_days |
| `manufacturing_cohorts` | Manufacturing batches | product_id, batch_date, qty |
| `goods_receipt_items` | GRN line items | grn_id, product_id, qty |
| `goods_issue_items` | GI line items | gi_id, product_id, qty |
| `inventory_stock_balances` | Stock balance snapshots | product_id, warehouse_id, qty |
| `inventory_movements` | Movement history | product_id, type, qty, from, to |
| `inventory_adjustments` | Adjustment records | product_id, reason, qty_delta |
| `inventory_cycle_counts` | Cycle count records | product_id, counted_qty, variance |
| `inventory_batches` | Batch records | product_id, batch_no, mfg_date, exp_date |
| `inventory_serials` | Serial records | product_id, serial_no, status |
| `inventory_qr_codes` | QR code records | product_id, code, printed |
| `inventory_rfid_tags` | RFID records | product_id, tag_id, scanned |
| `inventory_traceability_events` | Trace events | product_id, event_type, location, timestamp |
| `inventory_putaway_rules` | Putaway rules | product_id, warehouse_id, location_id, priority |
| `inventory_picking_rules` | Picking rules | warehouse_id, strategy, priority |
| `inventory_movements` | Stock movements | product_id, from_loc, to_loc, qty, type |
| `hrms_employees` | Employee records | user_id, department, designation, join_date |
| `hrms_attendance` | Attendance records | employee_id, date, status |
| `hrms_leave_requests` | Leave requests | employee_id, type, dates, status |
| `hrms_pay_grades` | Pay grades | name, min_salary, max_salary |
| `hrms_salary_structures` | Salary structures | employee_id, components |
| `hrms_performance_reviews` | Performance reviews | employee_id, reviewer_id, period, score |
| `hrms_benefits` | Employee benefits | employee_id, type, value |
| `hrms_biometric_devices` | Biometric devices | name, location, status |
| `hrms_face_recognition_logs` | Face recognition logs | employee_id, timestamp, confidence |
| `hrms_attendance_corrections` | Attendance corrections | employee_id, date, reason, status |
| `hrms_leave_balances` | Leave balances | employee_id, leave_type, balance |
| `hrms_leave_policies` | Leave policies | leave_type, accrual_rate, max_balance |
| `exit_resignations` | Resignation records | employee_id, date, notice_period, status |
| `exit_clearance_tasks` | Clearance tasks | resignation_id, department, status |
| `exit_settlements` | FnF settlements | employee_id, amount, components, status |
| `exit_experience_letters` | Experience letters | employee_id, content, issued_date |
| `approval_workflows` | Approval workflows | name, entity_type, steps |
| `notification_templates` | Notification templates | name, channel, subject, body |
| `document_templates` | Document templates | name, type, content |
| `automation_rules` | Automation rules | name, trigger, action |
| `custom_fields` | Custom fields | entity_type, name, type, required |
| `system_settings` | System settings | key, value, category |
| `system_health` | System health metrics | service, status, latency |
| `error_logs` | Error logs | level, message, stack_trace, timestamp |
| `passkeys` | WebAuthn passkeys | user_id, credential_id, public_key |
| `user_fingerprints` | Biometric fingerprints | user_id, template_hash |
| `fiscal_years` | Fiscal years | name, start_date, end_date, status |
| `currencies` | Currencies | code, name, symbol, exchange_rate |
| `geography_countries` | Countries | code, name, phone_code |
| `erp_locations` | Business locations | name, address, type |
| `work_calendars` | Work calendars | name, shifts, holidays |
| `tags` | Tags/labels | name, color, entity_type |
| `companies` | Companies (multi-company) | name, tenant_id, gstin, settings |
| `branches` | Branches | company_id, name, address |
| `business_units` | Business units | company_id, name |
| `zones` | Zones | name, description |
| `regions` | Regions | name, country_id |
| `cost_centers` | Cost centers | company_id, name, code, parent_id |
| `number_series` | Number series | entity_type, prefix, next_number |
| `payment_terms` | Payment terms | name, days, discount_days, discount_pct |
| `teams` | Teams | name, department_id |
| `delivery_challans` / `delivery_challan_items` | Delivery challans | challan_number, status, tracking |
| `inventory_putaway_rules` | Putaway rules | product_id, warehouse_id, location_id |
| `inventory_picking_rules` | Picking rules | warehouse_id, strategy |
| `inventory_ocr_extractions` | OCR extractions | document_type, raw_text, extracted_data |
| `spend_analysis` | Spend analysis | period, category, amount, vendor |
| `lead_time_analysis` | Lead time data | product_id, supplier_id, avg_lead_days |
| `inventory_ai_suggestions` | AI suggestions | product_id, suggestion_type, confidence |
| `procurement_forecasts` | Procurement forecasts | product_id, forecast_qty, period |
| `pending_approvals` | Pending approvals | entity_type, entity_id, approver_id |
| `report_builder_presets` | Report presets | name, config, layout_type |
| `custom_reports` | Custom reports | name, query, parameters |
| `discounts_discount` | Discount rules | name, type, value, conditions |
| `discounts_coupon` | Coupon definitions | code, type, value, limits, expiry |
| `discounts_coupon_usage` | Coupon usage tracking | coupon_id, user_id, order_id |
| `discounts_loyalty_account` | Loyalty accounts | user_id, points_balance, tier |
| `discounts_loyalty_transaction` | Loyalty transactions | account_id, type, points, reason |
| `membership_plans` | Membership plans | name, price, duration, benefits |
| `membership_subscriptions` | Customer subscriptions | plan_id, customer_id, start_date, end_date |
| `payment_reminder_policies` | Reminder config | tenant_id, templates, schedules |
| `payment_reminder_logs` | Reminder history | policy_id, invoice_id, channel, status |
| `live_notifications` | In-app notifications | user_id, type, message, read_status |
| `push_notification_templates` | Push templates | name, title, body, platform |
| `notification_broadcasts` | Broadcast records | template_id, sent_count, status |
| `push_notification_devices` | Registered devices | user_id, device_token, platform |
| `chat_conversations` | Chat sessions | user_id, tenant_id, started_at |
| `chat_messages` | Chat messages | conversation_id, role, content, timestamp |
| `asset_library_items` | Media assets | name, url, type, status |
| `crm_call_logs` | Call records | lead_id, duration, outcome, timestamp |
| `crm_call_stats` | Call statistics | agent_id, period, metrics |
| `master_catalog_products` | Master product catalog | sku, name, category, gst_hsn |
| `inventory_product_attributes` | Product attributes | product_id, name, value |
| `inventory_product_variants` | Product variants | product_id, sku, attributes, price_delta |
| `inventory_product_bundles` / `inventory_product_bundle_items` | Bundles |
| `inventory_product_kits` / `inventory_product_kit_items` | Kits |
| `inventory_product_images` | Product images | product_id, url, sort_order |
| `pos_sessions` | POS sessions | opened_at, closed_at, cashier_id |
| `pos_transactions` | POS transactions | session_id, total, payment_method |
| `pos_categories` | POS categories | name, sort_order |
| `pos_products` | POS products | product_id, category_id, price |
| `free_qty_rules` | Free quantity rules | product_id, buy_qty, free_qty |
| `zoho_recruit_config` | Zoho Recruit config | tenant_id, api_key, connected |
| `zoho_job_postings` | Job postings on Zoho | job_id, title, status |
| `inventory_goods_receipts` / `inventory_goods_receipt_items` | GRN |
| `inventory_goods_issues` / `inventory_goods_issue_items` | GI |
| `inventory_stock_movements` | Stock movements |
| `inventory_stock_adjustments` / `inventory_stock_adjustment_items` | Adjustments |
| `inventory_cycle_counts` / `inventory_cycle_count_items` | Cycle counts |
| `inventory_health_scores` | AI health scores | product_id, score, components |
| `inventory_expiry_discounts` | Expiry discount rules | product_id, discount_pct |
| `inventory_expiry_items` | Expiry tracked items | product_id, batch_id, expiry_date |
| `inventory_manufacturing_cohorts` | Manufacturing cohorts | product_id, batch_date, qty |
| `inventory_barcodes` | Barcode records | product_id, barcode_value |
| `inventory_qr_codes` | QR code records | product_id, qr_data |
| `inventory_rfid_tags` | RFID tags | product_id, tag_id, status |
| `inventory_traceability_events` | Trace events | product_id, event_type, location, timestamp |
| `inventory_batches` | Batch records | product_id, batch_no, mfg_date, exp_date |
| `inventory_serials` | Serial records | product_id, serial_no, status |
| `inventory_ocr_extractions` | OCR extractions | document_type, extracted_data |
| `inventory_supplier_performance` | Supplier ratings | supplier_id, criteria, score |
| `inventory_spend_analysis` | Spend analysis data | period, category, amount |
| `inventory_lead_time_analysis` | Lead time data | product_id, supplier_id, days |
| `inventory_ai_suggestions` | AI suggestions | product_id, suggestion, confidence |
| `inventory_procurement_forecasts` | Forecasts | product_id, forecast_qty, period |
| `inventory_pending_approvals` | Approval queue | entity_type, entity_id, approver |
| `inventory_report_presets` | Report presets | name, layout_type, config |
| `inventory_custom_reports` | Custom reports | name, query, parameters |

---

## 27. Frontend Structure

### Routing Architecture
- **Framework**: TanStack Router (file-based, type-safe)
- **Layout Groups**: `_app.*` files define layout wrappers with shared sidebars/headers
- **Data Fetching**: TanStack Query (React Query) with 5-minute stale time, no refetch on window focus
- **State Management**: React Context (auth, tenant, RBAC, theme, i18n, cart, wishlist)

### Route Organization

```
routes/
├── __root.tsx                  # Root layout — AuthProvider, RbacProvider, QueryClient
├── index.tsx                   # Root route → redirects to /dashboard
├── login.tsx                   # Login page
├── role-select.tsx             # Role selection after login
├── change-password.tsx         # Change password
├── platform-admin.tsx          # Platform admin (super-admin)
├── _app.tsx                    # Main authenticated app layout (sidebar, header)
├── _app.dashboard.tsx          # /dashboard — Main dashboard
├── _app.crm.tsx                # /crm — CRM module
├── _app.inventory.tsx          # /inventory — Inventory module
├── _app.procurement.tsx        # /procurement — Procurement
├── _app.accounting.tsx         # /accounting — Accounting
├── _app.hrms.tsx               # /hrms — HRMS
├── _app.pos.tsx                # /pos — Point of Sale
├── _app.erp.tsx                # /erp — ERP settings
├── _app.warehouse.tsx          # /warehouse — Warehouse (coming soon)
├── _app.copilot.tsx            # /copilot — AI Copilot
├── _app.marketplace.tsx        # /marketplace — Marketplace
├── _app.iot.tsx                # /iot — IoT (coming soon)
├── _app.settings.tsx           # /settings — Settings
├── _app.reports.tsx            # /reports — Reports & analytics
├── store.tsx                   # Storefront parent route
├── store.index.tsx             # /store — Storefront home
├── store.shop.tsx              # /store/shop
├── store.product.$id.tsx       # /store/product/:id
├── store.cart.tsx              # /store/cart
├── store.checkout.tsx          # /store/checkout
├── store.orders.tsx            # /store/orders
├── store.search.tsx            # /store/search
├── store.wallet.tsx            # /store/wallet
├── store.wishlist.tsx          # /store/wishlist
├── store.register.tsx          # /store/register
├── store.thank-you.tsx         # /store/thank-you
├── store.account.tsx           # /store/account
├── store.addresses.tsx         # /store/addresses
├── store.security.tsx          # /store/security
├── store.about.tsx             # /store/about
├── store.contact.tsx           # /store/contact
├── store.blog.tsx              # /store/blog
├── store.pages.tsx             # /store/pages
├── store.collection.tsx        # /store/collection
├── store.styles.tsx            # /store/styles
└── vault.offers.$filename.tsx  # /vault/offers/:filename — Download offers
    vault.payslips.$filename.tsx # /vault/payslips/:filename — Download payslips
```

### Component Organization

```
components/
├── coming-soon.tsx             # Placeholder for upcoming modules
├── command-palette.tsx         # ⌘K quick search/command palette
├── stat-card.tsx               # Generic KPI stat card
├── unauthorized.tsx            # Access denied page
├── recruitment-integrations.tsx # Zoho Recruit integration
├── NotificationSettings.tsx    # Push notification preferences
├── mock-screen.tsx             # Demo/placeholder screen
├── ui/                         # shadcn/ui components (13 primitives)
│   ├── avatar.tsx
│   ├── button.tsx
│   ├── checkbox.tsx
│   ├── command.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── input.tsx
│   ├── label.tsx
│   ├── popover.tsx
│   ├── skeleton.tsx
│   ├── tabs.tsx
│   ├── textarea.tsx
│   └── progress.tsx
├── layout/                     # Layout shell
│   ├── Sidebar.tsx
│   ├── Topbar.tsx
│   ├── Navigation.tsx
│   ├── WorkspaceSwitcher.tsx
│   ├── Breadcrumb.tsx
│   └── ModuleNavigator.tsx
├── dashboard/                  # Dashboard widgets
│   ├── ai-insights-panel.tsx   # AI-generated insights
│   ├── kpi-tile.tsx            # KPI tile component
│   └── section.tsx             # Dashboard section wrapper
├── crm/                        # CRM components (20+ files)
│   ├── Customers.tsx
│   ├── Leads.tsx
│   ├── PaidCampaignBuilder.tsx
│   ├── AdGenerator.tsx
│   ├── SocialMediaDashboard.tsx
│   ├── SmsCampaigns.tsx
│   ├── CustomerAnalytics.tsx
│   ├── ChurnPrediction.tsx
│   ├── AiRecommendations.tsx
│   ├── LifetimeValue.tsx
│   ├── PurchaseBehaviour.tsx
│   ├── RfmAnalysis.tsx
│   └── ...
├── erp/                        # ERP configuration (25+ files)
│   ├── ActivityLogs.tsx
│   ├── ApiKeys.tsx
│   ├── ApprovalWorkflows.tsx
│   ├── AutomationRules.tsx
│   ├── BackupRestore.tsx
│   ├── BusinessUnits.tsx
│   ├── CalendarsAndShifts.tsx
│   ├── CostCenters.tsx
│   ├── CurrencyManagement.tsx
│   ├── DesignationManagement.tsx
│   ├── DocumentTemplates.tsx
│   ├── FiscalYears.tsx
│   ├── GlobalSettings.tsx
│   ├── Locations.tsx
│   ├── NumberSeries.tsx
│   ├── OrganizationStructure.tsx
│   ├── PaymentTerms.tsx
│   ├── Regions.tsx
│   ├── SystemHealth.tsx
│   ├── TagsLabels.tsx
│   ├── TaxConfiguration.tsx
│   ├── Teams.tsx
│   ├── WorkspaceManagement.tsx
│   └── Zones.tsx
├── hrms/                       # HRMS components
│   ├── EmployeeManagement.tsx
│   ├── AttendanceManagement.tsx
│   ├── LeaveManagement.tsx
│   ├── PayrollManagement.tsx
│   ├── RecruitmentManagement.tsx
│   ├── PerformanceManagement.tsx
│   ├── LearningManagement.tsx
│   ├── EmployeeSelfService.tsx
│   ├── ExitManagement.tsx
│   ├── HRIntelligence.tsx
│   └── PayslipTemplateStudio.tsx
├── inventory/                  # Inventory components (15+ files)
│   ├── AiInventoryHealth.tsx
│   ├── AbcAnalysis.tsx
│   ├── DeadStock.tsx
│   ├── FastMoving.tsx
│   ├── SlowMoving.tsx
│   ├── ReorderPlanning.tsx
│   ├── BatchNumbers.tsx
│   ├── SerialNumbers.tsx
│   ├── QrCodeManagement.tsx
│   ├── ProductAttributes.tsx
│   ├── ProductImages.tsx
│   ├── CycleCounting.tsx
│   ├── Traceability.tsx
│   ├── StockOverview.tsx
│   ├── LowStockAlerts.tsx
│   ├── InventoryForecast.tsx
│   ├── SpendAnalysis.tsx
│   ├── LeadTimeAnalysis.tsx
│   ├── CostAnalysis.tsx
│   ├── ProcurementForecast.tsx
│   └── AISuggestions.tsx
├── procurement/                # Procurement components
│   ├── PurchaseApprovals.tsx
│   ├── SupplierForm.tsx
│   └── SupplierRatings.tsx
├── pos/                        # POS components
│   ├── PaymentMethods.tsx
│   ├── StoreSettings.tsx
│   ├── LoyaltyPrograms.tsx
│   └── FreeQtyPanel.tsx
├── marketplace/                # Marketplace components
│   ├── Vendors.tsx
│   ├── VendorDashboard.tsx
│   ├── MarketplaceProducts.tsx
│   ├── MarketplaceOrders.tsx
│   ├── DeliveryTracking.tsx
│   ├── B2BPricingRules.tsx
│   ├── MarketplaceRFQ.tsx
│   ├── TradeCreditManager.tsx
│   └── MarketplaceModals.tsx
├── meta/                       # Meta Ads components
│   └── MetaAdsIntegration.tsx
├── whatsapp/                   # WhatsApp components
├── chatbot/                    # Chatbot components
├── reports/                    # Reports
│   └── layouts/LayoutTypes.ts  # Report layout types
├── accounting/                 # Accounting components
│   ├── ModalShell.tsx
│   └── utils.ts
├── storefront/                 # Storefront components
│   ├── AmazonHeader.tsx
│   ├── AmazonSubNav.tsx
│   ├── LazyMonkeyAINavBar.tsx
│   ├── HeroCarousel.tsx
│   ├── ProductGrid.tsx
│   ├── ProductInfo.tsx
│   └── ProductActions.tsx
├── superapp/                   # Mobile Super App
│   ├── SuperAppHeader.tsx
│   ├── CategoryModules.tsx
│   ├── DynamicProductGrid.tsx
│   ├── FlashDeals.tsx
│   ├── ResumeJourneyWidget.tsx
│   ├── WalletRewardsWidget.tsx
│   ├── MobileBottomNav.tsx
│   └── SuperAppFooter.tsx
├── common/                     # Shared utilities
│   └── CurrencyIcon.tsx        # Currency symbol component
├── settings/                   # Settings components
│   └── WhitebooksSettings.tsx  # GST/eWay/eInvoice settings
├── admin/                      # Admin components
└── shared/                     # Shared/reusable components
```

---

## 28. API Client Reference

**File:** `frontend/src/lib/api-client.ts` (5,648 lines)  
**Purpose:** Central API integration layer for every backend module.

### Core Utilities
- `resolveImageUrl(url)` — Resolves relative/absolute image URLs to correct backend origin
- `downloadCsv(filename, headers, rows)` — Client-side CSV export
- `PaginatedResponse<T>` — Generic paginated response type
- `ApiError` — Error shape
- `request<T>(method, path, body?, params?)` — Generic typed fetch wrapper with auth injection
- `getToken()` — Reads auth token from localStorage

### Complete API Object Listing

#### Auth & Identity
| API Object | Methods |
|------------|---------|
| `authApi` | login, register, forgotPassword, resetPassword, verifyEmail, refreshToken, getProfile, updateProfile, changePassword |
| `passkeysApi` | getRegisterOptions, verifyRegister, getLoginOptions, verifyLogin, list, delete |
| `fingerprintsApi` | enroll, verifyLogin, list, delete |

#### CRM & Sales
| API Object | Methods |
|------------|---------|
| `crmApi` | Intelligence analytics |
| `crmLeadsApi` | list, listSalesExecutives, bulkAssign, bulkImport, create, update, listActivities, addActivity, convert, convertPipeline, getAttribution, exportCsvUrl, Facebook OAuth (8 methods), getOrganicPosts, getCampaigns, save/delete/get Fb credentials, importFacebookLeads, analyzeLeadAi, initiateCall, getFbTokenInfo, getAdHistory, publishToFacebook, getFbAdAccounts, selectFbAdAccount, getFbCampaigns, getFbAds, syncFbLeads, getSearchSuggestions, searchMasterCatalog, saveToMasterCatalog, importExcelMasterCatalog, importToLocalInventory |
| `crmOpportunitiesApi` | list, create, update, listActivities, addActivity, exportCsvUrl |
| `crmCustomersApi` | list, create, update, bulkImport |
| `crmGroupsApi` | list, get, create, update, delete, toggle, addMembers, removeMember, getMembers |
| `crmSegmentsApi` | list, get, create, update, delete, toggle, recalculate, preview |
| `crmMembershipsApi` | listPlans, getPlan, createPlan, updatePlan, deletePlan, listSubscriptions, getSubscription, createSubscription, cancelSubscription, renewSubscription |
| `crmWalletApi` | listTransactions, credit, debit, adjust, getBalance |
| `crmLoyaltyApi` | listRules, getRule, createRule, updateRule, deleteRule, toggleRule, listTransactions, addPoints, redeemPoints |
| `crmDiscountsApi` | list, get, create, update, delete, toggle, validateCoupon, listUsage |
| `crmCampaignsApi` | generateCopy, optimizePrompt, generatePoster, publishFacebook, listEmailCampaigns, createEmailCampaign, sendEmailCampaign, listEmailTemplates, createEmailTemplate |
| `crmTicketsApi` | list, create, update, delete, summarize |
| `crmQuotationsApi` | list, create, update, sendQuotation, delete, convertToOrder, getPdfUrl |
| `crmSalesOrdersApi` | list, create |
| `crmIntelligenceApi` | getAnalytics, getChurn, getLifetimeValue, getPurchaseBehaviour, getRfm, getRecommendations |
| `crmCallsApi` | initiate, turn, complete, listLogs, getStats, exportCsvUrl |
| `paidAdsApi` | listLeadForms, createCampaign, activateAd, listCampaigns, getCampaignInsights, archiveCampaign |
| `assetLibraryApi` | save, list, approve |
| `liveNotificationsApi` | list, readAll, markAsRead, delete, getSettings, updateSettings |
| `pushNotificationsApi` | listTemplates, createTemplate, updateTemplate, deleteTemplate, sendBroadcast, listBroadcasts, registerDevice, unregisterDevice |

#### Inventory & POS
| API Object | Methods |
|------------|---------|
| `inventoryApi` | 100+ methods covering products, categories, brands, UOM, variants, bundles, kits, images, warehouses, locations, putaway/picking rules, goods receipts/issues/movements/adjustments/cycle counts, batches/serials/QR/RFID/barcode, traceability, expiry, manufacturing, OCR extraction, supplier management, purchase requests/quotations/orders/returns, vendor bills/payments/credit/debit notes, spend/lead time/cost analysis, AI suggestions, procurement forecast, pending approvals, reports, Zoho Recruit integration |
| `posApi` | openSession, closeSession, getCurrentSession, checkout, getHistory, getTransactionHistory, getDailySummary, deleteTransaction, lookupBarcode, getCategories, getProducts, createProduct, bulkCreateProducts, updateProduct, deleteProduct, createCategory, getCustomerSummary, getFreeQtyRules, saveFreeQtyRules, evaluateFreeQtyRules |

#### Accounting & Finance
| API Object | Methods |
|------------|---------|
| `accountingApi` | listAccounts, getAccount, createAccount, updateAccount, deleteAccount, getGeneralLedger, getAccountTree, getOpeningBalances, updateOpeningBalance, listJournalEntries, getJournalEntry, createJournalEntry, postJournalEntry, voidJournalEntry |
| `bankApi` | listBankAccounts, getBankAccount, createBankAccount, updateBankAccount, listTransactions, createTransaction, listReconciliations, getReconciliation, createReconciliation, completeReconciliation |
| `invoicesApi` | listInvoices, getInvoice, getCustomerSummary, createInvoice, sendInvoice, sendInvoiceToWhatsApp, recordPayment, listPayments |
| `paymentRemindersApi` | getSummary, getPolicy, updatePolicy, evaluateBatch, sendSingleReminder, getLogs |
| `fixedAssetsApi` | listAssets, getAsset, createAsset, runDepreciation, listCategories, createCategory |
| `expenseClaimsApi` | listExpenseClaims, getExpenseClaim, createExpenseClaim, approveExpenseClaim, rejectExpenseClaim |
| `budgetsApi` | listBudgets, getBudget, createBudget |
| `financialReportsApi` | profitAndLoss, balanceSheet, cashFlow, trialBalance, arAging |
| `taxApi` | listTaxCodes, createTaxCode, updateTaxCode, deleteTaxCode, listTaxReturns, createTaxReturn, updateTaxReturn, fileTaxReturn, deleteTaxReturn, listTaxPayments, createTaxPayment, updateTaxPayment, deleteTaxPayment |
| `ewayBillApi` | generateEWayBill, cancelEWayBill, updateVehicle, getEWayBillDetails |
| `einvoiceApi` | generateIrn, cancelIrn, generateEwaybillByIrn, generateB2CQr |
| `gstFilingApi` | searchGstin, getGstr1Summary, uploadGstr1, getGstr2b, getGstr3bSummary, requestOtp, verifyOtp, getSessionStatus |
| `whitebooksSettingsApi` | getConfig, saveConfig, testConnection |
| `whitebooksApi` | searchGstin, ewayBill (nested), einvoice (nested), gstFiling (nested), settings (nested) |

#### HRMS
| API Object | Methods |
|------------|---------|
| `hrmsApi` | dashboard stats, employees CRUD, departments, attendance, leave types/requests, pay grades, salary structures, performance reviews, benefits, onboarding, exit management |
| `exitApi` | listResignations, createResignation, updateResignation, listClearance, createClearance, updateClearance, listSettlements, createSettlement, listExperienceLetters, createExperienceLetter, updateExperienceLetter |

#### Marketplace & Storefront
| API Object | Methods |
|------------|---------|
| `marketplaceApi` | vendors (CRUD + KYC), products (CRUD + status), orders (CRUD + pack/dispatch/cancel), stats, payouts, coupons, delivery partners, vendor categories/contracts, pricing rules, RFQs (CRUD + bids), trade credits |

#### Procurement
| API Object | Methods |
|------------|---------|
| `procurementApi` | lookupGstin, verifyGstin, getVendors, getVendorSummary, listVendorPayments, recordVendorPayment |
| `deliveryChallanApi` | getChallans, getChallan, createChallan, updateChallan, deleteChallan, dispatchChallan |

#### System & Integrations
| API Object | Methods |
|------------|---------|
| `copilotApi` | chat, getSuggestions |
| `paymentsApi` | gateway configs (CRUD + test), Razorpay (order/verify/link/QR), Pine Labs (charge/cancel/void/settle) |
| `approvalWorkflowsApi` | list, get, create, update, delete |
| `notificationTemplatesApi` | list, get, create, update, delete |
| `documentTemplatesApi` | list, get, create, update, delete |
| `automationRulesApi` | list, get, create, update, delete |
| `customFieldsApi` | list, get, create, update, delete |
| `geographyApi` | list, get, create, update, delete |
| `locationsApi` | list, get, create, update, delete |
| `workCalendarsApi` | list, get, create, update, delete |
| `tagsApi` | list, get, create, update, delete |
| `systemSettingsApi` | list, batchUpdate, upsert |
| `systemHealthApi` | get |
| `errorLogsApi` | list |
| `backupApi` | getStatus |
| `companiesApi` | list, get, create, update, delete, getLogo |
| `branchesApi` | list, get, create, update, delete |
| `businessUnitsApi` | CRUD |
| `zonesApi` | CRUD |
| `regionsApi` | CRUD |
| `costCentersApi` | CRUD |
| `fiscalYearsApi` | CRUD |
| `numberSeriesApi` | CRUD |
| `paymentTermsApi` | CRUD |
| `currencyManagementApi` | CRUD + exchange rates |
| `teamsApi` | CRUD |
| `whatsappAutomationApi` | getSessions, startSession, logoutSession, getContacts, syncContacts, getChatMessages, sendMessage, sendMedia, getActiveChats |
| `utilsApi` | lookupPincode |

---

## 29. Configuration & Environment Variables

### Backend `.env`

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | — | Redis connection string |
| `MINIO_ENDPOINT` | localhost:9000 | MinIO server address |
| `MINIO_ACCESS_KEY` | — | MinIO access key |
| `MINIO_SECRET_KEY` | — | MinIO secret key |
| `MINIO_BUCKET` | businessosai | Default bucket name |
| `SUPABASE_URL` | — | Supabase project URL |
| `SUPABASE_KEY` | — | Supabase anon/service key |
| `RESEND_API_KEY` | — | Resend email API key |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | — | Anthropic Claude API key |
| `GOOGLE_API_KEY` | — | Google Gemini API key |
| `RAZORPAY_KEY_ID` | — | Razorpay key ID |
| `RAZORPAY_KEY_SECRET` | — | Razorpay key secret |
| `WHATSAPP_GATEWAY_URL` | http://127.0.0.1:8005 | WhatsApp gateway URL |
| `SECRET_KEY` | — | JWT signing secret |
| `CORS_ORIGINS` | http://localhost:3000 | Allowed CORS origins |
| `RATE_LIMIT_REQUESTS` | 100 | Rate limit per window |
| `RATE_LIMIT_WINDOW` | 60 | Rate limit window (seconds) |
| `ENVIRONMENT` | development | Environment (dev/staging/prod) |
| `LOG_LEVEL` | INFO | Logging level |

### WhatsApp Gateway `.env`

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 8005 | Express server listen port |
| `PUPPETEER_EXECUTABLE_PATH` | auto-detected | Custom Chrome/Chromium binary |
| `FASTAPI_WEBHOOK_URL` | http://localhost:8000/api/v1/whatsapp-automation/webhook | Inbound webhook URL |

### Frontend `.env.local`

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | http://localhost:8000 | Backend API URL |
| `NEXT_PUBLIC_SUPABASE_URL` | — | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | Supabase anon key |

---

## 30. WhatsApp Gateway (Node.js)

### Architecture
The WhatsApp Gateway is a standalone Node.js Express server that acts as a bridge between WhatsApp (via whatsapp-web.js) and the FastAPI backend.

### Key Design Decisions
- **Per-Session Clients**: Each WhatsApp number runs its own Puppeteer/Chromium instance
- **Local Auth Strategy**: Each session has its own Chromium profile directory
- **Crash Resilience**: Global error handlers suppress Puppeteer-related errors
- **Session Persistence**: `sessions.json` tracks active sessions; auto-restored on restart
- **No Inbound Media**: Text messages only forwarded to backend; media sent outbound only

### Startup Flow
1. Read `sessions.json` for saved sessions
2. Auto-initialize all saved sessions
3. Start Express server on configured port

### Session Lifecycle
```
startClient()
  ├── Sanitize session ID (digits only)
  ├── Check if already active → skip if connected
  ├── Destroy stale client
  ├── Clean stale lock files
  ├── Create new Client with LocalAuth
  ├── Start 60s watchdog timer
  └── client.initialize()
         ├── loading_screen → log progress
         ├── qr → base64 QR → status = QR_READY
         ├── authenticated → clear watchdog → status = AUTHENTICATED
         ├── ready → store client.info → persist session → status = CONNECTED
         ├── auth_failure → status = DISCONNECTED → destroy
         └── disconnected → status = DISCONNECTED → cleanup
```

---

## 31. Development Guidelines

### Adding a New Backend Endpoint
1. Define Pydantic schema in `schemas/` or inline in the route file
2. Add route with `@router.method()` + permission check via `Depends(require_permission("..."))`
3. Use `Depends(get_db)` for database session
4. Always filter by `tenant_id = ctx.tenant_id`
5. Use `flag_modified(tenant, "settings")` after modifying JSON columns
6. Add corresponding method in `frontend/src/lib/api-client.ts`

### Adding a New Frontend Component
1. Check if API method exists in `lib/api-client.ts` (add if not)
2. Place component in appropriate `components/{module}/` folder
3. Use shadcn UI components for base elements
4. Follow Tailwind styling conventions from RULES.md
5. Add route in `routes/` folder using TanStack Router conventions
6. Use `@/` path alias for imports

### Working with the Database
1. Models in `backend/src/models/`
2. New model: Create class extending `Base`, add to `__init__.py` imports
3. Create migration: `alembic revision --autogenerate -m "description"`
4. Apply: `alembic upgrade head`
5. All queries must filter by `tenant_id`

### Running the Application
```bash
# Terminal 1: Backend
cd backend
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000

# Terminal 2: WhatsApp Gateway
cd backend/whatsapp_gateway
npm install
node index.js

# Terminal 3: Frontend
cd frontend
npm install
npm run dev
```

---

## 32. Common Gotchas

1. **Phone Numbers**: Always clean to digits-only before DB operations (no `+`, no spaces)
2. **Tenant Isolation**: Every query MUST filter by `tenant_id = ctx.tenant_id`
3. **JSON Fields**: Use `flag_modified(tenant, "settings")` after modifying JSON columns
4. **WhatsApp Gateway URL**: Always use `127.0.0.1` not `localhost` (Windows IPv6 issue)
5. **Pydantic Aliases**: `from_` field uses `Field(alias="from")` with `populate_by_name=True`
6. **Frontend Imports**: Always use `@/` path alias (not relative paths)
7. **Form Submissions**: Always wrap in try/catch with loading state
8. **Media Uploads**: Base64 data does NOT include the `data:image/...;base64,` prefix when sending to backend
9. **Rate Limiting**: Backend enforces rate limits via Redis (100 requests per 60s default)
10. **Puppeteer Errors**: Gateway has global error handlers — don't remove them
11. **TanStack Router**: Route groups use `_app.*` naming convention (not `_app/` directory)
12. **TanStack Query**: 5-minute stale time, no refetch on window focus by default

---

## Appendix A: Database Migration Commands

```bash
# Create new migration
cd backend
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# Show current revision
alembic current

# Show migration history
alembic history
```

## Appendix B: Testing Checklist

```bash
# 1. Verify backend health
curl http://localhost:8000/health

# 2. Verify gateway
curl http://localhost:8005/sessions

# 3. Create test tenant + user via signup page
# http://localhost:3000/register

# 4. Test WhatsApp session
curl -X POST http://localhost:8005/sessions/919912345678/start

# 5. Check session status
curl http://localhost:8005/sessions
```

## Appendix C: Project Structure

```
LazyMonkeyAI/
├── ARCHITECTURE.md
├── CLAUDE.md
├── RULES.md
├── SKILLS.md
├── BUSINESSOSAI_DOCUMENTATION.md  ← This file
├── backend/
│   ├── .env
│   ├── src/
│   │   ├── main.py
│   │   ├── database/
│   │   │   ├── base.py
│   │   │   └── session.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── crm.py
│   │   │   ├── erp.py
│   │   │   ├── inventory.py
│   │   │   ├── hrms.py
│   │   │   ├── procurement.py
│   │   │   ├── marketplace.py
│   │   │   ├── payment_reminders.py
│   │   │   ├── storefront.py
│   │   │   └── ...
│   │   ├── schemas/
│   │   ├── services/
│   │   └── api/v1/
│   │       ├── auth.py
│   │       ├── crm.py
│   │       ├── erp.py
│   │       ├── crm_modules/
│   │       │   ├── whatsapp_automation.py
│   │       │   ├── discounts.py
│   │       │   ├── loyalty.py
│   │       │   ├── memberships.py
│   │       │   ├── segments.py
│   │       │   ├── groups.py
│   │       │   └── wallet.py
│   │       └── ...
│   └── whatsapp_gateway/
│       ├── index.js
│       ├── package.json
│       └── sessions.json
├── frontend/
│   ├── .env.local
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login.tsx
│   │   │   │   ├── register.tsx
│   │   │   │   ├── change-password.tsx
│   │   │   │   ├── role-select.tsx
│   │   │   │   └── platform-admin.tsx
│   │   │   └── (_app)/
│   │   │       ├── _app.tsx
│   │   │       ├── _app.dashboard.tsx
│   │   │       ├── _app.crm.tsx
│   │   │       ├── _app.inventory.tsx
│   │   │       ├── _app.procurement.tsx
│   │   │       ├── _app.accounting.tsx
│   │   │       ├── _app.hrms.tsx
│   │   │       ├── _app.pos.tsx
│   │   │       ├── _app.erp.tsx
│   │   │       ├── _app.warehouse.tsx
│   │   │       ├── _app.copilot.tsx
│   │   │       ├── _app.marketplace.tsx
│   │   │       ├── _app.iot.tsx
│   │   │       ├── _app.settings.tsx
│   │   │       └── _app.reports.tsx
│   │   ├── routes/
│   │   │   ├── __root.tsx
│   │   │   ├── index.tsx
│   │   │   ├── login.tsx
│   │   │   ├── store.* (storefront routes)
│   │   │   ├── vault.* (document download)
│   │   │   └── ...
│   │   ├── components/
│   │   │   ├── crm/
│   │   │   ├── erp/
│   │   │   ├── hrms/
│   │   │   ├── inventory/
│   │   │   ├── pos/
│   │   │   ├── procurement/
│   │   │   ├── marketplace/
│   │   │   ├── meta/
│   │   │   ├── whatsapp/
│   │   │   ├── chatbot/
│   │   │   ├── reports/
│   │   │   ├── accounting/
│   │   │   ├── storefront/
│   │   │   ├── superapp/
│   │   │   ├── common/
│   │   │   ├── settings/
│   │   │   ├── admin/
│   │   │   ├── ui/
│   │   │   ├── layout/
│   │   │   ├── dashboard/
│   │   │   ├── shared/
│   │   │   ├── coming-soon.tsx
│   │   │   └── unauthorized.tsx
│   │   ├── contexts/
│   │   │   ├── auth-context.tsx
│   │   │   ├── tenant-context.tsx
│   │   │   ├── rbac-context.tsx
│   │   │   ├── theme-context.tsx
│   │   │   ├── i18n-context.tsx
│   │   │   ├── StoreCartContext.tsx
│   │   │   └── StoreWishlistContext.tsx
│   │   ├── hooks/
│   │   │   ├── use-currency.ts
│   │   │   ├── use-mobile.tsx
│   │   │   ├── use-pincode-lookup.ts
│   │   │   ├── useHrmsData.ts
│   │   │   ├── useCrmData.ts
│   │   │   └── useHardwareBarcodeScanner.ts
│   │   ├── lib/
│   │   │   ├── api-client.ts      # 5,648 lines — central API layer
│   │   │   ├── utils.ts
│   │   │   └── ...
│   │   └── types/                  # (types are inline in api-client.ts)
│   └── package.json
└── migrations/
```

---

*End of Documentation — Version 2.0*
