# Enterprise Multi-Vertical ERP Platform Blueprint
## Architecture, Plug-and-Play Plugin Engine & Super Admin Portal

---

## 1. Executive Vision: The "Universal Operating System" for Service Businesses

The objective is to establish an **Institutional Enterprise ERP Platform** designed around a core modular foundation. While the initial vertical is **RestaurantOS**, the core platform architecture allows plugging in and unplugging any industry vertical without touching the shared foundation:

- **Vertical 1 (Current):** Restaurant & F&B (`restaurant-pos`, `kitchen-kds`, `recipe-bom`)
- **Vertical 2 (Future):** Salon & Spa (`salon-chairs`, `stylist-roster`, `service-appointments`)
- **Vertical 3 (Future):** Gym & Fitness (`gym-memberships`, `access-turnstiles`, `trainer-schedules`)
- **Vertical 4 (Future):** Retail & Quick-Commerce (`retail-pos`, `barcode-scanner`, `shelf-inventory`)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY & REVERSE PROXY                            │
│                 (JWT Verification, Dynamic Feature Flags, Routing)               │
└────────┬─────────────────────────┬─────────────────────────┬─────────────────────┘
         │                         │                         │
         ▼                         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   CORE ENGINES   │      │ RESTAURANT (PLUG)│      │   SALON (PLUG)   │
│ (Shared Across)  │      │ (Active/Deactive)│      │(Active/Deactive) │
├──────────────────┤      ├──────────────────┤      ├──────────────────┤
│ • Auth & RBAC    │      │ • Table Sessions │      │ • Chair Booking  │
│ • Organization   │      │ • KDS Screens    │      │ • Stylist Slots  │
│ • Billing & GST  │      │ • KOT Tickets    │      │ • Service Catalog│
│ • Accounting GL  │      │ • Recipe BOM     │      │ • Package Deals  │
│ • Staff & Roster │      └──────────────────┘      └──────────────────┘
│ • Customers/CRM  │               │                         │
│ • Inventory Core │               ▼                         ▼
│ • Loyalty/Wallet │      ┌──────────────────┐      ┌──────────────────┐
│ • Reports/BI     │      │    GYM (PLUG)    │      │  RETAIL (PLUG)   │
│ • Super Admin    │      │ (Active/Deactive)│      │(Active/Deactive) │
│   Platform Portal│      ├──────────────────┤      ├──────────────────┤
│                  │      │ • Member Passes  │      │ • Barcode Matrix │
│                  │      │ • Turnstile Auth │      │ • Shelf Locations│
│                  │      │ • Personal Train │      │ • Batch / Expiry │
└──────────────────┘      └──────────────────┘      └──────────────────┘
```

---

## 2. Horizontal Core Engines vs. Vertical Plugins

The platform strictly decouples **Horizontal Services** (business fundamentals) from **Vertical Plugins** (industry-specific workflows).

### 2.1 Horizontal Core Services (Shared Everywhere)

| Service | Responsibility in Restaurant | Responsibility in Salon | Responsibility in Gym |
|---|---|---|---|
| **`auth`** | Passwords, PINs, Roles, Sessions | Staff login, Stylist PINs | Front-desk staff, Member portal login |
| **`organization`** | Outlets, Dining Sections, Tables | Outlets, Styling Floors, Private Rooms | Facilities, Zones, Studios, Lockers |
| **`billing`** | Food tickets, Service charge, GST | Haircuts, Spa packages, GST | Monthly subscriptions, Day passes, GST |
| **`accounting`** | Double-entry GL, Food sales, Day-close | Service revenue, Product sales, Day-close | Recurring dues, Asset depreciation |
| **`inventory`** | Ingredients, packaging, batches | Shampoos, oils, retail products | Supplements, towels, gym gear |
| **`staff`** | Chefs, Waiters, Captains, Tips | Stylists, Therapists, Commissions | Personal Trainers, Instructors |
| **`customers`** | Dining preferences, allergies | Skin types, hair color history, birthdays | Health goals, body metrics, emergency contact |
| **`loyalty`** | Dining points, cash wallet | Pampering tiers, prepaid treatment wallet | Streak rewards, personal training credits |
| **`reports`** | Hourly covers, food cost % | Chair utilization, stylist productivity | Churn rate, active gym check-ins |

### 2.2 Vertical Plugins (Plug In / Plug Out via Feature Flags)

Vertical services exist as independent modules that hook into the core event bus:

1. **Restaurant Vertical (`service_restaurant`):**
   - Tables, KOT, KDS kitchen screens, Course pacing, Recipe BOM shrinkage.
2. **Salon Vertical (`service_salon`):**
   - Appointment calendar, chair availability, stylist commission splits, consumable usage per service (e.g. 30ml dye per haircut).
3. **Gym Vertical (`service_gym`):**
   - Recurring membership plans, RFID/Biometric turnstile check-ins, class slot booking, locker assignments.
4. **Retail Vertical (`service_retail`):**
   - Barcode label printing, weighing scale integrations, shelf replenishment indents.

---

## 3. Platform Super Admin Portal Architecture

The **Platform Super Admin** is the master cockpit used by the SaaS platform owners to govern tenants, toggle plugins, provision databases, and define dynamic permissions.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PLATFORM SUPER ADMIN CONTROL CONSOLE                            │
│  [Tenants]   [Module Marketplace]   [Dynamic RBAC Matrix]   [Audit Vault]   [Billing]  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  TENANT: The Royal Heritage Group (Tenant ID: ten_98a712)                              │
│  Business Category: [ MULTI-FACILITY RESORT & SPA                                    ▼]│
│                                                                                        │
│  ACTIVE PLUGINS (PLUG IN / PLUG OUT):                                                  │
│  ┌─────────────────────────┬──────────────┬───────────────┬──────────────────────────┐ │
│  │ Module Plugin           │ Status       │ Version       │ Actions                  │ │
│  ├─────────────────────────┼──────────────┼───────────────┼──────────────────────────┤ │
│  │ core.billing            │ [ ENABLED  ] │ v2.4.0 (Core) │ [Configure] [Audit Log]  │ │
│  │ core.accounting         │ [ ENABLED  ] │ v1.9.0 (Core) │ [Configure] [Lock Period]│ │
│  │ plugin.restaurant.pos   │ [ ENABLED  ] │ v3.1.2        │ [Disable]   [Settings]   │ │
│  │ plugin.restaurant.kds   │ [ ENABLED  ] │ v3.1.2        │ [Disable]   [Settings]   │ │
│  │ plugin.salon.spa        │ [ ENABLED  ] │ v1.0.4        │ [Disable]   [Settings]   │ │
│  │ plugin.gym.fitness      │ [ DISABLED ] │ v1.2.0        │ [Enable Plugin]          │ │
│  │ plugin.retail.store     │ [ DISABLED ] │ v2.0.1        │ [Enable Plugin]          │ │
│  └─────────────────────────┴──────────────┴───────────────┴──────────────────────────┘ │
│                                                                                        │
│  RESOURCE QUOTAS & LICENSES:                                                           │
│  • Maximum Outlets: [  15 / 20 Licensed  ]   [Upgrade Quota]                           │
│  • Active POS Terminals: [  32 Active   ]   • Database Storage: [ 4.2 GB / 20 GB ]     │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Super Admin Responsibilities & Capabilities

1. **Plugin Lifecycle Governance:**
   - **Plug In (Hot-Activation):** Activating a module generates schema tables, seeds default module roles, and updates the tenant's token claims.
   - **Plug Out (Safe-Deactivation):** Deactivating a module revokes navigation and endpoints immediately while preserving the historical audit ledger.
2. **Dynamic Permission Builder:**
   - Super Admins can register new permissions on the fly without deploying code:
     - `Module Code` (e.g. `salon`)
     - `Page Code` (e.g. `appointments`)
     - `Feature Code` (e.g. `commission_override`)
     - `Action Type` (`CREATE`, `READ`, `UPDATE`, `DELETE`, `APPROVE`, `EXPORT`)
3. **Dynamic Role Templates:**
   - Bundle permissions into reusable enterprise templates:
     - *Restaurant Templates:* Cashier, Captain, Head Chef, F&B Director.
     - *Salon Templates:* Receptionist, Senior Stylist, Spa Manager.
     - *Gym Templates:* Floor Trainer, Front Desk, Facility Auditor.
     - *Enterprise Corporate Templates:* Financial Controller, Internal Auditor, Procurement Head.
4. **Tenant License & Metering Engine:**
   - Enforce terminal concurrency limits, active branch quotas, and monthly invoice volume tiers.

---

## 4. Enterprise Permission Model (RBAC + ABAC)

Enterprise ERP permissions must enforce both **Role-Based Access Control (RBAC)** and **Attribute-Based Access Control (ABAC)**.

### 4.1 The 5-Tier Permission Structure

```
[Module] ──► [Page / View] ──► [Tab / Section] ──► [Action / Button] ──► [Field Level]
```

1. **Tier 1 - Module Gate:** Does the tenant license `salon` or `restaurant`? (If disabled, routes 404).
2. **Tier 2 - Page Gate:** Can the user navigate to `/purchase/orders`? (Enforces side-nav visibility).
3. **Tier 3 - Section Gate:** Can the user view the "Margin & Landed Cost" tab on the page?
4. **Tier 4 - Action Gate:** Can the user click the "Approve Purchase Order" button?
5. **Tier 5 - Field Level Security (FLS):**
   - **Cost Concealment:** Staff roles see quantities, but unit prices are masked (`****`).
   - **PII Masking:** Customer phone numbers masked (`+91 98*** **223`) for floor servers to protect VIP privacy.
   - **Discount Thresholds:** Captains can apply up to 10% discount; Managers can apply up to 30%; above 30% requires Owner sign-off.

---

## 5. Enterprise Workflows: Maker-Checker & Segregation of Duties

Enterprise financial auditors mandate **Segregation of Duties (SoD)** to prevent fraud and operational collusion.

### 5.1 Maker-Checker Approval Pipeline

```
  [Initiator / Maker]                         [System Gate]                         [Approver / Checker]
           │                                        │                                         │
1. Submits Sensitive Action                         │                                         │
   (Void Bill / PO / Write-off) ───────────────────►│                                         │
                                            2. Creates Pending Ticket                         │
                                               & Checks Threshold                             │
                                                    │                                         │
                                                    ├────────────────────────────────────────►│
                                                    │   3. Pushes Alert / PIN Request         │
                                                    │                                         │
                                                    │◄────────────────────────────────────────┤
                                                    │   4. Approves with Mandatory Reason     │
                                                    ▼                                         │
                                            5. Commits to Ledger & Emits Event                │
```

### 5.2 Mandatory Enterprise Approvals

1. **POS Post-Payment Voiding:**
   - A bill settled cannot be deleted. Voiding requires a supervisor PIN and issues a matching credit note.
2. **Inventory Stock Adjustments:**
   - Physical count differences exceeding ₹1,000 require Regional Inventory Controller sign-off.
3. **3-Way Match in Procurement:**
   - Payment cannot be disbursed to a vendor unless `PO.quantity == GRN.received_quantity == VendorBill.billed_quantity` within tolerance.

---

## 6. Corporate Hierarchy & Data Isolation

Enterprises operate multi-brand, multi-franchise structures. The platform organizes data into a 4-tier tree:

```
[Holding Company / Enterprise Tenant]
   │
   ├── [Brand A: Fine Dining Chain] (Shared Menu, Shared Loyalty)
   │      ├── [Company-Owned Outlets] (Direct Consolidated Financials)
   │      └── [Franchise Outlets] (Isolated Accounting, Royalty Invoicing)
   │
   └── [Brand B: Express QSR / Cloud Kitchens]
          └── [Hub & Spoke Central Kitchens] (B2B Transfer Indents to Kiosks)
```

- **Scope Injection at the Gateway:**
  When a user logs in, their JWT bearer token contains their `active_outlet_id` and `allowed_outlet_ids`.
- If an outlet manager attempts to read or mutate another outlet's inventory, the gateway/microservice interceptor aborts with `403 Forbidden` before querying the database.

---

## 7. Implementation Roadmap & Milestones

### Milestone 1: Platform Super Admin & Dynamic Permission Engine
- [ ] Create `platform_super_admin` schema & authentication guard.
- [ ] Implement `DynamicPermission` and `TenantModuleRegistry` tables.
- [ ] Build the Super Admin UI for tenant provisioning and module toggling.

### Milestone 2: Extensible Plugin Registry & Gateway Interceptor
- [ ] Implement Gateway Plugin Interceptor: if a tenant has disabled `kitchen`, calls to `/api/v1/kitchen/*` are blocked at edge.
- [ ] Decouple domain models so vertical plugins plug into standard core events (`billing.bill.paid`, `inventory.stock.deducted`).

### Milestone 3: Maker-Checker Approval & Override Engine
- [ ] Implement `ApprovalRequest` entity in Core.
- [ ] Wire high-value actions (PO approvals, Bill Voids, Stock Write-offs) to require supervisor sign-off.
- [ ] Build supervisor PIN-prompt and remote push-notification approval workflow.

### Milestone 4: Statutory Compliance & Immutable Audit Vault
- [ ] Build unified `AuditLog` service with tamper-proof event streaming.
- [ ] Implement GST B2B e-Invoicing (IRN) and E-Way bill generation hooks.
- [ ] Establish FSSAI batch expiry FIFO gates in Inventory.

### Milestone 5: Salon & Gym Vertical Reference Plugins
- [ ] Model `service_salon` (Appointments, Chair allocation, Stylist commissions).
- [ ] Model `service_gym` (Membership plans, RFID access control, Personal training slots).
- [ ] Validate hot plug-in and plug-out of Salon/Gym modules for existing restaurant tenants.
