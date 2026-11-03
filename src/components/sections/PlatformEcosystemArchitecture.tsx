"use client";

import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  ArrowRight,
  Layers,
  Cpu,
  Zap,
  ShieldCheck,
  Building2,
  Dumbbell,
  Scissors,
  UtensilsCrossed,
  BarChart3,
  RefreshCw,
  Server,
  Lock,
  ChevronRight,
  Activity,
  CheckCircle2,
} from "lucide-react";

export function PlatformEcosystemArchitecture({ className }: { className?: string }) {
  const [activeTab, setActiveTab] = useState<"retail" | "gym" | "salon" | "restaurant">("retail");

  const pillars = [
    {
      id: "retail",
      label: "Retail & Commerce",
      icon: Building2,
      tag: "Retail OS",
      headline: "Autonomous Multi-Store Commerce Spine",
      description:
        "High-velocity POS billing with automated inventory reordering, GST invoicing, and real-time ledger sync across stores.",
      stats: [
        { label: "Checkout Latency", value: "< 12ms" },
        { label: "SKU Capacity", value: "100k+" },
        { label: "Offline Mode", value: "100% Resilient" },
      ],
      features: [
        "Distributed multi-branch stock transfers with automated transit tracking",
        "Predictive reorder curves preventing stockouts during peak retail seasons",
        "Unified customer loyalty and digital receipt delivery via WhatsApp",
      ],
    },
    {
      id: "gym",
      label: "Fitness & Gyms",
      icon: Dumbbell,
      tag: "Gym OS",
      headline: "Turnstile-Integrated Club Operations",
      description:
        "Synchronous hardware triggers for RFID & biometric turnstile gates, recurring dues automation, and trainer commissions.",
      stats: [
        { label: "Turnstile Trigger", value: "< 15ms" },
        { label: "Billing Automation", value: "Zero Failures" },
        { label: "Live Headcount", value: "Instant Telemetry" },
      ],
      features: [
        "Biometric access sync preventing unauthorized entry and card-sharing",
        "Automated WhatsApp payment links for upcoming and overdue renewals",
        "Interactive trainer scheduling with live client fitness progress tracking",
      ],
    },
    {
      id: "salon",
      label: "Luxury Salons",
      icon: Scissors,
      tag: "Saloon OS",
      headline: "Chair-Level Luxury Appointment Matrix",
      description:
        "Precision stylist scheduling, automated commission splits, product consumption tracking, and VIP client CRM profiles.",
      stats: [
        { label: "Rebooking Lift", value: "+38%" },
        { label: "Stylist Sync", value: "Zero Conflict" },
        { label: "VIP Retention", value: "94.2%" },
      ],
      features: [
        "Real-time chair utilization maps avoiding stylist overbooking bottlenecks",
        "Automated hair/skin product depletion linked directly to billing tickets",
        "Personalized client service histories, preferred formulas, and birthdays",
      ],
    },
    {
      id: "restaurant",
      label: "Restaurants & QSR",
      icon: UtensilsCrossed,
      tag: "Restaurant OS",
      headline: "Kitchen Display & Dining Orchestration",
      description:
        "Instant table QR ordering, real-time Kitchen Display Systems (KDS), automated recipe costing, and split-ticket payments.",
      stats: [
        { label: "Order Routing", value: "< 0.8s" },
        { label: "Table Turn", value: "+22% Faster" },
        { label: "Kitchen Slippage", value: "0%" },
      ],
      features: [
        "Sub-second order dispatch from dining tables directly to kitchen station displays",
        "Real-time recipe depletion deducting raw ingredients per dish prepared",
        "Multi-tender settlement supporting cash, cards, UPI QR, and split bills",
      ],
    },
  ];

  const current = pillars.find((p) => p.id === activeTab) ?? pillars[0]!;
  if (!current) return null;

  return (
    <section
      id="ecosystem"
      className={
        "w-full bg-[#f8fafd] text-slate-900 font-sans relative overflow-hidden border-y border-slate-200/80 py-8 sm:py-10 md:py-12 scroll-mt-20 " +
        (className || "")
      }
    >
      <div className="container mx-auto px-4 sm:px-6 2xl:px-8 3xl:px-12 max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px] relative z-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 sm:mb-8">
          <div className="max-w-3xl 2xl:max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-50 px-3.5 py-1 text-[11px] font-bold tracking-wider text-purple-700 uppercase font-mono shadow-xs">
              <Sparkles className="size-3.5 text-purple-600" />
              <span>AUTONOMOUS ENTERPRISE CORE &bull; REAL-TIME INTEGRATION</span>
            </div>

            <h2 className="mt-2 text-2xl sm:text-3xl md:text-4xl 2xl:text-5xl font-extrabold text-slate-950 tracking-tight leading-[1.15]">
              One Connected Ecosystem.{" "}
              <span className="bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 bg-clip-text text-transparent">
                Boundless Cross-Industry Intelligence.
              </span>
            </h2>

            <p className="mt-2 text-xs sm:text-sm 2xl:text-base text-slate-600 leading-relaxed font-normal max-w-2xl 2xl:max-w-3xl">
              Instead of managing disconnected legacy software, IOTRONICS provides a unified operational spine
              where retail outlets, gyms, luxury salons, and restaurants operate with zero data silos and sub-second telemetry.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              to="/about"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 text-xs font-bold transition-all"
            >
              <span>Explore Company Story</span>
              <ArrowRight className="size-3.5" />
            </Link>
            <Link
              to="/about/company-overview"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-all shadow-xs"
            >
              <span>Full Overview</span>
              <ChevronRight className="size-3.5 text-slate-400" />
            </Link>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            const isActive = activeTab === pillar.id;
            return (
              <button
                key={pillar.id}
                type="button"
                onClick={() => setActiveTab(pillar.id as any)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  isActive
                    ? "bg-purple-700 text-white shadow-md shadow-purple-600/25"
                    : "bg-white text-slate-700 border border-slate-200/90 hover:border-purple-300 hover:bg-purple-50/50"
                }`}
              >
                <Icon className={`size-4 ${isActive ? "text-white" : "text-purple-600"}`} />
                <span>{pillar.label}</span>
              </button>
            );
          })}
        </div>

        {/* Active Tab Architecture Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 2xl:p-10 border border-slate-200/90 shadow-sm relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Narrative */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200 font-mono">
                  {current.tag}
                </span>
                <span className="text-xs text-slate-400 font-mono">&bull;</span>
                <span className="text-xs font-bold text-slate-600 font-mono">UNIFIED DATA SPINE</span>
              </div>

              <h3 className="text-xl sm:text-2xl 2xl:text-3xl font-extrabold text-slate-950 tracking-tight">
                {current.headline}
              </h3>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                {current.description}
              </p>

              {/* Bullet Features */}
              <div className="space-y-2 pt-2">
                {current.features.map((feat, fIdx) => (
                  <div key={fIdx} className="flex items-start gap-2.5 text-xs text-slate-700">
                    <CheckCircle2 className="size-4 text-purple-600 shrink-0 mt-0.5" />
                    <span className="font-medium leading-relaxed">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Telemetry & Stats Cards */}
            <div className="lg:col-span-5 bg-gradient-to-br from-[#fafbff] to-purple-50/60 rounded-2xl p-6 border border-purple-100 space-y-4">
              <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-purple-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                    System Telemetry
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-mono">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Synchronized
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {current.stats.map((stat, sIdx) => (
                  <div key={sIdx} className="bg-white rounded-xl p-3 border border-purple-100 shadow-2xs">
                    <div className="text-[11px] text-slate-500 font-medium">{stat.label}</div>
                    <div className="text-base sm:text-lg font-black text-purple-700 font-mono mt-0.5">
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3.5 rounded-xl bg-purple-900 text-white flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Server className="size-4 text-purple-300" />
                  <span className="font-semibold text-slate-100">Enterprise High-Availability</span>
                </div>
                <span className="font-mono text-purple-300 font-bold">99.99% SLA</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default PlatformEcosystemArchitecture;
