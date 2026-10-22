import {
  ArrowUpDown,
  Ban,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  Clock,
  CreditCard,
  Eye,
  MoreHorizontal,
  PauseCircle,
  Printer,
} from "lucide-react";

import {
  deriveDisplayOrderStatus,
  deriveKitchenStatus,
  formatOrderTime,
  formatOrderTypeLabel,
  getAvatarTone,
  getCustomerInitials,
} from "@/components/orders/orders-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { inr, orderTotal } from "@/lib/calc";
import { getDishImage } from "@/lib/images";
import type { Customer, Kot, Order } from "@/lib/types";
import { cn } from "@/lib/utils";

interface OrdersTableListProps {
  orders: Order[];
  kots: Kot[];
  customers: Customer[];
  gstPct: number;
  selectedOrderId: string | undefined;
  viewMode: "table" | "cards";
  sortBy: "newest" | "amount-desc" | "oldest";
  onToggleAmountSort: () => void;
  onSelectOrder: (orderId: string) => void;
  onPrintOrder: (order: Order) => void;
  onOpenInPos: (orderId: string) => void;
  onSendToKitchen: (orderId: string) => void;
  onSettlePayment: (order: Order) => void;
  onHoldOrder: (orderId: string) => void;
  onRequestCancel: (order: Order) => void;
}

export function OrdersTableList({
  orders,
  kots,
  customers,
  gstPct,
  selectedOrderId,
  viewMode,
  onToggleAmountSort,
  onSelectOrder,
  onPrintOrder,
  onOpenInPos,
  onSendToKitchen,
  onSettlePayment,
  onHoldOrder,
  onRequestCancel,
}: OrdersTableListProps) {
  const customerById = new Map(customers.map((c) => [c.id, c]));

  const renderTypeBadge = (type: Order["type"]) => {
    const label = formatOrderTypeLabel(type);
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-bold",
          type === "dine-in" && "bg-[#EBF3FF] text-[#0866F5]",
          type === "takeaway" && "bg-[#FFF7ED] text-[#D97706]",
          type === "delivery" && "bg-[#F3E8FF] text-[#7C3AED]",
        )}
      >
        {label}
      </span>
    );
  };

  const renderPaymentBadge = (payment: Order["payment"]) => {
    if (payment === "paid") {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-bold text-[#059669]">
          <CheckCircle2 className="h-3 w-3" />
          <span>Paid</span>
        </span>
      );
    }
    if (payment === "refunded") {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg bg-[#FEF2F2] px-2.5 py-1 text-[11px] font-bold text-[#DC2626]">
          <Ban className="h-3 w-3" />
          <span>Refunded</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-[#FFFBEB] px-2.5 py-1 text-[11px] font-bold text-[#D97706]">
        <Clock className="h-3 w-3" />
        <span>Pending</span>
      </span>
    );
  };

  const renderKitchenBadge = (order: Order) => {
    const st = deriveKitchenStatus(order, kots);
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-bold",
          st === "New" && "bg-[#EBF3FF] text-[#0866F5]",
          st === "Preparing" && "bg-[#FFF7ED] text-[#D97706]",
          st === "Ready" && "bg-[#ECFDF5] text-[#059669]",
          st === "Served" && "bg-[#F1F5F9] text-[#475569]",
        )}
      >
        {st}
      </span>
    );
  };

  const renderOrderStatusBadge = (order: Order) => {
    const st = deriveDisplayOrderStatus(order);
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-bold",
          st === "Ongoing" && "bg-[#EBF3FF] text-[#0866F5]",
          st === "Served" && "bg-[#ECFDF5] text-[#059669]",
          st === "Completed" && "bg-[#ECFDF5] text-[#059669]",
          st === "On Delivery" && "bg-[#F3E8FF] text-[#7C3AED]",
          st === "Cancelled" && "bg-[#FEF2F2] text-[#DC2626]",
        )}
      >
        {st}
      </span>
    );
  };

  if (viewMode === "cards") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {orders.map((order) => {
          const cust = order.customerId ? customerById.get(order.customerId) : undefined;
          const total = orderTotal(order, gstPct);
          const isSelected = order.id === selectedOrderId;
          const custName = cust?.name ?? "Walk-in";
          const initials = getCustomerInitials(custName);

          return (
            <div
              key={order.id}
              onClick={() => onSelectOrder(order.id)}
              className={cn(
                "cursor-pointer rounded-2xl border bg-white p-3.5 shadow-2xs transition-all",
                isSelected
                  ? "border-[#0866F5] ring-2 ring-[#0866F5]/15"
                  : "border-[#E1E9F4] hover:border-blue-300",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-extrabold text-[#102344]">#{order.id}</span>
                {renderOrderStatusBadge(order)}
              </div>

              <div className="mt-2.5 flex items-center gap-2.5">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    getAvatarTone(custName),
                  )}
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-bold text-[#102344]">
                    {order.type === "dine-in"
                      ? `${order.tableId ?? "T1"} • ${order.guests || 2} Guests`
                      : formatOrderTypeLabel(order.type)}
                  </div>
                  <div className="truncate text-[11px] text-[#64748B]">{custName}</div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                <div className="flex items-center gap-1.5">
                  {renderTypeBadge(order.type)}
                  {renderPaymentBadge(order.payment)}
                </div>
                <span className="text-[14px] font-extrabold text-[#102344] tabular">
                  {inr(total)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E1E9F4] bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F4F7FC] text-[11.5px] font-bold text-[#334155]">
              <th className="py-3 pl-4 pr-2">Order ID</th>
              <th className="py-3 px-2">Time</th>
              <th className="py-3 px-2.5">
                <div className="inline-flex items-center gap-1">
                  <span>Table / Customer</span>
                  <ChevronDown className="h-3 w-3 text-[#64748B]" />
                </div>
              </th>
              <th className="py-3 px-2">
                <div className="inline-flex items-center gap-1">
                  <span>Type</span>
                  <ChevronDown className="h-3 w-3 text-[#64748B]" />
                </div>
              </th>
              <th className="py-3 px-2">Items</th>
              <th className="py-3 px-2">
                <button
                  type="button"
                  onClick={onToggleAmountSort}
                  className="inline-flex items-center gap-1 font-bold text-[#334155] hover:text-[#0866F5]"
                >
                  <span>Amount</span>
                  <ArrowUpDown className="h-3 w-3 text-[#64748B]" />
                </button>
              </th>
              <th className="py-3 px-2">
                <div className="inline-flex items-center gap-1">
                  <span>Payment</span>
                  <ChevronDown className="h-3 w-3 text-[#64748B]" />
                </div>
              </th>
              <th className="py-3 px-2">Kitchen Status</th>
              <th className="py-3 px-2">
                <div className="inline-flex items-center gap-1">
                  <span>Order Status</span>
                  <ChevronDown className="h-3 w-3 text-[#64748B]" />
                </div>
              </th>
              <th className="py-3 pl-2 pr-4 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#EEF2F8]">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-xs text-[#64748B]">
                  No orders match your active filter criteria.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const cust = order.customerId ? customerById.get(order.customerId) : undefined;
                const custName = cust?.name ?? "Walk-in";
                const initials = getCustomerInitials(custName);
                const total = orderTotal(order, gstPct);
                const isSelected = order.id === selectedOrderId;
                const thumbLines = order.lines.slice(0, 2);
                const extraLinesCount = Math.max(0, order.lines.length - 2);

                return (
                  <tr
                    key={order.id}
                    onClick={() => onSelectOrder(order.id)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isSelected ? "bg-[#F0F7FF]" : "hover:bg-[#F8FAFC]",
                    )}
                  >
                    {/* Order ID */}
                    <td className="py-3 pl-4 pr-2 font-extrabold text-[#102344]">#{order.id}</td>

                    {/* Time */}
                    <td className="py-3 px-2 text-[11.5px] font-medium text-[#475569] tabular whitespace-nowrap">
                      {formatOrderTime(order.createdAt)}
                    </td>

                    {/* Table / Customer */}
                    <td className="py-3 px-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                            getAvatarTone(custName),
                          )}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-bold text-[#102344]">
                            {order.type === "dine-in"
                              ? `${order.tableId ?? "T1"} • ${order.guests || 2} Guests`
                              : formatOrderTypeLabel(order.type)}
                          </div>
                          <div className="truncate text-[11px] text-[#64748B]">{custName}</div>
                        </div>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="py-3 px-2 whitespace-nowrap">{renderTypeBadge(order.type)}</td>

                    {/* Items Thumbnails */}
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-1">
                        {thumbLines.map((line) => (
                          <img
                            key={line.lineId}
                            src={getDishImage(line.name)}
                            alt={line.name}
                            title={`${line.qty}× ${line.name}`}
                            className="h-8 w-8 rounded-lg border border-slate-200 object-cover"
                          />
                        ))}
                        {extraLinesCount > 0 && (
                          <span className="flex h-7 items-center justify-center rounded-md border border-[#E2E8F0] bg-[#F1F5FB] px-1.5 text-[10.5px] font-bold text-[#475569] tabular">
                            +{extraLinesCount}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-2 font-extrabold text-[#102344] tabular whitespace-nowrap">
                      {inr(total)}
                    </td>

                    {/* Payment */}
                    <td className="py-3 px-2 whitespace-nowrap">
                      {renderPaymentBadge(order.payment)}
                    </td>

                    {/* Kitchen Status */}
                    <td className="py-3 px-2 whitespace-nowrap">{renderKitchenBadge(order)}</td>

                    {/* Order Status */}
                    <td className="py-3 px-2 whitespace-nowrap">{renderOrderStatusBadge(order)}</td>

                    {/* Actions */}
                    <td
                      className="py-3 pl-2 pr-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Inspect ${order.id}`}
                          onClick={() => onSelectOrder(order.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#334155] transition-colors hover:bg-slate-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          aria-label={`Print receipt for ${order.id}`}
                          onClick={() => onPrintOrder(order)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#334155] transition-colors hover:bg-slate-50"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`More actions for ${order.id}`}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#334155] transition-colors hover:bg-slate-50"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 text-xs">
                            <DropdownMenuItem onClick={() => onOpenInPos(order.id)}>
                              <CreditCard className="mr-2 h-3.5 w-3.5" />
                              Open in POS
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onSendToKitchen(order.id)}>
                              <ChefHat className="mr-2 h-3.5 w-3.5" />
                              Send to Kitchen
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onHoldOrder(order.id)}>
                              <PauseCircle className="mr-2 h-3.5 w-3.5" />
                              Hold Order
                            </DropdownMenuItem>
                            {order.payment === "unpaid" && order.status !== "cancelled" && (
                              <DropdownMenuItem onClick={() => onSettlePayment(order)}>
                                <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-[#059669]" />
                                Settle Payment
                              </DropdownMenuItem>
                            )}
                            {order.status !== "completed" && order.status !== "cancelled" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => onRequestCancel(order)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Ban className="mr-2 h-3.5 w-3.5" />
                                  Cancel Order
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
