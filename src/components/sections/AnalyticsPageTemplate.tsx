"use client";

import React, { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  ShoppingCart,
  Users,
  Package,
  Building2,
  Database,
  Sparkles,
  Cpu,
  Target,
  Bell,
  Rocket,
  Coins,
  Activity,
  UserCheck,
  Bot,
  FileText,
  CheckCircle2,
  Clock,
  Sliders,
  Share2,
  FileSpreadsheet,
  ShieldCheck,
  Scissors,
  Dumbbell,
  Utensils,
  Boxes,
  ArrowRight,
  Play,
  X,
  Send,
  CalendarCheck,
  ChevronRight,
  Layers,
} from "lucide-react";
import { type ProductItem } from "@/data/products";

// 6 KPI Metrics Bar Data (matching ss1)
const kpiStats = [
  {
    icon: ShoppingCart,
    iconBg: "bg-purple-100 text-purple-700",
    value: "₹48,72,000",
    label: "Total Revenue",
    badge: "↑ +18%",
    badgeColor: "text-emerald-600",
  },
  {
    icon: BarChart3,
    iconBg: "bg-blue-100 text-blue-700",
    value: "12,460",
    label: "Total Orders",
    badge: "↑ +14%",
    badgeColor: "text-emerald-600",
  },
  {
    icon: Users,
    iconBg: "bg-pink-100 text-pink-700",
    value: "8,320",
    label: "Active Customers",
    badge: "↑ +12%",
    badgeColor: "text-emerald-600",
  },
  {
    icon: Package,
    iconBg: "bg-purple-100 text-purple-700",
    value: "95.8%",
    label: "Inventory Health",
    badge: null,
  },
  {
    icon: TrendingUp,
    iconBg: "bg-indigo-100 text-indigo-700",
    value: "+26%",
    label: "Business Growth",
    badge: null,
  },
  {
    icon: Building2,
    iconBg: "bg-purple-100 text-purple-700",
    value: "12",
    label: "Active Branches",
    badge: null,
  },
];

// 6 Connected Workflow Steps (matching ss1)
const workflowSteps = [
  {
    num: "01",
    title: "Data Integration",
    subtitle: "Connect data from all your modules",
    icon: Database,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    num: "02",
    title: "Data Processing",
    subtitle: "Clean, unify & structure data",
    icon: Sparkles,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
  },
  {
    num: "03",
    title: "Analysis & Insights",
    subtitle: "Discover trends, patterns & KPIs",
    icon: BarChart3,
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  {
    num: "04",
    title: "Forecasting",
    subtitle: "Predict demand, sales & inventory",
    icon: Target,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    num: "05",
    title: "Alerts & Actions",
    subtitle: "Get notifications & recommendations",
    icon: Bell,
    color: "text-pink-600 bg-pink-50 border-pink-200",
  },
  {
    num: "06",
    title: "Growth & Strategy",
    subtitle: "Make faster, data-driven decisions",
    icon: Rocket,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
];

// 9 Comprehensive Analytics Modules (matching ss1)
const analyticsModules = [
  {
    id: "sales",
    title: "Sales Analytics",
    desc: "Revenue, orders, top products, channel & branch performance",
    icon: BarChart3,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    id: "inventory",
    title: "Inventory Analytics",
    desc: "Stock health, slow & fast movers, replenishment forecasting",
    icon: Package,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  {
    id: "customer",
    title: "Customer Analytics",
    desc: "Customer behavior, segmentation, loyalty & lifetime value (CLV)",
    icon: Users,
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  {
    id: "financial",
    title: "Financial Analytics",
    desc: "Income, expenses, profit margins, GST & cost analysis",
    icon: Coins,
    color: "text-pink-600 bg-pink-50 border-pink-200",
  },
  {
    id: "operations",
    title: "Operations Analytics",
    desc: "Service turn-around, resource utilization, productivity & efficiency",
    icon: Activity,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    id: "workforce",
    title: "HR & Workforce Analytics",
    desc: "Attendance, workforce performance, utilization & cost insights",
    icon: UserCheck,
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    id: "marketing",
    title: "Marketing Analytics",
    desc: "Campaign performance, lead conversion, ROI & customer engagement",
    icon: TrendingUp,
    color: "text-cyan-600 bg-cyan-50 border-cyan-200",
  },
  {
    id: "ai-forecasting",
    title: "AI Forecasting & Planning",
    desc: "Demand, sales, inventory, staffing & revenue forecasts",
    icon: Bot,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  {
    id: "custom-reports",
    title: "Custom Reports & Dashboards",
    desc: "Build, schedule & share reports with role-based access",
    icon: FileText,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
];

// 7 Key Capabilities (matching ss1)
const keyCapabilities = [
  {
    title: "AI Insights",
    desc: "Auto analysis & recommendations",
    icon: Bot,
  },
  {
    title: "Real-Time Data",
    desc: "Live, up-to-date business metrics",
    icon: Clock,
  },
  {
    title: "Custom Dashboards",
    desc: "Role & business specific views",
    icon: Sliders,
  },
  {
    title: "Smart Alerts",
    desc: "Threshold, stock, sales & performance",
    icon: Bell,
  },
  {
    title: "Multi-Branch View",
    desc: "Compare branches, regions & verticals",
    icon: Share2,
  },
  {
    title: "Scheduled Reports",
    desc: "Auto-generated & email reports",
    icon: FileSpreadsheet,
  },
  {
    title: "Secure & Scalable",
    desc: "Enterprise-grade with data security",
    icon: ShieldCheck,
  },
];

// 6 Verticals (matching ss1)
const whoCanUse = [
  {
    title: "Retail & Grocery",
    desc: "Sales, inventory & customer insights",
    icon: ShoppingCart,
  },
  {
    title: "Salons & Spas",
    desc: "Service, client & revenue analytics",
    icon: Scissors,
  },
  {
    title: "Gyms & Fitness",
    desc: "Membership, attendance & performance",
    icon: Dumbbell,
  },
  {
    title: "Restaurants",
    desc: "Sales, menu & operations insights",
    icon: Utensils,
  },
  {
    title: "Distributors",
    desc: "Stock, orders & partner performance",
    icon: Boxes,
  },
  {
    title: "Multi-Branch Businesses",
    desc: "Unified analytics across all locations",
    icon: Building2,
  },
];

export function AnalyticsPageTemplate({ product }: { product?: ProductItem | undefined }) {
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [demoForm, setDemoForm] = useState({
    name: "",
    businessName: "",
    phone: "",
    email: "",
    branches: "1",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setDemoModalOpen(false);
      setDemoForm({ name: "", businessName: "", phone: "", email: "", branches: "1" });
    }, 2500);
  };

  return (
    <div className="w-full bg-[#f8fafd] text-slate-900 font-sans selection:bg-purple-500/20 selection:text-purple-900 pb-16">
      {/* =========================================================================
          1. HERO SECTION (REPLICATING SS1 WITH SS2 3D SCENE)
          ========================================================================= */}
      <section className="relative overflow-hidden pt-4 sm:pt-6 md:pt-8 pb-10 sm:pb-14 px-4 sm:px-6 2xl:px-12 bg-gradient-to-b from-[#f8f5fe] via-[#f1e8fc] to-[#f8fafd]">
        {/* Soft Ambient Radial Lighting */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[1100px] h-[650px] bg-gradient-to-b from-purple-200/40 via-indigo-100/25 to-transparent rounded-full blur-[130px]" />
        <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[520px] h-[520px] bg-purple-400/15 rounded-full blur-[110px]" />

        <div className="relative mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          {/* 2-Column Grid matching ss1 hero layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] xl:grid-cols-[1.15fr_1fr] 2xl:grid-cols-[1.18fr_1fr] gap-8 lg:gap-8 xl:gap-12 items-center">

            {/* LEFT COLUMN: Badge, Title with Curved Swoosh, Subtitle Pills, Description, CTAs */}
            <div className="flex flex-col items-start z-10">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-200/90 bg-white/95 px-3.5 py-1 text-xs font-bold shadow-2xs backdrop-blur-md">
                <span className="flex items-center gap-1.5 text-slate-800">
                  <span className="grid size-4 place-items-center rounded-sm bg-purple-100 text-purple-700">
                    <BarChart3 className="size-2.5" />
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-700 font-mono">
                    APPLICATION
                  </span>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-purple-700 font-extrabold flex items-center gap-1.5">
                  IOTRONICS – Analytics
                </span>
              </div>

              {/* Title: AI-Powered Business Analytics OS with Purple Curved Swoosh */}
              <h1 className="mt-4 text-3xl sm:text-5xl lg:text-[44px] xl:text-[50px] 2xl:text-[54px] font-black tracking-tight text-slate-950 leading-[1.12]">
                AI-Powered <br />
                <span className="relative inline-block bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 bg-clip-text text-transparent">
                  Business Analytics OS
                  {/* Purple Curved Brush/Swoosh Underline */}
                  <svg
                    className="absolute -bottom-2 sm:-bottom-2.5 left-0 w-full h-3 sm:h-4 text-purple-600 pointer-events-none"
                    viewBox="0 0 250 24"
                    fill="none"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M 3 16 C 65 3, 185 2, 247 15 C 190 7, 75 8, 3 16 Z"
                      fill="url(#analytics-swoosh-grad)"
                    />
                    <defs>
                      <linearGradient id="analytics-swoosh-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#9333ea" />
                        <stop offset="50%" stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#c084fc" />
                      </linearGradient>
                    </defs>
                  </svg>
                </span>
              </h1>

              {/* Subtitle Pills (matching ss1) */}
              <p className="mt-4 text-xs sm:text-sm font-bold text-slate-800 tracking-wide flex flex-wrap items-center gap-2">
                <span>Data</span>
                <span className="text-purple-400">•</span>
                <span>Insights</span>
                <span className="text-purple-400">•</span>
                <span>Forecasting</span>
                <span className="text-purple-400">•</span>
                <span>Performance</span>
                <span className="text-purple-400">•</span>
                <span>Growth</span>
              </p>

              {/* Description Paragraph (matching ss1) */}
              <p className="mt-3.5 text-xs sm:text-sm 2xl:text-base text-slate-600 leading-relaxed max-w-xl">
                A unified analytics platform that turns your business data into real-time insights, intelligent forecasts and actionable decisions across all your operations, branches and business verticals.
              </p>

              {/* CTA Buttons */}
              <div className="mt-6 sm:mt-7 flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => setDemoModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-600 px-6 sm:px-7 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-purple-500/30 transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/40 cursor-pointer"
                >
                  <span>Get Started</span>
                  <ArrowRight className="size-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setVideoModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300/90 bg-white/95 px-5 sm:px-6 py-3 text-xs sm:text-sm font-bold text-slate-800 shadow-xs hover:bg-slate-50 hover:border-purple-300 transition-all cursor-pointer"
                >
                  <Play className="size-3.5 fill-purple-700 text-purple-700 ml-0.5" />
                  <span>Watch Demo</span>
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: 3D Isometric Analytics OS Scene (Proportionally Scaled & Seamlessly Blended) */}
            <div className="relative w-full flex items-center justify-center py-2 lg:py-0 z-10">
              {/* Soft ambient atmospheric glow matching warm scene lighting */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-80 md:w-[420px] lg:w-[460px] h-72 sm:h-80 md:h-[420px] lg:h-[460px] rounded-full bg-gradient-to-b from-purple-300/35 via-purple-200/20 to-transparent blur-3xl pointer-events-none" />

              {/* Responsive Image Wrapper scaled to match other hero sections */}
              <div className="relative w-full max-w-[420px] sm:max-w-[460px] lg:max-w-[490px] xl:max-w-[520px] flex items-center justify-center mx-auto">
                <img
                  src="/images/analytics-hero-3d.png"
                  alt="IOTRONICS AI-Powered Business Analytics OS 3D Illustration"
                  className="w-full h-auto object-contain select-none pointer-events-none block drop-shadow-xl"
                  loading="eager"
                  decoding="async"
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* =========================================================================
          2. 6 KPI METRICS BAR (MATCHING SS1)
          ========================================================================= */}
      <section className="relative px-4 sm:px-6 2xl:px-12 py-3">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {kpiStats.map((stat, idx) => {
              const IconComp = stat.icon;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs transition-all hover:border-purple-300 hover:shadow-sm"
                >
                  <div
                    className={`grid size-9 sm:size-10 shrink-0 place-items-center rounded-xl ${stat.iconBg} shadow-2xs`}
                  >
                    <IconComp className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm sm:text-base font-black tracking-tight text-slate-950">
                        {stat.value}
                      </span>
                      {stat.badge && (
                        <span className={`text-[10px] font-bold ${stat.badgeColor}`}>
                          {stat.badge}
                        </span>
                      )}
                    </div>
                    <span className="block text-[11px] font-semibold text-slate-500 leading-tight truncate">
                      {stat.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. END-TO-END ANALYTICS WORKFLOW (MATCHING SS1)
          ========================================================================= */}
      <section className="relative px-4 sm:px-6 2xl:px-12 py-10 sm:py-14">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
                End-to-End Analytics Workflow
              </h2>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500 max-w-md">
              A simple and powerful flow from data to business action.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-3.5 relative">
            {workflowSteps.map((step, idx) => {
              const IconComp = step.icon;
              return (
                <div key={step.num} className="relative flex items-center">
                  <div className="w-full flex flex-col items-start rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all hover:border-purple-300 hover:shadow-md group">
                    <div className="flex items-center justify-between w-full mb-3">
                      <div
                        className={`grid size-9 place-items-center rounded-xl border ${step.color} shadow-2xs group-hover:scale-105 transition-transform`}
                      >
                        <IconComp className="size-4.5" />
                      </div>
                      <span className="text-xs font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200/80">
                        {step.num}
                      </span>
                    </div>

                    <h3 className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-purple-700 transition-colors">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                      {step.subtitle}
                    </p>
                  </div>

                  {idx < workflowSteps.length - 1 && (
                    <div className="hidden lg:flex absolute -right-2 z-10 size-4 items-center justify-center text-purple-400">
                      <ArrowRight className="size-3.5" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. COMPREHENSIVE ANALYTICS MODULES (MATCHING SS1)
          ========================================================================= */}
      <section className="relative px-4 sm:px-6 2xl:px-12 py-10 sm:py-14 bg-gradient-to-b from-white via-purple-50/20 to-white border-y border-purple-100/60">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
                Comprehensive Analytics Modules
              </h2>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500 max-w-md">
              Powerful, ready-to-use analytics for every business function.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {analyticsModules.map((module) => {
              const IconComp = module.icon;
              return (
                <div
                  key={module.id}
                  onClick={() => setDemoModalOpen(true)}
                  className="flex items-center justify-between gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-4.5 shadow-xs transition-all duration-300 hover:border-purple-300 hover:shadow-md cursor-pointer group hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`grid size-10 shrink-0 place-items-center rounded-xl border ${module.color} shadow-2xs group-hover:scale-105 transition-transform`}
                    >
                      <IconComp className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-purple-700 transition-colors leading-tight">
                        {module.title}
                      </h3>
                      <p className="text-[11px] sm:text-xs text-slate-500 leading-snug mt-1">
                        {module.desc}
                      </p>
                    </div>
                  </div>

                  <ArrowRight className="size-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. KEY CAPABILITIES (MATCHING SS1)
          ========================================================================= */}
      <section className="relative px-4 sm:px-6 2xl:px-12 py-10 sm:py-14">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
                Key Capabilities
              </h2>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500 max-w-md">
              Advanced analytics features to help you run a smarter, more efficient business.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-3.5">
            {keyCapabilities.map((cap, idx) => {
              const IconComp = cap.icon;
              return (
                <div
                  key={idx}
                  className="flex flex-col items-center text-center rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs transition-all hover:border-purple-300 hover:shadow-sm group"
                >
                  <div className="grid size-10 place-items-center rounded-xl bg-purple-50 text-purple-700 border border-purple-200/80 mb-2.5 shadow-2xs group-hover:scale-110 transition-transform">
                    <IconComp className="size-5" />
                  </div>
                  <h4 className="text-xs sm:text-[13px] font-black text-slate-900 group-hover:text-purple-700 transition-colors leading-tight">
                    {cap.title}
                  </h4>
                  <p className="mt-1 text-[10.5px] text-slate-500 leading-tight">
                    {cap.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. WHO CAN USE IOTRONICS – ANALYTICS? (MATCHING SS1)
          ========================================================================= */}
      <section className="relative px-4 sm:px-6 2xl:px-12 py-10 sm:py-14 bg-gradient-to-b from-white via-slate-50 to-white border-t border-slate-200/80">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
                Who Can Use IOTRONICS – Analytics?
              </h2>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500 max-w-md">
              Built for every business that wants to make data-driven decisions.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
            {whoCanUse.map((item, idx) => {
              const IconComp = item.icon;
              return (
                <div
                  key={idx}
                  onClick={() => setDemoModalOpen(true)}
                  className="flex flex-col items-center text-center rounded-2xl border border-purple-100/90 bg-white p-4 shadow-xs transition-all duration-300 hover:border-purple-400 hover:shadow-md cursor-pointer group hover:-translate-y-1"
                >
                  <div className="grid size-12 place-items-center rounded-2xl bg-purple-50 text-purple-600 border border-purple-200/80 mb-3 shadow-2xs group-hover:bg-purple-600 group-hover:text-white group-hover:scale-105 transition-all">
                    <IconComp className="size-6" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-purple-700 transition-colors leading-tight">
                    {item.title}
                  </h4>
                  <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. BOTTOM CALL TO ACTION BANNER (MATCHING SS1)
          ========================================================================= */}
      <section className="relative px-4 sm:px-6 2xl:px-12 pt-6 pb-12">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="rounded-3xl bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-900 p-6 sm:p-8 md:p-10 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center gap-4 sm:gap-5 z-10">
              <div className="grid size-12 sm:size-14 place-items-center rounded-2xl bg-white/15 border border-white/20 text-white backdrop-blur-md shrink-0 shadow-inner">
                <BarChart3 className="size-6 sm:size-7" />
              </div>
              <div>
                <h3 className="text-lg sm:text-2xl font-black tracking-tight text-white leading-tight">
                  Make Smarter Business Decisions with IOTRONICS Analytics
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-purple-100 max-w-xl">
                  Turn your data into growth, efficiency and profitability with AI-powered analytics.
                </p>
              </div>
            </div>

            <div className="z-10 shrink-0">
              <button
                type="button"
                onClick={() => setDemoModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-white text-purple-900 px-6 sm:px-8 py-3.5 text-xs sm:text-sm font-black shadow-lg hover:bg-purple-50 hover:scale-105 transition-all cursor-pointer"
              >
                <span>Book a Demo</span>
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          DEMO MODAL
          ========================================================================= */}
      {demoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-200">
            <button
              onClick={() => setDemoModalOpen(false)}
              className="absolute top-4 right-4 grid size-8 place-items-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <X className="size-4" />
            </button>

            {submitted ? (
              <div className="py-8 text-center space-y-3">
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="size-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Demo Scheduled!</h3>
                <p className="text-xs text-slate-600">
                  Our analytics specialist will contact you shortly to demonstrate the platform.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="grid size-9 place-items-center rounded-xl bg-purple-100 text-purple-700">
                    <BarChart3 className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Request IOTRONICS Analytics Demo
                    </h3>
                    <p className="text-xs text-slate-500">Live 1-on-1 walkthrough of the dashboard</p>
                  </div>
                </div>

                <form onSubmit={handleDemoSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Your Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Sharma"
                      value={demoForm.name}
                      onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Business / Company Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Retail Chains Ltd."
                      value={demoForm.businessName}
                      onChange={(e) => setDemoForm({ ...demoForm, businessName: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-hidden"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={demoForm.phone}
                        onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Branches</label>
                      <select
                        value={demoForm.branches}
                        onChange={(e) => setDemoForm({ ...demoForm, branches: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-hidden"
                      >
                        <option value="1">1 Location</option>
                        <option value="2-5">2 - 5 Locations</option>
                        <option value="6-20">6 - 20 Locations</option>
                        <option value="20+">20+ Locations</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Work Email</label>
                    <input
                      type="email"
                      required
                      placeholder="alex@company.com"
                      value={demoForm.email}
                      onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-hidden"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-purple-700 transition-all cursor-pointer"
                  >
                    <Send className="size-3.5" />
                    <span>Confirm Demo Request</span>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIDEO MODAL
          ========================================================================= */}
      {videoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl rounded-3xl bg-slate-900 p-2 sm:p-4 shadow-2xl border border-purple-500/30 overflow-hidden">
            <button
              onClick={() => setVideoModalOpen(false)}
              className="absolute top-4 right-4 z-20 grid size-8 place-items-center rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <X className="size-4" />
            </button>
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 flex flex-col items-center justify-center">
              <div className="grid size-14 place-items-center rounded-full bg-purple-600/30 border border-purple-400 text-purple-300 mb-3 animate-pulse">
                <Play className="size-6 fill-purple-300 ml-1" />
              </div>
              <h4 className="text-base font-bold text-white">IOTRONICS Analytics OS Interactive Walkthrough</h4>
              <p className="text-xs text-slate-400 mt-1">Live demo telemetry player</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

