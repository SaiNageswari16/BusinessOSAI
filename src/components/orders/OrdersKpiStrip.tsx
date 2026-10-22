import {
  ArrowUp,
  Bike,
  CheckCircle2,
  ClipboardList,
  Clock,
  ShoppingBag,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";

import type { OrdersKpiSummary } from "@/components/orders/orders-utils";
import type { OrderType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface OrdersKpiStripProps {
  summary: OrdersKpiSummary;
  activeTypeFilter: "all" | OrderType;
  activeStatusGroup: "all" | "pending" | "completed" | "cancelled";
  onSelectTypeFilter: (type: "all" | OrderType) => void;
  onSelectStatusGroup: (group: "all" | "pending" | "completed" | "cancelled") => void;
  onResetAll: () => void;
}

export function OrdersKpiStrip({
  summary,
  activeTypeFilter,
  activeStatusGroup,
  onSelectTypeFilter,
  onSelectStatusGroup,
  onResetAll,
}: OrdersKpiStripProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
      {/* 1. Total Orders */}
      <button
        type="button"
        onClick={onResetAll}
        className={cn(
          "flex items-center justify-between rounded-2xl border p-3 text-left transition-all shadow-2xs",
          activeTypeFilter === "all" && activeStatusGroup === "all"
            ? "border-[#93C5FD] bg-[#EBF3FF]/80 ring-1 ring-[#3B82F6]/20"
            : "border-[#E1E9F4] bg-[#F4F8FF] hover:border-blue-300",
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D8E8FF] text-[#0866F5]">
            <ClipboardList className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#475569]">Total Orders</div>
            <div className="mt-0.5 text-[22px] font-extrabold leading-none text-[#102344] tabular">
              {summary.total}
            </div>
            <div className="mt-1 text-[10px] font-medium text-[#64748B]">Today</div>
          </div>
        </div>
        <div className="inline-flex items-center gap-0.5 self-center text-[11px] font-bold text-[#059669] tabular">
          <ArrowUp className="h-3 w-3 stroke-[2.5]" />
          <span>12%</span>
        </div>
      </button>

      {/* 2. Dine In */}
      <button
        type="button"
        onClick={() => onSelectTypeFilter(activeTypeFilter === "dine-in" ? "all" : "dine-in")}
        className={cn(
          "flex items-end justify-between rounded-2xl border p-3 text-left transition-all shadow-2xs",
          activeTypeFilter === "dine-in"
            ? "border-[#059669] bg-[#ECFDF5] ring-1 ring-[#059669]/20"
            : "border-[#E1E9F4] bg-white hover:border-emerald-300",
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#DCFCE7] text-[#059669]">
            <UtensilsCrossed className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#475569]">Dine In</div>
            <div className="mt-0.5 text-[22px] font-extrabold leading-none text-[#102344] tabular">
              {summary.dineIn}
            </div>
          </div>
        </div>
        <span className="text-[11px] font-bold text-[#059669] tabular">{summary.dineInPct}%</span>
      </button>

      {/* 3. Takeaway */}
      <button
        type="button"
        onClick={() => onSelectTypeFilter(activeTypeFilter === "takeaway" ? "all" : "takeaway")}
        className={cn(
          "flex items-end justify-between rounded-2xl border p-3 text-left transition-all shadow-2xs",
          activeTypeFilter === "takeaway"
            ? "border-[#D97706] bg-[#FFFBEB] ring-1 ring-[#D97706]/20"
            : "border-[#FDE68A]/60 bg-[#FFFDF7] hover:border-amber-300",
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#D97706]">
            <ShoppingBag className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#475569]">Takeaway</div>
            <div className="mt-0.5 text-[22px] font-extrabold leading-none text-[#102344] tabular">
              {summary.takeaway}
            </div>
          </div>
        </div>
        <span className="text-[11px] font-bold text-[#D97706] tabular">{summary.takeawayPct}%</span>
      </button>

      {/* 4. Delivery */}
      <button
        type="button"
        onClick={() => onSelectTypeFilter(activeTypeFilter === "delivery" ? "all" : "delivery")}
        className={cn(
          "flex items-end justify-between rounded-2xl border p-3 text-left transition-all shadow-2xs",
          activeTypeFilter === "delivery"
            ? "border-[#7C3AED] bg-[#F3E8FF] ring-1 ring-[#7C3AED]/20"
            : "border-[#E9D5FF]/70 bg-[#FCF9FF] hover:border-purple-300",
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EDE9FE] text-[#7C3AED]">
            <Bike className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#475569]">Delivery</div>
            <div className="mt-0.5 text-[22px] font-extrabold leading-none text-[#102344] tabular">
              {summary.delivery}
            </div>
          </div>
        </div>
        <span className="text-[11px] font-bold text-[#7C3AED] tabular">{summary.deliveryPct}%</span>
      </button>

      {/* 5. Pending */}
      <button
        type="button"
        onClick={() => onSelectStatusGroup(activeStatusGroup === "pending" ? "all" : "pending")}
        className={cn(
          "flex items-end justify-between rounded-2xl border p-3 text-left transition-all shadow-2xs",
          activeStatusGroup === "pending"
            ? "border-[#D97706] bg-[#FFFBEB] ring-1 ring-[#D97706]/20"
            : "border-[#FDE68A]/60 bg-[#FFFDF7] hover:border-amber-300",
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#D97706]">
            <Clock className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#475569]">Pending</div>
            <div className="mt-0.5 text-[22px] font-extrabold leading-none text-[#102344] tabular">
              {summary.pending}
            </div>
          </div>
        </div>
        <span className="text-[11px] font-bold text-[#D97706] tabular">{summary.pendingPct}%</span>
      </button>

      {/* 6. Completed */}
      <button
        type="button"
        onClick={() => onSelectStatusGroup(activeStatusGroup === "completed" ? "all" : "completed")}
        className={cn(
          "flex items-end justify-between rounded-2xl border p-3 text-left transition-all shadow-2xs",
          activeStatusGroup === "completed"
            ? "border-[#059669] bg-[#ECFDF5] ring-1 ring-[#059669]/20"
            : "border-[#BBF7D0]/60 bg-[#F7FEFA] hover:border-emerald-300",
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#DCFCE7] text-[#059669]">
            <CheckCircle2 className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#475569]">Completed</div>
            <div className="mt-0.5 text-[22px] font-extrabold leading-none text-[#102344] tabular">
              {summary.completed}
            </div>
          </div>
        </div>
        <span className="text-[11px] font-bold text-[#059669] tabular">
          {summary.completedPct}%
        </span>
      </button>

      {/* 7. Cancelled */}
      <button
        type="button"
        onClick={() => onSelectStatusGroup(activeStatusGroup === "cancelled" ? "all" : "cancelled")}
        className={cn(
          "flex items-end justify-between rounded-2xl border p-3 text-left transition-all shadow-2xs",
          activeStatusGroup === "cancelled"
            ? "border-[#DC2626] bg-[#FEF2F2] ring-1 ring-[#DC2626]/20"
            : "border-[#FECACA]/60 bg-[#FFF8F8] hover:border-red-300",
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FEE2E2] text-[#DC2626]">
            <XCircle className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#475569]">Cancelled</div>
            <div className="mt-0.5 text-[22px] font-extrabold leading-none text-[#102344] tabular">
              {summary.cancelled}
            </div>
          </div>
        </div>
        <span className="text-[11px] font-bold text-[#DC2626] tabular">
          {summary.cancelledPct}%
        </span>
      </button>
    </div>
  );
}
