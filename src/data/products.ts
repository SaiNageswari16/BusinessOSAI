export type ProductItem = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  tags: string[];
  category: string;
  image: string;
  icon: string;
  badge?: string;
  externalUrl?: string;
  highlights: string[];
  features: { title: string; desc: string }[];
  benefits: string[];
  techStack: string[];
  stats?: { value: string; label: string }[];
};

export const products: ProductItem[] = [
  {
    id: "ai-business-os",
    name: "IOTRONICS – Retail",
    tagline: "BusinessOS AI for Retail & Commerce",
    description:
      "Manage your stores, warehouses, suppliers, online sales, finance and teams in one AI-powered platform. Built for modern retail, wholesale and multi-branch commerce businesses.",
    tags: [
      "ERP",
      "Inventory & RAG",
      "POS",
      "Finance",
      "CRM",
      "Procurement",
      "HRMS",
      "IoT & Fleet",
      "BI Copilot",
    ],
    category: "Enterprise Business Operating System",
    image: "/images/app-retail.jpg",
    icon: "Building2",
    badge: "Flagship Business OS",
    highlights: [
      "Connect inventory, sales, purchasing, accounting, and CRM in one centralized system",
      "Reduce repetitive work with dual parallel AI workers and automated product catalog enrichment",
      "Real-time business visibility across multi-branch retail, wholesale, and distribution networks",
      "Cryptographically isolated multi-tenant architecture with granular role-based access control",
    ],
    features: [
      {
        title: "Intelligent Inventory & AI RAG",
        desc: "Complete stock control with automated barcode enrichment, batch/serial/expiry tracking, multi-warehouse transfers, and smart reordering.",
      },
      {
        title: "Smart Point of Sale (POS)",
        desc: "High-speed billing with dual retail/wholesale pricing, multi-currency ₹ INR support, cashier register controls, split payments, and thermal receipts.",
      },
      {
        title: "Core ERP & Multi-Branch Engine",
        desc: "Centralized product master, company & branch management, approval workflows, inter-module data synchronization, and organization-level audit logs.",
      },
      {
        title: "Finance & Double-Entry Accounting",
        desc: "Automated general ledger, accounts receivable & payable, cash flow management, P&L, balance sheets, and 1-click GSTR tax exports.",
      },
      {
        title: "Sales & Customer CRM",
        desc: "Customer 360° profiles, sales pipeline tracking, customer segmentation, automated follow-up reminders, and AI-assisted buying pattern insights.",
      },
      {
        title: "Procurement & Vendor Management",
        desc: "Supplier price catalogs, purchase requisitions, PO approval workflows, goods receipt notes (GRN), and purchase-to-payment reconciliation.",
      },
      {
        title: "HRMS & Payroll Administration",
        desc: "Employee records, shift schedules, biometric attendance integration, leave management, automated payroll, and statutory deductions.",
      },
      {
        title: "IoT & Fleet Operations",
        desc: "Connected hardware monitoring, warehouse environmental temperature/humidity sensors, GPS fleet tracking, and logistics intelligence.",
      },
      {
        title: "AI Copilot & Business Intelligence",
        desc: "Natural language query copilot, predictive demand forecasting, dead-stock markdown AI, branch sales telemetry, and interactive KPI dashboards.",
      },
    ],
    benefits: [
      "Save 20+ hours weekly on manual data reconciliation across departments",
      "Reduce stockouts and expired inventory by up to 34% with predictive reordering",
      "Accelerate checkout speeds with sub-12ms local queries and zero UI delay",
      "Multi-branch ready to scale across stores, distribution hubs, and franchises",
    ],
    techStack: [
      "React 19",
      "PostgreSQL",
      "FastAPI / Node",
      "Redis Cache",
      "Vector Embeddings",
      "IoT Hardware Sync",
    ],
    stats: [
      { value: "0ms", label: "UI Latency" },
      { value: "99.4%", label: "AI Sourcing Accuracy" },
      { value: "₹ INR", label: "Multi-Currency Ready" },
      { value: "100%", label: "Multi-Branch Control" },
    ],
  },
  {
    id: "fit-club-ai",
    name: "IOTRONICS – Gym",
    tagline: "The Complete Gym Management OS",
    description:
      "An end-to-end, AI-powered platform to run single or multi-branch gyms, fitness studios, and wellness centers — from member onboarding to performance tracking, billing, staff, inventory and financials.",
    tags: [
      "Gym & Fitness",
      "Biometric Access",
      "Membership Subscriptions",
      "Personal Training",
      "Workout AI",
      "Multi-Branch",
    ],
    category: "AI-Powered Gym & Fitness Management",
    image: "/images/app-gym.jpg",
    icon: "Dumbbell",
    badge: "Gym OS",
    externalUrl: "https://gym.lazymonkeyai.com/",
    highlights: [
      "Hardware-integrated biometric turnstile gate access with real-time occupancy telemetry",
      "Automated WhatsApp fee renewal reminders and instant 1-click UPI payment links",
      "Complete 16-module operational suite: workouts, diet, trainers, POS, classes, and CRM",
      "Multi-tenant and multi-branch architecture with granular role-based permissions for 9 user roles",
    ],
    features: [
      {
        title: "Dashboard & Business Overview",
        desc: "Live KPI cards for active members, daily check-ins, monthly revenue, renewal queues, and trainer utilization.",
      },
      {
        title: "Member Management",
        desc: "Comprehensive member profiles with unique member ID/QR code, health logs, emergency contacts, and status tracking.",
      },
      {
        title: "Membership & Subscriptions",
        desc: "Flexible monthly/annual plans, freeze/pause rules, automated upcoming renewal detection, and plan upgrade workflows.",
      },
      {
        title: "Smart Attendance & Turnstile Access",
        desc: "QR code and biometric gate validation, anti-passback prevention, live floor capacity, and member retention alerts.",
      },
      {
        title: "Trainer & Staff Management",
        desc: "Trainer scheduling, personal training session allocations, automated commission calculations, and performance metrics.",
      },
      {
        title: "Workout & Fitness Programs",
        desc: "Exercise demo library, customizable workout split templates, sets/reps/weight tracking, and progress logs.",
      },
      {
        title: "Fitness Assessment & Body Metrics",
        desc: "Periodic fitness reassessments, weight, body measurements, milestone photos, and visual goal comparison charts.",
      },
      {
        title: "Billing, Payments & POS Finance",
        desc: "Invoice generation, split Cash/Card/UPI payments, receipt generation, expense recording, and collection reconciliation.",
      },
      {
        title: "Supplement Inventory & Equipment",
        desc: "Shake bar and retail supplement POS, barcode checkout, low-stock alerts, and gym equipment maintenance logs.",
      },
      {
        title: "Class & Group Scheduling",
        desc: "Timetable management for Yoga, Zumba, CrossFit, and spinning with studio capacity limits and waitlists.",
      },
      {
        title: "Nutrition & Diet Planning",
        desc: "Structured daily meal plans, calorie/macro targets, dietary restriction logs, and member adherence tracking.",
      },
      {
        title: "Reports & Business Analytics",
        desc: "Membership growth, churn rates, branch-wise revenue breakdowns, trainer workload, and exportable CSV/PDF reports.",
      },
      {
        title: "AI Fitness & Business Assistant",
        desc: "Natural language query engine, automated renewal follow-up drafts, churn signals, and class demand forecasting.",
      },
      {
        title: "CRM, Leads & Engagement",
        desc: "Walk-in lead tracking, trial workout bookings, automated WhatsApp notifications, and customer retention campaigns.",
      },
      {
        title: "Multi-Branch & Franchises",
        desc: "Centralized controls for multi-location gyms, cross-branch access permissions, and consolidated financial reporting.",
      },
      {
        title: "Administration & Security",
        desc: "Role-based access controls (RBAC) across 9 user roles, audit trails, data isolation, and automated backups.",
      },
    ],
    benefits: [
      "Save 15+ hours per week on manual attendance, payment follow-ups, and scheduling",
      "Reduce membership churn by 35% with proactive automated renewal reminders",
      "Accelerate member check-ins with 0.2s QR and biometric turnstile unlock",
      "Multi-branch and franchise ready with centralized enterprise administration",
    ],
    techStack: [
      "Next.js + React 19",
      "Python + FastAPI",
      "PostgreSQL",
      "SQLAlchemy + Alembic",
      "Redis + Celery",
      "Recharts",
      "QR & Biometrics",
    ],
    stats: [
      { value: "0.2s", label: "Turnstile Gate Unlock" },
      { value: "80%", label: "Less Manual Chasing" },
      { value: "16", label: "Core Modules" },
      { value: "100%", label: "Multi-Club Ready" },
    ],
  },
  {
    id: "salon-os",
    name: "IOTRONICS – Luxury Saloon",
    tagline: "The Complete Saloon Management OS",
    description:
      "An all-in-one, AI-powered platform to run modern salons, spas and wellness clinics — from online booking and client care to staff, inventory, billing and business growth.",
    tags: [
      "Appointment Booking",
      "Customer Management",
      "Billing & Payments",
      "Staff Management",
      "Inventory Tracking",
    ],
    category: "Luxury Salon Operating System",
    image: "/images/app-salon.jpg",
    icon: "Scissors",
    badge: "Luxury Salon OS",
    externalUrl: "https://saloon.lazymonkeyai.com/",
    highlights: [
      "Frictionless online appointment booking with real-time stylist availability",
      "360° customer profile with past treatments, color formulas & preferences",
      "Automated staff commission calculations & beauty consumable stock tracking",
    ],
    features: [
      {
        title: "Dashboard & Business Overview",
        desc: "Live daily bookings, completed treatments, chair utilization, revenue charts, stylist workload, and low-stock alerts.",
      },
      {
        title: "Customer Management (CRM & 360° Profiles)",
        desc: "Complete client history, custom color mixing formulas, past treatments, stylist preferences, allergy alerts, and VIP tiers.",
      },
      {
        title: "Service & Price Management",
        desc: "Categorized service menu (Hair, Spa, Skin, Nails, Bridal), duration, buffer times, tiered stylist pricing, and package bundles.",
      },
      {
        title: "Appointment & Booking Matrix",
        desc: "Interactive multi-chair calendar, online self-booking, walk-in queue management, deposit rules, and double-booking prevention.",
      },
      {
        title: "Staff, Stylist & Workforce Management",
        desc: "Shift rosters, stylist qualifications, biometric attendance, tiered service commission splits, and performance benchmarks.",
      },
      {
        title: "Billing, Payments & Point of Sale (POS)",
        desc: "Fast checkout for services and retail items, split payments (Cash, Card, UPI), digital tips, coupons, and automatic tax invoices.",
      },
      {
        title: "Inventory & Consumables Tracking",
        desc: "Gram-level backbar consumable tracking (color, developer, bleach) auto-deducted per service, plus retail haircare stock POs.",
      },
      {
        title: "Memberships, Packages & Loyalty",
        desc: "Prepaid service packages, customer loyalty points, birthday pampering perks, gift cards, and automated renewal reminders.",
      },
      {
        title: "Customer Experience & Feedback",
        desc: "Post-appointment feedback surveys, stylist review scores, complaint resolutions, and repeat visit retention tracking.",
      },
      {
        title: "Reports & Business Analytics",
        desc: "Revenue Per Available Chair Hour (RevPASH), average ticket size (ATS), stylist commission summaries, and exportable PDF audits.",
      },
      {
        title: "AI-Powered Salon Assistant",
        desc: "Natural language query engine, cancellation pattern detection, automated 4-6 week touch-up rebooking drafts, and inventory forecasting.",
      },
      {
        title: "CRM, Marketing & Customer Retention",
        desc: "Automated WhatsApp and SMS rebooking campaigns, lead pipeline tracking, customer segmentation, and promotional offers.",
      },
      {
        title: "Multi-Branch & Franchise Management",
        desc: "Centralized multi-salon administration, cross-branch client profiles, stock transfers, and comparative revenue analytics.",
      },
      {
        title: "Administration, Security & Settings",
        desc: "Role-based access controls (RBAC) across 9 user roles, audit trails, organization data isolation, and automated backups.",
      },
    ],
    benefits: [
      "Bring appointments, billing, client records, and inventory together in one workspace",
      "Eliminate booking conflicts and reduce salon no-shows by 40% with WhatsApp reminders",
      "Protect client formula history with 360° color mixing cards and patch test records",
      "Automate multi-tier stylist commissions and gram-level backbar consumable deductions",
    ],
    techStack: [
      "Next.js + React 19",
      "Python + FastAPI",
      "PostgreSQL",
      "SQLAlchemy + Alembic",
      "Redis + Celery",
      "Recharts",
      "WhatsApp Cloud API",
    ],
    stats: [
      { value: "40%", label: "Fewer No-Shows" },
      { value: "100%", label: "Formula Precision" },
      { value: "14", label: "Core Modules" },
      { value: "Multi-Branch", label: "Ready" },
    ],
  },
  {
    id: "restaurant-os",
    name: "IOTRONICS – Restaurant",
    tagline: "The Complete Restaurant Management OS",
    description:
      "An all-in-one, AI-powered platform to run restaurants, cafés, cloud kitchens and multi-branch food brands — from table booking and kitchen operations to delivery, inventory, billing and growth.",
    tags: [
      "Table & Reservation",
      "POS & Billing",
      "Kitchen Display (KDS)",
      "Online Ordering",
      "Inventory & Purchase",
      "Delivery & Dispatch",
    ],
    category: "Restaurant & Food Service Operating System",
    image: "/images/app-restaurant.jpg",
    icon: "Utensils",
    badge: "Restaurant OS",
    externalUrl: "https://restaurant.lazymonkeyai.com/",
    highlights: [
      "Real-time kitchen order queue and digital KDS station routing",
      "Integrated table reservation, QR dine-in ordering and contactless digital payments",
      "Gram-level recipe ingredient mapping with real-time stock deduction and auto-reorder",
      "Multi-outlet and franchise central control with aggregator syncing",
    ],
    features: [
      {
        title: "Table & Reservation",
        desc: "Online table booking, guest waitlists, floor status, and dining preferences.",
      },
      {
        title: "POS & Billing",
        desc: "Fast touch POS, split bills, tips, combo menus, and multi-channel payment reconciliation.",
      },
      {
        title: "Kitchen Display (KDS)",
        desc: "Color-coded order preparation tickets, station-wise routing, and course timers.",
      },
      {
        title: "Inventory & Recipe Management",
        desc: "Live batch ingredient tracking, dish BOM cost calculation, and wastage alerts.",
      },
    ],
    benefits: [
      "Reduce kitchen turnaround time by up to 25% with live digital KDS routing",
      "Eliminate order mistakes with integrated dine-in QR ordering and split-table checks",
      "Prevent ingredient theft and food wastage with real-time bill-of-materials deduction",
      "Centralized menu, pricing, and tax control across multiple restaurant outlets",
    ],
    techStack: [
      "React 19",
      "FastAPI / Python",
      "PostgreSQL",
      "Redis Queue",
      "KDS WebSockets",
      "Thermal Print SDK",
    ],
    stats: [
      { value: "3,420+", label: "Total Orders" },
      { value: "< 8min", label: "KDS Prep Time" },
      { value: "₹9.84L", label: "Monthly Revenue" },
      { value: "99.9%", label: "Uptime" },
    ],
  },
];

export const commonFeatures = [
  {
    title: "Artificial Intelligence",
    description:
      "Automate repetitive tasks, uncover hidden insights, and simplify complex business decisions.",
    icon: "Sparkles",
  },
  {
    title: "Smart Analytics",
    description:
      "Turn business data from every department into clear, actionable executive insights in real time.",
    icon: "BarChart3",
  },
  {
    title: "Workflow Automation",
    description:
      "Eliminate manual handoffs, reduce human errors, and dramatically improve operational efficiency.",
    icon: "Workflow",
  },
  {
    title: "Connected Solutions",
    description:
      "Seamlessly share data across sales, fitness, beauty, inventory, and operations without brittle glue code.",
    icon: "Boxes",
  },
  {
    title: "Scalable Technology",
    description:
      "Enterprise-ready architecture engineered to scale from single startups to multi-branch enterprises.",
    icon: "ShieldCheck",
  },
];

export const whyIotronics = [
  "AI-Powered Automation",
  "Smart Business Insights",
  "Connected Applications",
  "Simplified Workflows",
  "Scalable Solutions",
];
