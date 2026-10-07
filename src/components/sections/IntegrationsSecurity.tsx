import { ShieldCheck, Lock, Key, Server, Cpu, Globe } from "lucide-react";
import { integrationCategories, securityFeatures } from "@/data/platform";
import { Section, SectionHeading, Reveal, Chip } from "@/components/site/primitives";

export function IntegrationsSecurity() {
  return (
    <Section id="security" tone="ink">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-20" />
      <Reveal>
        <SectionHeading
          tone="ink"
          eyebrow="Extensibility & Security"
          title={
            <>
              Enterprise-grade foundation. <span className="text-gradient-brand">Boundless connectivity.</span>
            </>
          }
          description="Built on zero-trust principles with multi-tenant data isolation, role-based governance, and pre-built API connectors for your essential stack."
        />
      </Reveal>

      {/* Grid: Integrations Ecosystem + Enterprise Security */}
      <div className="mt-12 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Integrations Grid */}
        <div className="surface-glass rounded-3xl p-6 sm:p-8 border border-ink-border">
          <div className="flex items-center justify-between border-b border-ink-border pb-4">
            <div>
              <h3 className="font-display text-lg font-bold text-ink-foreground">Integrated Ecosystem</h3>
              <p className="text-xs text-ink-muted">Native webhooks and plug-and-play connectors</p>
            </div>
            <Globe className="size-5 text-accent" />
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {integrationCategories.map((item) => (
              <div
                key={item.name}
                className="rounded-2xl border border-ink-border bg-ink-foreground/5 p-3.5 transition-all hover:bg-ink-foreground/10"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-xs font-semibold text-ink-foreground">{item.name}</h4>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      item.status === "Available"
                        ? "bg-accent/20 text-accent"
                        : "bg-ink-foreground/15 text-ink-muted"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.examples.map((ex) => (
                    <span key={ex} className="text-[10px] text-ink-muted bg-ink/60 px-1.5 py-0.5 rounded">
                      {ex}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security & Compliance Checklist */}
        <div className="surface-glass rounded-3xl p-6 sm:p-8 border border-ink-border flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 border-b border-ink-border pb-4">
              <span className="grid size-10 place-items-center rounded-xl bg-accent/20 text-accent">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-ink-foreground">Trust & Governance</h3>
                <p className="text-xs text-ink-muted">Bank-grade security protocols</p>
              </div>
            </div>

            <ul className="mt-6 space-y-3">
              {securityFeatures.map((sec) => (
                <li key={sec} className="flex items-center gap-3 text-xs text-ink-foreground">
                  <Lock className="size-3.5 text-accent shrink-0" />
                  <span>{sec}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 rounded-2xl bg-ink/80 p-4 border border-ink-border">
            <p className="text-xs font-semibold text-ink-foreground">Data Residency & Cloud</p>
            <p className="mt-1 text-[11px] text-ink-muted">
              Choose on-premise private clouds or dedicated tenant clusters with automated continuous backups and 99.99% SLA.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
