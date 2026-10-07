import { useState } from "react";
import { resources } from "@/data/platform";
import { Section, SectionHeading, Reveal } from "@/components/site/primitives";
import { ChevronDown, BookOpen, HelpCircle, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Can I start with only 1 or 2 modules (e.g. POS and Inventory) and expand later?",
    a: "Yes, completely modular. You can launch with just POS & Inventory today, and activate Marketplace, CRM, HRMS, or Accounting whenever your operations scale with zero data re-entry.",
  },
  {
    q: "How does the AI engine handle offline branch operations?",
    a: "Our POS and localized sync clients work fully offline. Transactions queue locally and automatically sync back with conflict resolution once internet connectivity resumes.",
  },
  {
    q: "How long does migration from legacy software (Tally, Marg, SAP, Zoho) take?",
    a: "Most businesses transition within 48 to 72 hours using our automated CSV/API migration pipelines for product masters, customer records, and opening balances.",
  },
  {
    q: "Is data isolation guaranteed for multi-tenant / franchise deployments?",
    a: "Yes. Every enterprise client benefits from cryptographic schema isolation, role-based branch security partitions, and audit-logged data access.",
  },
];

export function ResourcesFaq() {
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  return (
    <Section id="resources" tone="light">
      <Reveal>
        <SectionHeading
          eyebrow="Knowledge Base & Support"
          title={
            <>
              Resources to help you <span className="text-gradient-brand">build and scale.</span>
            </>
          }
          description="Comprehensive documentation, industry playbooks, API reference, and answers to common rollout questions."
        />
      </Reveal>

      {/* Grid: Resource Cards + FAQs */}
      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        {/* Resource Cards */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="size-4 text-primary" />
            <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">Guides & Developer Tools</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {resources.map((res, i) => (
              <Reveal key={res.name} delay={i * 30}>
                <a
                  href="#cta"
                  className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-display text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {res.name}
                      </h4>
                      <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">{res.detail}</p>
                  </div>
                </a>
              </Reveal>
            ))}
          </div>
        </div>

        {/* FAQs Accordion */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="size-4 text-primary" />
            <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">Frequently Asked Questions</h3>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div
                  key={faq.q}
                  className="rounded-2xl border border-border bg-card transition-all overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between p-4 text-left font-display text-sm font-semibold text-foreground"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={cn("size-4 text-muted-foreground transition-transform duration-200 shrink-0 ml-2", isOpen && "rotate-180 text-primary")}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-xs leading-relaxed text-muted-foreground border-t border-border/60 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Section>
  );
}
