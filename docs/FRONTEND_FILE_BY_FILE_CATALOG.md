# Complete Frontend File-by-File Catalog & Purpose Directory

This document lists **every single frontend file** in `c:\Users\abhil\Desktop\restaurant\frontend\src\`, explaining its exact architectural purpose, what it implements, and its status.

---

## 1. Application Core & Setup

| File Path | Purpose & Responsibility | Status |
| :--- | :--- | :--- |
| **[`frontend/src/router.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/router.tsx)** | TanStack Router configuration. Initializes the router instance, attaches the generated `routeTree`, and configures global loading and not-found fallbacks. | **DONE** |
| **[`frontend/src/routeTree.gen.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routeTree.gen.ts)** | Auto-generated type-safe route tree produced by `@tanstack/router-cli`. Maps file paths to typed navigation targets. | **DONE** |
| **[`frontend/src/styles.css`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/styles.css)** | Global stylesheet defining CSS custom properties (design tokens for colors, spacing, borders, shadows, dark mode variables, and animations). | **DONE** |
| **[`frontend/src/start.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/start.ts)** | Client entry point mounting the React 18 DOM root. | **DONE** |
| **[`frontend/src/server.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/server.ts)** | Optional SSR server runner for production server rendering and asset caching. | **DONE** |

---

## 2. Shared Libraries & Utilities (`frontend/src/lib/`)

| File Path | Purpose & Responsibility | Status |
| :--- | :--- | :--- |
| **[`lib/auth-tokens.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/lib/auth-tokens.ts)** | Client-side JWT management. Stores tokens in browser local storage, decodes payload claims, extracts tenant ID and user permissions, and tracks the active outlet ID. | **DONE** |
| **[`lib/modules.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/lib/modules.ts)** | Client-side module license gatekeeper. Checks whether a module (POS, Kitchen, Inventory, CRM, Salon) is active for the current tenant before displaying navigation links. | **DONE** |
| **[`lib/format.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/lib/format.ts)** | Centralized formatting helper: `money(amount)` formats to Indian Rupees (`₹`), date/time formatters, and quantity decimal rounders. | **DONE** |
| **[`lib/utils.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/lib/utils.ts)** | Utility functions including `cn()` (combining `clsx` and `tailwind-merge` for dynamic Tailwind class evaluation). | **DONE** |

---

## 3. All Routes & Views (`frontend/src/routes/`)

### 3.1. Master Shell & Authentication
- **[`routes/__root.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/__root.tsx)**: Root layout mounting the persistent `AppShell`, sidebar, outlet switcher, top bar, and route outlet.
- **[`routes/login.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/login.tsx)**: Multi-tenant login form (tenant slug, user email, password). Saves access tokens and initializes outlet context.
- **[`routes/index.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/index.tsx)**: Landing page and root redirect controller.

### 3.2. Restaurant Operations Views
- **[`routes/dashboard.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/dashboard.tsx)**: Operations dashboard displaying daily revenue, table occupancy, pending KOT count, and low-stock alerts.
- **[`routes/recipes.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/recipes.tsx)**: **AI Recipe & BOM Hub**. Features multi-modal dish search (text/image), dynamic portion scaling ($1$ to $N$), live inventory BOM reconciliation (In Stock / Low / Missing), chef customization, "Save to Menu", and 1-Click "Create PO" restock.
- **[`routes/pos.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/pos.tsx)**: High-speed POS terminal with floor layout table picker, item grid with modifiers/addons, cart management, and split-payment checkout.
- **[`routes/kitchen.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/kitchen.tsx)**: Kitchen Display System (KDS) displaying active KOT cards, color-coded timer urgency (Normal, Warning, Urgent), and touch-strike item bumping.
- **[`routes/menu.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/menu.tsx)**: Dish catalog management: category organization, price editing, variant configuration, and recipe linkage.
- **[`routes/inventory.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/inventory.tsx)**: Inventory stock management: on-hand levels, cost valuation, central warehouse to kitchen transfers, and wastage tracking.
- **[`routes/orders.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/orders.tsx)**: Order history list with status filtering (Placed, In-Kitchen, Billed, Cancelled) and receipt reprinting.
- **[`routes/operations.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/operations.tsx)**: Interactive blueprint canvas for drag-and-drop table layout design, section grouping, and capacity management.

### 3.3. Customer, Staff & Financial Management
- **[`routes/crm.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/crm.tsx)**: Customer Relationship Management (CRM) directory: search customers by phone, view lifetime spend, order history, and preferences.
- **[`routes/reservations.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/reservations.tsx)**: Table reservation calendar and waitlist coordinator.
- **[`routes/staff.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/staff.tsx)**: Staff roster management, daily clock-in/out attendance logging, and tip distribution ledger.
- **[`routes/reports.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/reports.tsx)**: Analytics and audit suite: Product Mix reports, Hourly Sales graphs, GST tax breakdown, and inventory food cost analysis.
- **[`routes/settings.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/settings.tsx)**: Store configuration: outlet details, GST rates, service charges, and thermal receipt template designer.

### 3.4. Multi-Tenant Platform & Industry Vertical Plugins
- **[`routes/platform.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/platform.tsx)** & **[`routes/platform/`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/platform)**: Super Admin control plane to onboard organizations (e.g. Spice9), assign global roles, and dynamically toggle module licenses.
- **[`routes/salon.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/salon.tsx)**: Plug-and-play Salon vertical module (stylist booking, service catalog).
- **[`routes/gym.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/gym.tsx)**: Plug-and-play Gym & Fitness module (membership tiers, trainer booking).
- **[`routes/hotel.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/hotel.tsx)**: Plug-and-play Hotel Room Management module (room booking, housekeeping).
- **[`routes/retail.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/retail.tsx)**: Plug-and-play Retail store module (barcode scanning, shelf inventory).
- **[`routes/ai.tsx`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/routes/ai.tsx)**: AI Business Copilot chat interface answering conversational questions about revenue, stock, and menu performance.

---

## 4. API Service Clients (`frontend/src/services/`)

| File Path | Backend Endpoint Target | Key Methods Provided |
| :--- | :--- | :--- |
| **[`services/menuService.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/menuService.ts)** | `/api/v1/menu` | `searchRecipes()`, `aiRecipeSearch()`, `aiRecipeReconcile()`, `createRecipe()`, `getMenuCategories()` |
| **[`services/purchaseService.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/purchaseService.ts)** | `/api/v1/purchase` | `aiRecipeReorder()`, `createPurchaseOrder()`, `getVendors()`, `getOpenOrdersByItem()` |
| **[`services/inventoryService.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/inventoryService.ts)** | `/api/v1/inventory` | `getItems()`, `getCostLookup()`, `createMovement()`, `createAdjustment()` |
| **[`services/kitchenService.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/kitchenService.ts)** | `/api/v1/kitchen` | `getActiveKots()`, `updateKotItemStatus()`, `cancelKot()`, `reprintKot()` |
| **[`services/posService.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/posService.ts)** | `/api/v1/pos` | `placeOrder()`, `updateOrder()`, `getTableSessions()`, `closeTableSession()` |
| **[`services/billingService.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/billingService.ts)** | `/api/v1/billing` | `createBill()`, `recordPayment()`, `getBill()`, `refundPayment()` |
| **[`services/customerService.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/customerService.ts)** | `/api/v1/customers` | `getCustomers()`, `createCustomer()`, `getCustomerHistory()` |
| **[`services/organizationService.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/organizationService.ts)** | `/api/v1/organization` | `getOutlets()`, `getSections()`, `getTables()`, `updateTablePosition()` |
| **[`services/platformService.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/platformService.ts)** | `/api/v1/platform` | `onboardTenant()`, `getTenantModules()`, `activateModule()`, `suspendModule()` |
| **[`services/receiptTemplateService.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/receiptTemplateService.ts)** | `/api/v1/billing/templates` | `loadTemplate()`, `saveTemplate()`, `renderThermalHtml()` |
| **[`services/restaurantStore.ts`](file:///c:/Users/abhil/Desktop/restaurant/frontend/src/services/restaurantStore.ts)** | Client Memory State | Centralized reactive store managing active cart items, active table session, and notifications |

---

## 5. UI Components & Design System (`frontend/src/components/`)

- **Layout Components**:
  - `components/layout/AppShell.tsx`: Outer dashboard frame with responsive navigation sidebar and collapse states.
  - `components/layout/Sidebar.tsx`: Navigation menu respecting the active tenant's enabled modules.
  - `components/layout/OutletPicker.tsx`: Dropdown selector enabling operators to switch between branches/outlets.
- **Common Components**:
  - `components/common/PageHeader.tsx`: Unified title header with action buttons and breadcrumbs.
  - `components/common/KpiCard.tsx`: Standard statistical summary tile with trend badges.
  - `components/common/StatusBadge.tsx`: Color-coded status badge (`In Stock`, `Low`, `Missing`, `Draft`, `Active`).
  - `components/common/Panel.tsx`: Card surface container with border tokens and glassmorphism.
- **UI Primitives (`components/ui/`)**:
  - `button.tsx`, `input.tsx`, `dialog.tsx`, `badge.tsx`, `table.tsx`, `tabs.tsx`, `dropdown-menu.tsx`, `label.tsx`, `popover.tsx`, `select.tsx`, `switch.tsx`.
