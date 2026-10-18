import { cn } from "@/lib/utils";

export type Tone = "success" | "warning" | "critical" | "info" | "neutral" | "ai";

const toneClass: Record<Tone, string> = {
  success: "bg-success/12 text-success ring-success/25",
  warning: "bg-warning/15 text-warning ring-warning/30",
  critical: "bg-critical/12 text-critical ring-critical/25",
  info: "bg-info/12 text-info ring-info/25",
  neutral: "bg-muted text-muted-foreground ring-border",
  ai: "bg-ai/12 text-ai ring-ai/25",
};

const statusTone: Record<string, Tone> = {
  New: "info",
  Preparing: "warning",
  Ready: "success",
  Served: "neutral",
  Completed: "success",
  Cancelled: "critical",
  Available: "success",
  Occupied: "info",
  Reserved: "ai",
  Cleaning: "neutral",
  Billing: "warning",
  Confirmed: "success",
  Pending: "warning",
  Seated: "info",
  "No-show": "critical",
  "On shift": "success",
  Break: "warning",
  Off: "neutral",
  Leave: "critical",
  Critical: "critical",
  Low: "warning",
  OK: "success",
};

export function StatusBadge({
  status,
  tone,
  className,
}: {
  status: string;
  tone?: Tone;
  className?: string;
}) {
  const t = tone ?? statusTone[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap",
        toneClass[t],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
