import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { pricingPlans } from "@/data/platform";
import { Section, SectionHeading, Reveal, Cta } from "@/components/site/primitives";
import { cn } from "@/lib/utils";

export function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");

  return (
    <Section id="pricing" tone="muted">
      <Reveal>
        <SectionHeading
          align="center"
          eyebrow="Predictable Investment"
          title={
            <>
              Scale transparently. <span className="text-gradient-brand">Pay as you expand.</span>
            </>
          }
          description="Every plan includes core ERP infrastructure, real-time sync, and enterprise reliability. Upgrade branches or modules whenever you need."
        />
      </Reveal>

      {/* Billing Switcher */}
      <div className="mt-8 flex justify-center">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
              billingCycle === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("annual")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
              billingCycle === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            Annual
            <span className="rounded-full bg-accent/20 px-1.5 py-0.2 text-[10px] text-accent font-bold">20% off</span>
          </button>
        </div>
      </div>

      {/* 4 Tier Cards */}
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {pricingPlans.map((plan, idx) => (
          <Reveal key={plan.name} delay={idx * 50}>
            <div
              className={cn(
                "relative flex h-full flex-col justify-between rounded-3xl p-6 transition-all duration-200",
                plan.highlight
                  ? "border-2 border-primary bg-card shadow-xl ring-4 ring-primary/10"
                  : "border border-border bg-card shadow-sm hover:border-primary/40 hover:shadow-md"
              )}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-brand px-3 py-0.5 text-[10px] font-bold tracking-wider text-primary-foreground uppercase shadow-sm">
                  Most Popular
                </div>
              )}

              <div>
                <h3 className="font-display text-lg font-bold text-foreground">{plan.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground min-h-[32px]">{plan.tagline}</p>

                <div className="mt-5 border-t border-border pt-4">
                  <span className="font-display text-2xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-xs text-muted-foreground ml-1">
                    {plan.price === "Custom" || plan.price.includes("Sales") ? "tailored to scale" : "/ month"}
                  </span>
                </div>

                <ul className="mt-6 space-y-2.5 border-t border-border pt-4">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2 text-xs text-foreground">
                      <Check className="size-3.5 text-primary shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8">
                <Cta
                  href="#cta"
                  variant={plan.highlight ? "primary" : "outline"}
                  className="w-full text-xs py-2.5 justify-center"
                >
                  {plan.cta}
                </Cta>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
