import React, { useState } from "react";
import {
  Command,
  Sparkles,
  Layers,
  Activity,
  Lock,
  ShieldCheck,
  Check,
  ArrowRight,
  SendHorizontal,
  UploadCloud,
  FileSpreadsheet,
  FileText,
  MousePointer2,
  Dumbbell,
  Scissors,
  Building2,
  Zap,
  RefreshCw,
  Clock,
  Smartphone,
  CreditCard,
  QrCode,
  UserCheck,
  ChevronRight,
  Flame,
  TrendingUp,
  Cpu,
  Database,
  Search
} from "lucide-react";

export function CommonFeaturesSection({ className }: { className?: string }) {
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<"auto" | "sync" | "retention">("auto");

  return (
    <>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 1s step-end infinite;
        }
        @keyframes radar-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-radar {
          animation: radar-sweep 3.5s linear infinite;
        }
        @keyframes scan-line {
          0% { top: -10%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { top: 110%; opacity: 0; }
        }
        .animate-scan {
          animation: scan-line 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes cursor-pos {
          0%, 100% { transform: translate(0px, 0px); }
          40% { transform: translate(14px, -10px); }
          75% { transform: translate(6px, 12px); }
        }
        .animate-cursor-pos {
          animation: cursor-pos 4s ease-in-out infinite;
        }
        @keyframes cursor-salon {
          0%, 100% { transform: translate(0px, 0px); }
          35% { transform: translate(-16px, 8px); }
          70% { transform: translate(-8px, -12px); }
        }
        .animate-cursor-salon {
          animation: cursor-salon 4.6s ease-in-out infinite;
          animation-delay: 0.4s;
        }
        @keyframes cursor-gym {
          0%, 100% { transform: translate(0px, 0px); }
          45% { transform: translate(12px, 14px); }
          80% { transform: translate(-10px, 4px); }
        }
        .animate-cursor-gym {
          animation: cursor-gym 4.2s ease-in-out infinite;
          animation-delay: 0.8s;
        }
      `}</style>

      <section
        id="features"
        className={"w-full px-4 sm:px-6 md:px-10 lg:px-16 py-10 md:py-16 bg-[#f4f6f9] font-sans text-slate-900 relative overflow-hidden border-y border-slate-200/80 " + (className || "")}
      >
        {/* Background glow effects */}
        <div className="absolute top-1/4 -left-48 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[160px] pointer-events-none" />

        {/* SECTION HEADER */}
        <div className="text-center mb-8 flex flex-col items-center gap-2 relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-50 px-3.5 py-1 text-[11px] font-bold tracking-wider text-purple-700 uppercase shadow-xs">
            <Sparkles className="size-3 text-purple-600" /> Unified Platform Intelligence
          </div>

          <h2 className="font-extrabold text-2xl sm:text-3xl md:text-4xl leading-[1.15] tracking-tight text-slate-950">
            Built for Real Operations.<br />
            <span className="bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              One Unified AI Architecture.
            </span>
          </h2>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed font-normal">
            Eliminate fragmented tools. IOTRONICS synchronizes your <strong className="text-slate-900">AI Business OS</strong>, <strong className="text-slate-900">FIT CLUB AI</strong>, and <strong className="text-slate-900">Salon OS</strong> with autonomous workflows, cross-app ledgers, and zero data silos.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href="#applications"
              className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs sm:text-sm font-semibold bg-slate-950 text-white hover:bg-purple-700 transition-all shadow-md"
            >
              <span>Explore The 3 Operating Systems</span>
              <ChevronRight className="size-4" />
            </a>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs sm:text-sm font-medium border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 transition-colors shadow-xs"
            >
              Request Live Demo
            </a>
          </div>
        </div>

        {/* BENTO GRID */}
        <div className="flex flex-col gap-4 max-w-7xl mx-auto relative z-10">
          {/* ROW 1: Auto Workflows (55%) + 3-Way Connected Graph (45%) */}
          <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-4">
            {/* CARD 1: Natural Language Business Copilot */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 md:p-7 shadow-xs flex flex-col justify-between hover:border-purple-300 hover:shadow-md transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                      <Command className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-950">Natural Language Business Copilot</h3>
                      <p className="text-[11px] text-slate-500">Describe what you need — IOTRONICS executes it across apps</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <Zap className="size-3 text-emerald-600" /> Auto-Executing
                  </span>
                </div>

                {/* Workflow Tab Selector */}
                <div className="flex items-center gap-1.5 mb-3 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveWorkflowTab("auto")}
                    className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all text-center ${
                      activeWorkflowTab === "auto"
                        ? "bg-purple-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-950 hover:bg-slate-200/60"
                    }`}
                  >
                    ⚡ Multi-Store PO
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveWorkflowTab("sync")}
                    className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all text-center ${
                      activeWorkflowTab === "sync"
                        ? "bg-purple-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-950 hover:bg-slate-200/60"
                    }`}
                  >
                    🏋️ FitClub Dues Auto-Collect
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveWorkflowTab("retention")}
                    className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all text-center ${
                      activeWorkflowTab === "retention"
                        ? "bg-purple-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-950 hover:bg-slate-200/60"
                    }`}
                  >
                    ✂️ Salon Rebooking Engine
                  </button>
                </div>

                {/* Terminal Prompt Mockup */}
                <div className="bg-[#f8f9fb] rounded-xl border border-slate-200 p-4 font-mono text-xs flex flex-col gap-3 shadow-inner">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-slate-500 text-[11px]">
                    <span className="flex items-center gap-1.5 text-slate-800 font-semibold">
                      <Sparkles className="size-3 text-purple-600" /> IOTRONICS Prompt Engine
                    </span>
                    <span className="text-slate-400">Latency: 14ms · Model: LM-Kernel-v4</span>
                  </div>

                  {activeWorkflowTab === "auto" && (
                    <div className="space-y-2 text-slate-800">
                      <p className="leading-relaxed">
                        <span className="text-purple-700 font-bold">&gt; Prompt:</span> "When retail protein stock drops below{" "}
                        <span className="text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 font-semibold">10 units</span>{" "}
                        in POS, auto-draft purchase order to{" "}
                        <span className="text-blue-900 bg-blue-100 px-1.5 py-0.5 rounded border border-blue-300 font-semibold">@Suraj Nutrition Ltd</span>{" "}
                        and sync inventory to <span className="text-emerald-800 font-semibold">@FitClub Café</span>."
                        <span className="inline-block w-1.5 h-3.5 bg-purple-600 ml-1 align-middle animate-blink" />
                      </p>
                      <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-2 text-[10px]">
                        <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                          <Check className="size-2.5 text-emerald-600" /> PO #PO-8821 Created
                        </span>
                        <span className="bg-blue-50 border border-blue-200 text-blue-800 font-semibold px-2 py-0.5 rounded">
                          POS & Gym Sync: Active
                        </span>
                        <span className="bg-purple-50 border border-purple-200 text-purple-800 font-semibold px-2 py-0.5 rounded">
                          GST: 18% Calculated
                        </span>
                      </div>
                    </div>
                  )}

                  {activeWorkflowTab === "sync" && (
                    <div className="space-y-2 text-slate-800">
                      <p className="leading-relaxed">
                        <span className="text-purple-700 font-bold">&gt; Prompt:</span> "Find gym members whose plans expire in{" "}
                        <span className="text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 font-semibold">3 days</span>,{" "}
                        dispatch personalized WhatsApp renewal links with 1-click UPI, and disable turnstile gate if unpaid."
                        <span className="inline-block w-1.5 h-3.5 bg-purple-600 ml-1 align-middle animate-blink" />
                      </p>
                      <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-2 text-[10px]">
                        <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                          <Check className="size-2.5 text-emerald-600" /> 18 Renewal WhatsApps Queued
                        </span>
                        <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                          UPI Payment Links Generated
                        </span>
                      </div>
                    </div>
                  )}

                  {activeWorkflowTab === "retention" && (
                    <div className="space-y-2 text-slate-800">
                      <p className="leading-relaxed">
                        <span className="text-purple-700 font-bold">&gt; Prompt:</span> "For all clients who booked Balayage or Hair Color, auto-schedule follow-up glossing reminder at{" "}
                        <span className="text-pink-900 bg-pink-100 px-1.5 py-0.5 rounded border border-pink-300 font-semibold">6 weeks</span>{" "}
                        with their assigned stylist."
                        <span className="inline-block w-1.5 h-3.5 bg-purple-600 ml-1 align-middle animate-blink" />
                      </p>
                      <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-2 text-[10px]">
                        <span className="bg-pink-50 border border-pink-200 text-pink-800 font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                          <Check className="size-2.5 text-pink-600" /> Stylist Elena Calendar Synced
                        </span>
                        <span className="bg-purple-50 border border-purple-200 text-purple-800 font-semibold px-2 py-0.5 rounded">
                          Smart Rebooking: Active
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">Zero coding required · Multi-lingual execution</span>
                <span className="text-purple-700 font-bold flex items-center gap-1">
                  100% Autonomous <ArrowRight className="size-3" />
                </span>
              </div>
            </div>

            {/* CARD 2: Live 3-Way Connected Ecosystem Graph */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 md:p-7 shadow-xs flex flex-col justify-between hover:border-purple-300 hover:shadow-md transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                      <Layers className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-950">Live 3-Way Connected Hub</h3>
                      <p className="text-[11px] text-slate-500">All 3 applications synchronized in real time</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                    <RefreshCw className="size-3 animate-spin text-blue-600" style={{ animationDuration: "6s" }} /> 0-Silo Core
                  </span>
                </div>

                {/* 3-Node Interactive Diagram */}
                <div className="relative min-h-[220px] bg-[#f8f9fb] rounded-xl border border-slate-200 p-3 flex items-center justify-center">
                  {/* Glowing Connection Lines SVG */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="grad-blue-purple" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity="0.8" />
                      </linearGradient>
                      <linearGradient id="grad-emerald-purple" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity="0.8" />
                      </linearGradient>
                      <linearGradient id="grad-pink-purple" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ec4899" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity="0.8" />
                      </linearGradient>
                    </defs>
                    {/* Triangle connecting lines */}
                    <line x1="50%" y1="26%" x2="24%" y2="74%" stroke="url(#grad-blue-purple)" strokeWidth="2" strokeDasharray="4 3" />
                    <line x1="50%" y1="26%" x2="76%" y2="74%" stroke="url(#grad-pink-purple)" strokeWidth="2" strokeDasharray="4 3" />
                    <line x1="24%" y1="74%" x2="76%" y2="74%" stroke="url(#grad-emerald-purple)" strokeWidth="2" strokeDasharray="4 3" />
                  </svg>

                  {/* Node 1: AI Business OS (Top Center) */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white border border-blue-300 rounded-xl px-3 py-2 shadow-md flex items-center gap-2.5 z-10">
                    <div className="size-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-200">
                      <Building2 className="size-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                        AI Business OS <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
                      </div>
                      <div className="text-[9px] text-slate-500">Master ERP & POS Invoicing</div>
                    </div>
                  </div>

                  {/* Central Shared Hub Pill */}
                  <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 bg-purple-50 border border-purple-300 rounded-full px-3 py-1 shadow-sm flex items-center gap-1.5 z-20">
                    <Database className="size-3 text-purple-600" />
                    <span className="text-[10px] font-bold text-purple-800">IOTRONICS Shared Core</span>
                  </div>

                  {/* Node 2: FIT CLUB AI (Bottom Left) */}
                  <div className="absolute bottom-2 left-2 sm:left-4 bg-white border border-emerald-300 rounded-xl px-3 py-2 shadow-md flex items-center gap-2.5 z-10">
                    <div className="size-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs border border-emerald-200">
                      <Dumbbell className="size-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                        FIT CLUB AI <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                      <div className="text-[9px] text-emerald-700 font-medium">gym.iotronics.ai</div>
                    </div>
                  </div>

                  {/* Node 3: Salon OS (Bottom Right) */}
                  <div className="absolute bottom-2 right-2 sm:right-4 bg-white border border-pink-300 rounded-xl px-3 py-2 shadow-md flex items-center gap-2.5 z-10">
                    <div className="size-7 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center font-bold text-xs border border-pink-200">
                      <Scissors className="size-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                        Salon OS <span className="size-1.5 rounded-full bg-pink-500 animate-pulse" />
                      </div>
                      <div className="text-[9px] text-pink-700 font-medium">saloon.iotronics.ai</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">Automatic real-time ledger & WhatsApp reconciliation</span>
                <span className="text-emerald-700 font-bold">100% In Sync</span>
              </div>
            </div>
          </div>

          {/* ROW 2: Customer 360 (42%) + Multi-Modal Knowledge Ingestion (58%) */}
          <div className="grid grid-cols-1 lg:grid-cols-[42fr_58fr] gap-4">
            {/* CARD 3: Universal Customer 360 */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 md:p-7 shadow-xs flex flex-col justify-between hover:border-purple-300 hover:shadow-md transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                      <UserCheck className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-950">Unified Customer 360</h3>
                      <p className="text-[11px] text-slate-500">One profile across retail, gym check-ins & salon chairs</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    VIP Tier
                  </span>
                </div>

                {/* Interactive Customer Profile Preview */}
                <div className="bg-[#f8f9fb] rounded-xl border border-slate-200 p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-11 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center font-bold text-white text-sm shadow-md">
                        AV
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-950 flex items-center gap-1.5">
                          Ananya Verma
                          <span className="text-[9px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded border border-amber-300 font-semibold">
                            Platinum Member
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">+91 98201 44829 · Joined Mar 2025</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-extrabold text-emerald-700">₹64,200</div>
                      <div className="text-[9px] text-slate-500 font-medium">Total Spend</div>
                    </div>
                  </div>

                  {/* Cross-App Multi-Tag Status Grid */}
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                      <div className="text-slate-500 flex items-center gap-1 font-medium">
                        <Dumbbell className="size-3 text-emerald-600" /> FitClub Pass
                      </div>
                      <div className="text-slate-900 font-bold mt-0.5">Annual Gold (Active)</div>
                      <div className="text-[9px] text-emerald-700 font-semibold">Valid till Dec 2026</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                      <div className="text-slate-500 flex items-center gap-1 font-medium">
                        <Scissors className="size-3 text-pink-600" /> Salon History
                      </div>
                      <div className="text-slate-900 font-bold mt-0.5">Keratin + HydraFacial</div>
                      <div className="text-[9px] text-pink-700 font-semibold">Stylist: Elena (Chair 2)</div>
                    </div>
                  </div>

                  {/* Live Activity Feed */}
                  <div className="bg-white rounded-lg p-2.5 border border-slate-200 text-[10px] space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-700 font-medium">
                      <span className="flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-emerald-500" /> 10:45 AM: Checked into Gym (RFID Turnstile #1)
                      </span>
                      <span className="text-slate-400">Today</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700 font-medium">
                      <span className="flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-pink-500" /> 04:30 PM: Salon Hair Spa Scheduled
                      </span>
                      <span className="text-slate-400">Tomorrow</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">Shared loyalty points & cross-app rewards</span>
                <span className="text-purple-700 font-bold">360° Visibility</span>
              </div>
            </div>

            {/* CARD 4: Custom Business Knowledge & Catalog Ingestion */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 md:p-7 shadow-xs flex flex-col justify-between hover:border-purple-300 hover:shadow-md transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                      <UploadCloud className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-950">Multi-Modal Business Knowledge Ingestion</h3>
                      <p className="text-[11px] text-slate-500">Import rate cards, workout splits, hair formulas & GST catalogs</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Live Vector Store
                  </span>
                </div>

                {/* Ingestion Visualizer */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  {/* File 1: Retail Barcodes */}
                  <div className="bg-[#f8f9fb] p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <FileSpreadsheet className="size-5 text-blue-600" />
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Indexed</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-bold text-slate-900 truncate">POS_Inventory_SKU.csv</div>
                      <div className="text-[10px] text-slate-500">2,450 retail items & barcodes</div>
                    </div>
                  </div>

                  {/* File 2: Gym Workout & Diets */}
                  <div className="bg-[#f8f9fb] p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <FileText className="size-5 text-emerald-600" />
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Indexed</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-bold text-slate-900 truncate">FitClub_Diet_Plans.pdf</div>
                      <div className="text-[10px] text-slate-500">60 trainer workout splits</div>
                    </div>
                  </div>

                  {/* File 3: Salon Service Protocols */}
                  <div className="bg-[#f8f9fb] p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <Scissors className="size-5 text-pink-600" />
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Indexed</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-bold text-slate-900 truncate">Salon_Treatments.xlsx</div>
                      <div className="text-[10px] text-slate-500">84 luxury bridal & hair formulas</div>
                    </div>
                  </div>
                </div>

                {/* API Webhook Sync URL Bar */}
                <div className="bg-[#f8f9fb] p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 truncate text-slate-500">
                    <span className="text-[10px] font-mono bg-purple-100 border border-purple-200 px-2 py-0.5 rounded font-bold text-purple-800">API SYNC</span>
                    <span className="font-mono text-[11px] text-slate-700 truncate">https://api.iotronics.ai/v1/sync/knowledge-base</span>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-emerald-700 font-bold">Auto-Synced</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">Zero fine-tuning cost · Instant proprietary answers</span>
                <span className="text-amber-800 font-bold">Instant RAG Engine</span>
              </div>
            </div>
          </div>

          {/* ROW 3: Multi-Station Live Work (33%) + Radar Telemetry (33%) + Enterprise Security (33%) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* CARD 5: Multi-Station Live Operations */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col justify-between hover:border-purple-300 hover:shadow-md transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                      <MousePointer2 className="size-3.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-950">Multi-Station Live Collaboration</span>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                    <span className="size-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
                  </span>
                </div>

                {/* Animated Collaborative Worksurface */}
                <div className="relative h-36 bg-[#f8f9fb] rounded-xl border border-slate-200 p-3 overflow-hidden flex flex-col justify-between">
                  <div className="grid grid-cols-3 gap-1.5 text-[9px] text-center">
                    <div className="bg-white p-1.5 rounded border border-blue-200 text-blue-700 font-semibold shadow-2xs">
                      POS Register #1
                    </div>
                    <div className="bg-white p-1.5 rounded border border-emerald-200 text-emerald-700 font-semibold shadow-2xs">
                      Gym RFID Gate
                    </div>
                    <div className="bg-white p-1.5 rounded border border-pink-200 text-pink-700 font-semibold shadow-2xs">
                      Salon iPad #2
                    </div>
                  </div>

                  {/* Multi-Role Live Cursors */}
                  <div className="relative flex-1">
                    {/* POS Cashier Cursor */}
                    <div className="absolute top-2 left-4 z-20 flex flex-col items-start animate-cursor-pos">
                      <MousePointer2 className="size-4 text-white fill-blue-600 drop-shadow-md" />
                      <div className="bg-blue-600 text-[9px] font-bold text-white px-1.5 py-0.5 rounded shadow -mt-1 ml-2">
                        Raj (Cashier)
                      </div>
                    </div>

                    {/* Salon Stylist Cursor */}
                    <div className="absolute top-6 right-6 z-20 flex flex-col items-start animate-cursor-salon">
                      <MousePointer2 className="size-4 text-white fill-pink-600 drop-shadow-md" />
                      <div className="bg-pink-600 text-[9px] font-bold text-white px-1.5 py-0.5 rounded shadow -mt-1 ml-2">
                        Pooja (Stylist)
                      </div>
                    </div>

                    {/* Gym Trainer Cursor */}
                    <div className="absolute bottom-1 left-1/3 z-20 flex flex-col items-start animate-cursor-gym">
                      <MousePointer2 className="size-4 text-white fill-emerald-600 drop-shadow-md" />
                      <div className="bg-emerald-600 text-[9px] font-bold text-white px-1.5 py-0.5 rounded shadow -mt-1 ml-2">
                        Vikram (Trainer)
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xs font-bold text-slate-950">Conflict-Free Multi-User Sync</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Simultaneous cashier checkouts, trainer bookings, and salon appointments with zero locking lag.
                </div>
              </div>
            </div>

            {/* CARD 6: 24/7 Radar Telemetry & Stream */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col justify-between hover:border-purple-300 hover:shadow-md transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                      <Activity className="size-3.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-950">24/7 Operations Radar</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Active Stream
                  </span>
                </div>

                {/* Radar Simulation */}
                <div className="relative h-36 bg-[#f8f9fb] rounded-xl border border-slate-200 p-2 flex items-center justify-center overflow-hidden">
                  <div className="size-28 relative flex items-center justify-center">
                    {/* Radar Concentric Rings */}
                    <div className="absolute inset-0 rounded-full border border-emerald-500/20" />
                    <div className="absolute inset-3 rounded-full border border-emerald-500/20" />
                    <div className="absolute inset-6 rounded-full border border-emerald-500/20" />
                    <div className="absolute inset-9 rounded-full border border-emerald-500/20" />

                    {/* Rotating Radar Sweep */}
                    <div className="absolute inset-0 z-10 origin-center animate-radar">
                      <div
                        className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1/2 bg-gradient-to-tr from-emerald-500/30 to-transparent origin-bottom rounded-tr-full"
                        style={{ clipPath: "polygon(50% 100%, 100% 0, 100% 100%)" }}
                      />
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1.5px] h-1/2 bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                    </div>

                    {/* Active Ping Dots */}
                    <div className="absolute top-3 left-4 size-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981] animate-pulse" title="Gym Turnstile Active" />
                    <div className="absolute bottom-4 right-5 size-2.5 rounded-full bg-pink-500 shadow-[0_0_6px_#ec4899] animate-pulse" title="Salon Chair Booked" />
                    <div className="absolute top-6 right-3 size-2.5 rounded-full bg-blue-500 shadow-[0_0_6px_#3b82f6] animate-pulse" title="POS Invoiced" />

                    <div className="relative z-20 size-8 rounded-full bg-white border border-emerald-400 flex items-center justify-center shadow-md">
                      <Cpu className="size-3.5 text-emerald-600" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xs font-bold text-slate-950">Autonomous Anomaly Detection</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Flags unpaid invoices, unattended check-ins, and inventory depletion automatically.
                </div>
              </div>
            </div>

            {/* CARD 7: Enterprise Security & Tenant Vault */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col justify-between hover:border-purple-300 hover:shadow-md transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                      <ShieldCheck className="size-3.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-950">Enterprise Vault & Isolation</span>
                  </div>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    SOC-2 Ready
                  </span>
                </div>

                {/* Laser Security Scan Vault */}
                <div className="relative h-36 bg-[#f8f9fb] rounded-xl border border-slate-200 p-3 flex flex-col items-center justify-center overflow-hidden">
                  {/* Laser Scan Line */}
                  <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent z-20 animate-scan" />

                  <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="size-11 rounded-2xl bg-purple-100 border border-purple-200 flex items-center justify-center mb-2 shadow-xs">
                      <Lock className="size-5 text-purple-700" />
                    </div>
                    <div className="text-xs font-extrabold text-slate-950">AES-256 Multi-Tenant DB</div>
                    <div className="text-[10px] text-purple-700 font-mono mt-0.5 font-bold">Zero Cross-Org Leakage</div>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xs font-bold text-slate-950">Strict Role Governance</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Granular permissions for cashiers, gym trainers, master stylists, and branch auditors.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
