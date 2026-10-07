import { useState } from "react";
import { ArrowRight, CheckCircle2, Search } from "lucide-react";
import { modules, erpFeatures, inventoryGroups, posTypes, posFeatures, crmFeatures, type ModuleItem } from "@/data/platform";
import { Section, SectionHeading, Reveal, Cta, Chip } from "@/components/site/primitives";
import { Icon } from "@/components/site/icon";
import { cn } from "@/lib/utils";

const defaultModule: ModuleItem = modules[0] ?? {
  id: "core-erp",
  name: "Core ERP",
  icon: "Building2",
  description: "One connected foundation for companies, branches, people and processes.",
  capabilities: ["Company & branch management", "Roles & permissions", "Workflows", "Audit logs"],
};

export function PlatformModules() {
  const [selectedModuleId, setSelectedModuleId] = useState<string>(defaultModule.id);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredModules = modules.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.capabilities.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activeModule = modules.find((m) => m.id === selectedModuleId) ?? defaultModule;

  return (
    <Section id="platform" tone="light">
      <Reveal>
        <SectionHeading
          eyebrow="Integrated Architecture"
          title={
            <>
              One connected core. <span className="text-gradient-brand">16 powerful modules.</span>
            </>
          }
          description="Every business unit shares the same real-time data layer. Say goodbye to fragmented software, manual syncing, and broken records."
        />
      </Reveal>

      {/* Search & Filter Bar */}
      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search modules, workflows, features..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
          <span>Popular:</span>
          {["Core ERP", "POS", "Inventory", "CRM", "Marketplace"].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                const found = modules.find((m) => m.name.toLowerCase().includes(tag.toLowerCase()));
                if (found) setSelectedModuleId(found.id);
              }}
              className="rounded-full bg-secondary px-2.5 py-1 text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Modules + Detail Inspector */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Module Cards Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filteredModules.map((item, idx) => {
            const isSelected = item.id === activeModule.id;
            return (
              <Reveal key={item.id} delay={idx * 30}>
                <button
                  type="button"
                  onClick={() => setSelectedModuleId(item.id)}
                  className={cn(
                    "group w-full text-left rounded-2xl border p-4 transition-all duration-200",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-[var(--shadow-soft)] ring-1 ring-primary/40"
                      : "border-border bg-card hover:border-primary/30 hover:bg-secondary/40"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "grid size-10 place-items-center rounded-xl transition-colors",
                        isSelected
                          ? "bg-gradient-brand text-primary-foreground shadow-sm"
                          : "bg-secondary text-primary group-hover:bg-primary/10"
                      )}
                    >
                      <Icon name={item.icon} className="size-5" />
                    </span>
                    <div>
                      <h3 className="font-display text-sm font-semibold text-foreground">{item.name}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.capabilities.slice(0, 3).map((cap) => (
                      <span
                        key={cap}
                        className="rounded-md bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground border border-border/60"
                      >
                        {cap}
                      </span>
                    ))}
                    {item.capabilities.length > 3 && (
                      <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        +{item.capabilities.length - 3}
                      </span>
                    )}
                  </div>
                </button>
              </Reveal>
            );
          })}
        </div>

        {/* Active Module Deep Dive Card */}
        <Reveal delay={100} className="lg:sticky lg:top-24 h-fit">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <span className="grid size-12 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-md">
                  <Icon name={activeModule.icon} className="size-6" />
                </span>
                <div>
                  <span className="text-xs font-semibold tracking-wider text-primary uppercase">Module Spotlight</span>
                  <h3 className="font-display text-2xl font-bold text-foreground">{activeModule.name}</h3>
                </div>
              </div>
              <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-foreground border border-accent/30">
                Live & Synced
              </span>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{activeModule.description}</p>

            <div className="mt-6 border-t border-border/80 pt-5">
              <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Core Capabilities</h4>
              <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {activeModule.capabilities.map((cap) => (
                  <li key={cap} className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <CheckCircle2 className="size-4 shrink-0 text-primary" />
                    <span>{cap}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contextual Deep Dive specifics based on active module */}
            {activeModule.id === "core-erp" && (
              <div className="mt-6 rounded-2xl bg-secondary/60 p-4 border border-border">
                <p className="text-xs font-semibold text-foreground">Enterprise Highlights</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {erpFeatures.slice(0, 8).map((f) => (
                    <Chip key={f} tone="light">
                      {f}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {activeModule.id === "inventory" && (
              <div className="mt-6 space-y-3">
                {inventoryGroups.slice(0, 2).map((group) => (
                  <div key={group.title} className="rounded-2xl bg-secondary/60 p-3.5 border border-border">
                    <p className="text-xs font-semibold text-foreground">{group.title}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {group.items.map((item) => (
                        <span key={item} className="text-[11px] text-muted-foreground bg-card px-2 py-0.5 rounded border border-border/80">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeModule.id === "pos" && (
              <div className="mt-6 rounded-2xl bg-secondary/60 p-4 border border-border">
                <p className="text-xs font-semibold text-foreground">Hardware & Vertical POS Support</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {posTypes.map((pt) => (
                    <div key={pt.name} className="rounded-xl bg-card p-2.5 border border-border/80">
                      <p className="text-xs font-semibold text-foreground">{pt.name}</p>
                      <p className="text-[10px] text-muted-foreground">{pt.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeModule.id === "crm" && (
              <div className="mt-6 rounded-2xl bg-secondary/60 p-4 border border-border">
                <p className="text-xs font-semibold text-foreground">Automations & AI Calling</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {crmFeatures.slice(0, 10).map((cf) => (
                    <Chip key={cf} tone="light">
                      {cf}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
              <span className="text-xs text-muted-foreground">Ready to test {activeModule.name}?</span>
              <Cta href="#cta" variant="primary" className="text-xs px-4 py-2">
                Configure Module <ArrowRight className="size-3.5" />
              </Cta>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
