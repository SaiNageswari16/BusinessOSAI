import { useState } from "react";
import { biDashboards } from "@/data/platform";
import { Section, SectionHeading, Reveal } from "@/components/site/primitives";
import { TrendingUp, TrendingDown, Layers, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export function AnalyticsDashboard() {
  const [selectedOutlet, setSelectedOutlet] = useState("All Branches (8)");
  const [timeRange, setTimeRange] = useState("Last 30 Days");

  return (
    <Section id="analytics" tone="muted">
      <Reveal>
        <SectionHeading
          eyebrow="Unified Business Intelligence"
          title={
            <>
              Every metric, branch & transaction <span className="text-gradient-brand">in clear focus.</span>
            </>
          }
          description="Real-time multi-branch aggregation without latency. Monitor sales velocity, stock turns, profit contribution, and staff efficiency."
        />
      </Reveal>

      {/* Control bar */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Live Telemetry Feed</span>
          <span className="size-2 rounded-full bg-chart-4 animate-ping" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Filter className="size-3.5" /> Filter:
          </div>
          <select
            value={selectedOutlet}
            onChange={(e) => setSelectedOutlet(e.target.value)}
            className="rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none"
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
            className="rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none"
          >
            <option>Today</option>
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>Fiscal YTD</option>
          </select>
        </div>
      </div>

      {/* 9 BI Dashboard Metric Cards */}
      <div className="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {biDashboards.map((card, idx) => {
          const isPositive = card.delta.startsWith("+");
          return (
            <Reveal key={card.name} delay={idx * 30}>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {card.name}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                      isPositive ? "bg-chart-4/15 text-chart-4" : "bg-destructive/15 text-destructive"
                    )}
                  >
                    {isPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                    {card.delta}
                  </span>
                </div>

                <div className="mt-3">
                  <p className="font-display text-2xl font-bold tracking-tight text-foreground">{card.metric}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.note}</p>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
