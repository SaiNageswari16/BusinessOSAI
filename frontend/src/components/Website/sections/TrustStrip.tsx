import { valueStrip } from "@/data/platform";
import { Reveal } from "@/components/site/primitives";

export function TrustStrip() {
  return (
    <section className="border-y border-border bg-background">
      <div className="mx-auto grid w-full max-w-7xl gap-px bg-border px-0 sm:grid-cols-2 lg:grid-cols-5">
        {valueStrip.map((item, i) => (
          <Reveal key={item.label} delay={i * 70} className="bg-background">
            <div className="h-full px-6 py-8">
              <p className="font-display text-base font-semibold">{item.label}</p>
              <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
              <span className="mt-4 block h-0.5 w-10 rounded-full bg-gradient-brand" />
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
