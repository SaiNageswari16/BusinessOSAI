import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Zap,
  ShieldCheck,
  BarChart3,
  Layers,
  ShoppingBag,
  Package,
  Users,
  Building2,
  Receipt,
  Cpu,
  Bot,
  ArrowRight,
  CheckCircle2,
  Globe,
  Headphones,
  Database,
  Printer,
  ChevronRight,
  Menu,
  X,
  CreditCard,
  Briefcase,
  Wrench,
  Server,
  Workflow,
  Calculator,
  Send,
  Star,
  Check,
  Building,
  Store,
  Boxes,
  HelpCircle,
  Clock,
  Sparkle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, resolvePostAuthRoute } from "@/contexts/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: MarketingLandingPage,
});

type NavPage = "home" | "modules" | "services" | "solutions" | "pricing" | "about";

export function MarketingLandingPage() {
  const navigate = useNavigate();
  const { isAuthed, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<NavPage>("home");
  const [activeModuleTab, setActiveModuleTab] = useState<string>("inventory");
  const [selectedModuleModal, setSelectedModuleModal] = useState<any | null>(null);
  const [serviceModal, setServiceModal] = useState<any | null>(null);
  const [pricingCycle, setPricingCycle] = useState<"monthly" | "yearly">("yearly");

  // Calculator State
  const [storeCount, setStoreCount] = useState<number>(3);
  const [monthlyOrders, setMonthlyOrders] = useState<number>(1500);

  // Demo Contact Form State
  const [demoForm, setDemoForm] = useState({ name: "", email: "", phone: "", company: "", stores: "1-5", notes: "" });
  const [demoSubmitting, setDemoSubmitting] = useState(false);

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDemoSubmitting(true);
    setTimeout(() => {
      setDemoSubmitting(false);
      setServiceModal(null);
      toast.success("Thank you! Our enterprise solution team will contact you within 2 hours.");
      setDemoForm({ name: "", email: "", phone: "", company: "", stores: "1-5", notes: "" });
    }, 1000);
  };

  const modules = [
    {
      id: "inventory",
      title: "Inventory & AI RAG",
      icon: Package,
      badge: "AI Enriched",
      color: "from-indigo-600 to-violet-600",
      tagline: "Autonomous inventory management with web-grounded AI search & image enrichment.",
      summary: "Eliminate manual product data entry. Upload your barcode list and let our dual background AI workers fetch high-res photos, MRPs, HSN codes, and retail titles with 0ms UI delay.",
      features: [
        "Instant Barcode & SKU lookup (~12ms database latency)",
        "Dual Parallel AI RAG Workers for silent image & metadata enrichment",
        "Multi-Warehouse Put-away & Picking Rules (FIFO/LIFO/FEFO)",
        "Batch & Serial Traceability with expiration warning alerts",
        "Automated Reorder Level triggers & safety stock buffers"
      ],
      stats: { kpi1: "0ms", kpi1Label: "UI Delay", kpi2: "99.4%", kpi2Label: "AI Sourcing Accuracy" }
    },
    {
      id: "pos",
      title: "Point of Sale (POS)",
      icon: ShoppingBag,
      badge: "High-Speed",
      color: "from-emerald-600 to-teal-600",
      tagline: "High-speed retail & wholesale checkout supporting multi-currency and thermal printing.",
      summary: "Designed for busy checkout counters. Processes transactions in seconds, supports thermal receipts, barcode scanners, and seamless switching between retail selling prices and bulk wholesale rates.",
      features: [
        "Multi-currency support (🪙 ₹ INR, $ USD, € EUR) with real-time topbar switcher",
        "Dual Pricing Tiers: Retail Selling Price vs. Wholesale Bulk Price",
        "Offline-first local cache fallback for zero-downtime sales",
        "Thermal ESC/POS receipt printing & barcode scanner support",
        "Integrated split payments (Cash, UPI, Credit Card, Wallet)"
      ],
      stats: { kpi1: "< 2 sec", kpi1Label: "Checkout Time", kpi2: "100%", kpi2Label: "Offline Sync Guarantee" }
    },
    {
      id: "erp",
      title: "Core ERP Engine",
      icon: Layers,
      badge: "Enterprise",
      color: "from-blue-600 to-indigo-700",
      tagline: "Multi-tenant, multi-branch foundation built for scale and total operational control.",
      summary: "Manage multiple companies, brands, branches, and fiscal years under one unified roof with bank-grade security and role-based permissions.",
      features: [
        "Multi-company & branch hierarchy with global tenant isolation",
        "Granular Role-Based Access Control (RBAC) & audit logging",
        "Fiscal year locking & automated document numbering series",
        "Custom fields & flexible entity status tracking",
        "Real-time inter-branch transfer orders & stock sync"
      ],
      stats: { kpi1: "350+", kpi1Label: "ERP Endpoints", kpi2: "99.99%", kpi2Label: "Uptime SLA" }
    },
    {
      id: "accounting",
      title: "Finance & Accounting",
      icon: Receipt,
      badge: "Double-Entry",
      color: "from-purple-600 to-indigo-700",
      tagline: "Automated general ledger, accounts payable/receivable, and GST/Tax compliance.",
      summary: "Complete financial compliance engine with automated double-entry ledger postings on every invoice, payment, and inventory movement.",
      features: [
        "Double-entry journal vouchers & automated ledger postings",
        "Accounts Payable (AP) & Accounts Receivable (AR) aging analysis",
        "Real-time Profit & Loss, Balance Sheet & Trial Balance statements",
        "Multi-currency conversion & GST tax configuration rules",
        "Bank reconciliation & expense claim processing"
      ],
      stats: { kpi1: "100%", kpi1Label: "Audit Compliance", kpi2: "Realtime", kpi2Label: "P&L Generation" }
    },
    {
      id: "crm",
      title: "Sales & CRM",
      icon: Users,
      badge: "Growth",
      color: "from-amber-500 to-orange-600",
      tagline: "Customer 360, lead pipelines, deal tracking, and automated quote generation.",
      summary: "Convert leads into loyal customers. Track deal pipelines, automate quotations, send sales invoices, and calculate sales commissions effortlessly.",
      features: [
        "Visual kanban deal pipeline & lead conversion funnel",
        "Customer 360° history (Orders, Payments, Communications)",
        "Automated Quotations, Sales Orders & Proforma Invoices",
        "Sales rep commissions & territory performance analytics",
        "WhatsApp & Email invoice notifications"
      ],
      stats: { kpi1: "+38%", kpi1Label: "Lead Conversion", kpi2: "360°", kpi2Label: "Customer Visibility" }
    },
    {
      id: "procurement",
      title: "Procurement & Vendors",
      icon: Briefcase,
      badge: "Sourcing",
      color: "from-cyan-600 to-blue-700",
      tagline: "Streamlined purchase requisitions, PO generation, and vendor scorecards.",
      summary: "Automate purchase orders when stock hits reorder levels. Perform 3-way invoice matching against Goods Receipt Notes (GRN) to stop overbilling.",
      features: [
        "Automated Purchase Order (PO) creation from reorder triggers",
        "Goods Receipt Note (GRN) inspection & 3-way invoice matching",
        "Vendor rating scorecards & lead-time performance tracking",
        "Purchase price history & supplier catalog comparisons",
        "Land cost allocation (Freight, Customs, Insurance)"
      ],
      stats: { kpi1: "-15%", kpi1Label: "Procurement Cost", kpi2: "0%", kpi2Label: "Overbilling Errors" }
    },
    {
      id: "hrms",
      title: "HRMS & Payroll",
      icon: Building2,
      badge: "People",
      color: "from-rose-600 to-pink-600",
      tagline: "Complete employee lifecycle management, attendance, leave, and automated payroll.",
      summary: "Manage employee onboarding, attendance, shifts, leave balances, and monthly payroll calculation with automated tax deductions.",
      features: [
        "Employee records, organization hierarchy & document vault",
        "Biometric & online attendance logs with shift scheduling",
        "Leave management with multi-level approval workflows",
        "Automated monthly payroll generation with tax deductions",
        "Employee self-service portal for payslips & leaves"
      ],
      stats: { kpi1: "1-Click", kpi1Label: "Payroll Processing", kpi2: "100%", kpi2Label: "Tax Accuracy" }
    },
    {
      id: "iot",
      title: "IoT & Fleet Operations",
      icon: Cpu,
      badge: "Hardware",
      color: "from-teal-600 to-emerald-800",
      tagline: "Smart sensor telemetry, RFID tag scanning, and fleet asset management.",
      summary: "Connect physical hardware directly to your cloud ERP. Scan RFID tags in bulk, monitor cold-chain temperatures, and track fleet vehicle movements.",
      features: [
        "RFID tag read/write tracking & UHF scanner integration",
        "Real-time sensor telemetry for warehouse temperature & humidity",
        "Asset maintenance schedules & breakdown alerts",
        "Fleet tracking & logistics movement logs",
        "Barcode scanner & handheld terminal SDKs"
      ],
      stats: { kpi1: "< 50ms", kpi1Label: "Telemetry Latency", kpi2: "10k+", kpi2Label: "RFID Scans/Min" }
    },
    {
      id: "copilot",
      title: "AI Copilot & BI Analytics",
      icon: Bot,
      badge: "Autonomous",
      color: "from-violet-600 to-purple-800",
      tagline: "Natural language query engine, automated forecasting, and executive dashboards.",
      summary: "Your 24/7 AI Chief Operating Officer. Ask questions in plain English, forecast seasonal demand, and get predictive insights before stock runs out.",
      features: [
        "Ask AI anything: 'What were our top 5 products in Mumbai last month?'",
        "Predictive stockout & reorder demand forecasting",
        "Real-time BI dashboards across 350+ enterprise KPIs",
        "Automated daily/weekly summary reports via Email/Slack",
        "Autonomous anomaly detection for suspicious refunds/voids"
      ],
      stats: { kpi1: "24/7", kpi1Label: "Autonomous Insights", kpi2: "350+", kpi2Label: "Built-in KPIs" }
    }
  ];

  const services = [
    {
      id: "ai_auto",
      title: "Enterprise AI Automation & Model Tuning",
      desc: "Custom AI agent fine-tuning and web scrapers tailored specifically to your product catalog, industry jargon, and custom enterprise workflows.",
      icon: Bot,
      color: "bg-indigo-50 text-indigo-600 border-indigo-200"
    },
    {
      id: "pos_hw",
      title: "POS Hardware & Peripheral Integration",
      desc: "Plug-and-play setup for ESC/POS thermal printers, multi-laser barcode scanners, cash drawers, and digital weighing scales.",
      icon: Printer,
      color: "bg-emerald-50 text-emerald-600 border-emerald-200"
    },
    {
      id: "cloud_db",
      title: "Cloud Infrastructure & Multi-Region Setup",
      desc: "Dedicated AWS/Azure/GCP multi-region cloud deployments with high availability PostgreSQL clusters and Redis caching.",
      icon: Server,
      color: "bg-purple-50 text-purple-600 border-purple-200"
    },
    {
      id: "migration",
      title: "Legacy ERP Data Migration",
      desc: "Zero-downtime, lossless data migration from SAP, Tally Prime, Zoho Books, Odoo, and legacy Excel databases.",
      icon: Database,
      color: "bg-amber-50 text-amber-600 border-amber-200"
    },
    {
      id: "custom_ext",
      title: "Custom Module Development & Workflows",
      desc: "Tailor-made ERP extensions, custom REST APIs, and third-party webhooks built to match your unique operational logic.",
      icon: Workflow,
      color: "bg-rose-50 text-rose-600 border-rose-200"
    },
    {
      id: "sla_support",
      title: "24/7 Priority SLA & Dedicated Engineers",
      desc: "Round-the-clock enterprise support with dedicated account managers, staff training, and 99.99% operational uptime SLA.",
      icon: Headphones,
      color: "bg-cyan-50 text-cyan-600 border-cyan-200"
    }
  ];

  const solutions = [
    {
      title: "Retail Supermarkets & FMCG Chains",
      desc: "High-speed multi-lane barcode checkout, batch expiry alerts, and automated stock reordering for fast-moving consumer goods.",
      icon: Store,
      badge: "Retail"
    },
    {
      title: "Wholesale Distributors & Traders",
      desc: "Dual retail vs wholesale pricing tiers, bulk quantity discounts, credit limits, and automated PO generation.",
      icon: Boxes,
      badge: "Wholesale"
    },
    {
      title: "E-Commerce Brands & D2C",
      desc: "Unified inventory sync across storefronts, multi-warehouse fulfillment, automated shipping labels, and CRM tracking.",
      icon: Globe,
      badge: "E-Commerce"
    },
    {
      title: "Multi-Branch Franchise Networks",
      desc: "Centralized tenant admin controls, branch P&L reports, inter-branch stock transfers, and global price management.",
      icon: Building,
      badge: "Enterprise"
    }
  ];

  const currentModule = modules.find(m => m.id === activeModuleTab) || modules[0];

  // Estimated ROI Calculations
  const calculatedSavings = Math.round(storeCount * 28500 + monthlyOrders * 12);
  const hoursSaved = Math.round(storeCount * 45 + (monthlyOrders / 100) * 8);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-600 selection:text-white overflow-x-hidden">
      
      {/* ── Top Announcement Banner ─────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 text-white text-xs font-semibold py-2.5 px-4 text-center flex items-center justify-center gap-2 border-b border-indigo-700/50 shadow-sm">
        <span className="bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 px-2 py-0.5 rounded-full font-bold uppercase text-[10px]">
          NEW RELEASE v2.5
        </span>
        <span>Dual Parallel AI Workers & Multi-Currency POS with 🪙 ₹ INR Support is now Live!</span>
        <button onClick={() => setCurrentPage("modules")} className="underline font-bold hover:text-indigo-200 ml-1">
          Explore Features →
        </button>
      </div>

      {/* ── Navigation Header (Matching Application Theme) ─────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => setCurrentPage("home")}>
            <div className="size-12 shrink-0 flex items-center justify-center rounded-2xl bg-indigo-50 p-1.5 border border-indigo-200/80 shadow-xs">
              <img src="/Logo.png" alt="LazyMonkeyAI Logo" className="size-full object-contain" />
            </div>
            <div>
              <div className="font-extrabold text-xl tracking-tight text-slate-900 flex items-center gap-1.5">
                LazyMonkeyAI
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                  Active OS
                </span>
              </div>
              <div className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest">
                Smart AI for Lazy Geniuses
              </div>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <button
              onClick={() => setCurrentPage("home")}
              className={`transition-colors hover:text-indigo-600 ${currentPage === "home" ? "text-indigo-600 font-bold border-b-2 border-indigo-600 py-1" : ""}`}
            >
              Home
            </button>
            <button
              onClick={() => setCurrentPage("modules")}
              className={`transition-colors hover:text-indigo-600 ${currentPage === "modules" ? "text-indigo-600 font-bold border-b-2 border-indigo-600 py-1" : ""}`}
            >
              Modules (9)
            </button>
            <button
              onClick={() => setCurrentPage("services")}
              className={`flex items-center gap-1.5 transition-colors hover:text-indigo-600 ${currentPage === "services" ? "text-indigo-600 font-bold border-b-2 border-indigo-600 py-1" : ""}`}
            >
              Services
              <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-md border border-emerald-200">
                PRO
              </span>
            </button>
            <button
              onClick={() => setCurrentPage("solutions")}
              className={`transition-colors hover:text-indigo-600 ${currentPage === "solutions" ? "text-indigo-600 font-bold border-b-2 border-indigo-600 py-1" : ""}`}
            >
              Solutions
            </button>
            <button
              onClick={() => setCurrentPage("pricing")}
              className={`transition-colors hover:text-indigo-600 ${currentPage === "pricing" ? "text-indigo-600 font-bold border-b-2 border-indigo-600 py-1" : ""}`}
            >
              Pricing
            </button>
            <button
              onClick={() => setCurrentPage("about")}
              className={`transition-colors hover:text-indigo-600 ${currentPage === "about" ? "text-indigo-600 font-bold border-b-2 border-indigo-600 py-1" : ""}`}
            >
              About Us
            </button>
          </nav>

          {/* Action CTAs */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthed && user ? (
              <Button
                onClick={() => navigate({ to: resolvePostAuthRoute(user) })}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 h-11 rounded-xl shadow-md transition-all"
              >
                Go to Workspace →
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => navigate({ to: "/login" })}
                  className="border-slate-200 text-slate-700 hover:bg-slate-100 font-bold px-4 h-11 rounded-xl"
                >
                  Sign In / Login
                </Button>
                <Button
                  onClick={() => navigate({ to: "/login", search: { mode: "register" } })}
                  className="gradient-brand text-white font-bold px-5 h-11 rounded-xl shadow-md transition-all border-0"
                >
                  Create Workspace <ArrowRight className="size-4 ml-1.5" />
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-600">
              {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-6 space-y-3">
            <button onClick={() => { setCurrentPage("home"); setMobileMenuOpen(false); }} className="block w-full text-left py-2 font-semibold text-slate-800">Home</button>
            <button onClick={() => { setCurrentPage("modules"); setMobileMenuOpen(false); }} className="block w-full text-left py-2 font-semibold text-slate-800">Modules (9)</button>
            <button onClick={() => { setCurrentPage("services"); setMobileMenuOpen(false); }} className="block w-full text-left py-2 font-semibold text-emerald-600 font-bold">Services PRO</button>
            <button onClick={() => { setCurrentPage("solutions"); setMobileMenuOpen(false); }} className="block w-full text-left py-2 font-semibold text-slate-800">Solutions</button>
            <button onClick={() => { setCurrentPage("pricing"); setMobileMenuOpen(false); }} className="block w-full text-left py-2 font-semibold text-slate-800">Pricing</button>
            <button onClick={() => { setCurrentPage("about"); setMobileMenuOpen(false); }} className="block w-full text-left py-2 font-semibold text-slate-800">About Us</button>
            <div className="pt-4 flex flex-col gap-2">
              <Button onClick={() => { setMobileMenuOpen(false); navigate({ to: "/login" }); }} className="gradient-brand text-white font-bold h-11">
                Sign In / Login
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* ── PAGE CONTENT RENDERER ────────────────────────────────────── */}
      <main>
        
        {/* ══════════════════════════════════════════════════════════════
             PAGE 1: HOME PAGE
           ══════════════════════════════════════════════════════════════ */}
        {currentPage === "home" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            
            {/* Hero Section */}
            <section className="relative pt-16 pb-20 lg:pt-24 lg:pb-28 bg-gradient-to-b from-indigo-50/60 via-white to-slate-50 border-b border-slate-200/80">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100/80 border border-indigo-200 text-indigo-800 text-xs font-bold uppercase tracking-wider mb-8">
                  <Sparkles className="size-4 text-indigo-600" />
                  AI-Driven Enterprise Business OS & Multi-Currency POS
                </motion.div>

                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
                  One Platform.<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700">
                    Every Operation of Your Business.
                  </span>
                </h1>

                <p className="mt-8 text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
                  Unified Core ERP, High-Speed POS, AI Barcode RAG Enrichment, CRM, HRMS, and Double-Entry Accounting — built for ambitious enterprises and lazy geniuses.
                </p>

                <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button
                    onClick={() => navigate({ to: "/login", search: { mode: "register" } })}
                    className="w-full sm:w-auto h-14 px-8 text-base gradient-brand text-white font-bold rounded-2xl shadow-lg transition-all transform hover:-translate-y-0.5 border-0"
                  >
                    Start Free Workspace <ArrowRight className="size-5 ml-2" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setServiceModal({ title: "Schedule Custom Demo", type: "demo" })}
                    className="w-full sm:w-auto h-14 px-8 text-base border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-bold rounded-2xl shadow-xs"
                  >
                    <Clock className="size-5 mr-2 text-indigo-600" /> Book Enterprise Demo
                  </Button>
                </div>

                {/* Key Benefits Grid */}
                <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto text-left">
                  {[
                    { label: "0ms UI Fetch Delay", desc: "Local DB priority with silent background AI", icon: Zap, color: "text-amber-500" },
                    { label: "Multi-Currency POS", desc: "🪙 ₹ INR, $ USD, € EUR live topbar", icon: CreditCard, color: "text-emerald-600" },
                    { label: "Dual AI Workers", desc: "Parallel inventory & master catalog RAG", icon: Bot, color: "text-indigo-600" },
                    { label: "Dual Pricing Tiers", desc: "Retail Selling Price vs Wholesale Rate", icon: Receipt, color: "text-purple-600" },
                  ].map((item, i) => (
                    <div key={i} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                      <item.icon className={`size-7 ${item.color} mb-3`} />
                      <div className="font-bold text-sm text-slate-900">{item.label}</div>
                      <div className="text-xs text-slate-500 mt-1 leading-snug">{item.desc}</div>
                    </div>
                  ))}
                </div>

              </div>
            </section>

            {/* Live Interactive Module Switcher Section */}
            <section className="py-20 bg-white border-b border-slate-200/80">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                
                <div className="text-center mb-12">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Enterprise Platform Matrix</span>
                  <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mt-2">
                    Explore Our 9 Integrated Modules
                  </h2>
                </div>

                {/* Module Bar */}
                <div className="flex items-center justify-center gap-2 flex-wrap mb-10">
                  {modules.map(m => {
                    const Icon = m.icon;
                    const isActive = activeModuleTab === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setActiveModuleTab(m.id)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                          isActive
                            ? "gradient-brand text-white shadow-md scale-105"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        <Icon className="size-4" /> {m.title}
                      </button>
                    );
                  })}
                </div>

                {/* Active Module Showcase */}
                <div className="grid lg:grid-cols-12 gap-8 items-center bg-slate-900 text-white rounded-3xl p-8 sm:p-12 shadow-2xl">
                  <div className="lg:col-span-6 space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider border border-indigo-500/30">
                      {currentModule.badge}
                    </div>
                    <h3 className="text-3xl font-extrabold text-white">{currentModule.title}</h3>
                    <p className="text-slate-300 text-base leading-relaxed">{currentModule.summary}</p>
                    
                    <div className="space-y-2.5 pt-2">
                      {currentModule.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-200">
                          <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 flex gap-4">
                      <Button
                        onClick={() => setSelectedModuleModal(currentModule)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 h-11 rounded-xl"
                      >
                        View Full Module Spec <ChevronRight className="size-4 ml-1" />
                      </Button>
                    </div>
                  </div>

                  {/* Module Live Stats / Preview Box */}
                  <div className="lg:col-span-6 bg-slate-950 rounded-2xl p-6 border border-slate-800 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div className="flex items-center gap-3">
                        <currentModule.icon className="size-6 text-indigo-400" />
                        <span className="font-bold text-white text-base">{currentModule.title} Engine</span>
                      </div>
                      <span className="text-xs text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                        STATUS: ACTIVE
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                        <div className="text-3xl font-extrabold text-indigo-400">{currentModule.stats.kpi1}</div>
                        <div className="text-xs text-slate-400 font-medium mt-1">{currentModule.stats.kpi1Label}</div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                        <div className="text-3xl font-extrabold text-emerald-400">{currentModule.stats.kpi2}</div>
                        <div className="text-xs text-slate-400 font-medium mt-1">{currentModule.stats.kpi2Label}</div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-mono text-slate-300 space-y-2">
                      <div>✔ <strong>Multi-Tenant Isolation:</strong> Enabled</div>
                      <div>✔ <strong>Role-Based Access:</strong> Enforced</div>
                      <div>✔ <strong>Audit Logging:</strong> Active</div>
                    </div>
                  </div>
                </div>

              </div>
            </section>

          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════
             PAGE 2: MODULES DETAILED PAGE
           ══════════════════════════════════════════════════════════════ */}
        {currentPage === "modules" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Complete System Architecture</span>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mt-2">
                All 9 Core Enterprise Modules
              </h1>
              <p className="mt-4 text-slate-600 text-base sm:text-lg max-w-2xl mx-auto">
                Explore every component of LazyMonkeyAI. Built natively into a single database schema without external glue code.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {modules.map((m) => {
                const Icon = m.icon;
                return (
                  <div key={m.id} className="bg-white border border-slate-200 rounded-3xl p-7 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="size-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
                          <Icon className="size-6" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {m.badge}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">{m.title}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed mb-6">{m.tagline}</p>
                      
                      <div className="space-y-2 border-t border-slate-100 pt-4 mb-6">
                        {m.features.slice(0, 3).map((f, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
                            <Check className="size-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={() => setSelectedModuleModal(m)}
                      variant="outline"
                      className="w-full border-slate-200 text-indigo-600 hover:bg-indigo-50 font-bold h-10 text-xs rounded-xl"
                    >
                      Explore {m.title} Spec →
                    </Button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════
             PAGE 3: SERVICES PRO PAGE
           ══════════════════════════════════════════════════════════════ */}
        {currentPage === "services" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider border border-emerald-200 mb-4">
                <Wrench className="size-4" /> Enterprise Engineering & Professional Services
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
                Tailored Solution Services For Enterprise Scale
              </h1>
              <p className="mt-4 text-slate-600 text-base sm:text-lg max-w-2xl mx-auto">
                Our in-house solution architects deploy, customize, hardware-integrate, and maintain your LazyMonkeyAI platform.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
              {services.map((srv) => {
                const Icon = srv.icon;
                return (
                  <div key={srv.id} className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
                    <div>
                      <div className={`size-14 rounded-2xl ${srv.color} border flex items-center justify-center mb-6`}>
                        <Icon className="size-7" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-3">{srv.title}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed mb-6">{srv.desc}</p>
                    </div>

                    <Button
                      onClick={() => setServiceModal(srv)}
                      className="w-full gradient-brand text-white font-bold h-11 text-xs rounded-xl shadow-xs border-0"
                    >
                      Request Service Proposal →
                    </Button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════
             PAGE 4: SOLUTIONS PAGE
           ══════════════════════════════════════════════════════════════ */}
        {currentPage === "solutions" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Industry Specific Implementations</span>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mt-2">
                Built For Your Industry
              </h1>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-16">
              {solutions.map((sol, idx) => {
                const Icon = sol.icon;
                return (
                  <div key={idx} className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xs flex items-start gap-6">
                    <div className="size-16 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
                      <Icon className="size-8" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
                        {sol.badge}
                      </span>
                      <h3 className="text-2xl font-bold text-slate-900 mt-2 mb-2">{sol.title}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">{sol.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════
             PAGE 5: PRICING & ROI CALCULATOR PAGE
           ══════════════════════════════════════════════════════════════ */}
        {currentPage === "pricing" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Transparent Value</span>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mt-2">
                Flexible Pricing & Instant ROI
              </h1>
            </div>

            {/* Interactive Savings / ROI Calculator */}
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-3xl p-8 sm:p-12 mb-16 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <Calculator className="size-6 text-indigo-400" />
                <h3 className="text-xl font-bold">Interactive ROI & Time Savings Calculator</h3>
              </div>

              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">Number of Stores / Outlets: {storeCount}</label>
                    <input type="range" min="1" max="50" value={storeCount} onChange={(e) => setStoreCount(Number(e.target.value))} className="w-full accent-indigo-500 cursor-pointer" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">Monthly Orders / Transactions: {monthlyOrders.toLocaleString()}</label>
                    <input type="range" min="200" max="20000" step="100" value={monthlyOrders} onChange={(e) => setMonthlyOrders(Number(e.target.value))} className="w-full accent-indigo-500 cursor-pointer" />
                  </div>
                </div>

                <div className="bg-slate-950/80 rounded-2xl p-6 border border-slate-800 text-center">
                  <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Estimated Monthly Cost Savings</div>
                  <div className="text-4xl font-extrabold text-emerald-400 mt-2">₹{calculatedSavings.toLocaleString()} / mo</div>
                  <div className="text-xs text-indigo-300 font-semibold mt-2">⏱️ ~{hoursSaved} Man-Hours Saved per month</div>
                </div>
              </div>
            </div>

            {/* Pricing Tiers */}
            <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="text-lg font-bold text-slate-900">Starter Retail</div>
                  <div className="text-slate-500 text-xs mt-1">Single store or small shop.</div>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-slate-900">₹2,499</span>
                    <span className="text-xs text-slate-500">/ month</span>
                  </div>
                  <div className="mt-8 space-y-3">
                    {["Single Store Branch", "High-Speed POS & Barcode Lookup", "Basic Inventory Management", "Up to 5 User Accounts"].map((f, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs text-slate-700">
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" /> {f}
                      </div>
                    ))}
                  </div>
                </div>
                <Button onClick={() => navigate({ to: "/login", search: { mode: "register" } })} className="mt-8 w-full bg-slate-900 text-white font-bold h-11 rounded-xl">
                  Get Started Free
                </Button>
              </div>

              <div className="bg-gradient-to-b from-indigo-50 to-white border-2 border-indigo-600 rounded-3xl p-8 flex flex-col justify-between shadow-md relative">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider">
                  Most Popular
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">Business Enterprise</div>
                  <div className="text-slate-500 text-xs mt-1">Growing retail chains & wholesalers.</div>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-indigo-950">₹6,999</span>
                    <span className="text-xs text-slate-500">/ month</span>
                  </div>
                  <div className="mt-8 space-y-3">
                    {[
                      "Multi-Branch & Warehouse Put-away",
                      "Dual Parallel AI RAG Image Enrichment",
                      "Double-Entry Accounting & GST",
                      "Sales CRM & Procurement POs",
                      "Up to 25 User Accounts"
                    ].map((f, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs text-slate-800 font-medium">
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" /> {f}
                      </div>
                    ))}
                  </div>
                </div>
                <Button onClick={() => navigate({ to: "/login", search: { mode: "register" } })} className="mt-8 w-full gradient-brand text-white font-bold h-11 rounded-xl shadow-md border-0">
                  Launch Business OS
                </Button>
              </div>

              <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="text-lg font-bold text-slate-900">Enterprise Unlimited</div>
                  <div className="text-slate-500 text-xs mt-1">Large-scale enterprises.</div>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-slate-900">Custom</span>
                  </div>
                  <div className="mt-8 space-y-3">
                    {[
                      "Unlimited Tenants, Branches & Warehouses",
                      "Dedicated AI Agent Fine-tuning",
                      "IoT Sensor & Fleet Telemetry",
                      "Custom Cloud & Multi-Region DB",
                      "Dedicated 24/7 SLA Support"
                    ].map((f, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs text-slate-700">
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" /> {f}
                      </div>
                    ))}
                  </div>
                </div>
                <Button onClick={() => setServiceModal({ title: "Enterprise Pricing Inquiry", type: "enterprise" })} className="mt-8 w-full bg-slate-900 text-white font-bold h-11 rounded-xl">
                  Contact Enterprise Team
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════
             PAGE 6: ABOUT US & SECURITY PAGE
           ══════════════════════════════════════════════════════════════ */}
        {currentPage === "about" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Our Mission</span>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mt-2">
                Smart AI For Lazy Geniuses
              </h1>
              <p className="mt-4 text-slate-600 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                LazyMonkeyAI was founded with a single mission: to eliminate tedious, repetitive operational work from business management using autonomous AI agents.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 text-center mb-16">
              <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xs">
                <ShieldCheck className="size-10 text-indigo-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">SOC 2 Type II Certified</h3>
                <p className="text-xs text-slate-600">Bank-grade data encryption, multi-tenant isolation, and continuous vulnerability scanning.</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xs">
                <Globe className="size-10 text-emerald-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">47+ Countries</h3>
                <p className="text-xs text-slate-600">Empowering 8,200+ retail stores, distributors, and enterprise networks globally.</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xs">
                <Bot className="size-10 text-purple-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">Autonomous Engineering</h3>
                <p className="text-xs text-slate-600">Continuous AI model improvements with 0ms UI blocking and dual background queue workers.</p>
              </div>
            </div>
          </motion.div>
        )}

      </main>

      {/* ── MODALS (Module Detail Spec & Service Request) ───────────── */}
      {selectedModuleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-3">
                <selectedModuleModal.icon className="size-6 text-indigo-600" />
                <h3 className="font-extrabold text-lg text-slate-900">{selectedModuleModal.title}</h3>
              </div>
              <button onClick={() => setSelectedModuleModal(null)} className="text-slate-400 hover:text-slate-600"><X className="size-5" /></button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{selectedModuleModal.summary}</p>
            
            <div className="space-y-2 py-2">
              <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">Key Technical Specifications:</div>
              {selectedModuleModal.features.map((feat: string, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button variant="outline" onClick={() => setSelectedModuleModal(null)} className="h-10 text-xs">Close</Button>
              <Button onClick={() => { setSelectedModuleModal(null); navigate({ to: "/login" }); }} className="gradient-brand text-white font-bold h-10 text-xs border-0">
                Launch {selectedModuleModal.title} Workspace →
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {serviceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-base text-slate-900">{serviceModal.title || "Enterprise Service Proposal"}</h3>
              <button onClick={() => setServiceModal(null)} className="text-slate-400 hover:text-slate-600"><X className="size-5" /></button>
            </div>

            <form onSubmit={handleDemoSubmit} className="space-y-3">
              <div>
                <Label className="text-xs text-slate-700 font-semibold">Your Full Name *</Label>
                <Input required value={demoForm.name} onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })} className="h-9 text-xs mt-1" placeholder="e.g. Rahul Sharma" />
              </div>
              <div>
                <Label className="text-xs text-slate-700 font-semibold">Work Email *</Label>
                <Input type="email" required value={demoForm.email} onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })} className="h-9 text-xs mt-1" placeholder="rahul@company.com" />
              </div>
              <div>
                <Label className="text-xs text-slate-700 font-semibold">Company Name *</Label>
                <Input required value={demoForm.company} onChange={(e) => setDemoForm({ ...demoForm, company: e.target.value })} className="h-9 text-xs mt-1" placeholder="Acme Retail Ltd" />
              </div>
              <div>
                <Label className="text-xs text-slate-700 font-semibold">Phone Number</Label>
                <Input value={demoForm.phone} onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })} className="h-9 text-xs mt-1" placeholder="+91 98765 43210" />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setServiceModal(null)} className="h-9 text-xs">Cancel</Button>
                <Button type="submit" disabled={demoSubmitting} className="gradient-brand text-white font-bold h-9 text-xs border-0">
                  {demoSubmitting ? "Submitting..." : "Submit Proposal Request"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── FOOTER ─────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-white pt-16 pb-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img src="/Logo.png" alt="LazyMonkeyAI Logo" className="size-10 object-contain" />
                <span className="font-bold text-xl text-white">LazyMonkeyAI</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Smart AI for Lazy Geniuses. The unified enterprise business operating system powering modern retail, wholesale & enterprise operations.
              </p>
            </div>

            <div>
              <div className="font-bold text-sm text-white mb-4">Modules (9)</div>
              <div className="space-y-2 text-xs text-slate-400">
                <button onClick={() => setCurrentPage("modules")} className="hover:text-white block">Core ERP Engine</button>
                <button onClick={() => setCurrentPage("modules")} className="hover:text-white block">Inventory & AI RAG</button>
                <button onClick={() => setCurrentPage("modules")} className="hover:text-white block">Point of Sale (POS)</button>
                <button onClick={() => setCurrentPage("modules")} className="hover:text-white block">Finance & Accounting</button>
                <button onClick={() => setCurrentPage("modules")} className="hover:text-white block">Sales & CRM</button>
              </div>
            </div>

            <div>
              <div className="font-bold text-sm text-white mb-4">Services</div>
              <div className="space-y-2 text-xs text-slate-400">
                <button onClick={() => setCurrentPage("services")} className="hover:text-white block">AI Model Fine-tuning</button>
                <button onClick={() => setCurrentPage("services")} className="hover:text-white block">POS Hardware Setup</button>
                <button onClick={() => setCurrentPage("services")} className="hover:text-white block">Cloud Multi-Region DB</button>
                <button onClick={() => setCurrentPage("services")} className="hover:text-white block">Legacy Data Migration</button>
                <button onClick={() => setCurrentPage("services")} className="hover:text-white block">24/7 Enterprise SLA</button>
              </div>
            </div>

            <div>
              <div className="font-bold text-sm text-white mb-4">Company & Security</div>
              <div className="space-y-2 text-xs text-slate-400">
                <button onClick={() => setCurrentPage("about")} className="hover:text-white block">About LazyMonkeyAI</button>
                <a href="/privacy-policy" className="hover:text-white block">Privacy Policy</a>
                <div>SOC 2 Type II Security</div>
                <div className="pt-2 text-indigo-400 font-bold">Support: support@lazymonkeyai.com</div>
              </div>
            </div>

          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
            <div>© 2026 LazyMonkeyAI Technologies Inc. All rights reserved.</div>
            <div className="flex gap-6 mt-4 sm:mt-0">
              <a href="/privacy-policy" className="hover:text-slate-400">Privacy Policy</a>
              <a href="#" className="hover:text-slate-400">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
