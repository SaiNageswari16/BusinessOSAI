import { useState } from "react";
import { howItWorks, useCases } from "@/data/platform";
import { Section, SectionHeading, Reveal, Cta } from "@/components/site/primitives";
import { ArrowRight, ChevronRight, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

export function HowItWorksSteps() {
  const [selectedUseCaseIdx, setSelectedUseCaseIdx] = useState(0);

  return (
    <Section id="how-it-works" tone="light">
      <Reveal>
        <SectionHeading
          eyebrow="Implementation Roadmap"
          title={
            <>
              Up and running in days, <span className="text-gradient-brand">not quarters.</span>
            </>
          }
          description="A frictionless onboarding framework with automated legacy data ingestion, pre-configured roles, and guided staff workflows."
        />
      </Reveal>

      {/* 4 Steps */}
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {howItWorks.map((step, idx) => (
          <Reveal key={step.step} delay={idx * 60}>
            <div className="h-full rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between transition-all hover:border-primary/40 hover:shadow-md">
              <div>
                <span className="font-display text-3xl font-extrabold text-primary/30">{step.step}</span>
                <h3 className="mt-3 font-display text-base font-bold text-foreground">{step.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
              </div>
              <div className="mt-6 flex items-center gap-1 text-[11px] font-semibold text-primary">
                <span>Phase {idx + 1}</span>
                <ChevronRight className="size-3" />
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Live Operational Flow Showcase */}
      <div className="mt-16 rounded-3xl border border-border bg-secondary/50 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Live Flow Architecture
            </span>
            <h4 className="mt-2 font-display text-xl font-bold text-foreground">
              End-to-end data lifecycle by business model
            </h4>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {useCases.map((uc, i) => (
              <button
                key={uc.name}
                type="button"
                onClick={() => setSelectedUseCaseIdx(i)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-all",
                  selectedUseCaseIdx === i
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card text-muted-foreground border border-border hover:bg-secondary hover:text-foreground"
                )}
              >
                {uc.name}
              </button>
            ))}
          </div>
        </div>

        {/* Pipeline steps visualization */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {(useCases[selectedUseCaseIdx]?.flow ?? []).map((node, idx, arr) => (
            <div key={node} className="flex items-center gap-3">
              <div className="rounded-2xl border border-border bg-card px-4 py-3 text-center shadow-sm">
                <span className="text-[10px] font-bold text-primary uppercase">Stage 0{idx + 1}</span>
                <p className="font-display text-sm font-bold text-foreground">{node}</p>
              </div>
              {idx < arr.length - 1 && <ArrowRight className="size-4 text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
