import { LayoutGrid, Search, Table2, X } from "lucide-react";

import type { DisplayKitchenStatus, DisplayOrderStatus } from "@/components/orders/orders-utils";
import type { OrderType, PaymentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export type DateRangePreset = "all" | "today" | "yesterday" | "7days";

interface OrdersFilterBarProps {
  search: string;
  typeFilter: "all" | OrderType;
  orderStatusFilter: "all" | DisplayOrderStatus;
  paymentFilter: "all" | PaymentStatus;
  kitchenStatusFilter: "all" | DisplayKitchenStatus;
  dateRange: DateRangePreset;
  viewMode: "table" | "cards";
  onChangeSearch: (q: string) => void;
  onChangeTypeFilter: (v: "all" | OrderType) => void;
  onChangeOrderStatusFilter: (v: "all" | DisplayOrderStatus) => void;
  onChangePaymentFilter: (v: "all" | PaymentStatus) => void;
  onChangeKitchenStatusFilter: (v: "all" | DisplayKitchenStatus) => void;
  onChangeDateRange: (v: DateRangePreset) => void;
  onChangeViewMode: (v: "table" | "cards") => void;
  onReset: () => void;
}

export function OrdersFilterBar({
  search,
  typeFilter,
  orderStatusFilter,
  paymentFilter,
  kitchenStatusFilter,
  dateRange,
  viewMode,
  onChangeSearch,
  onChangeTypeFilter,
  onChangeOrderStatusFilter,
  onChangePaymentFilter,
  onChangeKitchenStatusFilter,
  onChangeDateRange,
  onChangeViewMode,
  onReset,
}: OrdersFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E1E9F4] bg-white p-2.5 shadow-2xs">
      {/* Search Input */}
      <div className="relative min-w-[210px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
        <input
          type="text"
          value={search}
          onChange={(e) => onChangeSearch(e.target.value)}
          placeholder="Search by Order ID, customer, table, item..."
          className="h-9 w-full rounded-xl border border-[#E2E8F0] bg-[#FAFBFD] pl-8 pr-7 text-[12px] text-[#102344] placeholder:text-[#94A3B8] focus:border-[#0866F5] focus:bg-white focus:outline-none"
        />
        {search && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onChangeSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#102344]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filter Selects */}
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          aria-label="Filter by Order Type"
          value={typeFilter}
          onChange={(e) => onChangeTypeFilter(e.target.value as "all" | OrderType)}
          className="h-9 rounded-xl border border-[#E2E8F0] bg-white px-2.5 text-[11.5px] font-semibold text-[#1E293B] focus:border-[#0866F5] focus:outline-none"
        >
          <option value="all">Order Type</option>
          <option value="dine-in">Dine In</option>
          <option value="takeaway">Takeaway</option>
          <option value="delivery">Delivery</option>
        </select>

        <select
          aria-label="Filter by Order Status"
          value={orderStatusFilter}
          onChange={(e) => onChangeOrderStatusFilter(e.target.value as "all" | DisplayOrderStatus)}
          className="h-9 rounded-xl border border-[#E2E8F0] bg-white px-2.5 text-[11.5px] font-semibold text-[#1E293B] focus:border-[#0866F5] focus:outline-none"
        >
          <option value="all">Order Status</option>
          <option value="Ongoing">Ongoing</option>
          <option value="Served">Served</option>
          <option value="Completed">Completed</option>
          <option value="On Delivery">On Delivery</option>
          <option value="Cancelled">Cancelled</option>
        </select>

        <select
          aria-label="Filter by Payment Status"
          value={paymentFilter}
          onChange={(e) => onChangePaymentFilter(e.target.value as "all" | PaymentStatus)}
          className="h-9 rounded-xl border border-[#E2E8F0] bg-white px-2.5 text-[11.5px] font-semibold text-[#1E293B] focus:border-[#0866F5] focus:outline-none"
        >
          <option value="all">Payment Status</option>
          <option value="unpaid">Pending</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
        </select>

        <select
          aria-label="Filter by Kitchen Status"
          value={kitchenStatusFilter}
          onChange={(e) =>
            onChangeKitchenStatusFilter(e.target.value as "all" | DisplayKitchenStatus)
          }
          className="h-9 rounded-xl border border-[#E2E8F0] bg-white px-2.5 text-[11.5px] font-semibold text-[#1E293B] focus:border-[#0866F5] focus:outline-none"
        >
          <option value="all">Kitchen Status</option>
          <option value="New">New</option>
          <option value="Preparing">Preparing</option>
          <option value="Ready">Ready</option>
          <option value="Served">Served</option>
        </select>

        <select
          aria-label="Filter by Date Range"
          value={dateRange}
          onChange={(e) => onChangeDateRange(e.target.value as DateRangePreset)}
          className="h-9 rounded-xl border border-[#E2E8F0] bg-white px-2.5 text-[11.5px] font-semibold text-[#1E293B] focus:border-[#0866F5] focus:outline-none"
        >
          <option value="all">Date Range</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7days">Last 7 Days</option>
        </select>

        {/* Reset Button */}
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#E2E8F0] bg-white px-2.5 text-[11.5px] font-semibold text-[#475569] transition-colors hover:bg-slate-50 hover:text-[#102344]"
        >
          <X className="h-3.5 w-3.5" />
          <span>Reset</span>
        </button>

        {/* Table / Card View Switcher */}
        <div className="inline-flex h-9 items-center rounded-xl border border-[#D8E3F2] bg-[#F1F5FB] p-0.5">
          <button
            type="button"
            onClick={() => onChangeViewMode("table")}
            className={cn(
              "inline-flex h-full items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold transition-all",
              viewMode === "table"
                ? "bg-[#EBF3FF] text-[#0866F5] shadow-2xs"
                : "text-[#64748B] hover:text-[#102344]",
            )}
          >
            <Table2 className="h-3.5 w-3.5" />
            <span>Table</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode("cards")}
            className={cn(
              "inline-flex h-full items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold transition-all",
              viewMode === "cards"
                ? "bg-[#EBF3FF] text-[#0866F5] shadow-2xs"
                : "text-[#64748B] hover:text-[#102344]",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Card View</span>
          </button>
        </div>
      </div>
    </div>
  );
}
