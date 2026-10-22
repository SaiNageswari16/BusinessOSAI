import { CalendarCheck2, ReceiptText, Users } from "lucide-react";
import { tableCounts } from "@/lib/calc";
import type { DiningTable, TableStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TABLE_STATUS_CONFIG } from "./operations-utils";

interface TableSummaryCardsProps {
  tables: DiningTable[];
  activeStatuses: Record<TableStatus, boolean>;
  onSelectStatusCard: (status: TableStatus | "all") => void;
}

function TableStoolIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 7h16" />
      <path d="M6 7v11" />
      <path d="M18 7v11" />
      <path d="M6 12h12" />
      <path d="M9 4h6" />
    </svg>
  );
}

function CleaningBroomIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m13 11 7-7" />
      <path d="M5 19c-1.5-1.5-2-4 0-6l4-4 6 6-4 4c-2 2-4.5 1.5-6 0Z" />
      <path d="m8 16-3 3" />
      <path d="M18 13v4" />
      <path d="M16 15h4" />
    </svg>
  );
}

export function TableSummaryCards({
  tables,
  activeStatuses,
  onSelectStatusCard,
}: TableSummaryCardsProps) {
  const counts = tableCounts(tables);
  const total = tables.length;
  const distinctAreasCount = new Set(tables.map((t) => t.area)).size || 3;

  const pct = (count: number) => (total > 0 ? Math.round((count / total) * 100) : 0);

  const allStatusesActive = Object.values(activeStatuses).every(Boolean);

  const statusCards: {
    status: TableStatus;
    count: number;
    percentage: number;
    icon: React.ReactNode;
  }[] = [
    {
      status: "available",
      count: counts.available,
      percentage: pct(counts.available),
      icon: <TableStoolIcon className="h-5 w-5" />,
    },
    {
      status: "occupied",
      count: counts.occupied,
      percentage: pct(counts.occupied),
      icon: <Users className="h-5 w-5" />,
    },
    {
      status: "reserved",
      count: counts.reserved,
      percentage: pct(counts.reserved),
      icon: <CalendarCheck2 className="h-5 w-5" />,
    },
    {
      status: "billing",
      count: counts.billing,
      percentage: pct(counts.billing),
      icon: <ReceiptText className="h-5 w-5" />,
    },
    {
      status: "cleaning",
      count: counts.cleaning,
      percentage: pct(counts.cleaning),
      icon: <CleaningBroomIcon className="h-5 w-5" />,
    },
  ];

  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
      role="region"
      aria-label="Table Summary KPIs"
    >
      {/* 1. Total Tables Card */}
      <button
        type="button"
        onClick={() => onSelectStatusCard("all")}
        className={cn(
          "group relative flex items-center justify-between overflow-hidden rounded-2xl border p-4 text-left transition-all",
          "bg-gradient-to-br from-[#FFFDF9] to-[#FEF7EC] border-[#F3E5CA] shadow-[0_2px_10px_rgba(15,23,42,0.03)] hover:shadow-md",
          "dark:from-slate-900/80 dark:to-amber-950/20 dark:border-amber-800/35",
          !allStatusesActive && "opacity-85 hover:opacity-100",
        )}
      >
        <div className="flex items-center gap-3.5 z-10">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FDEFD9] text-[#B45309] dark:bg-amber-500/20 dark:text-amber-300">
            <TableStoolIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Total Tables
            </div>
            <div className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular">
              {total}
            </div>
            <div className="text-[11px] font-medium text-slate-400 dark:text-slate-400">
              {distinctAreasCount} areas
            </div>
          </div>
        </div>

        {/* Decorative dining chair silhouette on right */}
        <svg
          viewBox="0 0 48 48"
          fill="currentColor"
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 bottom-1.5 h-12 w-12 text-[#E5CFA8]/45 dark:text-amber-500/10"
        >
          <rect x="13" y="8" width="22" height="14" rx="3" />
          <rect x="10" y="24" width="28" height="6" rx="2" />
          <rect x="13" y="30" width="3.5" height="12" rx="1.5" />
          <rect x="31.5" y="30" width="3.5" height="12" rx="1.5" />
        </svg>
      </button>

      {/* 2-6. Status Summary Cards */}
      {statusCards.map(({ status, count, percentage, icon }) => {
        const cfg = TABLE_STATUS_CONFIG[status];
        const isActive = activeStatuses[status];
        const isSolo =
          isActive &&
          Object.entries(activeStatuses)
            .filter(([k]) => k !== status)
            .every(([, v]) => !v);

        return (
          <button
            key={status}
            type="button"
            onClick={() => onSelectStatusCard(status)}
            className={cn(
              "group relative flex items-center justify-between overflow-hidden rounded-2xl border p-4 text-left transition-all shadow-[0_2px_10px_rgba(15,23,42,0.03)] hover:shadow-md",
              cfg.kpiCardBg,
              !isActive && "opacity-55 grayscale-[35%] hover:opacity-85",
              isSolo && "ring-2 ring-primary ring-offset-2 ring-offset-background",
            )}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
                  cfg.kpiIconBg,
                )}
              >
                {icon}
              </div>
              <div>
                <div className={cn("text-xs font-semibold", cfg.kpiText)}>{cfg.label}</div>
                <div className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular">
                  {count}
                </div>
              </div>
            </div>

            <div className="self-end text-right">
              <span className={cn("text-xs font-bold tabular", cfg.kpiText)}>{percentage}%</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
