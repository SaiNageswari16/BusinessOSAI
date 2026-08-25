import { type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  noCard?: boolean;
}

export function Section({ title, subtitle, action, children, className, noCard }: SectionProps) {
  const inner = (
    <>
      <div className="flex items-end justify-between mb-4 gap-3">
        <div>
          <h2 className="text-base font-bold font-heading tracking-tight text-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </>
  );
  if (noCard) return <section className={className}>{inner}</section>;
  return <Card className={cn("p-6 rounded-2xl border border-border/80 bg-card shadow-xs hover:shadow-sm transition-all", className)}>{inner}</Card>;
}
