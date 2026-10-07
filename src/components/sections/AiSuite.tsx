import { useState } from "react";
import { Sparkles, Bot, Send, BrainCircuit, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import { aiCapabilities } from "@/data/platform";
import { Section, SectionHeading, Reveal, Cta } from "@/components/site/primitives";
import { cn } from "@/lib/utils";

const samplePrompts = [
  {
    question: "Which 5 products have high stock-out risk this weekend?",
    answer: "Based on historical weekend sales velocity and supplier lead times: 1) Almond Milk 1L (1.2 days stock left), 2) Sourdough Bread (0.8 days), 3) Organic Eggs 12pk (1.5 days). Auto-drafted PO #PO-8821 for quick approval.",
    category: "Inventory AI",
  },
  {
    question: "Summarize today's sales performance across all 6 outlets.",
    answer: "Total Gross Revenue: ₹5,48,200 (+14% vs last Tuesday). Highest performing branch: Downtown Flagship (₹1,84,000). Top category: Ready-to-eat bakery. Average checkout basket size increased from ₹410 to ₹495.",
    category: "Executive Brief",
  },
  {
    question: "Detect any pricing anomalies or leaked margin in current orders.",
    answer: "Flagged 2 orders in Outlet #3 where manual cashier discounts exceeded the 15% supervisor threshold. Staff ID: #4092. Total margin impact: ₹1,420. Audit log updated.",
    category: "Risk & Fraud",
  },
];

export function AiSuite() {
  const [activePromptIdx, setActivePromptIdx] = useState(0);
  const [customInput, setCustomInput] = useState("");
  const [customResponse, setCustomResponse] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    setIsSimulating(true);
    setCustomResponse(null);
    setTimeout(() => {
      setCustomResponse(
        `AI Intelligence analysis for "${customInput}": Correlated 14,200 data points across POS, CRM, and Inventory. Recommendation generated with 98.4% confidence score.`
      );
      setIsSimulating(false);
    }, 600);
  };

  return (
    <Section id="ai" tone="ink">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-20" />
      <Reveal>
        <SectionHeading
          tone="ink"
          eyebrow="Intelligence Engine"
          title={
            <>
              Not just analytics. <span className="text-gradient-brand">An autonomous AI copilot</span> for your entire business.
            </>
          }
          description="IOTRONICS AI observes real-time transactions, identifies leaks, drafts purchase orders, and guides your staff to take the highest ROI actions daily."
        />
      </Reveal>

      {/* Interactive AI Assistant Terminal / Demo */}
      <div className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] items-start">
        {/* Terminal Chat Box */}
        <Reveal delay={80}>
          <div className="surface-glass rounded-3xl p-5 sm:p-7 shadow-2xl border border-ink-border">
            <div className="flex items-center justify-between border-b border-ink-border pb-4">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
                  <Bot className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-base font-semibold text-ink-foreground">IOTRONICS Copilot</h3>
                  <p className="text-[11px] text-ink-muted">Connected to Live Master DB</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-2.5 py-1 text-[11px] font-semibold text-accent border border-accent/30">
                <BrainCircuit className="size-3" /> Ready
              </span>
            </div>

            {/* Quick Prompt Selector */}
            <div className="mt-4 flex flex-wrap gap-2">
              {samplePrompts.map((p, idx) => (
                <button
                  key={p.category}
                  type="button"
                  onClick={() => {
                    setActivePromptIdx(idx);
                    setCustomResponse(null);
                  }}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-all",
                    activePromptIdx === idx && !customResponse
                      ? "bg-accent text-accent-foreground font-semibold"
                      : "bg-ink-foreground/10 text-ink-muted hover:bg-ink-foreground/20 hover:text-ink-foreground"
                  )}
                >
                  {p.category}
                </button>
              ))}
            </div>

            {/* Conversation view */}
            <div className="mt-5 space-y-4 rounded-2xl bg-ink/70 p-4 border border-ink-border">
              {/* Question */}
              <div className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-ink-foreground/10 text-xs font-bold text-ink-foreground">
                  U
                </span>
                <div className="rounded-2xl rounded-tl-none bg-ink-foreground/10 px-4 py-2.5 text-xs text-ink-foreground">
                  {customResponse ? customInput : (samplePrompts[activePromptIdx]?.question ?? "")}
                </div>
              </div>

              {/* Copilot Answer */}
              <div className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-gradient-brand text-xs font-bold text-primary-foreground">
                  <Sparkles className="size-3.5" />
                </span>
                <div className="rounded-2xl rounded-tl-none bg-primary/20 border border-primary/30 px-4 py-3 text-xs leading-relaxed text-ink-foreground">
                  {isSimulating ? (
                    <div className="flex items-center gap-2 text-ink-muted">
                      <span className="size-1.5 animate-bounce rounded-full bg-accent" />
                      <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:0.2s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:0.4s]" />
                      <span>Synthesizing cross-module insights...</span>
                    </div>
                  ) : customResponse ? (
                    customResponse
                  ) : (
                    samplePrompts[activePromptIdx]?.answer ?? ""
                  )}
                </div>
              </div>
            </div>

            {/* Interactive Query Input */}
            <form onSubmit={handleCustomSubmit} className="mt-4 flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Ask anything (e.g. 'Predict Q4 margin for Outlet 2')..."
                className="flex-1 rounded-full border border-ink-border bg-ink-foreground/5 px-4 py-2.5 text-xs text-ink-foreground placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="submit"
                disabled={isSimulating || !customInput.trim()}
                className="grid size-9 place-items-center rounded-full bg-accent text-accent-foreground transition-transform hover:scale-105 disabled:opacity-40"
              >
                <Send className="size-3.5" />
              </button>
            </form>
          </div>
        </Reveal>

        {/* AI Capabilities Cards */}
        <div className="space-y-4">
          <Reveal delay={100}>
            <div className="surface-glass rounded-2xl p-5 border border-ink-border">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-accent/20 text-accent">
                  <TrendingUp className="size-4.5" />
                </span>
                <div>
                  <h4 className="font-display text-sm font-semibold text-ink-foreground">Predictive Demand & Reordering</h4>
                  <p className="text-xs text-ink-muted">Calculates seasonal swings, lead times, and weather trends to auto-balance stock.</p>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={140}>
            <div className="surface-glass rounded-2xl p-5 border border-ink-border">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-destructive/20 text-destructive">
                  <AlertTriangle className="size-4.5" />
                </span>
                <div>
                  <h4 className="font-display text-sm font-semibold text-ink-foreground">Continuous Anomaly & Leak Detection</h4>
                  <p className="text-xs text-ink-muted">Flags unauthorized discounts, pilferage risks, and abnormal supplier invoice price hikes.</p>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={180}>
            <div className="surface-glass rounded-2xl p-5 border border-ink-border">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-primary-glow/20 text-primary-glow">
                  <Lightbulb className="size-4.5" />
                </span>
                <div>
                  <h4 className="font-display text-sm font-semibold text-ink-foreground">Smart Churn & Upsell Scoring</h4>
                  <p className="text-xs text-ink-muted">Identifies dormant VIP customers and triggers personalized WhatsApp nudges.</p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* AI Capabilities Cloud */}
          <div className="pt-2">
            <p className="text-xs font-semibold tracking-wider text-ink-muted uppercase">Included AI Micro-Services</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {aiCapabilities.map((cap) => (
                <span
                  key={cap}
                  className="rounded-lg border border-ink-border bg-ink-foreground/5 px-2.5 py-1 text-[11px] font-medium text-ink-muted"
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
