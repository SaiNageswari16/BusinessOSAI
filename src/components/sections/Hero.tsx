import { ArrowRight, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { Cta, Reveal } from "@/components/site/primitives";

const kpis = [
  { label: "Net sales today", value: "₹4,82,140", delta: "+8.2%", up: true },
  { label: "Orders", value: "1,284", delta: "+11.4%", up: true },
  { label: "Stock health", value: "94.1%", delta: "+1.4%", up: true },
  { label: "Receivables", value: "₹3,10,500", delta: "-2.1%", up: false },
];

const bars = [38, 52, 44, 68, 59, 81, 72, 90, 66, 78, 95, 84];

const feed = [
  { tag: "POS", text: "Outlet 04 closed evening shift — ₹86,220", tone: "primary" },
  { tag: "AI", text: "Reorder 3 SKUs before Friday to avoid stock-out", tone: "accent" },
  { tag: "Marketplace", text: "Vendor 'Suraj Traders' payout approved", tone: "primary" },
  { tag: "CRM", text: "12 leads scored high-intent this morning", tone: "accent" },
];

const ecosystem = ["ERP", "Inventory", "POS", "CRM", "HRMS", "Finance", "Marketplace", "Store"];

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-gradient-ink pt-32 pb-20 text-ink-foreground md:pt-40 md:pb-28">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[60rem] bg-halo" />

      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-ink-border bg-ink-foreground/8 px-3.5 py-1.5 text-xs font-semibold tracking-[0.14em] text-accent uppercase">
              <Sparkles className="size-3.5" /> AI Business Operating Platform
            </span>

            <h1 className="mt-6 text-4xl leading-[1.05] font-semibold text-balance sm:text-5xl lg:text-6xl">
              One Intelligent Platform.
              <br />
              <span className="text-gradient-brand">Every Business.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base text-ink-muted md:text-lg">
              Connect operations, commerce, customers, people, finance and AI in one powerful business
              ecosystem.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Cta href="#platform">
                Explore the Platform <ArrowRight className="size-4" />
              </Cta>
              <Cta href="#cta" variant="onInk">
                Book a Demo
              </Cta>
            </div>

            <p className="mt-7 text-sm font-medium text-ink-muted">
              AI-powered <span className="text-accent">•</span> Enterprise-ready{" "}
              <span className="text-accent">•</span> Built to scale
            </p>
          </Reveal>

          <Reveal delay={120}>
            <DashboardPreview />
          </Reveal>
        </div>

        <Reveal delay={80}>
          <EcosystemGraph />
        </Reveal>
      </div>
    </section>
  );
}

function DashboardPreview() {
  return (
    <div className="surface-glass overflow-hidden p-3 shadow-[var(--shadow-glow)]">
      <div className="rounded-[calc(var(--radius-2xl)-6px)] bg-ink/85 p-4 md:p-5">
        <div className="flex items-center justify-between gap-3 border-b border-ink-border pb-3">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-destructive/70" />
            <span className="size-2.5 rounded-full bg-chart-5/70" />
            <span className="size-2.5 rounded-full bg-chart-4/70" />
            <span className="ml-3 text-xs font-medium text-ink-muted">Command Centre — All Branches</span>
          </div>
          <span className="rounded-full border border-ink-border px-2.5 py-1 text-[10px] font-semibold tracking-wide text-accent uppercase">
            Live
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-ink-border bg-ink-foreground/5 p-3">
              <p className="text-[11px] text-ink-muted">{kpi.label}</p>
              <p className="mt-1.5 font-display text-lg font-semibold">{kpi.value}</p>
              <p
                className={`mt-1 inline-flex items-center gap-1 text-[11px] font-semibold ${
                  kpi.up ? "text-chart-4" : "text-destructive"
                }`}
              >
                {kpi.up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {kpi.delta}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-xl border border-ink-border bg-ink-foreground/5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Revenue by channel</p>
            <p className="text-[11px] text-ink-muted">Last 12 weeks</p>
          </div>
          <div className="mt-3 flex h-24 items-end gap-1.5">
            {bars.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-gradient-brand opacity-85"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {feed.map((row) => (
            <div
              key={row.text}
              className="flex items-center gap-2.5 rounded-lg border border-ink-border bg-ink-foreground/5 px-3 py-2"
            >
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                  row.tone === "accent" ? "bg-accent/18 text-accent" : "bg-primary/25 text-primary-glow"
                }`}
              >
                {row.tag}
              </span>
              <span className="truncate text-[11px] text-ink-muted">{row.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EcosystemGraph() {
  return (
    <div className="mt-20 md:mt-24">
      <div className="surface-glass relative mx-auto max-w-5xl px-5 py-10 sm:px-10">
        <p className="text-center text-xs font-semibold tracking-[0.18em] text-ink-muted uppercase">
          Connected product ecosystem
        </p>

        <div className="relative mt-10 grid place-items-center">
          <div className="relative grid size-40 place-items-center rounded-full border border-accent/30 bg-primary/15">
            <span className="absolute inset-0 animate-pulse-ring rounded-full border border-primary/40" />
            <span className="absolute -inset-6 animate-pulse-ring rounded-full border border-accent/15" />
            <div className="text-center">
              <Sparkles className="mx-auto size-6 text-accent" />
              <p className="mt-2 font-display text-sm font-semibold">AI Intelligence</p>
              <p className="text-[11px] text-ink-muted">Central layer</p>
            </div>
          </div>

          <div className="mt-10 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
            {ecosystem.map((node, i) => (
              <div
                key={node}
                className="animate-float-soft rounded-xl border border-ink-border bg-ink-foreground/6 px-3 py-3 text-center text-sm font-medium"
                style={{ animationDelay: `${i * 0.35}s` }}
              >
                {node}
              </div>
            ))}
          </div>

          <svg
            className="pointer-events-none absolute inset-0 h-full w-full opacity-60"
            aria-hidden="true"
            preserveAspectRatio="none"
          >
            <line
              x1="50%"
              y1="20%"
              x2="50%"
              y2="70%"
              stroke="var(--color-accent)"
              strokeWidth="1"
              strokeDasharray="6 6"
              className="animate-dash-flow"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
