# BusinessOSAI — Complete Modules & Functionalities Documentation

> **Last Updated:** 2026-09-10 | **Version:** 1.0 (Backend branch)

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Multi-Tenancy & RBAC Foundation](#3-multi-tenancy--rbac-foundation)
4. [Organization Management](#4-organization-management)
5. [Authentication & Security](#5-authentication--security)
6. [CRM Module](#6-crm-module)
7. [WhatsApp Automation](#7-whatsapp-automation)
8. [POS (Point of Sale)](#8-pos-point-of-sale)
9. [Inventory Management](#9-inventory-management)
10. [ERP — Accounting & Finance](#10-erp--accounting--finance)
11. [ERP — Invoicing & Tax Compliance](#11-erp--invoicing--tax-compliance)
12. [Procurement & Supplier Management](#12-procurement--supplier-management)
13. [HRMS Module](#13-hrms-module)
14. [Marketplace](#14-marketplace)
15. [Storefront](#15-storefront)
16. [Workflow Engine & Automation](#16-workflow-engine--automation)
17. [AI & Intelligence](#17-ai--intelligence)
18. [Meta Ads Integration](#18-meta-ads-integration)
19. [Payment Processing](#19-payment-processing)
20. [Notifications & Communications](#20-notifications--communications)
21. [Reporting & Analytics](#21-reporting--analytics)
22. [System Administration](#22-system-administration)
23. [Database Schema Reference](#23-database-schema-reference)
24. [API Route Map](#24-api-route-map)
25. [Key Integration Points](#25-key-integration-points)

---

## 1. System Architecture Overview

BusinessOSAI is a **full-stack, multi-tenant business management platform** combining CRM, ERP, HRMS, POS, Inventory, and AI automation with WhatsApp integration. It is designed for small-to-medium businesses to manage customers, sales, finances, and communication in one system.

### Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js + React + TypeScript)  — Port 3000       │
│  shadcn/ui, Tailwind CSS, Framer Motion, Recharts           │
├─────────────────────────────────────────────────────────────┤
│  BACKEND (FastAPI + SQLAlchemy + AsyncPG)  — Port 8000      │
│  Pydantic schemas, JWT auth, RBAC, Redis caching            │
├─────────────────────────────────────────────────────────────┤
│  WHATSAPP GATEWAY (Node.js + whatsapp-web.js) — Port 8005   │
│  Manages WhatsApp sessions, sends/receives messages         │
├─────────────────────────────────────────────────────────────┤
│  DATA LAYER                                                  │
│  PostgreSQL (primary DB) │ Redis (cache/rate-limit)          │
│  MinIO (file storage)    │ Supabase (optional)               │
└─────────────────────────────────────────────────────────────┘
```

### Core Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Multi-Tenancy** | Every table carries `tenant_id` for strict row-level isolation |
| **RBAC** | Role-based permissions via `UserRole` → `Role` → `RolePermission` → `Permission` |
| **Company Scoping** | Many entities also scoped by `company_id` within a tenant |
| **Soft Deletes** | `EntityStatus` enum: `active`, `inactive`, `suspended` |
| **Audit Trail** | `AuditLog` and `ActivityLog` tables capture all changes |
| **UUID Primary Keys** | All entities use UUID v4 for distributed-safety |

---

## 2. Technology Stack

### Backend
| Component | Technology |
|-----------|-----------|
| **Framework** | FastAPI (Python 3.11+) |
| **ORM** | SQLAlchemy 2.x (async) |
| **Database** | PostgreSQL (asyncpg driver) |
| **Cache/Rate Limit** | Redis |
| **Auth** | JWT (access + refresh tokens), Passkey (WebAuthn/FIDO2), Fingerprint |
| **File Storage** | MinIO (S3-compatible) |
| **Email** | Resend API |
| **AI/LLM** | OpenAI, Anthropic (Claude), Google Gemini |
| **WhatsApp** | whatsapp-web.js (via Node.js gateway + httpx proxy) |
| **Payments** | Razorpay, Pine Labs |
| **GST/e-Invoice** | WhiteBooks GSP integration |
| **Migrations** | Alembic |
| **Testing** | pytest (no CI enforcement yet) |

### Frontend
| Component | Technology |
|-----------|-----------|
| **Framework** | Next.js (App Router) |
| **Language** | TypeScript |
| **UI Library** | shadcn/ui + Radix primitives |
| **Styling** | Tailwind CSS |
| **Animations** | Framer Motion |
| **Charts** | Recharts |
| **PDF** | react-pdf |
| **Spreadsheets** | xlsx (SheetJS) |
| **State** | React Context (AuthProvider) |
| **HTTP** | Custom fetch wrapper with axios patterns |

### Infrastructure
| Component | Technology |
|-----------|-----------|
| **Containerization** | Docker + Docker Compose (planned, not yet in repo) |
| **Process Manager** | Manual terminal sessions (3 separate processes) |
| **Reverse Proxy** | Nginx (planned for production) |

---

## 3. Multi-Tenancy & RBAC Foundation

### Tenant Hierarchy

```
Tenant (organization)
 └── Company (legal entity, can have multiple per tenant)
      ├── Region
      │    └── Zone
      │         └── Branch (physical location)
      │              └── Team
      └── Department
           └── Cost Center
```

### RBAC Model

```
User
 └── UserRole (scoped to company + branch)
      └── Role
           ├── RolePermission → Permission (module + code)
           └── [system roles: Tenant Owner, Manager, Agent, etc.]
```

### Permission Codes

Every route is protected by `require_permission("module.action")`. Permissions are stored in the `permissions` table with `code`, `name`, `module`, and `description` fields.

---

## 4. Organization Management

### Entities

| Entity | Purpose |
|--------|---------|
| **Tenant** | Top-level organization account; holds plan, status (trial/active/cancelled), max users/branches, settings (JSONB) |
| **Company** | Legal entity within a tenant; holds GST, PAN, address, currency, fiscal year settings, email config, Google reviews |
| **BusinessUnit** | Logical business unit within a company |
| **Region** | Geographic region (country-level grouping) |
| **Zone** | Sub-region within a region |
| **Branch** | Physical location with geofence, warehouse flag, working hours |
| **Department** | Organizational department (can be hierarchical via `parent_id`) |
| **Designation** | Job title with level |
| **Team** | Group within a department, optionally at a branch |
| **CostCenter** | Budget tracking entity within a department |
| **FiscalYear** | Financial year definition with open/locked/closed status |
| **Workspace** | User workspace with theme, language, timezone preferences |
| **NumberSeries** | Auto-incrementing number prefixes per module (e.g., INV-, PO-) |

---

## 5. Authentication & Security

### Authentication Methods

| Method | Description |
|--------|-------------|
| **Email/Password** | Standard JWT-based auth with bcrypt password hashing |
| **Google OAuth 2.0** | SSO via Google (OAuth2Session from authlib) |
| **Passkey (WebAuthn/FIDO2)** | Touch ID, Face ID, Windows Hello biometric login |
| **Fingerprint** | Optical/capacitive fingerprint via USB devices (Mantra, Morpho, SecuGen, Startek) |

### Security Features

| Feature | Details |
|---------|---------|
| **JWT Access Tokens** | Short-lived, signed with HS256 |
| **Refresh Tokens** | Long-lived, stored hashed in DB, revocable |
| **MFA Policy** | Per-role MFA enforcement with timeout and IP restrictions |
| **Account Lockout** | After failed login attempts, account locks for duration |
| **Password Policy** | Force change on first login, hashed with passlib |
| **Session Management** | Multi-role selection per session (users can have multiple roles) |

### Key Endpoints
```
POST   /api/v1/auth/register          — Tenant self-registration
POST   /api/v1/auth/login             — Email/password login
POST   /api/v1/auth/refresh           — Refresh access token
POST   /api/v1/auth/select-role       — Switch active role
POST   /api/v1/auth/google            — Google OAuth callback
GET    /api/v1/auth/me                — Current user profile
POST   /api/v1/auth/change-password   — Change password
POST   /api/v1/auth/passkey/register  — Register WebAuthn passkey
POST   /api/v1/auth/passkey/verify    — Verify passkey login
POST   /api/v1/auth/fingerprint/enroll — Enroll fingerprint
POST   /api/v1/auth/fingerprint/verify — Verify fingerprint login
```

---

## 6. CRM Module

### Sub-Modules

#### 6.1 Customer Management (`CrmCustomer`)
- Full customer profiles with GST, PAN, addresses, preferences
- Multiple addresses (billing, shipping), customer type (Retail/Wholesale)
- Credit limit management, customer source tracking
- Integration with leads (lead → customer conversion)

#### 6.2 Lead Management (`Lead`)
- Lead pipeline with stages: New → Contacted → Qualified → Proposal → Negotiation → Won/Lost
- AI scoring (`ai_score`) and sentiment analysis (`ai_sentiment`)
- External lead import (Facebook/Meta Ads integration)
- Lead activities tracking (calls, meetings, follow-ups)
- Call disposition, duration, customer response tracking

#### 6.3 Opportunity / Deal Pipeline (`CRMOpportunity`)
- Kanban-style pipeline with stages (Prospecting → Qualification → Proposal → Negotiation → Closed Won/Lost)
- Probability scoring, expected close date, forecast category
- Next step scheduling, call tracking integration

#### 6.4 Customer Groups (`CustomerGroup`)
- Static or dynamic customer grouping
- Member management with add/remove operations

#### 6.5 Customer Segments (`CustomerSegment`)
- Rule-based dynamic segmentation (JSONB rules engine)
- Match types: all/any conditions
- Auto-count of matching customers

#### 6.6 Memberships (`MembershipPlan` + `CustomerMembership`)
- Tiered membership plans with perks (JSONB)
- Validity period management
- Customer membership assignment and tracking

#### 6.7 Wallet (`CustomerWallet` + `CustomerWalletTransaction`)
- Customer prepaid wallet with balance tracking
- Transaction types: top-up, payment, refund
- Reference linking to invoices/orders

#### 6.8 Loyalty Program (`LoyaltyProgram` + `LoyaltyTransaction`)
- Points-per-amount earning configuration
- Points redemption with minimum threshold
- Transaction history with balance tracking

#### 6.9 Discounts (`Discount`)
- Promo codes (percentage or fixed amount)
- Min order amount, max discount caps
- Usage limits, start/expiry dates
- Per-customer or global applicability

#### 6.10 Quotations (`CRMQuotation`)
- Quote creation with product line items (JSONB)
- Status flow: Draft → Sent → Accepted → Declined → Expired
- Auto-numbering via number series

#### 6.11 Sales Orders (`CRMSalesOrder`)
- Order creation linked to customer
- Status flow: Pending → Processing → Shipped → Delivered → Cancelled
- Payment status tracking (Unpaid/Partially Paid/Paid)
- Item management via JSONB

#### 6.12 Support Tickets (`CRMSupportTicket`)
- Ticket creation with priority (Low/Medium/High)
- Status flow: Open → In Progress → Resolved → Closed
- AI-generated summaries

#### 6.13 Call Logs (`CRMCallLog`)
- AI voice/telephony call records
- Call modes: browser_ai, livekit_sip, webrtc
- Transcript storage with sentiment analysis
- Qualification scoring, action items, recording URLs

#### 6.14 Campaigns (Email)
- `EmailCampaign` — Campaign execution logs with HTML body
- `EmailTemplate` — Reusable email templates
- Target categories: employees, candidates, customers, others

#### 6.15 Ad Asset Library (`AdAsset`)
- AI-generated creative assets (Gemini/OpenAI/Claude)
- Aspect ratio tracking, style tags, approval workflow
- Usage tracking (organic post, paid campaign)

#### 6.16 Paid Ads (`PaidAd`)
- Meta Ads (Facebook/Instagram) campaign tracking
- Budget, spend, impressions, clicks tracking
- Campaign status management

---

## 7. WhatsApp Automation

### Architecture
```
Frontend → FastAPI (proxy) → Node.js Gateway (port 8005) → WhatsApp Cloud
```

### Features
| Feature | Description |
|---------|-------------|
| **Session Management** | Start/stop/connect WhatsApp sessions by phone number |
| **Send Messages** | Text messages to any phone number |
| **Send Media** | Images, PDFs with captions (base64 encoded) |
| **Contact Sync** | Sync WhatsApp contacts |
| **Webhook** | Inbound message handler that creates leads/activities |
| **LID Resolution** | Resolves WhatsApp Linked IDs (newer format) |
| **Invoice Sending** | Direct invoice PDF delivery via WhatsApp |
| **Quotation Sending** | Send quotations as PDFs |

### Gateway (Node.js)
- Uses `whatsapp-web.js` with Puppeteer
- Session persistence via `.wwebjs_auth` directory
- CORS-enabled, handles large payloads (50MB limit)
- Auto-reconnection, crash prevention for Puppeteer errors

### Backend Proxy Routes
```
POST   /api/v1/whatsapp-automation/webhook         — Inbound messages (called by gateway)
POST   /api/v1/whatsapp-automation/send            — Send text message
POST   /api/v1/whatsapp-automation/send-media      — Send image/PDF with caption
POST   /api/v1/whatsapp-automation/sync-contacts   — Sync contact list
GET    /api/v1/whatsapp-automation/sessions        — List active sessions
POST   /api/v1/whatsapp-automation/sessions/{phone}/start  — Start session
DELETE /api/v1/whatsapp-automation/sessions/{phone}/stop   — Stop session
```

---

## 8. POS (Point of Sale)

### POS Sessions (`POSSession`)
- Open/close cashier sessions
- Starting cash, expected cash, actual cash reconciliation
- Discrepancy tracking with reasons

### POS Transactions (`POSTransaction`)
- Transaction creation with multiple items
- Payment methods: Cash, Card, Online, Gift Card
- Multi-payment support per transaction
- Parent transaction linking (for returns/refunds)
- Delivery status tracking
- Receipt number auto-generation

### POS Products (`POSProduct`)
- Quick product lookup for POS
- Price overrides at transaction level
- Stock validation

### Free Qty Rules (`FreeQtyRule`)
- Buy-X-get-Y-free promotions
- Auto-apply free quantities to transactions

---

## 9. Inventory Management

### Core Entities

| Entity | Description |
|--------|-------------|
| **Product** | Master product with SKU, barcode, HSN code, pricing (purchase/MRP/selling/wholesale/B2B), tax, specifications |
| **ProductCategory** | Hierarchical categories (parent/child) |
| **Brand** | Product brand management |
| **UnitOfMeasure** | UOM definitions with conversion rates |
| **MasterCatalogProduct** | Unified catalog combining category + brand + product |

### Extended Product Features

| Feature | Description |
|---------|-------------|
| **Product Variants** | Size, color, material variants with unique SKUs |
| **Product Images** | Multiple images per product |
| **Product Attributes** | Custom key-value attributes |
| **Product Bundles** | Pre-configured product bundles |
| **Product Kits** | Kit assembly with component tracking |
| **Product Identifiers** | Serial numbers, batch numbers, lot tracking |
| **Barcode Scanner** | Barcode-based inventory operations |

### Warehouse Management

| Feature | Description |
|---------|-------------|
| **Warehouse** | Multi-warehouse support with capacity, temperature control, manager |
| **Storage Location** | Zone → Aisle → Rack → Shelf → Bin hierarchy |
| **Put-Away Rules** | Automated storage location assignment |
| **Picking Rules** | Optimized picking strategies |

### Stock Operations

| Feature | Description |
|---------|-------------|
| **Stock Movement** | Track all stock transfers, adjustments |
| **Stock Adjustment** | Manual stock corrections with audit trail |
| **Cycle Counting** | Scheduled inventory counts with variance tracking |
| **Goods Receipt** | Inbound receipt from purchase orders |
| **Goods Issue** | Outbound dispatch tracking |
| **Inventory Batch** | Batch-level tracking with expiry |
| **Inventory Serial** | Serial number tracking |
| **Traceability** | Full traceability chain (lot → movement → destination) |

### Inventory Intelligence
- AI-powered demand forecasting
- Reorder point alerts
- Slow-moving stock identification
- Stock aging analysis

---

## 10. ERP — Accounting & Finance

### Chart of Accounts (`ChartOfAccount`)
- Five account types: Asset, Liability, Equity, Income, Expense
- Sub-types: Current Asset, Fixed Asset, Inventory, Bank, Cash, Receivable, Payable, etc.
- Parent-child account hierarchy
- Account grouping for reporting

### Journal Entries (`JournalEntry` + `JournalEntryLine`)
- Entry types: Journal, Receipt, Payment, Contra, Purchase, Sales, Credit Note, Debit Note
- Status: Draft → Posted → Voided → Reversed
- Multi-line entries with debit/credit balancing
- Auto-numbering via number series

### Bank Management
- Bank account master with opening balances
- Bank reconciliation support
- Cheque printing and tracking
- Deposit/payment slip generation

### Financial Reports
- **Trial Balance** — Debit/credit summary
- **Profit & Loss** — Income statement
- **Balance Sheet** — Asset/liability snapshot
- **Cash Flow** — Operating, investing, financing
- **Custom Reports** — Ad-hoc report builder

### Budget Management (`Budget`)
- Budget creation per department/cost center
- Budget vs. actual tracking
- Period-based budgets (monthly, quarterly, annual)

### Expense Claims (`ExpenseClaim`)
- Employee expense submission with receipts
- Approval workflow integration
- Status: Draft → Submitted → Approved/Rejected → Paid

### Fixed Assets (`FixedAsset` + `FixedAssetCategory` + `FixedAssetDepreciation`)
- Asset registration with purchase details
- Depreciation calculation (straight-line, reducing balance)
- Asset categories with useful life
- Disposal tracking

### Payment Reminders (`PaymentReminderPolicy` + `PaymentReminderLog`)
- Automated payment reminder engine
- Configurable pre-due and overdue reminder schedules
- Multi-channel: Email, WhatsApp, SMS
- Penalty calculation (percentage, fixed, daily percentage)
- Max reminder limits to avoid harassment

---

## 11. ERP — Invoicing & Tax Compliance

### Invoices (`Invoice` + `InvoiceLine` + `InvoicePayment` + `InvoiceReturn`)
- Invoice types: Tax Invoice, Proforma, Estimate, Credit Note, Debit Note
- Auto-numbering, tax calculation (CGST/SGST/IGST)
- Payment recording with multiple methods
- Invoice returns/credit notes
- PDF generation with customizable templates
- Invoice statuses: Draft → Sent → Viewed → Partially Paid → Paid → Overdue → Voided

### GST Features
- **GST Registration** — Multiple GSTINs per company (primary + additional)
- **GST Tax Configuration** — CGST/SGST/IGST rate setup per product/category
- **e-Way Bill** — Generation and management for goods transport
- **e-Invoice** — IRN generation via WhiteBooks GSP
- **GST Filing** — GSTR-1, GSTR-3B preparation and filing

### Tax Management
- `TaxConfiguration` — Per-company tax rate setup
- `TaxCode` — Detailed tax code definitions
- `TaxReturn` — Tax period tracking and filing
- `TaxPayment` — Tax payment recording

### Delivery Challan (`DeliveryChallan` + `DeliveryChallanItem`)
- Pre-invoice delivery documentation
- Linked to invoices
- Item-level tracking

### Document Templates
- Customizable PDF/Word/Excel templates for invoices, POs, receipts
- HTML/Jinja2 template engine
- Variable substitution
- Default template selection per document type

---

## 12. Procurement & Supplier Management

### Supplier Management
| Entity | Description |
|--------|-------------|
| **Supplier** | Master supplier with credit limit, rating, type, contacts |
| **SupplierCategory** | Category classification |
| **SupplierContact** | Multiple contacts per supplier |
| **SupplierContract** | Contract management with terms, validity |
| **SupplierPerformance** | Performance tracking with scores |
| **BlacklistedSupplier** | Blacklist with reason tracking |

### Purchase Orders (`PurchaseOrder` + `PurchaseOrderItem`)
- PO creation linked to supplier
- Item-level quantity, price, delivery dates
- Approval workflow
- Status: Draft → Sent → Acknowledged → Partial → Complete → Cancelled

### Vendor Bills (`VendorBill` + `VendorBillItem`)
- Bill entry from suppliers
- Matching against POs
- Payment tracking

### GRN (Goods Receipt Note)
- Receiving goods against PO
- Quality check tracking
- Stock auto-update on receipt

---

## 13. HRMS Module

### 13.1 Employee Management
- Employee profiles with code, personal info, employment type
- Hierarchical org structure (manager → reports)
- Designation, department, branch assignment
- Employee documents (contracts, ID proofs, compliance docs)
- Status tracking: Active, On Leave, Inactive

### 13.2 Attendance
- Multiple punch methods: GPS, Biometric, Face Recognition, Web, Manual
- Geofence-verified attendance (GPS coordinates + radius check)
- Attendance records with check-in/out, hours worked
- Status: Present, Absent, Late, Half Day, On Leave
- Attendance corrections with approval workflow
- Biometric device management
- Face recognition logs with confidence scores

### 13.3 Leave Management
- Leave types: Annual, Sick, Casual, Maternity, Unpaid
- Leave requests with date range and reason
- Leave balance tracking per employee per type
- Leave policies (entitled days, applicability)

### 13.4 Payroll
- Salary structure: Basic, HRA, allowances, deductions (PF, ESI, TDS)
- Payslip generation (Processing → Paid)
- Payslip templates with customizable themes
- Pay grades per designation
- Salary advances with recovery tracking
- Employee loans (Personal, Emergency, Vehicle, Home, Education) with EMI
- Employee bonuses (Festive, Performance, Milestone, Spot, Retention)
- Sales commissions with progressive/tier/flat calculation modes
- Commission slab plans with milestone bonuses

### 13.5 Recruitment
- Job openings with posting to multiple portals
- Applicant tracking (Applied → Screening → Interview → Offer → Hired/Rejected)
- AI-powered CV parsing and match scoring
- Interview scheduling with calendar
- Offer letter generation and e-signature
- Onboarding task tracking

### 13.6 Performance Management
- Goal setting with progress tracking
- KPI dashboards
- Performance appraisals (self + manager scoring)
- Performance incentives
- Review cycles (H1/H2)

### 13.7 Learning & Development
- Course catalog with enrollment tracking
- Certificates with expiry tracking
- Assessments with scoring

### 13.8 Exit Management
- Resignation tracking
- Exit clearance tasks (IT, Finance, HR handovers)
- Final settlement calculation
- Experience letter issuance

### 13.9 HR Intelligence
- Headcount analytics
- Turnover analysis
- Attendance patterns
- Salary insights

---

## 14. Marketplace

### Marketplace Vendors (`MarketplaceVendor`)
- Vendor onboarding with KYC
- Commission rate configuration
- Escrow balance tracking
- Vendor performance metrics

### Marketplace Products (`MarketplaceProduct`)
- Product listing by vendors
- Approval workflow (Pending → Approved/Rejected)
- Featured product flagging
- Inventory sync with main system

### Marketplace Orders (`MarketplaceOrder`)
- Order placement and tracking
- Multi-vendor order splitting
- Fulfillment status: Pending Pick → Packed → Ready to Ship → Shipped → Delivered
- Platform commission calculation
- Payment status tracking
- Delivery partner integration

### Marketplace Payouts (`MarketplacePayout`)
- Vendor payout management
- Commission deduction
- Escrow release

### Marketplace Promotions (`MarketplacePromotion`)
- Discount campaigns
- Featured placement

---

## 15. Storefront

### Storefront Wallet (`StorefrontWallet`)
- Customer wallet with fiat balance + OS Coins (loyalty currency)
- Membership tiers
- Transaction history

### Storefront Journey (`StorefrontJourney`)
- Customer onboarding/progress tracking
- Milestone-based journey with actions

### Storefront Notifications (`StorefrontNotification`)
- In-app notifications for storefront users
- Category-based targeting

### Storefront Wishlist (`StorefrontWishlist`)
- Product wishlist per user
- Linked to ERP products

---

## 16. Workflow Engine & Automation

### Approval Workflows (`ApprovalWorkflow`)
- Multi-level approval definitions per module
- Step configuration: level, approver role/user, timeout hours
- Module-specific workflows (expenses, leave, purchase orders, etc.)

### Automation Rules (`AutomationRule`)
- Trigger-action rules: `trigger_event` + `conditions` → `actions`
- Module-specific automation
- JSONB-based conditions and actions
- Run count and last run tracking

### Notification Templates (`NotificationTemplate`)
- Email, SMS, In-App templates
- Variable substitution support
- Event-based triggering

### Document Templates (`DocumentTemplate`)
- PDF, Word, Excel template definitions
- HTML/Jinja2 content
- Per-document-type defaults

---

## 17. AI & Intelligence

### RAG Enricher
- Retrieval-Augmented Generation for CRM context
- Product/customer context enrichment
- **Currently paused** (`.rag_enricher_paused` file exists)

### CRM Intelligence
- AI lead scoring based on behavior
- Sentiment analysis on communications
- Next-best-action suggestions
- Predictive deal closure probability

### Telephony Service
- AI voice calling (browser_ai, livekit_sip, webrtc modes)
- Agent persona configuration
- Call transcription with speaker diarization
- Sentiment extraction from calls
- Qualification scoring

### Meta Ads Integration
- Facebook/Instagram ad campaign sync
- Lead import from Facebook Lead Ads
- Ad creative generation via AI (Gemini/OpenAI/Claude)

---

## 18. Meta Ads Integration

### Features
- OAuth connection to Facebook Ads account
- Campaign metric sync (spend, impressions, clicks, leads)
- Lead import into CRM as leads
- Ad asset library (AI-generated creatives)
- Paid ad performance tracking in CRM

### Services
- `meta_ads.py` — Meta Ads API integration
- `facebook.py` — Facebook Graph API
- `facebook_lead_import_service.py` — Automated lead import

---

## 19. Payment Processing

### Payment Gateway Configuration
- Multi-gateway support: Razorpay, Pine Labs, Stripe (planned), PhonePe (planned)
- Per-company gateway configuration
- Test/production mode toggle
- Credential management (JSONB)

### Supported Payment Methods
| Method | Gateway | Use Case |
|--------|---------|----------|
| **Razorpay** | Razorpay | Online payments, payment links |
| **Pine Labs** | Pine Labs | Card terminal, UPI |
| **Cash** | N/A | POS cash transactions |
| **Card** | N/A | POS card swipes |
| **Online** | N/A | Online payment links |
| **Gift Card** | N/A | Gift card redemption |

### Payment Features
- Invoice payment recording
- Payment link generation
- Refund processing
- Multi-method split payments

---

## 20. Notifications & Communications

### Push Notifications
- Web Push (Service Worker), FCM (Android), APNs (iOS)
- Device token management per user
- Template-based notification dispatch
- Category-based targeting (HRMS, CRM, POS, Inventory, System)
- Broadcast with role/department/individual targeting

### Live Notifications
- Real-time in-app notifications
- Event-driven: submission alerts, approvals, reminders
- Unread status tracking

### Email
- SMTP configuration per company
- Resend API integration
- Template-based email sending
- Campaign execution

### WhatsApp Notifications
- Invoice delivery via WhatsApp
- Payment reminders via WhatsApp
- Quotation sharing via WhatsApp

---

## 21. Reporting & Analytics

### Report Modules

| Report | Data Sources |
|--------|-------------|
| **Sales Reports** | CRM leads, opportunities, invoices, POS transactions |
| **Inventory Reports** | Stock levels, movements, cycle counts, valuation |
| **Purchase Reports** | Purchase orders, vendor bills, GRN |
| **HR Reports** | Attendance, leaves, payroll, headcount |
| **Financial Reports** | P&L, Balance Sheet, Cash Flow, Trial Balance |
| **GST Reports** | GSTR summary, tax liability |
| **Marketplace Reports** | Vendor performance, order analytics |

### Export Formats
- CSV (client-side)
- PDF (server-side via report templates)
- Excel (via SheetJS)

---

## 22. System Administration

### System Admin Features

| Feature | Description |
|---------|-------------|
| **Tenant Management** | Create, suspend, upgrade tenants |
| **User Management** | Create users, assign roles, manage status |
| **Role Management** | Create custom roles, assign permissions |
| **System Health** | Database connectivity check, service status |
| **Error Logs** | Application error tracking |
| **Backup** | Database backup management |
| **System Settings** | Key-value configuration per tenant |

### System Settings Categories
- General settings
- Email configuration
- WhatsApp configuration
- Payment gateway defaults
- Feature flags

### Master Data
- Geography (countries, states, cities)
- Locations (warehouses, offices, sites)
- Work calendars (shift patterns, holidays)
- Tags (entity categorization)

### Custom Fields
- Tenant-defined custom fields for any entity type
- Supported types: text, number, date, dropdown, checkbox
- Required/optional with default values

---

## 23. Database Schema Reference

### Model Files
| File | Modules Covered |
|------|----------------|
| `models/__init__.py` | Core: Tenant, Company, User, Role, RBAC, Employee, HRMS, CRM, POS, System, Notifications, Biometrics, MFA, Workflow, Master Data |
| `models/erp.py` | Accounting: Chart of Accounts, Journal Entries, Bank, Invoices, Tax, Fixed Assets, Expenses, Vouchers, Budgets, Payment Reminders |
| `models/inventory.py` | Product, Category, Brand, UOM, Warehouse, Stock Movements, Batches, Serials, Variants, Kits, Bundles, Images, Attributes, Cycle Counting, Goods Receipt/Issue, Traceability |
| `models/procurement.py` | Supplier, Supplier Category, Purchase Order, Vendor Bill, GRN, Supplier Contracts, Performance, Blacklist |
| `models/marketplace.py` | Marketplace Vendor, Product, Order, Order Item, Payout, Promotion |
| `models/storefront.py` | Wallet, Wallet Transaction, Journey, Notification, Wishlist |
| `models/payment_reminders.py` | PaymentReminderPolicy, PaymentReminderLog |

### Total Models: ~80+ database tables

---

## 24. API Route Map

### Route File Organization
```
api/v1/
├── __init__.py           — Router assembly
├── router.py             — Main router with health check
├── auth.py               — Authentication endpoints
├── crm.py                — Main CRM router (includes crm_modules)
├── crm_modules/
│   ├── groups.py         — Customer groups
│   ├── segments.py       — Customer segments
│   ├── memberships.py    — Membership plans
│   ├── wallet.py         — Customer wallets
│   ├── loyalty.py        — Loyalty programs
│   ├── discounts.py      — Discount codes
│   └── whatsapp_automation.py — WhatsApp proxy
├── erp/                  — 22 ERP route files (accounting, invoices, tax, bank, vouchers, etc.)
├── hrms/                 — 9 HRMS route files (employees, attendance, leaves, payroll, recruitment, performance, learning, exit, intelligence)
├── inventory/            — 20 inventory route files (master catalog, warehouses, stock movement, variants, kits, bundles, traceability, etc.)
├── pos/                  — 4 POS route files (sessions, transactions, products, free qty rules)
├── procurement.py        — Purchase orders, vendor bills
├── marketplace/
│   └── marketplace_router.py — Vendors, products, orders, payouts
├── payments.py           — Payment gateway operations
├── storefront.py         — Storefront wallet, journey, notifications
├── notifications.py      — Push notification management
├── workspace.py          — Workspace settings
├── system_admin.py       — Tenant/system administration
├── reports.py            — Analytics and reporting
├── copilot.py            — AI chat assistant
└── utils.py              — Utility endpoints
```

### API Client Modules (Frontend)
The frontend `api-client.ts` exports **55+ API modules** covering all backend functionality.

---

## 25. Key Integration Points

### Internal Data Flow

```
Lead (CRM) ──→ Customer (CRM) ──→ Opportunity ──→ Quotation ──→ Sales Order ──→ Invoice (ERP)
                                                                                    │
                                                                                    ▼
                                                                              Payment (ERP)
                                                                                    │
                                                                                    ▼
                                                                         Payment Reminder Engine
                                                                                    │
                              ┌──────────────────────────────────────────────────┼──────────────────┐
                              ▼                                                  ▼                  ▼
                        WhatsApp                                         Email               SMS
```

### External Integrations

| Integration | Purpose | Service |
|-------------|---------|---------|
| **WhatsApp Business** | Messaging, notifications, invoicing | Node.js Gateway + whatsapp-web.js |
| **Google OAuth** | SSO login | authlib |
| **Meta (Facebook/Instagram)** | Ads, lead import | Facebook Graph API |
| **Razorpay** | Online payments | Razorpay SDK |
| **Pine Labs** | Card/UPI terminal | Pine Labs API |
| **WhiteBooks GSP** | GST compliance, e-Invoice, e-Way Bill | WhiteBooks API |
| **Resend** | Transactional email | Resend API |
| **MinIO** | File storage | S3-compatible API |
| **OpenAI/Claude/Gemini** | AI features, creative generation | Provider APIs |
| **Supabase** | Optional auth/storage | Supabase SDK |

---

## Appendix A: Key Configuration

### Environment Variables (Backend)
```env
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://localhost:6379
WHATSAPP_GATEWAY_URL=http://127.0.0.1:8005
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
RESEND_API_KEY=...
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
PINELABS_USER=...
PINELABS_PASSWORD=...
WHITEBOOKS_USERNAME=...
WHITEBOOKS_PASSWORD=...
MINIO_ENDPOINT=...
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
SUPABASE_URL=...
SUPABASE_KEY=...
```

---

## Appendix B: Permission Modules

| Module | Key Permissions |
|--------|----------------|
| **auth** | login, logout, register, passkey, fingerprint |
| **crm** | customers, leads, opportunities, quotations, sales_orders, tickets, campaigns, ad_assets, paid_ads, intelligence, calls |
| **whatsapp** | send_message, send_media, sync_contacts, manage_sessions |
| **pos** | manage_sessions, create_transactions, void_transactions |
| **inventory** | products, warehouses, stock_movements, adjustments, cycle_counts, traceability, variants, kits, bundles |
| **accounting** | chart_of_accounts, journal_entries, financial_reports |
| **invoices** | create, send, void, payments, returns, templates |
| **tax** | configurations, gst_filing, einvoice, eway_bill |
| **procurement** | suppliers, purchase_orders, vendor_bills |
| **hrms** | employees, attendance, leaves, payroll, recruitment, performance, learning, exit |
| **marketplace** | vendors, products, orders, payouts |
| **storefront** | wallet, journey, notifications, wishlist |
| **workflow** | approval_workflows, automation_rules, notification_templates, document_templates |
| **system** | settings, health, logs, backup, users, roles |

---

*End of Documentation*
