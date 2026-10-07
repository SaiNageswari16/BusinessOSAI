import { useState } from "react";
import { Sparkles, CheckCircle2, Send, ShieldCheck, ArrowRight } from "lucide-react";
import { Section, Reveal } from "@/components/site/primitives";

export function LeadCta() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    industry: "Retail & Supermarket",
    branches: "1-3",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <Section id="cta" tone="ink">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-25" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-halo" />

      <div className="relative grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
        {/* Left Value Proposition */}
        <Reveal>
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-ink-border bg-ink-foreground/8 px-3.5 py-1.5 text-xs font-semibold tracking-[0.14em] text-accent uppercase">
              <Sparkles className="size-3.5" /> Book an Enterprise Demo
            </span>

            <h2 className="mt-6 font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl text-ink-foreground">
              Ready to unify your business on <span className="text-gradient-brand">IOTRONICS?</span>
            </h2>

            <p className="mt-5 max-w-lg text-sm md:text-base text-ink-muted leading-relaxed">
              Get a tailored walkthrough with a solutions architect. We will model your branches, workflows, and catalog during a live 30-minute session.
            </p>

            <div className="mt-8 space-y-3">
              {[
                "Zero obligation custom workflow simulation",
                "Complimentary legacy software data migration audit",
                "Full access sandbox instance for your operations team",
              ].map((point) => (
                <div key={point} className="flex items-center gap-2.5 text-xs text-ink-foreground">
                  <CheckCircle2 className="size-4 text-accent shrink-0" />
                  <span>{point}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-2 text-xs text-ink-muted">
              <ShieldCheck className="size-4 text-accent" />
              <span>ISO 27001 & SOC-2 compliance readiness. NDA guaranteed.</span>
            </div>
          </div>
        </Reveal>

        {/* Right Form Card */}
        <Reveal delay={100}>
          <div className="surface-glass rounded-3xl p-6 sm:p-8 border border-ink-border shadow-2xl">
            {submitted ? (
              <div className="text-center py-10">
                <span className="grid size-14 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground mx-auto">
                  <CheckCircle2 className="size-8" />
                </span>
                <h3 className="mt-4 font-display text-xl font-bold text-ink-foreground">Demo Scheduled!</h3>
                <p className="mt-2 text-xs text-ink-muted max-w-xs mx-auto">
                  Thank you, <span className="font-semibold text-ink-foreground">{formData.name || "there"}</span>. A product specialist will contact you at {formData.email || "your email"} within 2 business hours.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="mt-6 rounded-full border border-ink-border px-4 py-2 text-xs font-semibold text-ink-foreground hover:bg-ink-foreground/10"
                >
                  Book another session
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-ink-muted uppercase">Your Name</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-ink-border bg-ink-foreground/5 px-3 py-2.5 text-xs text-ink-foreground placeholder:text-ink-muted focus:border-accent focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-ink-muted uppercase">Work Email</label>
                    <input
                      required
                      type="email"
                      placeholder="rahul@company.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-ink-border bg-ink-foreground/5 px-3 py-2.5 text-xs text-ink-foreground placeholder:text-ink-muted focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-ink-muted uppercase">Phone / WhatsApp</label>
                    <input
                      required
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-ink-border bg-ink-foreground/5 px-3 py-2.5 text-xs text-ink-foreground placeholder:text-ink-muted focus:border-accent focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-ink-muted uppercase">Company Name</label>
                    <input
                      required
                      type="text"
                      placeholder="Retail Corp Ltd"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-ink-border bg-ink-foreground/5 px-3 py-2.5 text-xs text-ink-foreground placeholder:text-ink-muted focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-ink-muted uppercase">Industry</label>
                    <select
                      value={formData.industry}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-ink-border bg-ink/90 px-3 py-2.5 text-xs text-ink-foreground focus:border-accent focus:outline-none"
                    >
                      <option>Retail & Supermarket</option>
                      <option>Restaurant & Food</option>
                      <option>Manufacturing</option>
                      <option>Wholesale & Distribution</option>
                      <option>Gym & Fitness</option>
                      <option>Salon & Spa</option>
                      <option>Other Vertical</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-ink-muted uppercase">Active Branches</label>
                    <select
                      value={formData.branches}
                      onChange={(e) => setFormData({ ...formData, branches: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-ink-border bg-ink/90 px-3 py-2.5 text-xs text-ink-foreground focus:border-accent focus:outline-none"
                    >
                      <option>1 branch</option>
                      <option>2 - 5 branches</option>
                      <option>6 - 20 branches</option>
                      <option>20+ branches</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand py-3 text-xs font-bold text-primary-foreground shadow-[var(--shadow-glow)] transition-all hover:brightness-110"
                >
                  <Send className="size-3.5" /> Request Personalized Demo <ArrowRight className="size-3.5" />
                </button>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
