import {
  Armchair,
  Ban,
  CalendarClock,
  CheckCircle2,
  ChefHat,
  Clock,
  CreditCard,
  FileText,
  Mail,
  MoreHorizontal,
  PauseCircle,
  Pencil,
  Phone,
  PlayCircle,
  Printer,
  Receipt,
  Sparkles,
  UserRound,
  Utensils,
  X,
} from "lucide-react";
import { useState } from "react";

import {
  deriveDisplayOrderStatus,
  formatOrderDateTime,
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
import { inr, lineTotal, totals } from "@/lib/calc";
import { getDishImage } from "@/lib/images";
import type { Customer, DiningTable, Kot, Order } from "@/lib/types";
import { cn } from "@/lib/utils";

interface OrderDetailsPanelProps {
  order: Order | undefined;
  customer: Customer | undefined;
  table: DiningTable | undefined;
  kots: Kot[];
  gstPct: number;
  onClose: () => void;
  onAddItemsInPos: (orderId: string) => void;
  onUpdateNote: (orderId: string, note: string) => void;
  onOpenDiscountModal: (order: Order) => void;
  onSendToKitchen: (orderId: string) => void;
  onGenerateBill: (order: Order) => void;
  onHoldOrder: (orderId: string) => void;
  onPrintKot: (order: Order) => void;
  onPrintReceipt: (order: Order) => void;
  onAdvanceKot: (kotId: string) => void;
  onMarkServed: (orderId: string) => void;
  onSettlePaymentQuick: (orderId: string, method: string) => void;
  onCancelOrder: (order: Order) => void;
}

export function OrderDetailsPanel({
  order,
  customer,
  table,
  kots,
  gstPct,
  onClose,
  onAddItemsInPos,
  onUpdateNote,
  onOpenDiscountModal,
  onSendToKitchen,
  onGenerateBill,
  onHoldOrder,
  onPrintKot,
  onPrintReceipt,
  onAdvanceKot,
  onMarkServed,
  onSettlePaymentQuick,
  onCancelOrder,
}: OrderDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState<
    "details" | "customer" | "timeline" | "kot" | "payment"
  >("details");
  const [editingNote, setEditingNote] = useState(false);

  if (!order) {
    return (
      <aside className="flex w-full shrink-0 flex-col items-center justify-center rounded-2xl border border-[#E1E9F4] bg-white p-8 text-center shadow-xs xl:w-[376px]">
        <Receipt className="h-8 w-8 text-[#94A3B8]" />
        <p className="mt-2 text-[13px] font-bold text-[#102344]">No Order Selected</p>
        <p className="mt-1 text-[11.5px] text-[#64748B]">
          Select any order row from the table to inspect items, KOT tickets, timeline, and billing.
        </p>
      </aside>
    );
  }

  const displayStatus = deriveDisplayOrderStatus(order);
  const bill = totals(order.lines, order.discountPct, gstPct);
  const custName = customer?.name ?? "Walk-in Guest";

  const statusPillStyle = (() => {
    switch (displayStatus) {
      case "Ongoing":
        return "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]";
      case "Served":
      case "Completed":
        return "border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]";
      case "On Delivery":
        return "border-[#E9D5FF] bg-[#F3E8FF] text-[#7C3AED]";
      case "Cancelled":
        return "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]";
    }
  })();

  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-[#E1E9F4] bg-white shadow-xs xl:w-[376px]">
      {/* 1. Top Order Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[18px] font-extrabold leading-none text-[#102344]">#{order.id}</h2>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold",
              statusPillStyle,
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {displayStatus}
          </span>
        </div>
        <button
          type="button"
          aria-label="Close order details"
          onClick={onClose}
          className="rounded-lg p-1 text-[#64748B] transition-colors hover:bg-slate-100 hover:text-[#102344]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 2. Five-Tab Navigation Bar */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4">
        {(
          [
            { id: "details", label: "Order Details" },
            { id: "customer", label: "Customer" },
            { id: "timeline", label: "Timeline" },
            { id: "kot", label: "KOT" },
            { id: "payment", label: "Payment" },
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "border-b-2 py-2.5 text-[11.5px] transition-colors",
                active
                  ? "border-[#0866F5] font-extrabold text-[#0866F5]"
                  : "border-transparent font-semibold text-[#64748B] hover:text-[#102344]",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: ORDER DETAILS */}
      {activeTab === "details" && (
        <div className="flex flex-1 flex-col">
          {/* 2x2 Metadata Summary Card */}
          <div className="p-3.5 pb-2">
            <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2.5">
              {/* Top-Left: Table */}
              <div className="flex items-start gap-2">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#334155]">
                  <Armchair className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11.5px] font-extrabold text-[#102344]">
                    {order.type === "dine-in"
                      ? `Table ${table?.name ?? order.tableId ?? "T3"}`
                      : formatOrderTypeLabel(order.type)}
                  </div>
                  <div className="truncate text-[10.5px] text-[#64748B]">
                    {order.type === "dine-in"
                      ? `${table?.area ?? "Main Hall"} • ${order.guests || 4} Guests`
                      : (order.provider ?? "Counter Pickup")}
                  </div>
                </div>
              </div>

              {/* Top-Right: Order Time */}
              <div className="flex items-start gap-2">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#334155]">
                  <CalendarClock className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11.5px] font-extrabold text-[#102344]">Order Time</div>
                  <div className="truncate text-[10.5px] text-[#64748B] tabular">
                    {formatOrderDateTime(order.createdAt)}
                  </div>
                </div>
              </div>

              {/* Bottom-Left: Order Type */}
              <div className="flex items-start gap-2 border-t border-[#E2E8F0]/70 pt-2">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#334155]">
                  <Utensils className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-[11.5px] font-extrabold text-[#102344]">Order Type</div>
                  <div className="text-[10.5px] text-[#64748B]">
                    {formatOrderTypeLabel(order.type)}
                  </div>
                </div>
              </div>

              {/* Bottom-Right: Order Status */}
              <div className="flex items-start gap-2 border-t border-[#E2E8F0]/70 pt-2">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#334155]">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-[11.5px] font-extrabold text-[#102344]">Order Status</div>
                  <span className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-[#EBF3FF] px-1.5 py-0.2 text-[10px] font-bold text-[#0866F5]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#0866F5]" />
                    {displayStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Items Header */}
          <div className="flex items-center justify-between px-3.5 py-1.5">
            <h3 className="text-[13px] font-extrabold text-[#102344]">
              Items ({order.lines.length})
            </h3>
            <button
              type="button"
              onClick={() => onAddItemsInPos(order.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#D8E3F2] bg-[#F8FAFC] px-2.5 py-1 text-[10.5px] font-bold text-[#0866F5] transition-colors hover:bg-[#EBF3FF]"
            >
              <Pencil className="h-3 w-3" />
              <span>Add Items</span>
            </button>
          </div>

          {/* Items List */}
          <div className="max-h-[245px] divide-y divide-[#F1F5F9] overflow-y-auto px-3.5">
            {order.lines.map((line) => {
              const sub = lineTotal(line);
              const unitPrice = line.price + line.addons.reduce((s, a) => s + a.price, 0);
              const badges = [
                ...line.modifiers,
                ...line.addons.map((a) => `+${a.name}`),
                ...(line.note ? [line.note] : []),
              ];

              return (
                <div
                  key={line.lineId}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 py-2.5 text-[12px]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <img
                      src={getDishImage(line.name)}
                      alt={line.name}
                      className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover"
                    />
                    <div className="min-w-0">
                      <div className="truncate font-bold text-[#102344]">{line.name}</div>
                      {badges.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {badges.map((b, idx) => (
                            <span
                              key={`${line.lineId}-mod-${idx}`}
                              className="inline-flex rounded border border-[#FED7AA] bg-[#FFF7ED] px-1.5 py-0.2 text-[9.5px] font-semibold text-[#C2410C]"
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Qty */}
                  <span className="px-1 text-[11.5px] font-semibold text-[#64748B] tabular">
                    x {line.qty}
                  </span>

                  {/* Unit Price */}
                  <div className="w-12 text-right leading-tight tabular">
                    <div className="text-[11.5px] font-medium text-[#475569]">{inr(unitPrice)}</div>
                    {line.qty > 1 && <div className="text-[9.5px] text-[#94A3B8]">each</div>}
                  </div>

                  {/* Line Total */}
                  <div className="w-13 text-right leading-tight tabular">
                    <div className="text-[12.5px] font-extrabold text-[#102344]">{inr(sub)}</div>
                    {line.qty > 1 && <div className="text-[9.5px] text-[#94A3B8]">each</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Special Instructions Box */}
          <div className="px-3.5 py-2">
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#102344]">
                  <FileText className="h-3.5 w-3.5 text-[#D97706]" />
                  <span>Special Instructions</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingNote((prev) => !prev)}
                  className="text-[10px] font-semibold text-[#0866F5] hover:underline"
                >
                  {editingNote ? "Done" : "Edit"}
                </button>
              </div>
              {editingNote ? (
                <input
                  type="text"
                  value={order.note ?? ""}
                  onChange={(e) => onUpdateNote(order.id, e.target.value)}
                  placeholder="e.g., Less spicy, extra raita..."
                  className="mt-1 w-full rounded border border-blue-200 bg-white px-2 py-1 text-[11px] text-[#102344] focus:outline-none"
                />
              ) : (
                <p className="mt-0.5 text-[11px] text-[#475569]">
                  {order.note?.trim() || "Less spicy, extra raita"}
                </p>
              )}
            </div>
          </div>

          {/* Bill Summary */}
          <div className="space-y-2 border-t border-[#EEF2F8] px-3.5 py-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-[13px] font-extrabold text-[#102344]">Bill Summary</h4>
              <button
                type="button"
                onClick={() => onOpenDiscountModal(order)}
                className="inline-flex items-center gap-1 rounded-lg border border-[#D8E3F2] bg-[#F8FAFC] px-2.5 py-1 text-[10.5px] font-bold text-[#0866F5] transition-colors hover:bg-[#EBF3FF]"
              >
                <Pencil className="h-3 w-3" />
                <span>Apply Discount</span>
              </button>
            </div>

            <div className="space-y-1 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-[#475569]">Items Total</span>
                <span className="font-bold text-[#102344] tabular">{inr(bill.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#475569]">Discount ({order.discountPct}%)</span>
                <span className="font-bold text-[#059669] tabular">- {inr(bill.discount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#475569]">GST ({gstPct}%)</span>
                <span className="font-bold text-[#102344] tabular">{inr(bill.gst)}</span>
              </div>
            </div>

            {/* Total Amount Box */}
            <div className="flex items-center justify-between rounded-xl border border-[#BFDBFE] bg-[#EBF3FF] px-3.5 py-2.5">
              <span className="text-[14px] font-extrabold text-[#102344]">Total Amount</span>
              <span className="text-[20px] font-extrabold leading-none text-[#0866F5] tabular">
                {inr(bill.total)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOMER */}
      {activeTab === "customer" && (
        <div className="flex-1 space-y-3 p-4 text-xs">
          <div className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-extrabold",
                getAvatarTone(custName),
              )}
            >
              {getCustomerInitials(custName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-extrabold text-[#102344]">{custName}</div>
              <div className="mt-0.5 text-[11px] text-[#64748B]">
                {customer ? `${customer.tier} Loyalty Member` : "Walk-in Dining Guest"}
              </div>
            </div>
            {customer && (
              <span className="rounded-lg bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800">
                {customer.points} pts
              </span>
            )}
          </div>

          {customer ? (
            <div className="space-y-2 rounded-xl border border-[#E2E8F0] p-3">
              <div className="flex items-center gap-2 text-[#334155]">
                <Phone className="h-3.5 w-3.5 text-[#0866F5]" />
                <span className="font-semibold tabular">{customer.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-[#334155]">
                <Mail className="h-3.5 w-3.5 text-[#0866F5]" />
                <span>{customer.email}</span>
              </div>
              <div className="flex items-start gap-2 border-t border-slate-100 pt-2 text-[#475569]">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 text-amber-500" />
                <span>{customer.notes || "Prefers center table, medium spice"}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-[#64748B]">
              <UserRound className="mx-auto mb-1.5 h-5 w-5 text-slate-400" />
              <p>Walk-in guest order. Open in POS to link a CRM customer profile.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TIMELINE */}
      {activeTab === "timeline" && (
        <div className="flex-1 space-y-3 p-4 text-xs">
          {[
            {
              title: "Order Created",
              time: formatOrderTime(order.createdAt),
              desc: `${formatOrderTypeLabel(order.type)} order opened (${order.lines.length} items)`,
              done: true,
            },
            {
              title: "KOT Dispatched to Kitchen",
              time: formatOrderTime(order.createdAt + 60000),
              desc:
                kots.length > 0
                  ? `${kots.length} station ticket(s) active`
                  : "Routed to Tandoor, Biryani & Curry stations",
              done: true,
            },
            {
              title: "Kitchen Preparation",
              time: formatOrderTime(order.createdAt + 240000),
              desc:
                order.status === "ready" ||
                order.status === "served" ||
                order.status === "completed"
                  ? "All dishes prepared and plated"
                  : "Chefs preparing items at assigned stations",
              done:
                order.status === "in-kitchen" ||
                order.status === "ready" ||
                order.status === "served" ||
                order.status === "completed",
            },
            {
              title: "Served / Dispatched",
              time:
                order.status === "served" || order.status === "completed"
                  ? formatOrderTime(order.createdAt + 900000)
                  : "Pending",
              desc: "Order served to table / handed to rider",
              done: order.status === "served" || order.status === "completed",
            },
            {
              title: "Bill Settled",
              time: order.paidAt ? formatOrderTime(order.paidAt) : "Unpaid",
              desc:
                order.payment === "paid"
                  ? `Paid ${inr(bill.total)} via ${order.paymentMethod ?? "UPI"}`
                  : `Awaiting payment of ${inr(bill.total)}`,
              done: order.payment === "paid",
            },
          ].map((step, idx) => (
            <div key={step.title} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                    step.done
                      ? "bg-[#0866F5] text-white"
                      : "border border-slate-300 bg-slate-100 text-slate-400",
                  )}
                >
                  {idx + 1}
                </span>
                {idx < 4 && <span className="mt-1 h-6 w-0.5 bg-slate-200" />}
              </div>
              <div className="flex-1 pb-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#102344]">{step.title}</span>
                  <span className="text-[10.5px] font-medium text-[#64748B] tabular">
                    {step.time}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[#64748B]">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: KOT */}
      {activeTab === "kot" && (
        <div className="flex-1 space-y-2.5 overflow-y-auto p-4 text-xs">
          {kots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
              <ChefHat className="mx-auto mb-2 h-6 w-6 text-slate-400" />
              <p className="font-bold text-[#102344]">No Active KOT Tickets</p>
              <p className="mt-1 text-[11px] text-[#64748B]">
                Click &ldquo;Send to Kitchen&rdquo; below to generate station KOTs.
              </p>
            </div>
          ) : (
            kots.map((kot) => (
              <div
                key={kot.id}
                className="space-y-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-extrabold text-[#102344]">{kot.id}</span>
                    <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-[#0866F5]">
                      {kot.station}
                    </span>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-[#334155] border border-slate-200">
                    {kot.status}
                  </span>
                </div>
                <div className="space-y-1 border-t border-slate-200/70 pt-1.5">
                  {kot.lines.map((l) => (
                    <div key={l.lineId} className="flex justify-between text-[11.5px]">
                      <span className="font-semibold text-[#1E293B]">
                        {l.qty} × {l.name}
                      </span>
                      {l.modifiers.length > 0 && (
                        <span className="text-[10px] text-[#C2410C]">{l.modifiers.join(", ")}</span>
                      )}
                    </div>
                  ))}
                </div>
                {kot.status !== "served" && (
                  <button
                    type="button"
                    onClick={() => onAdvanceKot(kot.id)}
                    className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-[#0866F5] py-1.5 text-[11px] font-bold text-white hover:bg-[#0756D0]"
                  >
                    <PlayCircle className="h-3.5 w-3.5" />
                    <span>Advance KOT Status</span>
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 5: PAYMENT */}
      {activeTab === "payment" && (
        <div className="flex-1 space-y-3 p-4 text-xs">
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#475569]">Payment Status</span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase",
                  order.payment === "paid"
                    ? "bg-[#ECFDF5] text-[#059669]"
                    : "bg-[#FFFBEB] text-[#D97706]",
                )}
              >
                {order.payment === "paid" ? "Paid" : "Pending"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#64748B]">Payment Method</span>
              <span className="font-bold text-[#102344]">{order.paymentMethod ?? "Unsettled"}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 text-sm font-extrabold">
              <span className="text-[#102344]">Net Payable</span>
              <span className="text-[#0866F5] tabular">{inr(bill.total)}</span>
            </div>
          </div>

          {order.payment === "unpaid" && order.status !== "cancelled" && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-[#334155]">Quick Settle Payment</div>
              <div className="grid grid-cols-3 gap-2">
                {(["UPI", "Card", "Cash"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onSettlePaymentQuick(order.id, m)}
                    className="rounded-xl border border-[#0866F5] bg-[#EBF3FF] py-2 font-bold text-[#0866F5] transition-colors hover:bg-[#0866F5] hover:text-white"
                  >
                    Pay {m}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pinned Bottom Action Buttons */}
      <div className="space-y-2 border-t border-[#EEF2F8] p-3.5">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={order.status === "cancelled" || order.status === "completed"}
            onClick={() => onSendToKitchen(order.id)}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#059669] px-3 text-[12px] font-bold text-white shadow-xs transition-colors hover:bg-[#047857] disabled:opacity-45"
          >
            <ChefHat className="h-4 w-4" />
            <span>Send to Kitchen</span>
          </button>

          <button
            type="button"
            disabled={order.status === "cancelled"}
            onClick={() => onGenerateBill(order)}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#0866F5] px-3 text-[12px] font-bold text-white shadow-xs transition-colors hover:bg-[#0756D0] disabled:opacity-45"
          >
            <Receipt className="h-4 w-4" />
            <span>Generate Bill</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => onHoldOrder(order.id)}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-[#E2E8F0] bg-white px-2 text-[11px] font-bold text-[#1E293B] transition-colors hover:bg-slate-50"
          >
            <PauseCircle className="h-3.5 w-3.5 text-[#475569]" />
            <span>Hold Order</span>
          </button>

          <button
            type="button"
            onClick={() => onPrintKot(order)}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-[#E2E8F0] bg-white px-2 text-[11px] font-bold text-[#1E293B] transition-colors hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5 text-[#475569]" />
            <span>Print KOT</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-[#E2E8F0] bg-white px-2 text-[11px] font-bold text-[#1E293B] transition-colors hover:bg-slate-50"
              >
                <MoreHorizontal className="h-3.5 w-3.5 text-[#475569]" />
                <span>More Actions</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 text-xs">
              <DropdownMenuItem onClick={() => onAddItemsInPos(order.id)}>
                <CreditCard className="mr-2 h-3.5 w-3.5" />
                Open in POS
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPrintReceipt(order)}>
                <Printer className="mr-2 h-3.5 w-3.5" />
                Print Customer Bill
              </DropdownMenuItem>
              {order.status !== "served" && order.status !== "completed" && (
                <DropdownMenuItem onClick={() => onMarkServed(order.id)}>
                  <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-[#059669]" />
                  Mark as Served
                </DropdownMenuItem>
              )}
              {order.status !== "completed" && order.status !== "cancelled" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onCancelOrder(order)}
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
      </div>
    </aside>
  );
}
