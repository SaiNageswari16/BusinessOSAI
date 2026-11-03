"use client";

import React, { useState } from "react";
import {
  Scissors,
  Calendar,
  Clock,
  CalendarCheck,
  Users,
  UserCheck,
  Layers,
  Store,
  ShoppingCart,
  Package,
  Boxes,
  CreditCard,
  Receipt,
  BarChart3,
  TrendingUp,
  Sparkles,
  Gift,
  Share2,
  Settings,
  ShieldCheck,
  Crown,
  Building2,
  Building,
  Headphones,
  Flower2,
  Star,
  ArrowRight,
  Play,
  CheckCircle2,
  X,
  Send,
  MapPin,
  ClipboardList,
  Coins,
  Puzzle,
  HeartHandshake,
  Heart,
  Zap,
  Cloud,
  ChevronRight,
} from "lucide-react";
import { type ProductItem } from "@/data/products";

// 6 Floating Feature Cards for Hero Section (matching ss1)
const heroSalonCards = [
  {
    id: "appointments",
    title: "Appointments & Booking",
    subtitle: "Online & in-store scheduling",
    icon: Calendar,
  },
  {
    id: "services",
    title: "Service & Package Management",
    subtitle: "Define services, pricing & combos",
    icon: Layers,
  },
  {
    id: "billing",
    title: "Billing & POS",
    subtitle: "Quick billing, packages & payments",
    icon: CreditCard,
  },
  {
    id: "staff",
    title: "Staff & Slot Management",
    subtitle: "Assign staff, manage shifts & performance",
    icon: Users,
  },
  {
    id: "crm",
    title: "Customer CRM & Loyalty",
    subtitle: "Member profiles, offers & reward points",
    icon: Heart,
  },
  {
    id: "analytics",
    title: "Analytics & Growth",
    subtitle: "Revenue, bookings & service insights",
    icon: BarChart3,
  },
];

// 5 Value Pillars for Bottom Dark Pill Bar (matching ss1)
const heroSalonPillars = [
  { label: "Faster Bookings", icon: Calendar },
  { label: "Better Customer Experience", icon: Users },
  { label: "Higher Revenue", icon: TrendingUp },
  { label: "Smoother Operations", icon: Settings },
  { label: "Scale to Multiple Branches", icon: Building2 },
];

// Stats Bar Data
const kpiStats = [
  {
    icon: Users,
    iconBg: "bg-purple-100 text-purple-700",
    value: "2,480",
    label: "Active Clients",
    badge: "↑ +14%",
    badgeColor: "text-emerald-600",
  },
  {
    icon: Calendar,
    iconBg: "bg-blue-100 text-blue-700",
    value: "324",
    label: "Today's Appointments",
    badge: "↑ +10%",
    badgeColor: "text-emerald-600",
  },
  {
    icon: Coins,
    iconBg: "bg-pink-100 text-pink-700",
    value: "₹6,72,000",
    label: "Monthly Revenue",
    badge: "↑ +18%",
    badgeColor: "text-emerald-600",
  },
  {
    icon: Package,
    iconBg: "bg-purple-100 text-purple-700",
    value: "120",
    label: "Products in Stock",
    badge: null,
  },
  {
    icon: MapPin,
    iconBg: "bg-purple-100 text-purple-700",
    value: "4",
    label: "Branches",
    badge: null,
  },
  {
    icon: BarChart3,
    iconBg: "bg-purple-100 text-purple-700",
    value: "+26%",
    label: "MoM Growth",
    badge: null,
  },
];

// 6 Connected Workflow Steps
const workflowSteps = [
  {
    num: "01",
    title: "Online Booking",
    subtitle: "Web, app, WhatsApp & walk-in",
    icon: ClipboardList,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    num: "02",
    title: "Appointment",
    subtitle: "Slot, staff & service allocation",
    icon: Clock,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
  },
  {
    num: "03",
    title: "Service Delivery",
    subtitle: "Check-in, service & product usage",
    icon: ShoppingCart,
    color: "text-pink-600 bg-pink-50 border-pink-200",
  },
  {
    num: "04",
    title: "Billing & Payment",
    subtitle: "Packages, membership & multiple payments",
    icon: CreditCard,
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  {
    num: "05",
    title: "Client Engagement",
    subtitle: "Feedback, rewards & rebooking",
    icon: HeartHandshake,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    num: "06",
    title: "Reports & Growth",
    subtitle: "Revenue, services & business insights",
    icon: BarChart3,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
];

// 12 Comprehensive Modules & Features
const modulesList = [
  {
    title: "Appointment & Booking",
    icon: Calendar,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    bullets: [
      "Online & walk-in bookings",
      "Staff & room/seat allocation",
      "Reschedule, cancel & reminders",
    ],
  },
  {
    title: "Client CRM & Profiling",
    icon: Users,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    bullets: [
      "360° client profiles & history",
      "Preferences, notes & skin/hair type",
      "Automated reminders & follow-ups",
    ],
  },
  {
    title: "Service & Package Management",
    icon: Layers,
    color: "text-cyan-600 bg-cyan-50 border-cyan-200",
    bullets: [
      "Service catalog (hair, skin, spa, etc.)",
      "Packages, combos & memberships",
      "Pricing, duration & staff mapping",
    ],
  },
  {
    title: "POS & Billing",
    icon: CreditCard,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    bullets: [
      "Quick & easy billing",
      "Packages, memberships & add-ons",
      "Multiple payment options (UPI, Card, Wallet, Cash)",
    ],
  },
  {
    title: "Inventory & Product Stock",
    icon: Boxes,
    color: "text-pink-600 bg-pink-50 border-pink-200",
    bullets: [
      "Product catalog & barcode (EAN/UPC)",
      "Stock in/out, usage & consumption",
      "Low-stock alerts & auto-reorder",
    ],
  },
  {
    title: "Staff & Resource Management",
    icon: UserCheck,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    bullets: [
      "Staff profiles, roles & permissions",
      "Shift, roster & leave management",
      "Service-wise performance tracking",
    ],
  },
  {
    title: "Loyalty & Marketing",
    icon: Gift,
    color: "text-pink-600 bg-pink-50 border-pink-200",
    bullets: [
      "Memberships, reward points & offers",
      "Birthday & anniversary campaigns",
      "SMS, Email & WhatsApp promotions",
    ],
  },
  {
    title: "AI Beauty Assistant",
    icon: Sparkles,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    bullets: [
      "Personalized service & product recommendations",
      "Client preferences & next-best service",
      "Revenue & demand insights",
    ],
  },
  {
    title: "Reports & Analytics",
    icon: BarChart3,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    bullets: [
      "Revenue, service & package reports",
      "Top services, top clients & staff performance",
      "Inventory, GST & financial summaries",
    ],
  },
  {
    title: "Multi-Branch Management",
    icon: Share2,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    bullets: [
      "Manage multiple saloons from one platform",
      "Centralized clients, inventory & pricing",
      "Branch-wise performance & comparison",
    ],
  },
  {
    title: "Integrations & Add-ons",
    icon: Puzzle,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    bullets: [
      "Payment gateways (UPI, Cards, Wallets)",
      "WhatsApp & SMS communication",
      "Accounting, GST & third-party tools",
    ],
  },
  {
    title: "Settings & Access Control",
    icon: Settings,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    bullets: [
      "Roles & permissions (RBAC)",
      "Service, tax & GST configuration",
      "Business, branch & user settings",
    ],
  },
];

// 6 User Roles & Portals
const userRoles = [
  {
    title: "Super Admin",
    desc: "Platform & multi-branch operations (SaaS)",
    icon: Crown,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    title: "Saloon Owner",
    desc: "Full business control, reports & settings",
    icon: Store,
    color: "text-teal-600 bg-teal-50 border-teal-200",
  },
  {
    title: "Branch Manager",
    desc: "Daily operations, staff & client management",
    icon: Share2,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    title: "Stylist / Therapist",
    desc: "View schedule, manage services & client notes",
    icon: Scissors,
    color: "text-pink-600 bg-pink-50 border-pink-200",
  },
  {
    title: "Front Desk / Reception",
    desc: "Bookings, check-in, billing & customer care",
    icon: Headphones,
    color: "text-pink-600 bg-pink-50 border-pink-200",
  },
  {
    title: "Client (App/Web)",
    desc: "Book services, view history, manage membership & offers",
    icon: Users,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
];

// 6 Target Business Models
const targetAudiences = [
  {
    title: "Saloon Chains",
    desc: "Multi-branch saloon management with central control",
    icon: Scissors,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    title: "Spa & Wellness",
    desc: "Spa, massage, body therapies and wellness centers",
    icon: Flower2,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    title: "Beauty Clinics",
    desc: "Skin, hair and advanced beauty treatment clinics",
    icon: Sparkles,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  {
    title: "Unisex Salons",
    desc: "All-in-one hair, skin, makeup and grooming services",
    icon: Users,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    title: "Premium & Luxury Salons",
    desc: "High-end, personalized and membership-based salon studios",
    icon: Star,
    color: "text-pink-600 bg-pink-50 border-pink-200",
  },
  {
    title: "Franchise Networks",
    desc: "Standardized operations with centralized monitoring and reporting",
    icon: Building2,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
];

export function SaloonPageTemplate({ product }: { product?: ProductItem | undefined }) {
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [demoForm, setDemoForm] = useState({
    name: "",
    salonName: "",
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
      setDemoForm({ name: "", salonName: "", phone: "", email: "", branches: "1" });
    }, 2500);
  };

  return (
    <div className="w-full bg-[#f8fafd] text-slate-900 font-sans selection:bg-purple-500/20 selection:text-purple-900 pb-16">
      {/* =========================================================================
          1. HERO SECTION (REPLICATING EXACT SS1 3-COLUMN 3D SCENE & CARDS DESIGN)
          ========================================================================= */}
      <section className="relative overflow-hidden pt-4 sm:pt-6 md:pt-8 pb-10 sm:pb-14 px-4 sm:px-6 2xl:px-12 bg-gradient-to-b from-[#f8f5fe] via-[#f1e8fc] to-[#f8fafd]">
        {/* Soft Ambient Radial Lighting */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[1100px] h-[650px] bg-gradient-to-b from-purple-200/40 via-indigo-100/25 to-transparent rounded-full blur-[130px]" />
        <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[520px] h-[520px] bg-purple-400/15 rounded-full blur-[110px]" />

        <div className="relative mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          {/* 3-Column Grid matching ss1 reference */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.15fr_0.95fr] xl:grid-cols-[1.15fr_1.2fr_0.95fr] 2xl:grid-cols-[1.2fr_1.25fr_1fr] gap-6 lg:gap-5 xl:gap-8 items-center">
            
            {/* LEFT COLUMN: Badge, Title with Curved Swoosh, Description, CTAs, 3 Micro Features */}
            <div className="flex flex-col items-start z-10">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-200/90 bg-white/95 px-3.5 py-1 text-xs font-bold shadow-2xs backdrop-blur-md">
                <span className="flex items-center gap-1.5 text-slate-800">
                  <span className="grid size-4 place-items-center rounded-sm bg-purple-100 text-purple-700">
                    <Scissors className="size-2.5" />
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-700 font-mono">
                    APPLICATION
                  </span>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-purple-700 font-extrabold flex items-center gap-1.5">
                  IOTRONICS – Salon
                </span>
              </div>

              {/* Title: Smart Salon Management Platform with Purple Curved Swoosh */}
              <h1 className="mt-4 text-3xl sm:text-5xl lg:text-[44px] xl:text-[50px] 2xl:text-[54px] font-black tracking-tight text-slate-950 leading-[1.12]">
                Smart{" "}
                <span className="relative inline-block bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 bg-clip-text text-transparent">
                  Salon
                  {/* Purple Curved Brush/Swoosh Underline */}
                  <svg
                    className="absolute -bottom-2 sm:-bottom-2.5 left-0 w-full h-3 sm:h-4 text-purple-600 pointer-events-none"
                    viewBox="0 0 250 24"
                    fill="none"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M 3 16 C 65 3, 185 2, 247 15 C 190 7, 75 8, 3 16 Z"
                      fill="url(#salon-swoosh-grad)"
                    />
                    <defs>
                      <linearGradient id="salon-swoosh-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#9333ea" />
                        <stop offset="50%" stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#c084fc" />
                      </linearGradient>
                    </defs>
                  </svg>
                </span>{" "}
                <br />
                Management <br />
                Platform
              </h1>

              {/* Description Paragraph */}
              <p className="mt-4 sm:mt-5 text-xs sm:text-sm 2xl:text-base text-slate-600 leading-relaxed max-w-lg">
                Manage appointments, services, billing, staff and customer loyalty for salons, spas and beauty studios — all in one intelligent platform.
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

              {/* 3 Micro-Feature Icons */}
              <div className="mt-8 pt-2 flex items-center gap-6 sm:gap-9">
                <div className="flex flex-col items-center gap-2 text-center group cursor-default">
                  <div className="grid size-10 place-items-center rounded-xl bg-purple-50/80 border border-purple-200/70 text-purple-600 shadow-2xs group-hover:scale-110 transition-transform">
                    <Zap className="size-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 tracking-tight">Quick Setup</span>
                </div>

                <div className="flex flex-col items-center gap-2 text-center group cursor-default">
                  <div className="grid size-10 place-items-center rounded-xl bg-purple-50/80 border border-purple-200/70 text-purple-600 shadow-2xs group-hover:scale-110 transition-transform">
                    <Cloud className="size-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 tracking-tight">Cloud Ready</span>
                </div>

                <div className="flex flex-col items-center gap-2 text-center group cursor-default">
                  <div className="grid size-10 place-items-center rounded-xl bg-purple-50/80 border border-purple-200/70 text-purple-600 shadow-2xs group-hover:scale-110 transition-transform">
                    <Layers className="size-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 tracking-tight">Multi-Branch</span>
                </div>
              </div>
            </div>

            {/* CENTER COLUMN: 3D Isometric Luxury Salon Scene (Clean, Static, Seamlessly Blended) */}
            <div className="relative flex items-center justify-center py-2 lg:py-0">
              {/* Soft ambient atmospheric glow matching warm vanity lighting */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-96 md:w-[460px] h-80 sm:h-96 md:h-[460px] rounded-full bg-gradient-to-b from-purple-300/35 via-purple-200/20 to-transparent blur-3xl pointer-events-none" />

              {/* 3D Salon Composite - No frontend scale/hover/scroll effects, purely static & smooth */}
              <div className="relative w-full max-w-[440px] sm:max-w-[480px] lg:max-w-[500px] xl:max-w-[530px] flex items-center justify-center">
                <img
                  src="/images/salon-station-3d.png"
                  alt="IOTRONICS Smart Salon 3D Scene"
                  className="w-full h-auto object-contain select-none pointer-events-none block"
                  loading="eager"
                  decoding="async"
                />
              </div>
            </div>

            {/* RIGHT COLUMN: 6 Compact Floating Feature Cards stacked vertically */}
            <div className="flex flex-col gap-2 sm:gap-2.5 z-10 w-full max-w-md mx-auto lg:max-w-none">
              {heroSalonCards.map((card) => {
                const IconComp = card.icon;
                return (
                  <div
                    key={card.id}
                    onClick={() => setDemoModalOpen(true)}
                    className="bg-white/95 border border-purple-100/90 hover:border-purple-400 rounded-2xl p-2.5 sm:p-3 shadow-xs hover:shadow-md transition-all duration-300 flex items-center justify-between gap-3 cursor-pointer group hover:-translate-y-0.5 select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 sm:size-10 rounded-xl bg-purple-50/90 border border-purple-200/80 text-purple-700 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 group-hover:bg-purple-600 group-hover:text-white group-hover:border-purple-600 transition-all">
                        <IconComp className="size-4.5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs sm:text-[13px] font-extrabold text-slate-900 group-hover:text-purple-700 transition-colors leading-tight">
                          {card.title}
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-tight mt-0.5 truncate">
                          {card.subtitle}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="size-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                );
              })}
            </div>

          </div>

          {/* BOTTOM FLOATING DARK PILL BAR */}
          <div className="mt-8 sm:mt-10 w-full rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#170e2b] via-[#23123c] to-[#180e2d] border border-purple-500/20 px-5 sm:px-8 py-3.5 sm:py-4 shadow-xl backdrop-blur-md flex flex-wrap items-center justify-around gap-4">
            {heroSalonPillars.map((item, idx) => {
              const IconComp = item.icon;
              return (
                <div key={idx} className="flex items-center gap-3 group cursor-default">
                  <div className="grid size-8 place-items-center rounded-lg bg-purple-900/60 border border-purple-500/30 text-purple-300 group-hover:scale-110 transition-transform">
                    <IconComp className="size-4" />
                  </div>
                  <span className="text-slate-100 text-xs sm:text-sm font-bold group-hover:text-purple-300 transition-colors">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* =========================================================================
          2. 6 KPI METRICS BAR
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
                    className={`grid size-10 shrink-0 place-items-center rounded-xl ${stat.iconBg} shadow-2xs`}
                  >
                    <IconComp className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm sm:text-base font-extrabold text-slate-950 tracking-tight">
                        {stat.value}
                      </span>
                      {stat.badge && (
                        <span className={`text-[10px] font-bold ${stat.badgeColor}`}>
                          {stat.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-medium text-slate-600 leading-tight truncate">
                      {stat.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. END-TO-END SALOON OPERATING WORKFLOW
          ========================================================================= */}
      <section className="relative px-4 sm:px-6 2xl:px-12 pt-10 pb-6">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1.5 pb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                End-to-End Saloon Operating Workflow
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              From customer booking to service, billing and loyalty — all in one connected flow.
            </p>
          </div>

          {/* Connected Steps Grid with Arrow Connectors */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5 relative">
            {workflowSteps.map((step, idx) => {
              const IconComp = step.icon;
              return (
                <div
                  key={step.num}
                  className="relative group rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-purple-300 hover:shadow-md flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Step Number & Icon */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-black text-purple-700">
                        {step.num}
                      </span>
                      <div
                        className={`grid size-7 place-items-center rounded-lg border ${step.color} shadow-2xs`}
                      >
                        <IconComp className="size-3.5" />
                      </div>
                    </div>

                    <h3 className="mt-3 text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-[11px] text-slate-600 leading-snug font-normal">
                      {step.subtitle}
                    </p>
                  </div>

                  {/* Flow Arrow pointing to next (for larger screens) */}
                  {idx < workflowSteps.length - 1 && (
                    <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
                      <span className="grid size-5 place-items-center rounded-full bg-slate-100 text-slate-400 border border-slate-200 text-[10px] font-bold">
                        →
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. COMPREHENSIVE MODULES & FEATURES (12 CARDS)
          ========================================================================= */}
      <section className="relative px-4 sm:px-6 2xl:px-12 pt-10 pb-6">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1.5 pb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                Comprehensive Modules & Features
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Everything you need to run a modern, premium saloon business.
            </p>
          </div>

          {/* 12 Feature Cards Grid (4 columns x 3 rows) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {modulesList.map((mod, idx) => {
              const IconComp = mod.icon;
              return (
                <div
                  key={idx}
                  className="group rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-4.5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-purple-300 hover:shadow-md flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Icon + Title */}
                    <div className="flex items-center gap-2.5 mb-3">
                      <div
                        className={`grid size-8 shrink-0 place-items-center rounded-xl border ${mod.color} shadow-2xs transition-transform group-hover:scale-105`}
                      >
                        <IconComp className="size-4" />
                      </div>
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-950 leading-tight">
                        {mod.title}
                      </h3>
                    </div>

                    {/* Bullet Points */}
                    <ul className="space-y-1.5 text-[11px] text-slate-600">
                      {mod.bullets.map((bullet, bIdx) => (
                        <li key={bIdx} className="flex items-start gap-1.5 leading-snug">
                          <span className="text-purple-500 font-bold mt-0.5">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. USER ROLES & PORTALS
          ========================================================================= */}
      <section className="relative px-4 sm:px-6 2xl:px-12 pt-10 pb-6">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1.5 pb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                User Roles & Portals
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Role-based access for your saloon operations.
            </p>
          </div>

          {/* 6 Role Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {userRoles.map((role, idx) => {
              const IconComp = role.icon;
              return (
                <div
                  key={idx}
                  className="group rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 text-center shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-purple-300 hover:shadow-md flex flex-col items-center justify-start"
                >
                  <div
                    className={`grid size-10 place-items-center rounded-xl border ${role.color} shadow-2xs mb-2.5 transition-transform group-hover:scale-110`}
                  >
                    <IconComp className="size-5" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">
                    {role.title}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-600 leading-snug">{role.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. WHO CAN USE IOTRONICS – LUXURY SALOON?
          ========================================================================= */}
      <section className="relative px-4 sm:px-6 2xl:px-12 pt-10 pb-8">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1.5 pb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                Who Can Use IOTRONICS – Luxury Saloon?
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              A flexible and scalable platform for all beauty and wellness businesses.
            </p>
          </div>

          {/* 6 Target Audience Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
            {targetAudiences.map((aud, idx) => {
              const IconComp = aud.icon;
              return (
                <div
                  key={idx}
                  className="group rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 text-center shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-purple-300 hover:shadow-md flex flex-col items-center justify-start"
                >
                  <div
                    className={`grid size-9 place-items-center rounded-xl border ${aud.color} shadow-2xs mb-2 transition-transform group-hover:scale-110`}
                  >
                    <IconComp className="size-4.5" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">
                    {aud.title}
                  </h3>
                  <p className="mt-1 text-[10.5px] sm:text-[11px] text-slate-600 leading-relaxed">
                    {aud.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. BOTTOM GRADIENT CTA BANNER
          ========================================================================= */}
      <section className="relative px-4 sm:px-6 2xl:px-12 pt-6">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 p-6 sm:p-8 md:p-10 text-white shadow-xl shadow-purple-600/20">
            {/* Ambient Background Circles */}
            <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -left-20 -bottom-20 size-72 rounded-full bg-purple-400/20 blur-2xl" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-start sm:items-center gap-4">
                <div className="grid size-12 sm:size-14 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 text-white shadow-inner">
                  <Scissors className="size-6 sm:size-7" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-2xl font-black tracking-tight text-white">
                    Run Your Saloon Business Smarter with IOTRONICS
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-purple-100 max-w-xl">
                    Deliver exceptional client experiences, streamline operations and grow your beauty
                    business.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDemoModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 sm:px-7 py-3 text-xs sm:text-sm font-extrabold text-purple-900 shadow-md hover:bg-purple-50 transition-all hover:scale-105 cursor-pointer whitespace-nowrap"
                >
                  <span>Book a Demo</span>
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. INTERACTIVE DEMO BOOKING MODAL
          ========================================================================= */}
      {demoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => setDemoModalOpen(false)}
              className="absolute right-5 top-5 grid size-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="grid size-10 place-items-center rounded-xl bg-purple-100 text-purple-700">
                <Scissors className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Book Luxury Saloon Demo</h3>
                <p className="text-xs text-slate-600">
                  Experience appointment booking, client CRM, stylist rosters and POS billing.
                </p>
              </div>
            </div>

            {submitted ? (
              <div className="py-8 text-center space-y-3">
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="size-6" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Demo Scheduled!</h4>
                <p className="text-xs text-slate-600 max-w-xs mx-auto">
                  Thank you! An enterprise product specialist will connect with you within 15 minutes.
                </p>
              </div>
            ) : (
              <form onSubmit={handleDemoSubmit} className="space-y-3.5 mt-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase">Your Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={demoForm.name}
                    onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase">
                    Saloon / Spa / Clinic Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aura Luxury Salon & Spa"
                    value={demoForm.salonName}
                    onChange={(e) => setDemoForm({ ...demoForm, salonName: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase">Phone</label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={demoForm.phone}
                      onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase">
                      Number of Branches
                    </label>
                    <select
                      value={demoForm.branches}
                      onChange={(e) => setDemoForm({ ...demoForm, branches: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:bg-white focus:outline-none"
                    >
                      <option value="1">1 Studio</option>
                      <option value="2-5">2 - 5 Salons</option>
                      <option value="6-20">6 - 20 Branches</option>
                      <option value="20+">20+ Franchise Chain</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase">
                    Work Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="contact@salon.com"
                    value={demoForm.email}
                    onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:bg-white focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-700 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-purple-800 transition-all cursor-pointer"
                >
                  <Send className="size-4" /> Confirm & Book Demo
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          9. VIDEO DEMO WALKTHROUGH MODAL
          ========================================================================= */}
      {videoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/20 bg-slate-900 shadow-2xl">
            <button
              onClick={() => setVideoModalOpen(false)}
              className="absolute right-4 top-4 z-10 grid size-8 place-items-center rounded-full bg-white/20 text-white hover:bg-white/40 cursor-pointer"
            >
              <X className="size-5" />
            </button>
            <div className="p-4 sm:p-6 text-white border-b border-white/10">
              <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold">
                VIDEO WALKTHROUGH
              </span>
              <h3 className="text-base sm:text-lg font-black mt-0.5">
                IOTRONICS Salon OS — Feature Tour & Demo
              </h3>
            </div>
            <div className="relative aspect-video w-full bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <div className="grid size-16 place-items-center rounded-full bg-purple-600/30 text-purple-400 border border-purple-500/40 mb-3 shadow-lg">
                <Scissors className="size-8" />
              </div>
              <p className="text-sm font-bold text-slate-200">
                Interactive Luxury Saloon OS Video Tour
              </p>
              <p className="text-xs text-slate-400 max-w-md mt-1">
                Featuring 24/7 online client bookings, stylist shift & commission management, retail
                product stock tracking, package memberships, and multi-branch operations.
              </p>
              <button
                onClick={() => {
                  setVideoModalOpen(false);
                  setDemoModalOpen(true);
                }}
                className="mt-4 rounded-full bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-500 transition-all cursor-pointer"
              >
                Schedule Live 1-on-1 Walkthrough
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

