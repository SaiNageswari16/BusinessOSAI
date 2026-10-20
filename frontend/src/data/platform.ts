export type ModuleItem = {
  id: string;
  name: string;
  icon: string;
  description: string;
  capabilities: string[];
};

export const modules: ModuleItem[] = [
  {
    id: "core-erp",
    name: "Core ERP",
    icon: "Building2",
    description: "One connected foundation for companies, branches, people and processes.",
    capabilities: ["Company & branch management", "Roles & permissions", "Workflows", "Audit logs"],
  },
  {
    id: "inventory",
    name: "Inventory",
    icon: "Boxes",
    description: "Live stock across every location, variant, batch and channel.",
    capabilities: ["Product master & variants", "Stock movement", "Batch & expiry", "Reorder rules"],
  },
  {
    id: "warehouse",
    name: "Warehouse",
    icon: "Warehouse",
    description: "Zones, racks and bins mapped to real picking and putaway flows.",
    capabilities: ["Zones, racks, bins", "Cycle counting", "Physical audit", "Barcode / QR / RFID"],
  },
  {
    id: "pos",
    name: "POS",
    icon: "ScanBarcode",
    description: "Fast billing for retail, restaurant, pharmacy, fashion and salon counters.",
    capabilities: ["Barcode billing", "Split & hold bills", "Returns & exchange", "Multiple payments"],
  },
  {
    id: "crm",
    name: "Sales & CRM",
    icon: "Users",
    description: "Leads to loyal customers with a full 360° customer record.",
    capabilities: ["Pipelines & deals", "Customer 360", "Segmentation", "Lead scoring"],
  },
  {
    id: "marketplace",
    name: "Marketplace",
    icon: "Store",
    description: "Run vendors, catalogues, payouts and fulfilment from one layer.",
    capabilities: ["Vendor onboarding & KYC", "Catalog approvals", "Payouts & wallet", "Promotions"],
  },
  {
    id: "store",
    name: "Store",
    icon: "ShoppingBag",
    description: "Customer-facing commerce for every category you sell in.",
    capabilities: ["AI search & discovery", "Cart & checkout", "Wallet & coupons", "Order tracking"],
  },
  {
    id: "finance",
    name: "Accounting & Finance",
    icon: "Landmark",
    description: "Books that stay in sync with operations automatically.",
    capabilities: ["Invoicing & payments", "Ledgers & journals", "Taxation", "Financial reports"],
  },
  {
    id: "hrms",
    name: "HRMS",
    icon: "IdCard",
    description: "People operations from onboarding to payroll.",
    capabilities: ["Attendance & shifts", "Leave & approvals", "Payroll", "Performance"],
  },
  {
    id: "operations",
    name: "Operations",
    icon: "Workflow",
    description: "Approvals, tasks and SOPs that keep teams aligned.",
    capabilities: ["Task management", "Approval chains", "SOP checklists", "Escalations"],
  },
  {
    id: "analytics",
    name: "Analytics",
    icon: "BarChart3",
    description: "Every number in the business, explained in plain language.",
    capabilities: ["Live dashboards", "Custom reports", "Cohorts & trends", "Exports"],
  },
  {
    id: "ai",
    name: "AI Intelligence",
    icon: "Sparkles",
    description: "A copilot that reads your data and recommends the next move.",
    capabilities: ["Business assistant", "Forecasting", "Anomaly detection", "Automation"],
  },
  {
    id: "procurement",
    name: "Procurement",
    icon: "ClipboardList",
    description: "Purchase planning, vendors and landed cost control.",
    capabilities: ["Purchase orders", "Vendor quotes", "GRN", "Landed cost"],
  },
  {
    id: "orders",
    name: "Order Management",
    icon: "PackageCheck",
    description: "One order pipeline across store, POS, marketplace and B2B.",
    capabilities: ["Unified order pool", "Returns & refunds", "Order timeline", "Invoices"],
  },
  {
    id: "logistics",
    name: "Delivery & Logistics",
    icon: "Truck",
    description: "Riders, routes and shipments tracked end to end.",
    capabilities: ["Delivery assignment", "Live tracking", "Route planning", "Shipping rules"],
  },
  {
    id: "loyalty",
    name: "Customer Loyalty",
    icon: "Gift",
    description: "Points, tiers and offers that bring customers back.",
    capabilities: ["Points & tiers", "Coupons & offers", "Gift cards", "Memberships"],
  },
];

export const valueStrip = [
  { label: "One Platform", detail: "Every module on a single data core" },
  { label: "Multiple Industries", detail: "23+ industry configurations" },
  { label: "Connected Operations", detail: "Stock, sales, finance in sync" },
  { label: "AI-Powered Decisions", detail: "Forecasts built into workflows" },
  { label: "Real-Time Intelligence", detail: "Live across every branch" },
];

export const erpFeatures = [
  "Company Management",
  "Branch Management",
  "User Roles",
  "Permissions",
  "Workflow Management",
  "Master Data",
  "Audit Logs",
  "Notifications",
  "Multi-location Operations",
  "Multi-tenant Architecture",
];

export const inventoryGroups = [
  {
    title: "Catalogue",
    items: ["Product Master", "Categories", "Sub Categories", "Brands", "Units", "Attributes", "Variants", "Bundles"],
  },
  {
    title: "Stock Control",
    items: ["Stock Overview", "Stock Movement", "Stock Adjustment", "Stock Transfer", "Cycle Counting", "Physical Audit"],
  },
  {
    title: "Warehouse",
    items: ["Warehouses", "Zones", "Racks", "Bins", "Batch Tracking", "Serial Numbers", "Expiry Tracking", "Barcode / QR / RFID"],
  },
  {
    title: "Intelligence",
    items: ["Low Stock & Reorder", "Slow / Fast Moving", "Dead Stock", "ABC & XYZ Analysis", "Demand Forecast", "Smart Reordering"],
  },
];

export const posTypes = [
  { name: "Retail POS", note: "Counter billing with barcode and loyalty" },
  { name: "Restaurant POS", note: "Tables, KOT and kitchen display" },
  { name: "Fashion POS", note: "Size and colour variant billing" },
  { name: "Electronics POS", note: "Serial numbers and warranty capture" },
  { name: "Pharmacy POS", note: "Batch, expiry and prescription flow" },
  { name: "Salon POS", note: "Services, stylists and packages" },
];

export const posFeatures = [
  "Barcode scanning",
  "Product search",
  "Customer management",
  "Discounts",
  "Loyalty",
  "Multiple payments",
  "Split bills",
  "Returns",
  "Refunds",
  "Hold bills",
  "Delivery",
  "Exchange",
  "Receipts",
];

export const restaurantPos = [
  "Table Management",
  "Reservations",
  "KOT",
  "Kitchen Display System",
  "Kitchen Stations",
  "Order Status",
  "Waiter Management",
  "Split & Merge Tables",
];

export const crmFeatures = [
  "Leads",
  "Contacts",
  "Accounts",
  "Deals",
  "Pipelines",
  "Activities",
  "Follow-ups",
  "Customer 360",
  "Customer Segmentation",
  "Campaigns",
  "Lead Scoring",
  "Churn Prediction",
  "Sales Automation",
  "WhatsApp & communication",
  "AI Calling",
  "Online Reputation",
  "Predictive Analytics",
];

export const marketplaceGroups = [
  {
    title: "Vendor Management",
    items: ["Vendors", "Vendor Categories", "Contracts", "Wallet", "Payouts", "Ratings", "Performance", "KYC", "Approvals"],
  },
  {
    title: "Marketplace Catalog",
    items: ["Marketplace Products", "Categories", "Services", "Product Approval", "Pricing Rules", "Bundles", "Featured Products"],
  },
  {
    title: "Commerce",
    items: ["Orders", "Returns", "Refunds", "Cancellations", "Order Timeline", "Invoices", "Order Tracking"],
  },
  {
    title: "Delivery & Fulfilment",
    items: ["Delivery Partners", "Drivers", "Assignment", "Tracking", "Hyperlocal Delivery", "Shipping Rules", "Route Planning"],
  },
  {
    title: "Promotions",
    items: ["Coupons", "Offers", "Campaigns", "Flash Sales", "Wallet", "Loyalty", "Gift Cards"],
  },
  {
    title: "Marketplace Intelligence",
    items: ["Demand Forecast", "Dynamic Pricing", "Vendor Analytics", "Product Analytics", "Fraud Detection", "AI Recommendations"],
  },
];

export const commerceFlows = [
  {
    kind: "Retail",
    steps: ["Customer", "Product", "Cart", "Checkout", "Delivery"],
    note: "Direct-to-consumer buying across store, app and counter.",
  },
  {
    kind: "Wholesale",
    steps: ["Bulk quantity", "Tier pricing", "Order", "Invoice", "Fulfilment"],
    note: "Volume pricing with MOQ and distributor rate cards.",
  },
  {
    kind: "B2B",
    steps: ["RFQ", "Quotation", "Negotiation", "Sales order", "Invoice", "Delivery"],
    note: "Contract buying with credit limits and payment terms.",
  },
];

export const b2bFeatures = [
  "Bulk Orders",
  "Tier Pricing",
  "MOQ",
  "Customer-specific Pricing",
  "Credit Limits",
  "Payment Terms",
  "RFQ",
  "Quotations",
  "B2B Customer Accounts",
  "Wholesale Pricing",
  "Distributor Pricing",
];

export const storeCategories = [
  { name: "Grocery", line: "Fast commerce for everyday essentials.", icon: "ShoppingCart" },
  { name: "Fashion", line: "Discover brands, collections and personalised styles.", icon: "Shirt" },
  { name: "Jewellery", line: "Premium product discovery with luxury presentation.", icon: "Gem" },
  { name: "Electronics", line: "Compare products, specifications and offers.", icon: "Cpu" },
  { name: "Food", line: "Discover restaurants and order instantly.", icon: "UtensilsCrossed" },
  { name: "Hotels", line: "Search, compare and book stays.", icon: "BedDouble" },
  { name: "Travel", line: "Explore and book experiences.", icon: "Plane" },
  { name: "Entertainment", line: "Discover digital subscriptions and content.", icon: "Clapperboard" },
  { name: "Services", line: "Find and book local services.", icon: "Wrench" },
];

export const storeCapabilities = [
  "AI Search",
  "Smart Recommendations",
  "Universal Search",
  "Product Discovery",
  "Wishlist",
  "Cart",
  "Checkout",
  "Payments",
  "Wallet",
  "Coupons",
  "Loyalty",
  "Order Tracking",
  "Memberships",
  "Gift Cards",
  "Reviews",
  "Personalisation",
];

export type Industry = {
  name: string;
  description: string;
  modules: string[];
  ai: string;
};

export const industries: Industry[] = [
  { name: "Retail & Supermarkets", description: "Multi-branch billing, stock and loyalty in one counter-to-warehouse flow.", modules: ["POS", "Inventory", "Loyalty"], ai: "Demand forecast" },
  { name: "Wholesale & Distribution", description: "Tier pricing, credit terms and bulk fulfilment for dealer networks.", modules: ["B2B", "Warehouse", "Finance"], ai: "Reorder planning" },
  { name: "Manufacturing", description: "BOM to finished goods with quality gates and machine upkeep.", modules: ["Production", "Procurement", "Inventory"], ai: "Production forecast" },
  { name: "Restaurants & Cafes", description: "Tables, KOT, kitchen displays and delivery on one ticket flow.", modules: ["Restaurant POS", "Inventory", "CRM"], ai: "Menu demand" },
  { name: "Cloud Kitchens", description: "Multi-brand, multi-channel order aggregation with recipe costing.", modules: ["Orders", "Recipes", "Delivery"], ai: "Peak hour staffing" },
  { name: "Hotels & Hospitality", description: "Rooms, guests, outlets and billing connected to finance.", modules: ["Bookings", "POS", "Finance"], ai: "Occupancy pricing" },
  { name: "Pharmacy", description: "Batch, expiry and compliance-safe dispensing.", modules: ["Pharmacy POS", "Inventory", "Procurement"], ai: "Expiry risk" },
  { name: "Healthcare Clinics", description: "Appointments, records and billing without duplicate entry.", modules: ["Appointments", "CRM", "Finance"], ai: "No-show prediction" },
  { name: "Fashion & Apparel", description: "Size-colour matrices across stores, warehouse and online.", modules: ["Inventory", "Store", "POS"], ai: "Style trend signals" },
  { name: "Jewellery", description: "Weight-based pricing, making charges and certified stock.", modules: ["POS", "Inventory", "Finance"], ai: "Rate-linked pricing" },
  { name: "Electronics", description: "Serial tracking, warranty and service history.", modules: ["POS", "Service", "CRM"], ai: "Attach-rate insights" },
  { name: "Education", description: "Admissions, fees, staff and stores in one administration core.", modules: ["CRM", "Finance", "HRMS"], ai: "Fee collection risk" },
  { name: "Construction", description: "Projects, materials, vendors and site-wise cost control.", modules: ["Procurement", "Inventory", "Finance"], ai: "Cost overrun alerts" },
  { name: "Logistics & Transport", description: "Fleet, drivers, routes and delivery proof in real time.", modules: ["Fleet", "Delivery", "Orders"], ai: "Route optimisation" },
  { name: "Agriculture", description: "Farmers, crops, procurement and market linkage.", modules: ["Procurement", "Marketplace", "Warehouse"], ai: "Crop intelligence" },
  { name: "Gyms & Fitness", description: "Memberships, attendance, trainers and renewals.", modules: ["Memberships", "CRM", "POS"], ai: "Churn prediction" },
  { name: "Salons & Spas", description: "Appointments, stylists, packages and commissions.", modules: ["Appointments", "POS", "Inventory"], ai: "Rebooking nudges" },
  { name: "Automobile", description: "Sales, service jobs, spares and warranty claims.", modules: ["Service", "Inventory", "CRM"], ai: "Service reminders" },
  { name: "Real Estate", description: "Inventory of units, leads, bookings and collections.", modules: ["CRM", "Finance", "Operations"], ai: "Lead scoring" },
  { name: "Professional Services", description: "Projects, timesheets, retainers and invoicing.", modules: ["Operations", "Finance", "HRMS"], ai: "Utilisation insights" },
  { name: "Home Services", description: "Bookings, technicians, parts and field payments.", modules: ["Orders", "Delivery", "POS"], ai: "Job assignment" },
  { name: "E-commerce", description: "Catalogue, pricing, fulfilment and returns at scale.", modules: ["Store", "Orders", "Inventory"], ai: "Recommendations" },
  { name: "Franchises", description: "Central control with branch-level autonomy and royalty tracking.", modules: ["Core ERP", "Analytics", "Finance"], ai: "Outlet benchmarking" },
];

export const verticalDeepDives = [
  {
    name: "Gym & Fitness",
    icon: "Dumbbell",
    features: ["Memberships", "Plans", "Subscriptions", "Member Profiles", "Attendance", "Biometric Integration", "Trainer Management", "Workout Plans", "Diet Plans", "Payments", "Renewals", "Lead Management", "Staff Management", "AI Member Insights", "Churn Prediction"],
  },
  {
    name: "Salon & Spa",
    icon: "Scissors",
    features: ["Appointments", "Services", "Staff & Stylists", "Customers", "Memberships", "Packages", "POS", "Inventory", "Commission", "Payments", "Loyalty", "Reviews", "Notifications", "AI Recommendations"],
  },
  {
    name: "Restaurant",
    icon: "ChefHat",
    features: ["Restaurant POS", "Table Management", "Reservations", "Menu Management", "KOT", "Kitchen Display", "Waiter Management", "Takeaway & Delivery", "QR Ordering", "Split Bills", "Recipe Management", "Food Cost", "AI Demand Forecasting"],
  },
  {
    name: "Manufacturing",
    icon: "Factory",
    features: ["Raw Materials", "BOM", "Production Planning", "Work Orders", "Quality Control", "Machine Maintenance", "Procurement", "Warehouse", "Vendors", "Production Analytics", "AI Production Forecasting"],
  },
  {
    name: "Logistics",
    icon: "Truck",
    features: ["Fleet", "Vehicles", "Drivers", "Routes", "Fuel", "Delivery", "Tracking", "Warehouse", "Orders", "Route Optimization", "AI Logistics Intelligence"],
  },
  {
    name: "Agriculture",
    icon: "Sprout",
    features: ["Farmer Management", "Crop Management", "Procurement", "Marketplace", "Inventory", "Warehouse", "Mandi / Market Data", "Weather", "IoT", "AI Crop Intelligence"],
  },
];

export const aiCapabilities = [
  "AI Business Assistant",
  "AI Inventory Forecast",
  "AI Demand Forecast",
  "AI Sales Forecast",
  "AI Customer Insights",
  "AI Lead Scoring",
  "AI Churn Prediction",
  "AI Recommendations",
  "AI Dynamic Pricing",
  "AI Fraud Detection",
  "AI Document Intelligence",
  "AI OCR",
  "AI Reports",
  "AI Workflow Automation",
  "AI Voice Assistant",
  "AI Search",
  "AI Product Descriptions",
  "AI Business Insights",
];

export const omnichannels = [
  "Physical Store",
  "POS",
  "Website",
  "Mobile App",
  "Marketplace",
  "Social Commerce",
  "B2B Portal",
  "Wholesale",
  "Delivery",
];

export const biDashboards = [
  { name: "Sales", metric: "₹12.4L", delta: "+6.2%", note: "Week to date across 8 outlets" },
  { name: "Inventory", metric: "94.1%", delta: "+1.4%", note: "Stock availability score" },
  { name: "Customers", metric: "3,284", delta: "+184", note: "Active buyers this month" },
  { name: "Finance", metric: "₹3.1L", delta: "-2.1%", note: "Receivables overdue" },
  { name: "Vendors", metric: "126", delta: "+9", note: "Active marketplace vendors" },
  { name: "Orders", metric: "1,942", delta: "+11.8%", note: "Fulfilled across channels" },
  { name: "Marketing", metric: "4.6x", delta: "+0.4x", note: "Campaign return" },
  { name: "HR", metric: "96.3%", delta: "+0.8%", note: "Attendance compliance" },
  { name: "Operations", metric: "28 min", delta: "-4 min", note: "Average fulfilment time" },
];

export const integrationCategories = [
  { name: "Payments", examples: ["Payment gateways", "UPI", "Cards"], status: "Available" },
  { name: "Communication", examples: ["WhatsApp", "SMS", "Email"], status: "Available" },
  { name: "Social Commerce", examples: ["Meta", "Instagram Shops"], status: "Planned" },
  { name: "Food Delivery", examples: ["Zomato", "Swiggy"], status: "Planned" },
  { name: "Shipping", examples: ["Shipping aggregators", "Courier APIs"], status: "Available" },
  { name: "Accounting", examples: ["Ledger export", "Tax filing tools"], status: "Available" },
  { name: "Maps", examples: ["Google Maps", "Geocoding"], status: "Available" },
  { name: "AI", examples: ["AI model providers", "OCR services"], status: "Available" },
  { name: "Cloud", examples: ["Cloud hosting", "Object storage"], status: "Available" },
  { name: "Analytics", examples: ["Web analytics", "Event tracking"], status: "Available" },
  { name: "Calendar", examples: ["Google Calendar", "Scheduling"], status: "Planned" },
  { name: "CRM", examples: ["Lead sources", "Ad platforms"], status: "Planned" },
];

export const securityFeatures = [
  "Role Based Access Control",
  "Multi-Tenant Architecture",
  "Audit Logs",
  "Data Encryption",
  "API Security",
  "SSO-ready Architecture",
  "Granular Permissions",
  "Approval Workflows",
  "Backups",
  "Monitoring",
  "Compliance-ready Architecture",
];

export const howItWorks = [
  { step: "01", title: "Connect Your Business", detail: "Add companies, branches, teams and master data in a guided setup." },
  { step: "02", title: "Configure Your Modules", detail: "Switch on only what you need — POS, inventory, CRM, finance, HR." },
  { step: "03", title: "Connect Your Channels", detail: "Link store, marketplace, B2B portal, delivery and payments." },
  { step: "04", title: "Run With AI", detail: "Let the copilot forecast, alert and automate daily decisions." },
];

export const useCases = [
  { name: "Supermarket", flow: ["Inventory", "POS", "Store", "Delivery", "CRM", "AI Forecast"] },
  { name: "Restaurant", flow: ["Table", "POS", "KOT", "Kitchen", "Billing", "Delivery", "CRM"] },
  { name: "Gym", flow: ["Lead", "Membership", "Attendance", "Trainer", "Payment", "Retention AI"] },
  { name: "Salon", flow: ["Appointment", "Service", "POS", "Inventory", "Payment", "Loyalty"] },
  { name: "Wholesale", flow: ["RFQ", "Quote", "Bulk Order", "Warehouse", "Invoice", "Delivery"] },
  { name: "Fashion Store", flow: ["Catalog", "Inventory", "Store", "Order", "Delivery", "CRM"] },
];

export const pricingPlans = [
  {
    name: "Starter",
    tagline: "For single-location businesses getting organised.",
    price: "Custom",
    highlight: false,
    features: ["Up to 5 users", "1 branch", "POS + Inventory", "Basic analytics", "Email support"],
    cta: "Get Started",
  },
  {
    name: "Growth",
    tagline: "For growing multi-channel retailers and restaurants.",
    price: "Custom",
    highlight: true,
    features: ["Up to 25 users", "Up to 5 branches", "POS, Inventory, CRM, Store", "AI forecasting included", "Priority support"],
    cta: "Get Started",
  },
  {
    name: "Professional",
    tagline: "For multi-branch operations and marketplaces.",
    price: "Custom",
    highlight: false,
    features: ["Up to 100 users", "Unlimited branches", "Marketplace + B2B portal", "Advanced AI usage", "Dedicated onboarding"],
    cta: "Get Started",
  },
  {
    name: "Enterprise",
    tagline: "For groups, franchises and enterprise rollouts.",
    price: "Talk to Sales",
    highlight: false,
    features: ["Unlimited users", "Multi-tenant deployment", "All modules & AI", "Custom integrations", "Named success manager"],
    cta: "Talk to Sales",
  },
];

export const resources = [
  { name: "Blog", detail: "Operating notes on retail, commerce and AI." },
  { name: "Case Studies", detail: "How teams run their operations on IOTRONICS." },
  { name: "Product Guides", detail: "Module-by-module setup walkthroughs." },
  { name: "Industry Guides", detail: "Playbooks for retail, F&B, wholesale and more." },
  { name: "Documentation", detail: "Configuration, data model and workflows." },
  { name: "API", detail: "REST endpoints, webhooks and developer keys." },
  { name: "FAQs", detail: "Answers on rollout, migration and support." },
];
