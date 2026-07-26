/** Shared utilities for accounting components — import these to avoid duplication. */

/** Format a number as INR currency. */
export function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

/** Unified status badge style map used across accounting views. */
export const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-500",
  filed: "bg-emerald-500/10 text-emerald-500",
  approved: "bg-emerald-500/10 text-emerald-500",
  active: "bg-emerald-500/10 text-emerald-500",
  posted: "bg-emerald-500/10 text-emerald-500",
  completed: "bg-emerald-500/10 text-emerald-500",
  reconciled: "bg-emerald-500/10 text-emerald-500",
  pending: "bg-amber-500/10 text-amber-500",
  unpaid: "bg-amber-500/10 text-amber-500",
  draft: "bg-amber-500/10 text-amber-500",
  overdue: "bg-red-500/10 text-red-500",
  rejected: "bg-red-500/10 text-red-500",
  voided: "bg-red-500/10 text-red-500",
  reversed: "bg-muted text-muted-foreground",
  disposed: "bg-muted text-muted-foreground",
  partially_paid: "bg-blue-500/10 text-blue-500",
  "partially paid": "bg-blue-500/10 text-blue-500",
};

export function statusStyle(status: string): string {
  return STATUS_STYLES[status.toLowerCase()] ?? "bg-muted text-muted-foreground";
}

/** Type badge styles for tax entries. */
export const TYPE_STYLES: Record<string, string> = {
  gst: "text-indigo-500 bg-indigo-500/10",
  tds: "text-purple-500 bg-purple-500/10",
  vat: "text-cyan-500 bg-cyan-500/10",
};

export function typeStyle(type: string): string {
  return TYPE_STYLES[type.toLowerCase()] ?? "text-muted-foreground bg-muted";
}
