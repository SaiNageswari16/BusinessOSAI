import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Building2,
  Dumbbell,
  Scissors,
  Layers,
  Zap,
  ShieldCheck,
  Cpu,
  RefreshCw,
  QrCode,
  Calendar,
  CreditCard,
  UserCheck,
  TrendingUp,
  Clock,
  HelpCircle,
  FileText,
  ChevronRight,
  ChevronDown,
  Database,
  Sliders,
  Send,
  Check,
  Lock,
  Smartphone,
  Server,
  Activity,
  Award,
  Users,
  Package,
  ShoppingBag,
  Calculator,
  Briefcase,
  Wifi,
  Bot,
  BarChart3,
  BadgePercent,
  CheckCheck,
  Receipt,
  ScanLine,
  Boxes,
  HeartPulse,
  Timer,
  Flame,
  Scale,
  Sparkle,
  Phone,
  MessageSquare,
  Truck,
  DollarSign,
  Globe,
  Radio,
  FileSpreadsheet,
  Headphones,
  Settings,
  HardDrive,
  CheckSquare,
  Square,
  UserPlus,
  HeartHandshake,
  Utensils,
  Wrench,
  KeyRound,
  LayoutGrid
} from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { products, type ProductItem } from "@/data/products";
import { Icon } from "@/components/site/icon";

export const Route = createFileRoute("/products/$productId")({
  component: ProductDetailPage,
});

/* =========================================================================
   1. AI BUSINESS OS — ENTERPRISE CONTROL TOWER TEMPLATE
   ========================================================================= */
function AiBusinessOsTemplate({ product }: { product: ProductItem }) {
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [activePricingTab, setActivePricingTab] = useState<"retail" | "wholesale">("retail");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // 9 Core Modules from Prompt
  const coreModules = [
    {
      id: "inventory-rag",
      name: "1. Intelligent Inventory & AI RAG",
      icon: Package,
      headline: "Complete Control Over Your Products, Stock, and Warehouses",
      desc: "Manage your entire product catalog, monitor stock movements, organize warehouses, and automate inventory workflows with AI-powered assistance.",
      badge: "AI RAG • 0ms Delay",
      sections: [
        {
          title: "AI-Powered Product Enrichment",
          points: [
            "Automatically enrich product information using barcode and catalog data",
            "Generate structured product titles and standardized descriptions",
            "Retrieve and associate high-resolution product images from verified sources",
            "Assist with product classification and automated HSN identification",
            "Review and validate missing or incomplete product attributes"
          ]
        },
        {
          title: "Barcode & SKU Management",
          points: [
            "Instant search using 1D/2D barcodes, SKUs, and product names",
            "Create, print, and manage custom product identifiers and labels",
            "Bulk import thousands of products via Excel/CSV with schema mapping",
            "Support high-speed barcode-based stock auditing and transfers"
          ]
        },
        {
          title: "Multi-Warehouse & Branch Inventory",
          points: [
            "Live stock visibility across central warehouses, hubs, and retail branches",
            "Track inter-warehouse transfers with transit confirmation workflows",
            "Configure storage zones, racks, bins, and picking workflows",
            "Maintain location-specific safety stocks and inventory allocations"
          ]
        },
        {
          title: "Batch, Serial & Expiry Tracking",
          points: [
            "Track batch numbers and unique serial numbers for electronics/appliances",
            "Automated product expiry date monitoring and shelf-life tracking",
            "Proactive low-stock and upcoming expiry alert notifications",
            "Enforce FIFO, LIFO, and FEFO inventory picking strategies"
          ]
        },
        {
          title: "Smart Reordering & Inventory Reports",
          points: [
            "Configure dynamic minimum and maximum stock level thresholds",
            "Generate automated replenishment purchase order suggestions",
            "Fast-moving vs slow-moving dead stock telemetry",
            "Comprehensive valuation, shortage, and warehouse utilization reports"
          ]
        }
      ]
    },
    {
      id: "pos-billing",
      name: "2. Smart Point of Sale (POS)",
      icon: ShoppingBag,
      headline: "Faster Billing. Smarter Selling. Better Customer Experiences.",
      desc: "Simplify retail and wholesale transactions with an intelligent POS system that connects billing, inventory, customer records, and sales reporting.",
      badge: "Multi-Currency • ₹ INR",
      sections: [
        {
          title: "Fast Billing & Checkout",
          points: [
            "Barcode scanner, touchscreen grid, and lightning product search",
            "Quick product selection and instant quantity adjustment",
            "Real-time cart calculation with automated tax, discounts, and rounding",
            "Instant 80mm thermal receipt printing and digital WhatsApp/email invoices"
          ]
        },
        {
          title: "Retail & Wholesale Pricing Tiers",
          points: [
            "Maintain separate retail RSP and wholesale price tiers in real time",
            "Support customer-specific custom pricing rules and credit terms",
            "Apply authorized cashier discounts with managerial PIN overrides",
            "Manage quantity-based slab pricing and bulk volume breaks"
          ]
        },
        {
          title: "Multi-Currency & Payment Management",
          points: [
            "Full support for ₹ INR and global configured currencies",
            "Accept Cash, Card, Dynamic UPI QR codes, and digital wallets",
            "Multi-tender split payments (e.g. ₹500 Cash + ₹1,500 UPI)",
            "Integrated refund processing and payment adjustment tracking"
          ]
        },
        {
          title: "Cashier Registers & Returns",
          points: [
            "Assign cashiers to specific registers with opening/closing floats",
            "Track register cash-up transactions and end-of-day discrepancy summaries",
            "Process eligible sales returns with automated restocking to inventory",
            "Maintain cryptographically verifiable transaction audit trails"
          ]
        }
      ]
    },
    {
      id: "core-erp",
      name: "3. Core ERP Platform",
      icon: Layers,
      headline: "One Central System for Your Entire Business",
      desc: "Bring all your departments, branches, users, and business processes together with a centralized enterprise resource planning platform.",
      badge: "Multi-Tenant • RBAC",
      sections: [
        {
          title: "Company & Branch Hierarchy",
          points: [
            "Centralized multi-company, subsidiary, and branch outlet management",
            "Unified product master and shared service catalog across entities",
            "Granular role-based access control (RBAC) and user permission matrices",
            "Configurable departmental units (Sales, Procurement, Logistics, Accounts)"
          ]
        },
        {
          title: "Governance & Approvals",
          points: [
            "Multi-level approval workflows for purchase orders and high-value refunds",
            "Inter-module real-time data synchronization with zero manual reconciliation",
            "Immutable activity audit trails tracking every edit, deletion, and export",
            "Organization-wide executive dashboards with consolidated performance KPIs"
          ]
        }
      ]
    },
    {
      id: "finance-accounting",
      name: "4. Finance & Accounting",
      icon: Calculator,
      headline: "Complete Financial Visibility and Control",
      desc: "Manage your financial transactions, accounting records, expenses, invoices, and financial reports through one integrated accounting system.",
      badge: "Double-Entry • 1-Click Tax",
      sections: [
        {
          title: "General Accounting & Ledgers",
          points: [
            "Configurable multi-level Chart of Accounts tailored to your industry",
            "Strict double-entry bookkeeping with automated general ledger postings",
            "Manual journal entries and financial accounting period closing",
            "Dynamic bank account and gateway transaction reconciliation"
          ]
        },
        {
          title: "Accounts Receivable & Payable (AR / AP)",
          points: [
            "Customer tax invoices, credit notes, and outstanding receivable tracking",
            "Receivable aging breakdown reports (30 / 60 / 90+ days)",
            "Supplier bills, vendor payment schedules, and liability reports",
            "Three-way purchase-to-payment matching (PO vs GRN vs Bill)"
          ]
        },
        {
          title: "Expenses, Cash Flow & Financial Reports",
          points: [
            "Categorized expense tracking with receipt attachment and tax input claim",
            "Real-time Profit & Loss (P&L) statements, Balance Sheet, and Trial Balance",
            "Live Cash Flow statements and liquidity forecasting",
            "1-Click tax-related reports and GSTR-1 / 3B compatible data exports"
          ]
        }
      ]
    },
    {
      id: "sales-crm",
      name: "5. Sales & CRM",
      icon: Users,
      headline: "Understand Your Customers. Build Stronger Relationships.",
      desc: "Centralize customer information, manage sales opportunities, track follow-ups, and improve customer engagement through an integrated CRM platform.",
      badge: "Customer 360° • AI Insights",
      sections: [
        {
          title: "Customer 360° Profiles & Pipeline",
          points: [
            "Comprehensive customer profiles with contact details and billing addresses",
            "Lead and prospect tracking with customizable deal stages and pipelines",
            "Visual customer segmentation by purchase volume and frequency",
            "Complete lifetime order history, payment records, and communication logs"
          ]
        },
        {
          title: "AI-Assisted Sales Intelligence",
          points: [
            "Automated follow-up reminders and activity notifications for sales reps",
            "Customer-specific discount structures and pre-approved credit terms",
            "AI analysis of customer buying patterns to identify repeat order cycles",
            "Churn prediction and retention insights based on purchase gaps"
          ]
        }
      ]
    },
    {
      id: "procurement",
      name: "6. Procurement & Vendor Management",
      icon: Truck,
      headline: "Simplify Purchasing from Request to Payment",
      desc: "Manage suppliers, purchasing activities, incoming stock, purchase orders, and supplier payments through a connected procurement workflow.",
      badge: "3-Way Matching • GRN",
      sections: [
        {
          title: "Vendor Management & RFQs",
          points: [
            "Supplier master profiles, contact representatives, and tax credentials",
            "Vendor-specific product catalogs, negotiated price lists, and lead times",
            "Supplier performance history, on-time delivery rate, and quality tracking",
            "Purchase requisitions, supplier quotation comparisons, and PO approvals"
          ]
        },
        {
          title: "Goods Receipt (GRN) & Payment",
          points: [
            "Goods Receipt Note (GRN) generation upon warehouse truck arrival",
            "Verification of received quantities against open purchase orders",
            "Damaged or missing item logging with automatic debit note preparation",
            "Automated stock level increment upon confirmation and bill booking"
          ]
        }
      ]
    },
    {
      id: "hrms-payroll",
      name: "7. HRMS & Payroll",
      icon: Briefcase,
      headline: "Manage Your People and Workforce in One Place",
      desc: "Simplify employee administration, attendance, leave, payroll, and workforce operations through a centralized HRMS platform.",
      badge: "Biometrics • Payroll",
      sections: [
        {
          title: "Employee Profiles & Shift Rosters",
          points: [
            "Employee master profiles, designations, department, and branch assignments",
            "Daily attendance records with biometric hardware (ZKTeco/Essl) sync",
            "Shift scheduling, rotational work rosters, and late-punch policies",
            "Online leave application, balance tracking, and managerial approval chains"
          ]
        },
        {
          title: "Automated Payroll & Compliance",
          points: [
            "Salary structure configuration with customizable earnings and allowances",
            "Automated monthly payroll calculation based on verified attendance logs",
            "1-Click PDF payslip generation and employee self-service downloads",
            "Support for statutory deductions including PF, ESI, TDS, and Professional Tax"
          ]
        }
      ]
    },
    {
      id: "iot-fleet",
      name: "8. IoT & Fleet Operations",
      icon: Wifi,
      headline: "Connect Your Physical Operations with Your Business Data",
      desc: "Extend your business platform to connected devices, vehicles, logistics, and operational monitoring through supported hardware and integrations.",
      badge: "GPS • Sensors • Telemetry",
      sections: [
        {
          title: "Device & Environmental Monitoring",
          points: [
            "Hardware device registration, connection heartbeat, and health alerts",
            "Real-time warehouse temperature and humidity monitoring for cold chains",
            "Threshold-based instant alert notifications when limits are breached",
            "Historical sensor telemetry logs for audit and compliance reporting"
          ]
        },
        {
          title: "Fleet Tracking & Logistics",
          points: [
            "Delivery vehicle records, maintenance logs, and driver assignments",
            "GPS location tracking through compatible hardware and API integrations",
            "Live movement records, delivery route history, and dispatch statuses",
            "Fleet utilization analysis to optimize fuel costs and turnaround times"
          ]
        }
      ]
    },
    {
      id: "ai-copilot",
      name: "9. AI Copilot & Business Intelligence",
      icon: Bot,
      headline: "Turn Business Data into Actionable Decisions",
      desc: "Use AI-assisted analysis and business intelligence tools to understand performance, identify operational issues, and make better-informed decisions.",
      badge: "Natural Language • BI",
      sections: [
        {
          title: "Conversational Business Assistant",
          points: [
            "Ask business questions in natural plain English (e.g. 'Show top branches this month')",
            "Instant executive summaries of sales, gross margins, and inventory health",
            "Retrieve context-aware information from authorized operational records",
            "Explain sudden variance trends and Key Performance Indicators (KPIs)"
          ]
        },
        {
          title: "Predictive Intelligence & Dashboards",
          points: [
            "Demand forecasting algorithms to anticipate upcoming seasonal stock surges",
            "Dead-stock identification with intelligent promotional discount suggestions",
            "Parallel background AI processing for heavy analytics without UI lag",
            "Interactive KPI cards, sales charts, branch comparisons, and exportable data"
          ]
        }
      ]
    }
  ];

  // AI Product Enrichment 5-Step Workflow
  const enrichmentSteps = [
    {
      step: "01",
      title: "Import Products",
      desc: "Upload a barcode list, SKU file, or existing catalog in CSV / Excel format."
    },
    {
      step: "02",
      title: "Retrieve Available Data",
      desc: "Search supported catalogs and configured global data sources for matching records."
    },
    {
      step: "03",
      title: "Process Data with AI",
      desc: "Parallel background workers retrieve, organize, and enrich missing product fields."
    },
    {
      step: "04",
      title: "Validate Results",
      desc: "Apply schema validation, tax rules, and manual review where necessary."
    },
    {
      step: "05",
      title: "Save to Live Inventory",
      desc: "Store approved product details directly into the catalog for POS, purchasing, and stock."
    }
  ];

  const supportedFields = [
    "Product Name & Title",
    "Brand & Category",
    "Barcode & SKU",
    "Product Description",
    "Product Images",
    "Attributes & Units",
    "MRP & Selling Price",
    "HSN Identification",
    "Status & History"
  ];

  const enterpriseServices = [
    {
      title: "AI Model Customization",
      icon: Bot,
      desc: "Configure specialized AI workflows for your custom business processes, proprietary catalogs, internal knowledge bases, and industry terminology."
    },
    {
      title: "POS Hardware Integration",
      icon: HardDrive,
      desc: "Configure compatible handheld/desktop barcode scanners, thermal receipt printers, cash drawers, touch terminals, and scale hardware."
    },
    {
      title: "Cloud & Database Deployment",
      icon: Server,
      desc: "Plan enterprise cloud hosting, PostgreSQL database deployment, automated backup policies, auto-scaling, and regional infrastructure."
    },
    {
      title: "Legacy Data Migration",
      icon: Database,
      desc: "Seamlessly extract and migrate your historical product catalogs, inventory balances, customers, supplier accounts, and past transactions."
    },
    {
      title: "System Integration",
      icon: RefreshCw,
      desc: "Connect compatible third-party systems, online payment gateways, WhatsApp communication APIs, and logistics partners."
    },
    {
      title: "Enterprise Support & SLA",
      icon: Headphones,
      desc: "Dedicated onboarding architects, 24/7 technical support arrangements, guaranteed response SLAs, and scheduled quarterly reviews."
    }
  ];

  const pricingPlans = [
    {
      name: "Free Workspace",
      tagline: "For individuals and small businesses exploring the platform",
      price: "$0",
      period: "forever",
      badge: "Get Started",
      highlight: false,
      features: [
        "Basic company workspace",
        "Core product catalog master",
        "Essential inventory tracking",
        "Basic business dashboard",
        "Standard user access",
        "Self-service documentation"
      ],
      cta: "Get Started Free",
      ctaHref: "#book-demo"
    },
    {
      name: "Business Plan",
      tagline: "For growing retail, wholesale, and service businesses",
      price: "Custom",
      period: "per location / month",
      badge: "Most Popular",
      highlight: true,
      features: [
        "Inventory & stock movement management",
        "High-speed POS & sales records",
        "Customer & vendor management (CRM)",
        "Business reports & financial ledgers",
        "Multi-user access with role permissions",
        "Selected AI-powered workflows",
        "Standard priority support"
      ],
      cta: "Explore Business Plan",
      ctaHref: "#book-demo"
    },
    {
      name: "Enterprise Plan",
      tagline: "For multi-branch businesses and complex operations",
      price: "Tailored",
      period: "enterprise contract",
      badge: "Multi-Branch & Scale",
      highlight: false,
      features: [
        "Advanced organization & multi-branch control",
        "Configurable access policies & full RBAC",
        "Enterprise reporting & consolidated BI",
        "Full AI workflows & RAG background workers",
        "Integration & legacy data migration assistance",
        "Dedicated cloud or on-premise deployment",
        "Dedicated SLA & technical account manager"
      ],
      cta: "Book an Enterprise Demo",
      ctaHref: "#book-demo"
    }
  ];

  const industries = [
    {
      title: "Retail & Supermarkets",
      icon: ShoppingBag,
      desc: "Speed up counter checkout with barcode scanning, dynamic UPI QR codes, customer loyalty points, and real-time inventory deduction."
    },
    {
      title: "Wholesale & B2B Trading",
      icon: Boxes,
      desc: "Manage tiered wholesale pricing, customer credit balances, bulk quantity volume breaks, and vendor purchase order workflows."
    },
    {
      title: "Distribution & Logistics",
      icon: Truck,
      desc: "Control multi-warehouse transfers, track goods receipt notes (GRN), monitor batch/expiry dates, and optimize picking routes."
    },
    {
      title: "Multi-Branch Franchises",
      icon: Building2,
      desc: "Centrally manage permissions, standardize catalogs across all locations, and view live consolidated executive revenue reports."
    }
  ];

  const faqs = [
    {
      q: "What is LazyMonkeyAI / IOTRONICS?",
      a: "LazyMonkeyAI is an AI-driven business operating platform that brings together ERP, inventory, POS, accounting, CRM, procurement, HRMS, IoT, and business intelligence capabilities into one unified platform."
    },
    {
      q: "Who can use LazyMonkeyAI?",
      a: "The platform is built for retail stores, supermarkets, wholesale businesses, distributors, and multi-branch enterprises that want to eliminate disconnected software and manage their entire operation from a single system."
    },
    {
      q: "Does LazyMonkeyAI support inventory management?",
      a: "Yes. It offers comprehensive inventory management including barcode search, AI-powered product enrichment, multi-warehouse stock visibility, batch and serial tracking, expiry alerts, and automated reordering suggestions."
    },
    {
      q: "Does it support POS billing and multiple currencies?",
      a: "Yes. The POS module supports high-speed barcode checkout, multi-currency transactions (including Indian Rupee ₹ INR), retail RSP vs wholesale price tiers, split tender payments, and thermal receipt printing."
    },
    {
      q: "What is AI-powered product enrichment?",
      a: "It is an automated workflow that takes basic product identifiers (such as a barcode or SKU) and uses AI to retrieve, organize, and fill in missing titles, descriptions, categories, images, and HSN tax codes without manual data entry."
    },
    {
      q: "What is RAG (Retrieval-Augmented Generation)?",
      a: "Retrieval-Augmented Generation is an AI approach that retrieves relevant data from your verified business records and catalogs and provides it to an AI model, ensuring highly accurate, context-aware business insights and answers."
    },
    {
      q: "Can I manage multiple branches and warehouses?",
      a: "Yes. The platform is architected from the ground up for multi-branch operations. You can configure multiple stores, central warehouses, and departments with centralized controls and role-based permissions."
    },
    {
      q: "Does the platform support finance and accounting?",
      a: "Yes. Core modules include a complete Chart of Accounts, double-entry general ledger, Accounts Receivable, Accounts Payable, expense tracking, P&L statements, Balance Sheets, and 1-click tax report exports."
    },
    {
      q: "Does it support third-party integrations and hardware?",
      a: "Yes. The platform integrates with barcode scanners, thermal receipt printers, cash drawers, biometric attendance clocks, and external payment gateways and messaging APIs."
    },
    {
      q: "Is enterprise support and migration assistance available?",
      a: "Yes. We offer professional migration services for historical catalogs and customer data, custom AI workflow configuration, and enterprise SLAs with dedicated technical account managers."
    },
    {
      q: "How can I get started?",
      a: "You can submit an inquiry through our 1-on-1 demo form on this page or start with our free workspace to explore the platform."
    }
  ];

  type CoreModule = (typeof coreModules)[number];
  const currentModule: CoreModule = coreModules[activeModuleIndex] ?? (coreModules[0] as CoreModule);
  const CurrentModuleIcon = currentModule.icon;

  return (
    <div className="space-y-16">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-8 sm:p-12 border border-slate-800 shadow-2xl">
        <div className="absolute -top-24 -right-24 size-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 size-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/20 border border-purple-400/40 px-3 py-1 text-xs font-bold text-purple-300">
                <Sparkles className="size-3.5 text-purple-400" /> LazyMonkeyAI • Enterprise Platform
              </span>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 px-3 py-1 text-xs font-mono font-bold">
                ONE UNIFIED OPERATING SYSTEM
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.15]">
              Your Business. <br />
              <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">
                One Intelligent Operating System.
              </span>
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl">
              Run your entire business from one intelligent platform. LazyMonkeyAI combines ERP, inventory, POS, accounting, CRM, procurement, HRMS, and AI-powered analytics to simplify operations, improve productivity, and support smarter business decisions.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80">
                <div className="text-xl font-extrabold text-purple-400">0ms</div>
                <div className="text-[10px] text-slate-400 font-semibold mt-0.5">UI Latency</div>
              </div>
              <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80">
                <div className="text-xl font-extrabold text-emerald-400">99.4%</div>
                <div className="text-[10px] text-slate-400 font-semibold mt-0.5">AI Sourcing</div>
              </div>
              <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80">
                <div className="text-xl font-extrabold text-blue-400">₹ INR</div>
                <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Multi-Currency</div>
              </div>
              <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80">
                <div className="text-xl font-extrabold text-amber-400">1-Click</div>
                <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Tax & GSTR</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="#book-demo"
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs sm:text-sm font-bold shadow-lg hover:shadow-purple-500/25 transition-all"
              >
                Get Started Free →
              </a>
              <a
                href="#book-demo"
                className="px-5 py-3.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all"
              >
                Book an Enterprise Demo
              </a>
              <a
                href="https://lazymonkeyai.com/"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-3.5 rounded-xl border border-purple-500/40 bg-purple-950/40 hover:bg-purple-900/50 text-purple-200 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all"
              >
                Open Live Portal <ExternalLink className="size-3.5 text-purple-400" />
              </a>
            </div>
          </div>

          {/* Hero Right Visual: Dual Pricing & POS Interactive Simulator */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-xs font-bold text-white font-mono">LIVE POS REGISTER #01</span>
                </div>
                <div className="flex rounded-lg bg-slate-800 p-0.5 text-[10px] font-bold">
                  <button
                    onClick={() => setActivePricingTab("retail")}
                    className={`px-2.5 py-1 rounded-md transition-all ${activePricingTab === "retail" ? "bg-purple-600 text-white shadow-xs" : "text-slate-400"}`}
                  >
                    Retail RSP
                  </button>
                  <button
                    onClick={() => setActivePricingTab("wholesale")}
                    className={`px-2.5 py-1 rounded-md transition-all ${activePricingTab === "wholesale" ? "bg-purple-600 text-white shadow-xs" : "text-slate-400"}`}
                  >
                    Wholesale
                  </button>
                </div>
              </div>

              {/* Scanned Cart Items */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                  <div>
                    <div className="font-bold text-white">SKU-99201 • Industrial Valve 4"</div>
                    <div className="text-[10px] text-slate-400">Barcode AI Enriched • HSN: 848180</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-purple-300">{activePricingTab === "retail" ? "₹ 4,850.00" : "₹ 3,920.00"}</div>
                    <div className="text-[10px] text-emerald-400">Tax 18% Incl.</div>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                  <div>
                    <div className="font-bold text-white">SKU-44102 • High-Tensile Fasteners (Pack 100)</div>
                    <div className="text-[10px] text-slate-400">Auto FIFO Pick • Warehouse B-12</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-purple-300">{activePricingTab === "retail" ? "₹ 1,200.00" : "₹ 950.00"}</div>
                    <div className="text-[10px] text-emerald-400">Tax 18% Incl.</div>
                  </div>
                </div>
              </div>

              {/* Totals & Split Tender */}
              <div className="border-t border-slate-800 pt-3 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal + GST (18%)</span>
                  <span className="font-bold text-white">{activePricingTab === "retail" ? "₹ 6,050.00" : "₹ 4,870.00"}</span>
                </div>
                <div className="flex justify-between items-center bg-purple-500/10 p-2.5 rounded-xl border border-purple-500/20">
                  <span className="font-bold text-purple-300 flex items-center gap-1.5">
                    <Zap className="size-3.5 text-purple-400" /> Split Tender Ready
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">UPI QR / Cash / Card</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. WHY LAZYMONKEYAI (6 VALUE PILLARS) */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-bold uppercase font-mono">
            Value Proposition
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
            Why LazyMonkeyAI?
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Manage every branch, track every transaction, automate repetitive tasks, and turn your business data into actionable insights — all from one unified workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 hover:border-purple-400 transition-all">
            <div className="size-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Layers className="size-5" />
            </div>
            <h3 className="text-base font-bold text-slate-950">Unified Business Management</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Connect inventory, sales, purchasing, accounting, and customer management in one centralized system without fragmented syncs.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 hover:border-purple-400 transition-all">
            <div className="size-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Sparkles className="size-5" />
            </div>
            <h3 className="text-base font-bold text-slate-950">AI-Powered Automation</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Reduce repetitive work with intelligent workflows, automated data enrichment, and AI-assisted business insights.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 hover:border-purple-400 transition-all">
            <div className="size-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Activity className="size-5" />
            </div>
            <h3 className="text-base font-bold text-slate-950">Real-Time Business Visibility</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Monitor sales, stock levels, expenses, and operational performance with centralized executive dashboards and reports.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 hover:border-purple-400 transition-all">
            <div className="size-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Building2 className="size-5" />
            </div>
            <h3 className="text-base font-bold text-slate-950">Multi-Branch Operations</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Manage multiple stores, warehouses, teams, and business locations with centralized controls and shared catalogs.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 hover:border-purple-400 transition-all">
            <div className="size-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Cpu className="size-5" />
            </div>
            <h3 className="text-base font-bold text-slate-950">Scalable Architecture</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Build your operations on a platform designed to support growing businesses, multi-tenant databases, and complex workflows.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 hover:border-purple-400 transition-all">
            <div className="size-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <ShieldCheck className="size-5" />
            </div>
            <h3 className="text-base font-bold text-slate-950">Secure Business Access</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Control user permissions, monitor activities, and manage business data with granular role-based access and audit trails.
            </p>
          </div>
        </div>
      </section>

      {/* 3. CORE 9 OPERATIONAL MODULES DEEP DIVE */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider font-mono">One Platform. Every Business Operation.</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-1">9 Core Platform Modules</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Select a module to inspect full feature capabilities</span>
        </div>

        {/* Module Selector Pill Bar */}
        <div className="flex flex-wrap gap-2">
          {coreModules.map((m, idx) => {
            const isSelected = activeModuleIndex === idx;
            const IconComp = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setActiveModuleIndex(idx)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-950"
                }`}
              >
                <IconComp className="size-3.5" />
                <span>{m.name.split(". ")[1]}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Module Detail Banner & Subsections */}
        <div className="space-y-6 pt-2">
          <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50/50 to-slate-50 border border-purple-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-purple-600 text-white grid place-items-center shadow-md">
                  <CurrentModuleIcon className="size-6" />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-purple-700 font-bold uppercase">{currentModule.badge}</span>
                  <h3 className="text-lg sm:text-xl font-extrabold text-slate-950">{currentModule.headline}</h3>
                </div>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 max-w-3xl leading-relaxed">{currentModule.desc}</p>
          </div>

          {/* Sub-Feature Section Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {currentModule.sections.map((sec, sIdx) => (
              <div key={sec.title} className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-2 text-slate-950 font-bold text-sm">
                  <span className="size-5 rounded-full bg-purple-100 text-purple-700 text-[10px] grid place-items-center font-mono">
                    0{sIdx + 1}
                  </span>
                  <h4>{sec.title}</h4>
                </div>
                <ul className="space-y-2">
                  {sec.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2 text-xs text-slate-600">
                      <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. DEDICATED FEATURE: AI PRODUCT CATALOG ENRICHMENT */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase font-mono">
            Dedicated Feature Deep Dive
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
            AI-Powered Product Catalog Enrichment
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Transform basic product data into structured catalogs. Reduce manual product entry by using AI-assisted workflows to enrich and organize product information from supported sources.
          </p>
        </div>

        {/* 5-Step Workflow Progression */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase text-slate-400 font-mono tracking-wider text-center">
            How It Works: 5-Step Automated Workflow
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {enrichmentSteps.map((step) => (
              <div
                key={step.step}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 relative group hover:border-purple-400 hover:bg-purple-50/30 transition-all"
              >
                <span className="size-7 rounded-lg bg-purple-100 text-purple-700 text-xs font-bold font-mono grid place-items-center">
                  {step.step}
                </span>
                <h4 className="text-xs font-bold text-slate-950">{step.title}</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Supported Data Fields & Key Advantages */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-slate-100">
          <div className="lg:col-span-6 space-y-3">
            <h4 className="text-xs font-bold uppercase text-purple-700 font-mono tracking-wider">
              Supported Data Fields
            </h4>
            <div className="flex flex-wrap gap-2">
              {supportedFields.map((f) => (
                <span key={f} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200">
                  <Check className="size-3 text-emerald-600" />
                  {f}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 italic pt-1">
              * AI enrichment depends on the availability and reliability of data sources. Prices, tax classifications, and sensitive fields should be verified before use.
            </p>
          </div>

          <div className="lg:col-span-6 space-y-3">
            <h4 className="text-xs font-bold uppercase text-purple-700 font-mono tracking-wider">
              Key Advantages
            </h4>
            <div className="space-y-2 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-purple-600 shrink-0" />
                <span><strong>Reduce repetitive entry:</strong> Eliminate hundreds of hours of manual typing</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-purple-600 shrink-0" />
                <span><strong>Improve catalog consistency:</strong> Standardized naming schemes and HSN taxonomy</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-purple-600 shrink-0" />
                <span><strong>Support bulk onboarding:</strong> Enrich thousands of SKUs in parallel background jobs</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-purple-600 shrink-0" />
                <span><strong>Maintain validation controls:</strong> Review workflows before pushing to live POS counters</span>
              </div>
            </div>
          </div>
        </div>
      </section>

  {/* 5. VISUAL SHOWCASE: Enterprise AI Operations in Action */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider font-mono">Operations In Action</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-1">Enterprise-Grade Infrastructure & AI Telemetry</h2>
          </div>
          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-bold">
            Real-Time Sync • Multi-Branch Ready
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 hover:shadow-lg transition-all">
            <div className="relative h-48 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=800&auto=format&fit=crop"
                alt="Automated Warehouse & Multi-Hub Logistics"
                className="size-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
              <span className="absolute bottom-3 left-3 text-xs font-bold text-white flex items-center gap-1.5">
                <Package className="size-3.5 text-purple-400" /> Automated Warehouse & Logistics
              </span>
            </div>
            <div className="p-4 space-y-1.5">
              <h4 className="text-xs font-bold text-slate-950">AI RAG & Multi-Warehouse Sourcing</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Scan 1D/2D barcodes, track multi-location batch/serial lots, and auto-dispatch supplier purchase orders.
              </p>
            </div>
          </div>

          <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 hover:shadow-lg transition-all">
            <div className="relative h-48 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1556742049-0a67e5572263?q=80&w=800&auto=format&fit=crop"
                alt="High-Speed Dual Pricing POS Terminal"
                className="size-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
              <span className="absolute bottom-3 left-3 text-xs font-bold text-white flex items-center gap-1.5">
                <CreditCard className="size-3.5 text-emerald-400" /> Dual-Pricing POS Register
              </span>
            </div>
            <div className="p-4 space-y-1.5">
              <h4 className="text-xs font-bold text-slate-950">High-Speed Checkout & Cash Management</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Switch between Retail RSP and Wholesale B2B rate cards instantly with sub-12ms barcode lookup.
              </p>
            </div>
          </div>

          <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 hover:shadow-lg transition-all">
            <div className="relative h-48 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=800&auto=format&fit=crop"
                alt="Executive BI Telemetry & Double-Entry Ledger"
                className="size-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
              <span className="absolute bottom-3 left-3 text-xs font-bold text-white flex items-center gap-1.5">
                <BarChart3 className="size-3.5 text-blue-400" /> Executive BI Telemetry
              </span>
            </div>
            <div className="p-4 space-y-1.5">
              <h4 className="text-xs font-bold text-slate-950">Real-Time P&L & 1-Click GSTR Tax</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Consolidated balance sheets, automated cash-flow forecasts, and double-entry general ledger reconciliation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. BUILT FOR MODERN BUSINESSES (INDUSTRY SOLUTIONS) */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold uppercase font-mono">
            Industry Solutions
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
            Built for Every Modern Business Model
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Whether you operate a retail store, supermarket, wholesale business, distribution network, or multi-branch enterprise, LazyMonkeyAI gives you the tools to manage operations from a single platform.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {industries.map((ind) => {
            const IconComp = ind.icon;
            return (
              <div key={ind.title} className="p-6 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3 hover:border-purple-300 hover:shadow-xs transition-all">
                <div className="size-10 rounded-xl bg-purple-100 text-purple-700 grid place-items-center">
                  <IconComp className="size-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-950">{ind.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{ind.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. ENTERPRISE SOLUTIONS & PROFESSIONAL SERVICES */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold uppercase font-mono">
            Professional Services
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
            Enterprise Solutions & Professional Services
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Tailored solutions for complex business requirements. Get assistance with deployment, integrations, migration, customization, and operational setup.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {enterpriseServices.map((svc) => {
            const IconComp = svc.icon;
            return (
              <div key={svc.title} className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 hover:border-indigo-300 transition-all">
                <div className="size-10 rounded-xl bg-indigo-100 text-indigo-700 grid place-items-center">
                  <IconComp className="size-5" />
                </div>
                <h3 className="text-base font-bold text-slate-950">{svc.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{svc.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-900 to-indigo-950 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-base font-bold">Request an Enterprise Consultation</h4>
            <p className="text-xs text-slate-300">Tell us about your business size, locations, and integrations so we can define a suitable rollout plan.</p>
          </div>
          <a
            href="#book-demo"
            className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs font-bold whitespace-nowrap transition-all shadow-md"
          >
            Contact Enterprise Sales →
          </a>
        </div>
      </section>

      {/* 7. PROPOSED PRICING PLANS */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase font-mono">
            Transparent Plans
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
            Simple Plans for Every Stage of Growth
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Start Small. Scale with Confidence. Choose a plan based on your business size, operating complexity, and automation requirements.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className={`p-6 rounded-2xl border flex flex-col justify-between space-y-6 transition-all ${
                plan.highlight
                  ? "bg-purple-50/40 border-purple-400 shadow-lg ring-2 ring-purple-400/20"
                  : "bg-slate-50/60 border-slate-200/80 hover:bg-white hover:border-slate-300"
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full font-mono ${
                    plan.highlight ? "bg-purple-600 text-white" : "bg-slate-200 text-slate-700"
                  }`}>
                    {plan.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-extrabold text-slate-950">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 min-h-[32px]">{plan.tagline}</p>
                </div>

                <div className="border-t border-b border-slate-200/80 py-3">
                  <div className="text-2xl sm:text-3xl font-black text-slate-950">{plan.price}</div>
                  <div className="text-[11px] text-slate-500">{plan.period}</div>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-700">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="size-3.5 text-purple-600 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href={plan.ctaHref}
                className={`w-full py-3 rounded-xl text-center text-xs font-bold transition-all block ${
                  plan.highlight
                    ? "bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20"
                    : "bg-slate-200 hover:bg-slate-300 text-slate-900"
                }`}
              >
                {plan.cta} →
              </a>
            </div>
          ))}
        </div>

        <div className="text-center text-[11px] text-slate-500 italic">
          * Note: Final pricing, usage limits, included features, and support commitments can be tailored based on your active branches and data volume before subscribing.
        </div>
      </section>

      {/* 8. FREQUENTLY ASKED QUESTIONS (FAQ) */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-bold uppercase font-mono">
            Got Questions?
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Everything you need to know about LazyMonkeyAI platform architecture, modules, and onboarding.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={faq.q}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/50 overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full p-4.5 text-left flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-slate-900 hover:text-purple-700 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`size-4 shrink-0 transition-transform ${isOpen ? "rotate-180 text-purple-600" : "text-slate-400"}`} />
                </button>
                {isOpen && (
                  <div className="px-4.5 pb-4 text-xs text-slate-600 leading-relaxed border-t border-slate-200/40 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* =========================================================================
   2. FIT CLUB AI — COMPLETE APPLICATION BLUEPRINT TEMPLATE
   ========================================================================= */
function FitClubAiTemplate({ product }: { product: ProductItem }) {
  const [turnstilePassActive, setTurnstilePassActive] = useState(true);
  const [activeModuleFilter, setActiveModuleFilter] = useState<"all" | "core" | "operations" | "advanced" | "enterprise">("all");
  const [activeWorkflowTab, setActiveWorkflowTab] = useState(0);

  // Live Interactive Application Readiness Checklist State (24 items)
  const initialChecklist = [
    // Core (6)
    { id: "c1", category: "Core", text: "Login, roles, and permissions", checked: true },
    { id: "c2", category: "Core", text: "Member registration and profiles", checked: true },
    { id: "c3", category: "Core", text: "Membership plans and renewals", checked: true },
    { id: "c4", category: "Core", text: "Billing, payments, and receipts", checked: true },
    { id: "c5", category: "Core", text: "Attendance and check-in", checked: true },
    { id: "c6", category: "Core", text: "Dashboard and basic reports", checked: true },
    // Operations (6)
    { id: "o1", category: "Operations", text: "Trainer management & allocations", checked: true },
    { id: "o2", category: "Operations", text: "Workout plans and exercise library", checked: true },
    { id: "o3", category: "Operations", text: "Class and session scheduling", checked: true },
    { id: "o4", category: "Operations", text: "Renewal notifications & WhatsApp queue", checked: true },
    { id: "o5", category: "Operations", text: "Inventory and equipment maintenance", checked: true },
    { id: "o6", category: "Operations", text: "Expenses and financial reporting", checked: true },
    // Advanced (6)
    { id: "a1", category: "Advanced", text: "Member-facing mobile portal", checked: true },
    { id: "a2", category: "Advanced", text: "Multi-branch and franchise control", checked: true },
    { id: "a3", category: "Advanced", text: "CRM, enquiries and lead conversion", checked: true },
    { id: "a4", category: "Advanced", text: "AI business & workout assistant", checked: true },
    { id: "a5", category: "Advanced", text: "Retention and demand insights", checked: true },
    { id: "a6", category: "Advanced", text: "Payment and messaging integrations", checked: true },
    // Production Readiness (6)
    { id: "p1", category: "Production Readiness", text: "Organization data isolation & multi-tenancy", checked: true },
    { id: "p2", category: "Production Readiness", text: "Audit logs and secure permissions", checked: true },
    { id: "p3", category: "Production Readiness", text: "Automated backups and disaster recovery", checked: true },
    { id: "p4", category: "Production Readiness", text: "Automated tests and monitoring telemetry", checked: true },
    { id: "p5", category: "Production Readiness", text: "Privacy and data retention policies", checked: true },
    { id: "p6", category: "Production Readiness", text: "Mobile-friendly and accessible UI", checked: true },
  ];

  const [checklist, setChecklist] = useState(initialChecklist);

  const toggleChecklistItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const completedCount = checklist.filter((c) => c.checked).length;
  const progressPercent = Math.round((completedCount / checklist.length) * 100);

  // 16 Full Modules from Specification
  const gymModules = [
    {
      id: "dashboard",
      num: "01",
      title: "Dashboard & Business Overview",
      category: "core",
      icon: LayoutGrid,
      purpose: "Give owners and managers a real-time overview of gym operations.",
      bullets: [
        "Active, expired, and new member KPI metrics",
        "Today's check-ins, current occupancy & rush-hour density",
        "Monthly revenue, outstanding fees & collection rates",
        "Renewals due in next 7, 15, or 30 days"
      ]
    },
    {
      id: "member-management",
      num: "02",
      title: "Member Management",
      category: "core",
      icon: Users,
      purpose: "Maintain a complete profile and history for every gym member.",
      bullets: [
        "Member profile with photo, unique ID & QR code",
        "Emergency contact and confidential health notes",
        "Status: lead, active, frozen, expired, cancelled",
        "Duplicate detection and historical order timeline"
      ]
    },
    {
      id: "memberships-subs",
      num: "03",
      title: "Membership & Subscription Management",
      category: "core",
      icon: CreditCard,
      purpose: "Control plans, validity, renewals, upgrades, and freezes.",
      bullets: [
        "Monthly, quarterly, half-yearly & annual plan matrix",
        "Joining fees, discounts, and included facility services",
        "Membership freeze & pause rules with date locks",
        "Automated upcoming renewal notifications"
      ]
    },
    {
      id: "attendance-access",
      num: "04",
      title: "Attendance & Access Management",
      category: "core",
      icon: QrCode,
      purpose: "Record gym visits and control access based on membership validity.",
      bullets: [
        "Instant check-in through QR, member ID or biometric turnstiles",
        "Automatic gate blocking for expired memberships",
        "Anti-passback prevention (zero duplicate swipes)",
        "Inactive member drop-off tracking & branch access rules"
      ]
    },
    {
      id: "trainers-staff",
      num: "05",
      title: "Trainer & Staff Management",
      category: "operations",
      icon: UserCheck,
      purpose: "Coordinate trainers, reception staff, and operational employees.",
      bullets: [
        "Trainer specialization, working hours & client rosters",
        "Personal training (PT) appointment booking",
        "Automated commission calculation on session tiers",
        "Staff performance metrics and member reviews"
      ]
    },
    {
      id: "workout-programs",
      num: "06",
      title: "Workout & Fitness Program Management",
      category: "operations",
      icon: Dumbbell,
      purpose: "Plan workouts and track a member's fitness journey.",
      bullets: [
        "Exercise video demonstration library with muscle filters",
        "Custom templates for strength, cardio, HIIT & flexibility",
        "Sets, reps, rest intervals & target weight trackers",
        "Member workout completion logs & progression comparisons"
      ]
    },
    {
      id: "fitness-assessments",
      num: "07",
      title: "Fitness Assessment & Progress Tracking",
      category: "operations",
      icon: HeartPulse,
      purpose: "Track fitness goals and provide measurable progress records.",
      bullets: [
        "Periodic body measurements, weight, and BMI logs",
        "Body composition data & milestone photo timeline",
        "Target goal benchmarks (fat loss, hypertrophy, endurance)",
        "Secure privacy controls for sensitive measurements"
      ]
    },
    {
      id: "billing-finance",
      num: "08",
      title: "Billing, Payments & Finance",
      category: "core",
      icon: Calculator,
      purpose: "Manage collections, invoices, outstanding balances, and finances.",
      bullets: [
        "Membership tax invoices, receipts & renewal charges",
        "Accept Cash, Card, and 1-Click dynamic UPI links",
        "Partial payments, advance credits & refund logs",
        "Daily register collection reports and expense tracking"
      ]
    },
    {
      id: "inventory-equipment",
      num: "09",
      title: "Inventory & Equipment Management",
      category: "operations",
      icon: Package,
      purpose: "Manage products sold by the gym and maintain gym equipment records.",
      bullets: [
        "Protein shake bar and supplement retail POS",
        "Barcode scanning with batch & expiry tracking",
        "Gym equipment asset register with serial numbers",
        "Maintenance schedules, downtime logs & service alerts"
      ]
    },
    {
      id: "class-scheduling",
      num: "10",
      title: "Class & Session Scheduling",
      category: "operations",
      icon: Calendar,
      purpose: "Organize group classes, personal training, and fitness sessions.",
      bullets: [
        "Yoga, Zumba, CrossFit & spinning timetable calendar",
        "Class capacity limits, automated waitlists & booking",
        "Instructor workload tracking & attendance verification",
        "Automated SMS/WhatsApp booking confirmation"
      ]
    },
    {
      id: "nutrition-diet",
      num: "11",
      title: "Nutrition & Diet Planning",
      category: "operations",
      icon: Utensils,
      purpose: "Support fitness programs with structured nutrition plans.",
      bullets: [
        "Personalized daily meal plans & portion guidelines",
        "Calorie and macro distribution tracking (Protein/Carb/Fat)",
        "Allergy and dietary restriction safeguard flags",
        "Trainer review cycles and member adherence logs"
      ]
    },
    {
      id: "reports-analytics",
      num: "12",
      title: "Reports & Business Analytics",
      category: "advanced",
      icon: BarChart3,
      purpose: "Help management understand performance and identify opportunities.",
      bullets: [
        "Member growth, retention & churn rate analysis",
        "Branch revenue breakdowns & trainer utilization",
        "Peak attendance rush-hour heatmaps",
        "Exportable CSV, Excel, and PDF reports"
      ]
    },
    {
      id: "ai-assistant",
      num: "13",
      title: "AI Fitness & Business Assistant",
      category: "advanced",
      icon: Bot,
      purpose: "Provide useful summaries and recommendations using authorized data.",
      bullets: [
        "Ask plain-English questions about gym performance",
        "Detect members showing early churn drop-off signals",
        "Draft personalized WhatsApp renewal follow-ups",
        "Predict upcoming class demand & trainer capacity"
      ]
    },
    {
      id: "crm-leads",
      num: "14",
      title: "CRM, Leads & Customer Engagement",
      category: "advanced",
      icon: UserPlus,
      purpose: "Convert enquiries into memberships and improve member retention.",
      bullets: [
        "Capture walk-in, website & social media leads",
        "Lead pipeline stages: new, contacted, trial, converted",
        "Automated follow-up tasks for front-desk staff",
        "Automated WhatsApp & SMS engagement campaigns"
      ]
    },
    {
      id: "multibranch-franchise",
      num: "15",
      title: "Multi-Branch & Franchise Management",
      category: "enterprise",
      icon: Building2,
      purpose: "Operate multiple gyms through centralized enterprise controls.",
      bullets: [
        "Multi-location gym branch profiles and local pricing",
        "Cross-branch membership access permissions",
        "Consolidated revenue & attendance telemetry",
        "Staff transfers and centralized plan management"
      ]
    },
    {
      id: "security-settings",
      num: "16",
      title: "Administration, Security & Settings",
      category: "enterprise",
      icon: ShieldCheck,
      purpose: "Configure the platform and control access to sensitive data.",
      bullets: [
        "Role-based access control (RBAC) across 9 user roles",
        "Strict multi-tenant organization data isolation",
        "Immutable audit logs for financial and membership edits",
        "Automated cloud backups and session security controls"
      ]
    }
  ];

  // 9 User Roles Matrix
  const userRoles = [
    { role: "Platform Super Admin", desc: "Manage gym organizations, multi-tenant subscriptions, and global platform configuration." },
    { role: "Gym Owner", desc: "Full executive visibility into business revenue, multi-branch performance, staff, and pricing." },
    { role: "Gym Manager", desc: "Oversee daily member operations, check-in verification, class schedules, and reports." },
    { role: "Receptionist", desc: "Register new members, sell plans, process POS payments, and manage front-desk check-ins." },
    { role: "Trainer", desc: "View assigned clients, design workout templates, log training sessions, and track progress." },
    { role: "Finance Staff", desc: "Manage tax invoices, reconciliations, refunds, expense vouchers, and accounting reports." },
    { role: "Nutrition Professional", desc: "Create, review, and adjust structured member meal plans and dietary recommendations." },
    { role: "Gym Member", desc: "Digital QR pass, workout plans, session bookings, fee receipts, and progress photos." },
    { role: "Inventory Staff", desc: "Manage supplement retail stock, purchase orders, barcode labels, and equipment repairs." }
  ];

  // 5 Workflows
  const workflows = [
    {
      name: "1. New Member Registration",
      steps: [
        "Enquiry or Walk-in arrives at front desk",
        "Receptionist creates member profile with photo & contact details",
        "Select membership plan & duration (Monthly / Quarterly / Annual)",
        "System calculates price, GST tax, joining fees & discounts",
        "Record payment via Cash, Card, or Dynamic UPI QR",
        "Generate official tax invoice & PDF receipt",
        "Activate membership & issue digital QR member code",
        "Automated WhatsApp welcome message & login details sent"
      ]
    },
    {
      name: "2. Daily Gym Check-In",
      steps: [
        "Member approaches entrance turnstile or front desk",
        "Scan QR code on member smartphone or tap biometric sensor",
        "System validates real-time membership status & branch permissions",
        "If Valid: Turnstile unlocks in 0.2s & updates live gym occupancy",
        "If Expired: Gate locks, status flagged & WhatsApp renewal link sent"
      ]
    },
    {
      name: "3. Membership Renewal",
      steps: [
        "System scans expiring subscriptions 7, 3 & 1 day before deadline",
        "Automated WhatsApp renewal reminders dispatched with 1-Click payment link",
        "Front-desk follow-up queue updated for proactive retention calls",
        "Member completes renewal payment online or at counter",
        "System extends validity dates according to renewal policy & updates revenue"
      ]
    },
    {
      name: "4. Personal Training Session",
      steps: [
        "Select member and check assigned trainer availability on calendar",
        "Book date, time slot, and session focus (e.g. Legs Hypertrophy)",
        "Instant calendar booking notification sent to member & trainer",
        "Trainer conducts session and marks completion with exercise notes",
        "System deducts session balance & credits trainer commission tier"
      ]
    },
    {
      name: "5. Monthly Business Reporting",
      steps: [
        "Select date range and individual branch or consolidated network",
        "Aggregate membership sales, renewals, POS supplement sales & expenses",
        "Calculate net collection rate, overdue fees & member churn percentage",
        "Review trainer utilization, class attendance density heatmaps",
        "Export audit-ready reports in CSV, Excel, or formatted PDF"
      ]
    }
  ];

  type WorkflowItem = (typeof workflows)[number];
  const currentWorkflow: WorkflowItem = workflows[activeWorkflowTab] ?? (workflows[0] as WorkflowItem);

  const filteredModules = activeModuleFilter === "all"
    ? gymModules
    : gymModules.filter((m) => m.category === activeModuleFilter);

  return (
    <div className="space-y-16 font-sans">
      {/* 1. ATHLETIC HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0c1319] via-[#0d1f18] to-[#0a110e] text-white rounded-3xl p-8 sm:p-12 border border-emerald-900/40 shadow-2xl">
        <div className="absolute top-0 right-0 size-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3.5 py-1 text-xs font-bold text-emerald-300 font-mono">
                <Dumbbell className="size-3.5 text-emerald-400" /> LazyMonkey FIT CLUB AI
              </span>
              <span className="rounded-full bg-slate-800 text-emerald-400 border border-emerald-500/30 px-3 py-1 text-xs font-mono font-bold">
                16 FUNCTIONAL MODULES • COMPLETE BLUEPRINT
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.12] uppercase">
              Smarter Gym Management. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                Better Fitness Experiences.
              </span>
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl">
              Run your fitness business with a connected gym management platform designed to simplify memberships, registrations, attendance, personal training, workout programs, payments, staff, equipment, and multi-branch operations.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-emerald-500/30">
                <div className="text-xl sm:text-2xl font-black text-emerald-400">0.2s</div>
                <div className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Turnstile Unlock</div>
              </div>
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-emerald-500/30">
                <div className="text-xl sm:text-2xl font-black text-cyan-400">80%</div>
                <div className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Less Chasing</div>
              </div>
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-emerald-500/30">
                <div className="text-xl sm:text-2xl font-black text-emerald-300">16</div>
                <div className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Core Modules</div>
              </div>
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-emerald-500/30">
                <div className="text-xl sm:text-2xl font-black text-amber-300">100%</div>
                <div className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Multi-Club</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="#book-demo"
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg hover:shadow-emerald-500/25 transition-all"
              >
                Get Started Free →
              </a>
              <a
                href="#book-demo"
                className="px-5 py-3.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all"
              >
                Request a Demo
              </a>
              <a
                href="https://gym.lazymonkeyai.com/"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-3.5 rounded-xl border border-emerald-500/30 bg-slate-900 text-slate-200 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all"
              >
                Live Portal <ExternalLink className="size-3.5 text-emerald-400" />
              </a>
            </div>
          </div>

          {/* Turnstile Pass & Occupancy Simulator */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-emerald-500/30 bg-slate-950 p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 grid place-items-center text-emerald-400">
                    <QrCode className="size-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white uppercase font-mono">Member Digital Pass</div>
                    <div className="text-[10px] text-slate-400">ID: FIT-M-88902</div>
                  </div>
                </div>
                <button
                  onClick={() => setTurnstilePassActive(!turnstilePassActive)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                    turnstilePassActive
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                      : "bg-red-500/20 text-red-300 border border-red-400/40"
                  }`}
                >
                  {turnstilePassActive ? "PASS: ACTIVE" : "PASS: EXPIRED"}
                </button>
              </div>

              {/* QR Code Graphic */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
                <div className="mx-auto size-32 bg-white rounded-xl p-2.5 grid place-items-center shadow-md">
                  <QrCode className="size-full text-slate-950" />
                </div>
                <div className="text-xs font-bold text-white">Alex Rivera • Annual Platinum</div>
                <div className="text-[11px] text-slate-400">
                  {turnstilePassActive ? "Turnstile Unlocked • Gate #01" : "Access Denied • WhatsApp Renewal Link Sent"}
                </div>
              </div>

              {/* Occupancy Telemetry */}
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Flame className="size-4 text-emerald-400" />
                  <span className="text-slate-300 font-medium">Floor Capacity</span>
                </div>
                <span className="font-bold font-mono text-emerald-400">68% (42 Active Check-Ins)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. DESIGNED FOR BETTER GYM OPERATIONS (4 VALUE PILLARS) */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase font-mono">
            Gym Transformation
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
            Designed for Better Gym Operations
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Replace disconnected spreadsheets, paper registers, manual fee tracking, and separate appointment records with one connected operating system.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 hover:border-emerald-400 transition-all">
            <div className="size-10 rounded-xl bg-emerald-100 text-emerald-700 grid place-items-center">
              <CheckCircle2 className="size-5" />
            </div>
            <h3 className="text-base font-bold text-slate-950">Less Manual Work</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bring routine administrative tasks together and eliminate disconnected records and manual ledger syncs.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 hover:border-emerald-400 transition-all">
            <div className="size-10 rounded-xl bg-teal-100 text-teal-700 grid place-items-center">
              <Users className="size-5" />
            </div>
            <h3 className="text-base font-bold text-slate-950">Better Member Experience</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Keep membership passes, appointments, payments, and workout progressions organized in a sleek mobile interface.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 hover:border-emerald-400 transition-all">
            <div className="size-10 rounded-xl bg-cyan-100 text-cyan-700 grid place-items-center">
              <Activity className="size-5" />
            </div>
            <h3 className="text-base font-bold text-slate-950">More Operational Visibility</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Understand attendance patterns, renewal pipelines, collection rates, and trainer utilization in real time.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 hover:border-emerald-400 transition-all">
            <div className="size-10 rounded-xl bg-indigo-100 text-indigo-700 grid place-items-center">
              <Building2 className="size-5" />
            </div>
            <h3 className="text-base font-bold text-slate-950">Room to Grow</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Build a unified foundation to easily expand to additional fitness branches, franchises, and premium studios.
            </p>
          </div>
        </div>
      </section>

      {/* VISUAL SHOWCASE: Live Gym Floor & Member Experience */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider font-mono">Club In Action</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-1">Smart Fitness Facilities & Member Experiences</h2>
          </div>
          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-bold">
            Biometric Turnstiles • Trainer Rosters
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 hover:shadow-lg transition-all">
            <div className="relative h-48 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800&auto=format&fit=crop"
                alt="Modern Strength & Conditioning Floor"
                className="size-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
              <span className="absolute bottom-3 left-3 text-xs font-bold text-white flex items-center gap-1.5">
                <Dumbbell className="size-3.5 text-emerald-400" /> Modern Strength Floor
              </span>
            </div>
            <div className="p-4 space-y-1.5">
              <h4 className="text-xs font-bold text-slate-950">Floor Occupancy & Turnstile Gate Sync</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Real-time check-in counts, anti-passback prevention, and instant gate unlocking via biometric QR.
              </p>
            </div>
          </div>

          <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 hover:shadow-lg transition-all">
            <div className="relative h-48 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=800&auto=format&fit=crop"
                alt="Personal Training & Coaching Sessions"
                className="size-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
              <span className="absolute bottom-3 left-3 text-xs font-bold text-white flex items-center gap-1.5">
                <UserCheck className="size-3.5 text-teal-400" /> 1-on-1 Personal Training
              </span>
            </div>
            <div className="p-4 space-y-1.5">
              <h4 className="text-xs font-bold text-slate-950">Trainer Scheduling & Commission Tiers</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Assign client workout splits, track session deductions, and automate trainer performance payouts.
              </p>
            </div>
          </div>

          <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 hover:shadow-lg transition-all">
            <div className="relative h-48 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=800&auto=format&fit=crop"
                alt="Group Classes & Timetable Management"
                className="size-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
              <span className="absolute bottom-3 left-3 text-xs font-bold text-white flex items-center gap-1.5">
                <Flame className="size-3.5 text-amber-400" /> Group Classes & HIIT Studio
              </span>
            </div>
            <div className="p-4 space-y-1.5">
              <h4 className="text-xs font-bold text-slate-950">Yoga, Zumba & CrossFit Waitlists</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Configure studio booking capacities, automated waitlists, and instant WhatsApp booking confirmation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. COMPLETE 16 APPLICATION MODULES */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider font-mono">Full Functional Suite</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-1">16 Complete Application Modules</h2>
          </div>
          <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            {(["all", "core", "operations", "advanced", "enterprise"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveModuleFilter(filter)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                  activeModuleFilter === filter ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-950"
                }`}
              >
                {filter === "all" ? "All (16)" : filter}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {filteredModules.map((m) => {
            const IconComp = m.icon;
            return (
              <div
                key={m.id}
                className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 hover:border-emerald-400 hover:bg-emerald-50/20 hover:shadow-xs transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="size-9 rounded-xl bg-emerald-100 text-emerald-800 grid place-items-center">
                      <IconComp className="size-4.5" />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 font-bold">MODULE {m.num}</span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-950 leading-tight">{m.title}</h3>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{m.purpose}</p>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-200/60 text-xs text-slate-700">
                  {m.bullets.map((b) => (
                    <div key={b} className="flex items-start gap-1.5">
                      <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="text-[11px]">{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. IMPORTANT BUSINESS WORKFLOWS */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase font-mono">
            Standard Operating Procedures
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
            5 Core Business Workflows
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Standardized operational automation designed for front-desk staff, personal trainers, and gym administrators.
          </p>
        </div>

        {/* Workflow Tab Selector */}
        <div className="flex flex-wrap gap-2 justify-center">
          {workflows.map((wf, idx) => (
            <button
              key={wf.name}
              onClick={() => setActiveWorkflowTab(idx)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeWorkflowTab === idx
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {wf.name}
            </button>
          ))}
        </div>

        {/* Workflow Progression Box */}
        {currentWorkflow && (
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 max-w-4xl mx-auto">
            <h3 className="text-base font-bold text-slate-950 text-center">
              {currentWorkflow.name}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              {currentWorkflow.steps.map((step, sIdx) => (
                <div key={step} className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
                  <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    STEP 0{sIdx + 1}
                  </span>
                  <p className="text-xs text-slate-700 leading-snug">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 5. 9 USER ROLES & PERMISSIONS MATRIX */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold uppercase font-mono">
            Access Control
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
            9 User Roles & Granular Permissions
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Tailored dashboards for every team member ensuring data privacy and operational focus.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {userRoles.map((ur) => (
            <div key={ur.role} className="p-4.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-emerald-600 shrink-0" />
                <h3 className="text-sm font-bold text-slate-950">{ur.role}</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{ur.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. INTERACTIVE APPLICATION READINESS CHECKLIST */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider font-mono">Product Verification</span>
            <h2 className="text-2xl font-extrabold text-slate-950 mt-1">Application Readiness Checklist</h2>
          </div>
          <div className="flex items-center gap-3 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200">
            <span className="text-xs font-bold text-emerald-950">Readiness Score:</span>
            <span className="text-sm font-extrabold text-emerald-700 font-mono">{completedCount} / 24 ({progressPercent}%)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(["Core", "Operations", "Advanced", "Production Readiness"] as const).map((cat) => {
            const catItems = checklist.filter((c) => c.category === cat);
            return (
              <div key={cat} className="space-y-3 p-4 rounded-2xl bg-slate-50/70 border border-slate-200">
                <h3 className="text-xs font-bold uppercase text-slate-900 tracking-wider font-mono border-b border-slate-200 pb-2">
                  {cat} ({catItems.filter((i) => i.checked).length}/{catItems.length})
                </h3>
                <div className="space-y-2">
                  {catItems.map((item) => (
                    <label
                      key={item.id}
                      onClick={() => toggleChecklistItem(item.id)}
                      className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer select-none hover:text-slate-950"
                    >
                      {item.checked ? (
                        <CheckSquare className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <Square className="size-4 text-slate-300 shrink-0 mt-0.5" />
                      )}
                      <span className={item.checked ? "text-slate-900 font-medium" : "text-slate-400"}>
                        {item.text}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. DATABASE DESIGN & TECH ARCHITECTURE */}
      <section className="bg-slate-950 text-white rounded-3xl p-8 sm:p-10 border border-slate-800 shadow-xl space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase font-mono border border-emerald-400/30">
            Relational Architecture
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            PostgreSQL Data Model & Stack
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Engineered for ACID transactional integrity, hardware IoT biometric sync, and high-concurrency member access.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <h3 className="font-bold text-emerald-400 font-mono">1. Member & Access Layer</h3>
            <p className="text-slate-400 text-[11px]">
              <code>members</code>, <code>membership_plans</code>, <code>memberships</code>, <code>attendance_logs</code>.
            </p>
            <div className="text-[10px] text-slate-500">
              Hardware relay integration with anti-passback and QR validation tokens.
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <h3 className="font-bold text-cyan-400 font-mono">2. Workouts & Assessment Layer</h3>
            <p className="text-slate-400 text-[11px]">
              <code>workout_plans</code>, <code>exercises</code>, <code>workout_exercises</code>, <code>fitness_assessments</code>.
            </p>
            <div className="text-[10px] text-slate-500">
              Exercise demo library with progression curves and macro nutrition targets.
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <h3 className="font-bold text-purple-400 font-mono">3. Finance, POS & CRM Layer</h3>
            <p className="text-slate-400 text-[11px]">
              <code>invoices</code>, <code>payments</code>, <code>expenses</code>, <code>products</code>, <code>leads</code>, <code>audit_logs</code>.
            </p>
            <div className="text-[10px] text-slate-500">
              1-Click UPI reconciliations, shake-bar inventory POS, and lead pipeline tracking.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* =========================================================================
   3. SALON OS — LUXURY BEAUTY, SPA & SALON OPERATING SYSTEM TEMPLATE
   ========================================================================= */
function SalonOsTemplate({ product }: { product: ProductItem }) {
  const [activeModuleFilter, setActiveModuleFilter] = useState<"all" | "core" | "operations" | "advanced" | "enterprise">("all");
  const [activeWorkflowTab, setActiveWorkflowTab] = useState(0);
  const [activeAiTab, setActiveAiTab] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState("11:30 AM");
  const [selectedStylist, setSelectedStylist] = useState("Elena Rostova (Master Colorist)");

  // Interactive 25-Item Application Readiness Checklist
  const [checklist, setChecklist] = useState([
    // Core features (7)
    { id: "c1", label: "Login & Role-Based Permissions (9 Roles)", cat: "Core", checked: true },
    { id: "c2", label: "Customer Registration & 360° Profile History", cat: "Core", checked: true },
    { id: "c3", label: "Categorized Service Catalog & Tiered Pricing", cat: "Core", checked: true },
    { id: "c4", label: "Multi-Chair Appointment Booking Calendar", cat: "Core", checked: true },
    { id: "c5", label: "Staff & Stylist Rosters with Skill Matrix", cat: "Core", checked: true },
    { id: "c6", label: "Fast POS Billing, Split Payments & Tax Invoices", cat: "Core", checked: true },
    { id: "c7", label: "Daily Executive Dashboard & Real-Time KPIs", cat: "Core", checked: true },
    // Business operations (6)
    { id: "b1", label: "Gram-Level Backbar Consumables vs Retail Stock", cat: "Operations", checked: true },
    { id: "b2", label: "Prepaid Service Packages & VIP Memberships", cat: "Operations", checked: true },
    { id: "b3", label: "Loyalty Points Earning & Gift Voucher Engine", cat: "Operations", checked: true },
    { id: "b4", label: "Post-Appointment Feedback & Stylist Reviews", cat: "Operations", checked: true },
    { id: "b5", label: "Tiered Stylist Commissions & Digital Tip Splits", cat: "Operations", checked: true },
    { id: "b6", label: "Automated WhatsApp Confirmations & Reminders", cat: "Operations", checked: true },
    // Advanced capabilities (6)
    { id: "a1", label: "Online Client Self-Booking Web/Instagram Portal", cat: "Advanced", checked: true },
    { id: "a2", label: "Multi-Branch & Franchise Network Controls", cat: "Advanced", checked: true },
    { id: "a3", label: "AI Natural Language Salon Query Assistant", cat: "Advanced", checked: true },
    { id: "a4", label: "4-6 Week Touch-Up Retention Signal Engine", cat: "Advanced", checked: true },
    { id: "a5", label: "Predictive Consumable Stock Reorder Forecasts", cat: "Advanced", checked: true },
    { id: "a6", label: "Automated WhatsApp Marketing Campaign Hub", cat: "Advanced", checked: true },
    // Production readiness (6)
    { id: "p1", label: "Organization & Branch-Level Data Isolation", cat: "Enterprise", checked: true },
    { id: "p2", label: "Tamper-Evident Audit Logs for Discounts & Edits", cat: "Enterprise", checked: true },
    { id: "p3", label: "Idempotent Payment Verification & Duplicate Lock", cat: "Enterprise", checked: true },
    { id: "p4", label: "Automated Daily Database Backups & Failover", cat: "Enterprise", checked: true },
    { id: "p5", label: "Granular Privacy & Communication Consent Controls", cat: "Enterprise", checked: true },
    { id: "p6", label: "Responsive Tablet POS & Mobile Stylist Portal", cat: "Enterprise", checked: true },
  ]);

  const toggleCheck = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const handleToggleAll = (val: boolean) => {
    setChecklist((prev) => prev.map((item) => ({ ...item, checked: val })));
  };

  const completedCount = checklist.filter((c) => c.checked).length;
  const progressPercent = Math.round((completedCount / checklist.length) * 100);

  // 14 Complete Application Modules
  const salonModules = [
    {
      id: "dashboard",
      num: "01",
      title: "Dashboard & Business Overview",
      category: "core",
      icon: LayoutGrid,
      purpose: "Give salon owners and managers a clear, real-time view of daily business activities.",
      bullets: [
        "Today's appointments, completed services, cancellations & no-shows",
        "Daily, weekly, and monthly revenue vs chair capacity benchmarks",
        "Active customers, new walk-ins, and lapsed client alerts",
        "Stylist availability, chair schedules, and low-stock consumable warnings"
      ]
    },
    {
      id: "crm",
      num: "02",
      title: "Customer Management (CRM & 360° Profiles)",
      category: "core",
      icon: Users,
      purpose: "Maintain a complete customer profile, formula archive, and treatment history.",
      bullets: [
        "Customer 360° cards: past services, color mixing ratios, and allergy test notes",
        "Preferred stylist assignments, visit frequency, and lifetime spending (LTV)",
        "Customer segmentation: VIP, Regular, High-Value, and At-Risk Lapsed",
        "Unique customer IDs, QR check-in code, and communication consent history"
      ]
    },
    {
      id: "services-pricing",
      num: "03",
      title: "Service & Price Management",
      category: "core",
      icon: Scissors,
      purpose: "Organize salon services, durations, stylist tiers, and bundled offers.",
      bullets: [
        "Categorized menus: Hair, Skin, Facials, Makeup, Nails, Spa & Grooming",
        "Tiered pricing based on stylist seniority (Senior Stylist vs Art Director)",
        "Configurable service durations, wash-basin buffer times & add-on treatments",
        "Branch-specific service catalogs, bridal packages, and promotional pricing"
      ]
    },
    {
      id: "appointment-booking",
      num: "04",
      title: "Appointment & Booking Matrix",
      category: "core",
      icon: Calendar,
      purpose: "Coordinate multi-chair bookings, service durations, and stylist availability.",
      bullets: [
        "Day, week, and month drag-and-drop calendar with stylist color coding",
        "Automated conflict prevention: validates chair, stylist, and station availability",
        "Walk-in queue management, arrival status, and waitlist automation",
        "Deposit collection rules, cancellation policies, and automated SMS/WhatsApp reminders"
      ]
    },
    {
      id: "staff-workforce",
      num: "05",
      title: "Staff, Stylist & Workforce Management",
      category: "operations",
      icon: UserCheck,
      purpose: "Manage employees, shift rosters, skill matrices, and service assignments.",
      bullets: [
        "Staff profiles, skill certifications, working shifts, and leave approvals",
        "Automated service assignments based on stylist qualification matrix",
        "Biometric attendance tracking and chair workload balancing",
        "Tiered service commission splits, retail sales incentives, and tip payouts"
      ]
    },
    {
      id: "billing-pos",
      num: "06",
      title: "Billing, Payments & Point of Sale (POS)",
      category: "operations",
      icon: CreditCard,
      purpose: "Generate fast, accurate bills for completed services, retail products, and deposits.",
      bullets: [
        "Fast 1-Click checkout combining treatments, add-ons, and retail haircare items",
        "Split payment support: Cash, Credit Card, UPI Dynamic QR, and Gift Cards",
        "Instant coupon, loyalty points, and prepaid package redemption",
        "Automated tax invoicing, daily cash closing, and register reconciliation"
      ]
    },
    {
      id: "inventory-consumables",
      num: "07",
      title: "Inventory & Product Management",
      category: "operations",
      icon: Package,
      purpose: "Track salon consumables, professional color tubes, and retail shelf merchandise.",
      bullets: [
        "Gram-level backbar consumable tracking auto-deducted per hair color service",
        "Retail inventory with barcode scanning, SKU, brand, and batch/expiry tracking",
        "Automated low-stock alerts, reorder thresholds, and supplier purchase orders",
        "Branch-wise stock transfers and shrinkage/damage audit logs"
      ]
    },
    {
      id: "memberships-loyalty",
      num: "08",
      title: "Memberships, Packages & Loyalty Programs",
      category: "operations",
      icon: Award,
      purpose: "Encourage repeat visits and build predictable recurring revenue.",
      bullets: [
        "Prepaid service bundles (e.g. 5 Facials + 1 Complimentary Blowout)",
        "VIP annual memberships with exclusive perks and priority chair bookings",
        "Points-based loyalty engine with automated birthday and festive perks",
        "Package redemption history tracking and automated expiry notifications"
      ]
    },
    {
      id: "customer-feedback",
      num: "09",
      title: "Customer Experience & Feedback",
      category: "operations",
      icon: HeartHandshake,
      purpose: "Improve service quality, client delight, and stylist review scores.",
      bullets: [
        "Automated post-service WhatsApp rating surveys and stylist reviews",
        "Formal complaint ticketing with resolution tracking and manager alerts",
        "VIP client consultation notes and bespoke refreshment preferences",
        "Stylist rebooking rate benchmarks and Net Promoter Score (NPS) analytics"
      ]
    },
    {
      id: "reports-analytics",
      num: "10",
      title: "Reports & Business Analytics",
      category: "advanced",
      icon: BarChart3,
      purpose: "Help salon owners understand revenue drivers, staff performance, and trends.",
      bullets: [
        "Revenue Per Available Chair Hour (RevPASH) and Average Ticket Size (ATS)",
        "Retail product vs service revenue split and margin calculations",
        "Appointment completion, cancellation, and no-show trend heatmaps",
        "Exportable audit-ready financial statements in CSV, Excel, and PDF"
      ]
    },
    {
      id: "ai-assistant",
      num: "11",
      title: "AI-Powered Salon Assistant",
      category: "advanced",
      icon: Bot,
      purpose: "Help salon teams interpret business data and automate routine administrative work.",
      bullets: [
        "Natural language Q&A for daily revenue, top stylists, and booking demand",
        "Predictive cancellation and no-show pattern detection",
        "Automated draft generation for 4-6 week hair color touch-up follow-ups",
        "Intelligent consumable reorder forecasts based on upcoming bookings"
      ]
    },
    {
      id: "crm-marketing",
      num: "12",
      title: "CRM, Marketing & Customer Retention",
      category: "advanced",
      icon: UserPlus,
      purpose: "Convert enquiries into bookings and win back lapsed clients.",
      bullets: [
        "Omnichannel lead capture: walk-in, Instagram, website, and phone enquiries",
        "Lead pipeline stages: New, Contacted, Consultation Booked, and Converted",
        "Automated WhatsApp promotional broadcasts for festive pampering packages",
        "90-day win-back campaign triggers for inactive high-value clients"
      ]
    },
    {
      id: "multibranch-franchise",
      num: "13",
      title: "Multi-Branch & Franchise Management",
      category: "enterprise",
      icon: Building2,
      purpose: "Operate multiple salon studios through centralized enterprise controls.",
      bullets: [
        "Centralized catalog management with branch-specific price overrides",
        "Cross-branch customer profile access and shared membership privileges",
        "Inter-branch stock transfers and consolidated network revenue comparisons",
        "Granular branch-level manager permissions and regional oversight"
      ]
    },
    {
      id: "admin-security",
      num: "14",
      title: "Administration, Security & Settings",
      category: "enterprise",
      icon: ShieldCheck,
      purpose: "Configure the application and safeguard sensitive customer and financial data.",
      bullets: [
        "Role-based access control (RBAC) across 9 predefined user roles",
        "Complete audit trails for discounts, price changes, refunds, and edits",
        "Multi-tenant data isolation, GDPR/privacy consent, and encrypted backups",
        "Customizable invoice headers, tax GST/VAT rules, and working hours"
      ]
    }
  ];

  // 5 Core Business Workflows
  const workflows = [
    {
      name: "1. Customer Appointment Booking",
      steps: [
        "Customer submits booking via Instagram, Web Portal, Phone, or Walk-in",
        "System checks stylist availability, chair capacity & service buffer time",
        "If available: slot is locked, and deposit collected if policy requires",
        "If unavailable: system intelligently suggests alternate stylists or slots",
        "Booking confirmed & automated WhatsApp confirmation link dispatched",
        "Calendar event synced to stylist roster & reminder scheduled 24h prior"
      ]
    },
    {
      name: "2. Customer Arrival & Service Completion",
      steps: [
        "Client arrives at salon; receptionist marks status as 'Arrived'",
        "Stylist reviews Customer 360° card (past color formulas & allergy notes)",
        "Service begins; status automatically updates to 'In Service'",
        "Stylist logs formula grams used (e.g. 30g 7N + 45g 20Vol developer)",
        "Service finishes; receptionist generates bill with add-ons & retail items",
        "Receipt printed / WhatsApped & automated 5-star review request sent"
      ]
    },
    {
      name: "3. Billing & Inventory Deduction",
      steps: [
        "Select completed appointment or register walk-in service ticket",
        "Add treatments, styling upgrades, and retail haircare merchandise",
        "Apply membership discount, seasonal coupon, or loyalty point balance",
        "Accept split payment via Cash, Credit Card, or Dynamic UPI QR",
        "Official GST/VAT tax invoice & receipt generated instantly",
        "Backbar grams & retail stock decremented in real time with audit log"
      ]
    },
    {
      name: "4. Customer Retention & Automated Rebooking",
      steps: [
        "AI engine identifies clients due for service (e.g. 4-6 weeks for root color)",
        "System reviews past service history, preferred stylist & communication consent",
        "Personalized WhatsApp rebooking message drafted with 1-Click calendar link",
        "Receptionist reviews and approves outbound communication batch",
        "Client books directly; conversion rate tracked in marketing analytics"
      ]
    },
    {
      name: "5. Daily Salon Closing & Cash Reconciliation",
      steps: [
        "Manager reviews all completed appointments, open tabs, and walk-ins",
        "Reconcile drawer cash, card terminal settlement & UPI payments",
        "Audit discounts, price overrides, refunds, and voided tickets",
        "Review daily backbar consumable usage and stock adjustment logs",
        "Calculate daily stylist commission totals and digital tip allocations",
        "Generate daily executive closing PDF report for salon ownership"
      ]
    }
  ];

  type WorkflowItem = (typeof workflows)[number];
  const currentWorkflow: WorkflowItem = workflows[activeWorkflowTab] ?? (workflows[0] as WorkflowItem);

  const filteredModules = activeModuleFilter === "all"
    ? salonModules
    : salonModules.filter((m) => m.category === activeModuleFilter);

  // 9 User Roles & Responsibilities
  const userRoles = [
    { role: "Platform Super Admin", desc: "Manage salon organizations, platform subscriptions, global security policies, and enterprise support access." },
    { role: "Salon Owner", desc: "Full administrative access to services, branches, staff payroll, commission structures, finances, and executive reports." },
    { role: "Salon Manager", desc: "Oversee daily appointments, staff shift rosters, customer escalations, backbar inventory, and register closing." },
    { role: "Receptionist / Front Desk", desc: "Register clients, manage multi-chair appointment calendars, handle walk-ins, and process POS checkout." },
    { role: "Stylist / Beautician", desc: "View daily appointment schedules, access customer color formula cards, record service completion, and view earned tips." },
    { role: "Finance Staff", desc: "Manage tax invoices, reconciliations, refunds, expenses, vendor payments, and accounting export statements." },
    { role: "Inventory Staff", desc: "Track salon consumables, purchase orders, goods received, barcode stock taking, and inter-branch transfers." },
    { role: "Marketing Staff", desc: "Create customer segments, launch WhatsApp campaigns, manage loyalty reward tiers, and track rebooking conversions." },
    { role: "Client / Customer", desc: "Self-book appointments online, view stylist availability, manage packages, and access digital invoice receipts." }
  ];

  // 5 AI Capabilities
  const aiCapabilities = [
    {
      title: "A. AI Business Assistant",
      icon: Bot,
      headline: "Natural Language Salon Query Engine",
      desc: "Ask conversational questions in plain English to uncover revenue drivers, busiest chair hours, and stylist performance without running complex manual reports.",
      examples: [
        "“Which services generated the highest profit margin this month?”",
        "“Show me chair utilization during weekday mornings vs weekend rush hours.”",
        "“Which stylist had the highest retail product cross-sell conversion rate?”"
      ]
    },
    {
      title: "B. Booking & Staffing Insights",
      icon: Calendar,
      headline: "Predictive Demand & Shift Optimization",
      desc: "Analyze booking trends, cancellation spikes, and rush-hour bottlenecks to recommend optimal stylist shift scheduling and reduce calendar gaps.",
      examples: [
        "Detect high-demand blowout & styling slots for upcoming festive seasons",
        "Flag recurring no-show patterns and automatically suggest deposit policies",
        "Estimate exact treatment durations based on past stylist performance"
      ]
    },
    {
      title: "C. Customer Retention Assistant",
      icon: Users,
      headline: "4-6 Week Service Lifecycle Rebooking",
      desc: "Identify clients due for maintenance (e.g. 4-6 weeks for root touch-ups, 8-10 weeks for keratin treatments) and draft personalized WhatsApp nudges.",
      examples: [
        "Intelligently detect clients showing 60+ day lapse signals",
        "Draft bespoke WhatsApp rebooking invitations with preferred stylist links",
        "Summarize customer sentiment and feedback trends across treatment categories"
      ]
    },
    {
      title: "D. Inventory Intelligence",
      icon: Package,
      headline: "Consumable Grams & Shelf Reorder Forecasts",
      desc: "Forecast professional hair color tube and developer consumption based on upcoming appointment calendars and lead times.",
      examples: [
        "Predict when Bleach & 20Vol Developer stocks will breach safe minimums",
        "Identify slow-moving retail haircare inventory nearing expiry",
        "Auto-generate suggested purchase orders for L'Oréal / Schwarzkopf distributors"
      ]
    },
    {
      title: "E. AI Communication Assistant",
      icon: MessageSquare,
      headline: "Automated VIP Messaging & Copywriting",
      desc: "Draft professional appointment confirmations, festive marketing campaigns, and thoughtful responses to customer review feedback.",
      examples: [
        "Draft personalized birthday pampering perks with voucher codes",
        "Generate polite, professional responses to online customer reviews",
        "Prepare concise daily closing briefing notes for salon managers"
      ]
    }
  ];

  // 12 Trigger Events & Automation Matrix
  const triggerMatrix = [
    { event: "New appointment created", action: "Send instant booking confirmation with calendar invite link", channel: "WhatsApp / SMS" },
    { event: "Appointment approaching (24h / 2h)", action: "Send interactive reminder with 1-Click confirm / reschedule options", channel: "WhatsApp" },
    { event: "Appointment rescheduled", action: "Notify customer and immediately update assigned stylist's calendar", channel: "WhatsApp / In-App" },
    { event: "Customer cancels appointment", action: "Release chair & notify next customer on waitlist automatically", channel: "System / In-App" },
    { event: "Customer marked as No-Show", action: "Update client profile reliability score and log for manager review", channel: "System" },
    { event: "Service completed & checked out", action: "Dispatch digital tax invoice receipt & 5-star review request", channel: "WhatsApp / SMS" },
    { event: "Client inactive for 45+ days", action: "Draft personalized 'We Miss You' pampering perk for approval", channel: "CRM Queue" },
    { event: "Prepaid package nearing expiry", action: "Notify client with remaining treatment balance and validity date", channel: "WhatsApp" },
    { event: "Payment successfully received", action: "Generate receipt, update balance, and credit stylist commission", channel: "In-App / Email" },
    { event: "Backbar product reaches low threshold", action: "Alert inventory manager and draft supplier purchase order", channel: "In-App Alert" },
    { event: "Product batch nearing expiry", action: "Flag stock in inventory dashboard for prioritized salon use", channel: "Inventory Tab" },
    { event: "Salon daily register closing", action: "Compile daily revenue, cash reconciliation, and email PDF report", channel: "Email to Owner" }
  ];

  return (
    <div className="space-y-16 font-sans">
      {/* 1. EDITORIAL LUXURY HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#160f13] via-[#21141b] to-[#120b0f] text-white rounded-3xl p-8 sm:p-12 border border-rose-900/40 shadow-2xl">
        <div className="absolute top-0 right-0 size-96 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 size-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 border border-rose-400/30 px-3.5 py-1 text-xs font-bold text-rose-300 font-mono">
                <Scissors className="size-3.5 text-rose-400" /> LazyMonkeyAI Salon OS
              </span>
              <span className="rounded-full bg-slate-800/90 text-amber-300 border border-amber-500/30 px-3 py-1 text-xs font-mono font-bold">
                14 FUNCTIONAL MODULES • COMPLETE BLUEPRINT
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.12]">
              Smarter Salon Management. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-pink-300 to-amber-300">
                Better Customer Experiences.
              </span>
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl">
              A centralized digital operating system for luxury hair salons, beauty parlours, spas, nail studios, grooming bars, and multi-branch chains. Coordinate appointments, customer 360° color formula cards, stylist rosters, POS billing, and backbar consumable tracking.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-rose-500/30">
                <div className="text-xl sm:text-2xl font-bold text-rose-300">40%</div>
                <div className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Fewer No-Shows</div>
              </div>
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-amber-500/30">
                <div className="text-xl sm:text-2xl font-bold text-amber-300">100%</div>
                <div className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Formula Precision</div>
              </div>
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-pink-500/30">
                <div className="text-xl sm:text-2xl font-bold text-pink-300">4-6 Wk</div>
                <div className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Auto-Rebooking</div>
              </div>
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-rose-500/30">
                <div className="text-xl sm:text-2xl font-bold text-white">14</div>
                <div className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Core Modules</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="#book-demo"
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-rose-500 via-pink-600 to-rose-600 text-white font-bold text-xs sm:text-sm shadow-lg hover:shadow-rose-500/25 transition-all cursor-pointer hover:brightness-110"
              >
                Book 1-on-1 Salon Demo →
              </a>
              <a
                href="https://saloon.lazymonkeyai.com/"
                target="_blank"
                rel="noreferrer"
                className="px-5 py-3.5 rounded-xl border border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/50 text-rose-200 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all"
              >
                Launch Salon Portal <ExternalLink className="size-3.5 text-rose-300" />
              </a>
            </div>
          </div>

          {/* Interactive Live Chair Booking & Formula Card Simulator */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-rose-500/30 bg-slate-950 p-6 shadow-2xl space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-rose-400 animate-pulse" />
                  <span className="font-bold text-white uppercase font-mono">Live Chair & Booking Simulator</span>
                </div>
                <span className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                  Chair #03 • Balayage Station
                </span>
              </div>

              {/* Stylist Selector */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-400">Assigned Stylist:</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "Elena Rostova (Master Colorist)",
                    "Marcus Vance (Barber Lead)",
                  ].map((stylist) => (
                    <button
                      key={stylist}
                      onClick={() => setSelectedStylist(stylist)}
                      className={`p-2 rounded-xl text-left text-[11px] font-bold transition-all border ${
                        selectedStylist === stylist
                          ? "bg-rose-900/40 border-rose-400 text-rose-200"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {stylist.split(" (")[0]}
                      <div className="text-[9px] font-normal text-slate-500">{stylist.split(" (")[1]?.replace(")", "")}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Slots */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-400">Available Time Slots:</div>
                <div className="grid grid-cols-4 gap-1.5 font-mono">
                  {["10:00 AM", "11:30 AM", "02:00 PM", "03:30 PM"].map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-1.5 rounded-lg text-center text-[10px] font-bold transition-all ${
                        selectedSlot === slot
                          ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-xs"
                          : "bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Customer 360° Color Formula Card */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between font-bold text-white">
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3.5 text-rose-400" /> Sophia Laurent
                  </span>
                  <span className="text-[10px] text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-md">VIP Platinum • 850 Pts</span>
                </div>
                <div className="text-[11px] text-rose-300 font-mono bg-slate-950 p-2 rounded-lg border border-slate-800">
                  Formula: 7N (30g) + 6A (15g) with 20 Vol Developer (45g) + Olaplex No.1
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Patch Test: Verified Safe (May 2026)</span>
                  <span className="text-emerald-400 font-bold">Booking Confirmed: {selectedSlot}</span>
                </div>
              </div>

              {/* Backbar Grams Deducted */}
              <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/20 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <Package className="size-4 text-rose-400" />
                  <span className="text-slate-300">Backbar Scale Deduction:</span>
                </div>
                <span className="text-rose-300 font-mono font-bold">90.0g Consumed (Auto-PO Active)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. BUILT TO IMPROVE SALON OPERATIONS (4 VALUE PILLARS) */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold uppercase font-mono">
            Salon Transformation
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
            Built to Improve Salon Operations
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Replace paper appointment books, manual register cash-ups, lost client color formulas, and separate spreadsheets with one unified luxury operating platform.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 hover:border-rose-400 transition-all">
            <div className="size-10 rounded-xl bg-rose-100 text-rose-700 grid place-items-center">
              <CheckCircle2 className="size-5" />
            </div>
            <h3 className="text-base font-bold text-slate-950">Simplify Daily Work</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bring appointments, checkout billing, customer 360° cards, and beauty inventory together in one unified workspace.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 hover:border-rose-400 transition-all">
            <div className="size-10 rounded-xl bg-amber-100 text-amber-700 grid place-items-center">
              <Sparkles className="size-5" />
            </div>
            <h3 className="text-base font-bold text-slate-950">Deliver Better Experiences</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Keep customer preferences, color mixing ratios, past treatments, and allergy test notes organized at every stylist chair.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 hover:border-rose-400 transition-all">
            <div className="size-10 rounded-xl bg-pink-100 text-pink-700 grid place-items-center">
              <BarChart3 className="size-5" />
            </div>
            <h3 className="text-base font-bold text-slate-950">Understand Your Business</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Review chair utilization (RevPASH), average ticket sizes, stylist commission summaries, and retail product sales in real time.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 hover:border-rose-400 transition-all">
            <div className="size-10 rounded-xl bg-purple-100 text-purple-700 grid place-items-center">
              <Building2 className="size-5" />
            </div>
            <h3 className="text-base font-bold text-slate-950">Support Business Growth</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Build a scalable foundation for opening new treatment rooms, hiring more stylists, and expanding multi-branch franchise networks.
            </p>
          </div>
        </div>
      </section>

      {/* VISUAL SHOWCASE: Luxury Salon & Client Experience */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider font-mono">Studio In Action</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-1">Luxury Styling Stations & Bespoke Client Care</h2>
          </div>
          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-bold">
            Chair Matrix • Color Bar Scales
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 hover:shadow-lg transition-all">
            <div className="relative h-48 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=800&auto=format&fit=crop"
                alt="Luxury Hair Styling & Balayage Chairs"
                className="size-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
              <span className="absolute bottom-3 left-3 text-xs font-bold text-white flex items-center gap-1.5">
                <Scissors className="size-3.5 text-rose-400" /> Premium Styling Chairs
              </span>
            </div>
            <div className="p-4 space-y-1.5">
              <h4 className="text-xs font-bold text-slate-950">Multi-Chair Booking & Buffer Times</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Color-coded stylist grid with automated wash-basin buffers and zero chair collision.
              </p>
            </div>
          </div>

          <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 hover:shadow-lg transition-all">
            <div className="relative h-48 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=800&auto=format&fit=crop"
                alt="Color Mixing & Backbar Formulations"
                className="size-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
              <span className="absolute bottom-3 left-3 text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-amber-400" /> Color Bar & Formulations
              </span>
            </div>
            <div className="p-4 space-y-1.5">
              <h4 className="text-xs font-bold text-slate-950">Customer 360° Color Cards & Scale POs</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Save exact mixing ratios (e.g. 7N + 6A 20vol) and auto-deduct backbar consumable grams.
              </p>
            </div>
          </div>

          <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 hover:shadow-lg transition-all">
            <div className="relative h-48 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=800&auto=format&fit=crop"
                alt="Spa & VIP Pampering Suites"
                className="size-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
              <span className="absolute bottom-3 left-3 text-xs font-bold text-white flex items-center gap-1.5">
                <HeartHandshake className="size-3.5 text-pink-400" /> VIP Spa & Facial Suites
              </span>
            </div>
            <div className="p-4 space-y-1.5">
              <h4 className="text-xs font-bold text-slate-950">Prepaid Packages & 4-6 Wk Rebooking</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Prepaid treatment bundles, automated WhatsApp rebooking alerts, and loyalty rewards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. COMPLETE 14 APPLICATION MODULES (WITH CATEGORY FILTER) */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider font-mono">Comprehensive Suite</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-1">14 Complete Application Modules</h2>
          </div>
          <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            {(["all", "core", "operations", "advanced", "enterprise"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveModuleFilter(filter)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                  activeModuleFilter === filter ? "bg-rose-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-950"
                }`}
              >
                {filter === "all" ? "All (14)" : filter}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {filteredModules.map((m) => {
            const IconComp = m.icon;
            return (
              <div
                key={m.id}
                className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 hover:border-rose-400 hover:bg-rose-50/20 hover:shadow-xs transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="size-9 rounded-xl bg-rose-100 text-rose-800 grid place-items-center">
                      <IconComp className="size-4.5" />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 font-bold">MODULE {m.num}</span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-950 leading-tight">{m.title}</h3>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{m.purpose}</p>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-200/60 text-xs text-slate-700">
                  {m.bullets.map((b) => (
                    <div key={b} className="flex items-start gap-1.5">
                      <CheckCircle2 className="size-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span className="text-[11px]">{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. IMPORTANT BUSINESS WORKFLOWS */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold uppercase font-mono">
            Standard Operating Procedures
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
            5 Core Salon Business Workflows
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Standardized operational automation designed for front-desk receptionists, master stylists, and salon administrators.
          </p>
        </div>

        {/* Workflow Tab Selector */}
        <div className="flex flex-wrap gap-2 justify-center">
          {workflows.map((wf, idx) => (
            <button
              key={wf.name}
              onClick={() => setActiveWorkflowTab(idx)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeWorkflowTab === idx
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {wf.name}
            </button>
          ))}
        </div>

        {/* Workflow Progression Box */}
        {currentWorkflow && (
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 max-w-4xl mx-auto">
            <h3 className="text-base font-bold text-slate-950 text-center">
              {currentWorkflow.name}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {currentWorkflow.steps?.map((step, sIdx) => (
                <div key={step} className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
                  <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                    STEP 0{sIdx + 1}
                  </span>
                  <p className="text-xs text-slate-700 leading-snug">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 5. 9 USER ROLES & PERMISSIONS MATRIX */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold uppercase font-mono">
            Access Control
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
            9 User Roles & Granular Permissions
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Tailored dashboard experiences for every salon team member ensuring client privacy and operational clarity.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {userRoles.map((ur) => (
            <div key={ur.role} className="p-4.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-rose-600" />
                <h4 className="text-xs font-bold text-slate-950">{ur.role}</h4>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">{ur.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. AI CAPABILITIES IN DEPTH */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="px-3 py-1 rounded-full bg-pink-100 text-pink-800 text-xs font-bold uppercase font-mono">
            Intelligent Automation
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
            AI Capabilities Built for Beauty Operations
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Practical AI tools that support actual salon workflows and business decisions rather than functioning only as generic chatbots.
          </p>
        </div>

        {/* AI Feature Tabs */}
        <div className="flex flex-wrap gap-2 justify-center">
          {aiCapabilities.map((ai, idx) => (
            <button
              key={ai.title}
              onClick={() => setActiveAiTab(idx)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeAiTab === idx
                  ? "bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md shadow-rose-600/20"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {ai.title}
            </button>
          ))}
        </div>

        {/* AI Capability Detail Card */}
        {aiCapabilities[activeAiTab] && (
          <div className="p-6 rounded-2xl bg-gradient-to-r from-rose-50/70 via-pink-50/40 to-amber-50/40 border border-rose-200/80 space-y-4 max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-rose-600 text-white grid place-items-center shadow-md">
                <Bot className="size-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-950">{aiCapabilities[activeAiTab]?.headline}</h3>
                <p className="text-xs text-slate-600">{aiCapabilities[activeAiTab]?.desc}</p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-rose-200/60">
              <span className="text-[11px] font-bold text-rose-800 uppercase font-mono">Practical Salon Examples & Prompts:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {aiCapabilities[activeAiTab]?.examples.map((ex) => (
                  <div key={ex} className="p-3 rounded-xl bg-white border border-rose-200/80 text-xs text-slate-700 shadow-2xs">
                    {ex}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 7. AUTOMATED NOTIFICATIONS & TRIGGER RULES MATRIX */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold uppercase font-mono">
            Smart Automation
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
            12 Automated Triggers & Event Actions
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Real-time event dispatchers keeping clients informed and staff proactively aligned.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-900 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Trigger Event</th>
                <th className="p-3.5">Suggested Automated Action</th>
                <th className="p-3.5">Delivery Channel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {triggerMatrix.map((tm, idx) => (
                <tr key={tm.event} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                  <td className="p-3.5 font-bold text-slate-950 flex items-center gap-1.5">
                    <Zap className="size-3 text-rose-600 shrink-0" />
                    {tm.event}
                  </td>
                  <td className="p-3.5">{tm.action}</td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-mono text-[10px] font-bold border border-rose-200">
                      {tm.channel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 8. INTERACTIVE 25-ITEM APPLICATION COMPLETION CHECKLIST */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold uppercase font-mono">
                Application Blueprint Readiness
              </span>
              <span className="text-xs font-bold font-mono text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                {completedCount} / {checklist.length} Complete ({progressPercent}%)
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-950 mt-2">
              25-Item Salon Feature Readiness Checklist
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleToggleAll(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-all cursor-pointer"
            >
              Select All
            </button>
            <button
              onClick={() => handleToggleAll(false)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-all cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-rose-500 to-pink-600 h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Categorized Checkbox List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {checklist.map((item) => (
            <div
              key={item.id}
              onClick={() => toggleCheck(item.id)}
              className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none ${
                item.checked
                  ? "bg-rose-50/40 border-rose-200 text-slate-950 shadow-2xs"
                  : "bg-slate-50/60 border-slate-200/70 text-slate-400"
              }`}
            >
              <div className="flex items-center gap-3">
                {item.checked ? (
                  <CheckSquare className="size-4 text-rose-600 shrink-0" />
                ) : (
                  <Square className="size-4 text-slate-400 shrink-0" />
                )}
                <span className={`text-xs ${item.checked ? "font-semibold" : "line-through"}`}>
                  {item.label}
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">{item.cat}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 9. DATABASE SCHEMA & FULL-STACK ARCHITECTURE */}
      <section className="bg-slate-950 text-white rounded-3xl p-8 sm:p-10 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <span className="text-xs font-bold text-rose-400 uppercase font-mono">Engineering Architecture</span>
            <h2 className="text-2xl font-extrabold mt-1">PostgreSQL Relational Schema & Stack</h2>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-mono text-slate-400">
            <span className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">Next.js + React 19</span>
            <span className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">Python + FastAPI</span>
            <span className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">PostgreSQL</span>
            <span className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">Celery + Redis</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <h3 className="font-bold text-rose-400 font-mono">1. Identity, Staff & Booking Layer</h3>
            <p className="text-slate-400 text-[11px]">
              <code>organizations</code>, <code>branches</code>, <code>users</code>, <code>roles</code>, <code>customers</code>, <code>customer_preferences</code>, <code>staff</code>, <code>staff_schedules</code>, <code>appointments</code>.
            </p>
            <div className="text-[10px] text-slate-500">
              Multi-chair appointments, stylist conflict prevention, and customer communication consent.
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <h3 className="font-bold text-pink-400 font-mono">2. Services, Formulas & Inventory</h3>
            <p className="text-slate-400 text-[11px]">
              <code>service_categories</code>, <code>services</code>, <code>service_branch_prices</code>, <code>products</code>, <code>suppliers</code>, <code>purchase_orders</code>, <code>inventory_transactions</code>, <code>product_service_usage</code>.
            </p>
            <div className="text-[10px] text-slate-500">
              Gram-level backbar color deductions, hair developer usage, and retail shelf inventory.
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <h3 className="font-bold text-amber-400 font-mono">3. Finance, Loyalty & AI Retention</h3>
            <p className="text-slate-400 text-[11px]">
              <code>invoices</code>, <code>invoice_items</code>, <code>payments</code>, <code>staff_commissions</code>, <code>membership_plans</code>, <code>service_packages</code>, <code>loyalty_accounts</code>, <code>campaigns</code>, <code>audit_logs</code>.
            </p>
            <div className="text-[10px] text-slate-500">
              Tiered stylist commission splits, digital tip payouts, and automated 4-6 week rebooking drafts.
            </div>
          </div>
        </div>
      </section>

      {/* 10. 4-PHASE IMPLEMENTATION ROADMAP */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xs space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold uppercase font-mono">
            Phased Rollout
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
            4-Phase Implementation Roadmap
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            A practical, structured approach to deploying core salon operations first, followed by automation, intelligence, and multi-branch scale.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">PHASE 01 • FOUNDATION</span>
            <h4 className="text-xs font-bold text-slate-950">Core Salon Operations</h4>
            <p className="text-[11px] text-slate-600">Role permissions, customer registration, service menus, multi-chair booking calendar, POS billing, and basic daily sales closing.</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">PHASE 02 • OPERATIONS</span>
            <h4 className="text-xs font-bold text-slate-950">Staff & Customer Workflows</h4>
            <p className="text-[11px] text-slate-600">Staff rosters, tiered stylist commissions, gram-level backbar inventory, service packages, and WhatsApp reminders.</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-[10px] font-mono font-bold text-pink-700 bg-pink-50 px-2 py-0.5 rounded-md">PHASE 03 • INTELLIGENCE</span>
            <h4 className="text-xs font-bold text-slate-950">Analytics & AI Assistant</h4>
            <p className="text-[11px] text-slate-600">4-6 week touch-up retention engine, AI business query assistant, consumable reorder forecasts, and RevPASH reports.</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">PHASE 04 • SCALE</span>
            <h4 className="text-xs font-bold text-slate-950">Multi-Branch & Franchise</h4>
            <p className="text-[11px] text-slate-600">Cross-branch client profiles, stock transfers, centralized service catalogs, franchise reporting, and enterprise SLAs.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* =========================================================================
   MAIN ROUTE CONTAINER & DISPATCHER
   ========================================================================= */
function ProductDetailPage() {
  const { productId } = useParams({ from: "/products/$productId" });
  const product = products.find((p) => p.id === productId) || products[0];

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    businessType: "Gym & Fitness Club",
    locations: "1 - 3 Branches",
    interestedModules: "Complete 16-Module Suite",
    estimatedUsers: "5 - 20 Users",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (!product) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] text-slate-900 flex flex-col justify-between">
        <Header />
        <div className="py-24 text-center">
          <h1 className="text-3xl font-extrabold text-slate-950">Product Not Found</h1>
          <Link to="/" className="mt-4 inline-flex items-center gap-1.5 text-purple-700 font-bold hover:underline">
            <ArrowLeft className="size-4" /> Return to Homepage
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#f8f9fb] text-slate-900 font-sans selection:bg-purple-500/20 selection:text-purple-900">
      <Header />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8 space-y-14">
        {/* Top Breadcrumb Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 font-medium border-b border-slate-200/90 pb-4">
          <div className="flex items-center gap-2">
            <Link to="/" className="hover:text-purple-700 transition-colors flex items-center gap-1 text-slate-700">
              <ArrowLeft className="size-3.5" /> Homepage
            </Link>
            <span className="text-slate-300">/</span>
            <a href="/#applications" className="hover:text-purple-700 transition-colors text-slate-700">
              Our Applications
            </a>
            <span className="text-slate-300">/</span>
            <span className="text-purple-700 font-bold bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-200">
              {product.name}
            </span>
          </div>

          {product.externalUrl && (
            <a
              href={product.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full hover:bg-emerald-100 transition-all shadow-2xs"
            >
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Portal: {product.externalUrl.replace("https://", "").replace("/", "")}
              <ExternalLink className="size-3 ml-0.5" />
            </a>
          )}
        </div>

        {/* Dynamic Bespoke Template Rendering based on Product ID */}
        {product.id === "ai-business-os" && <AiBusinessOsTemplate product={product} />}
        {product.id === "fit-club-ai" && <FitClubAiTemplate product={product} />}
        {product.id === "salon-os" && <SalonOsTemplate product={product} />}

        {/* Global Cross-Product Ecosystem Switcher */}
        <section className="bg-white rounded-3xl border border-slate-200/90 p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-purple-700 uppercase tracking-wider font-mono">Platform Ecosystem</span>
              <h3 className="text-xl font-extrabold text-slate-950">Explore Other Flagship Platforms</h3>
            </div>
            <Link to="/" className="text-xs font-bold text-purple-700 hover:underline flex items-center gap-1">
              View All Applications <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {products.map((p) => {
              const isCurrent = p.id === product.id;
              return (
                <Link
                  key={p.id}
                  to="/products/$productId"
                  params={{ productId: p.id }}
                  className={`rounded-2xl border p-4.5 transition-all flex items-center justify-between group ${
                    isCurrent
                      ? "bg-purple-50/60 border-purple-300 ring-2 ring-purple-400/20"
                      : "bg-slate-50/60 border-slate-200/80 hover:bg-white hover:border-purple-300 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid size-10 place-items-center rounded-xl ${
                        isCurrent ? "bg-purple-600 text-white" : "bg-white text-slate-700 border border-slate-200 group-hover:text-purple-600"
                      }`}
                    >
                      <Icon name={p.icon} className="size-5" />
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-slate-500 line-clamp-1">{p.category}</div>
                    </div>
                  </div>
                  {isCurrent ? (
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-md">
                      Current
                    </span>
                  ) : (
                    <ArrowRight className="size-4 text-slate-400 group-hover:translate-x-1 group-hover:text-purple-600 transition-all" />
                  )}
                </Link>
              );
            })}
          </div>
        </section>

        {/* Global Demo Booking & Contact Form */}
        <section id="book-demo" className="rounded-3xl border border-slate-200/90 bg-white p-8 sm:p-10 shadow-xl space-y-6">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100/80 border border-purple-200 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-purple-800">
              <Sparkles className="size-3.5 text-purple-700" /> Let's Talk About Your Fitness Business
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
              Schedule a 1-on-1 Walkthrough of {product.name}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Whether you manage a neighborhood gym, premium fitness club, personal training studio, or multi-branch franchise, our team will configure a live sandbox tailored to your facility.
            </p>
          </div>

          {submitted ? (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-8 text-center space-y-3">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-600 text-white shadow-md">
                <Check className="size-6" />
              </div>
              <h3 className="text-lg font-bold text-emerald-950">Inquiry Submitted Successfully!</h3>
              <p className="text-xs sm:text-sm text-emerald-800 max-w-md mx-auto">
                Thank you! Our technical specialists will review your requirements and reach out to <strong>{formData.email || "your email"}</strong> within 2 business hours.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Rivera"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50/60 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-600 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase">Business Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="alex@fitnessclub.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50/60 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase">Phone / WhatsApp Number</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50/60 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-600 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase">Club / Studio Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Iron & Pulse Fitness"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50/60 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase">Facility Type</label>
                  <select
                    value={formData.businessType}
                    onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50/60 px-3 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-purple-600 focus:bg-white focus:outline-none"
                  >
                    <option>Gym & Fitness Club</option>
                    <option>Personal Training Studio</option>
                    <option>CrossFit & Functional Box</option>
                    <option>Yoga & Pilates Studio</option>
                    <option>Multi-Branch Franchise</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase">Number of Clubs</label>
                  <select
                    value={formData.locations}
                    onChange={(e) => setFormData({ ...formData, locations: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50/60 px-3 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-purple-600 focus:bg-white focus:outline-none"
                  >
                    <option>1 Club / Location</option>
                    <option>2 - 5 Locations</option>
                    <option>6 - 20 Locations</option>
                    <option>20+ Franchise Network</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase">Active Members</label>
                  <select
                    value={formData.estimatedUsers}
                    onChange={(e) => setFormData({ ...formData, estimatedUsers: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50/60 px-3 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-purple-600 focus:bg-white focus:outline-none"
                  >
                    <option>100 - 500 Members</option>
                    <option>500 - 1,500 Members</option>
                    <option>1,500 - 5,000 Members</option>
                    <option>5,000+ Members</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase">Key Requirements</label>
                <textarea
                  rows={3}
                  placeholder="Describe your current software challenges (e.g. biometric turnstile sync, automated WhatsApp renewal links, trainer scheduling, shake bar POS)..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50/60 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-600 focus:bg-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 py-3.5 text-xs sm:text-sm font-bold text-white shadow-lg hover:shadow-purple-500/25 transition-all cursor-pointer hover:brightness-110"
              >
                <Send className="size-4" /> Submit Inquiry & Book 1-on-1 Walkthrough
              </button>
            </form>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
