import { useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { industries, verticalDeepDives, type Industry } from "@/data/platform";
import { Section, SectionHeading, Reveal, Cta } from "@/components/site/primitives";
import { Icon } from "@/components/site/icon";
import { cn } from "@/lib/utils";

const defaultIndustry: Industry = industries[0] ?? {
  name: "Retail & Supermarkets",
  description: "Multi-branch billing, stock and loyalty in one counter-to-warehouse flow.",
  modules: ["POS", "Inventory", "Loyalty"],
  ai: "Demand forecast",
};

export function IndustrySolutions() {
  const [selectedIndustry, setSelectedIndustry] = useState<Industry>(defaultIndustry);
  const [activeVerticalIndex, setActiveVerticalIndex] = useState(0);

  return (
    <Section id="industries" tone="muted">
      <Reveal>
        <SectionHeading
          eyebrow="23+ Tailored Verticals"
          title={
            <>
              Engineered for your industry's <span className="text-gradient-brand">exact workflows.</span>
            </>
          }
          description="Whether you run a supermarket chain, a multi-brand cloud kitchen, gym franchise, or manufacturing facility, IOTRONICS adapts out of the box."
        />
      </Reveal>

      {/* Industry Explorer Tabs */}
      <div className="mt-10">
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none">
          {industries.map((ind) => (
            <button
              key={ind.name}
              type="button"
              onClick={() => setSelectedIndustry(ind)}
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-all shrink-0",
                selectedIndustry.name === ind.name
                  ? "bg-gradient-brand text-primary-foreground shadow-md"
                  : "bg-card text-muted-foreground border border-border hover:text-foreground hover:bg-secondary"
              )}
            >
              {ind.name}
            </button>
          ))}
        </div>

        {/* Selected Industry Card */}
        <Reveal delay={60} className="mt-6">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-md md:p-8">
            <div className="grid gap-6 md:grid-cols-[1.3fr_1fr] items-center">
              <div>
                <span className="text-xs font-semibold tracking-wider text-primary uppercase">Industry Blueprint</span>
                <h3 className="mt-1 font-display text-2xl font-bold text-foreground sm:text-3xl">{selectedIndustry.name}</h3>
                <p className="mt-3 text-base text-muted-foreground leading-relaxed">{selectedIndustry.description}</p>

                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">Bundled Modules:</span>
                  {selectedIndustry.modules.map((m) => (
                    <span
                      key={m}
                      className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-accent/25 bg-accent/5 p-5">
                <div className="flex items-center gap-2 text-accent">
                  <Sparkles className="size-4" />
                  <span className="text-xs font-semibold tracking-wider uppercase">Built-in AI Advantage</span>
                </div>
                <p className="mt-2 font-display text-lg font-semibold text-foreground">{selectedIndustry.ai}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Continuous machine learning models fine-tuned for {selectedIndustry.name.toLowerCase()} operational benchmarks.
                </p>
                <div className="mt-4">
                  <Cta href="#cta" variant="outline" className="w-full text-xs py-2 justify-center">
                    Get {selectedIndustry.name} Playbook <ArrowRight className="size-3.5" />
                  </Cta>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Deep-Dive Vertical Solution Showcase */}
      <div className="mt-16 md:mt-24">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto">
            <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">Specialized Suites</span>
            <h3 className="mt-3 font-display text-2xl font-bold text-foreground sm:text-3xl">
              Turnkey solutions for high-velocity operations
            </h3>
          </div>
        </Reveal>

        <div className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Vertical list switcher */}
          <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0">
            {verticalDeepDives.map((v, idx) => {
              const active = idx === activeVerticalIndex;
              return (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => setActiveVerticalIndex(idx)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl p-3.5 text-left transition-all whitespace-nowrap shrink-0",
                    active
                      ? "border border-primary bg-card shadow-md text-foreground"
                      : "border border-transparent hover:bg-card/60 text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-xl",
                      active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                    )}
                  >
                    <Icon name={v.icon} className="size-4.5" />
                  </span>
                  <span className="text-sm font-semibold">{v.name}</span>
                </button>
              );
            })}
          </div>

          {/* Vertical Details Container */}
          <div className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-md">
            {(() => {
              const cur = verticalDeepDives[activeVerticalIndex] ?? verticalDeepDives[0];
              if (!cur) return null;
              return (
                <div>
                  <div className="flex items-center gap-3 pb-5 border-b border-border">
                    <span className="grid size-11 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground">
                      <Icon name={cur.icon} className="size-5.5" />
                    </span>
                    <div>
                      <h4 className="font-display text-xl font-bold text-foreground">{cur.name} Operating Suite</h4>
                      <p className="text-xs text-muted-foreground">Complete feature matrix configured for immediate rollout</p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Included Sub-systems</p>
                    <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                      {cur.features.map((feat) => (
                        <div
                          key={feat}
                          className="flex items-center gap-2 rounded-xl bg-secondary/70 px-3 py-2.5 text-xs font-medium text-foreground border border-border/70"
                        >
                          <span className="size-1.5 rounded-full bg-primary" />
                          <span className="truncate">{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl bg-gradient-brand/5 p-4 border border-primary/20">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Need custom integrations for {cur.name}?</p>
                      <p className="text-xs text-muted-foreground">Our team migrates existing legacy databases with zero downtime.</p>
                    </div>
                    <Cta href="#cta" variant="primary" className="text-xs py-2 px-4 whitespace-nowrap">
                      Request Solution Demo
                    </Cta>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </Section>
  );
}
