import { useState } from "react";
import { Store, ShoppingBag, Truck, Building, ArrowRight, CheckCircle2 } from "lucide-react";
import { commerceFlows, storeCategories, marketplaceGroups, b2bFeatures } from "@/data/platform";
import { Section, SectionHeading, Reveal, Cta } from "@/components/site/primitives";
import { Icon } from "@/components/site/icon";
import { cn } from "@/lib/utils";

export function OmnichannelCommerce() {
  const [activeTab, setActiveTab] = useState<"store" | "marketplace" | "b2b">("store");

  return (
    <Section id="commerce" tone="light">
      <Reveal>
        <SectionHeading
          eyebrow="Unified Commerce"
          title={
            <>
              Sell everywhere. <span className="text-gradient-brand">Fulfill from one inventory pool.</span>
            </>
          }
          description="Power modern consumer storefronts, multi-vendor marketplaces, wholesale distributor portals, and counter POS without inventory conflicts."
        />
      </Reveal>

      {/* Tabs */}
      <div className="mt-10 flex justify-center">
        <div className="inline-flex rounded-full border border-border bg-secondary/80 p-1">
          {[
            { id: "store", label: "Online Store & App", icon: ShoppingBag },
            { id: "marketplace", label: "Multi-Vendor Marketplace", icon: Store },
            { id: "b2b", label: "B2B & Wholesale Portal", icon: Building },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold transition-all",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <TabIcon className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content Panels */}
      <div className="mt-10">
        {activeTab === "store" && (
          <Reveal>
            <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] items-center">
              <div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Customer-Facing Storefront
                </span>
                <h3 className="mt-3 font-display text-2xl font-bold text-foreground sm:text-3xl">
                  Lightning fast discovery with AI search & recommendations
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Give buyers a premium mobile and web shopping experience. Integrated with live POS inventory, customer loyalty points, instant checkout, and hyper-local delivery tracking.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  {(commerceFlows[0]?.steps ?? []).map((step, i) => (
                    <div key={step} className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex gap-3">
                  <Cta href="#cta" variant="primary">Launch Your Store</Cta>
                  <Cta href="#platform" variant="outline">View Features</Cta>
                </div>
              </div>

              {/* Store Categories Grid Showcase */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {storeCategories.map((cat) => (
                  <div
                    key={cat.name}
                    className="rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
                  >
                    <span className="grid size-9 place-items-center rounded-xl bg-secondary text-primary">
                      <Icon name={cat.icon} className="size-4.5" />
                    </span>
                    <h4 className="mt-3 font-display text-sm font-semibold text-foreground">{cat.name}</h4>
                    <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{cat.line}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        )}

        {activeTab === "marketplace" && (
          <Reveal>
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-md">
              <div className="max-w-2xl">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Multi-Tenant Marketplace Engine
                </span>
                <h3 className="mt-2 font-display text-2xl font-bold text-foreground">
                  Onboard sellers, manage catalogues & automate vendor payouts
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Complete infrastructure to launch and operate single or multi-category marketplaces.
                </p>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {marketplaceGroups.map((group) => (
                  <div key={group.title} className="rounded-2xl bg-secondary/50 p-4 border border-border">
                    <h4 className="font-display text-sm font-semibold text-foreground">{group.title}</h4>
                    <ul className="mt-3 space-y-1.5">
                      {group.items.slice(0, 5).map((item) => (
                        <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        )}

        {activeTab === "b2b" && (
          <Reveal>
            <div className="grid gap-8 lg:grid-cols-2 items-center">
              <div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Wholesale & B2B Distribution
                </span>
                <h3 className="mt-3 font-display text-2xl font-bold text-foreground sm:text-3xl">
                  Tier pricing, credit terms & bulk quotes on autopilot
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Empower dealers and corporate clients with dedicated portals. Set custom pricing contracts, approve credit limits, and process bulk RFQs in minutes.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {b2bFeatures.map((f) => (
                    <span
                      key={f}
                      className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <span className="font-display text-sm font-semibold">Live B2B Ordering Pipeline</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Connected</span>
                </div>
                <div className="space-y-2.5">
                  {(commerceFlows[2]?.steps ?? []).map((st, i) => (
                    <div key={st} className="flex items-center justify-between rounded-xl bg-secondary/60 p-3 text-xs">
                      <span className="font-medium text-foreground">Step {i + 1}: {st}</span>
                      <span className="text-[11px] text-muted-foreground">Auto-synced to ERP</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </Section>
  );
}
