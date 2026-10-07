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
        className={"w-full px-4 sm:px-6 md:px-10 lg:px-16 py-8 md:py-12 bg-[#07090e] font-sans text-white relative overflow-hidden " + (className || "")}
      >
        {/* Background glow effects */}
        <div className="absolute top-1/4 -left-48 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-600/5 rounded-full blur-[160px] pointer-events-none" />

        {/* SECTION HEADER */}
        <div className="text-center mb-6 flex flex-col items-center gap-2 relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-[11px] font-semibold tracking-wider text-purple-300 uppercase shadow-inner">
            <Sparkles className="size-3 text-purple-400" /> Unified Platform Intelligence
          </div>

          <h2 className="font-black text-2xl sm:text-3xl md:text-4xl leading-[1.15] tracking-tight text-white">
            Built for Real Operations.<br />
            <span className="bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
              One Unified AI Architecture.
            </span>
          </h2>

          <p className="text-sm sm:text-base text-zinc-400 max-w-2xl leading-relaxed">
            Eliminate fragmented tools. IOTRONICS synchronizes your <strong>AI Business OS</strong>, <strong>FIT CLUB AI</strong>, and <strong>Salon OS</strong> with autonomous workflows, cross-app ledgers, and zero data silos.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href="#applications"
              className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs sm:text-sm font-semibold bg-white text-zinc-950 hover:bg-zinc-200 transition-all shadow-lg hover:shadow-purple-500/20"
            >
              <span>Explore The 3 Operating Systems</span>
              <ChevronRight className="size-4" />
            </a>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs sm:text-sm font-medium border border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
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
            <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800/90 p-6 md:p-7 shadow-2xl flex flex-col justify-between backdrop-blur-sm group hover:border-zinc-700 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                      <Command className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Natural Language Business Copilot</h3>
                      <p className="text-[11px] text-zinc-400">Describe what you need — IOTRONICS executes it across apps</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                    <Zap className="size-3" /> Auto-Executing
                  </span>
                </div>

                {/* Workflow Tab Selector */}
                <div className="flex items-center gap-1.5 mb-3 bg-zinc-950/60 p-1 rounded-xl border border-zinc-800/80 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveWorkflowTab("auto")}
                    className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all text-center ${
                      activeWorkflowTab === "auto"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                    }`}
                  >
                    ⚡ Multi-Store PO
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveWorkflowTab("sync")}
                    className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all text-center ${
                      activeWorkflowTab === "sync"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                    }`}
                  >
                    🏋️ FitClub Dues Auto-Collect
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveWorkflowTab("retention")}
                    className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all text-center ${
                      activeWorkflowTab === "retention"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                    }`}
                  >
                    ✂️ Salon Rebooking Engine
                  </button>
                </div>

                {/* Terminal Prompt Mockup */}
                <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-4 font-mono text-xs flex flex-col gap-3 shadow-inner">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80 text-zinc-400 text-[11px]">
                    <span className="flex items-center gap-1.5 text-zinc-300">
                      <Sparkles className="size-3 text-purple-400" /> IOTRONICS Prompt Engine
                    </span>
                    <span className="text-zinc-500">Latency: 14ms · Model: LM-Kernel-v4</span>
                  </div>

                  {activeWorkflowTab === "auto" && (
                    <div className="space-y-2 text-zinc-300">
                      <p className="leading-relaxed">
                        <span className="text-purple-400 font-semibold">&gt; Prompt:</span> "When retail protein stock drops below{" "}
                        <span className="text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">10 units</span>{" "}
                        in POS, auto-draft purchase order to{" "}
                        <span className="text-blue-300 bg-blue-400/10 px-1.5 py-0.5 rounded border border-blue-400/20">@Suraj Nutrition Ltd</span>{" "}
                        and sync inventory to <span className="text-emerald-300">@FitClub Café</span>."
                        <span className="inline-block w-1.5 h-3.5 bg-purple-400 ml-1 align-middle animate-blink" />
                      </p>
                      <div className="pt-2 border-t border-zinc-900 flex flex-wrap gap-2 text-[10px]">
                        <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded flex items-center gap-1">
                          <Check className="size-2.5" /> PO #PO-8821 Created
                        </span>
                        <span className="bg-blue-500/10 border border-blue-500/30 text-blue-400 px-2 py-0.5 rounded">
                          POS & Gym Sync: Active
                        </span>
                        <span className="bg-purple-500/10 border border-purple-500/30 text-purple-400 px-2 py-0.5 rounded">
                          GST: 18% Calculated
                        </span>
                      </div>
                    </div>
                  )}

                  {activeWorkflowTab === "sync" && (
                    <div className="space-y-2 text-zinc-300">
                      <p className="leading-relaxed">
                        <span className="text-purple-400 font-semibold">&gt; Prompt:</span> "Find gym members whose plans expire in{" "}
                        <span className="text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">3 days</span>,{" "}
                        dispatch personalized WhatsApp renewal links with 1-click UPI, and disable turnstile gate if unpaid."
                        <span className="inline-block w-1.5 h-3.5 bg-purple-400 ml-1 align-middle animate-blink" />
                      </p>
                      <div className="pt-2 border-t border-zinc-900 flex flex-wrap gap-2 text-[10px]">
                        <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded flex items-center gap-1">
                          <Check className="size-2.5" /> 18 Renewal WhatsApps Queued
                        </span>
                        <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded">
                          UPI Payment Links Generated
                        </span>
                      </div>
                    </div>
                  )}

                  {activeWorkflowTab === "retention" && (
                    <div className="space-y-2 text-zinc-300">
                      <p className="leading-relaxed">
                        <span className="text-purple-400 font-semibold">&gt; Prompt:</span> "For all clients who booked Balayage or Hair Color, auto-schedule follow-up glossing reminder at{" "}
                        <span className="text-pink-300 bg-pink-400/10 px-1.5 py-0.5 rounded border border-pink-400/20">6 weeks</span>{" "}
                        with their assigned stylist."
                        <span className="inline-block w-1.5 h-3.5 bg-purple-400 ml-1 align-middle animate-blink" />
                      </p>
                      <div className="pt-2 border-t border-zinc-900 flex flex-wrap gap-2 text-[10px]">
                        <span className="bg-pink-500/10 border border-pink-500/30 text-pink-400 px-2 py-0.5 rounded flex items-center gap-1">
                          <Check className="size-2.5" /> Stylist Elena Calender Synced
                        </span>
                        <span className="bg-purple-500/10 border border-purple-500/30 text-purple-400 px-2 py-0.5 rounded">
                          Smart Rebooking: Active
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                <span className="text-zinc-400">Zero coding required · Multi-lingual execution</span>
                <span className="text-purple-400 font-semibold flex items-center gap-1">
                  100% Autonomous <ArrowRight className="size-3" />
                </span>
              </div>
            </div>

            {/* CARD 2: Live 3-Way Connected Ecosystem Graph */}
            <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800/90 p-6 md:p-7 shadow-2xl flex flex-col justify-between backdrop-blur-sm group hover:border-zinc-700 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <Layers className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Live 3-Way Connected Hub</h3>
                      <p className="text-[11px] text-zinc-400">All 3 applications synchronized in real time</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                    <RefreshCw className="size-3 animate-spin" style={{ animationDuration: "6s" }} /> 0-Silo Core
                  </span>
                </div>

                {/* 3-Node Interactive Diagram */}
                <div className="relative min-h-[220px] bg-zinc-950/60 rounded-xl border border-zinc-800/80 p-3 flex items-center justify-center">
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
                    <line x1="50%" y1="26%" x2="24%" y2="74%" stroke="url(#grad-blue-purple)" strokeWidth="1.5" strokeDasharray="4 3" />
                    <line x1="50%" y1="26%" x2="76%" y2="74%" stroke="url(#grad-pink-purple)" strokeWidth="1.5" strokeDasharray="4 3" />
                    <line x1="24%" y1="74%" x2="76%" y2="74%" stroke="url(#grad-emerald-purple)" strokeWidth="1.5" strokeDasharray="4 3" />
                  </svg>

                  {/* Node 1: AI Business OS (Top Center) */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-zinc-900 border border-blue-500/40 rounded-xl px-3 py-2 shadow-lg flex items-center gap-2.5 z-10">
                    <div className="size-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                      <Building2 className="size-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1">
                        AI Business OS <span className="size-1.5 rounded-full bg-blue-400 animate-pulse" />
                      </div>
                      <div className="text-[9px] text-zinc-400">Master ERP & POS Invoicing</div>
                    </div>
                  </div>

                  {/* Central Shared Hub Pill */}
                  <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 bg-purple-950/80 border border-purple-500/50 rounded-full px-3 py-1 shadow-[0_0_20px_rgba(168,85,247,0.3)] flex items-center gap-1.5 z-20">
                    <Database className="size-3 text-purple-300" />
                    <span className="text-[10px] font-bold text-purple-200">IOTRONICS Shared Core</span>
                  </div>

                  {/* Node 2: FIT CLUB AI (Bottom Left) */}
                  <div className="absolute bottom-2 left-2 sm:left-4 bg-zinc-900 border border-emerald-500/40 rounded-xl px-3 py-2 shadow-lg flex items-center gap-2.5 z-10">
                    <div className="size-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                      <Dumbbell className="size-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1">
                        FIT CLUB AI <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      </div>
                      <div className="text-[9px] text-emerald-400/80">gym.iotronics.ai</div>
                    </div>
                  </div>

                  {/* Node 3: Salon OS (Bottom Right) */}
                  <div className="absolute bottom-2 right-2 sm:right-4 bg-zinc-900 border border-pink-500/40 rounded-xl px-3 py-2 shadow-lg flex items-center gap-2.5 z-10">
                    <div className="size-7 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-xs">
                      <Scissors className="size-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1">
                        Salon OS <span className="size-1.5 rounded-full bg-pink-400 animate-pulse" />
                      </div>
                      <div className="text-[9px] text-pink-400/80">saloon.iotronics.ai</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                <span className="text-zinc-400">Automatic real-time ledger & WhatsApp reconciliation</span>
                <span className="text-emerald-400 font-semibold">100% In Sync</span>
              </div>
            </div>
          </div>

          {/* ROW 2: Customer 360 (42%) + Multi-Modal Knowledge Ingestion (58%) */}
          <div className="grid grid-cols-1 lg:grid-cols-[42fr_58fr] gap-4">
            {/* CARD 3: Universal Customer 360 */}
            <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800/90 p-6 md:p-7 shadow-2xl flex flex-col justify-between backdrop-blur-sm group hover:border-zinc-700 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <UserCheck className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Unified Customer 360</h3>
                      <p className="text-[11px] text-zinc-400">One profile across retail, gym check-ins & salon chairs</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                    VIP Tier
                  </span>
                </div>

                {/* Interactive Customer Profile Preview */}
                <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-11 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center font-bold text-white text-sm shadow-md">
                        AV
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          Ananya Verma
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30">
                            Platinum Member
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-400">+91 98201 44829 · Joined Mar 2025</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-extrabold text-emerald-400">₹64,200</div>
                      <div className="text-[9px] text-zinc-400">Total Spend</div>
                    </div>
                  </div>

                  {/* Cross-App Multi-Tag Status Grid */}
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800/80">
                      <div className="text-zinc-400 flex items-center gap-1">
                        <Dumbbell className="size-3 text-emerald-400" /> FitClub Pass
                      </div>
                      <div className="text-white font-semibold mt-0.5">Annual Gold (Active)</div>
                      <div className="text-[9px] text-emerald-400">Valid till Dec 2026</div>
                    </div>
                    <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800/80">
                      <div className="text-zinc-400 flex items-center gap-1">
                        <Scissors className="size-3 text-pink-400" /> Salon History
                      </div>
                      <div className="text-white font-semibold mt-0.5">Keratin + HydraFacial</div>
                      <div className="text-[9px] text-pink-400">Stylist: Elena (Chair 2)</div>
                    </div>
                  </div>

                  {/* Live Activity Feed */}
                  <div className="bg-zinc-900/60 rounded-lg p-2 border border-zinc-800/60 text-[10px] space-y-1.5">
                    <div className="flex items-center justify-between text-zinc-300">
                      <span className="flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-emerald-400" /> 10:45 AM: Checked into Gym (RFID Turnstile #1)
                      </span>
                      <span className="text-zinc-500">Today</span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-300">
                      <span className="flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-pink-400" /> 04:30 PM: Salon Hair Spa Scheduled
                      </span>
                      <span className="text-zinc-500">Tomorrow</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                <span className="text-zinc-400">Shared loyalty points & cross-app rewards</span>
                <span className="text-purple-400 font-semibold">360° Visibility</span>
              </div>
            </div>

            {/* CARD 4: Custom Business Knowledge & Catalog Ingestion */}
            <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800/90 p-6 md:p-7 shadow-2xl flex flex-col justify-between backdrop-blur-sm group hover:border-zinc-700 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <UploadCloud className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Multi-Modal Business Knowledge Ingestion</h3>
                      <p className="text-[11px] text-zinc-400">Import rate cards, workout splits, hair formulas & GST catalogs</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Live Vector Store
                  </span>
                </div>

                {/* Ingestion Visualizer */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  {/* File 1: Retail Barcodes */}
                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <FileSpreadsheet className="size-5 text-blue-400" />
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Indexed</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-bold text-white truncate">POS_Inventory_SKU.csv</div>
                      <div className="text-[10px] text-zinc-400">2,450 retail items & barcodes</div>
                    </div>
                  </div>

                  {/* File 2: Gym Workout & Diets */}
                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <FileText className="size-5 text-emerald-400" />
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Indexed</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-bold text-white truncate">FitClub_Diet_Plans.pdf</div>
                      <div className="text-[10px] text-zinc-400">60 trainer workout splits</div>
                    </div>
                  </div>

                  {/* File 3: Salon Service Protocols */}
                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <Scissors className="size-5 text-pink-400" />
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Indexed</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-bold text-white truncate">Salon_Treatments.xlsx</div>
                      <div className="text-[10px] text-zinc-400">84 luxury bridal & hair formulas</div>
                    </div>
                  </div>
                </div>

                {/* API Webhook Sync URL Bar */}
                <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 truncate text-zinc-400">
                    <span className="text-[10px] font-mono bg-zinc-900 px-2 py-0.5 rounded text-purple-300">API SYNC</span>
                    <span className="font-mono text-[11px] text-zinc-300 truncate">https://api.iotronics.ai/v1/sync/knowledge-base</span>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-semibold">Auto-Synced</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                <span className="text-zinc-400">Zero fine-tuning cost · Instant proprietary answers</span>
                <span className="text-amber-400 font-semibold">Instant RAG Engine</span>
              </div>
            </div>
          </div>

          {/* ROW 3: Multi-Station Live Work (33%) + Radar Telemetry (33%) + Enterprise Security (33%) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* CARD 5: Multi-Station Live Operations */}
            <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800/90 p-6 shadow-2xl flex flex-col justify-between backdrop-blur-sm group hover:border-zinc-700 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <MousePointer2 className="size-3.5" />
                    </div>
                    <span className="text-xs font-bold text-white">Multi-Station Live Collaboration</span>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                    <span className="size-1.5 rounded-full bg-red-400 animate-pulse" /> LIVE
                  </span>
                </div>

                {/* Animated Collaborative Worksurface */}
                <div className="relative h-36 bg-zinc-950 rounded-xl border border-zinc-800 p-3 overflow-hidden flex flex-col justify-between">
                  <div className="grid grid-cols-3 gap-1.5 text-[9px] text-center">
                    <div className="bg-zinc-900/80 p-1.5 rounded border border-blue-500/30 text-blue-300">
                      POS Register #1
                    </div>
                    <div className="bg-zinc-900/80 p-1.5 rounded border border-emerald-500/30 text-emerald-300">
                      Gym RFID Gate
                    </div>
                    <div className="bg-zinc-900/80 p-1.5 rounded border border-pink-500/30 text-pink-300">
                      Salon iPad #2
                    </div>
                  </div>

                  {/* Multi-Role Live Cursors */}
                  <div className="relative flex-1">
                    {/* POS Cashier Cursor */}
                    <div className="absolute top-2 left-4 z-20 flex flex-col items-start animate-cursor-pos">
                      <MousePointer2 className="size-4 text-white fill-blue-500 drop-shadow-md" />
                      <div className="bg-blue-600 text-[9px] font-bold text-white px-1.5 py-0.5 rounded shadow -mt-1 ml-2">
                        Raj (Cashier)
                      </div>
                    </div>

                    {/* Salon Stylist Cursor */}
                    <div className="absolute top-6 right-6 z-20 flex flex-col items-start animate-cursor-salon">
                      <MousePointer2 className="size-4 text-white fill-pink-500 drop-shadow-md" />
                      <div className="bg-pink-600 text-[9px] font-bold text-white px-1.5 py-0.5 rounded shadow -mt-1 ml-2">
                        Pooja (Stylist)
                      </div>
                    </div>

                    {/* Gym Trainer Cursor */}
                    <div className="absolute bottom-1 left-1/3 z-20 flex flex-col items-start animate-cursor-gym">
                      <MousePointer2 className="size-4 text-white fill-emerald-500 drop-shadow-md" />
                      <div className="bg-emerald-600 text-[9px] font-bold text-white px-1.5 py-0.5 rounded shadow -mt-1 ml-2">
                        Vikram (Trainer)
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xs font-bold text-white">Conflict-Free Multi-User Sync</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  Simultaneous cashier checkouts, trainer bookings, and salon appointments with zero locking lag.
                </div>
              </div>
            </div>

            {/* CARD 6: 24/7 Radar Telemetry & Stream */}
            <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800/90 p-6 shadow-2xl flex flex-col justify-between backdrop-blur-sm group hover:border-zinc-700 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Activity className="size-3.5" />
                    </div>
                    <span className="text-xs font-bold text-white">24/7 Operations Radar</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Active Stream
                  </span>
                </div>

                {/* Radar Simulation */}
                <div className="relative h-36 bg-zinc-950 rounded-xl border border-zinc-800 p-2 flex items-center justify-center overflow-hidden">
                  <div className="size-28 relative flex items-center justify-center">
                    {/* Radar Concentric Rings */}
                    <div className="absolute inset-0 rounded-full border border-emerald-500/20" />
                    <div className="absolute inset-3 rounded-full border border-emerald-500/20" />
                    <div className="absolute inset-6 rounded-full border border-emerald-500/20" />
                    <div className="absolute inset-9 rounded-full border border-emerald-500/20" />

                    {/* Rotating Radar Sweep */}
                    <div className="absolute inset-0 z-10 origin-center animate-radar">
                      <div
                        className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1/2 bg-gradient-to-tr from-emerald-500/40 to-transparent origin-bottom rounded-tr-full"
                        style={{ clipPath: "polygon(50% 100%, 100% 0, 100% 100%)" }}
                      />
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-1/2 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                    </div>

                    {/* Active Ping Dots */}
                    <div className="absolute top-3 left-4 size-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" title="Gym Turnstile Active" />
                    <div className="absolute bottom-4 right-5 size-2 rounded-full bg-pink-400 shadow-[0_0_6px_#f472b6] animate-pulse" title="Salon Chair Booked" />
                    <div className="absolute top-6 right-3 size-2 rounded-full bg-blue-400 shadow-[0_0_6px_#60a5fa] animate-pulse" title="POS Invoiced" />

                    <div className="relative z-20 size-8 rounded-full bg-zinc-900 border border-emerald-500/50 flex items-center justify-center shadow-lg">
                      <Cpu className="size-3.5 text-emerald-400" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xs font-bold text-white">Autonomous Anomaly Detection</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  Flags unpaid invoices, unattended check-ins, and inventory depletion automatically.
                </div>
              </div>
            </div>

            {/* CARD 7: Enterprise Security & Tenant Vault */}
            <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800/90 p-6 shadow-2xl flex flex-col justify-between backdrop-blur-sm group hover:border-zinc-700 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                      <ShieldCheck className="size-3.5" />
                    </div>
                    <span className="text-xs font-bold text-white">Enterprise Vault & Isolation</span>
                  </div>
                  <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                    SOC-2 Ready
                  </span>
                </div>

                {/* Laser Security Scan Vault */}
                <div className="relative h-36 bg-zinc-950 rounded-xl border border-zinc-800 p-3 flex flex-col items-center justify-center overflow-hidden">
                  {/* Laser Scan Line */}
                  <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-400 to-transparent z-20 animate-scan" />

                  <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="size-11 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mb-2 shadow-inner">
                      <Lock className="size-5 text-purple-400" />
                    </div>
                    <div className="text-xs font-extrabold text-white">AES-256 Multi-Tenant DB</div>
                    <div className="text-[10px] text-purple-300 font-mono mt-0.5">Zero Cross-Org Leakage</div>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xs font-bold text-white">Strict Role Governance</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
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
