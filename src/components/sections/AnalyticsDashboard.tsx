import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { biDashboards } from "@/data/platform";
import { Section, SectionHeading, Reveal } from "@/components/site/primitives";
import {
  TrendingUp,
  TrendingDown,
  Layers,
  Filter,
  BarChart3,
  ArrowRight,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function AnalyticsDashboard() {
  const [selectedOutlet, setSelectedOutlet] = useState("All Branches (8)");
  const [timeRange, setTimeRange] = useState("Last 30 Days");

  // Multiplier based on selection for realistic interactivity
  const outletMultipliers: Record<string, number> = {
    "All Branches (8)": 1.0,
    "Downtown Flagship": 0.42,
    "North Central Outlet": 0.28,
    "Express Airport Store": 0.18,
    "Central Warehouse": 0.12,
  };

  const mult = outletMultipliers[selectedOutlet] ?? 1.0;

  const dynamicDashboards = [
    {
      name: "Sales",
      metric: `₹${(12.4 * mult).toFixed(1)}L`,
      delta: "+6.2%",
      note: `${timeRange} telemetry across ${selectedOutlet}`,
    },
    {
      name: "Inventory",
      metric: `${(94.1 + (mult > 0.5 ? 0.8 : -1.2)).toFixed(1)}%`,
      delta: "+1.4%",
      note: "Live stock availability & fulfillment score",
    },
    {
      name: "Customers",
      metric: `${Math.round(3284 * mult).toLocaleString()}`,
      delta: "+184",
      note: `Active customer profiles engaged in ${timeRange}`,
    },
    {
      name: "Finance",
      metric: `₹${(3.1 * mult).toFixed(1)}L`,
      delta: "-2.1%",
      note: "Reconciled ledger & receivables",
    },
    {
      name: "Vendors",
      metric: `${Math.round(126 * (mult > 0.5 ? 1 : 0.6))}`,
      delta: "+9",
      note: "Integrated suppliers & purchase orders",
    },
    {
      name: "Orders",
      metric: `${Math.round(1942 * mult).toLocaleString()}`,
      delta: "+11.8%",
      note: "Completed POS & digital transactions",
    },
    {
      name: "Marketing",
      metric: "4.6x",
      delta: "+0.4x",
      note: "Return on promotional campaigns & loyalty",
    },
    {
      name: "HR Attendance",
      metric: "98.2%",
      delta: "+0.8%",
      note: "Biometric shift attendance compliance",
    },
    {
      name: "Operations",
      metric: "< 12 ms",
      delta: "-4 ms",
      note: "Average sub-system API latency",
    },
  ];

  return (
    <Section id="analytics" tone="muted">
      <Reveal>
        <SectionHeading
          eyebrow="Unified Business Intelligence"
          title={
            <>
              Every metric, branch & transaction{" "}
              <span className="text-gradient-brand">in clear focus.</span>
            </>
          }
          description="Real-time multi-branch aggregation without latency. Monitor sales velocity, stock turns, profit contribution, and staff efficiency."
        />
      </Reveal>

      {/* Control bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Live Telemetry Feed</span>
          <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Filter className="size-3.5" /> Filter:
          </div>
          <select
            value={selectedOutlet}
            onChange={(e) => setSelectedOutlet(e.target.value)}
            className="rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none cursor-pointer"
          >
            <option>All Branches (8)</option>
            <option>Downtown Flagship</option>
            <option>North Central Outlet</option>
            <option>Express Airport Store</option>
            <option>Central Warehouse</option>
          </select>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none cursor-pointer"
          >
            <option>Today</option>
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>Fiscal YTD</option>
          </select>

          <Link
            to="/analytics"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-3 py-1 text-xs font-bold shadow-xs transition-all cursor-pointer ml-1"
          >
            <span>Explore More</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>

      {/* 9 BI Dashboard Metric Cards */}
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {dynamicDashboards.map((card, idx) => {
          const isPositive = card.delta.startsWith("+");
          return (
            <Reveal key={card.name} delay={idx * 25}>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all duration-300 hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {card.name}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                      isPositive
                        ? "bg-emerald-500/15 text-emerald-600"
                        : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {isPositive ? (
                      <TrendingUp className="size-3" />
                    ) : (
                      <TrendingDown className="size-3" />
                    )}
                    {card.delta}
                  </span>
                </div>

                <div className="mt-3">
                  <p className="font-display text-2xl font-bold tracking-tight text-foreground">
                    {card.metric}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.note}</p>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>

      {/* Explore More Card / Call-to-Action to Full Dedicated Analytics Page */}
      <Reveal delay={250}>
        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 rounded-2xl sm:rounded-3xl border border-purple-200/90 bg-gradient-to-r from-purple-50/90 via-white to-indigo-50/90 p-5 sm:p-6 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25 shrink-0">
              <BarChart3 className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-100/90 px-2 py-0.5 rounded-md border border-purple-200/60">
                  Dedicated Application
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-semibold text-slate-500">Cross-Vertical Business Intelligence</span>
              </div>
              <h4 className="text-sm sm:text-base font-black text-slate-950 mt-1 leading-tight">
                AI-Powered Business Analytics OS
              </h4>
              <p className="text-xs text-slate-600 mt-0.5 max-w-xl leading-relaxed">
                Unlock end-to-end analytics workflows, AI forecasting, custom dashboards, 9 specialized modules and multi-branch intelligence.
              </p>
            </div>
          </div>

          <Link
            to="/analytics"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-600 px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-purple-500/30 transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/40 cursor-pointer shrink-0 w-full sm:w-auto justify-center"
          >
            <span>Explore More</span>
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </Reveal>
    </Section>
  );
}
