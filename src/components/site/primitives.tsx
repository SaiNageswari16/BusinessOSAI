import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-visible={visible}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn("reveal", className)}
    >
      {children}
    </div>
  );
}

export function Section({
  id,
  tone = "light",
  className,
  children,
}: {
  id?: string;
  tone?: "light" | "muted" | "ink";
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative overflow-hidden py-8 md:py-12",
        tone === "light" && "bg-background text-foreground",
        tone === "muted" && "bg-secondary/50 text-foreground",
        tone === "ink" && "bg-gradient-ink text-ink-foreground",
        className,
      )}
    >
      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6">{children}</div>
    </section>
  );
}

export function Eyebrow({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "ink" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.14em] uppercase",
        tone === "light"
          ? "border-primary/25 bg-primary/8 text-primary"
          : "border-ink-border bg-ink-foreground/8 text-accent",
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  tone = "light",
  align = "left",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  tone?: "light" | "ink";
  align?: "left" | "center";
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}>
      {eyebrow ? <Eyebrow tone={tone}>{eyebrow}</Eyebrow> : null}
      <h2
        className={cn(
          "mt-2 text-2xl leading-[1.1] font-semibold text-balance sm:text-3xl md:text-4xl",
          tone === "ink" ? "text-ink-foreground" : "text-foreground",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className={cn("mt-2 text-xs md:text-sm", tone === "ink" ? "text-ink-muted" : "text-muted-foreground")}>
          {description}
        </p>
      ) : null}
    </div>
  );
}

type CtaProps = {
  children: ReactNode;
  href: string;
  variant?: "primary" | "outline" | "ghost" | "onInk";
  className?: string;
};

export function Cta({ children, href, variant = "primary", className }: CtaProps) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
        variant === "primary" &&
          "bg-gradient-brand text-primary-foreground shadow-[var(--shadow-glow)] hover:-translate-y-0.5 hover:brightness-110",
        variant === "outline" &&
          "border border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary",
        variant === "ghost" && "text-foreground hover:bg-secondary",
        variant === "onInk" &&
          "border border-ink-border bg-ink-foreground/10 text-ink-foreground backdrop-blur hover:bg-ink-foreground/20",
        className,
      )}
    >
      {children}
    </a>
  );
}

export function Chip({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "ink" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
        tone === "light"
          ? "border-border bg-card text-muted-foreground"
          : "border-ink-border bg-ink-foreground/6 text-ink-muted",
      )}
    >
      {children}
    </span>
  );
}
