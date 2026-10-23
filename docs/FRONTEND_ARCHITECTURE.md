# Frontend Architecture & File-by-File Documentation

This document provides a comprehensive, file-by-file breakdown of the **RestaurantOS Frontend Application**, its routing architecture, UI component hierarchy, state management, and implementation roadmap.

---

## 1. Frontend Technology Stack

- **Core**: React 18 with TypeScript.
- **Bundler & Dev Server**: Vite.
- **Routing**: **TanStack Router** (Type-safe, file-based routing with automatic code generation via `routeTree.gen.ts`).
- **Styling**: TailwindCSS with CSS custom properties (design tokens in `styles.css`), dark mode support, and glassmorphic micro-animations.
- **Icons**: Lucide React.
- **UI Primitives**: Custom accessible Shadcn-style components (`Button`, `Input`, `Dialog`, `Badge`, `DropdownMenu`).
- **Data Fetching & State**: Native `fetch` with centralized service wrappers and custom reactive state stores (`restaurantStore.ts`).

---

## 2. Directory Structure Overview

```
frontend/src/
├── components/          # Reusable UI primitives and layout shells
│   ├── common/          # PageHeader, KpiCard, Panel, StatusBadge
│   ├── layout/          # AppShell, Sidebar, Header, OutletPicker
│   └── ui/              # Button, Input, Label, Dialog, Table, etc.
├── lib/                 # Shared utilities, auth tokens, formatting
│   ├── auth-tokens.ts   # JWT token decoding, active outlet resolution
│   ├── format.ts        # Currency (INR ₹), date, and number formatters
│   ├── modules.ts       # Module gating checks for current tenant
│   └── utils.ts         # Class name joining (cn helper)
├── routes/              # TanStack Router file-based views
├── services/            # API client wrappers for each backend microservice
└── styles.css           # Global CSS variables and design tokens
```

---

## 3. File-by-File Breakdown: Routes & Screens

### 3.1. Master Shell & Auth

#### [`routes/__root.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/__root.tsx)
- **Role**: Root layout wrapper for the entire application.
- **Key Details**: Renders the persistent `AppShell` with the left navigation sidebar, outlet switcher, global search trigger, notifications drawer, and user profile menu. Handles redirection if unauthenticated.
- **Status**: **DONE**.

#### [`routes/login.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/login.tsx)
- **Role**: Multi-tenant authentication screen.
- **Key Details**: Accepts tenant slug, email, and password. Stores the returned JWT in browser storage and sets default outlet context.
- **Status**: **DONE**.

#### [`routes/index.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/index.tsx)
- **Role**: Landing and landing redirect controller.
- **Status**: **DONE**.

#### [`routes/dashboard.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/dashboard.tsx)
- **Role**: Executive operational overview.
- **Key Details**: Renders KPI cards for Today's Sales, Open Tables, Active KOTs, and Critical Inventory Alerts. Includes hourly sales trajectory graphs and quick action buttons.
- **Status**: **DONE**.

---

### 3.2. Core Restaurant Operations

#### [`routes/recipes.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/recipes.tsx) — *The AI Recipe & BOM Engine*
- **Role**: Intelligent recipe authoring, live inventory BOM reconciliation, and procurement.
- **Key Capabilities**:
  1. **Dual Search Input**:
     - *Catalog Search*: Instant debounced local keyword search.
     - *AI Global Search*: Multi-modal input allowing chefs to type natural descriptions (e.g. "Smoked butter chicken with cashew paste") or upload a dish photo.
  2. **Interactive Portion Scaler**:
     - Stepper control from 1 to $N$ portions that immediately recalibrates required ingredient quantities and wastage trim.
  3. **Live Inventory BOM Table**:
     - Displays Ingredient Name, Required Quantity, Available Warehouse/Kitchen Stock, Shortfall, Unit Cost, and Live Status Badge (`In Stock`, `Low`, `Missing`).
  4. **Chef Customization & Menu Persistence**:
     - Chefs can manually edit ingredient ratios and click **"Save to Menu"** to publish the recipe to the active POS menu.
  5. **1-Click Purchase Restock**:
     - "Create PO" button that calls `/ai-recipe-reorder` to immediately generate draft POs and PRs for deficient items without leaving the page.
- **Status**: **DONE**.

#### [`routes/pos.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/pos.tsx)
- **Role**: High-velocity Point of Sale cashier and server interface.
- **Key Capabilities**:
  - Floor table layout selector with live status indicators (Vacant, Seated, Billed).
  - Categorized menu item grid with search and variant/modifier popups.
  - Cart management with item notes, discounts, and split billing.
  - Real-time KOT dispatching to the kitchen.
  - Payment settlement modal supporting Cash, Card, UPI, and Customer Credit.
- **Status**: **DONE**.

#### [`routes/kitchen.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/kitchen.tsx)
- **Role**: Kitchen Display System (KDS) for cooks and expeditors.
- **Key Capabilities**:
  - Live ticket cards showing table number, waiter, order time, and elapsed timer.
  - Color-coded urgency alerts (Green `<10m`, Yellow `10-20m`, Red `>20m`).
  - Interactive item strike-through: cooks tap items to mark `Preparing` -> `Ready`.
- **Status**: **DONE**.

#### [`routes/inventory.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/inventory.tsx)
- **Role**: Central inventory and kitchen sub-inventory management.
- **Key Capabilities**:
  - Item master list with current stock, standard cost, and reorder levels.
  - Sub-inventory transfer modal (moving goods from Central Store to Kitchen).
  - Stock adjustment interface for wastage recording and physical audits.
- **Status**: **DONE**.

#### [`routes/operations.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/operations.tsx)
- **Role**: Floor Plan Canvas and Blueprint builder.
- **Key Capabilities**:
  - Interactive drag-and-drop table layout canvas.
  - Section definitions (Indoor AC, Outdoor Patio, Rooftop, Bar).
  - Quick table merging and capacity controls.
- **Status**: **DONE**.

#### [`routes/orders.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/orders.tsx)
- **Role**: Historical and active order tracking.
- **Key Capabilities**: Filter by status (Completed, Voided, Refunded), reprint KOTs, and view payment breakdowns.
- **Status**: **DONE**.

---

### 3.3. Customer, Staff & Multi-Tenant Platform

- **[`routes/crm.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/crm.tsx)**: Customer profiles, visit history, loyalty balance, and preferences.
- **[`routes/reservations.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/reservations.tsx)**: Booking calendar with party size and guest notes.
- **[`routes/staff.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/staff.tsx)**: Staff roster, shift attendance, and tip tracking.
- **[`routes/reports.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/reports.tsx)**: Daily sales summaries, product mix, GST reports, and food costing reports.
- **[`routes/settings.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/settings.tsx)**: Tax rules, outlet details, thermal printer receipt customizer.
- **[`routes/platform.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/platform.tsx)**: Super Admin control panel to onboard tenants (e.g. Spice9) and toggle modules (POS, Inventory, Kitchen, CRM).
- **Vertical Plugins** ([`salon.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/salon.tsx), [`gym.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/gym.tsx), [`hotel.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/hotel.tsx), [`retail.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/retail.tsx)): Dedicated interfaces demonstrating multi-vertical architecture.
- **Status**: **DONE**.

---

## 4. File-by-File Breakdown: API Services (`frontend/src/services/`)

| File | Target Backend Endpoint | Key Responsibilities |
| :--- | :--- | :--- |
| **[`menuService.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/menuService.ts)** | `/api/v1/menu` | `searchRecipes()`, `aiRecipeSearch()`, `aiRecipeReconcile()`, `createRecipe()`, `getMenuCategories()` |
| **[`purchaseService.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/purchaseService.ts)** | `/api/v1/purchase` | `createPurchaseOrder()`, `getVendors()`, `aiRecipeReorder()` |
| **[`inventoryService.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/inventoryService.ts)** | `/api/v1/inventory` | `getItems()`, `getCostLookup()`, `createAdjustment()`, `transferStock()` |
| **[`kitchenService.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/kitchenService.ts)** | `/api/v1/kitchen` | `getActiveKots()`, `updateKotItemStatus()`, `cancelKot()` |
| **[`posService.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/posService.ts)** | `/api/v1/pos` | `placeOrder()`, `updateOrder()`, `getTableSessions()` |
| **[`billingService.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/billingService.ts)** | `/api/v1/billing` | `createBill()`, `recordPayment()`, `getTaxRates()` |
| **[`customerService.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/customerService.ts)** | `/api/v1/customers` | `getCustomers()`, `createCustomer()`, `getLoyaltyBalance()` |
| **[`platformService.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/platformService.ts)** | `/api/v1/platform` | `onboardTenant()`, `getTenantModules()`, `toggleModule()` |
| **[`receiptTemplateService.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/receiptTemplateService.ts)** | `/api/v1/billing/templates`| Saves and retrieves custom thermal receipt layouts |
| **[`restaurantStore.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/restaurantStore.ts)** | Local State | Centralized reactive state for cart, active table session, and offline cache |

---

## 5. What is Done vs. What Needs to Be Done (Frontend)

### ✅ What is Done:
1. Complete TanStack Router routing tree with type-safe route navigation.
2. AI Recipe Search UI with multimodal image attachment and debounced search.
3. Real-time BOM calculation engine with interactive portion stepper and wastage trim math.
4. Shortfall alerts and 1-click PO/PR procurement generation directly from the recipe view.
5. High-speed POS interface with table picker, cart modifiers, and payment dialogs.
6. KDS Kitchen Display with real-time ticket progression.
7. Blueprint floor canvas for visual table and section organization.
8. Platform Super Admin portal for tenant onboarding and module licensing.

### ⏳ What Needs to Be Done:
1. **WebSockets / Server-Sent Events (SSE) for KDS**:
   - The KDS view currently polls for active KOT updates. Connecting an SSE endpoint from the Gateway will give instant live updates when orders are placed.
2. **Offline POS Sync (IndexedDB / PWA Service Worker)**:
   - For high-volume cashier terminals, wrap `restaurantStore.ts` with IndexedDB persistence to allow offline order entry during network hiccups.
3. **Hardware Thermal Print Driver**:
   - Thermal receipt HTML generation is implemented; add direct WebHID/WebUSB driver integration for physical ESC/POS thermal printers.
