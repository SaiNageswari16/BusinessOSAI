import {
  ArrowLeftRight,
  ArrowRight,
  BookmarkCheck,
  Clock,
  GitMerge,
  Minus,
  MoreHorizontal,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Printer,
  Receipt,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { inr, lineTotal, minutesSince, orderTotal, totals } from "@/lib/calc";
import { getDishImage } from "@/lib/images";
import type { HeldCart } from "@/lib/seed";
import type { PosDraft } from "@/lib/store";
import type { DiningTable, Order, OrderLine } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PosOrderPanelProps {
  posDraft: PosDraft;
  selectedTable: DiningTable | undefined;
  activeOrder: Order | undefined;
  recentOrders: Order[];
  held: HeldCart[];
  gstPct: number;
  maxDiscountPct: number;
  onUpdateLineQty: (lineId: string, qty: number) => void;
  onRemoveLine: (lineId: string) => void;
  onEditLine: (line: OrderLine) => void;
  onChangeNote: (note: string) => void;
  onChangeDiscount: (pct: number) => void;
  onOpenDiscountDialog: () => void;
  onOpenTableSelector: () => void;
  onOpenTransferModal: () => void;
  onOpenMergeModal: () => void;
  onOpenMoreActionsModal: () => void;
  onSaveOrder: () => void;
  onHoldOrder: () => void;
  onPrintKot: () => void;
  onProceedToPayment: () => void;
  onResumeHeldOrder: (heldId: string) => void;
  onDeleteHeldOrder: (heldId: string) => void;
  onLoadOrderIntoPos: (orderId: string) => void;
  onViewOrderReceipt: (order: Order) => void;
}

export function PosOrderPanel({
  posDraft,
  selectedTable,
  activeOrder,
  recentOrders,
  held,
  gstPct,
  maxDiscountPct,
  onUpdateLineQty,
  onRemoveLine,
  onEditLine,
  onChangeNote,
  onChangeDiscount,
  onOpenDiscountDialog,
  onOpenTableSelector,
  onOpenTransferModal,
  onOpenMergeModal,
  onOpenMoreActionsModal,
  onSaveOrder,
  onHoldOrder,
  onPrintKot,
  onProceedToPayment,
  onResumeHeldOrder,
  onDeleteHeldOrder,
  onLoadOrderIntoPos,
  onViewOrderReceipt,
}: PosOrderPanelProps) {
  const [activeTab, setActiveTab] = useState<"current" | "history" | "held">("current");

  const bill = totals(posDraft.lines, posDraft.discountPct, gstPct);

  const tableSince = selectedTable?.since ?? activeOrder?.createdAt;
  const elapsedMins = tableSince ? Math.max(1, minutesSince(tableSince)) : 42;

  const discountPresets = [0, 5, 10, 15, 20, 25, 30].filter((p) => p <= maxDiscountPct);
  if (!discountPresets.includes(posDraft.discountPct)) {
    discountPresets.push(posDraft.discountPct);
    discountPresets.sort((a, b) => a - b);
  }

  const statusBadgeConfig = (() => {
    const st = selectedTable?.status ?? "occupied";
    switch (st) {
      case "occupied":
        return {
          label: "Occupied",
          cls: "border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]",
          dot: "bg-[#059669]",
        };
      case "billing":
        return {
          label: "Billing",
          cls: "border-amber-200 bg-amber-50 text-amber-700",
          dot: "bg-amber-500",
        };
      case "reserved":
        return {
          label: "Reserved",
          cls: "border-purple-200 bg-purple-50 text-purple-700",
          dot: "bg-purple-500",
        };
      case "cleaning":
        return {
          label: "Cleaning",
          cls: "border-slate-200 bg-slate-100 text-slate-600",
          dot: "bg-slate-400",
        };
      default:
        return {
          label: "Available",
          cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
          dot: "bg-emerald-500",
        };
    }
  })();

  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-[#E1E9F4] bg-white shadow-xs lg:w-[350px] xl:w-[376px]">
      {/* 1. Top Order Panel Tabs */}
      <div className="grid grid-cols-3 border-b border-[#E2E8F0] px-2 pt-2">
        {(
          [
            { id: "current", label: `Current Order (${posDraft.lines.length})` },
            { id: "history", label: `Order History (${recentOrders.length})` },
            { id: "held", label: `Hold Orders (${held.length})` },
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "border-b-2 pb-2.5 text-center text-[11.5px] transition-colors",
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

      {/* TAB 1: CURRENT ORDER */}
      {activeTab === "current" && (
        <div className="flex flex-1 flex-col">
          {/* Order Context Header */}
          <div className="space-y-2.5 border-b border-[#EEF2F8] px-3.5 py-3">
            {posDraft.orderType === "dine-in" ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[17px] font-extrabold leading-none text-[#102344]">
                      Table {selectedTable?.name ?? posDraft.tableId ?? "T2"}
                    </h3>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-bold",
                        statusBadgeConfig.cls,
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", statusBadgeConfig.dot)} />
                      {statusBadgeConfig.label}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 rounded-full border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-0.5 text-[10.5px] font-bold text-[#DC2626] tabular">
                    <Clock className="h-3 w-3" />
                    {elapsedMins} mins
                  </span>
                </div>

                <div className="text-[11.5px] font-medium text-[#64748B]">
                  {selectedTable
                    ? `${selectedTable.area} • ${selectedTable.capacity} Seats`
                    : "Main Hall • 4 Seats"}
                </div>

                {/* Dine-In Table Action Buttons */}
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={onOpenTableSelector}
                    className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2 text-[11px] font-semibold text-[#1E293B] transition-colors hover:bg-slate-50"
                  >
                    <Pencil className="h-3 w-3 text-[#475569]" />
                    <span>Edit Table</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenTransferModal}
                    className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2 text-[11px] font-semibold text-[#1E293B] transition-colors hover:bg-slate-50"
                  >
                    <ArrowLeftRight className="h-3 w-3 text-[#475569]" />
                    <span>Transfer</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenMergeModal}
                    className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2 text-[11px] font-semibold text-[#1E293B] transition-colors hover:bg-slate-50"
                  >
                    <GitMerge className="h-3 w-3 text-[#475569]" />
                    <span>Merge</span>
                  </button>
                  <button
                    type="button"
                    aria-label="More table actions"
                    onClick={onOpenMoreActionsModal}
                    className="inline-flex h-7 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] transition-colors hover:bg-slate-50"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[16px] font-extrabold text-[#102344]">
                    {posDraft.orderType === "takeaway"
                      ? "Takeaway Counter"
                      : `Delivery • ${posDraft.provider ?? "Own fleet"}`}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-[#64748B]">
                    {posDraft.guests} Guest{posDraft.guests > 1 ? "s" : ""} • Fast-Track Billing
                  </p>
                </div>
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10.5px] font-bold text-[#0866F5]">
                  {posDraft.orderType.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Order Items List */}
          <div className="max-h-[296px] flex-1 divide-y divide-[#F1F5F9] overflow-y-auto px-3.5 py-1">
            {posDraft.lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-[12.5px] font-bold text-[#102344]">No items in current order</p>
                <p className="mt-1 text-[11px] text-[#64748B]">
                  Tap <strong className="text-[#0866F5]">+</strong> on any menu card to add dishes.
                </p>
              </div>
            ) : (
              posDraft.lines.map((line) => {
                const sub = lineTotal(line);
                const badges = [
                  ...line.modifiers,
                  ...line.addons.map((a) => `${a.name} (+₹${a.price})`),
                  ...(line.note ? [line.note] : []),
                ];

                return (
                  <div key={line.lineId} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <img
                        src={getDishImage(line.name)}
                        alt={line.name}
                        className="h-10 w-10 shrink-0 rounded-lg border border-slate-200/80 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => onEditLine(line)}
                          title="Click to edit modifiers, add-ons, or chef note"
                          className="block truncate text-left text-[12.5px] font-bold text-[#102344] transition-colors hover:text-[#0866F5]"
                        >
                          {line.name}
                        </button>
                        {badges.length > 0 ? (
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {badges.map((b, i) => (
                              <button
                                key={`${line.lineId}-b-${i}`}
                                type="button"
                                onClick={() => onEditLine(line)}
                                className="inline-flex items-center rounded border border-[#FED7AA] bg-[#FFF7ED] px-1.5 py-0.2 text-[10px] font-semibold text-[#C2410C]"
                              >
                                {b}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onEditLine(line)}
                            className="mt-0.5 text-[10px] font-medium text-[#94A3B8] hover:text-[#0866F5]"
                          >
                            + Add modifier
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {/* Quantity Stepper */}
                      <div className="inline-flex h-7 items-center rounded-lg border border-[#BFDBFE] bg-[#F0F7FF]">
                        <button
                          type="button"
                          aria-label={`Decrease quantity of ${line.name}`}
                          onClick={() => onUpdateLineQty(line.lineId, line.qty - 1)}
                          className="flex h-full w-6 items-center justify-center rounded-l-lg text-[#0866F5] transition-colors hover:bg-blue-100/70"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-[11.5px] font-bold text-[#102344] tabular">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${line.name}`}
                          onClick={() => onUpdateLineQty(line.lineId, line.qty + 1)}
                          className="flex h-full w-6 items-center justify-center rounded-r-lg text-[#0866F5] transition-colors hover:bg-blue-100/70"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Line Total */}
                      <span className="w-12 text-right text-[12.5px] font-extrabold text-[#102344] tabular">
                        {inr(sub)}
                      </span>

                      {/* Delete Item Button */}
                      <button
                        type="button"
                        aria-label={`Remove ${line.name}`}
                        onClick={() => onRemoveLine(line.lineId)}
                        className="rounded-md p-1 text-[#EF4444] transition-colors hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Special Instructions Input Box */}
          <div className="px-3.5 py-2">
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#334155]">
                <Pencil className="h-3 w-3 text-[#64748B]" />
                <span>Add Note / Special Instructions</span>
              </div>
              <input
                type="text"
                value={posDraft.note}
                onChange={(e) => onChangeNote(e.target.value)}
                placeholder="e.g., Less spicy, extra gravy, no onion..."
                className="mt-1 w-full bg-transparent text-[11px] text-[#102344] placeholder:text-[#94A3B8] focus:outline-none"
              />
            </div>
          </div>

          {/* Bill Summary Section */}
          <div className="space-y-2 border-t border-[#EEF2F8] px-3.5 py-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-[13px] font-extrabold text-[#102344]">Bill Summary</h4>
              <button
                type="button"
                onClick={onOpenDiscountDialog}
                className="inline-flex items-center gap-1 rounded-lg border border-[#D8E3F2] bg-[#F8FAFC] px-2.5 py-1 text-[10.5px] font-bold text-[#0866F5] transition-colors hover:bg-[#EBF3FF]"
              >
                <Pencil className="h-3 w-3" />
                <span>Apply Discount</span>
              </button>
            </div>

            <div className="space-y-1.5 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-[#475569]">Items Total</span>
                <span className="font-bold text-[#102344] tabular">{inr(bill.subtotal)}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[#475569]">Discount</span>
                  <select
                    aria-label="Discount percentage"
                    value={posDraft.discountPct}
                    onChange={(e) => onChangeDiscount(Number(e.target.value))}
                    className="h-6 rounded-lg border border-[#E2E8F0] bg-white px-2 text-[11px] font-semibold text-[#102344] focus:border-[#0866F5] focus:outline-none"
                  >
                    {discountPresets.map((pct) => {
                      const amt = Math.round((bill.subtotal * pct) / 100);
                      return (
                        <option key={pct} value={pct}>
                          {pct}% ({inr(amt)})
                        </option>
                      );
                    })}
                  </select>
                </div>
                <span className="font-bold text-[#059669] tabular">- {inr(bill.discount)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#475569]">Subtotal</span>
                <span className="font-bold text-[#102344] tabular">{inr(bill.taxable)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#475569]">GST ({gstPct}%)</span>
                <span className="font-bold text-[#102344] tabular">{inr(bill.gst)}</span>
              </div>
            </div>

            {/* Prominent Final Total Box */}
            <div className="flex items-center justify-between rounded-xl border border-[#BFDBFE] bg-[#EBF3FF] px-3.5 py-2.5">
              <span className="text-[14px] font-extrabold text-[#102344]">Total Amount</span>
              <span className="text-[20px] font-extrabold leading-none text-[#0866F5] tabular">
                {inr(bill.total)}
              </span>
            </div>
          </div>

          {/* Checkout Action Buttons */}
          <div className="space-y-2 px-3.5 pb-3.5 pt-1">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={posDraft.lines.length === 0}
                onClick={onSaveOrder}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-2 text-[11.5px] font-bold text-[#1E293B] shadow-2xs transition-colors hover:bg-slate-50 disabled:opacity-45"
              >
                <BookmarkCheck className="h-3.5 w-3.5 text-[#334155]" />
                <span>Save Order</span>
              </button>

              <button
                type="button"
                disabled={posDraft.lines.length === 0}
                onClick={onHoldOrder}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-2 text-[11.5px] font-bold text-[#1E293B] shadow-2xs transition-colors hover:bg-slate-50 disabled:opacity-45"
              >
                <PauseCircle className="h-3.5 w-3.5 text-[#334155]" />
                <span>Hold Order</span>
              </button>

              <button
                type="button"
                disabled={posDraft.lines.length === 0}
                onClick={onPrintKot}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-2 text-[11.5px] font-bold text-[#1E293B] shadow-2xs transition-colors hover:bg-slate-50 disabled:opacity-45"
              >
                <Printer className="h-3.5 w-3.5 text-[#334155]" />
                <span>Print KOT</span>
              </button>
            </div>

            <button
              type="button"
              disabled={posDraft.lines.length === 0}
              onClick={onProceedToPayment}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0866F5] text-[13.5px] font-bold text-white shadow-sm transition-all hover:bg-[#0756D0] active:scale-[0.99] disabled:opacity-50"
            >
              <span className="text-[15px] font-extrabold">₹</span>
              <span>Proceed to Payment</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: ORDER HISTORY */}
      {activeTab === "history" && (
        <div className="flex-1 divide-y divide-[#F1F5F9] overflow-y-auto p-3.5">
          {recentOrders.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#64748B]">
              No recent orders recorded yet.
            </div>
          ) : (
            recentOrders.map((ord) => {
              const total = orderTotal(ord, gstPct);
              return (
                <div key={ord.id} className="space-y-2 py-3 first:pt-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[12.5px] font-extrabold text-[#102344]">{ord.id}</span>
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-[#475569]">
                        {ord.tableId ? `Table ${ord.tableId}` : ord.type.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[13px] font-extrabold text-[#0866F5] tabular">
                      {inr(total)}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#64748B]">
                    {ord.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        ord.payment === "paid"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700",
                      )}
                    >
                      {ord.payment} • {ord.status}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onViewOrderReceipt(ord)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-2 py-1 text-[10.5px] font-semibold text-[#1E293B] hover:bg-slate-50"
                      >
                        <Receipt className="h-3 w-3" /> Receipt
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onLoadOrderIntoPos(ord.id);
                          setActiveTab("current");
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#EBF3FF] px-2.5 py-1 text-[10.5px] font-bold text-[#0866F5] hover:bg-[#DBEAFE]"
                      >
                        Load in POS
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: HOLD ORDERS */}
      {activeTab === "held" && (
        <div className="flex-1 divide-y divide-[#F1F5F9] overflow-y-auto p-3.5">
          {held.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#64748B]">
              No parked orders currently on hold.
            </div>
          ) : (
            held.map((h) => {
              const heldTotal = totals(h.lines, 0, gstPct).total;
              return (
                <div key={h.id} className="space-y-2 py-3 first:pt-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[12.5px] font-extrabold text-[#102344]">{h.label}</div>
                      <div className="text-[10.5px] text-[#64748B]">
                        {h.id} • {h.lines.length} items
                      </div>
                    </div>
                    <span className="text-[13px] font-extrabold text-[#0866F5] tabular">
                      {inr(heldTotal)}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#64748B]">
                    {h.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => onDeleteHeldOrder(h.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50/60 px-2.5 py-1 text-[10.5px] font-semibold text-red-600 hover:bg-red-100"
                    >
                      <Trash2 className="h-3 w-3" /> Discard
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onResumeHeldOrder(h.id);
                        setActiveTab("current");
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#0866F5] px-3 py-1 text-[10.5px] font-bold text-white hover:bg-[#0756D0]"
                    >
                      <PlayCircle className="h-3 w-3" /> Resume Order
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </aside>
  );
}
